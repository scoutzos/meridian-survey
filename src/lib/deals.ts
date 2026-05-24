import { supabase, supabasePrototypeAnon } from "./supabase";
import { normalizeBuildAnalysis, type BuildAnalysisInput } from "./build-underwriting";

export type DealPropertyType = "land" | "house" | "rental" | "commercial" | "other";
export type DealStatus = "lead" | "under-review" | "offer-made" | "under-contract" | "due-diligence" | "closed" | "active-project" | "stabilized" | "sold" | "passed";
export type DealStage = "intake" | "initial-screen" | "offer-approval" | "due-diligence-go-no-go" | "active-project-change" | "exit-execution" | "closeout";
export type DealUrgency = "routine" | "time-sensitive" | "hot";
export type DealReviewIntent = "needs-info-review" | "ready-for-vote" | "blocked-decision";
export type ChecklistStatus = "open" | "in-review" | "cleared" | "blocked" | "not-applicable";
export type DealVoteOption = "pass" | "needs-more-info" | "schedule-call" | "make-offer" | "counter" | "urgent-review";
export type DealAgreementStatus = "draft" | "ready-for-review" | "approved" | "signed" | "superseded";
export type DispositionStatus = "not-started" | "exit-strategy-set" | "buyer-list-built" | "marketed" | "buyer-interest" | "offer-received" | "buyer-under-contract" | "closing-scheduled" | "closed" | "fell-through";
export type DealBudgetStatus = "draft" | "review" | "approved" | "superseded" | "final-actuals";
export type DealDecisionType = "general" | "offer-approval" | "due-diligence-go-no-go" | "budget-change" | "capital-call" | "active-project-change" | "exit-decision" | "closeout-approval";
export type DealDecisionStatus = "draft" | "open" | "approved" | "rejected" | "revision-needed" | "closed" | "cancelled";
export type DealDecisionVoteChoice = "approve" | "request_changes" | "abstain" | "reject";
export type DealCommitmentType = "cash" | "credit" | "guarantee" | "member-loan" | "collateral" | "deal-specific-capital" | "other";
export type DealCommitmentConsentStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type DealExitMemoStatus = "draft" | "ready-for-review" | "approved" | "superseded";
export type DealCloseoutStatus = "draft" | "ready-for-review" | "final";

export const DEAL_STAGES: DealStage[] = [
  "intake",
  "initial-screen",
  "offer-approval",
  "due-diligence-go-no-go",
  "active-project-change",
  "exit-execution",
  "closeout",
];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  "intake": "Intake",
  "initial-screen": "Initial Screen",
  "offer-approval": "Offer Approval",
  "due-diligence-go-no-go": "Diligence Go/No-Go",
  "active-project-change": "Project Change",
  "exit-execution": "Exit Execution",
  "closeout": "Closeout",
};

export interface DealInput {
  title: string;
  source?: string | null;
  property_type: DealPropertyType;
  strategy: string;
  status?: DealStatus;
  deal_stage?: DealStage;
  urgency: DealUrgency;
  address?: string | null;
  parcel_id?: string | null;
  seller_name?: string | null;
  seller_phone?: string | null;
  asking_price?: number | null;
  arv?: number | null;
  repair_estimate?: number | null;
  acreage?: number | null;
  zoning?: string | null;
  road_frontage?: string | null;
  utilities?: string | null;
  notes?: string | null;
  links?: string[];
  submitted_by?: string | null;
  assigned_to?: string | null;
  next_follow_up_date?: string | null;
  lead_temperature?: "cold" | "warm" | "hot" | "dead" | null;
  campaign_source?: string | null;
  review_intent?: DealReviewIntent | null;
  submission_summary?: string | null;
  requested_next_step?: string | null;
  submit_uncertainties?: string | null;
  first_submitted_at?: string | null;
  last_submitted_at?: string | null;
  review_round?: number;
  last_review_notification_at?: string | null;
  disposition_status?: DispositionStatus | null;
  exit_strategy?: string | null;
  target_buyer_type?: string | null;
  target_resale_price?: number | null;
  minimum_acceptable_price?: number | null;
  best_buyer_offer?: number | null;
  buyer_demand_evidence?: string | null;
  disposition_owner?: string | null;
  disposition_next_step?: string | null;
  closing_costs_estimate?: number | null;
  holding_costs_estimate?: number | null;
  marketing_costs_estimate?: number | null;
  desired_minimum_spread?: number | null;
  risk_buffer?: number | null;
  calculator_notes?: string | null;
  build_analysis?: BuildAnalysisInput | null;
}

export interface Deal extends DealInput {
  id: string;
  status: DealStatus;
  deal_stage: DealStage;
  links: string[];
  analysis: DealAnalysis;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  stage_updated_at?: string | null;
  stage_updated_by?: string | null;
  deleted_at: string | null;
}

export interface DealMetric {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}

export interface DealAnalysis {
  recommendation: "Strong Review" | "Review With Caution" | "Needs More Info" | "Likely Pass";
  summary: string;
  metrics: DealMetric[];
  riskFlags: string[];
  missingInfo: string[];
  maxAllowableOffer: number | null;
  confidence: "Low" | "Medium" | "High";
  acquisition: {
    targetResale: number | null;
    totalCosts: number;
    desiredSpread: number;
    riskBuffer: number;
    recommendedOffer: number | null;
    maxOffer: number | null;
    projectedSpreadAtAsk: number | null;
  };
  disposition: {
    status: DispositionStatus | null;
    exitStrategy: string | null;
    targetBuyerType: string | null;
    targetResale: number | null;
    minimumAcceptable: number | null;
    bestBuyerOffer: number | null;
    projectedNetAtTarget: number | null;
    projectedNetAtBestOffer: number | null;
    exitConfidence: "Low" | "Medium" | "High";
  };
}

