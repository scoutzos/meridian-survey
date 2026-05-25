import { calculateBuildAnalysis } from "./build-underwriting";
import { calculateDealAnalysis, type DealInput } from "./deals";

export type DealAiRecommendation = "Strong Review" | "Review With Caution" | "Needs More Info" | "Likely Pass";
export type DealAiConfidence = "Low" | "Medium" | "High";
export type DealAiActionPriority = "low" | "medium" | "high" | "urgent";
export type DealAiGateStatus = "ready" | "needs-proof" | "blocked";
export type DealAiOfferDecision = "buy" | "negotiate" | "research-more" | "pass";
export type DealAiEvidenceSourceType = "property-record" | "parsed-listing" | "research-check" | "saved-comp" | "build-budget" | "member-note" | "calculator";
export type DealAiCompSupportStatus = "supported" | "unsupported" | "insufficient" | "unknown";
export type DealAiCompProofType = "arv-proof" | "land-support" | "market-signal" | "not-arv-proof" | "needs-review";

export interface DealAiNextAction {
  title: string;
  owner: string;
  priority: DealAiActionPriority;
  reason: string;
}

export interface DealAiCompStrategy {
  target_comp_type: string;
  search_radius_miles: number;
  lookback_months: number;
  required_count: number;
  include_filters: string[];
  reject_filters: string[];
}

export interface DealAiFieldSuggestions {
  submission_summary: string;
  requested_next_step: string;
  submit_uncertainties: string;
  buyer_demand_evidence: string;
  exit_strategy: string;
  target_buyer_type: string;
  calculator_notes: string;
  build_analysis_notes: string;
}

export interface DealAiDecisionGate {
  status: DealAiGateStatus;
  finding: string;
  evidence_needed: string;
  next_step: string;
}

export interface DealAiDecisionFramework {
  property_identity: DealAiDecisionGate;
  buildability: DealAiDecisionGate;
  sold_new_build_comps: DealAiDecisionGate;
  build_budget: DealAiDecisionGate;
  financing: DealAiDecisionGate;
  exit_strategy: DealAiDecisionGate;
  offer_decision: DealAiDecisionGate;
  vote_readiness: DealAiDecisionGate;
}

export interface DealAiOfferGuidance {
  decision: DealAiOfferDecision;
  recommended_offer: string;
  max_offer: string;
  required_seller_discount: string;
  contingency_terms: string[];
  rationale: string;
}

export interface DealAiEvidenceSource {
  label: string;
  source_type: DealAiEvidenceSourceType;
  status: string;
  detail: string;
  source_url: string;
}

export interface DealAiCompInsight {
  id: string;
  address: string;
  comp_type: string;
  proof_type: DealAiCompProofType;
  score: number;
  price: string;
  distance: string;
  date: string;
  strengths: string[];
  concerns: string[];
  source_url: string;
}

export interface DealAiCompIntelligence {
  sold_comp_count: number;
  sold_new_build_count: number;
  active_comp_count: number;
  included_comp_count: number;
  arv_support: DealAiCompSupportStatus;
  supported_arv: string;
  median_sold_price: string;
  median_sold_new_build_price: string;
  median_price_per_acre: string;
  summary: string;
  comp_insights: DealAiCompInsight[];
}

export interface DealAiResidualOffer {
  supported_arv: string;
  build_costs: string;
  soft_costs: string;
  financing_costs: string;
  selling_costs: string;
  target_profit: string;
  contingency: string;
  max_land_offer: string;
  recommended_offer: string;
  formula: string;
  confidence: DealAiConfidence;
  notes: string[];
}

export interface DealAiPortalPropertyRecord {
  id?: string | null;
  address?: string | null;
  parcel_id?: string | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  acreage?: number | null;
  asking_price?: number | null;
  zoning?: string | null;
  subdivision?: string | null;
  hoa_status?: string | null;
  utilities?: string | null;
  flood_zone?: string | null;
  wetlands?: string | null;
  topography?: string | null;
  property_url?: string | null;
  parcel_link?: string | null;
  comping_link?: string | null;
}

export interface DealAiPortalResearchItem {
  id?: string | null;
  category: string;
  title: string;
  status: string;
  result_summary?: string | null;
  evidence_value?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  notes?: string | null;
}

export interface DealAiPortalCompRecord {
  id: string;
  comp_type: string;
  address?: string | null;
  parcel_id?: string | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  price?: number | null;
  acreage?: number | null;
  price_per_acre?: number | null;
  sale_or_list_date?: string | null;
  distance_miles?: number | null;
  similarity_score?: number | null;
  source_system?: string | null;
  source_url?: string | null;
  listing_text?: string | null;
  listing_details?: Record<string, unknown> | null;
  raw_data?: Record<string, unknown> | null;
  similarity_notes?: string | null;
  adjustment_notes?: string | null;
  include_in_valuation?: boolean | null;
  confidence?: string | null;
}

export interface DealAiPortalContext {
  property_record?: DealAiPortalPropertyRecord | null;
  parsed_listing_facts?: Record<string, unknown> | null;
  research_items?: DealAiPortalResearchItem[];
  comp_records?: DealAiPortalCompRecord[];
  member_notes?: string[];
  generated_at?: string;
}

export interface DealAiAnalysisResult {
  recommendation: DealAiRecommendation;
  confidence: DealAiConfidence;
  decision_framework: DealAiDecisionFramework;
  offer_guidance: DealAiOfferGuidance;
  comp_intelligence: DealAiCompIntelligence;
  residual_offer: DealAiResidualOffer;
  evidence_sources: DealAiEvidenceSource[];
  executive_summary: string;
  investment_thesis: string;
  pricing_guidance: string;
  key_risks: string[];
  missing_info: string[];
  next_actions: DealAiNextAction[];
  comp_strategy: DealAiCompStrategy;
  field_suggestions: DealAiFieldSuggestions;
  source_notes: string[];
  source: "openai" | "openrouter" | "fallback";
  model: string;
  generated_at: string;
  note?: string;
}

