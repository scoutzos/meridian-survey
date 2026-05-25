import { NextRequest, NextResponse } from "next/server";
import {
  DEAL_AI_ANALYSIS_SCHEMA,
  buildFallbackDealAiAnalysis,
  normalizeDealAiAnalysis,
  type DealAiAnalysisResult,
  type DealAiPortalContext,
} from "@/lib/deal-ai";
import { calculateBuildAnalysis } from "@/lib/build-underwriting";
import { calculateDealAnalysis, type DealInput } from "@/lib/deals";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeRequest = {
  deal?: DealInput;
  context?: string;
  portal_context?: DealAiPortalContext;
};

type DealAiProvider = "openai" | "openrouter";

type DealAiClient = {
  provider: DealAiProvider;
  apiKey?: string;
  model: string;
  missingKeyName: string;
};

const DEFAULT_OPENAI_MODEL = "gpt-5-nano";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5-nano";
const DEFAULT_PROVIDER_TIMEOUT_MS = 25_000;
const SYSTEM_PROMPT = [
  "You are Meridian Collective's internal real estate underwriting analyst.",
  "Analyze land and new-build deal packets using Meridian's land-to-build decision framework.",
  "Do not invent facts or comps. Treat unavailable facts as missing information.",
  "Prioritize sold new-construction comps for build deals.",
  "Use portal_context as the source-of-truth evidence packet: property record, parsed listing facts, research checklist, saved comps, build budget, member financing assumptions, and exit strategy.",
  "Active listings can support market interest but cannot prove ARV. Saved comps only count toward ARV when they are sold and have a credible new-build signal.",
  "Explain the residual offer math: supported ARV minus build costs, soft costs, financing, selling costs, target profit, and contingency.",
  "Every green-light statement must be backed by an evidence_sources item. If the evidence is missing, mark the related gate needs-proof or blocked.",
  "Grade every decision_framework gate: property identity, buildability, sold new-build comps, build budget, financing, exit strategy, offer decision, and vote readiness.",
  "Only mark a gate ready when the provided packet contains enough evidence. Otherwise use needs-proof or blocked.",
  "Use offer_guidance.decision as buy, negotiate, research-more, or pass. Do not say buy if sold new-build comps, build budget, financing, or buildability are missing.",
  "Flag zoning, utilities, flood/wetlands, title, financing, construction budget, and ARV uncertainty.",
  "This is internal underwriting support, not legal, tax, appraisal, or investment advice.",
  "Return JSON only using the provided schema.",
].join("\n");

export async function POST(req: NextRequest) {
  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid AI analysis request." }, { status: 400 });
  }

  if (!body.deal || typeof body.deal !== "object") {
    return NextResponse.json({ error: "deal is required." }, { status: 400 });
  }

  const deal = body.deal;
  const fallback = buildFallbackDealAiAnalysis(deal, undefined, body.portal_context);
  const client = resolveDealAiClient();

  if (!client.apiKey) {
    return NextResponse.json({
      ...fallback,
      note: `No ${client.missingKeyName} configured, so Meridian used the deterministic calculator fallback.`,
    });
  }

  try {
    const ai = client.provider === "openrouter"
      ? await analyzeWithOpenRouter(deal, body.context || "", body.portal_context, client, fallback)
      : await analyzeWithOpenAI(deal, body.context || "", body.portal_context, client, fallback);
    return NextResponse.json(ai);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed.";
    return NextResponse.json(buildFallbackDealAiAnalysis(
      deal,
      `AI provider did not complete (${message}); Meridian used the deterministic build-decision framework instead.`,
      body.portal_context,
    ));
  }
}

function resolveDealAiClient(): DealAiClient {
  const requested = (process.env.DEAL_AI_PROVIDER || process.env.AI_PROVIDER || "").trim().toLowerCase();
  const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY);
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const provider: DealAiProvider = requested === "openrouter" || (!requested && hasOpenRouterKey && !hasOpenAiKey)
    ? "openrouter"
    : "openai";

  if (provider === "openrouter") {
    return {
      provider,
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_DEAL_ANALYST_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
      missingKeyName: "OPENROUTER_API_KEY",
    };
  }

  return {
    provider,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_DEAL_ANALYST_MODEL || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    missingKeyName: "OPENAI_API_KEY",
  };
}