export interface DealDueDiligenceItem {
  id: string;
  deal_id: string;
  title: string;
  why_it_matters: string | null;
  required_evidence: string | null;
  status: ChecklistStatus;
  owner: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface DealVote {
  id: string;
  deal_id: string;
  member_name: string;
  vote: DealVoteOption;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  actor: string | null;
  activity_type: "created" | "updated" | "status-change" | "checklist-update" | "submitted-review" | "attachment-added" | "note";
  summary: string;
  field_changes: Record<string, unknown>;
  created_at: string;
}

export type DealAttachmentType = "link" | "photo" | "document" | "map" | "county-record" | "comp" | "other";

export interface DealAttachment {
  id: string;
  deal_id: string;
  title: string;
  attachment_type: DealAttachmentType;
  url: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export interface DealAgreementInput {
  deal_id: string;
  status: DealAgreementStatus;
  offer_authority?: number | null;
  earnest_money?: number | null;
  diligence_budget?: number | null;
  capital_needed?: number | null;
  capital_commitments?: string | null;
  credit_guarantees?: string | null;
  member_roles?: string | null;
  economics?: string | null;
  overrun_rule?: string | null;
  exit_plan?: string | null;
  approval_threshold?: string | null;
  go_no_go_deadline?: string | null;
  notes?: string | null;
}

export interface DealAgreement extends DealAgreementInput {
  id: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface DealBudgetLineInput {
  category: string;
  description: string;
  estimated_amount?: number | null;
  approved_amount?: number | null;
  actual_amount?: number | null;
  source_of_funds?: string | null;
  vendor?: string | null;
  notes?: string | null;
  sort_order?: number;
}

export interface DealBudgetLine extends DealBudgetLineInput {
  id: string;
  budget_version_id: string;
  estimated_amount: number;
  approved_amount: number;
  actual_amount: number;
  sort_order: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface DealBudgetVersionInput {
  deal_id: string;
  version_number?: number;
  stage: DealStage;
  label: string;
  status?: DealBudgetStatus;
  change_summary?: string | null;
  source_of_funds?: string | null;
  material_variance_threshold_amount?: number | null;
  material_variance_threshold_percent?: number | null;
  vote_required?: boolean;
}

export interface DealBudgetVersion extends DealBudgetVersionInput {
  id: string;
  version_number: number;
  status: DealBudgetStatus;
  total_budget: number;
  total_actual: number;
  variance_amount: number;
  variance_percent: number | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface DealDecisionInput {
  deal_id: string;
  decision_type: DealDecisionType;
  stage: DealStage;
  status?: DealDecisionStatus;
  decision_requested: string;
  affected_matter: string;
  dollar_impact?: number | null;
  source_of_funds?: string | null;
  approval_threshold?: string | null;
  required_approvals?: number | null;
  response_deadline?: string | null;
  non_response_consequence?: string | null;
  personal_risk_summary?: string | null;
  related_budget_version_id?: string | null;
  supporting_documents?: string[];
}

export interface DealDecision extends DealDecisionInput {
  id: string;
  status: DealDecisionStatus;
  approval_threshold: string;
  required_approvals: number;
  non_response_consequence: string;
  supporting_documents: string[];
  opened_at: string | null;
  decided_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface DealDecisionVote {
  id: string;
  decision_id: string;
  member_name: string;
  vote: DealDecisionVoteChoice;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealMemberCommitmentInput {
  deal_id: string;
  member_name: string;
  commitment_type: DealCommitmentType;
  amount?: number | null;
  description?: string | null;
  source_of_funds?: string | null;
  decision_id?: string | null;
  budget_version_id?: string | null;
  consent_status?: DealCommitmentConsentStatus;
  consent_note?: string | null;
}

export interface DealMemberCommitment extends DealMemberCommitmentInput {
  id: string;
  consent_status: DealCommitmentConsentStatus;
  consented_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface DealExitMemoInput {
  deal_id: string;
  decision_id?: string | null;
  status?: DealExitMemoStatus;
  recommended_exit: string;
  current_budget_to_actual?: string | null;
  debt_payoff?: number | null;
  closing_costs?: number | null;
  expected_net_proceeds?: number | null;
  return_of_capital?: number | null;
  preferred_return_or_guarantee_premium?: number | null;
  reserves_to_hold_back?: number | null;
  estimated_member_distributions?: string | null;
  risks?: string | null;
  alternatives_considered?: string | null;
  supporting_documents?: string[];
}

export interface DealExitMemo extends DealExitMemoInput {
  id: string;
  status: DealExitMemoStatus;
  supporting_documents: string[];
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export interface DealCloseoutPacketInput {
  deal_id: string;
  exit_memo_id?: string | null;
  status?: DealCloseoutStatus;
  settlement_statement_url?: string | null;
  refinance_statement_url?: string | null;
  final_budget_variance?: string | null;
  final_profit_loss?: number | null;
  capital_return?: string | null;
  distribution_calculation?: string | null;
  lessons_learned?: string | null;
  tax_followups?: string | null;
}

export interface DealCloseoutPacket extends DealCloseoutPacketInput {
  id: string;
  status: DealCloseoutStatus;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

const LOCAL_DEALS = "meridian_deals_local";
const LOCAL_CHECKLIST = "meridian_deal_checklist_local";
const LOCAL_VOTES = "meridian_deal_votes_local";
const LOCAL_AGREEMENTS = "meridian_deal_agreements_local";
const LOCAL_ACTIVITY = "meridian_deal_activity_local";
const LOCAL_ATTACHMENTS = "meridian_deal_attachments_local";
const LOCAL_BUDGET_VERSIONS = "meridian_deal_budget_versions_local";
const LOCAL_BUDGET_LINES = "meridian_deal_budget_lines_local";
const LOCAL_DECISIONS = "meridian_deal_decisions_local";
const LOCAL_DECISION_VOTES = "meridian_deal_decision_votes_local";
const LOCAL_COMMITMENTS = "meridian_deal_member_commitments_local";
const LOCAL_EXIT_MEMOS = "meridian_deal_exit_memos_local";
const LOCAL_CLOSEOUT_PACKETS = "meridian_deal_closeout_packets_local";

function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const parsed = Number(v.replace(/[$,]/g, ""));
  return isFinite(parsed) ? parsed : null;
}

export function calculateDealAnalysis(input: DealInput): DealAnalysis {
  const asking = num(input.asking_price);
  const targetResale = num(input.target_resale_price) ?? num(input.arv);
  const arv = targetResale;
  const repairs = num(input.repair_estimate) ?? 0;
  const closingCosts = num(input.closing_costs_estimate) ?? 0;
  const holdingCosts = num(input.holding_costs_estimate) ?? 0;
  const marketingCosts = num(input.marketing_costs_estimate) ?? 0;
  const totalCosts = repairs + closingCosts + holdingCosts + marketingCosts;
  const desiredSpread = num(input.desired_minimum_spread) ?? (input.property_type === "land" ? 15_000 : 20_000);
  const riskBuffer = num(input.risk_buffer) ?? (targetResale ? targetResale * 0.05 : 0);
  const bestBuyerOffer = num(input.best_buyer_offer);
  const minimumAcceptable = num(input.minimum_acceptable_price) ?? (targetResale ? targetResale - riskBuffer : null);
  const acreage = num(input.acreage);
  const isLand = input.property_type === "land";
  const riskFlags: string[] = [];
  const missingInfo: string[] = [];
  const metrics: DealMetric[] = [];
  let maxAllowableOffer: number | null = null;
  let recommendation: DealAnalysis["recommendation"] = "Needs More Info";

  if (!asking) missingInfo.push("Seller asking price");
  if (!input.address && !input.parcel_id) missingInfo.push("Address or parcel ID");
  if (!input.exit_strategy?.trim()) missingInfo.push("Disposition exit strategy");
  if (!input.target_buyer_type?.trim()) missingInfo.push("Target buyer type");
  if (!targetResale) missingInfo.push("Target resale / buyer price");
  if (!input.buyer_demand_evidence?.trim()) riskFlags.push("Buyer demand evidence is not documented yet.");

  if (isLand) {
    if (!acreage) missingInfo.push("Acreage or lot dimensions");
    if (!input.zoning?.trim()) missingInfo.push("Zoning");
    if (!input.utilities?.trim()) missingInfo.push("Utility path");
    if (!input.road_frontage?.trim()) missingInfo.push("Road frontage/access");
    if (!arv) missingInfo.push("Estimated resale, builder, or finished-lot value");

    const pricePerAcre = asking && acreage ? asking / acreage : null;
    maxAllowableOffer = arv ? Math.max(0, arv - totalCosts - desiredSpread - riskBuffer) : null;
    const spread = asking && maxAllowableOffer ? maxAllowableOffer - asking : null;
    const projectedSpreadAtAsk = asking && arv ? arv - asking - totalCosts : null;

    metrics.push(
      { label: "Asking price", value: money(asking) },
      { label: "Acres", value: acreage ? String(acreage) : "—" },
      { label: "Price / acre", value: money(pricePerAcre) },
      { label: "Est. exit value", value: money(arv) },
      { label: "Total costs", value: money(totalCosts) },
      { label: "Target spread", value: money(desiredSpread) },
      { label: "Land MAO", value: money(maxAllowableOffer), tone: maxAllowableOffer && asking && maxAllowableOffer >= asking ? "good" : "warn" },
      { label: "Spread @ ask", value: money(projectedSpreadAtAsk), tone: projectedSpreadAtAsk !== null && projectedSpreadAtAsk >= desiredSpread ? "good" : "warn" },
    );

    if (!input.utilities?.trim()) riskFlags.push("Utility availability is not confirmed.");
    if (!input.zoning?.trim()) riskFlags.push("Zoning/buildability is not confirmed.");
    if (!input.road_frontage?.trim()) riskFlags.push("Legal and physical access need confirmation.");

    if (asking && maxAllowableOffer && spread !== null && spread >= Math.max(10_000, asking * 0.15)) recommendation = "Strong Review";
    else if (asking && maxAllowableOffer && spread !== null && spread >= 0) recommendation = "Review With Caution";
    else if (asking && maxAllowableOffer && spread !== null && spread < 0) recommendation = "Likely Pass";
  } else {
    if (!arv) missingInfo.push("ARV or stabilized value");
    if (!input.repair_estimate && input.property_type !== "rental") missingInfo.push("Repair estimate");

    maxAllowableOffer = arv ? Math.min(arv * 0.7 - repairs, arv - totalCosts - desiredSpread - riskBuffer) : null;
    const spread = asking && maxAllowableOffer ? maxAllowableOffer - asking : null;
    const projectedSpreadAtAsk = asking && arv ? arv - asking - totalCosts : null;
    const margin = arv && asking ? ((arv - asking - totalCosts) / arv) * 100 : null;

    metrics.push(
      { label: "Asking price", value: money(asking) },
      { label: "ARV/value", value: money(arv) },
      { label: "Repairs", value: money(repairs) },
      { label: "Total costs", value: money(totalCosts) },
      { label: "Target spread", value: money(desiredSpread) },
      { label: "MAO", value: money(maxAllowableOffer), tone: maxAllowableOffer && asking && maxAllowableOffer >= asking ? "good" : "warn" },
      { label: "Gross margin", value: margin === null ? "—" : pct(margin), tone: margin !== null && margin >= 20 ? "good" : "warn" },
      { label: "Spread @ ask", value: money(projectedSpreadAtAsk), tone: projectedSpreadAtAsk !== null && projectedSpreadAtAsk >= desiredSpread ? "good" : "warn" },
    );

    if (repairs > 0 && arv && repairs / arv > 0.35) riskFlags.push("Repair estimate is high relative to value.");
    if (asking && maxAllowableOffer && asking > maxAllowableOffer) riskFlags.push("Asking price is above rule-of-thumb MAO.");

    if (asking && maxAllowableOffer && spread !== null && spread >= Math.max(15_000, asking * 0.15)) recommendation = "Strong Review";
    else if (asking && maxAllowableOffer && spread !== null && spread >= 0) recommendation = "Review With Caution";
    else if (asking && maxAllowableOffer && spread !== null && spread < 0) recommendation = "Likely Pass";
  }

  const known = [asking, arv, input.address || input.parcel_id, input.source, input.notes].filter(Boolean).length;
  const exitKnown = [input.exit_strategy, input.target_buyer_type, input.buyer_demand_evidence, minimumAcceptable || bestBuyerOffer].filter(Boolean).length;
  const confidence: DealAnalysis["confidence"] = missingInfo.length <= 1 && known >= 4 && exitKnown >= 3 ? "High" : missingInfo.length <= 4 ? "Medium" : "Low";
  const exitConfidence: DealAnalysis["disposition"]["exitConfidence"] = exitKnown >= 4 ? "High" : exitKnown >= 2 ? "Medium" : "Low";
  if (missingInfo.length >= 4 && recommendation === "Strong Review") recommendation = "Review With Caution";

  const summary = isLand
    ? `${recommendation}: buy decision depends on buildability plus disposition confidence. Verify access, utilities, comps, buyer demand, and spread before making a firm offer.`
    : `${recommendation}: pricing should be validated against ARV, repair scope, holding costs, buyer demand, and exit strategy before the group approves an offer.`;

  return {
    recommendation,
    summary,
    metrics,
    riskFlags,
    missingInfo,
    maxAllowableOffer,
    confidence,
    acquisition: {
      targetResale: arv,
      totalCosts,
      desiredSpread,
      riskBuffer,
      recommendedOffer: maxAllowableOffer ? Math.max(0, maxAllowableOffer - riskBuffer) : null,
      maxOffer: maxAllowableOffer,
      projectedSpreadAtAsk: asking && arv ? arv - asking - totalCosts : null,
    },
    disposition: {
      status: input.disposition_status ?? null,
      exitStrategy: input.exit_strategy?.trim() || null,
      targetBuyerType: input.target_buyer_type?.trim() || null,
      targetResale: arv,
      minimumAcceptable,
      bestBuyerOffer,
      projectedNetAtTarget: asking && arv ? arv - asking - totalCosts : null,
      projectedNetAtBestOffer: asking && bestBuyerOffer ? bestBuyerOffer - asking - totalCosts : null,
      exitConfidence,
    },
  };
}

type ChecklistSeed = Omit<DealDueDiligenceItem, "id" | "deal_id" | "created_at" | "updated_at" | "updated_by">;

function item(sort: number, title: string, why: string, evidence: string): ChecklistSeed {
  return { title, why_it_matters: why, required_evidence: evidence, status: "open", owner: null, due_date: null, sort_order: sort };
}

export function generateDueDiligenceChecklist(input: DealInput): ChecklistSeed[] {
  const base = [
    item(10, "Confirm seller ownership", "The group should know the seller has authority to negotiate.", "County owner record, deed, or title search note."),
    item(20, "Check liens, taxes, and code issues", "Hidden obligations can erase margin or block closing.", "Tax record, lien search, code search, or attorney/title note."),
    item(30, "Validate market comps", "The decision should be based on current support, not hope.", "At least 3 relevant comps with source links."),
    item(40, "Confirm exit strategy", "Offer price depends on whether this is a hold, resale, build, or assignment.", "Written strategy note with target buyer or hold assumptions."),
  ];

  if (input.property_type === "land") {
    return [
      ...base,
      item(50, "Verify zoning and future land use", "Land value depends on what can legally be built or done.", "Zoning record and future land-use screenshot/link."),
      item(60, "Confirm legal and physical access", "No access can make a parcel difficult or impossible to monetize.", "Plat, GIS map, road frontage confirmation, easement record if needed."),
      item(70, "Verify utilities or septic/sewer path", "Utility uncertainty can change the entire offer price.", "Water/sewer availability, power proximity, septic/perc requirements."),
      item(80, "Check floodplain, wetlands, buffers, and slope", "Environmental or topography constraints reduce buildable land.", "FEMA/GIS/wetlands/topography screenshots or notes."),
      item(90, "Estimate buildable envelope", "Acreage is not the same as usable land.", "Setback/minimum-lot-size analysis or planning department note."),
      item(100, "Calculate price per buildable lot", "Members need to see value per usable outcome.", "Buildable-lot count, comp support, and calculated price per lot."),
      item(110, "Estimate entitlement and site-prep costs", "Clearing, grading, plats, variances, or utility taps can be material.", "Rough cost estimate or vendor/planning note."),
    ];
  }

  return [
    ...base,
    item(50, "Confirm occupancy status", "Occupancy affects access, timing, cash-for-keys, and legal risk.", "Seller statement, photo, showing note, or occupancy verification."),
    item(60, "Inspect property condition", "Repair scope drives MAO and risk.", "Photo set, walkthrough notes, or inspection report."),
    item(70, "Validate repair estimate", "A weak repair estimate creates false margin.", "Contractor range, scope sheet, or comparable rehab budget."),
    item(80, "Check permit and utility history", "Open permits or inactive utilities can create delay and cost.", "Permit search and utility status note."),
    item(90, "Calculate holding and closing costs", "The group needs full cash exposure before voting.", "Cost worksheet with taxes, insurance, closing, lender, and holding assumptions."),
  ];
}

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

function localSet<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function isDealStage(value: unknown): value is DealStage {
  return typeof value === "string" && DEAL_STAGES.includes(value as DealStage);
}

function stageFromStatus(status: unknown): DealStage {
  switch (status) {
    case "lead":
      return "intake";
    case "under-review":
      return "initial-screen";
    case "offer-made":
      return "offer-approval";
    case "under-contract":
    case "due-diligence":
      return "due-diligence-go-no-go";
    case "active-project":
    case "stabilized":
      return "active-project-change";
    case "sold":
      return "exit-execution";
    case "closed":
    case "passed":
      return "closeout";
    default:
      return "intake";
  }
}

function normalizeDocuments(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
    } catch {
      return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function cleanDocumentList(value: string[] | undefined): string[] {
  return (value ?? []).map(item => item.trim()).filter(Boolean);
}

function cleanBudgetLine(input: DealBudgetLineInput, sortOrder: number): DealBudgetLineInput {
  return {
    category: input.category.trim(),
    description: input.description.trim(),
    estimated_amount: num(input.estimated_amount) ?? 0,
    approved_amount: num(input.approved_amount) ?? num(input.estimated_amount) ?? 0,
    actual_amount: num(input.actual_amount) ?? 0,
    source_of_funds: input.source_of_funds?.trim() || null,
    vendor: input.vendor?.trim() || null,
    notes: input.notes?.trim() || null,
    sort_order: input.sort_order ?? sortOrder,
  };
}

function budgetTotals(lines: DealBudgetLineInput[]) {
  const totalBudget = lines.reduce((sum, line) => sum + (num(line.approved_amount) ?? num(line.estimated_amount) ?? 0), 0);
  const totalActual = lines.reduce((sum, line) => sum + (num(line.actual_amount) ?? 0), 0);
  const variance = totalActual - totalBudget;
  return {
    total_budget: totalBudget,
    total_actual: totalActual,
    variance_amount: variance,
    variance_percent: totalBudget ? variance / totalBudget : null,
  };
}

function normalizeBudgetVersion(row: Record<string, unknown>): DealBudgetVersion {
  return {
    ...(row as unknown as DealBudgetVersion),
    stage: isDealStage(row.stage) ? row.stage : "initial-screen",
    status: typeof row.status === "string" ? row.status as DealBudgetStatus : "draft",
    version_number: num(row.version_number) ?? 1,
    total_budget: num(row.total_budget) ?? 0,
    total_actual: num(row.total_actual) ?? 0,
    variance_amount: num(row.variance_amount) ?? 0,
    variance_percent: num(row.variance_percent),
    material_variance_threshold_amount: num(row.material_variance_threshold_amount),
    material_variance_threshold_percent: num(row.material_variance_threshold_percent),
    vote_required: Boolean(row.vote_required),
  };
}

function normalizeBudgetLine(row: Record<string, unknown>): DealBudgetLine {
  return {
    ...(row as unknown as DealBudgetLine),
    estimated_amount: num(row.estimated_amount) ?? 0,
    approved_amount: num(row.approved_amount) ?? 0,
    actual_amount: num(row.actual_amount) ?? 0,
    sort_order: num(row.sort_order) ?? 0,
  };
}

function normalizeDealDecision(row: Record<string, unknown>): DealDecision {
  return {
    ...(row as unknown as DealDecision),
    stage: isDealStage(row.stage) ? row.stage : "initial-screen",
    status: typeof row.status === "string" ? row.status as DealDecisionStatus : "draft",
    dollar_impact: num(row.dollar_impact),
    required_approvals: num(row.required_approvals) ?? 3,
    approval_threshold: typeof row.approval_threshold === "string" && row.approval_threshold.trim() ? row.approval_threshold : "Tier 3 Majority approval",
    non_response_consequence: typeof row.non_response_consequence === "string" && row.non_response_consequence.trim()
      ? row.non_response_consequence
      : "Non-response counts as abstention, not approval.",
    supporting_documents: normalizeDocuments(row.supporting_documents),
  };
}

function normalizeCommitment(row: Record<string, unknown>): DealMemberCommitment {
  return {
    ...(row as unknown as DealMemberCommitment),
    amount: num(row.amount),
    consent_status: typeof row.consent_status === "string" ? row.consent_status as DealCommitmentConsentStatus : "pending",
  };
}

function normalizeExitMemo(row: Record<string, unknown>): DealExitMemo {
  return {
    ...(row as unknown as DealExitMemo),
    status: typeof row.status === "string" ? row.status as DealExitMemoStatus : "draft",
    debt_payoff: num(row.debt_payoff),
    closing_costs: num(row.closing_costs),
    expected_net_proceeds: num(row.expected_net_proceeds),
    return_of_capital: num(row.return_of_capital),
    preferred_return_or_guarantee_premium: num(row.preferred_return_or_guarantee_premium),
    reserves_to_hold_back: num(row.reserves_to_hold_back),
    supporting_documents: normalizeDocuments(row.supporting_documents),
  };
}

function normalizeCloseoutPacket(row: Record<string, unknown>): DealCloseoutPacket {
  return {
    ...(row as unknown as DealCloseoutPacket),
    status: typeof row.status === "string" ? row.status as DealCloseoutStatus : "draft",
    final_profit_loss: num(row.final_profit_loss),
  };
}

function normalizeDeal(row: Record<string, unknown>): Deal {
  const status = typeof row.status === "string" ? row.status as DealStatus : "under-review";
  const dealStage = isDealStage(row.deal_stage) ? row.deal_stage : stageFromStatus(status);
  return {
    ...(row as unknown as Deal),
    status,
    deal_stage: dealStage,
    links: Array.isArray(row.links) ? row.links as string[] : [],
    build_analysis: normalizeBuildAnalysis(row.build_analysis, row as unknown as DealInput),
    analysis: calculateDealAnalysis({ ...(row as unknown as DealInput), status, deal_stage: dealStage }),
  };
}

function cleanDealInput(input: DealInput): DealInput {
  const status = input.status ?? "under-review";
  return {
    ...input,
    status,
    deal_stage: input.deal_stage ?? stageFromStatus(status),
    source: input.source?.trim() || null,
    strategy: input.strategy.trim() || "review",
    address: input.address?.trim() || null,
    parcel_id: input.parcel_id?.trim() || null,
    seller_name: input.seller_name?.trim() || null,
    seller_phone: input.seller_phone?.trim() || null,
    zoning: input.zoning?.trim() || null,
    road_frontage: input.road_frontage?.trim() || null,
    utilities: input.utilities?.trim() || null,
    notes: input.notes?.trim() || null,
    submitted_by: input.submitted_by?.trim() || null,
    assigned_to: input.assigned_to?.trim() || null,
    next_follow_up_date: input.next_follow_up_date || null,
    lead_temperature: input.lead_temperature || null,
    campaign_source: input.campaign_source?.trim() || null,
    review_intent: input.review_intent || null,
    submission_summary: input.submission_summary?.trim() || null,
    requested_next_step: input.requested_next_step?.trim() || null,
    submit_uncertainties: input.submit_uncertainties?.trim() || null,
    first_submitted_at: input.first_submitted_at || null,
    last_submitted_at: input.last_submitted_at || null,
    review_round: input.review_round ?? 0,
    last_review_notification_at: input.last_review_notification_at || null,
    disposition_status: input.disposition_status || "not-started",
    exit_strategy: input.exit_strategy?.trim() || null,
    target_buyer_type: input.target_buyer_type?.trim() || null,
    target_resale_price: num(input.target_resale_price),
    minimum_acceptable_price: num(input.minimum_acceptable_price),
    best_buyer_offer: num(input.best_buyer_offer),
    buyer_demand_evidence: input.buyer_demand_evidence?.trim() || null,
    disposition_owner: input.disposition_owner?.trim() || null,
    disposition_next_step: input.disposition_next_step?.trim() || null,
    closing_costs_estimate: num(input.closing_costs_estimate),
    holding_costs_estimate: num(input.holding_costs_estimate),
    marketing_costs_estimate: num(input.marketing_costs_estimate),
    desired_minimum_spread: num(input.desired_minimum_spread),
    risk_buffer: num(input.risk_buffer),
    calculator_notes: input.calculator_notes?.trim() || null,
    build_analysis: normalizeBuildAnalysis(input.build_analysis, input),
  };
}

async function findSellerContactId(name: string | null | undefined, phone: string | null | undefined): Promise<string | null> {
  if (!supabase) return null;
  const cleanName = name?.trim() || null;
  const cleanPhone = phone?.trim() || null;
  if (cleanPhone) {
    const [primary, secondary] = await Promise.all([
      supabase.from("meridian_crm_contacts").select("id").eq("phone", cleanPhone).is("deleted_at", null).limit(1).maybeSingle(),
      supabase.from("meridian_crm_contacts").select("id").eq("phone_2", cleanPhone).is("deleted_at", null).limit(1).maybeSingle(),
    ]);
    if (primary.data?.id) return primary.data.id as string;
    if (secondary.data?.id) return secondary.data.id as string;
  }
  if (cleanName) {
    const { data } = await supabase
      .from("meridian_crm_contacts")
      .select("id")
      .ilike("display_name", cleanName)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

async function syncDealSellerContact(deal: Deal, actor: string): Promise<void> {
  if (!supabase || (!deal.seller_name && !deal.seller_phone)) return;
  try {
    let contactId = await findSellerContactId(deal.seller_name, deal.seller_phone);
    if (!contactId) {
      const { data } = await supabase
        .from("meridian_crm_contacts")
        .insert({
          contact_type: "seller",
          display_name: deal.seller_name || deal.seller_phone || "Unknown seller",
          phone: deal.seller_phone || null,
          tags: ["auto-linked", "deal-seller"],
          source_system: "deal-sync",
          created_by: actor,
          updated_by: actor,
        })
        .select("id")
        .single();
      contactId = data?.id as string | null;
    }
    if (!contactId) return;

    const existing = await supabase
      .from("meridian_opportunity_contacts")
      .select("id")
      .eq("deal_id", deal.id)
      .eq("contact_id", contactId)
      .eq("role", "seller")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    const link = {
      deal_id: deal.id,
      contact_id: contactId,
      role: "seller",
      is_primary: true,
      source_system: "deal-sync",
      source_table: "meridian_deals",
      source_id: deal.id,
      updated_by: actor,
    };
    if (existing.data?.id) {
      await supabase.from("meridian_opportunity_contacts").update({ ...link, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
    } else {
      await supabase.from("meridian_opportunity_contacts").insert({ ...link, created_by: actor });
    }
  } catch {
    // CRM linking should never block saving the opportunity packet.
  }
}

function diffDeal(before: Deal | null, after: DealInput): Record<string, { before: unknown; after: unknown }> {
  if (!before) return {};
  const keys: Array<keyof DealInput> = [
    "title", "source", "property_type", "strategy", "status", "deal_stage", "urgency", "address", "parcel_id",
    "seller_name", "seller_phone", "asking_price", "arv", "repair_estimate", "acreage", "zoning",
    "road_frontage", "utilities", "notes", "submitted_by", "assigned_to", "next_follow_up_date",
    "lead_temperature", "campaign_source", "review_intent", "submission_summary", "requested_next_step",
    "submit_uncertainties", "first_submitted_at", "last_submitted_at", "review_round", "last_review_notification_at",
    "disposition_status", "exit_strategy", "target_buyer_type", "target_resale_price", "minimum_acceptable_price",
    "best_buyer_offer", "buyer_demand_evidence", "disposition_owner", "disposition_next_step", "closing_costs_estimate",
    "holding_costs_estimate", "marketing_costs_estimate", "desired_minimum_spread", "risk_buffer", "calculator_notes",
    "build_analysis",
  ];
  return keys.reduce<Record<string, { before: unknown; after: unknown }>>((acc, key) => {
    const left = before[key] ?? null;
    const right = after[key] ?? null;
    if (JSON.stringify(left) !== JSON.stringify(right)) acc[key] = { before: left, after: right };
    return acc;
  }, {});
}

export async function createDealActivity(
  patch: { deal_id: string; actor: string; activity_type: DealActivity["activity_type"]; summary: string; field_changes?: Record<string, unknown> },
): Promise<{ error: string | null }> {
  const row = { ...patch, field_changes: patch.field_changes ?? {} };
  if (!supabase) {
    const now = new Date().toISOString();
    const activity: DealActivity = { id: `activity-${Date.now()}`, created_at: now, ...row };
    localSet(LOCAL_ACTIVITY, [activity, ...localGet<DealActivity[]>(LOCAL_ACTIVITY, [])]);
    return { error: null };
  }
  const { error } = await supabase.from("meridian_deal_activity").insert(row);
  if (error?.message?.includes("row-level security") && supabasePrototypeAnon) {
    const fallback = await supabasePrototypeAnon.from("meridian_deal_activity").insert(row);
    return { error: fallback.error?.message ?? null };
  }
  return { error: error?.message ?? null };
}

export async function fetchDealActivity(dealId: string): Promise<DealActivity[]> {
  if (!supabase) return localGet<DealActivity[]>(LOCAL_ACTIVITY, []).filter(a => a.deal_id === dealId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase
    .from("meridian_deal_activity")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as DealActivity[];
}

export async function fetchDealAttachments(dealId: string): Promise<DealAttachment[]> {
  if (!supabase) return localGet<DealAttachment[]>(LOCAL_ATTACHMENTS, []).filter(a => a.deal_id === dealId && !a.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase
    .from("meridian_deal_attachments")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as DealAttachment[];
}

export async function createDealAttachment(
  patch: { deal_id: string; title: string; attachment_type: DealAttachmentType; url: string; notes?: string | null },
  actor: string,
): Promise<{ data: DealAttachment | null; error: string | null }> {
  const row = {
    deal_id: patch.deal_id,
    title: patch.title.trim(),
    attachment_type: patch.attachment_type,
    url: patch.url.trim(),
    notes: patch.notes?.trim() || null,
    created_by: actor,
  };
  if (!row.title || !row.url) return { data: null, error: "Attachment title and URL are required." };
  if (!supabase) {
    const now = new Date().toISOString();
    const attachment: DealAttachment = { ...row, id: `attachment-${Date.now()}`, created_at: now, deleted_at: null };
    localSet(LOCAL_ATTACHMENTS, [attachment, ...localGet<DealAttachment[]>(LOCAL_ATTACHMENTS, [])]);
    await createDealActivity({ deal_id: patch.deal_id, actor, activity_type: "attachment-added", summary: `Added attachment: ${row.title}`, field_changes: row });
    return { data: attachment, error: null };
  }
  const { data, error } = await supabase.from("meridian_deal_attachments").insert(row).select().single();
  if (!error) await createDealActivity({ deal_id: patch.deal_id, actor, activity_type: "attachment-added", summary: `Added attachment: ${row.title}`, field_changes: row });
  return { data: (data as DealAttachment) ?? null, error: error?.message ?? null };
}

export async function fetchDeals(): Promise<Deal[]> {
  if (!supabase) return localGet<Deal[]>(LOCAL_DEALS, []);
  const { data, error } = await supabase
    .from("meridian_deals")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeDeal);
}

export async function fetchDealChecklist(dealId: string): Promise<DealDueDiligenceItem[]> {
  if (!supabase) return localGet<DealDueDiligenceItem[]>(LOCAL_CHECKLIST, []).filter(i => i.deal_id === dealId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await supabase
    .from("meridian_deal_due_diligence_items")
    .select("*")
    .eq("deal_id", dealId)
    .order("sort_order");
  if (error || !data) return [];
  return data as DealDueDiligenceItem[];
}

export async function fetchDealVotes(dealId: string): Promise<DealVote[]> {
  if (!supabase) return localGet<DealVote[]>(LOCAL_VOTES, []).filter(v => v.deal_id === dealId);
  const { data, error } = await supabase
    .from("meridian_deal_votes")
    .select("*")
    .eq("deal_id", dealId)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as DealVote[];
}

export async function fetchDealAgreement(dealId: string): Promise<DealAgreement | null> {
  if (!supabase) return localGet<DealAgreement[]>(LOCAL_AGREEMENTS, []).find(a => a.deal_id === dealId) ?? null;
  const { data, error } = await supabase
    .from("meridian_deal_agreements")
    .select("*")
    .eq("deal_id", dealId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as DealAgreement;
}

export async function createDeal(input: DealInput, actor: string): Promise<{ data: Deal | null; error: string | null }> {
  const clean = cleanDealInput({ ...input, submitted_by: input.submitted_by ?? actor, assigned_to: input.assigned_to ?? actor });
  const analysis = calculateDealAnalysis(clean);
  const links = (input.links ?? []).map(l => l.trim()).filter(Boolean);
  if (!supabase) {
    const now = new Date().toISOString();
    const deal: Deal = {
      ...clean,
      id: `local-${Date.now()}`,
      status: input.status ?? "under-review",
      deal_stage: clean.deal_stage ?? stageFromStatus(input.status ?? "under-review"),
      links,
      analysis,
      created_at: now,
      created_by: actor,
      updated_at: now,
      updated_by: actor,
      stage_updated_at: now,
      stage_updated_by: actor,
      deleted_at: null,
    };
    localSet(LOCAL_DEALS, [deal, ...localGet<Deal[]>(LOCAL_DEALS, [])]);
    const checklist = generateDueDiligenceChecklist(input).map((seed, idx): DealDueDiligenceItem => ({
      ...seed,
      id: `${deal.id}-${idx}`,
      deal_id: deal.id,
      created_at: now,
      updated_at: now,
      updated_by: actor,
    }));
    localSet(LOCAL_CHECKLIST, [...localGet<DealDueDiligenceItem[]>(LOCAL_CHECKLIST, []), ...checklist]);
    await createDealActivity({ deal_id: deal.id, actor, activity_type: "created", summary: "Created deal intake packet.", field_changes: clean as unknown as Record<string, unknown> });
    return { data: deal, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_deals")
    .insert({ ...clean, links, analysis, status: clean.status ?? "under-review", stage_updated_at: new Date().toISOString(), stage_updated_by: actor, created_by: actor, updated_by: actor })
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? "Deal create failed" };

  const deal = normalizeDeal(data as Record<string, unknown>);
  const checklist = generateDueDiligenceChecklist(input).map(seed => ({ ...seed, deal_id: deal.id }));
  const { error: checklistError } = await supabase.from("meridian_deal_due_diligence_items").insert(checklist);
  await createDealActivity({ deal_id: deal.id, actor, activity_type: "created", summary: "Created deal intake packet.", field_changes: clean as unknown as Record<string, unknown> });
  await syncDealSellerContact(deal, actor);
  return { data: deal, error: checklistError?.message ?? null };
}

export async function updateDeal(
  id: string,
  input: DealInput,
  actor: string,
): Promise<{ data: Deal | null; error: string | null }> {
  const current = (await fetchDeals()).find(deal => deal.id === id) ?? null;
  const clean = cleanDealInput(input);
  const analysis = calculateDealAnalysis(clean);
  const links = (input.links ?? []).map(l => l.trim()).filter(Boolean);
  const stageChanged = current?.deal_stage !== clean.deal_stage;
  const row = {
    ...clean,
    links,
    analysis,
    ...(stageChanged ? { stage_updated_at: new Date().toISOString(), stage_updated_by: actor } : {}),
    updated_at: new Date().toISOString(),
    updated_by: actor,
  };

  if (!supabase) {
    const rows = localGet<Deal[]>(LOCAL_DEALS, []);
    const next = rows.map(deal => deal.id === id ? normalizeDeal({ ...deal, ...row }) : deal);
    localSet(LOCAL_DEALS, next);
    await createDealActivity({ deal_id: id, actor, activity_type: current?.status !== clean.status || stageChanged ? "status-change" : "updated", summary: stageChanged ? `Deal stage changed to ${DEAL_STAGE_LABELS[clean.deal_stage ?? "intake"]}.` : current?.status !== clean.status ? `Status changed to ${clean.status}.` : "Updated deal details.", field_changes: diffDeal(current, clean) });
    return { data: next.find(deal => deal.id === id) ?? null, error: null };
  }

  const { data, error } = await supabase
    .from("meridian_deals")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? "Deal update failed" };
  await createDealActivity({ deal_id: id, actor, activity_type: current?.status !== clean.status || stageChanged ? "status-change" : "updated", summary: stageChanged ? `Deal stage changed to ${DEAL_STAGE_LABELS[clean.deal_stage ?? "intake"]}.` : current?.status !== clean.status ? `Status changed to ${clean.status}.` : "Updated deal details.", field_changes: diffDeal(current, clean) });
  const deal = normalizeDeal(data as Record<string, unknown>);
  await syncDealSellerContact(deal, actor);
  return { data: deal, error: null };
}

export async function updateDealStage(
  dealId: string,
  stage: DealStage,
  actor: string,
): Promise<{ data: Deal | null; error: string | null }> {
  const now = new Date().toISOString();
  if (!supabase) {
    const rows = localGet<Deal[]>(LOCAL_DEALS, []);
    const next = rows.map(deal => deal.id === dealId ? normalizeDeal({ ...deal, deal_stage: stage, stage_updated_at: now, stage_updated_by: actor, updated_at: now, updated_by: actor }) : deal);
    localSet(LOCAL_DEALS, next);
    await createDealActivity({ deal_id: dealId, actor, activity_type: "status-change", summary: `Deal stage changed to ${DEAL_STAGE_LABELS[stage]}.`, field_changes: { deal_stage: stage } });
    return { data: next.find(deal => deal.id === dealId) ?? null, error: null };
  }
  const { data, error } = await supabase
    .from("meridian_deals")
    .update({ deal_stage: stage, stage_updated_at: now, stage_updated_by: actor, updated_at: now, updated_by: actor })
    .eq("id", dealId)
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? "Deal stage update failed" };
  await createDealActivity({ deal_id: dealId, actor, activity_type: "status-change", summary: `Deal stage changed to ${DEAL_STAGE_LABELS[stage]}.`, field_changes: { deal_stage: stage } });
  return { data: normalizeDeal(data as Record<string, unknown>), error: null };
}

export async function fetchDealBudgetVersions(dealId: string): Promise<DealBudgetVersion[]> {
  if (!supabase) {
    return localGet<DealBudgetVersion[]>(LOCAL_BUDGET_VERSIONS, [])
      .filter(version => version.deal_id === dealId && !version.deleted_at)
      .sort((a, b) => b.version_number - a.version_number);
  }
  const { data, error } = await supabase
    .from("meridian_deal_budget_versions")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .order("version_number", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeBudgetVersion);
}

export async function fetchDealBudgetLines(versionId: string): Promise<DealBudgetLine[]> {
  if (!supabase) {
    return localGet<DealBudgetLine[]>(LOCAL_BUDGET_LINES, [])
      .filter(line => line.budget_version_id === versionId && !line.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order);
  }
  const { data, error } = await supabase
    .from("meridian_deal_budget_lines")
    .select("*")
    .eq("budget_version_id", versionId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeBudgetLine);
}

export async function fetchDealBudgetBundle(dealId: string): Promise<{ versions: DealBudgetVersion[]; lines: DealBudgetLine[] }> {
  const versions = await fetchDealBudgetVersions(dealId);
  const versionIds = new Set(versions.map(version => version.id));
  if (!versions.length) return { versions, lines: [] };
  if (!supabase) {
    return {
      versions,
      lines: localGet<DealBudgetLine[]>(LOCAL_BUDGET_LINES, [])
        .filter(line => versionIds.has(line.budget_version_id) && !line.deleted_at)
        .sort((a, b) => a.sort_order - b.sort_order),
    };
  }
  const { data, error } = await supabase
    .from("meridian_deal_budget_lines")
    .select("*")
    .in("budget_version_id", Array.from(versionIds))
    .is("deleted_at", null)
    .order("sort_order");
  return { versions, lines: error || !data ? [] : (data as Record<string, unknown>[]).map(normalizeBudgetLine) };
}

export async function createDealBudgetVersion(
  input: DealBudgetVersionInput,
  lines: DealBudgetLineInput[],
  actor: string,
): Promise<{ data: DealBudgetVersion | null; error: string | null }> {
  const cleanLines = lines
    .map(cleanBudgetLine)
    .filter(line => line.category || line.description || (num(line.estimated_amount) ?? 0) > 0 || (num(line.approved_amount) ?? 0) > 0 || (num(line.actual_amount) ?? 0) > 0);
  if (!input.label.trim()) return { data: null, error: "Budget label is required." };
  if (!cleanLines.length) return { data: null, error: "Add at least one budget line." };

  const now = new Date().toISOString();
  const existing = await fetchDealBudgetVersions(input.deal_id);
  const versionNumber = input.version_number ?? ((existing[0]?.version_number ?? 0) + 1);
  const totals = budgetTotals(cleanLines);
  const status: DealBudgetStatus = input.status ?? "draft";
  const approved = status === "approved" || status === "final-actuals";
  const row = {
    deal_id: input.deal_id,
    version_number: versionNumber,
    stage: input.stage,
    label: input.label.trim(),
    status,
    change_summary: input.change_summary?.trim() || null,
    source_of_funds: input.source_of_funds?.trim() || null,
    ...totals,
    material_variance_threshold_amount: num(input.material_variance_threshold_amount),
    material_variance_threshold_percent: num(input.material_variance_threshold_percent),
    vote_required: Boolean(input.vote_required),
    approved_at: approved ? now : null,
    approved_by: approved ? actor : null,
    created_by: actor,
    updated_by: actor,
  };

  if (!supabase) {
    const version: DealBudgetVersion = {
      ...row,
      id: `budget-${Date.now()}`,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    const lineRows: DealBudgetLine[] = cleanLines.map((line, index) => ({
      ...line,
      id: `${version.id}-line-${index}`,
      budget_version_id: version.id,
      estimated_amount: num(line.estimated_amount) ?? 0,
      approved_amount: num(line.approved_amount) ?? 0,
      actual_amount: num(line.actual_amount) ?? 0,
      sort_order: line.sort_order ?? index,
      created_at: now,
      created_by: actor,
      updated_at: now,
      updated_by: actor,
      deleted_at: null,
    }));
    localSet(LOCAL_BUDGET_VERSIONS, [version, ...localGet<DealBudgetVersion[]>(LOCAL_BUDGET_VERSIONS, [])]);
    localSet(LOCAL_BUDGET_LINES, [...lineRows, ...localGet<DealBudgetLine[]>(LOCAL_BUDGET_LINES, [])]);
    await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: `Budget version ${versionNumber} saved: ${row.label}.`, field_changes: row });
    return { data: version, error: null };
  }

  const { data, error } = await supabase.from("meridian_deal_budget_versions").insert(row).select().single();
  if (error || !data) return { data: null, error: error?.message ?? "Budget version create failed" };
  const version = normalizeBudgetVersion(data as Record<string, unknown>);
  const lineRows = cleanLines.map((line, index) => ({
    ...line,
    budget_version_id: version.id,
    sort_order: line.sort_order ?? index,
    created_by: actor,
    updated_by: actor,
  }));
  const { error: lineError } = await supabase.from("meridian_deal_budget_lines").insert(lineRows);
  await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: `Budget version ${versionNumber} saved: ${row.label}.`, field_changes: row });
  return { data: version, error: lineError?.message ?? null };
}

export async function fetchDealDecisions(dealId: string): Promise<DealDecision[]> {
  if (!supabase) {
    return localGet<DealDecision[]>(LOCAL_DECISIONS, [])
      .filter(decision => decision.deal_id === dealId && !decision.deleted_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await supabase
    .from("meridian_deal_decisions")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeDealDecision);
}

export async function createDealDecision(input: DealDecisionInput, actor: string): Promise<{ data: DealDecision | null; error: string | null }> {
  if (!input.decision_requested.trim()) return { data: null, error: "Decision requested is required." };
  if (!input.affected_matter.trim()) return { data: null, error: "Affected deal or company matter is required." };
  const now = new Date().toISOString();
  const status: DealDecisionStatus = input.status ?? "open";
  const row = {
    deal_id: input.deal_id,
    decision_type: input.decision_type,
    stage: input.stage,
    status,
    decision_requested: input.decision_requested.trim(),
    affected_matter: input.affected_matter.trim(),
    dollar_impact: num(input.dollar_impact),
    source_of_funds: input.source_of_funds?.trim() || null,
    approval_threshold: input.approval_threshold?.trim() || "Tier 3 Majority approval",
    required_approvals: num(input.required_approvals) ?? 3,
    response_deadline: input.response_deadline || null,
    non_response_consequence: input.non_response_consequence?.trim() || "Non-response counts as abstention, not approval.",
    personal_risk_summary: input.personal_risk_summary?.trim() || null,
    related_budget_version_id: input.related_budget_version_id || null,
    supporting_documents: cleanDocumentList(input.supporting_documents),
    opened_at: status === "open" ? now : null,
    decided_at: status === "approved" || status === "rejected" ? now : null,
    created_by: actor,
    updated_by: actor,
  };

  if (!supabase) {
    const decision: DealDecision = {
      ...row,
      id: `decision-${Date.now()}`,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    localSet(LOCAL_DECISIONS, [decision, ...localGet<DealDecision[]>(LOCAL_DECISIONS, [])]);
    await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: `Opened decision: ${row.decision_requested}.`, field_changes: row });
    return { data: decision, error: null };
  }

  const { data, error } = await supabase.from("meridian_deal_decisions").insert(row).select().single();
  if (error || !data) return { data: null, error: error?.message ?? "Decision create failed" };
  await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: `Opened decision: ${row.decision_requested}.`, field_changes: row });
  return { data: normalizeDealDecision(data as Record<string, unknown>), error: null };
}

export async function fetchDealDecisionVotes(dealId: string): Promise<DealDecisionVote[]> {
  const decisions = await fetchDealDecisions(dealId);
  const decisionIds = new Set(decisions.map(decision => decision.id));
  if (!decisionIds.size) return [];
  if (!supabase) {
    return localGet<DealDecisionVote[]>(LOCAL_DECISION_VOTES, [])
      .filter(vote => decisionIds.has(vote.decision_id))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  const { data, error } = await supabase
    .from("meridian_deal_decision_votes")
    .select("*")
    .in("decision_id", Array.from(decisionIds))
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as DealDecisionVote[];
}

async function updateDecisionOutcome(decisionId: string): Promise<void> {
  const votes = !supabase
    ? localGet<DealDecisionVote[]>(LOCAL_DECISION_VOTES, []).filter(vote => vote.decision_id === decisionId)
    : ((await supabase.from("meridian_deal_decision_votes").select("*").eq("decision_id", decisionId)).data as DealDecisionVote[] | null) ?? [];
  const decision = !supabase
    ? localGet<DealDecision[]>(LOCAL_DECISIONS, []).find(row => row.id === decisionId) ?? null
    : normalizeDealDecision(((await supabase.from("meridian_deal_decisions").select("*").eq("id", decisionId).maybeSingle()).data ?? {}) as Record<string, unknown>);
  if (!decision?.id || decision.status === "closed" || decision.status === "cancelled") return;
  const approvals = votes.filter(vote => vote.vote === "approve").length;
  const rejections = votes.filter(vote => vote.vote === "reject").length;
  const nextStatus: DealDecisionStatus | null = approvals >= decision.required_approvals
    ? "approved"
    : rejections >= decision.required_approvals
      ? "rejected"
      : null;
  if (!nextStatus) return;
  const now = new Date().toISOString();
  if (!supabase) {
    localSet(LOCAL_DECISIONS, localGet<DealDecision[]>(LOCAL_DECISIONS, []).map(row => row.id === decisionId ? { ...row, status: nextStatus, decided_at: now, updated_at: now } : row));
    return;
  }
  await supabase.from("meridian_deal_decisions").update({ status: nextStatus, decided_at: now, updated_at: now }).eq("id", decisionId);
}

export async function upsertDealDecisionVote(
  decisionId: string,
  memberName: string,
  vote: DealDecisionVoteChoice,
  note: string,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  if (!supabase) {
    const rows = localGet<DealDecisionVote[]>(LOCAL_DECISION_VOTES, []);
    const existing = rows.find(row => row.decision_id === decisionId && row.member_name === memberName);
    const next = existing
      ? rows.map(row => row === existing ? { ...row, vote, note: note.trim() || null, updated_at: now } : row)
      : [{ id: `decision-vote-${Date.now()}`, decision_id: decisionId, member_name: memberName, vote, note: note.trim() || null, created_at: now, updated_at: now }, ...rows];
    localSet(LOCAL_DECISION_VOTES, next);
    await updateDecisionOutcome(decisionId);
    return { error: null };
  }
  const { error } = await supabase.from("meridian_deal_decision_votes").upsert({
    decision_id: decisionId,
    member_name: memberName,
    vote,
    note: note.trim() || null,
    updated_at: now,
  }, { onConflict: "decision_id,member_name" });
  if (!error) await updateDecisionOutcome(decisionId);
  return { error: error?.message ?? null };
}

export async function fetchDealMemberCommitments(dealId: string): Promise<DealMemberCommitment[]> {
  if (!supabase) {
    return localGet<DealMemberCommitment[]>(LOCAL_COMMITMENTS, [])
      .filter(commitment => commitment.deal_id === dealId && !commitment.deleted_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await supabase
    .from("meridian_deal_member_commitments")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeCommitment);
}

export async function createDealMemberCommitment(
  input: DealMemberCommitmentInput,
  actor: string,
): Promise<{ data: DealMemberCommitment | null; error: string | null }> {
  if (!input.member_name.trim()) return { data: null, error: "Member is required." };
  const now = new Date().toISOString();
  const row = {
    deal_id: input.deal_id,
    member_name: input.member_name.trim(),
    commitment_type: input.commitment_type,
    amount: num(input.amount),
    description: input.description?.trim() || null,
    source_of_funds: input.source_of_funds?.trim() || null,
    decision_id: input.decision_id || null,
    budget_version_id: input.budget_version_id || null,
    consent_status: input.consent_status ?? "pending",
    consent_note: input.consent_note?.trim() || null,
    consented_at: input.consent_status === "approved" || input.consent_status === "rejected" ? now : null,
    created_by: actor,
    updated_by: actor,
  };
  if (!supabase) {
    const commitment: DealMemberCommitment = {
      ...row,
      id: `commitment-${Date.now()}`,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    localSet(LOCAL_COMMITMENTS, [commitment, ...localGet<DealMemberCommitment[]>(LOCAL_COMMITMENTS, [])]);
    await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: `Added ${row.member_name} ${row.commitment_type} commitment.`, field_changes: row });
    return { data: commitment, error: null };
  }
  const { data, error } = await supabase.from("meridian_deal_member_commitments").insert(row).select().single();
  if (error || !data) return { data: null, error: error?.message ?? "Commitment create failed" };
  await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: `Added ${row.member_name} ${row.commitment_type} commitment.`, field_changes: row });
  return { data: normalizeCommitment(data as Record<string, unknown>), error: null };
}

export async function updateDealMemberCommitmentConsent(
  commitmentId: string,
  status: DealCommitmentConsentStatus,
  note: string,
  actor: string,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  if (!supabase) {
    const rows = localGet<DealMemberCommitment[]>(LOCAL_COMMITMENTS, []);
    localSet(LOCAL_COMMITMENTS, rows.map(row => row.id === commitmentId ? { ...row, consent_status: status, consent_note: note.trim() || null, consented_at: status === "approved" || status === "rejected" ? now : row.consented_at, updated_at: now, updated_by: actor } : row));
    return { error: null };
  }
  const { error } = await supabase
    .from("meridian_deal_member_commitments")
    .update({ consent_status: status, consent_note: note.trim() || null, consented_at: status === "approved" || status === "rejected" ? now : null, updated_at: now, updated_by: actor })
    .eq("id", commitmentId);
  return { error: error?.message ?? null };
}

export async function fetchDealExitMemos(dealId: string): Promise<DealExitMemo[]> {
  if (!supabase) {
    return localGet<DealExitMemo[]>(LOCAL_EXIT_MEMOS, [])
      .filter(memo => memo.deal_id === dealId && !memo.deleted_at)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  const { data, error } = await supabase
    .from("meridian_deal_exit_memos")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeExitMemo);
}

export async function createDealExitMemo(input: DealExitMemoInput, actor: string): Promise<{ data: DealExitMemo | null; error: string | null }> {
  if (!input.recommended_exit.trim()) return { data: null, error: "Recommended exit is required." };
  const row = {
    deal_id: input.deal_id,
    decision_id: input.decision_id || null,
    status: input.status ?? "draft",
    recommended_exit: input.recommended_exit.trim(),
    current_budget_to_actual: input.current_budget_to_actual?.trim() || null,
    debt_payoff: num(input.debt_payoff),
    closing_costs: num(input.closing_costs),
    expected_net_proceeds: num(input.expected_net_proceeds),
    return_of_capital: num(input.return_of_capital),
    preferred_return_or_guarantee_premium: num(input.preferred_return_or_guarantee_premium),
    reserves_to_hold_back: num(input.reserves_to_hold_back),
    estimated_member_distributions: input.estimated_member_distributions?.trim() || null,
    risks: input.risks?.trim() || null,
    alternatives_considered: input.alternatives_considered?.trim() || null,
    supporting_documents: cleanDocumentList(input.supporting_documents),
    created_by: actor,
    updated_by: actor,
  };
  const now = new Date().toISOString();
  if (!supabase) {
    const memo: DealExitMemo = { ...row, id: `exit-${Date.now()}`, created_at: now, updated_at: now, deleted_at: null };
    localSet(LOCAL_EXIT_MEMOS, [memo, ...localGet<DealExitMemo[]>(LOCAL_EXIT_MEMOS, [])]);
    await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: `Exit memo saved: ${row.recommended_exit}.`, field_changes: row });
    return { data: memo, error: null };
  }
  const { data, error } = await supabase.from("meridian_deal_exit_memos").insert(row).select().single();
  if (error || !data) return { data: null, error: error?.message ?? "Exit memo create failed" };
  await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: `Exit memo saved: ${row.recommended_exit}.`, field_changes: row });
  return { data: normalizeExitMemo(data as Record<string, unknown>), error: null };
}

export async function fetchDealCloseoutPackets(dealId: string): Promise<DealCloseoutPacket[]> {
  if (!supabase) {
    return localGet<DealCloseoutPacket[]>(LOCAL_CLOSEOUT_PACKETS, [])
      .filter(packet => packet.deal_id === dealId && !packet.deleted_at)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  const { data, error } = await supabase
    .from("meridian_deal_closeout_packets")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizeCloseoutPacket);
}

export async function createDealCloseoutPacket(input: DealCloseoutPacketInput, actor: string): Promise<{ data: DealCloseoutPacket | null; error: string | null }> {
  const row = {
    deal_id: input.deal_id,
    exit_memo_id: input.exit_memo_id || null,
    status: input.status ?? "draft",
    settlement_statement_url: input.settlement_statement_url?.trim() || null,
    refinance_statement_url: input.refinance_statement_url?.trim() || null,
    final_budget_variance: input.final_budget_variance?.trim() || null,
    final_profit_loss: num(input.final_profit_loss),
    capital_return: input.capital_return?.trim() || null,
    distribution_calculation: input.distribution_calculation?.trim() || null,
    lessons_learned: input.lessons_learned?.trim() || null,
    tax_followups: input.tax_followups?.trim() || null,
    created_by: actor,
    updated_by: actor,
  };
  const now = new Date().toISOString();
  if (!supabase) {
    const packet: DealCloseoutPacket = { ...row, id: `closeout-${Date.now()}`, created_at: now, updated_at: now, deleted_at: null };
    localSet(LOCAL_CLOSEOUT_PACKETS, [packet, ...localGet<DealCloseoutPacket[]>(LOCAL_CLOSEOUT_PACKETS, [])]);
    await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: "Closeout packet saved.", field_changes: row });
    return { data: packet, error: null };
  }
  const { data, error } = await supabase.from("meridian_deal_closeout_packets").insert(row).select().single();
  if (error || !data) return { data: null, error: error?.message ?? "Closeout packet create failed" };
  await createDealActivity({ deal_id: input.deal_id, actor, activity_type: "updated", summary: "Closeout packet saved.", field_changes: row });
  return { data: normalizeCloseoutPacket(data as Record<string, unknown>), error: null };
}

export async function updateChecklistItemStatus(
  id: string,
  status: ChecklistStatus,
  actor: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    const rows = localGet<DealDueDiligenceItem[]>(LOCAL_CHECKLIST, []);
    const existing = rows.find(r => r.id === id);
    localSet(LOCAL_CHECKLIST, rows.map(r => r.id === id ? { ...r, status, updated_at: new Date().toISOString(), updated_by: actor } : r));
    if (existing) await createDealActivity({ deal_id: existing.deal_id, actor, activity_type: "checklist-update", summary: `Checklist updated: ${existing.title} -> ${status}`, field_changes: { checklist_item_id: id, status } });
    return { error: null };
  }
  const { data: existing } = await supabase.from("meridian_deal_due_diligence_items").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("meridian_deal_due_diligence_items")
    .update({ status, updated_at: new Date().toISOString(), updated_by: actor })
    .eq("id", id);
  if (!error && existing) await createDealActivity({ deal_id: existing.deal_id, actor, activity_type: "checklist-update", summary: `Checklist updated: ${existing.title} -> ${status}`, field_changes: { checklist_item_id: id, status } });
  return { error: error?.message ?? null };
}

export async function upsertDealVote(
  dealId: string,
  memberName: string,
  vote: DealVoteOption,
  note: string,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  if (!supabase) {
    const rows = localGet<DealVote[]>(LOCAL_VOTES, []);
    const existing = rows.find(v => v.deal_id === dealId && v.member_name === memberName);
    const next = existing
      ? rows.map(v => v === existing ? { ...v, vote, note: note.trim() || null, updated_at: now } : v)
      : [{ id: `vote-${Date.now()}`, deal_id: dealId, member_name: memberName, vote, note: note.trim() || null, created_at: now, updated_at: now }, ...rows];
    localSet(LOCAL_VOTES, next);
    return { error: null };
  }
  const { error } = await supabase.from("meridian_deal_votes").upsert({
    deal_id: dealId,
    member_name: memberName,
    vote,
    note: note.trim() || null,
    updated_at: now,
  }, { onConflict: "deal_id,member_name" });
  return { error: error?.message ?? null };
}

export async function upsertDealAgreement(
  input: DealAgreementInput,
  actor: string,
): Promise<{ data: DealAgreement | null; error: string | null }> {
  const now = new Date().toISOString();
  const row = {
    ...input,
    offer_authority: num(input.offer_authority),
    earnest_money: num(input.earnest_money),
    diligence_budget: num(input.diligence_budget),
    capital_needed: num(input.capital_needed),
    capital_commitments: input.capital_commitments?.trim() || null,
    credit_guarantees: input.credit_guarantees?.trim() || null,
    member_roles: input.member_roles?.trim() || null,
    economics: input.economics?.trim() || null,
    overrun_rule: input.overrun_rule?.trim() || null,
    exit_plan: input.exit_plan?.trim() || null,
    approval_threshold: input.approval_threshold?.trim() || null,
    go_no_go_deadline: input.go_no_go_deadline?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: now,
    updated_by: actor,
    approved_at: input.status === "approved" || input.status === "signed" ? now : null,
    approved_by: input.status === "approved" || input.status === "signed" ? actor : null,
  };

  if (!supabase) {
    const rows = localGet<DealAgreement[]>(LOCAL_AGREEMENTS, []);
    const existing = rows.find(a => a.deal_id === input.deal_id);
    const nextAgreement: DealAgreement = existing
      ? { ...existing, ...row }
      : {
          ...row,
          id: `agreement-${Date.now()}`,
          created_at: now,
          created_by: actor,
        };
    localSet(LOCAL_AGREEMENTS, existing ? rows.map(a => a.id === existing.id ? nextAgreement : a) : [nextAgreement, ...rows]);
    return { data: nextAgreement, error: null };
  }

  const existing = await fetchDealAgreement(input.deal_id);
  const { data, error } = await supabase.from("meridian_deal_agreements").upsert({
    ...(existing ? { id: existing.id } : {}),
    ...row,
    created_by: existing?.created_by ?? actor,
  }, { onConflict: "deal_id" }).select().single();
  return { data: data as DealAgreement | null, error: error?.message ?? null };
}

export function buildDealAgreementMemo(deal: Deal, agreement: DealAgreementInput | DealAgreement | null, votes: DealVote[]): string {
  const a = agreement;
  const voteLines = votes.length
    ? votes.map(v => `- ${v.member_name}: ${v.vote}${v.note ? ` — ${v.note}` : ""}`).join("\n")
    : "- No member votes recorded yet.";
  return [
    "MERIDIAN COLLECTIVE",
    "Deal Approval Memo / Deal Participation Agreement",
    "",
    "Purpose",
    "This memo supplements the Meridian Collective Operating Agreement for this specific deal only. Equal company membership does not require equal deal economics; this memo controls the deal-level capital, risk, roles, and economics approved for this opportunity.",
    "",
    `Deal: ${deal.title}`,
    `Location: ${deal.address || deal.parcel_id || "Pending"}`,
    `Strategy: ${deal.strategy}`,
    `Status: ${a?.status ?? "draft"}`,
    "",
    "Offer & Budget Authority",
    `- Offer authority: ${money(a?.offer_authority)}`,
    `- Earnest money: ${money(a?.earnest_money)}`,
    `- Due diligence budget: ${money(a?.diligence_budget)}`,
    `- Capital needed: ${money(a?.capital_needed)}`,
    `- Go/no-go deadline: ${a?.go_no_go_deadline || "Pending"}`,
    "",
    "Capital, Credit & Guarantees",
    a?.capital_commitments || "Pending member-by-member capital commitments.",
    "",
    a?.credit_guarantees || "Pending credit, guarantee, or lender exposure terms.",
    "",
    "Roles & Responsibilities",
    a?.member_roles || "Pending member role assignments.",
    "",
    "Deal Economics",
    a?.economics || "Pending profit/loss split, preferred return, fees, commissions, and waterfall terms.",
    "",
    "Overruns / Additional Capital",
    a?.overrun_rule || "Pending rule for overruns, capital calls, member loans, and opt-in/opt-out rights.",
    "",
    "Exit Plan",
    a?.exit_plan || "Pending sale, hold, assignment, refinance, or pass criteria.",
    "",
    "Approval Rule",
    a?.approval_threshold || "Majority approval unless debt, guarantees, outside equity, acquisition, or OA-defined major decisions require supermajority/unanimous consent.",
    "",
    "Member Votes",
    voteLines,
    "",
    "Notes",
    a?.notes || "None.",
  ].join("\n");
}