export const DEAL_AI_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    recommendation: { type: "string", enum: ["Strong Review", "Review With Caution", "Needs More Info", "Likely Pass"] },
    confidence: { type: "string", enum: ["Low", "Medium", "High"] },
    decision_framework: {
      type: "object",
      properties: {
        property_identity: { "$ref": "#/$defs/decision_gate" },
        buildability: { "$ref": "#/$defs/decision_gate" },
        sold_new_build_comps: { "$ref": "#/$defs/decision_gate" },
        build_budget: { "$ref": "#/$defs/decision_gate" },
        financing: { "$ref": "#/$defs/decision_gate" },
        exit_strategy: { "$ref": "#/$defs/decision_gate" },
        offer_decision: { "$ref": "#/$defs/decision_gate" },
        vote_readiness: { "$ref": "#/$defs/decision_gate" },
      },
      required: [
        "property_identity",
        "buildability",
        "sold_new_build_comps",
        "build_budget",
        "financing",
        "exit_strategy",
        "offer_decision",
        "vote_readiness",
      ],
      additionalProperties: false,
    },
    offer_guidance: {
      type: "object",
      properties: {
        decision: { type: "string", enum: ["buy", "negotiate", "research-more", "pass"] },
        recommended_offer: { type: "string" },
        max_offer: { type: "string" },
        required_seller_discount: { type: "string" },
        contingency_terms: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
      },
      required: ["decision", "recommended_offer", "max_offer", "required_seller_discount", "contingency_terms", "rationale"],
      additionalProperties: false,
    },
    comp_intelligence: {
      type: "object",
      properties: {
        sold_comp_count: { type: "number" },
        sold_new_build_count: { type: "number" },
        active_comp_count: { type: "number" },
        included_comp_count: { type: "number" },
        arv_support: { type: "string", enum: ["supported", "unsupported", "insufficient", "unknown"] },
        supported_arv: { type: "string" },
        median_sold_price: { type: "string" },
        median_sold_new_build_price: { type: "string" },
        median_price_per_acre: { type: "string" },
        summary: { type: "string" },
        comp_insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              address: { type: "string" },
              comp_type: { type: "string" },
              proof_type: { type: "string", enum: ["arv-proof", "land-support", "market-signal", "not-arv-proof", "needs-review"] },
              score: { type: "number" },
              price: { type: "string" },
              distance: { type: "string" },
              date: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              concerns: { type: "array", items: { type: "string" } },
              source_url: { type: "string" },
            },
            required: ["id", "address", "comp_type", "proof_type", "score", "price", "distance", "date", "strengths", "concerns", "source_url"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "sold_comp_count",
        "sold_new_build_count",
        "active_comp_count",
        "included_comp_count",
        "arv_support",
        "supported_arv",
        "median_sold_price",
        "median_sold_new_build_price",
        "median_price_per_acre",
        "summary",
        "comp_insights",
      ],
      additionalProperties: false,
    },
    residual_offer: {
      type: "object",
      properties: {
        supported_arv: { type: "string" },
        build_costs: { type: "string" },
        soft_costs: { type: "string" },
        financing_costs: { type: "string" },
        selling_costs: { type: "string" },
        target_profit: { type: "string" },
        contingency: { type: "string" },
        max_land_offer: { type: "string" },
        recommended_offer: { type: "string" },
        formula: { type: "string" },
        confidence: { type: "string", enum: ["Low", "Medium", "High"] },
        notes: { type: "array", items: { type: "string" } },
      },
      required: [
        "supported_arv",
        "build_costs",
        "soft_costs",
        "financing_costs",
        "selling_costs",
        "target_profit",
        "contingency",
        "max_land_offer",
        "recommended_offer",
        "formula",
        "confidence",
        "notes",
      ],
      additionalProperties: false,
    },
    evidence_sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          source_type: { type: "string", enum: ["property-record", "parsed-listing", "research-check", "saved-comp", "build-budget", "member-note", "calculator"] },
          status: { type: "string" },
          detail: { type: "string" },
          source_url: { type: "string" },
        },
        required: ["label", "source_type", "status", "detail", "source_url"],
        additionalProperties: false,
      },
    },
    executive_summary: { type: "string" },
    investment_thesis: { type: "string" },
    pricing_guidance: { type: "string" },
    key_risks: { type: "array", items: { type: "string" } },
    missing_info: { type: "array", items: { type: "string" } },
    next_actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          owner: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          reason: { type: "string" },
        },
        required: ["title", "owner", "priority", "reason"],
        additionalProperties: false,
      },
    },
    comp_strategy: {
      type: "object",
      properties: {
        target_comp_type: { type: "string" },
        search_radius_miles: { type: "number" },
        lookback_months: { type: "number" },
        required_count: { type: "number" },
        include_filters: { type: "array", items: { type: "string" } },
        reject_filters: { type: "array", items: { type: "string" } },
      },
      required: ["target_comp_type", "search_radius_miles", "lookback_months", "required_count", "include_filters", "reject_filters"],
      additionalProperties: false,
    },
    field_suggestions: {
      type: "object",
      properties: {
        submission_summary: { type: "string" },
        requested_next_step: { type: "string" },
        submit_uncertainties: { type: "string" },
        buyer_demand_evidence: { type: "string" },
        exit_strategy: { type: "string" },
        target_buyer_type: { type: "string" },
        calculator_notes: { type: "string" },
        build_analysis_notes: { type: "string" },
      },
      required: [
        "submission_summary",
        "requested_next_step",
        "submit_uncertainties",
        "buyer_demand_evidence",
        "exit_strategy",
        "target_buyer_type",
        "calculator_notes",
        "build_analysis_notes",
      ],
      additionalProperties: false,
    },
    source_notes: { type: "array", items: { type: "string" } },
  },
  required: [
    "recommendation",
    "confidence",
    "decision_framework",
    "offer_guidance",
    "comp_intelligence",
    "residual_offer",
    "evidence_sources",
    "executive_summary",
    "investment_thesis",
    "pricing_guidance",
    "key_risks",
    "missing_info",
    "next_actions",
    "comp_strategy",
    "field_suggestions",
    "source_notes",
  ],
  $defs: {
    decision_gate: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ready", "needs-proof", "blocked"] },
        finding: { type: "string" },
        evidence_needed: { type: "string" },
        next_step: { type: "string" },
      },
      required: ["status", "finding", "evidence_needed", "next_step"],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return `${Math.round(value * 1000) / 10}%`;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]): number | null {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function yearsAgo(dateText: string | null | undefined): number | null {
  if (!dateText) return null;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / 31557600000;
}

function stringifyCompact(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function firstText(...values: Array<string | null | undefined>): string {
  return values.map(value => value?.trim()).find(Boolean) || "";
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function priorityForMissing(item: string): DealAiActionPriority {
  const lower = item.toLowerCase();
  if (lower.includes("comp") || lower.includes("arv") || lower.includes("construction") || lower.includes("financing")) return "high";
  if (lower.includes("zoning") || lower.includes("utilities") || lower.includes("flood") || lower.includes("wetland")) return "urgent";
  return "medium";
}

function gate(
  status: DealAiGateStatus,
  finding: string,
  evidence_needed: string,
  next_step: string,
): DealAiDecisionGate {
  return { status, finding, evidence_needed, next_step };
}

function missingIncludes(missing: string[], pattern: RegExp): boolean {
  return missing.some(item => pattern.test(item));
}

function compSearchText(comp: DealAiPortalCompRecord): string {
  return [
    comp.address,
    comp.similarity_notes,
    comp.adjustment_notes,
    comp.listing_text,
    stringifyCompact(comp.listing_details),
    stringifyCompact(comp.raw_data),
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasNewBuildSignal(comp: DealAiPortalCompRecord): boolean {
  const text = compSearchText(comp);
  if (/\b(new construction|new build|newly built|to be built|never lived|builder|spec home)\b/i.test(text)) return true;
  if (/\bbuilt\s*(in)?\s*[-–—]{2,}/i.test(text)) return false;
  const currentYear = new Date().getFullYear();
  const years = Array.from(text.matchAll(/\b(?:built(?:\s+in)?|year built|yr built)?\s*(20[1-3][0-9])\b/gi))
    .map(match => Number(match[1]))
    .filter(year => Number.isFinite(year));
  return years.some(year => year >= currentYear - 3);
}

function scoreComp(
  deal: DealInput,
  portal: DealAiPortalContext | undefined,
  comp: DealAiPortalCompRecord,
  targetArv: number | null,
): DealAiCompInsight {
  const included = comp.include_in_valuation !== false;
  const sold = comp.comp_type === "sold";
  const active = comp.comp_type === "active";
  const newBuild = hasNewBuildSignal(comp);
  const distance = asNumber(comp.distance_miles);
  const saleAge = yearsAgo(comp.sale_or_list_date);
  const price = asNumber(comp.price);
  const ppa = asNumber(comp.price_per_acre);
  const strengths: string[] = [];
  const concerns: string[] = [];
  let score = 0;

  if (included) score += 10;
  else concerns.push("Excluded from valuation");
  if (sold) {
    score += 25;
    strengths.push("Closed/sold comp");
  } else if (active) {
    score -= 20;
    concerns.push("Active listing is market signal only, not ARV proof");
  } else {
    concerns.push("Not a closed sale");
  }
  if (newBuild) {
    score += 20;
    strengths.push("New-build signal found");
  } else if (sold) {
    concerns.push("New-build status not proven");
  }
  if (typeof distance === "number") {
    if (distance <= 1.5) {
      score += 15;
      strengths.push("Within 1.5 miles");
    } else if (distance <= 3) {
      score += 8;
      strengths.push("Within 3 miles");
    } else {
      concerns.push("Distance may need adjustment");
    }
  } else {
    concerns.push("Distance missing");
  }
  if (saleAge !== null) {
    if (saleAge <= 1) {
      score += 15;
      strengths.push("Sold/listed within 12 months");
    } else if (saleAge <= 2) {
      score += 8;
      strengths.push("Within 24 months");
    } else {
      concerns.push("Sale date is stale");
    }
  } else {
    concerns.push("Sale/list date missing");
  }
  if (comp.confidence === "high") score += 10;
  else if (comp.confidence === "medium") score += 6;
  else concerns.push("Comp confidence needs review");

  const sameCity = comp.city && portal?.property_record?.city && comp.city.toLowerCase() === portal.property_record.city.toLowerCase();
  const sameCounty = comp.county && portal?.property_record?.county && comp.county.toLowerCase() === portal.property_record.county.toLowerCase();
  if (sameCity) {
    score += 8;
    strengths.push("Same city");
  } else if (sameCounty) {
    score += 4;
    strengths.push("Same county");
  }

  if (price && targetArv) {
    if (price >= targetArv * 0.95) {
      score += 12;
      strengths.push("Price supports target ARV range");
    } else if (price < targetArv * 0.85) {
      concerns.push("Price is materially below target ARV");
    }
  }

  if (typeof comp.similarity_score === "number" && Number.isFinite(comp.similarity_score)) score += Math.max(0, Math.min(10, comp.similarity_score / 10));

  let proofType: DealAiCompProofType = "needs-review";
  if (sold && newBuild && included && score >= 55) proofType = "arv-proof";
  else if (sold && ppa && included) proofType = "land-support";
  else if (active) proofType = "not-arv-proof";
  else if (sold) proofType = "market-signal";

  return {
    id: comp.id || comp.source_url || comp.address || "comp",
    address: firstText(comp.address, comp.parcel_id, comp.source_url, "Saved comp"),
    comp_type: comp.comp_type || "unknown",
    proof_type: proofType,
    score: Math.max(0, Math.min(100, Math.round(score))),
    price: money(price),
    distance: typeof distance === "number" ? `${Math.round(distance * 10) / 10} mi` : "Unknown",
    date: comp.sale_or_list_date || "Unknown",
    strengths: unique(strengths).slice(0, 5),
    concerns: unique(concerns).slice(0, 5),
    source_url: comp.source_url || "",
  };
}

function buildCompIntelligence(
  deal: DealInput,
  portal?: DealAiPortalContext,
): { result: DealAiCompIntelligence; supportedArvValue: number | null } {
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const targetArv = asNumber(build.targetArv) ?? asNumber(deal.target_resale_price) ?? asNumber(deal.arv);
  const comps = portal?.comp_records || [];
  const manualSoldNewBuildCount = Math.max(0, Math.round(asNumber(deal.build_analysis?.comps?.sold_comp_count) ?? 0));
  const included = comps.filter(comp => comp.include_in_valuation !== false);
  const insights = included
    .map(comp => scoreComp(deal, portal, comp, targetArv))
    .sort((a, b) => b.score - a.score);
  const sold = included.filter(comp => comp.comp_type === "sold");
  const soldNewBuild = included.filter(comp => comp.comp_type === "sold" && hasNewBuildSignal(comp));
  const activeCount = included.filter(comp => comp.comp_type === "active").length;
  const soldPrices = sold.map(comp => asNumber(comp.price)).filter((value): value is number => typeof value === "number");
  const soldNewBuildPrices = soldNewBuild.map(comp => asNumber(comp.price)).filter((value): value is number => typeof value === "number");
  const ppas = included.map(comp => asNumber(comp.price_per_acre)).filter((value): value is number => typeof value === "number" && value > 0);
  const medianSold = median(soldPrices);
  const medianNewBuild = median(soldNewBuildPrices);
  const medianPpa = median(ppas);
  const soldNewBuildCount = Math.max(soldNewBuild.length, manualSoldNewBuildCount);

  let arvSupport: DealAiCompSupportStatus = "unknown";
  if (soldNewBuildCount < 3) arvSupport = "insufficient";
  else if (!targetArv || !medianNewBuild) arvSupport = "unknown";
  else if (medianNewBuild >= targetArv * 0.9) arvSupport = "supported";
  else arvSupport = "unsupported";

  const supportedArvValue = arvSupport === "supported" && targetArv
    ? targetArv
    : medianNewBuild ?? medianSold ?? null;
  const summary = comps.length === 0
    ? manualSoldNewBuildCount >= 3
      ? `${manualSoldNewBuildCount} sold new-build comps are noted in the build analysis, but individual saved comp evidence is not attached.`
      : "No saved comps were attached to this property record."
    : arvSupport === "supported"
      ? `${soldNewBuildCount} sold new-build comps support the target ARV range.`
      : arvSupport === "unsupported"
        ? `${soldNewBuildCount} sold new-build comps were found, but their median sale price does not support the target ARV.`
        : arvSupport === "insufficient"
          ? `Only ${soldNewBuildCount} sold new-build comp${soldNewBuildCount === 1 ? "" : "s"} are proven; Meridian requires at least 3.`
          : "Saved comps exist, but target ARV support is still unclear.";

  return {
    result: {
      sold_comp_count: Math.max(sold.length, manualSoldNewBuildCount),
      sold_new_build_count: soldNewBuildCount,
      active_comp_count: activeCount,
      included_comp_count: included.length,
      arv_support: arvSupport,
      supported_arv: money(supportedArvValue),
      median_sold_price: money(medianSold),
      median_sold_new_build_price: money(medianNewBuild),
      median_price_per_acre: medianPpa ? `${money(medianPpa)}/ac` : "N/A",
      summary,
      comp_insights: insights.slice(0, 8),
    },
    supportedArvValue: arvSupport === "supported" ? supportedArvValue : null,
  };
}

function buildResidualOffer(
  deal: DealInput,
  compIntelligence: DealAiCompIntelligence,
  supportedArvValue: number | null,
): { result: DealAiResidualOffer; maxLandOfferValue: number | null; recommendedOfferValue: number | null } {
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const analysis = calculateDealAnalysis(deal);
  const buildInput = deal.build_analysis;
  const baseExit = buildInput?.exits?.build_sell?.base;
  const salePrice = supportedArvValue ?? asNumber(build.targetArv) ?? asNumber(deal.target_resale_price) ?? asNumber(deal.arv);
  const sellPct = ((asNumber(baseExit?.agent_commission_pct) ?? 0) + (asNumber(baseExit?.buyer_concessions_pct) ?? 0) + (asNumber(baseExit?.seller_closing_pct) ?? 0)) / 100;
  const sellingCosts = salePrice ? salePrice * sellPct : 0;
  const softCosts = build.teardownTotal
    + build.budgetTotals.pre_construction
    + build.budgetTotals.carrying
    + build.budgetTotals.selling_prep
    + build.budgetTotals.additional;
  const buildCosts = build.budgetTotals.construction;
  const targetProfit = asNumber(deal.desired_minimum_spread) ?? (salePrice ? Math.max(50_000, salePrice * 0.12) : 0);
  const contingency = asNumber(deal.risk_buffer) ?? Math.max(10_000, buildCosts * 0.1);
  const canCalculate = Boolean(salePrice && buildCosts && compIntelligence.arv_support === "supported");
  const maxLandOffer = canCalculate
    ? Math.max(0, (salePrice as number) - buildCosts - softCosts - build.totalFinancingCost - sellingCosts - targetProfit - contingency)
    : null;
  const recommendedOffer = maxLandOffer !== null ? Math.max(0, maxLandOffer - Math.max(5_000, maxLandOffer * 0.05)) : null;
  const confidence: DealAiConfidence = canCalculate && compIntelligence.sold_new_build_count >= 3 && !build.missingInfo.some(item => /construction budget|financing/i.test(item))
    ? "High"
    : canCalculate
      ? "Medium"
      : "Low";
  const notes = [
    compIntelligence.arv_support === "supported" ? "Uses supported ARV from saved sold new-build comps." : "Max land offer is not vote-ready until sold new-build comps support ARV.",
    buildCosts ? "Construction budget is present." : "Construction budget is missing.",
    build.totalFinancingCost ? "Financing cost is included from build analysis." : "Financing cost is zero or not yet documented.",
    targetProfit ? `Target profit is ${money(targetProfit)}.` : "Target profit is missing.",
  ];

  return {
    result: {
      supported_arv: money(salePrice),
      build_costs: money(buildCosts),
      soft_costs: money(softCosts),
      financing_costs: money(build.totalFinancingCost),
      selling_costs: money(sellingCosts),
      target_profit: money(targetProfit),
      contingency: money(contingency),
      max_land_offer: money(maxLandOffer),
      recommended_offer: money(recommendedOffer),
      formula: "Supported ARV - build costs - soft costs - financing costs - selling costs - target profit - contingency = max land offer",
      confidence,
      notes,
    },
    maxLandOfferValue: maxLandOffer,
    recommendedOfferValue: recommendedOffer ?? analysis.acquisition.recommendedOffer ?? null,
  };
}

function buildEvidenceSources(
  deal: DealInput,
  portal: DealAiPortalContext | undefined,
  compIntelligence: DealAiCompIntelligence,
  residualOffer: DealAiResidualOffer,
): DealAiEvidenceSource[] {
  const sources: DealAiEvidenceSource[] = [];
  const property = portal?.property_record;
  if (property) {
    sources.push({
      label: "Property record",
      source_type: "property-record",
      status: property.parcel_id || property.address ? "available" : "needs-proof",
      detail: [property.address, property.parcel_id, property.county, property.acreage ? `${property.acreage} ac` : null, property.asking_price ? money(property.asking_price) : null].filter(Boolean).join(" · ") || "Property identity fields are incomplete.",
      source_url: property.property_url || property.parcel_link || "",
    });
  }
  if (portal?.parsed_listing_facts && Object.keys(portal.parsed_listing_facts).length > 0) {
    sources.push({
      label: "Parsed listing facts",
      source_type: "parsed-listing",
      status: "captured",
      detail: `${Object.keys(portal.parsed_listing_facts).length} listing fields captured from pasted/source text.`,
      source_url: property?.property_url || "",
    });
  }
  (portal?.research_items || []).slice(0, 12).forEach(item => {
    sources.push({
      label: item.title || item.category,
      source_type: "research-check",
      status: item.status || "unknown",
      detail: firstText(item.evidence_value, item.result_summary, item.notes, "No evidence summary saved."),
      source_url: item.source_url || "",
    });
  });
  compIntelligence.comp_insights.slice(0, 6).forEach(comp => {
    sources.push({
      label: comp.address,
      source_type: "saved-comp",
      status: comp.proof_type,
      detail: `${comp.comp_type} · score ${comp.score} · ${comp.price} · ${comp.concerns.length ? `Concern: ${comp.concerns[0]}` : "usable signal"}`,
      source_url: comp.source_url,
    });
  });
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  sources.push({
    label: "Build budget",
    source_type: "build-budget",
    status: build.budgetTotals.construction ? "available" : "missing",
    detail: `Build ${money(build.budgetTotals.construction)} · soft/carry/site ${residualOffer.soft_costs} · financing ${residualOffer.financing_costs}.`,
    source_url: "",
  });
  (portal?.member_notes || []).filter(Boolean).slice(0, 3).forEach((note, idx) => {
    sources.push({
      label: `Member note ${idx + 1}`,
      source_type: "member-note",
      status: "provided",
      detail: note.slice(0, 240),
      source_url: "",
    });
  });
  sources.push({
    label: "Residual offer math",
    source_type: "calculator",
    status: residualOffer.confidence,
    detail: `${residualOffer.formula}. Max land offer: ${residualOffer.max_land_offer}.`,
    source_url: "",
  });
  return sources.slice(0, 24);
}

function offerDecisionFromFramework(args: {
  recommendation: DealAiRecommendation;
  missing: string[];
  risks: string[];
  baseProfit: number | null;
  baseRoi: number | null;
  compSupport?: DealAiCompSupportStatus;
  residualMaxOffer?: number | null;
}): DealAiOfferDecision {
  if (args.compSupport === "unsupported") return "pass";
  if (args.compSupport === "insufficient" || args.compSupport === "unknown") return "research-more";
  if (args.residualMaxOffer !== undefined && args.residualMaxOffer !== null && args.residualMaxOffer <= 0) return "pass";
  const hasHardBlocker = args.risks.some(risk => /negative|break-even|blocked/i.test(risk)) || (args.baseProfit !== null && args.baseProfit < 0);
  if (hasHardBlocker || args.recommendation === "Likely Pass") return "pass";
  if (args.missing.some(item => /comp|arv|construction|financing|zoning|setback|utilities/i.test(item))) return "research-more";
  if (args.recommendation === "Strong Review" && (args.baseRoi ?? 0) >= 0.18) return "buy";
  return "negotiate";
}

function buildDecisionFramework(
  deal: DealInput,
  recommendation: DealAiRecommendation,
  missing: string[],
  risks: string[],
  portal: DealAiPortalContext | undefined,
  compIntelligence: DealAiCompIntelligence,
  residualMaxOffer: number | null,
): DealAiDecisionFramework {
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const hasIdentity = Boolean((deal.address || deal.parcel_id) && deal.acreage && deal.asking_price);
  const researchItems = portal?.research_items || [];
  const verifiedResearch = new Set(researchItems.filter(item => item.status === "verified").map(item => item.category));
  const blockedResearch = researchItems.filter(item => item.status === "blocked");
  const buildabilityBlocked = blockedResearch.some(item => /flood|wetland|zoning|utilities|access|gis/i.test(item.category))
    || risks.some(risk => /flood|wetland|zoning|utilities|access|blocked|landlocked/i.test(risk));
  const hasBuildability = !buildabilityBlocked
    && (Boolean(deal.zoning) || verifiedResearch.has("zoning"))
    && (Boolean(deal.utilities) || verifiedResearch.has("utilities") || verifiedResearch.has("access"));
  const hasComps = compIntelligence.arv_support === "supported";
  const hasBudget = !missingIncludes(missing, /construction budget|build size|specs/i);
  const hasFinancing = !missingIncludes(missing, /financing/i);
  const hasExit = Boolean((deal.exit_strategy || deal.target_buyer_type) && (deal.target_resale_price || deal.arv || build.targetArv));
  const offerDecision = offerDecisionFromFramework({
    recommendation,
    missing,
    risks,
    baseProfit: build.baseNetProfit,
    baseRoi: build.baseRoi,
    compSupport: compIntelligence.arv_support,
    residualMaxOffer,
  });
  const readyForVote = missing.length === 0 && risks.length <= 1 && offerDecision !== "research-more" && hasComps;

  return {
    property_identity: gate(
      hasIdentity ? "ready" : "needs-proof",
      hasIdentity ? "Property identity is usable for underwriting." : "The record is not complete enough to treat as source-of-truth.",
      "Address or APN, acreage, asking price, county, and listing/source link.",
      hasIdentity ? "Keep this record as the decision packet anchor." : "Verify address/APN, acreage, and ask before pricing the deal.",
    ),
    buildability: gate(
      buildabilityBlocked ? "blocked" : hasBuildability ? "ready" : "needs-proof",
      hasBuildability ? "No major buildability gap is flagged by the packet." : "Buildability still needs source proof before offer authority.",
      "Zoning/setbacks, road access, utilities or septic/sewer path, flood/wetlands, topo, HOA/subdivision rules.",
      hasBuildability ? "Attach proof and keep monitoring permit/utility assumptions." : "Clear zoning, utility/access, and flood/wetland questions before calling it buyable.",
    ),
    sold_new_build_comps: gate(
      hasComps ? "ready" : "needs-proof",
      hasComps ? compIntelligence.summary : "The deal should not be presented as a buy until saved sold new-build comps support ARV.",
      "At least 3 sold new-construction comps, recent, similar sqft/bed/bath/finish, same school/community when possible.",
      hasComps ? "Use the comp set to defend ARV and offer ceiling." : "Pull sold new-build comps and write why each supports the exit price.",
    ),
    build_budget: gate(
      hasBudget ? "ready" : "needs-proof",
      hasBudget ? "Build specs and budget are present." : "Budget is too thin to trust profit or break-even.",
      "Home size/specs, hard costs, soft costs, permits, utility taps, site work, contingency, selling costs.",
      hasBudget ? "Stress-test budget against GC/lender assumptions." : "Complete the build budget before making a member vote recommendation.",
    ),
    financing: gate(
      hasFinancing ? "ready" : "needs-proof",
      hasFinancing ? "A financing source is present." : "The packet does not yet prove how the project gets funded.",
      "Cash required, per-member contribution, lender type, rate, points, duration, draw/interest assumptions.",
      hasFinancing ? "Confirm terms and cash-to-close before offer." : "Document financing source and member cash requirement.",
    ),
    exit_strategy: gate(
      hasExit ? "ready" : "needs-proof",
      hasExit ? "Exit path exists, but it still depends on comp and budget support." : "Exit path is not defensible yet.",
      "Build-and-sell ARV, backup wholesale/builder exit, target buyer, timeline, and minimum acceptable spread.",
      hasExit ? "Keep build/sell as primary and name the backup exit." : "Define target resale, buyer type, and backup exit before voting.",
    ),
    offer_decision: gate(
      offerDecision === "pass" ? "blocked" : offerDecision === "research-more" ? "needs-proof" : "ready",
      offerDecision === "buy" ? "Buy case is supportable from the current packet." : offerDecision === "negotiate" ? "Negotiation may work if seller meets the offer ceiling." : offerDecision === "pass" ? "Current packet points to pass or pause." : "Research is required before offer authority.",
      "Max offer, recommended offer, required seller discount, contingencies, and proof of ARV/build cost support.",
      offerDecision === "pass" ? "Do not pursue unless price/risk changes materially." : offerDecision === "research-more" ? "Do not issue offer authority until missing gates are cleared." : "Use contingencies and stay under the max offer.",
    ),
    vote_readiness: gate(
      readyForVote ? "ready" : risks.some(risk => /blocked|negative|break-even/i.test(risk)) ? "blocked" : "needs-proof",
      readyForVote ? "Members can review this with clear assumptions." : "The packet is not yet clean enough for a final vote.",
      "Every gate either verified or explicitly waived, with comp support, budget, financing, risks, and exact member ask.",
      readyForVote ? "Submit for member review." : "Resolve missing/blocked gates before presenting as ready-to-buy.",
    ),
  };
}

function buildOfferGuidance(
  deal: DealInput,
  recommendation: DealAiRecommendation,
  missing: string[],
  risks: string[],
  compIntelligence: DealAiCompIntelligence,
  residual: { maxLandOfferValue: number | null; recommendedOfferValue: number | null },
): DealAiOfferGuidance {
  const analysis = calculateDealAnalysis(deal);
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const decision = offerDecisionFromFramework({
    recommendation,
    missing,
    risks,
    baseProfit: build.baseNetProfit,
    baseRoi: build.baseRoi,
    compSupport: compIntelligence.arv_support,
    residualMaxOffer: residual.maxLandOfferValue,
  });
  const maxOffer = residual.maxLandOfferValue ?? analysis.acquisition.maxOffer ?? analysis.maxAllowableOffer ?? null;
  const recommendedOffer = residual.recommendedOfferValue ?? analysis.acquisition.recommendedOffer ?? maxOffer;
  const ask = deal.asking_price ?? null;
  const discount = ask && recommendedOffer
    ? `${money(Math.max(0, ask - recommendedOffer))} below ask`
    : "Unknown until ask and offer ceiling are both available";
  return {
    decision,
    recommended_offer: recommendedOffer !== null ? money(recommendedOffer) : "Unknown",
    max_offer: maxOffer !== null ? money(maxOffer) : "Unknown",
    required_seller_discount: decision === "pass" ? "Price/risk must change materially before re-opening." : discount,
    contingency_terms: [
      "Due diligence approval by Meridian members",
      "Sold new-build comps must support ARV",
      "Zoning, setbacks, utilities/septic/sewer, and access verification",
      "Flood, wetlands, topo, and soil/buildability review",
      "Construction budget and financing approval",
      "Clear title and acceptable survey",
    ],
    rationale: compIntelligence.arv_support !== "supported"
      ? `No green light: ${compIntelligence.summary}`
      : decision === "buy"
        ? "Current framework gates support a buy recommendation if contingencies stay in place."
        : decision === "negotiate"
          ? "The deal may work only if price and terms stay under the residual land value ceiling."
          : decision === "pass"
            ? "The current risks or economics do not support a buy recommendation."
            : "The packet needs more proof before offer authority.",
  };
}

export function buildFallbackDealAiAnalysis(deal: DealInput, note?: string, portal?: DealAiPortalContext): DealAiAnalysisResult {
  const analysis = calculateDealAnalysis(deal);
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const isLandBuild = deal.property_type === "land";
  const compCalc = buildCompIntelligence(deal, portal);
  const residualCalc = buildResidualOffer(deal, compCalc.result, compCalc.supportedArvValue);
  let missing = unique([
    ...analysis.missingInfo,
    ...(isLandBuild ? build.missingInfo : []),
  ]);
  if (compCalc.result.sold_new_build_count >= 3) {
    missing = missing.filter(item => !/at least 3 new-build sold comps/i.test(item));
  }
  if (compCalc.supportedArvValue) {
    missing = missing.filter(item => !/target arv|estimated resale|finished-lot value/i.test(item));
  }
  if (isLandBuild && compCalc.result.arv_support !== "supported") {
    missing = unique([...missing, compCalc.result.sold_new_build_count < 3 ? "3 verified sold new-build comps" : "Sold new-build comps that support target ARV"]);
  }
  const risks = unique([
    ...analysis.riskFlags,
    ...(isLandBuild ? build.riskFlags : []),
    ...(compCalc.result.arv_support === "unsupported" ? ["Saved sold new-build comps do not support the target ARV."] : []),
  ]);
  const recommendation = isLandBuild && build.recommendation !== "Needs More Info"
    ? build.recommendation
    : analysis.recommendation;
  const confidence: DealAiConfidence = missing.length <= 2 ? "High" : missing.length <= 5 ? "Medium" : "Low";
  const summary = isLandBuild
    ? `${recommendation}: evaluate this as a build deal only after new-build sold comps, construction budget, financing, and zoning/utilities are documented. Current base profit is ${money(build.baseNetProfit)} at ${pct(build.baseRoi)} ROI with ${money(build.cashRequiredFromGroup)} cash required.`
    : `${recommendation}: validate ARV, repair scope, acquisition price, buyer demand, and exit confidence before moving to vote.`;
  const nextActions = (missing.length ? missing : ["Validate new-build sold comps", "Confirm construction and financing assumptions"])
    .slice(0, 6)
    .map((item): DealAiNextAction => ({
      title: `Verify ${item}`,
      owner: "VA / deal owner",
      priority: priorityForMissing(item),
      reason: `This input affects the member vote and offer ceiling.`,
    }));
  const compStrategy: DealAiCompStrategy = {
    target_comp_type: isLandBuild ? "Sold new-construction homes" : "Sold comparable properties",
    search_radius_miles: isLandBuild ? 1.5 : 1,
    lookback_months: 12,
    required_count: 3,
    include_filters: isLandBuild
      ? ["Closed/sold only", "New construction or year built within 2 years", "Similar finished square footage", "Same school/community when possible"]
      : ["Closed/sold only", "Similar property type", "Similar condition and size", "Same neighborhood when possible"],
    reject_filters: isLandBuild
      ? ["Active listings only", "Major renovations sold as old construction", "Different school district without adjustment", "Unsupported builder/spec differences"]
      : ["Active-only comps", "Distressed outliers without adjustment", "Different property type", "Stale sales without market adjustment"],
  };
  const requestedNextStep = nextActions[0]?.title || "Complete missing underwriting inputs.";
  const uncertainties = missing.length ? missing.map(item => `- ${item}`).join("\n") : "No major missing underwriting fields flagged by the calculator.";
  const buildNotes = isLandBuild
    ? [
        `Project cost: ${money(build.totalProjectCost)}`,
        `Target ARV: ${money(build.targetArv)}`,
        `Base profit: ${money(build.baseNetProfit)}`,
        `Base ROI: ${pct(build.baseRoi)}`,
        `Cash required: ${money(build.cashRequiredFromGroup)}`,
        `Break-even sale: ${money(build.breakEvenSalePrice)}`,
      ].join("\n")
    : "";
  const decisionFramework = buildDecisionFramework(deal, recommendation, missing, risks, portal, compCalc.result, residualCalc.maxLandOfferValue);
  const offerGuidance = buildOfferGuidance(deal, recommendation, missing, risks, compCalc.result, residualCalc);
  const evidenceSources = buildEvidenceSources(deal, portal, compCalc.result, residualCalc.result);

  return {
    recommendation,
    confidence,
    decision_framework: decisionFramework,
    offer_guidance: offerGuidance,
    comp_intelligence: compCalc.result,
    residual_offer: residualCalc.result,
    evidence_sources: evidenceSources,
    executive_summary: summary,
    investment_thesis: isLandBuild
      ? "The deal should be judged on whether nearby sold new builds support the ARV and whether construction, financing, and entitlement risk still leave acceptable member profit."
      : "The deal should be judged on verified value, cost scope, buyer demand, and the exit path before capital is committed.",
    pricing_guidance: isLandBuild
      ? `Do not vote until break-even (${money(build.breakEvenSalePrice)}) is clearly below supported ARV (${money(build.targetArv)}).`
      : `Use calculator MAO ${money(analysis.maxAllowableOffer)} as the current pricing guardrail.`,
    key_risks: risks.length ? risks : ["No AI-only risk flags; still verify source documents before voting."],
    missing_info: missing,
    next_actions: nextActions,
    comp_strategy: compStrategy,
    field_suggestions: {
      submission_summary: summary,
      requested_next_step: requestedNextStep,
      submit_uncertainties: uncertainties,
      buyer_demand_evidence: deal.buyer_demand_evidence || `Add at least ${compStrategy.required_count} ${compStrategy.target_comp_type.toLowerCase()} and note why each comp supports the exit value.`,
      exit_strategy: deal.exit_strategy || (isLandBuild ? "Build new construction and sell; wholesale/assignment backup if build risk does not clear" : deal.strategy || "Resale / assignment"),
      target_buyer_type: deal.target_buyer_type || (isLandBuild ? "Retail new-build buyer / builder investor backup" : "Investor or retail buyer"),
      calculator_notes: [analysis.summary, buildNotes].filter(Boolean).join("\n\n"),
      build_analysis_notes: buildNotes,
    },
    source_notes: [
      "Fallback analysis uses existing portal calculator outputs, saved research, and saved comps; it does not pull external data.",
      "Verify all comps, costs, zoning, title, and financing assumptions before member vote.",
    ],
    source: "fallback",
    model: "fallback",
    generated_at: new Date().toISOString(),
    note,
  };
}

function normalizeGate(value: unknown, fallback: DealAiDecisionGate): DealAiDecisionGate {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const status = ["ready", "needs-proof", "blocked"].includes(String(row.status)) ? row.status as DealAiGateStatus : fallback.status;
  return {
    status,
    finding: typeof row.finding === "string" ? row.finding : fallback.finding,
    evidence_needed: typeof row.evidence_needed === "string" ? row.evidence_needed : fallback.evidence_needed,
    next_step: typeof row.next_step === "string" ? row.next_step : fallback.next_step,
  };
}

function normalizeDecisionFramework(value: unknown, fallback: DealAiDecisionFramework): DealAiDecisionFramework {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    property_identity: normalizeGate(row.property_identity, fallback.property_identity),
    buildability: normalizeGate(row.buildability, fallback.buildability),
    sold_new_build_comps: normalizeGate(row.sold_new_build_comps, fallback.sold_new_build_comps),
    build_budget: normalizeGate(row.build_budget, fallback.build_budget),
    financing: normalizeGate(row.financing, fallback.financing),
    exit_strategy: normalizeGate(row.exit_strategy, fallback.exit_strategy),
    offer_decision: normalizeGate(row.offer_decision, fallback.offer_decision),
    vote_readiness: normalizeGate(row.vote_readiness, fallback.vote_readiness),
  };
}

function normalizeOfferGuidance(value: unknown, fallback: DealAiOfferGuidance): DealAiOfferGuidance {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const decision = ["buy", "negotiate", "research-more", "pass"].includes(String(row.decision)) ? row.decision as DealAiOfferDecision : fallback.decision;
  return {
    decision,
    recommended_offer: typeof row.recommended_offer === "string" ? row.recommended_offer : fallback.recommended_offer,
    max_offer: typeof row.max_offer === "string" ? row.max_offer : fallback.max_offer,
    required_seller_discount: typeof row.required_seller_discount === "string" ? row.required_seller_discount : fallback.required_seller_discount,
    contingency_terms: Array.isArray(row.contingency_terms) ? row.contingency_terms.map(String).filter(Boolean) : fallback.contingency_terms,
    rationale: typeof row.rationale === "string" ? row.rationale : fallback.rationale,
  };
}

function normalizeCompIntelligence(value: unknown, fallback: DealAiCompIntelligence): DealAiCompIntelligence {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const support = ["supported", "unsupported", "insufficient", "unknown"].includes(String(row.arv_support)) ? row.arv_support as DealAiCompSupportStatus : fallback.arv_support;
  const insights = Array.isArray(row.comp_insights)
    ? row.comp_insights.map(item => {
        const comp = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const proofType = ["arv-proof", "land-support", "market-signal", "not-arv-proof", "needs-review"].includes(String(comp.proof_type))
          ? comp.proof_type as DealAiCompProofType
          : "needs-review";
        return {
          id: typeof comp.id === "string" ? comp.id : "comp",
          address: typeof comp.address === "string" ? comp.address : "Saved comp",
          comp_type: typeof comp.comp_type === "string" ? comp.comp_type : "unknown",
          proof_type: proofType,
          score: typeof comp.score === "number" ? comp.score : 0,
          price: typeof comp.price === "string" ? comp.price : "N/A",
          distance: typeof comp.distance === "string" ? comp.distance : "Unknown",
          date: typeof comp.date === "string" ? comp.date : "Unknown",
          strengths: Array.isArray(comp.strengths) ? comp.strengths.map(String).filter(Boolean) : [],
          concerns: Array.isArray(comp.concerns) ? comp.concerns.map(String).filter(Boolean) : [],
          source_url: typeof comp.source_url === "string" ? comp.source_url : "",
        };
      })
    : fallback.comp_insights;
  return {
    sold_comp_count: typeof row.sold_comp_count === "number" ? row.sold_comp_count : fallback.sold_comp_count,
    sold_new_build_count: typeof row.sold_new_build_count === "number" ? row.sold_new_build_count : fallback.sold_new_build_count,
    active_comp_count: typeof row.active_comp_count === "number" ? row.active_comp_count : fallback.active_comp_count,
    included_comp_count: typeof row.included_comp_count === "number" ? row.included_comp_count : fallback.included_comp_count,
    arv_support: support,
    supported_arv: typeof row.supported_arv === "string" ? row.supported_arv : fallback.supported_arv,
    median_sold_price: typeof row.median_sold_price === "string" ? row.median_sold_price : fallback.median_sold_price,
    median_sold_new_build_price: typeof row.median_sold_new_build_price === "string" ? row.median_sold_new_build_price : fallback.median_sold_new_build_price,
    median_price_per_acre: typeof row.median_price_per_acre === "string" ? row.median_price_per_acre : fallback.median_price_per_acre,
    summary: typeof row.summary === "string" ? row.summary : fallback.summary,
    comp_insights: insights,
  };
}

function normalizeResidualOffer(value: unknown, fallback: DealAiResidualOffer): DealAiResidualOffer {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const confidence = ["Low", "Medium", "High"].includes(String(row.confidence)) ? row.confidence as DealAiConfidence : fallback.confidence;
  return {
    supported_arv: typeof row.supported_arv === "string" ? row.supported_arv : fallback.supported_arv,
    build_costs: typeof row.build_costs === "string" ? row.build_costs : fallback.build_costs,
    soft_costs: typeof row.soft_costs === "string" ? row.soft_costs : fallback.soft_costs,
    financing_costs: typeof row.financing_costs === "string" ? row.financing_costs : fallback.financing_costs,
    selling_costs: typeof row.selling_costs === "string" ? row.selling_costs : fallback.selling_costs,
    target_profit: typeof row.target_profit === "string" ? row.target_profit : fallback.target_profit,
    contingency: typeof row.contingency === "string" ? row.contingency : fallback.contingency,
    max_land_offer: typeof row.max_land_offer === "string" ? row.max_land_offer : fallback.max_land_offer,
    recommended_offer: typeof row.recommended_offer === "string" ? row.recommended_offer : fallback.recommended_offer,
    formula: typeof row.formula === "string" ? row.formula : fallback.formula,
    confidence,
    notes: Array.isArray(row.notes) ? row.notes.map(String).filter(Boolean) : fallback.notes,
  };
}

function normalizeEvidenceSources(value: unknown, fallback: DealAiEvidenceSource[]): DealAiEvidenceSource[] {
  if (!Array.isArray(value)) return fallback;
  const allowedTypes = new Set<DealAiEvidenceSourceType>(["property-record", "parsed-listing", "research-check", "saved-comp", "build-budget", "member-note", "calculator"]);
  const rows = value.map(item => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const sourceType = allowedTypes.has(row.source_type as DealAiEvidenceSourceType) ? row.source_type as DealAiEvidenceSourceType : "calculator";
    return {
      label: typeof row.label === "string" ? row.label : "Evidence",
      source_type: sourceType,
      status: typeof row.status === "string" ? row.status : "unknown",
      detail: typeof row.detail === "string" ? row.detail : "",
      source_url: typeof row.source_url === "string" ? row.source_url : "",
    };
  }).filter(row => row.label.trim());
  return rows.length ? rows : fallback;
}

export function normalizeDealAiAnalysis(value: unknown, fallback: DealAiAnalysisResult): DealAiAnalysisResult {
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  const suggestions = row.field_suggestions && typeof row.field_suggestions === "object" ? row.field_suggestions as Record<string, unknown> : {};
  const comp = row.comp_strategy && typeof row.comp_strategy === "object" ? row.comp_strategy as Record<string, unknown> : {};
  return {
    ...fallback,
    recommendation: ["Strong Review", "Review With Caution", "Needs More Info", "Likely Pass"].includes(String(row.recommendation)) ? row.recommendation as DealAiRecommendation : fallback.recommendation,
    confidence: ["Low", "Medium", "High"].includes(String(row.confidence)) ? row.confidence as DealAiConfidence : fallback.confidence,
    decision_framework: normalizeDecisionFramework(row.decision_framework, fallback.decision_framework),
    offer_guidance: normalizeOfferGuidance(row.offer_guidance, fallback.offer_guidance),
    comp_intelligence: normalizeCompIntelligence(row.comp_intelligence, fallback.comp_intelligence),
    residual_offer: normalizeResidualOffer(row.residual_offer, fallback.residual_offer),
    evidence_sources: normalizeEvidenceSources(row.evidence_sources, fallback.evidence_sources),
    executive_summary: typeof row.executive_summary === "string" ? row.executive_summary : fallback.executive_summary,
    investment_thesis: typeof row.investment_thesis === "string" ? row.investment_thesis : fallback.investment_thesis,
    pricing_guidance: typeof row.pricing_guidance === "string" ? row.pricing_guidance : fallback.pricing_guidance,
    key_risks: Array.isArray(row.key_risks) ? unique(row.key_risks.map(String)) : fallback.key_risks,
    missing_info: Array.isArray(row.missing_info) ? unique(row.missing_info.map(String)) : fallback.missing_info,
    next_actions: Array.isArray(row.next_actions)
      ? row.next_actions.map(item => {
          const action = item && typeof item === "object" ? item as Record<string, unknown> : {};
          const priority = ["low", "medium", "high", "urgent"].includes(String(action.priority)) ? action.priority as DealAiActionPriority : "medium";
          return {
            title: typeof action.title === "string" ? action.title : "Review underwriting input",
            owner: typeof action.owner === "string" ? action.owner : "VA / deal owner",
            priority,
            reason: typeof action.reason === "string" ? action.reason : "Needed before member vote.",
          };
        }).filter(action => action.title.trim())
      : fallback.next_actions,
    comp_strategy: {
      target_comp_type: typeof comp.target_comp_type === "string" ? comp.target_comp_type : fallback.comp_strategy.target_comp_type,
      search_radius_miles: typeof comp.search_radius_miles === "number" ? comp.search_radius_miles : fallback.comp_strategy.search_radius_miles,
      lookback_months: typeof comp.lookback_months === "number" ? comp.lookback_months : fallback.comp_strategy.lookback_months,
      required_count: typeof comp.required_count === "number" ? comp.required_count : fallback.comp_strategy.required_count,
      include_filters: Array.isArray(comp.include_filters) ? comp.include_filters.map(String).filter(Boolean) : fallback.comp_strategy.include_filters,
      reject_filters: Array.isArray(comp.reject_filters) ? comp.reject_filters.map(String).filter(Boolean) : fallback.comp_strategy.reject_filters,
    },
    field_suggestions: {
      submission_summary: typeof suggestions.submission_summary === "string" ? suggestions.submission_summary : fallback.field_suggestions.submission_summary,
      requested_next_step: typeof suggestions.requested_next_step === "string" ? suggestions.requested_next_step : fallback.field_suggestions.requested_next_step,
      submit_uncertainties: typeof suggestions.submit_uncertainties === "string" ? suggestions.submit_uncertainties : fallback.field_suggestions.submit_uncertainties,
      buyer_demand_evidence: typeof suggestions.buyer_demand_evidence === "string" ? suggestions.buyer_demand_evidence : fallback.field_suggestions.buyer_demand_evidence,
      exit_strategy: typeof suggestions.exit_strategy === "string" ? suggestions.exit_strategy : fallback.field_suggestions.exit_strategy,
      target_buyer_type: typeof suggestions.target_buyer_type === "string" ? suggestions.target_buyer_type : fallback.field_suggestions.target_buyer_type,
      calculator_notes: typeof suggestions.calculator_notes === "string" ? suggestions.calculator_notes : fallback.field_suggestions.calculator_notes,
      build_analysis_notes: typeof suggestions.build_analysis_notes === "string" ? suggestions.build_analysis_notes : fallback.field_suggestions.build_analysis_notes,
    },
    source_notes: Array.isArray(row.source_notes) ? row.source_notes.map(String).filter(Boolean) : fallback.source_notes,
  };
}