async function analyzeWithOpenAI(
  deal: DealInput,
  context: string,
  portalContext: DealAiPortalContext | undefined,
  client: DealAiClient,
  fallback: DealAiAnalysisResult,
): Promise<DealAiAnalysisResult> {
  const payload = buildAnalysisPayload(deal, context, portalContext);

  const res = await fetchWithProviderTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${client.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: client.model,
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meridian_deal_ai_analysis",
          strict: true,
          schema: DEAL_AI_ANALYSIS_SCHEMA,
        },
      },
      max_output_tokens: 2200,
    }),
  }, "OpenAI");

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 240)}`);
  }

  const data = await res.json();
  const raw = responseText(data);
  if (!raw) throw new Error("OpenAI returned no structured output.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON.");
  }
  return {
    ...normalizeDealAiAnalysis(parsed, fallback),
    source: "openai",
    model: client.model,
    generated_at: new Date().toISOString(),
  };
}

async function analyzeWithOpenRouter(
  deal: DealInput,
  context: string,
  portalContext: DealAiPortalContext | undefined,
  client: DealAiClient,
  fallback: DealAiAnalysisResult,
): Promise<DealAiAnalysisResult> {
  const payload = buildAnalysisPayload(deal, context, portalContext);
  const headers: Record<string, string> = {
    authorization: `Bearer ${client.apiKey}`,
    "content-type": "application/json",
    "x-title": "Meridian Deal Portal",
  };
  const siteUrl = process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) headers["http-referer"] = siteUrl;

  const res = await fetchWithProviderTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: client.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meridian_deal_ai_analysis",
          strict: true,
          schema: DEAL_AI_ANALYSIS_SCHEMA,
        },
      },
      provider: {
        require_parameters: true,
        data_collection: "deny",
      },
      temperature: 0.2,
      max_tokens: 2200,
      stream: false,
    }),
  }, "OpenRouter");

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 240)}`);
  }

  const data = await res.json();
  const raw = chatCompletionText(data);
  if (!raw) throw new Error("OpenRouter returned no structured output.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter returned invalid JSON.");
  }
  return {
    ...normalizeDealAiAnalysis(parsed, fallback),
    source: "openrouter",
    model: client.model,
    generated_at: new Date().toISOString(),
  };
}

function buildAnalysisPayload(deal: DealInput, context: string, portalContext?: DealAiPortalContext) {
  const calculator = calculateDealAnalysis(deal);
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const compactPortalContext = compactPortalContextForAi(portalContext);
  return {
    deal: {
      title: deal.title,
      property_type: deal.property_type,
      strategy: deal.strategy,
      status: deal.status,
      urgency: deal.urgency,
      address: deal.address,
      parcel_id: deal.parcel_id,
      asking_price: deal.asking_price,
      arv: deal.arv,
      repair_estimate: deal.repair_estimate,
      acreage: deal.acreage,
      zoning: deal.zoning,
      road_frontage: deal.road_frontage,
      utilities: deal.utilities,
      notes: compactText(deal.notes, 1200),
      exit_strategy: deal.exit_strategy,
      target_buyer_type: deal.target_buyer_type,
      target_resale_price: deal.target_resale_price,
      minimum_acceptable_price: deal.minimum_acceptable_price,
      best_buyer_offer: deal.best_buyer_offer,
      buyer_demand_evidence: compactText(deal.buyer_demand_evidence, 1200),
      closing_costs_estimate: deal.closing_costs_estimate,
      holding_costs_estimate: deal.holding_costs_estimate,
      marketing_costs_estimate: deal.marketing_costs_estimate,
      desired_minimum_spread: deal.desired_minimum_spread,
      risk_buffer: deal.risk_buffer,
      calculator_notes: compactText(deal.calculator_notes, 1200),
      build_analysis: compactUnknown(deal.build_analysis, 600, 8, 14),
    },
    portal_context: compactPortalContext || null,
    calculator,
    build,
    decision_framework_rubric: {
      property_identity: "Address/APN, county, acreage, ask, source link, and parcel identity are clear.",
      buildability: "Zoning/setbacks, road access, utilities or septic/sewer path, flood/wetlands, topo, HOA/subdivision restrictions are verified or explicitly unresolved.",
      sold_new_build_comps: "At least 3 sold new-construction comps support ARV, preferably recent, nearby, same schools/community, similar sqft/bed/bath/finish.",
      build_budget: "Build specs, hard costs, soft costs, permits, utility taps, site work, contingency, holding, selling costs, and break-even sale are documented.",
      financing: "Cash required, per-member contribution, lender/investor source, rate, points, duration, and draw/interest assumptions are documented.",
      exit_strategy: "Primary build-and-sell exit and backup exit are stated with target buyer and minimum spread.",
      offer_decision: "Recommended offer, max offer, seller discount, and required contingencies are clear.",
      vote_readiness: "Ready only if missing/blocked gates are resolved or explicitly framed as open items for member decision.",
    },
    context,
  };
}

