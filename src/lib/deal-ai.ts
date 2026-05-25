import { calculateBuildAnalysis } from "./build-underwriting";
import { calculateDealAnalysis, type DealInput } from "./deals";

export type DealAiRecommendation = "Strong Review" | "Review With Caution" | "Needs More Info" | "Likely Pass";
export type DealAiConfidence = "Low" | "Medium" | "High";
export type DealAiActionPriority = "low" | "medium" | "high" | "urgent";
export type DealAiGateStatus = "ready" | "needs-proof" | "blocked";
export type DealAiOfferDecision = "buy" | "negotiate" | "research-more" | "pass";

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

export interface DealAiAnalysisResult {
  recommendation: DealAiRecommendation;
  confidence: DealAiConfidence;
  decision_framework: DealAiDecisionFramework;
  offer_guidance: DealAiOfferGuidance;
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

function offerDecisionFromFramework(args: {
  recommendation: DealAiRecommendation;
  missing: string[];
  risks: string[];
  baseProfit: number | null;
  baseRoi: number | null;
}): DealAiOfferDecision {
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
): DealAiDecisionFramework {
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const hasIdentity = Boolean((deal.address || deal.parcel_id) && deal.acreage && deal.asking_price);
  const hasBuildability = Boolean(deal.zoning && deal.utilities) && !risks.some(risk => /flood|wetland|zoning|utilities|access|blocked/i.test(risk));
  const hasComps = !missingIncludes(missing, /comp|arv/i);
  const hasBudget = !missingIncludes(missing, /construction budget|build size|specs/i);
  const hasFinancing = !missingIncludes(missing, /financing/i);
  const hasExit = Boolean((deal.exit_strategy || deal.target_buyer_type) && (deal.target_resale_price || deal.arv || build.targetArv));
  const offerDecision = offerDecisionFromFramework({
    recommendation,
    missing,
    risks,
    baseProfit: build.baseNetProfit,
    baseRoi: build.baseRoi,
  });
  const readyForVote = missing.length === 0 && risks.length <= 1 && offerDecision !== "research-more";

  return {
    property_identity: gate(
      hasIdentity ? "ready" : "needs-proof",
      hasIdentity ? "Property identity is usable for underwriting." : "The record is not complete enough to treat as source-of-truth.",
      "Address or APN, acreage, asking price, county, and listing/source link.",
      hasIdentity ? "Keep this record as the decision packet anchor." : "Verify address/APN, acreage, and ask before pricing the deal.",
    ),
    buildability: gate(
      risks.some(risk => /blocked|flood|wetland|access|landlocked/i.test(risk)) ? "blocked" : hasBuildability ? "ready" : "needs-proof",
      hasBuildability ? "No major buildability gap is flagged by the packet." : "Buildability still needs source proof before offer authority.",
      "Zoning/setbacks, road access, utilities or septic/sewer path, flood/wetlands, topo, HOA/subdivision rules.",
      hasBuildability ? "Attach proof and keep monitoring permit/utility assumptions." : "Clear zoning, utility/access, and flood/wetland questions before calling it buyable.",
    ),
    sold_new_build_comps: gate(
      hasComps ? "ready" : "needs-proof",
      hasComps ? "The ARV gate has comp support in the packet." : "The deal should not be presented as a buy until sold new-build comps support ARV.",
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
): DealAiOfferGuidance {
  const analysis = calculateDealAnalysis(deal);
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const decision = offerDecisionFromFramework({
    recommendation,
    missing,
    risks,
    baseProfit: build.baseNetProfit,
    baseRoi: build.baseRoi,
  });
  const maxOffer = analysis.acquisition.maxOffer ?? analysis.maxAllowableOffer ?? null;
  const recommendedOffer = analysis.acquisition.recommendedOffer ?? maxOffer;
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
    rationale: decision === "buy"
      ? "Current framework gates support a buy recommendation if contingencies stay in place."
      : decision === "negotiate"
        ? "The deal may work only if price and terms stay under the underwriting ceiling."
        : decision === "pass"
          ? "The current risks or economics do not support a buy recommendation."
          : "The packet needs more proof before offer authority.",
  };
}

export function buildFallbackDealAiAnalysis(deal: DealInput, note?: string): DealAiAnalysisResult {
  const analysis = calculateDealAnalysis(deal);
  const build = calculateBuildAnalysis(deal.build_analysis, deal);
  const isLandBuild = deal.property_type === "land";
  const missing = unique([
    ...analysis.missingInfo,
    ...(isLandBuild ? build.missingInfo : []),
  ]);
  const risks = unique([
    ...analysis.riskFlags,
    ...(isLandBuild ? build.riskFlags : []),
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
  const decisionFramework = buildDecisionFramework(deal, recommendation, missing, risks);
  const offerGuidance = buildOfferGuidance(deal, recommendation, missing, risks);

  return {
    recommendation,
    confidence,
    decision_framework: decisionFramework,
    offer_guidance: offerGuidance,
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
      "Fallback analysis uses existing portal calculator outputs and does not pull external data.",
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
