"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calculateDealAnalysis,
  buildDealAgreementMemo,
  createDealBudgetVersion,
  createDealCloseoutPacket,
  createDealDecision,
  createDealExitMemo,
  createDealMemberCommitment,
  createDeal,
  fetchDealActivity,
  fetchDealAttachments,
  fetchDealBudgetBundle,
  fetchDealCloseoutPackets,
  fetchDealChecklist,
  fetchDealDecisionVotes,
  fetchDealDecisions,
  fetchDealAgreement,
  fetchDealExitMemos,
  fetchDealMemberCommitments,
  fetchDeals,
  fetchDealVotes,
  generateDueDiligenceChecklist,
  DEAL_STAGE_LABELS,
  DEAL_STAGES,
  updateChecklistItemStatus,
  updateDeal,
  updateDealMemberCommitmentConsent,
  updateDealStage,
  upsertDealDecisionVote,
  upsertDealAgreement,
  upsertDealVote,
  type ChecklistStatus,
  type Deal,
  type DealActivity,
  type DealAttachment,
  type DealAgreement,
  type DealAgreementInput,
  type DealAgreementStatus,
  type DealBudgetLine,
  type DealBudgetLineInput,
  type DealBudgetStatus,
  type DealBudgetVersion,
  type DealBudgetVersionInput,
  type DealCloseoutPacket,
  type DealCloseoutPacketInput,
  type DealCloseoutStatus,
  type DealCommitmentConsentStatus,
  type DealCommitmentType,
  type DealDecision,
  type DealDecisionInput,
  type DealDecisionStatus,
  type DealDecisionType,
  type DealDecisionVote,
  type DealDecisionVoteChoice,
  type DealDueDiligenceItem,
  type DealExitMemo,
  type DealExitMemoInput,
  type DealExitMemoStatus,
  type DealInput,
  type DealMemberCommitment,
  type DealMemberCommitmentInput,
  type DealPropertyType,
  type DealStage,
  type DealUrgency,
  type DealVote,
  type DealVoteOption,
} from "@/lib/deals";
import { createProjectFromDeal } from "@/lib/projects";
import { createActionItem } from "@/lib/action-items";
import { createNotification, markNotificationRead } from "@/lib/operations";
import { saveGeneratedMemo } from "@/lib/governance";
import { supabase } from "@/lib/supabase";
import { isVaUser } from "@/lib/identity";
import { fetchCommunicationEvents, type CommunicationEvent } from "@/lib/communications";
import ConversationPanel from "@/components/ConversationPanel";
import BuildDealAnalysisPanel from "@/components/BuildDealAnalysisPanel";
import DealAiAnalysisPanel from "@/components/DealAiAnalysisPanel";
import { labelForStatus } from "@/lib/status-map";
import { getDealNextAction, type WorkflowAction } from "@/lib/workflow-actions";
import { fetchActiveMemberNames } from "@/lib/members";
import { createDefaultBuildAnalysis } from "@/lib/build-underwriting";
import type { DealAiAnalysisResult } from "@/lib/deal-ai";

const DISPLAY_FONT = "var(--font-display)";

type DealDetailTab = "packet" | "communications" | "agreement" | "budget" | "decisions" | "vote" | "diligence" | "exit" | "closeout";

function actionTargetToDealTab(target: WorkflowAction["target"]): DealDetailTab {
  if (target === "communications") return "communications";
  if (target === "vote") return "vote";
  if (target === "agreement") return "agreement";
  if (target === "diligence" || target === "project") return "diligence";
  return "packet";
}

const PROPERTY_TYPES: Array<{ value: DealPropertyType; label: string }> = [
  { value: "land", label: "Land" },
  { value: "house", label: "House / Rehab" },
  { value: "rental", label: "Rental Hold" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];

const URGENCY: Array<{ value: DealUrgency; label: string }> = [
  { value: "routine", label: "Routine Review" },
  { value: "time-sensitive", label: "Time Sensitive" },
  { value: "hot", label: "Hot Deal" },
];

const VOTES: Array<{ value: DealVoteOption; label: string }> = [
  { value: "make-offer", label: "Make Offer" },
  { value: "counter", label: "Counter" },
  { value: "needs-more-info", label: "Needs Info" },
  { value: "schedule-call", label: "Schedule Call" },
  { value: "urgent-review", label: "Urgent Review" },
  { value: "pass", label: "Pass" },
];

const CHECKLIST_STATUSES: Array<{ value: ChecklistStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in-review", label: "In Review" },
  { value: "cleared", label: "Cleared" },
  { value: "blocked", label: "Blocked" },
  { value: "not-applicable", label: "N/A" },
];

const AGREEMENT_STATUSES: Array<{ value: DealAgreementStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "ready-for-review", label: "Ready for Review" },
  { value: "approved", label: "Approved" },
  { value: "signed", label: "Signed" },
  { value: "superseded", label: "Superseded" },
];

const BUDGET_STATUSES: Array<{ value: DealBudgetStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "approved", label: "Approved" },
  { value: "superseded", label: "Superseded" },
  { value: "final-actuals", label: "Final Actuals" },
];

const DECISION_TYPES: Array<{ value: DealDecisionType; label: string }> = [
  { value: "general", label: "General" },
  { value: "offer-approval", label: "Offer Approval" },
  { value: "due-diligence-go-no-go", label: "Diligence Go/No-Go" },
  { value: "budget-change", label: "Budget Change" },
  { value: "capital-call", label: "Capital Call" },
  { value: "active-project-change", label: "Project Change" },
  { value: "exit-decision", label: "Exit Decision" },
  { value: "closeout-approval", label: "Closeout Approval" },
];

const DECISION_STATUSES: Array<{ value: DealDecisionStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "revision-needed", label: "Revision Needed" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

const DECISION_VOTES: Array<{ value: DealDecisionVoteChoice; label: string }> = [
  { value: "approve", label: "Approve" },
  { value: "request_changes", label: "Request Changes" },
  { value: "abstain", label: "Abstain" },
  { value: "reject", label: "Reject" },
];

const COMMITMENT_TYPES: Array<{ value: DealCommitmentType; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit" },
  { value: "guarantee", label: "Guarantee" },
  { value: "member-loan", label: "Member Loan" },
  { value: "collateral", label: "Collateral" },
  { value: "deal-specific-capital", label: "Deal Capital" },
  { value: "other", label: "Other" },
];

const EXIT_MEMO_STATUSES: Array<{ value: DealExitMemoStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "ready-for-review", label: "Ready for Review" },
  { value: "approved", label: "Approved" },
  { value: "superseded", label: "Superseded" },
];

const CLOSEOUT_STATUSES: Array<{ value: DealCloseoutStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "ready-for-review", label: "Ready for Review" },
  { value: "final", label: "Final" },
];

const STAGE_DETAILS: Record<DealStage, string> = {
  "intake": "Create or receive the packet.",
  "initial-screen": "Screen facts, risks, and buyer/exit confidence.",
  "offer-approval": "Approve price, capital, risk, and authority.",
  "due-diligence-go-no-go": "Verify documents and decide go/no-go.",
  "active-project-change": "Manage approved budget changes and scope.",
  "exit-execution": "Approve sale, hold, refinance, or other exit.",
  "closeout": "Finalize actuals, distributions, and tax follow-up.",
};

const LEAD_TEMPERATURES: Array<{ value: NonNullable<DealInput["lead_temperature"]>; label: string }> = [
  { value: "cold", label: "Cold" },
  { value: "warm", label: "Warm" },
  { value: "hot", label: "Hot" },
  { value: "dead", label: "Dead" },
];

const EMPTY_DRAFT: DealInput & { linksText: string } = {
  title: "",
  source: "Land portal",
  property_type: "land",
  strategy: "land resale",
  deal_stage: "intake",
  urgency: "routine",
  address: "",
  parcel_id: "",
  seller_name: "",
  seller_phone: "",
  asking_price: null,
  arv: null,
  repair_estimate: null,
  acreage: null,
  zoning: "",
  road_frontage: "",
  utilities: "",
  notes: "",
  submitted_by: null,
  assigned_to: "",
  next_follow_up_date: "",
  lead_temperature: "warm",
  campaign_source: "",
  review_intent: null,
  submission_summary: "",
  requested_next_step: "",
  submit_uncertainties: "",
  first_submitted_at: null,
  last_submitted_at: null,
  review_round: 0,
  last_review_notification_at: null,
  disposition_status: "not-started",
  exit_strategy: "",
  target_buyer_type: "",
  target_resale_price: null,
  minimum_acceptable_price: null,
  best_buyer_offer: null,
  buyer_demand_evidence: "",
  disposition_owner: "",
  disposition_next_step: "",
  closing_costs_estimate: null,
  holding_costs_estimate: null,
  marketing_costs_estimate: null,
  desired_minimum_spread: null,
  risk_buffer: null,
  calculator_notes: "",
  build_analysis: createDefaultBuildAnalysis(),
  linksText: "",
};

const emptyAgreementDraft = (dealId = ""): DealAgreementInput => ({
  deal_id: dealId,
  status: "draft",
  offer_authority: null,
  earnest_money: null,
  diligence_budget: null,
  capital_needed: null,
  capital_commitments: "",
  credit_guarantees: "",
  member_roles: "",
  economics: "",
  overrun_rule: "",
  exit_plan: "",
  approval_threshold: "Majority approval unless the deal requires debt over $25,000, personal guarantees, outside equity participants, acquisition of real property, or another major decision under the Operating Agreement.",
  go_no_go_deadline: "",
  notes: "",
});

const defaultBudgetLines = (): DealBudgetLineInput[] => [
  { category: "Acquisition", description: "Offer / purchase price authority", estimated_amount: null, approved_amount: null, actual_amount: null, source_of_funds: "Member cash or approved financing", sort_order: 10 },
  { category: "Diligence", description: "Title, survey, inspection, legal, utility/buildability checks", estimated_amount: null, approved_amount: null, actual_amount: null, source_of_funds: "Operating cash", sort_order: 20 },
  { category: "Closing", description: "Earnest money, closing costs, transfer costs", estimated_amount: null, approved_amount: null, actual_amount: null, source_of_funds: "Operating cash", sort_order: 30 },
  { category: "Project", description: "Repairs, site work, permits, contractor scope", estimated_amount: null, approved_amount: null, actual_amount: null, source_of_funds: "Deal budget", sort_order: 40 },
  { category: "Holding", description: "Taxes, insurance, utilities, reserves", estimated_amount: null, approved_amount: null, actual_amount: null, source_of_funds: "Deal budget", sort_order: 50 },
];

const emptyBudgetDraft = (dealId = "", stage: DealStage = "initial-screen"): DealBudgetVersionInput => ({
  deal_id: dealId,
  stage,
  label: "Initial deal budget",
  status: "draft",
  change_summary: "",
  source_of_funds: "",
  material_variance_threshold_amount: 2500,
  material_variance_threshold_percent: 10,
  vote_required: true,
});

const emptyDecisionDraft = (dealId = "", stage: DealStage = "initial-screen", requiredApprovals = 3): DealDecisionInput => ({
  deal_id: dealId,
  decision_type: "general",
  stage,
  status: "open",
  decision_requested: "",
  affected_matter: "",
  dollar_impact: null,
  source_of_funds: "",
  approval_threshold: "Tier 3 Majority approval",
  required_approvals: requiredApprovals,
  response_deadline: "",
  non_response_consequence: "Non-response counts as abstention, not approval.",
  personal_risk_summary: "",
  supporting_documents: [],
});

const emptyCommitmentDraft = (dealId = "", memberName = ""): DealMemberCommitmentInput => ({
  deal_id: dealId,
  member_name: memberName,
  commitment_type: "cash",
  amount: null,
  description: "",
  source_of_funds: "",
  decision_id: null,
  budget_version_id: null,
  consent_status: "pending",
  consent_note: "",
});

const emptyExitMemoDraft = (dealId = ""): DealExitMemoInput => ({
  deal_id: dealId,
  status: "draft",
  recommended_exit: "",
  current_budget_to_actual: "",
  debt_payoff: null,
  closing_costs: null,
  expected_net_proceeds: null,
  return_of_capital: null,
  preferred_return_or_guarantee_premium: null,
  reserves_to_hold_back: null,
  estimated_member_distributions: "",
  risks: "",
  alternatives_considered: "",
  supporting_documents: [],
});