async function fetchWithProviderTimeout(url: string, init: RequestInit, label: string): Promise<Response> {
  const timeoutMs = providerTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function providerTimeoutMs(): number {
  const configured = Number(process.env.DEAL_AI_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured >= 5_000) {
    return Math.min(configured, 45_000);
  }
  return DEFAULT_PROVIDER_TIMEOUT_MS;
}

function compactPortalContextForAi(portalContext?: DealAiPortalContext): DealAiPortalContext | undefined {
  if (!portalContext) return undefined;
  return {
    property_record: portalContext.property_record || null,
    parsed_listing_facts: compactFactRecord(portalContext.parsed_listing_facts),
    research_items: (portalContext.research_items || []).slice(0, 20).map(item => ({
      ...item,
      result_summary: compactText(item.result_summary, 500),
      evidence_value: compactText(item.evidence_value, 500),
      notes: compactText(item.notes, 500),
    })),
    comp_records: (portalContext.comp_records || []).slice(0, 12).map(comp => ({
      id: comp.id,
      comp_type: comp.comp_type,
      address: comp.address,
      parcel_id: comp.parcel_id,
      county: comp.county,
      city: comp.city,
      state: comp.state,
      zip: comp.zip,
      price: comp.price,
      acreage: comp.acreage,
      price_per_acre: comp.price_per_acre,
      sale_or_list_date: comp.sale_or_list_date,
      distance_miles: comp.distance_miles,
      similarity_score: comp.similarity_score,
      source_system: comp.source_system,
      source_url: comp.source_url,
      listing_text: compactText(comp.listing_text, 700),
      listing_details: compactFactRecord(comp.listing_details),
      raw_data: compactFactRecord(comp.raw_data),
      similarity_notes: compactText(comp.similarity_notes, 400),
      adjustment_notes: compactText(comp.adjustment_notes, 400),
      include_in_valuation: comp.include_in_valuation,
      confidence: comp.confidence,
    })),
    member_notes: (portalContext.member_notes || []).map(note => compactText(note, 900)).filter((note): note is string => Boolean(note)).slice(0, 4),
    generated_at: portalContext.generated_at,
  };
}

function compactFactRecord(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  const keep = /address|parcel|apn|price|ask|acre|lot|mls|source|status|description|special|zoning|utilities|water|sewer|hoa|subdivision|region|county|city|tax|assessment|market value|date on market|days|flood|wetland|topography|school|elementary|middle|high|walk|bike|rent|zestimate|history|nearby homes|similar homes|monthly payment/i;
  const skip = /original listing text|source raw fields|section snapshot|search result|line count|photo count|nearby city values|zip values|label values|footer|disclaimer|copyright|terms|privacy/i;
  const entries = Object.entries(value)
    .filter(([key, item]) => item !== null && item !== undefined && String(item).trim() && keep.test(key) && !skip.test(key))
    .slice(0, 45)
    .map(([key, item]) => [key, compactUnknown(item, 500, 6, 10)]);
  return entries.length ? Object.fromEntries(entries) : null;
}

function compactText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function compactUnknown(value: unknown, maxText = 500, maxArray = 6, maxKeys = 10): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return compactText(value, maxText);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, maxArray).map(item => compactUnknown(item, Math.min(maxText, 280), Math.min(maxArray, 4), Math.min(maxKeys, 8)));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== null && item !== undefined && String(item).trim())
        .slice(0, maxKeys)
        .map(([key, item]) => [key, compactUnknown(item, Math.min(maxText, 280), Math.min(maxArray, 4), Math.min(maxKeys, 8))]),
    );
  }
  return compactText(value, maxText);
}

function responseText(data: unknown): string {
  const row = data as Record<string, unknown>;
  if (typeof row.output_text === "string") return row.output_text;
  const output = Array.isArray(row.output) ? row.output : [];
  return output
    .flatMap(item => {
      const content = item && typeof item === "object" ? (item as Record<string, unknown>).content : null;
      return Array.isArray(content) ? content : [];
    })
    .map(item => {
      if (!item || typeof item !== "object") return "";
      const part = item as Record<string, unknown>;
      if (typeof part.text === "string") return part.text;
      if (typeof part.output_text === "string") return part.output_text;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function chatCompletionText(data: unknown): string {
  const row = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const choices = Array.isArray(row.choices) ? row.choices : [];
  const firstChoice = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : {};
  const message = firstChoice.message && typeof firstChoice.message === "object" ? firstChoice.message as Record<string, unknown> : {};
  const content = message.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map(item => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const part = item as Record<string, unknown>;
      if (typeof part.text === "string") return part.text;
      if (typeof part.content === "string") return part.content;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}
