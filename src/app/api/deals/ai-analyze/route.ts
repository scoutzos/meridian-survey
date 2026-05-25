import { NextRequest, NextResponse } from "next/server";
import {
  DEAL_AI_ANALYSIS_SCHEMA,
  buildFallbackDealAiAnalysis,
  normalizeDealAiAnalysis,
  type DealAiAnalysisResult,
} from "@/lib/deal-ai";
import { calculateBuildAnalysis } from "@/lib/build-underwriting";
import { calculateDealAnalysis, type DealInput } from "@/lib/deals";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeRequest = {
  deal?: DealInput;
  context?: string;
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
const SYSTEM_PROMPT = [
  "You are Meridian Collective's internal real estate underwriting analyst.",
  "Analyze land and new-build deal packets using Meridian's land-to-build decision framework.",
  "Do not invent facts or comps. Treat unavailable facts as missing information.",
  "Prioritize sold new-construction comps for build deals.",
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
  const fallback = buildFallbackDealAiAnalysis(deal);
  const client = resolveDealAiClient();

  if (!client.apiKey) {
    return NextResponse.json({
      ...fallback,
      note: `No ${client.missingKeyName} configured, so Meridian used the deterministic calculator fallback.`,
    });
  }

  try {
    const ai = client.provider === "openrouter"
      ? await analyzeWithOpenRouter(deal, body.context || "", client, fallback)
      : await analyzeWithOpenAI(deal, body.context || "", client, fallback);
    return NextResponse.json(ai);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed.";
    return NextResponse.json({
      ...fallback,
      note: `AI analysis failed (${message}); Meridian used the deterministic calculator fallback.`,
    });
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
  client: DealAiClient,
  fallback: DealAiAnalysisResult,
): Promise<DealAiAnalysisResult> {
  const payload = buildAnalysisPayload(deal, context);

  const res = await fetch("https://api.openai.com/v1/responses", {
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
    }),
  });

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
  client: DealAiClient,
  fallback: DealAiAnalysisResult,
): Promise<DealAiAnalysisResult> {
  const payload = buildAnalysisPayload(deal, context);
  const headers: Record<string, string> = {
    authorization: `Bearer ${client.apiKey}`,
    "content-type": "application/json",
    "x-title": "Meridian Deal Portal",
  };
  const siteUrl = process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) headers["http-referer"] = siteUrl;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
      stream: false,
    }),
  });

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

function buildAnalysisPayload(deal: DealInput, context: string) {
  const calculator = calculateDealAnalysis(deal);
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
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
      notes: deal.notes,
      exit_strategy: deal.exit_strategy,
      target_buyer_type: deal.target_buyer_type,
      target_resale_price: deal.target_resale_price,
      minimum_acceptable_price: deal.minimum_acceptable_price,
      best_buyer_offer: deal.best_buyer_offer,
      buyer_demand_evidence: deal.buyer_demand_evidence,
      closing_costs_estimate: deal.closing_costs_estimate,
      holding_costs_estimate: deal.holding_costs_estimate,
      marketing_costs_estimate: deal.marketing_costs_estimate,
      desired_minimum_spread: deal.desired_minimum_spread,
      risk_buffer: deal.risk_buffer,
      calculator_notes: deal.calculator_notes,
      build_analysis: deal.build_analysis,
    },
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