const emptyCloseoutDraft = (dealId = ""): DealCloseoutPacketInput => ({
  deal_id: dealId,
  status: "draft",
  exit_memo_id: null,
  settlement_statement_url: "",
  refinance_statement_url: "",
  final_budget_variance: "",
  final_profit_loss: null,
  capital_return: "",
  distribution_calculation: "",
  lessons_learned: "",
  tax_followups: "",
});

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function money(n: number | null): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function statusLabel(value: string): string {
  return labelForStatus(value);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function draftFromDeal(deal: Deal): DealInput & { linksText: string } {
  return {
    title: deal.title,
    source: deal.source ?? "",
    property_type: deal.property_type,
    strategy: deal.strategy,
    status: deal.status,
    deal_stage: deal.deal_stage,
    urgency: deal.urgency,
    address: deal.address ?? "",
    parcel_id: deal.parcel_id ?? "",
    seller_name: deal.seller_name ?? "",
    seller_phone: deal.seller_phone ?? "",
    asking_price: deal.asking_price ?? null,
    arv: deal.arv ?? null,
    repair_estimate: deal.repair_estimate ?? null,
    acreage: deal.acreage ?? null,
    zoning: deal.zoning ?? "",
    road_frontage: deal.road_frontage ?? "",
    utilities: deal.utilities ?? "",
    notes: deal.notes ?? "",
    submitted_by: deal.submitted_by ?? "",
    assigned_to: deal.assigned_to ?? "",
    next_follow_up_date: deal.next_follow_up_date ?? "",
    lead_temperature: deal.lead_temperature ?? "warm",
    campaign_source: deal.campaign_source ?? "",
    review_intent: deal.review_intent ?? null,
    submission_summary: deal.submission_summary ?? "",
    requested_next_step: deal.requested_next_step ?? "",
    submit_uncertainties: deal.submit_uncertainties ?? "",
    first_submitted_at: deal.first_submitted_at ?? null,
    last_submitted_at: deal.last_submitted_at ?? null,
    review_round: deal.review_round ?? 0,
    last_review_notification_at: deal.last_review_notification_at ?? null,
    disposition_status: deal.disposition_status ?? "not-started",
    exit_strategy: deal.exit_strategy ?? "",
    target_buyer_type: deal.target_buyer_type ?? "",
    target_resale_price: deal.target_resale_price ?? null,
    minimum_acceptable_price: deal.minimum_acceptable_price ?? null,
    best_buyer_offer: deal.best_buyer_offer ?? null,
    buyer_demand_evidence: deal.buyer_demand_evidence ?? "",
    disposition_owner: deal.disposition_owner ?? "",
    disposition_next_step: deal.disposition_next_step ?? "",
    closing_costs_estimate: deal.closing_costs_estimate ?? null,
    holding_costs_estimate: deal.holding_costs_estimate ?? null,
    marketing_costs_estimate: deal.marketing_costs_estimate ?? null,
    desired_minimum_spread: deal.desired_minimum_spread ?? null,
    risk_buffer: deal.risk_buffer ?? null,
    calculator_notes: deal.calculator_notes ?? "",
    build_analysis: deal.build_analysis ?? createDefaultBuildAnalysis(deal),
    linksText: deal.links.join("\n"),
  };
}

export default function DealsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<DealDueDiligenceItem[]>([]);
  const [votes, setVotes] = useState<DealVote[]>([]);
  const [activity, setActivity] = useState<DealActivity[]>([]);
  const [attachments, setAttachments] = useState<DealAttachment[]>([]);
  const [communicationEvents, setCommunicationEvents] = useState<CommunicationEvent[]>([]);
  const [agreement, setAgreement] = useState<DealAgreement | null>(null);
  const [agreementDraft, setAgreementDraft] = useState<DealAgreementInput>(emptyAgreementDraft());
  const [budgetVersions, setBudgetVersions] = useState<DealBudgetVersion[]>([]);
  const [budgetLines, setBudgetLines] = useState<DealBudgetLine[]>([]);
  const [budgetDraft, setBudgetDraft] = useState<DealBudgetVersionInput>(emptyBudgetDraft());
  const [budgetLineDrafts, setBudgetLineDrafts] = useState<DealBudgetLineInput[]>(defaultBudgetLines());
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [decisions, setDecisions] = useState<DealDecision[]>([]);
  const [decisionVotes, setDecisionVotes] = useState<DealDecisionVote[]>([]);
  const [decisionDraft, setDecisionDraft] = useState<DealDecisionInput>(emptyDecisionDraft());
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionVoteNote, setDecisionVoteNote] = useState("");
  const [commitments, setCommitments] = useState<DealMemberCommitment[]>([]);
  const [commitmentDraft, setCommitmentDraft] = useState<DealMemberCommitmentInput>(emptyCommitmentDraft());
  const [commitmentSaving, setCommitmentSaving] = useState(false);
  const [commitmentConsentNote, setCommitmentConsentNote] = useState("");
  const [exitMemos, setExitMemos] = useState<DealExitMemo[]>([]);
  const [exitMemoDraft, setExitMemoDraft] = useState<DealExitMemoInput>(emptyExitMemoDraft());
  const [exitMemoSaving, setExitMemoSaving] = useState(false);
  const [closeoutPackets, setCloseoutPackets] = useState<DealCloseoutPacket[]>([]);
  const [closeoutDraft, setCloseoutDraft] = useState<DealCloseoutPacketInput>(emptyCloseoutDraft());
  const [closeoutSaving, setCloseoutSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [memoSaving, setMemoSaving] = useState(false);
  const [agreementSaving, setAgreementSaving] = useState(false);
  const [voteNote, setVoteNote] = useState("");
  const [smsDraft, setSmsDraft] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [activeDealTab, setActiveDealTab] = useState<DealDetailTab>("packet");
  const [activeMemberNames, setActiveMemberNames] = useState<string[]>([]);
  const [dealAiAnalysis, setDealAiAnalysis] = useState<DealAiAnalysisResult | null>(null);
  const [dealAiAnalyzing, setDealAiAnalyzing] = useState(false);
  const [dealAiError, setDealAiError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const [rows, members] = await Promise.all([fetchDeals(), fetchActiveMemberNames()]);
    setDeals(rows);
    setActiveMemberNames(members);
    const focusedDealId = new URLSearchParams(window.location.search).get("deal");
    setSelectedId(prev => focusedDealId || prev || rows[0]?.id || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    if (isVaUser(u)) { router.push("/va"); return; }
    setUser(u);
    void reload();
  }, [router, reload]);

  const selected = useMemo(() => deals.find(d => d.id === selectedId) ?? deals[0] ?? null, [deals, selectedId]);

  useEffect(() => {
    if (!selected) {
      setChecklist([]);
      setVotes([]);
      setActivity([]);
      setAttachments([]);
      setCommunicationEvents([]);
      setAgreement(null);
      setAgreementDraft(emptyAgreementDraft());
      setBudgetVersions([]);
      setBudgetLines([]);
      setBudgetDraft(emptyBudgetDraft());
      setBudgetLineDrafts(defaultBudgetLines());
      setDecisions([]);
      setDecisionVotes([]);
      setDecisionDraft(emptyDecisionDraft());
      setCommitments([]);
      setCommitmentDraft(emptyCommitmentDraft());
      setExitMemos([]);
      setExitMemoDraft(emptyExitMemoDraft());
      setCloseoutPackets([]);
      setCloseoutDraft(emptyCloseoutDraft());
      setDealAiAnalysis(null);
      setDealAiError("");
      return;
    }
    const requiredApprovals = Math.max(1, Math.floor((activeMemberNames.length || 4) / 2) + 1);
    setDealAiAnalysis(null);
    setDealAiError("");
    setBudgetDraft(emptyBudgetDraft(selected.id, selected.deal_stage));
    setBudgetLineDrafts(defaultBudgetLines());
    setDecisionDraft(emptyDecisionDraft(selected.id, selected.deal_stage, requiredApprovals));
    setCommitmentDraft(emptyCommitmentDraft(selected.id, activeMemberNames[0] ?? user ?? ""));
    setExitMemoDraft(emptyExitMemoDraft(selected.id));
    setCloseoutDraft(emptyCloseoutDraft(selected.id));
    void fetchDealChecklist(selected.id).then(setChecklist);
    void fetchDealVotes(selected.id).then(setVotes);
    void fetchDealActivity(selected.id).then(setActivity);
    void fetchDealAttachments(selected.id).then(setAttachments);
    void fetchDealBudgetBundle(selected.id).then(bundle => {
      setBudgetVersions(bundle.versions);
      setBudgetLines(bundle.lines);
    });
    void fetchDealDecisions(selected.id).then(setDecisions);
    void fetchDealDecisionVotes(selected.id).then(setDecisionVotes);
    void fetchDealMemberCommitments(selected.id).then(setCommitments);
    void fetchDealExitMemos(selected.id).then(setExitMemos);
    void fetchDealCloseoutPackets(selected.id).then(setCloseoutPackets);
    void fetchCommunicationEvents({ dealId: selected.id, limit: 30 }).then(setCommunicationEvents);
    void fetchDealAgreement(selected.id).then(row => {
      setAgreement(row);
      setAgreementDraft(row ?? emptyAgreementDraft(selected.id));
    });
  }, [selected, activeMemberNames, user]);

  const liveInput: DealInput = useMemo(() => ({
    ...draft,
    links: draft.linksText.split(/\r?\n/).map(l => l.trim()).filter(Boolean),
  }), [draft]);
  const liveAnalysis = useMemo(() => calculateDealAnalysis(liveInput), [liveInput]);
  const liveChecklist = useMemo(() => generateDueDiligenceChecklist(liveInput), [liveInput]);
  const runDealAiAnalysis = useCallback(async () => {
    setDealAiAnalyzing(true);
    setDealAiError("");
    try {
      const response = await fetch("/api/deals/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal: liveInput }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || response.statusText || "AI analysis failed.");
      setDealAiAnalysis(data as DealAiAnalysisResult);
      if (data.note) setMessage(String(data.note));
    } catch (error) {
      const text = error instanceof Error ? error.message : "AI analysis failed.";
      setDealAiError(text);
      setMessage(text);
    } finally {
      setDealAiAnalyzing(false);
    }
  }, [liveInput]);
  const applyDealAiSuggestions = useCallback(() => {
    if (!dealAiAnalysis) return;
    const suggestions = dealAiAnalysis.field_suggestions;
    setDraft(prev => ({
      ...prev,
      submission_summary: suggestions.submission_summary || prev.submission_summary,
      requested_next_step: suggestions.requested_next_step || prev.requested_next_step,
      submit_uncertainties: suggestions.submit_uncertainties || prev.submit_uncertainties,
      buyer_demand_evidence: suggestions.buyer_demand_evidence || prev.buyer_demand_evidence,
      exit_strategy: suggestions.exit_strategy || prev.exit_strategy,
      target_buyer_type: suggestions.target_buyer_type || prev.target_buyer_type,
      calculator_notes: suggestions.calculator_notes || prev.calculator_notes,
      disposition_next_step: suggestions.requested_next_step || prev.disposition_next_step,
    }));
    setMessage("AI suggestions applied to the draft. Review them before saving.");
  }, [dealAiAnalysis]);

  if (!user) return null;

  const notifyDealReviewWork = async (deal: Deal, message: string): Promise<string[]> => {
    const results = await Promise.all(activeMemberNames.flatMap(member => [
      createNotification({
        title: `Deal needs your vote: ${deal.title}`,
        body: message,
        priority: deal.urgency === "hot" ? "urgent" : "high",
        assigned_to: member,
        href: `/opportunity?deal=${deal.id}`,
        source_table: "meridian_deals",
        source_id: deal.id,
        notification_type: "deal_vote",
      }, user),
      createActionItem({
        title: `Review deal: ${deal.title}`,
        description: message,
        assigned_to: member,
        due_date: addDays(deal.urgency === "hot" ? 1 : 2),
      }, user),
    ]));
    return results.map(result => result.error).filter((error): error is string => !!error);
  };

  const handleCreate = async () => {
    if (!draft.title.trim()) { setMessage("Deal title is required."); return; }
    setSaving(true);
    const payload: DealInput = {
      ...liveInput,
      title: draft.title.trim(),
      source: draft.source?.trim() || null,
      strategy: draft.strategy.trim() || "review",
      address: draft.address?.trim() || null,
      parcel_id: draft.parcel_id?.trim() || null,
      seller_name: draft.seller_name?.trim() || null,
      seller_phone: draft.seller_phone?.trim() || null,
      zoning: draft.zoning?.trim() || null,
      road_frontage: draft.road_frontage?.trim() || null,
      utilities: draft.utilities?.trim() || null,
      notes: draft.notes?.trim() || null,
      submitted_by: draft.submitted_by?.trim() || null,
      assigned_to: draft.assigned_to?.trim() || null,
      next_follow_up_date: draft.next_follow_up_date || null,
      lead_temperature: draft.lead_temperature || null,
      campaign_source: draft.campaign_source?.trim() || null,
      review_intent: draft.review_intent || null,
      submission_summary: draft.submission_summary?.trim() || null,
      requested_next_step: draft.requested_next_step?.trim() || null,
      submit_uncertainties: draft.submit_uncertainties?.trim() || null,
      first_submitted_at: draft.first_submitted_at || null,
      last_submitted_at: draft.last_submitted_at || null,
      review_round: draft.review_round ?? 0,
      last_review_notification_at: draft.last_review_notification_at || null,
    };
    const { data, error } = editingDealId
      ? await updateDeal(editingDealId, payload, user)
      : await createDeal(payload, user);
    setSaving(false);
    if (error && !data) { setMessage(error); return; }
    if (error && data) {
      setMessage(`Deal saved, but one follow-up step did not finish: ${error}`);
    }
    if (data) {
      const workErrors = await notifyDealReviewWork(
        data,
        editingDealId
          ? `Updated deal details are ready for review. ${data.analysis?.recommendation ?? "Needs Review"} · ${data.address || data.parcel_id || "Location pending"}`
          : `${data.analysis?.recommendation ?? "Needs Review"} · ${data.address || data.parcel_id || "Location pending"}`,
      );
      if (workErrors.length) {
        setMessage(`Deal saved, but member vote notifications or action items did not fully create: ${workErrors[0]}`);
      } else if (!error) {
        setMessage(editingDealId ? "Deal packet updated and members notified." : "Deal packet created and members notified.");
      }
    }
    setDraft(EMPTY_DRAFT);
    setDealAiAnalysis(null);
    setDealAiError("");
    setEditingDealId(null);
    setShowNew(false);
    await reload();
    if (data) setSelectedId(data.id);
  };

  const startEdit = (deal: Deal) => {
    setDraft(draftFromDeal(deal));
    setEditingDealId(deal.id);
    setShowNew(true);
    setDealAiAnalysis(null);
    setDealAiError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleChecklistStatus = async (item: DealDueDiligenceItem, status: ChecklistStatus) => {
    const { error } = await updateChecklistItemStatus(item.id, status, user);
    if (error) { setMessage(error); return; }
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, status, updated_by: user, updated_at: new Date().toISOString() } : i));
    setMessage(`Checklist item marked ${statusLabel(status)}.`);
  };

  const sendSmsFromDeal = async () => {
    if (!selected) return;
    const toNumber = selected.seller_phone?.trim();
    if (!toNumber) { setMessage("This deal does not have a seller phone number."); return; }
    const message = smsDraft.trim();
    if (!message) { setMessage("Write a text message before sending."); return; }
    setSmsSending(true);
    try {
      const response = await fetch("/api/sakari/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber,
          message,
          actor: user,
          dealId: selected.id,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        setMessage(`SMS failed: ${result.error || response.statusText}`);
        return;
      }
      setSmsDraft("");
      setCommunicationEvents(await fetchCommunicationEvents({ dealId: selected.id, limit: 30 }));
      setActivity(await fetchDealActivity(selected.id));
      setMessage("SMS sent and conversation updated.");
    } finally {
      setSmsSending(false);
    }
  };

  const handleVote = async (vote: DealVoteOption) => {
    if (!selected) return;
    const { error } = await upsertDealVote(selected.id, user, vote, voteNote);
    if (error) { setMessage(error); return; }
    await markDealVoteWorkComplete(selected, user);
    setVoteNote("");
    setVotes(await fetchDealVotes(selected.id));
    setMessage(`Vote recorded: ${statusLabel(vote)}.`);
  };

  const handleConvertToProject = async () => {
    if (!selected) return;
    const gate = conversionBlockReason();
    if (gate) { setMessage(gate); return; }
    setConverting(true);
    const { data, error } = await createProjectFromDeal(selected, user);
    setConverting(false);
    if (error) { setMessage(error); return; }
    if (data) {
      await createNotification({
        title: `Project created: ${data.name}`,
        body: data.next_step,
        priority: "high",
        href: "/projects",
        source_table: "meridian_projects",
        source_id: data.id,
        notification_type: "project-created",
      }, user);
    }
    if (data) router.push("/projects");
  };

  async function markDealVoteWorkComplete(deal: Deal, member: string) {
    if (!supabase) return;
    const { data: notices } = await supabase
      .from("meridian_notifications")
      .select("id")
      .eq("assigned_to", member)
      .eq("source_id", deal.id)
      .in("notification_type", ["deal_vote", "deal-review"])
      .is("read_at", null);
    await Promise.all((notices ?? []).map(notice => markNotificationRead(notice.id)));

    await supabase
      .from("action_items")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: member,
      })
      .eq("assigned_to", member)
      .eq("title", `Review deal: ${deal.title}`)
      .neq("status", "done");
  }

  const buildDealMemo = (deal: Deal): string => {
    const voteLines = votes.length
      ? votes.map(v => `- ${v.member_name}: ${statusLabel(v.vote)}${v.note ? ` — ${v.note}` : ""}`).join("\n")
      : "- No member votes recorded yet.";
    const checklistCleared = checklist.filter(i => i.status === "cleared" || i.status === "not-applicable").length;
    const risks = deal.analysis?.riskFlags?.length ? deal.analysis.riskFlags.map(r => `- ${r}`).join("\n") : "- No major risk flags recorded.";
    const missing = deal.analysis?.missingInfo?.length ? deal.analysis.missingInfo.map(r => `- ${r}`).join("\n") : "- Core information present.";
    return [
      "MERIDIAN COLLECTIVE",
      "Deal Brief",
      "",
      `Deal: ${deal.title}`,
      `Location: ${deal.address || deal.parcel_id || "Pending"}`,
      `Source: ${deal.source || "Pending"}`,
      `Type / Strategy: ${statusLabel(deal.property_type)} / ${deal.strategy}`,
      `Urgency: ${statusLabel(deal.urgency)}`,
      "",
      "Recommendation",
      `${deal.analysis?.recommendation ?? "Needs Review"} — ${deal.analysis?.summary ?? "Analysis pending."}`,
      "",
      "Key Numbers",
      `- Asking: ${money(deal.asking_price ?? null)}`,
      `- Target value / ARV: ${money(deal.arv ?? null)}`,
      `- Repair or site estimate: ${money(deal.repair_estimate ?? null)}`,
      `- Estimated total costs: ${money(deal.analysis?.acquisition.totalCosts ?? null)}`,
      `- Recommended offer: ${money(deal.analysis?.acquisition.recommendedOffer ?? null)}`,
      `- Max allowable offer: ${money(deal.analysis?.maxAllowableOffer ?? null)}`,
      `- Target resale: ${money(deal.analysis?.disposition.targetResale ?? null)}`,
      `- Minimum acceptable sale: ${money(deal.analysis?.disposition.minimumAcceptable ?? null)}`,
      `- Projected spread at ask: ${money(deal.analysis?.acquisition.projectedSpreadAtAsk ?? null)}`,
      "",
      "Disposition",
      `- Exit strategy: ${deal.exit_strategy || "Pending"}`,
      `- Target buyer: ${deal.target_buyer_type || "Pending"}`,
      `- Evidence: ${deal.buyer_demand_evidence || "Pending"}`,
      `- Next step: ${deal.disposition_next_step || "Pending"}`,
      "",
      "Risk Flags",
      risks,
      "",
      "Missing Information",
      missing,
      "",
      "Due Diligence",
      `- ${checklistCleared}/${checklist.length} checklist items cleared`,
      `- ${blocked} blocked`,
      "",
      "Member Votes",
      voteLines,
      "",
      "Next Decision",
      "Confirm whether Meridian should pass, request more information, counter, or authorize an offer.",
    ].join("\n");
  };

  const handleSaveAgreement = async () => {
    if (!selected) return;
    setAgreementSaving(true);
    const { data, error } = await upsertDealAgreement({ ...agreementDraft, deal_id: selected.id }, user);
    setAgreementSaving(false);
    if (error) { setMessage(error); return; }
    setAgreement(data);
    if (data) setAgreementDraft(data);
    setMessage("Deal agreement saved.");
  };

  const refreshWorkflowRecords = async (dealId: string) => {
    const [budgetBundle, decisionRows, decisionVoteRows, commitmentRows, exitRows, closeoutRows, activityRows] = await Promise.all([
      fetchDealBudgetBundle(dealId),
      fetchDealDecisions(dealId),
      fetchDealDecisionVotes(dealId),
      fetchDealMemberCommitments(dealId),
      fetchDealExitMemos(dealId),
      fetchDealCloseoutPackets(dealId),
      fetchDealActivity(dealId),
    ]);
    setBudgetVersions(budgetBundle.versions);
    setBudgetLines(budgetBundle.lines);
    setDecisions(decisionRows);
    setDecisionVotes(decisionVoteRows);
    setCommitments(commitmentRows);
    setExitMemos(exitRows);
    setCloseoutPackets(closeoutRows);
    setActivity(activityRows);
  };

  const handleStageChange = async (stage: DealStage) => {
    if (!selected) return;
    const { data, error } = await updateDealStage(selected.id, stage, user);
    if (error) { setMessage(error); return; }
    if (data) {
      setDeals(prev => prev.map(deal => deal.id === data.id ? data : deal));
      setBudgetDraft(prev => ({ ...prev, stage }));
      setDecisionDraft(prev => ({ ...prev, stage }));
    }
    setMessage(`Deal stage updated to ${DEAL_STAGE_LABELS[stage]}.`);
  };

  const updateBudgetLineDraft = (index: number, patch: Partial<DealBudgetLineInput>) => {
    setBudgetLineDrafts(prev => prev.map((line, idx) => idx === index ? { ...line, ...patch } : line));
  };

  const handleSaveBudget = async () => {
    if (!selected) return;
    setBudgetSaving(true);
    const { data, error } = await createDealBudgetVersion({ ...budgetDraft, deal_id: selected.id }, budgetLineDrafts, user);
    setBudgetSaving(false);
    if (error) { setMessage(error); return; }
    await refreshWorkflowRecords(selected.id);
    setBudgetDraft(emptyBudgetDraft(selected.id, selected.deal_stage));
    setBudgetLineDrafts(defaultBudgetLines());
    setMessage(data ? `Budget version ${data.version_number} saved.` : "Budget saved.");
  };

  const handleSaveDecision = async () => {
    if (!selected) return;
    setDecisionSaving(true);
    const { data, error } = await createDealDecision({ ...decisionDraft, deal_id: selected.id }, user);
    if (!error && data) {
      const body = [
        `Decision requested: ${data.decision_requested}`,
        `Affected matter: ${data.affected_matter}`,
        `Dollar impact/source: ${money(data.dollar_impact ?? null)} / ${data.source_of_funds || "Not specified"}`,
        `Approval threshold: ${data.approval_threshold}`,
        `Response deadline: ${data.response_deadline || "Not set"}`,
        `Non-response: ${data.non_response_consequence}`,
        `Personal risk: ${data.personal_risk_summary || "None stated"}`,
      ].join("\n");
      await Promise.all(activeMemberNames.map(member => createNotification({
        title: `Decision needed: ${selected.title}`,
        body,
        priority: selected.urgency === "hot" ? "urgent" : "high",
        assigned_to: member,
        href: `/deals?deal=${selected.id}`,
        source_table: "meridian_deal_decisions",
        source_id: data.id,
        notification_type: "deal_decision",
      }, user)));
      await Promise.all(activeMemberNames.map(member => createActionItem({
        title: `Vote on decision: ${selected.title}`,
        description: body,
        assigned_to: member,
        due_date: data.response_deadline ? data.response_deadline.slice(0, 10) : addDays(selected.urgency === "hot" ? 1 : 2),
      }, user)));
    }
    setDecisionSaving(false);
    if (error) { setMessage(error); return; }
    await refreshWorkflowRecords(selected.id);
    setDecisionDraft(emptyDecisionDraft(selected.id, selected.deal_stage, quorumNeeded));
    setMessage("Decision notice opened and member tasks sent.");
  };

  const handleDecisionVote = async (decision: DealDecision, vote: DealDecisionVoteChoice) => {
    if (!selected) return;
    const { error } = await upsertDealDecisionVote(decision.id, user, vote, decisionVoteNote);
    if (error) { setMessage(error); return; }
    setDecisionVoteNote("");
    await refreshWorkflowRecords(selected.id);
    setMessage(`Decision vote recorded: ${statusLabel(vote)}.`);
  };

  const handleSaveCommitment = async () => {
    if (!selected) return;
    setCommitmentSaving(true);
    const { error } = await createDealMemberCommitment({ ...commitmentDraft, deal_id: selected.id }, user);
    setCommitmentSaving(false);
    if (error) { setMessage(error); return; }
    await refreshWorkflowRecords(selected.id);
    setCommitmentDraft(emptyCommitmentDraft(selected.id, commitmentDraft.member_name || activeMemberNames[0] || user));
    setMessage("Member commitment added.");
  };

  const handleCommitmentConsent = async (commitment: DealMemberCommitment, status: DealCommitmentConsentStatus) => {
    if (!selected) return;
    const { error } = await updateDealMemberCommitmentConsent(commitment.id, status, commitmentConsentNote, user);
    if (error) { setMessage(error); return; }
    setCommitmentConsentNote("");
    await refreshWorkflowRecords(selected.id);
    setMessage(`${commitment.member_name} commitment marked ${statusLabel(status)}.`);
  };

  const handleSaveExitMemo = async () => {
    if (!selected) return;
    setExitMemoSaving(true);
    const { error } = await createDealExitMemo({ ...exitMemoDraft, deal_id: selected.id }, user);
    setExitMemoSaving(false);
    if (error) { setMessage(error); return; }
    await refreshWorkflowRecords(selected.id);
    setExitMemoDraft(emptyExitMemoDraft(selected.id));
    setMessage("Exit memo saved.");
  };

  const handleSaveCloseout = async () => {
    if (!selected) return;
    setCloseoutSaving(true);
    const { error } = await createDealCloseoutPacket({ ...closeoutDraft, deal_id: selected.id }, user);
    setCloseoutSaving(false);
    if (error) { setMessage(error); return; }
    await refreshWorkflowRecords(selected.id);
    setCloseoutDraft(emptyCloseoutDraft(selected.id));
    setMessage("Closeout packet saved.");
  };

  const handleSaveAgreementMemo = async () => {
    if (!selected) return;
    setMemoSaving(true);
    const body = buildDealAgreementMemo(selected, agreementDraft, votes);
    const { error } = await saveGeneratedMemo({
      title: `${selected.title} Deal Approval Memo`,
      body,
      deal_id: selected.id.startsWith("local-") ? null : selected.id,
      memo_type: "deal-agreement",
    }, user);
    setMemoSaving(false);
    if (error) { setMessage(error); return; }
    await navigator.clipboard?.writeText(body).catch(() => undefined);
    setMessage("Deal Approval Memo saved. I also copied the memo text when browser permissions allowed it.");
  };

  const handleSaveMemo = async () => {
    if (!selected) return;
    setMemoSaving(true);
    const body = buildDealMemo(selected);
    const { error } = await saveGeneratedMemo({
      title: `${selected.title} Deal Brief`,
      body,
      deal_id: selected.id.startsWith("local-") ? null : selected.id,
      memo_type: "deal-brief",
    }, user);
    setMemoSaving(false);
    if (error) { setMessage(error); return; }
    await navigator.clipboard?.writeText(body).catch(() => undefined);
    setMessage("Deal brief saved. I also copied the memo text when browser permissions allowed it.");
  };

  const cleared = checklist.filter(i => i.status === "cleared" || i.status === "not-applicable").length;
  const blocked = checklist.filter(i => i.status === "blocked").length;
  const myVote = selected ? votes.find(v => v.member_name === user) : null;
  const voteCounts = VOTES.map(v => ({ ...v, count: votes.filter(row => row.vote === v.value).length })).filter(v => v.count > 0);
  const quorumNeeded = Math.max(1, Math.floor(activeMemberNames.length / 2) + 1);
  const approvalVotes = votes.filter(v => v.vote === "make-offer" || v.vote === "counter").length;
  const passVotes = votes.filter(v => v.vote === "pass").length;
  const quorumReached = votes.length >= quorumNeeded;
  const decisionStatus = approvalVotes >= quorumNeeded
    ? "Offer authority reached"
    : passVotes >= quorumNeeded
      ? "Pass threshold reached"
      : quorumReached
        ? "Quorum reached, decision split"
        : `${Math.max(0, quorumNeeded - votes.length)} more response${quorumNeeded - votes.length === 1 ? "" : "s"} for quorum`;
  const blockedDiligence = checklist.filter(item => item.status === "blocked").length;
  const agreementReady = agreement?.status === "approved" || agreement?.status === "signed";
  const sellerTouchCount = communicationEvents.length + activity.filter(item =>
    ["created", "updated", "submitted-review", "status-change", "note"].includes(item.activity_type) === false
  ).length;
  const vaHandoffVisible = !!selected && (
    !!selected.submitted_by
    || !!selected.submission_summary
    || !!selected.requested_next_step
    || !!selected.review_intent
    || selected.status === "under-review"
  );
  const vaHandoffSource = selected
    ? [selected.source, selected.campaign_source].filter(Boolean).join(" · ") || "Source pending"
    : "Source pending";
  const vaDecisionAsk = selected?.requested_next_step
    || (selected?.review_intent === "ready-for-vote"
      ? "Vote on whether Meridian should move forward."
      : selected?.review_intent === "blocked-decision"
        ? "Resolve the blocker before the VA keeps working this lead."
        : "Review the packet and request missing information or a next action.");
  const conversionBlockReason = () => {
    if (!selected) return "Select a deal before converting it to a project.";
    if (approvalVotes < quorumNeeded) return `This deal needs ${quorumNeeded} Make Offer or Counter votes before it can become a project.`;
    if (!agreementReady) return "Approve or sign the deal agreement before converting this deal to a project.";
    if (blockedDiligence > 0) return "Resolve blocked due diligence items before converting this deal to a project.";
    return "";
  };
  const canConvert = !!selected && !conversionBlockReason();
  const currentStageIndex = selected ? DEAL_STAGES.indexOf(selected.deal_stage) : -1;
  const latestBudget = budgetVersions[0] ?? null;
  const openDecisions = decisions.filter(decision => decision.status === "open" || decision.status === "draft" || decision.status === "revision-needed");
  const approvedDecisions = decisions.filter(decision => decision.status === "approved").length;
  const pendingCommitments = commitments.filter(commitment => commitment.consent_status === "pending").length;
  const approvedCommitments = commitments.filter(commitment => commitment.consent_status === "approved").length;
  const dealDetailTabs: { id: DealDetailTab; label: string; count?: number }[] = [
    { id: "packet", label: "Packet" },
    { id: "communications", label: "Communications", count: communicationEvents.length },
    { id: "agreement", label: "Agreement", count: agreementReady ? 1 : 0 },
    { id: "budget", label: "Budget", count: budgetVersions.length },
    { id: "decisions", label: "Decisions", count: openDecisions.length || decisions.length },
    { id: "vote", label: "Vote", count: votes.length },
    { id: "diligence", label: "Diligence", count: blocked || checklist.length },
    { id: "exit", label: "Exit", count: exitMemos.length },
    { id: "closeout", label: "Closeout", count: closeoutPackets.length },
  ];
  const decisionPathCards = selected ? DEAL_STAGES.map((stage, index) => ({
    label: `${index + 1}. ${DEAL_STAGE_LABELS[stage]}`,
    title: index === currentStageIndex
      ? "Current stage"
      : index < currentStageIndex
        ? "Completed / past stage"
        : "Upcoming stage",
    detail: STAGE_DETAILS[stage],
    state: index === currentStageIndex ? "active" : index < currentStageIndex ? "done" : "open",
    tab: stage === "offer-approval" || stage === "due-diligence-go-no-go" ? "decisions" as DealDetailTab
      : stage === "active-project-change" ? "budget" as DealDetailTab
        : stage === "exit-execution" ? "exit" as DealDetailTab
          : stage === "closeout" ? "closeout" as DealDetailTab
            : "packet" as DealDetailTab,
  })) : [];
  const memberNextAction = selected
    ? getDealNextAction({
        deal: selected,
        votes,
        agreement,
        checklist,
        communications: communicationEvents,
        currentUser: user,
        quorumNeeded,
      })
    : null;

  return (
    <div className="deals-root" style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 20px 100px" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={eyebrow}>Member Portal</p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 50px)", fontWeight: 500, color: "var(--obsidian)", marginBottom: 6 }}>
            Deal Reviews
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.66, fontSize: 14, maxWidth: 680 }}>
            Review VA-submitted packets, seller communications, calculator output, deal terms, votes, and due diligence from one member workspace.
          </p>
        </div>
        <button
          onClick={() => {
            setShowNew(s => !s);
            setEditingDealId(null);
            setDraft(EMPTY_DRAFT);
            setDealAiAnalysis(null);
            setDealAiError("");
          }}
          style={showNew ? secondaryButton : primaryButton}
        >
          {showNew ? "Cancel" : "New Packet"}
        </button>
      </header>

      {message && (
        <div style={{
          border: "1px solid rgba(176,137,84,0.36)",
          background: "rgba(176,137,84,0.10)",
          color: "var(--obsidian)",
          borderRadius: 10,
          padding: "11px 13px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          fontSize: 13,
          lineHeight: 1.45,
        }}>
          <span>{message}</span>
          <button onClick={() => setMessage("")} style={{ background: "transparent", border: "none", color: "var(--brass)", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Clear</button>
        </div>
      )}

      {showNew && (
        <section style={panel}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 18 }} className="deal-form-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={label}>Deal title</label>
                <input type="text" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="1842 Oakview Dr SW or Parcel 14-..." />
              </div>
              <div style={twoCol} className="two-col">
                <div>
                  <label style={label}>Property type</label>
                  <select value={draft.property_type} onChange={e => setDraft({ ...draft, property_type: e.target.value as DealPropertyType })}>
                    {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Urgency</label>
                  <select value={draft.urgency} onChange={e => setDraft({ ...draft, urgency: e.target.value as DealUrgency })}>
                    {URGENCY.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={twoCol} className="two-col">
                <div>
                  <label style={label}>Source</label>
                  <input type="text" value={draft.source ?? ""} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Land portal, call tool, referral" />
                </div>
                <div>
                  <label style={label}>Strategy</label>
                  <input type="text" value={draft.strategy} onChange={e => setDraft({ ...draft, strategy: e.target.value })} placeholder="land resale, infill build, flip, hold" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }} className="number-grid">
                <div>
                  <label style={label}>Assigned to</label>
                  <input type="text" value={draft.assigned_to ?? ""} onChange={e => setDraft({ ...draft, assigned_to: e.target.value })} placeholder="Sophie / VA" />
                </div>
                <div>
                  <label style={label}>Lead temperature</label>
                  <select value={draft.lead_temperature ?? ""} onChange={e => setDraft({ ...draft, lead_temperature: (e.target.value || null) as DealInput["lead_temperature"] })}>
                    <option value="">Unset</option>
                    {LEAD_TEMPERATURES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Campaign</label>
                  <input type="text" value={draft.campaign_source ?? ""} onChange={e => setDraft({ ...draft, campaign_source: e.target.value })} />
                </div>
                <div>
                  <label style={label}>Next follow-up</label>
                  <input type="date" value={draft.next_follow_up_date ?? ""} onChange={e => setDraft({ ...draft, next_follow_up_date: e.target.value })} />
                </div>
              </div>
              <div style={twoCol} className="two-col">
                <div>
                  <label style={label}>Address</label>
                  <input type="text" value={draft.address ?? ""} onChange={e => setDraft({ ...draft, address: e.target.value })} />
                </div>
                <div>
                  <label style={label}>Parcel ID</label>
                  <input type="text" value={draft.parcel_id ?? ""} onChange={e => setDraft({ ...draft, parcel_id: e.target.value })} />
                </div>
              </div>
              <div style={twoCol} className="two-col">
                <div>
                  <label style={label}>Seller</label>
                  <input type="text" value={draft.seller_name ?? ""} onChange={e => setDraft({ ...draft, seller_name: e.target.value })} />
                </div>
                <div>
                  <label style={label}>Seller phone</label>
                  <input type="text" autoComplete="off" inputMode="tel" value={draft.seller_phone ?? ""} onChange={e => setDraft({ ...draft, seller_phone: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }} className="number-grid">
                <NumberField label="Asking" value={draft.asking_price} onChange={v => setDraft({ ...draft, asking_price: v })} />
                <NumberField label={draft.property_type === "land" ? "Exit value" : "ARV/value"} value={draft.arv} onChange={v => setDraft({ ...draft, arv: v })} />
                <NumberField label="Repairs/site" value={draft.repair_estimate} onChange={v => setDraft({ ...draft, repair_estimate: v })} />
                <NumberField label="Acres" value={draft.acreage} onChange={v => setDraft({ ...draft, acreage: v })} />
              </div>
              {draft.property_type === "land" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }} className="three-col">
                  <div>
                    <label style={label}>Zoning</label>
                    <input type="text" value={draft.zoning ?? ""} onChange={e => setDraft({ ...draft, zoning: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Road frontage/access</label>
                    <input type="text" value={draft.road_frontage ?? ""} onChange={e => setDraft({ ...draft, road_frontage: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Utilities</label>
                    <input type="text" value={draft.utilities ?? ""} onChange={e => setDraft({ ...draft, utilities: e.target.value })} />
                  </div>
                </div>
              )}
              {draft.property_type === "land" && (
                <BuildDealAnalysisPanel
                  editable
                  value={draft.build_analysis}
                  deal={liveInput}
                  onChange={build_analysis => setDraft({ ...draft, build_analysis })}
                />
              )}
              <div>
                <label style={label}>Links</label>
                <textarea rows={3} value={draft.linksText} onChange={e => setDraft({ ...draft, linksText: e.target.value })} placeholder="One county, portal, comp, or map link per line" />
              </div>
              <div>
                <label style={label}>VA / seller notes</label>
                <textarea rows={4} value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Seller motivation, call notes, condition, timing, concerns" />
              </div>
            </div>

            <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DealAiAnalysisPanel
                result={dealAiAnalysis}
                loading={dealAiAnalyzing}
                error={dealAiError}
                onAnalyze={runDealAiAnalysis}
                onApply={applyDealAiSuggestions}
                canApply={!!dealAiAnalysis}
                compact
              />
              <AnalysisCard analysis={liveAnalysis} />
              <div style={subPanel}>
                <p style={eyebrowSmall}>Generated diligence</p>
                <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.68, marginBottom: 10 }}>
                  {liveChecklist.length} checklist items will be created from this deal type and strategy.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflow: "auto" }}>
                  {liveChecklist.slice(0, 8).map(i => (
                    <div key={i.sort_order} style={{ fontSize: 12, color: "var(--ink)", borderBottom: "1px solid var(--fog)", paddingBottom: 6 }}>
                      {i.title}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={handleCreate} disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving..." : editingDealId ? "Save Deal Updates" : "Create Deal Packet"}
              </button>
            </aside>
          </div>
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 18 }} className="deal-workspace">
        <aside style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={sectionTitle}>Pipeline</h2>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{deals.length} deals</span>
          </div>
          {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading...</p>}
          {!loading && deals.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No deal packets yet. Create or submit the first packet above.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {deals.map(deal => {
              const active = selected?.id === deal.id;
              return (
                <button
                  key={deal.id}
                  onClick={() => setSelectedId(deal.id)}
                  style={{
                    textAlign: "left",
                    background: active ? "rgba(176,137,84,0.16)" : "var(--surface)",
                    border: active ? "1px solid var(--brass)" : "1px solid var(--fog)",
                    borderRadius: 8,
                    padding: 12,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <strong style={{ fontSize: 14, color: "var(--obsidian)" }}>{deal.title}</strong>
                    <span style={deal.urgency === "hot" ? hotPill : pill}>{statusLabel(deal.urgency)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.66, marginBottom: 6 }}>
                    {deal.address || deal.parcel_id || "No location added"}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                    <span>{deal.analysis?.recommendation ?? "Needs Review"}</span>
                    <span>{formatDate(deal.created_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!selected ? (
            <section style={panel}>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>Select or create a deal to review the packet.</p>
            </section>
          ) : (
            <>
              <section className="member-decision-path">
                {decisionPathCards.map(card => (
                  <button
                    key={card.label}
                    onClick={() => setActiveDealTab(card.tab)}
                    className={`decision-path-card ${card.state} ${activeDealTab === card.tab ? "active-tab" : ""}`}
                  >
                    <span>{card.label}</span>
                    <strong>{card.title}</strong>
                    <p>{card.detail}</p>
                  </button>
                ))}
              </section>

              {memberNextAction && (
                <section className={`member-next-action ${memberNextAction.tone}`}>
                  <div>
                    <p>{memberNextAction.label}</p>
                    <h2>{memberNextAction.title}</h2>
                    <span>{memberNextAction.detail}</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (memberNextAction.target === "project") {
                          void handleConvertToProject();
                        } else {
                          setActiveDealTab(actionTargetToDealTab(memberNextAction.target));
                        }
                      }}
                      disabled={memberNextAction.target === "project" && (converting || !canConvert)}
                    >
                      {memberNextAction.target === "project" && converting ? "Converting..." : memberNextAction.primary}
                    </button>
                    <button type="button" onClick={() => router.push(`/opportunity?deal=${selected.id}`)}>
                      Open Shared File
                    </button>
                  </div>
                </section>
              )}

              <nav className="deal-detail-tabs" aria-label="Deal review sections">
                {dealDetailTabs.map(tab => (
                  <DealDetailTabButton
                    key={tab.id}
                    label={tab.label}
                    count={tab.count}
                    active={activeDealTab === tab.id}
                    onClick={() => setActiveDealTab(tab.id)}
                  />
                ))}
              </nav>

              {activeDealTab === "packet" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
                  <div>
                    <p style={eyebrowSmall}>{statusLabel(selected.property_type)} · {selected.strategy}</p>
                    <h2 style={{ fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 32, fontWeight: 500, lineHeight: 1.08 }}>
                      {selected.title}
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.68, marginTop: 6 }}>
                      {selected.address || selected.parcel_id || "Location pending"} · {selected.source || "Source pending"}
                    </p>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={pill}>OA stage</span>
                      <select
                        value={selected.deal_stage}
                        onChange={event => handleStageChange(event.target.value as DealStage)}
                        style={{ width: 250, minHeight: 36 }}
                      >
                        {DEAL_STAGES.map(stage => <option key={stage} value={stage}>{DEAL_STAGE_LABELS[stage]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={selected.urgency === "hot" ? hotPillLarge : pillLarge}>{statusLabel(selected.urgency)}</span>
                    <button onClick={() => startEdit(selected)} style={secondaryButton}>
                      Edit Deal
                    </button>
                    <button onClick={() => router.push(`/opportunity?deal=${selected.id}`)} style={secondaryButton}>
                      Shared File
                    </button>
                    <button
                      onClick={handleConvertToProject}
                      disabled={converting || !canConvert}
                      title={conversionBlockReason() || "Convert approved deal to project"}
                      style={{ ...primaryButton, opacity: converting || !canConvert ? 0.55 : 1 }}
                    >
                      {converting ? "Converting..." : "Convert to Project"}
                    </button>
                    <button onClick={handleSaveMemo} disabled={memoSaving} style={{ ...secondaryButton, opacity: memoSaving ? 0.6 : 1 }}>
                      {memoSaving ? "Saving..." : "Save Brief"}
                    </button>
                  </div>
                </div>
                <p style={{ ...comingSoonPill, marginBottom: 12 }}>Branded PDF export coming soon</p>

                {vaHandoffVisible && (
                  <div style={handoffPanel}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <p style={{ ...eyebrowSmall, color: "var(--brass)" }}>VA handoff</p>
                        <h3 style={{ fontFamily: DISPLAY_FONT, color: "var(--bone)", fontSize: 26, fontWeight: 500, marginTop: 5 }}>
                          {selected.submitted_by || selected.created_by || "VA"} submitted this packet for member action
                        </h3>
                      </div>
                      <span style={handoffPill}>
                        {selected.review_intent ? statusLabel(selected.review_intent) : statusLabel(selected.status)}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }} className="number-grid">
                      <HandoffMetric label="Source" value={vaHandoffSource} />
                      <HandoffMetric label="Seller touches" value={sellerTouchCount ? String(sellerTouchCount) : "None attached"} />
                      <HandoffMetric label="Round" value={selected.review_round ? `Round ${selected.review_round}` : "First review"} />
                      <HandoffMetric label="Submitted" value={selected.last_submitted_at ? formatDate(selected.last_submitted_at) : "Not timestamped"} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 12, marginTop: 12 }} className="two-col">
                      <div>
                        <p style={handoffLabel}>Member decision needed</p>
                        <p style={handoffText}>{vaDecisionAsk}</p>
                      </div>
                      <div>
                        <p style={handoffLabel}>Open questions</p>
                        <p style={handoffText}>{selected.submit_uncertainties || selected.analysis.missingInfo.slice(0, 3).join(", ") || "No open questions documented."}</p>
                      </div>
                    </div>
                  </div>
                )}

                <AnalysisCard analysis={selected.analysis} compact={false} />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 }} className="number-grid">
                  <Stat label="Asking" value={money(selected.asking_price ?? null)} />
                  <Stat label={selected.property_type === "land" ? "Exit value" : "ARV/value"} value={money(selected.arv ?? null)} />
                  <Stat label="Repairs/site" value={money(selected.repair_estimate ?? null)} />
                  <Stat label="MAO" value={money(selected.analysis?.maxAllowableOffer ?? null)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }} className="number-grid">
                  <Stat label="Assigned" value={selected.assigned_to || "Unassigned"} />
                  <Stat label="Submitted by" value={selected.submitted_by || selected.created_by || "Unknown"} />
                  <Stat label="Temperature" value={selected.lead_temperature ? statusLabel(selected.lead_temperature) : "Unset"} />
                  <Stat label="Follow-up" value={selected.next_follow_up_date || "Not set"} />
                </div>

                <div style={{ ...subPanel, marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <div>
                      <p style={eyebrowSmall}>Acquisition + disposition calculator</p>
                      <h3 style={{ fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 24, fontWeight: 500 }}>
                        Vote with exit confidence
                      </h3>
                    </div>
                    <span style={pill}>Exit confidence: {selected.analysis.disposition.exitConfidence}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }} className="number-grid">
                    <Stat label="Recommended offer" value={money(selected.analysis.acquisition.recommendedOffer)} />
                    <Stat label="Max offer" value={money(selected.analysis.acquisition.maxOffer)} />
                    <Stat label="Target resale" value={money(selected.analysis.disposition.targetResale)} />
                    <Stat label="Spread @ ask" value={money(selected.analysis.acquisition.projectedSpreadAtAsk)} />
                    <Stat label="Minimum sale" value={money(selected.analysis.disposition.minimumAcceptable)} />
                    <Stat label="Best buyer offer" value={money(selected.analysis.disposition.bestBuyerOffer)} />
                    <Stat label="Net @ best offer" value={money(selected.analysis.disposition.projectedNetAtBestOffer)} />
                    <Stat label="Total costs" value={money(selected.analysis.acquisition.totalCosts)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }} className="two-col">
                    <div>
                      <p style={miniLabel}>Disposition thesis</p>
                      <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
                        {selected.exit_strategy || "Exit strategy pending."}{selected.target_buyer_type ? ` Target buyer: ${selected.target_buyer_type}.` : ""}
                      </p>
                    </div>
                    <div>
                      <p style={miniLabel}>Buyer demand evidence</p>
                      <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                        {selected.buyer_demand_evidence || "No buyer demand evidence documented yet."}
                      </p>
                    </div>
                  </div>
                </div>

                {selected.property_type === "land" && (
                  <div style={{ marginTop: 14 }}>
                    <BuildDealAnalysisPanel
                      value={selected.build_analysis}
                      deal={selected}
                      compact
                    />
                  </div>
                )}

                {(selected.submission_summary || selected.requested_next_step || selected.review_intent || selected.submit_uncertainties) && (
                  <div style={{ ...subPanel, marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                      <div>
                        <p style={eyebrowSmall}>VA packet</p>
                        <h3 style={{ fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 24, fontWeight: 500 }}>
                          {selected.review_intent ? statusLabel(selected.review_intent) : "Member Review"}
                        </h3>
                      </div>
                      <span style={pill}>
                        Round {selected.review_round ?? 0}{selected.last_submitted_at ? ` · ${formatDate(selected.last_submitted_at)}` : ""}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }} className="two-col">
                      <div>
                        <p style={miniLabel}>VA summary</p>
                        <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                          {selected.submission_summary || "No VA summary submitted."}
                        </p>
                      </div>
                      <div>
                        <p style={miniLabel}>Requested next step</p>
                        <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                          {selected.requested_next_step || "No requested next step."}
                        </p>
                      </div>
                    </div>
                    {selected.submit_uncertainties && (
                      <div style={{ marginTop: 12 }}>
                        <p style={miniLabel}>Missing or uncertain</p>
                        <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                          {selected.submit_uncertainties}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {(selected.notes || selected.links.length > 0) && (
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
                    {selected.notes && (
                      <div style={subPanel}>
                        <p style={eyebrowSmall}>Notes</p>
                        <pre style={preStyle}>{selected.notes}</pre>
                      </div>
                    )}
                    {selected.links.length > 0 && (
                      <div style={subPanel}>
                        <p style={eyebrowSmall}>Links</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {selected.links.map(link => (
                            <a key={link} href={link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brass)", overflowWrap: "anywhere" }}>
                              {link}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
              )}

              {activeDealTab === "communications" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 12 }}>
                  <div>
                    <p style={eyebrowSmall}>Seller communications</p>
                    <h2 style={sectionTitle}>SMS thread</h2>
                  </div>
                  <span style={pill}>{selected.seller_phone || "No seller phone"}</span>
                </div>
                <ConversationPanel
                  eyebrow="Seller communications"
                  title="Conversation panel"
                  subject={selected.seller_phone || "No seller phone"}
                  communications={communicationEvents}
                  emptyText="No Sakari messages are attached to this deal yet."
                  maxHeight={360}
                  composer={(
                    <div>
                      <p style={eyebrowSmall}>Member reply</p>
                    <textarea
                      rows={5}
                      value={smsDraft}
                      onChange={e => setSmsDraft(e.target.value)}
                      placeholder="Type a seller reply to send through Sakari."
                      disabled={!selected.seller_phone}
                      style={{ marginTop: 8 }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{smsDraft.trim().length} chars</span>
                      <button
                        onClick={sendSmsFromDeal}
                        disabled={smsSending || !selected.seller_phone}
                        style={{ ...primaryButton, opacity: smsSending || !selected.seller_phone ? 0.55 : 1 }}
                      >
                        {smsSending ? "Sending..." : "Send SMS"}
                      </button>
                    </div>
                    </div>
                  )}
                />
              </section>
              )}

              {activeDealTab === "packet" && (attachments.length > 0 || activity.length > 0) && (
                <section style={panel}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
                    <div style={subPanel}>
                      <p style={eyebrowSmall}>Research attachments</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {attachments.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>No attachments yet.</p>}
                        {attachments.map(file => (
                          <a key={file.id} href={file.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brass)", overflowWrap: "anywhere" }}>
                            {file.title} · {file.attachment_type}
                          </a>
                        ))}
                      </div>
                    </div>
                    <div style={subPanel}>
                      <p style={eyebrowSmall}>Activity trail</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflow: "auto" }}>
                        {activity.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>No activity yet.</p>}
                        {activity.slice(0, 12).map(item => (
                          <div key={item.id} style={{ borderBottom: "1px solid var(--fog)", paddingBottom: 7 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)" }}>{item.summary}</p>
                            <p style={{ fontSize: 11, color: "var(--muted)" }}>{item.actor || "Unknown"} · {formatDate(item.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeDealTab === "agreement" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h2 style={sectionTitle}>Deal agreement</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 760 }}>
                      This is the deal-level agreement that supplements the Meridian operating agreement. It defines who is putting in what, who is taking risk, and how this specific deal pays out before Meridian commits money or signs documents.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={handleSaveAgreement} disabled={agreementSaving} style={{ ...primaryButton, opacity: agreementSaving ? 0.6 : 1 }}>
                      {agreementSaving ? "Saving..." : "Save Terms"}
                    </button>
                    <button onClick={handleSaveAgreementMemo} disabled={memoSaving} style={{ ...secondaryButton, opacity: memoSaving ? 0.6 : 1 }}>
                      {memoSaving ? "Saving..." : "Save Agreement Memo"}
                    </button>
                  </div>
                </div>
                <div style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.72 }}>
                    Operating Agreement rule: equal Meridian membership stays separate from deal-level economics. A deal should not move past approval until this memo defines capital, credit, guarantees, roles, economics, overruns, and exit plan.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }} className="agreement-number-grid">
                  <div>
                    <label style={label}>Status</label>
                    <select value={agreementDraft.status} onChange={e => setAgreementDraft({ ...agreementDraft, status: e.target.value as DealAgreementStatus })}>
                      {AGREEMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <NumberField label="Offer authority" value={agreementDraft.offer_authority} onChange={v => setAgreementDraft({ ...agreementDraft, offer_authority: v })} />
                  <NumberField label="Earnest money" value={agreementDraft.earnest_money} onChange={v => setAgreementDraft({ ...agreementDraft, earnest_money: v })} />
                  <NumberField label="Diligence budget" value={agreementDraft.diligence_budget} onChange={v => setAgreementDraft({ ...agreementDraft, diligence_budget: v })} />
                  <NumberField label="Capital needed" value={agreementDraft.capital_needed} onChange={v => setAgreementDraft({ ...agreementDraft, capital_needed: v })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
                  <AgreementTextarea label="Capital commitments" value={agreementDraft.capital_commitments} onChange={capital_commitments => setAgreementDraft({ ...agreementDraft, capital_commitments })} placeholder="Courtney: $5,000 cash; Aaliyah: $2,500 cash + credit; optional members..." />
                  <AgreementTextarea label="Credit / guarantees" value={agreementDraft.credit_guarantees} onChange={credit_guarantees => setAgreementDraft({ ...agreementDraft, credit_guarantees })} placeholder="Who signs, guarantee premium, lender conditions, max exposure..." />
                  <AgreementTextarea label="Roles" value={agreementDraft.member_roles} onChange={member_roles => setAgreementDraft({ ...agreementDraft, member_roles })} placeholder="Lead negotiator, diligence owner, project manager, finance owner..." />
                  <AgreementTextarea label="Economics" value={agreementDraft.economics} onChange={economics => setAgreementDraft({ ...agreementDraft, economics })} placeholder="Return of capital, preferred return, profit split, commissions, fees..." />
                  <AgreementTextarea label="Overruns / additional capital" value={agreementDraft.overrun_rule} onChange={overrun_rule => setAgreementDraft({ ...agreementDraft, overrun_rule })} placeholder="What happens if budget increases or another capital call is needed?" />
                  <AgreementTextarea label="Exit plan" value={agreementDraft.exit_plan} onChange={exit_plan => setAgreementDraft({ ...agreementDraft, exit_plan })} placeholder="Wholesale, sell after entitlement, build, refinance, hold, pass criteria..." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }} className="two-col">
                  <div>
                    <label style={label}>Approval threshold</label>
                    <textarea rows={3} value={agreementDraft.approval_threshold ?? ""} onChange={e => setAgreementDraft({ ...agreementDraft, approval_threshold: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Go / no-go deadline</label>
                    <input type="text" value={agreementDraft.go_no_go_deadline ?? ""} onChange={e => setAgreementDraft({ ...agreementDraft, go_no_go_deadline: e.target.value })} placeholder="e.g. 2026-05-15 or end of diligence period" />
                    <label style={{ ...label, marginTop: 10 }}>Notes</label>
                    <input type="text" value={agreementDraft.notes ?? ""} onChange={e => setAgreementDraft({ ...agreementDraft, notes: e.target.value })} placeholder="Attorney, lender, or group notes" />
                  </div>
                </div>
                {agreement && (
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
                    Last saved by {agreement.updated_by || agreement.created_by || "unknown"} · {formatDate(agreement.updated_at)}
                  </p>
                )}
              </section>
              )}

              {activeDealTab === "budget" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h2 style={sectionTitle}>Budget versions</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 760 }}>
                      Create a new budget version when the deal budget changes. Approved versions become the baseline for later variance, overrun, exit, and closeout decisions.
                    </p>
                  </div>
                  <button onClick={handleSaveBudget} disabled={budgetSaving} style={{ ...primaryButton, opacity: budgetSaving ? 0.6 : 1 }}>
                    {budgetSaving ? "Saving..." : "Save Budget Version"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }} className="number-grid">
                  <Stat label="Current version" value={latestBudget ? `v${latestBudget.version_number}` : "None"} />
                  <Stat label="Approved budget" value={money(latestBudget?.total_budget ?? null)} />
                  <Stat label="Actuals" value={money(latestBudget?.total_actual ?? null)} />
                  <Stat label="Variance" value={money(latestBudget?.variance_amount ?? null)} />
                </div>

                {budgetVersions.length > 0 && (
                  <div style={{ ...subPanel, marginBottom: 12 }}>
                    <p style={eyebrowSmall}>Saved versions</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {budgetVersions.map(version => {
                        const rows = budgetLines.filter(line => line.budget_version_id === version.id);
                        return (
                          <div key={version.id} style={{ borderTop: "1px solid var(--fog)", paddingTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>v{version.version_number}: {version.label}</strong>
                              <span style={version.status === "approved" || version.status === "final-actuals" ? hotPill : pill}>{statusLabel(version.status)}</span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                              {DEAL_STAGE_LABELS[version.stage]} · {money(version.total_budget)} budget · {money(version.total_actual)} actual · {rows.length} line{rows.length === 1 ? "" : "s"}
                            </p>
                            {version.change_summary && <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.72, marginTop: 4 }}>{version.change_summary}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ ...subPanel, marginBottom: 12 }}>
                  <p style={eyebrowSmall}>New or revised budget</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr", gap: 10, marginTop: 10 }} className="three-col">
                    <div>
                      <label style={label}>Label</label>
                      <input type="text" value={budgetDraft.label} onChange={e => setBudgetDraft({ ...budgetDraft, label: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Stage</label>
                      <select value={budgetDraft.stage} onChange={e => setBudgetDraft({ ...budgetDraft, stage: e.target.value as DealStage })}>
                        {DEAL_STAGES.map(stage => <option key={stage} value={stage}>{DEAL_STAGE_LABELS[stage]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Status</label>
                      <select value={budgetDraft.status ?? "draft"} onChange={e => setBudgetDraft({ ...budgetDraft, status: e.target.value as DealBudgetStatus })}>
                        {BUDGET_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="two-col">
                    <div>
                      <label style={label}>Change summary</label>
                      <textarea rows={3} value={budgetDraft.change_summary ?? ""} onChange={e => setBudgetDraft({ ...budgetDraft, change_summary: e.target.value })} placeholder="What changed from the prior budget and why?" />
                    </div>
                    <div>
                      <label style={label}>Source of funds</label>
                      <textarea rows={3} value={budgetDraft.source_of_funds ?? ""} onChange={e => setBudgetDraft({ ...budgetDraft, source_of_funds: e.target.value })} placeholder="Operating cash, member capital, credit line, lender draw..." />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginTop: 10, alignItems: "end" }} className="three-col">
                    <NumberField label="Variance vote cap $" value={budgetDraft.material_variance_threshold_amount} onChange={v => setBudgetDraft({ ...budgetDraft, material_variance_threshold_amount: v })} />
                    <NumberField label="Variance vote cap %" value={budgetDraft.material_variance_threshold_percent} onChange={v => setBudgetDraft({ ...budgetDraft, material_variance_threshold_percent: v })} />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink)", minHeight: 38 }}>
                      <input type="checkbox" checked={Boolean(budgetDraft.vote_required)} onChange={e => setBudgetDraft({ ...budgetDraft, vote_required: e.target.checked })} />
                      Vote required
                    </label>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {budgetLineDrafts.map((line, index) => (
                    <div key={index} style={{ display: "grid", gridTemplateColumns: "0.9fr 1.4fr repeat(3, 0.75fr) 34px", gap: 8, alignItems: "end" }} className="budget-line-row">
                      <div>
                        <label style={label}>Category</label>
                        <input type="text" value={line.category} onChange={e => updateBudgetLineDraft(index, { category: e.target.value })} />
                      </div>
                      <div>
                        <label style={label}>Description</label>
                        <input type="text" value={line.description} onChange={e => updateBudgetLineDraft(index, { description: e.target.value })} />
                      </div>
                      <NumberField label="Estimate" value={line.estimated_amount} onChange={v => updateBudgetLineDraft(index, { estimated_amount: v })} />
                      <NumberField label="Approved" value={line.approved_amount} onChange={v => updateBudgetLineDraft(index, { approved_amount: v })} />
                      <NumberField label="Actual" value={line.actual_amount} onChange={v => updateBudgetLineDraft(index, { actual_amount: v })} />
                      <button type="button" onClick={() => setBudgetLineDrafts(prev => prev.filter((_, idx) => idx !== index))} style={{ ...secondaryButton, padding: "9px 8px" }}>X</button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setBudgetLineDrafts(prev => [...prev, { category: "", description: "", estimated_amount: null, approved_amount: null, actual_amount: null, source_of_funds: "", sort_order: (prev.length + 1) * 10 }])}
                  style={{ ...secondaryButton, marginTop: 10 }}
                >
                  Add Line
                </button>
              </section>
              )}

              {activeDealTab === "decisions" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h2 style={sectionTitle}>Formal decisions</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 780 }}>
                      Use this for the notice contents Aaliyah asked about: what decision is requested, who is affected, dollar impact, threshold, deadline, non-response rule, personal risk, and supporting docs.
                    </p>
                  </div>
                  <button onClick={handleSaveDecision} disabled={decisionSaving} style={{ ...primaryButton, opacity: decisionSaving ? 0.6 : 1 }}>
                    {decisionSaving ? "Opening..." : "Open Decision"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }} className="number-grid">
                  <Stat label="Open decisions" value={String(openDecisions.length)} />
                  <Stat label="Approved decisions" value={String(approvedDecisions)} />
                  <Stat label="Commitments approved" value={String(approvedCommitments)} />
                  <Stat label="Commitments pending" value={String(pendingCommitments)} />
                </div>

                <div style={{ ...subPanel, marginBottom: 12 }}>
                  <p style={eyebrowSmall}>Decision notice</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.75fr", gap: 10, marginTop: 10 }} className="three-col">
                    <div>
                      <label style={label}>Decision type</label>
                      <select value={decisionDraft.decision_type} onChange={e => setDecisionDraft({ ...decisionDraft, decision_type: e.target.value as DealDecisionType })}>
                        {DECISION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Stage</label>
                      <select value={decisionDraft.stage} onChange={e => setDecisionDraft({ ...decisionDraft, stage: e.target.value as DealStage })}>
                        {DEAL_STAGES.map(stage => <option key={stage} value={stage}>{DEAL_STAGE_LABELS[stage]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Status</label>
                      <select value={decisionDraft.status ?? "open"} onChange={e => setDecisionDraft({ ...decisionDraft, status: e.target.value as DealDecisionStatus })}>
                        {DECISION_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="two-col">
                    <div>
                      <label style={label}>Decision requested</label>
                      <textarea rows={3} value={decisionDraft.decision_requested} onChange={e => setDecisionDraft({ ...decisionDraft, decision_requested: e.target.value })} placeholder="Approve offer authority up to $X, approve revised budget, approve exit..." />
                    </div>
                    <div>
                      <label style={label}>Affected deal or company matter</label>
                      <textarea rows={3} value={decisionDraft.affected_matter} onChange={e => setDecisionDraft({ ...decisionDraft, affected_matter: e.target.value })} placeholder="Deal, property, LLC budget, member credit, guarantee, loan..." />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }} className="number-grid">
                    <NumberField label="Dollar impact" value={decisionDraft.dollar_impact} onChange={v => setDecisionDraft({ ...decisionDraft, dollar_impact: v })} />
                    <div>
                      <label style={label}>Source of funds</label>
                      <input type="text" value={decisionDraft.source_of_funds ?? ""} onChange={e => setDecisionDraft({ ...decisionDraft, source_of_funds: e.target.value })} />
                    </div>
                    <NumberField label="Required approvals" value={decisionDraft.required_approvals ?? null} onChange={v => setDecisionDraft({ ...decisionDraft, required_approvals: v })} />
                    <div>
                      <label style={label}>Response deadline</label>
                      <input type="date" value={decisionDraft.response_deadline?.slice(0, 10) ?? ""} onChange={e => setDecisionDraft({ ...decisionDraft, response_deadline: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="two-col">
                    <div>
                      <label style={label}>Required approval threshold</label>
                      <input type="text" value={decisionDraft.approval_threshold ?? ""} onChange={e => setDecisionDraft({ ...decisionDraft, approval_threshold: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Related budget</label>
                      <select value={decisionDraft.related_budget_version_id ?? ""} onChange={e => setDecisionDraft({ ...decisionDraft, related_budget_version_id: e.target.value || null })}>
                        <option value="">None</option>
                        {budgetVersions.map(version => <option key={version.id} value={version.id}>v{version.version_number}: {version.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Consequence of non-response</label>
                      <textarea rows={3} value={decisionDraft.non_response_consequence ?? ""} onChange={e => setDecisionDraft({ ...decisionDraft, non_response_consequence: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Cash, credit, guarantee, loan, or personal risk affected</label>
                      <textarea rows={3} value={decisionDraft.personal_risk_summary ?? ""} onChange={e => setDecisionDraft({ ...decisionDraft, personal_risk_summary: e.target.value })} placeholder="State whether any member cash, credit, guarantee, loan, or personal risk is affected." />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={label}>Supporting documents</label>
                    <textarea
                      rows={3}
                      value={(decisionDraft.supporting_documents ?? []).join("\n")}
                      onChange={e => setDecisionDraft({ ...decisionDraft, supporting_documents: e.target.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean) })}
                      placeholder="Deal Approval Memo, budget version, lender term sheet, inspection report, exit memo..."
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
                  <div style={subPanel}>
                    <p style={eyebrowSmall}>Decision log</p>
                    {decisions.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>No formal decisions opened yet.</p>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                      {decisions.map(decision => {
                        const votesForDecision = decisionVotes.filter(vote => vote.decision_id === decision.id);
                        const myDecisionVote = votesForDecision.find(vote => vote.member_name === user);
                        return (
                          <div key={decision.id} style={{ borderTop: "1px solid var(--fog)", paddingTop: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 13, color: "var(--obsidian)" }}>{decision.decision_requested}</strong>
                              <span style={decision.status === "approved" ? hotPill : pill}>{statusLabel(decision.status)}</span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                              {DEAL_STAGE_LABELS[decision.stage]} · {money(decision.dollar_impact ?? null)} · {votesForDecision.filter(v => v.vote === "approve").length}/{decision.required_approvals} approvals
                            </p>
                            <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.72, marginTop: 5 }}>{decision.affected_matter}</p>
                            <textarea rows={2} value={decisionVoteNote} onChange={e => setDecisionVoteNote(e.target.value)} placeholder={`Optional vote note${myDecisionVote ? ` · current vote: ${statusLabel(myDecisionVote.vote)}` : ""}`} style={{ marginTop: 8 }} />
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              {DECISION_VOTES.map(option => (
                                <button key={option.value} type="button" onClick={() => handleDecisionVote(decision, option.value)} style={option.value === "approve" ? primaryButton : secondaryButton}>
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={subPanel}>
                    <p style={eyebrowSmall}>Affected-member commitments</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }} className="two-col">
                      <div>
                        <label style={label}>Member</label>
                        <select value={commitmentDraft.member_name} onChange={e => setCommitmentDraft({ ...commitmentDraft, member_name: e.target.value })}>
                          <option value="">Select member</option>
                          {activeMemberNames.map(member => <option key={member} value={member}>{member}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={label}>Type</label>
                        <select value={commitmentDraft.commitment_type} onChange={e => setCommitmentDraft({ ...commitmentDraft, commitment_type: e.target.value as DealCommitmentType })}>
                          {COMMITMENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                      </div>
                      <NumberField label="Amount" value={commitmentDraft.amount} onChange={v => setCommitmentDraft({ ...commitmentDraft, amount: v })} />
                      <div>
                        <label style={label}>Source of funds</label>
                        <input type="text" value={commitmentDraft.source_of_funds ?? ""} onChange={e => setCommitmentDraft({ ...commitmentDraft, source_of_funds: e.target.value })} />
                      </div>
                    </div>
                    <label style={{ ...label, marginTop: 8 }}>Description</label>
                    <textarea rows={3} value={commitmentDraft.description ?? ""} onChange={e => setCommitmentDraft({ ...commitmentDraft, description: e.target.value })} placeholder="Example: Aaliyah $5,000 credit plus $45,000 cash for this deal." />
                    <button type="button" onClick={handleSaveCommitment} disabled={commitmentSaving} style={{ ...primaryButton, marginTop: 8, opacity: commitmentSaving ? 0.6 : 1 }}>
                      {commitmentSaving ? "Saving..." : "Add Commitment"}
                    </button>
                    <textarea rows={2} value={commitmentConsentNote} onChange={e => setCommitmentConsentNote(e.target.value)} placeholder="Optional consent note" style={{ marginTop: 10 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {commitments.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>No affected-member commitments recorded.</p>}
                      {commitments.map(commitment => (
                        <div key={commitment.id} style={{ borderTop: "1px solid var(--fog)", paddingTop: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 13, color: "var(--obsidian)" }}>{commitment.member_name} · {statusLabel(commitment.commitment_type)}</strong>
                            <span style={commitment.consent_status === "approved" ? hotPill : pill}>{statusLabel(commitment.consent_status)}</span>
                          </div>
                          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{money(commitment.amount ?? null)} · {commitment.description || "No description"}</p>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                            <button type="button" onClick={() => handleCommitmentConsent(commitment, "approved")} style={primaryButton}>Approve</button>
                            <button type="button" onClick={() => handleCommitmentConsent(commitment, "rejected")} style={secondaryButton}>Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              )}

              {activeDealTab === "vote" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h2 style={sectionTitle}>Rapid decision</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>
                      {votes.length} response{votes.length === 1 ? "" : "s"} · your vote: {myVote ? statusLabel(myVote.vote) : "not yet"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={quorumReached ? hotPill : pill}>{decisionStatus}</span>
                    {voteCounts.map(v => <span key={v.value} style={pill}>{v.label}: {v.count}</span>)}
                  </div>
                </div>
                <div style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.72 }}>
                    Quorum rule: {quorumNeeded} of {activeMemberNames.length} members must respond. Offer authority is reached when {quorumNeeded} members vote Make Offer or Counter.
                  </p>
                </div>
                <textarea rows={2} value={voteNote} onChange={e => setVoteNote(e.target.value)} placeholder="Optional note for the group" />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {VOTES.map(v => (
                    <button key={v.value} onClick={() => handleVote(v.value)} style={v.value === "make-offer" ? primaryButton : secondaryButton}>
                      {v.label}
                    </button>
                  ))}
                </div>
                {votes.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                    {votes.map(v => (
                      <div key={v.id} style={{ fontSize: 12, color: "var(--ink)", borderTop: "1px solid var(--fog)", paddingTop: 8 }}>
                        <strong>{v.member_name}</strong> voted <strong>{statusLabel(v.vote)}</strong>
                        {v.note ? <span style={{ color: "var(--muted)" }}> · {v.note}</span> : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              )}

              {activeDealTab === "diligence" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h2 style={sectionTitle}>Due diligence checklist</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>
                      {cleared}/{checklist.length} cleared · {blocked} blocked
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {checklist.map(item => (
                    <div key={item.id} style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 150px",
                      gap: 12,
                      background: "var(--surface)",
                      border: item.status === "blocked" ? "1px solid var(--obsidian)" : "1px solid var(--fog)",
                      borderRadius: 8,
                      padding: 12,
                    }} className="checklist-row">
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)", marginBottom: 4 }}>{item.title}</p>
                        <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.68 }}>{item.why_it_matters}</p>
                        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>Evidence: {item.required_evidence}</p>
                      </div>
                      <select value={item.status} onChange={e => handleChecklistStatus(item, e.target.value as ChecklistStatus)}>
                        {CHECKLIST_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
              )}

              {activeDealTab === "exit" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h2 style={sectionTitle}>Exit memo</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 760 }}>
                      Record the proposed sale, hold, refinance, assignment, or abandonment decision with net proceeds, debt payoff, reserves, distributions, risks, and alternatives.
                    </p>
                  </div>
                  <button onClick={handleSaveExitMemo} disabled={exitMemoSaving} style={{ ...primaryButton, opacity: exitMemoSaving ? 0.6 : 1 }}>
                    {exitMemoSaving ? "Saving..." : "Save Exit Memo"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }} className="three-col">
                  <div>
                    <label style={label}>Status</label>
                    <select value={exitMemoDraft.status ?? "draft"} onChange={e => setExitMemoDraft({ ...exitMemoDraft, status: e.target.value as DealExitMemoStatus })}>
                      {EXIT_MEMO_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Linked decision</label>
                    <select value={exitMemoDraft.decision_id ?? ""} onChange={e => setExitMemoDraft({ ...exitMemoDraft, decision_id: e.target.value || null })}>
                      <option value="">None</option>
                      {decisions.map(decision => <option key={decision.id} value={decision.id}>{decision.decision_requested.slice(0, 70)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Budget baseline</label>
                    <input type="text" value={latestBudget ? `v${latestBudget.version_number}: ${money(latestBudget.total_budget)} budget / ${money(latestBudget.total_actual)} actual` : "No budget version"} readOnly />
                  </div>
                </div>
                <div>
                  <label style={label}>Recommended exit</label>
                  <textarea rows={3} value={exitMemoDraft.recommended_exit} onChange={e => setExitMemoDraft({ ...exitMemoDraft, recommended_exit: e.target.value })} placeholder="Sell, hold, refinance, assign, abandon, or another exit recommendation." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 10 }} className="agreement-number-grid">
                  <NumberField label="Debt payoff" value={exitMemoDraft.debt_payoff} onChange={v => setExitMemoDraft({ ...exitMemoDraft, debt_payoff: v })} />
                  <NumberField label="Closing costs" value={exitMemoDraft.closing_costs} onChange={v => setExitMemoDraft({ ...exitMemoDraft, closing_costs: v })} />
                  <NumberField label="Net proceeds" value={exitMemoDraft.expected_net_proceeds} onChange={v => setExitMemoDraft({ ...exitMemoDraft, expected_net_proceeds: v })} />
                  <NumberField label="Return capital" value={exitMemoDraft.return_of_capital} onChange={v => setExitMemoDraft({ ...exitMemoDraft, return_of_capital: v })} />
                  <NumberField label="Reserves" value={exitMemoDraft.reserves_to_hold_back} onChange={v => setExitMemoDraft({ ...exitMemoDraft, reserves_to_hold_back: v })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="two-col">
                  <AgreementTextarea label="Current budget to actual" value={exitMemoDraft.current_budget_to_actual} onChange={current_budget_to_actual => setExitMemoDraft({ ...exitMemoDraft, current_budget_to_actual })} placeholder="Summarize approved budget, actuals, and material variances." />
                  <AgreementTextarea label="Estimated member distributions" value={exitMemoDraft.estimated_member_distributions} onChange={estimated_member_distributions => setExitMemoDraft({ ...exitMemoDraft, estimated_member_distributions })} placeholder="Return of capital, preferred return, guarantee premium, profit distribution." />
                  <AgreementTextarea label="Risks" value={exitMemoDraft.risks} onChange={risks => setExitMemoDraft({ ...exitMemoDraft, risks })} placeholder="Market, title, lender, buyer, tax, timing, or member risk." />
                  <AgreementTextarea label="Alternatives considered" value={exitMemoDraft.alternatives_considered} onChange={alternatives_considered => setExitMemoDraft({ ...exitMemoDraft, alternatives_considered })} placeholder="Hold, refinance, price reduction, alternate buyer, pass, etc." />
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={label}>Supporting documents</label>
                  <textarea
                    rows={3}
                    value={(exitMemoDraft.supporting_documents ?? []).join("\n")}
                    onChange={e => setExitMemoDraft({ ...exitMemoDraft, supporting_documents: e.target.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean) })}
                    placeholder="Buyer offer, settlement estimate, refinance term sheet, final budget, listing package..."
                  />
                </div>

                {exitMemos.length > 0 && (
                  <div style={{ ...subPanel, marginTop: 12 }}>
                    <p style={eyebrowSmall}>Saved exit memos</p>
                    {exitMemos.map(memo => (
                      <div key={memo.id} style={{ borderTop: "1px solid var(--fog)", paddingTop: 8, marginTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 13, color: "var(--obsidian)" }}>{memo.recommended_exit}</strong>
                          <span style={memo.status === "approved" ? hotPill : pill}>{statusLabel(memo.status)}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                          Net {money(memo.expected_net_proceeds ?? null)} · Debt {money(memo.debt_payoff ?? null)} · Saved {formatDate(memo.updated_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              )}

              {activeDealTab === "closeout" && (
              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <h2 style={sectionTitle}>Closeout packet</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 760 }}>
                      Finalize actuals, settlement or refinance records, profit/loss, capital return, distributions, lessons learned, and tax follow-ups.
                    </p>
                  </div>
                  <button onClick={handleSaveCloseout} disabled={closeoutSaving} style={{ ...primaryButton, opacity: closeoutSaving ? 0.6 : 1 }}>
                    {closeoutSaving ? "Saving..." : "Save Closeout"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }} className="three-col">
                  <div>
                    <label style={label}>Status</label>
                    <select value={closeoutDraft.status ?? "draft"} onChange={e => setCloseoutDraft({ ...closeoutDraft, status: e.target.value as DealCloseoutStatus })}>
                      {CLOSEOUT_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Linked exit memo</label>
                    <select value={closeoutDraft.exit_memo_id ?? ""} onChange={e => setCloseoutDraft({ ...closeoutDraft, exit_memo_id: e.target.value || null })}>
                      <option value="">None</option>
                      {exitMemos.map(memo => <option key={memo.id} value={memo.id}>{memo.recommended_exit.slice(0, 70)}</option>)}
                    </select>
                  </div>
                  <NumberField label="Final profit/loss" value={closeoutDraft.final_profit_loss} onChange={v => setCloseoutDraft({ ...closeoutDraft, final_profit_loss: v })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="two-col">
                  <div>
                    <label style={label}>Settlement statement URL</label>
                    <input type="text" value={closeoutDraft.settlement_statement_url ?? ""} onChange={e => setCloseoutDraft({ ...closeoutDraft, settlement_statement_url: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Refinance statement URL</label>
                    <input type="text" value={closeoutDraft.refinance_statement_url ?? ""} onChange={e => setCloseoutDraft({ ...closeoutDraft, refinance_statement_url: e.target.value })} />
                  </div>
                  <AgreementTextarea label="Final budget variance" value={closeoutDraft.final_budget_variance} onChange={final_budget_variance => setCloseoutDraft({ ...closeoutDraft, final_budget_variance })} placeholder="Compare final actuals to approved budget and explain material variances." />
                  <AgreementTextarea label="Capital return" value={closeoutDraft.capital_return} onChange={capital_return => setCloseoutDraft({ ...closeoutDraft, capital_return })} placeholder="How and when member capital is returned." />
                  <AgreementTextarea label="Distribution calculation" value={closeoutDraft.distribution_calculation} onChange={distribution_calculation => setCloseoutDraft({ ...closeoutDraft, distribution_calculation })} placeholder="Profit/loss split, preferred return, guarantee premium, fees." />
                  <AgreementTextarea label="Tax follow-ups" value={closeoutDraft.tax_followups} onChange={tax_followups => setCloseoutDraft({ ...closeoutDraft, tax_followups })} placeholder="1099/K-1/CPA/timing follow-ups." />
                </div>
                <div style={{ marginTop: 10 }}>
                  <AgreementTextarea label="Lessons learned" value={closeoutDraft.lessons_learned} onChange={lessons_learned => setCloseoutDraft({ ...closeoutDraft, lessons_learned })} placeholder="What should Meridian repeat, change, or avoid on future deals?" />
                </div>

                {closeoutPackets.length > 0 && (
                  <div style={{ ...subPanel, marginTop: 12 }}>
                    <p style={eyebrowSmall}>Saved closeouts</p>
                    {closeoutPackets.map(packet => (
                      <div key={packet.id} style={{ borderTop: "1px solid var(--fog)", paddingTop: 8, marginTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 13, color: "var(--obsidian)" }}>{money(packet.final_profit_loss ?? null)} final profit/loss</strong>
                          <span style={packet.status === "final" ? hotPill : pill}>{statusLabel(packet.status)}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Saved {formatDate(packet.updated_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              )}
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        .member-decision-path {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(142px, 1fr));
          gap: 10px;
        }
        .decision-path-card {
          appearance: none;
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 8px;
          cursor: pointer;
          min-height: 132px;
          padding: 14px;
          text-align: left;
        }
        .decision-path-card.active {
          border-color: var(--brass);
          background: rgba(176,137,84,0.10);
        }
        .decision-path-card.done {
          border-color: rgba(176,137,84,0.42);
        }
        .decision-path-card.active-tab {
          box-shadow: 0 0 0 2px rgba(176,137,84,0.18);
        }
        .decision-path-card span {
          color: var(--brass);
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .decision-path-card strong {
          color: var(--obsidian);
          display: block;
          font-size: 14px;
          line-height: 1.28;
          margin-bottom: 8px;
        }
        .decision-path-card p {
          color: var(--ink);
          font-size: 12px;
          line-height: 1.42;
          opacity: 0.68;
        }
        .member-next-action {
          align-items: center;
          background: var(--obsidian);
          border: 1px solid rgba(176,137,84,0.28);
          border-radius: 8px;
          box-shadow: 0 18px 42px rgba(17,14,10,0.12);
          color: var(--bone);
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto;
          padding: 16px;
        }
        .member-next-action.warn {
          background: linear-gradient(135deg, var(--obsidian), #2b2115);
        }
        .member-next-action.hot {
          background: linear-gradient(135deg, #16120d, #3a2810);
        }
        .member-next-action.success {
          background: linear-gradient(135deg, #11160f, #25321d);
        }
        .member-next-action p {
          color: var(--brass);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          margin: 0 0 6px;
          text-transform: uppercase;
        }
        .member-next-action h2 {
          color: var(--bone);
          font-family: ${DISPLAY_FONT};
          font-size: 25px;
          font-weight: 500;
          line-height: 1.08;
          margin: 0;
        }
        .member-next-action span {
          color: rgba(247,242,232,0.72);
          display: block;
          font-size: 13px;
          line-height: 1.45;
          margin-top: 7px;
        }
        .member-next-action > div:last-child {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .member-next-action button {
          border: 1px solid rgba(247,242,232,0.18);
          border-radius: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          min-height: 40px;
          padding: 10px 13px;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .member-next-action button:first-child {
          background: var(--brass);
          border-color: var(--brass);
          color: var(--obsidian);
        }
        .member-next-action button:last-child {
          background: rgba(247,242,232,0.08);
          color: var(--bone);
        }
        .member-next-action button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }
        .deal-detail-tabs {
          position: sticky;
          top: 78px;
          z-index: 8;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 0 0 10px;
          margin-bottom: 4px;
          background: linear-gradient(180deg, var(--bone) 0%, rgba(237,230,214,0.92) 74%, rgba(237,230,214,0) 100%);
          scrollbar-width: thin;
        }
        @media (max-width: 900px) {
          .deal-workspace,
          .deal-form-grid,
          .member-decision-path {
            grid-template-columns: 1fr !important;
          }
          .member-next-action {
            grid-template-columns: 1fr !important;
          }
          .member-next-action > div:last-child {
            justify-content: flex-start;
          }
          .deal-detail-tabs {
            position: static !important;
          }
        }
        @media (max-width: 680px) {
          .deals-root { padding-top: 28px !important; }
          .two-col,
          .three-col,
          .number-grid,
          .agreement-number-grid,
          .budget-line-row,
          .checklist-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function DealDetailTabButton({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 40,
        border: active ? "1px solid var(--obsidian)" : "1px solid var(--fog)",
        borderRadius: 999,
        background: active ? "var(--obsidian)" : "rgba(255,255,255,0.74)",
        color: active ? "var(--bone)" : "var(--ink)",
        padding: "8px 12px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
    >
      {label}
      {typeof count === "number" && (
        <span
          style={{
            minWidth: 22,
            height: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: active ? "rgba(237,230,214,0.16)" : "var(--bone)",
            color: active ? "var(--bone)" : "var(--muted)",
            fontSize: 10,
            letterSpacing: 0,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function NumberField({ label: labelText, value, onChange }: { label: string; value: number | null | undefined; onChange: (value: number | null) => void }) {
  return (
    <div>
      <label style={label}>{labelText}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value ?? ""}
        onChange={e => onChange(toNumber(e.target.value))}
        placeholder="0"
      />
    </div>
  );
}

function AgreementTextarea({ label: labelText, value, onChange, placeholder }: { label: string; value?: string | null; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <label style={label}>{labelText}</label>
      <textarea
        rows={4}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function AnalysisCard({ analysis, compact = true }: { analysis: ReturnType<typeof calculateDealAnalysis>; compact?: boolean }) {
  return (
    <div style={subPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <p style={eyebrowSmall}>System analysis</p>
          <h3 style={{ fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: compact ? 24 : 28, fontWeight: 500 }}>
            {analysis.recommendation}
          </h3>
        </div>
        <span style={pill}>Confidence: {analysis.confidence}</span>
      </div>
      <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.74, lineHeight: 1.55, marginBottom: 10 }}>
        {analysis.summary}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 10 }}>
        {analysis.metrics.map(m => (
          <div key={m.label} style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 10 }}>
            <p style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{m.label}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: m.tone === "good" ? "var(--brass)" : "var(--obsidian)" }}>{m.value}</p>
          </div>
        ))}
      </div>
      {(analysis.riskFlags.length > 0 || analysis.missingInfo.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }} className="two-col">
          <MiniList title="Risk flags" items={analysis.riskFlags} empty="No major flags yet." />
          <MiniList title="Missing info" items={analysis.missingInfo} empty="Core fields present." />
        </div>
      )}
    </div>
  );
}

function MiniList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p style={{ ...eyebrowSmall, marginBottom: 4 }}>{title}</p>
      {(items.length ? items : [empty]).map(i => (
        <p key={i} style={{ fontSize: 12, color: "var(--ink)", opacity: items.length ? 0.72 : 0.5, marginBottom: 3 }}>
          {i}
        </p>
      ))}
    </div>
  );
}

function Stat({ label: labelText, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
      <p style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{labelText}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: "var(--obsidian)" }}>{value}</p>
    </div>
  );
}

function HandoffMetric({ label: labelText, value }: { label: string; value: string }) {
  return (
    <div style={handoffMetric}>
      <p style={handoffLabel}>{labelText}</p>
      <p style={{ color: "var(--bone)", fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{value}</p>
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "var(--brass)",
  fontWeight: 600,
  marginBottom: 8,
};

const eyebrowSmall: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--brass)",
  fontWeight: 700,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--brass)",
  marginBottom: 6,
};

const miniLabel: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginBottom: 5,
};

const panel: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 12,
  padding: 18,
  marginBottom: 18,
};

const subPanel: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 10,
  padding: 14,
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const primaryButton: React.CSSProperties = {
  background: "var(--brass)",
  color: "var(--obsidian)",
  border: "none",
  borderRadius: 6,
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--brass)",
  border: "1px solid var(--brass)",
  borderRadius: 6,
  padding: "9px 14px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  padding: "3px 8px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const pillLarge: React.CSSProperties = {
  ...pill,
  padding: "5px 10px",
};

const comingSoonPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  padding: "4px 9px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginTop: 10,
};

const hotPill: React.CSSProperties = {
  ...pill,
  color: "var(--obsidian)",
  borderColor: "var(--brass)",
  background: "rgba(176,137,84,0.2)",
};

const hotPillLarge: React.CSSProperties = {
  ...hotPill,
  padding: "5px 10px",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  color: "var(--obsidian)",
  fontSize: 24,
  fontWeight: 500,
};

const preStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  color: "var(--ink)",
  opacity: 0.78,
  whiteSpace: "pre-wrap",
  lineHeight: 1.55,
  margin: 0,
};

const handoffPanel: React.CSSProperties = {
  background: "linear-gradient(180deg, #1b1712 0%, #2c241a 100%)",
  border: "1px solid rgba(201,168,120,0.36)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 14,
  boxShadow: "0 18px 34px rgba(20,17,13,0.16)",
};

const handoffMetric: React.CSSProperties = {
  border: "1px solid rgba(237,230,214,0.16)",
  borderRadius: 8,
  padding: 10,
  background: "rgba(237,230,214,0.06)",
};

const handoffLabel: React.CSSProperties = {
  color: "rgba(237,230,214,0.58)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginBottom: 5,
};

const handoffText: React.CSSProperties = {
  color: "rgba(237,230,214,0.82)",
  fontSize: 13,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
};

const handoffPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid rgba(201,168,120,0.52)",
  borderRadius: 999,
  color: "var(--brass)",
  background: "rgba(201,168,120,0.1)",
  padding: "5px 9px",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};
