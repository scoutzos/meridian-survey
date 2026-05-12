"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calculateDealAnalysis,
  createDeal,
  createDealActivity,
  createDealAttachment,
  fetchDealAttachments,
  fetchDealChecklist,
  fetchDeals,
  generateDueDiligenceChecklist,
  updateChecklistItemStatus,
  updateDeal,
  type ChecklistStatus,
  type Deal,
  type DealAttachment,
  type DealAttachmentType,
  type DealInput,
  type DispositionStatus,
  type DealPropertyType,
  type DealReviewIntent,
  type DealStatus,
  type DealUrgency,
  type DealDueDiligenceItem,
} from "@/lib/deals";
import {
  createActionItem,
  fetchActionItems,
  isVaTask,
  updateActionItemStatus,
  type ActionItem,
  type ActionItemStatus,
} from "@/lib/action-items";
import { createNotification } from "@/lib/operations";
import {
  createImportedLandLeadActivity,
  fetchImportedLandLeadActivities,
  fetchLandLeadBatches,
  fetchImportedLandLeads,
  leadToDealDraft,
  previewLandLeadsCsv,
  updateLandLeadBatch,
  updateImportedLandLeadStatus,
  type ImportedLandLeadActivity,
  type ImportedLandLead,
  type LandLeadBatch,
  type LandLeadImportPreview,
} from "@/lib/land-leads";
import { attachCommunicationEventToDeal, attachCommunicationEventToLead, fetchCommunicationEvents, type CommunicationEvent } from "@/lib/communications";
import {
  createVaDailyBrief,
  fetchVaDailyBriefs,
  updateVaDailyBrief,
  type VaDailyBrief,
  type VaDailyBriefInput,
} from "@/lib/va-briefs";
import {
  clockInVa,
  clockOutVa,
  createVaTimeChangeRequest,
  currentShiftMinutes,
  fetchVaTimeChangeRequests,
  fetchOpenVaTimeEntry,
  fetchVaTimeEntries,
  formatVaDateTime,
  formatDuration,
  fromVaDateTimeInput,
  toVaDateTimeInput,
  vaDateKey,
  type VaTimeEntry,
  type VaTimeChangeRequest,
  type VaTimeChangeRequestType,
} from "@/lib/va-time";
import ConversationPanel from "@/components/ConversationPanel";
import { labelForStatus } from "@/lib/status-map";
import { getLeadNextAction, type WorkflowTone } from "@/lib/workflow-actions";
import OperatingHeader from "@/components/OperatingHeader";
import BulkSmsDrawer from "@/components/BulkSmsDrawer";
import TwilioPhoneDock from "@/components/TwilioPhoneDock";
import TwilioCallButton from "@/components/TwilioCallButton";
import { categorizeForBulkSms, checkLeadCallCompliance, checkLeadSmsCompliance } from "@/lib/bulk-sms";
import { fetchActiveMemberNames } from "@/lib/members";

const DISPLAY_FONT = "var(--font-display)";

const PROPERTY_TYPES: Array<{ value: DealPropertyType; label: string }> = [
  { value: "land", label: "Land" },
  { value: "house", label: "House / Rehab" },
  { value: "rental", label: "Rental Hold" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];

const URGENCY: Array<{ value: DealUrgency; label: string }> = [
  { value: "routine", label: "Routine" },
  { value: "time-sensitive", label: "Time Sensitive" },
  { value: "hot", label: "Hot" },
];

const STATUSES: Array<{ value: DealStatus; label: string }> = [
  { value: "lead", label: "Draft Lead" },
  { value: "under-review", label: "Submitted For Review" },
  { value: "offer-made", label: "Offer Made" },
  { value: "under-contract", label: "Under Contract" },
  { value: "due-diligence", label: "Due Diligence" },
  { value: "passed", label: "Passed" },
];

const CHECKLIST_STATUSES: Array<{ value: ChecklistStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in-review", label: "In Review" },
  { value: "cleared", label: "Cleared" },
  { value: "blocked", label: "Blocked" },
  { value: "not-applicable", label: "N/A" },
];

const LEAD_TEMPERATURES: Array<{ value: NonNullable<DealInput["lead_temperature"]>; label: string }> = [
  { value: "cold", label: "Cold" },
  { value: "warm", label: "Warm" },
  { value: "hot", label: "Hot" },
  { value: "dead", label: "Dead" },
];

const ATTACHMENT_TYPES: Array<{ value: DealAttachmentType; label: string }> = [
  { value: "link", label: "Link" },
  { value: "photo", label: "Photo" },
  { value: "document", label: "Document" },
  { value: "map", label: "Map" },
  { value: "county-record", label: "County Record" },
  { value: "comp", label: "Comp" },
  { value: "other", label: "Other" },
];

const REVIEW_INTENTS: Array<{ value: DealReviewIntent; label: string; description: string }> = [
  { value: "needs-info-review", label: "Needs Info Review", description: "Ask members what else they need before this becomes a vote." },
  { value: "ready-for-vote", label: "Ready For Vote", description: "Send a review task and ask members to vote." },
  { value: "blocked-decision", label: "Blocked / Needs Decision", description: "Escalate a blocker or decision before more work continues." },
];

const DISPOSITION_STATUSES: Array<{ value: DispositionStatus; label: string }> = [
  { value: "not-started", label: "Not Started" },
  { value: "exit-strategy-set", label: "Exit Strategy Set" },
  { value: "buyer-list-built", label: "Buyer List Built" },
  { value: "marketed", label: "Marketed" },
  { value: "buyer-interest", label: "Buyer Interest" },
  { value: "offer-received", label: "Offer Received" },
  { value: "buyer-under-contract", label: "Buyer Under Contract" },
  { value: "closing-scheduled", label: "Closing Scheduled" },
  { value: "closed", label: "Closed" },
  { value: "fell-through", label: "Fell Through" },
];

type VaTab = "today" | "outreach" | "lists" | "packet" | "brief";

const TABS: Array<{ value: VaTab; label: string }> = [
  { value: "today", label: "Desk Home" },
  { value: "outreach", label: "Contact Queue" },
  { value: "lists", label: "Lists" },
  { value: "packet", label: "Packets" },
  { value: "brief", label: "Daily Brief" },
];

const IMPORT_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "passed", label: "Passed" },
  { value: "duplicates", label: "Duplicates" },
  { value: "has-phone", label: "Has phone" },
  { value: "no-phone", label: "No phone" },
  { value: "landlocked", label: "Land locked" },
  { value: "flood", label: "Flood" },
  { value: "wetlands", label: "Wetlands" },
  { value: "score-60", label: "Score 60+" },
] as const;

type ImportStatusFilter = typeof IMPORT_STATUS_FILTERS[number]["value"];
type ImportStep = "upload" | "preview" | "importing" | "work";
type ImportStage = "idle" | "previewing" | "creating-batch" | "saving-leads" | "refreshing" | "done";

const LEAD_ACTIVITY_TYPES: Array<{ value: ImportedLandLeadActivity["activity_type"]; label: string }> = [
  { value: "called", label: "Called" },
  { value: "texted", label: "Texted" },
  { value: "emailed", label: "Emailed" },
  { value: "left-voicemail", label: "Left voicemail" },
  { value: "wrong-number", label: "Wrong number" },
  { value: "interested", label: "Interested" },
  { value: "not-interested", label: "Not interested" },
  { value: "follow-up-set", label: "Follow-up set" },
  { value: "note", label: "Note" },
];

type LeadDisposition = "no-answer" | "left-voicemail" | "texted" | "interested" | "wants-offer" | "follow-up" | "wrong-number" | "dnc" | "not-interested";

const LEAD_DISPOSITIONS: Array<{
  value: LeadDisposition;
  label: string;
  activityType: ImportedLandLeadActivity["activity_type"];
  nextStatus: ImportedLandLead["status"];
  briefType: "outreach" | "reply" | "follow-up" | "closed";
}> = [
  { value: "no-answer", label: "No Answer", activityType: "called", nextStatus: "contacted", briefType: "outreach" },
  { value: "left-voicemail", label: "Left Voicemail", activityType: "left-voicemail", nextStatus: "contacted", briefType: "outreach" },
  { value: "texted", label: "Texted", activityType: "texted", nextStatus: "contacted", briefType: "outreach" },
  { value: "interested", label: "Interested", activityType: "interested", nextStatus: "interested", briefType: "reply" },
  { value: "wants-offer", label: "Wants Offer", activityType: "interested", nextStatus: "interested", briefType: "reply" },
  { value: "follow-up", label: "Follow-Up Set", activityType: "follow-up-set", nextStatus: "contacted", briefType: "follow-up" },
  { value: "wrong-number", label: "Wrong Number", activityType: "wrong-number", nextStatus: "passed", briefType: "closed" },
  { value: "dnc", label: "DNC / Opt Out", activityType: "not-interested", nextStatus: "passed", briefType: "closed" },
  { value: "not-interested", label: "Not Interested", activityType: "not-interested", nextStatus: "passed", briefType: "closed" },
];

const EMPTY_DRAFT: DealInput & { linksText: string } = {
  title: "",
  source: "VA intake",
  property_type: "land",
  strategy: "review",
  status: "lead",
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
  assigned_to: null,
  next_follow_up_date: "",
  lead_temperature: "warm",
  campaign_source: "",
  review_intent: "needs-info-review",
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
  linksText: "",
};

const EMPTY_ATTACHMENT = () => ({
  title: "",
  attachment_type: "link" as DealAttachmentType,
  url: "",
  notes: "",
});

const EMPTY_BRIEF = (): VaDailyBriefInput => ({
  work_date: new Date().toISOString().slice(0, 10),
  hours_worked: null,
  leads_added: null,
  leads_updated: null,
  outreach_sent: null,
  seller_replies: null,
  calls_completed: null,
  deals_submitted: null,
  va_tasks_completed: null,
  checklist_items_cleared: null,
  activities_completed: "",
  follow_ups_needed: "",
  blockers: "",
  tomorrow_plan: "",
});

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function statusLabel(value: string): string {
  return labelForStatus(value);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function appendBriefText(existing: string | null | undefined, addition: string): string {
  const current = (existing ?? "").trim();
  if (!addition.trim()) return current;
  return current ? `${current}\n\n${addition.trim()}` : addition.trim();
}

function taskRecordHref(task: ActionItem): string {
  if (task.source_table === "meridian_deals" && task.source_id) return `/opportunity?deal=${task.source_id}`;
  if (task.source_table === "meridian_imported_land_leads" && task.source_id) return `/lead/${task.source_id}`;
  if (task.source_table === "meridian_projects" && task.source_id) return "/projects";
  if (task.source_table === "meeting_notes" && task.source_id) return "/meetings";
  return "/actions";
}

function taskRecordLabel(task: ActionItem): string {
  if (task.source_table === "meridian_deals") return "Deal";
  if (task.source_table === "meridian_imported_land_leads") return "Lead";
  if (task.source_table === "meridian_projects") return "Project";
  if (task.source_table === "meeting_notes") return "Meeting";
  return "General";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

type ConversationItem = {
  id: string;
  kind: "sms-in" | "sms-out" | "activity";
  title: string;
  date: string;
  body: string;
  meta?: string;
};

function sellerActionState(lead: ImportedLandLead): { label: string; title: string; detail: string; tone: WorkflowTone; primary: string; target: string } {
  return getLeadNextAction(lead);
}

function buildConversationItems(communications: CommunicationEvent[], activities: ImportedLandLeadActivity[]): ConversationItem[] {
  return [
    ...communications.map(event => ({
      id: `comm-${event.id}`,
      kind: event.direction === "inbound" ? "sms-in" as const : "sms-out" as const,
      title: event.channel === "voice"
        ? event.direction === "inbound" ? "Inbound call" : event.direction === "outbound" ? "Outbound call" : "Call update"
        : event.direction === "inbound" ? "Seller SMS" : event.direction === "outbound" ? "Meridian SMS" : "SMS update",
      date: event.provider_created_at || event.created_at,
      body: event.body || event.status || event.provider_event_type,
      meta: event.status || event.provider_event_type,
    })),
    ...activities.map(activity => ({
      id: `activity-${activity.id}`,
      kind: "activity" as const,
      title: statusLabel(activity.activity_type),
      date: activity.created_at,
      body: activity.summary,
      meta: activity.next_follow_up_date ? `Follow up ${activity.next_follow_up_date}` : undefined,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

function isSameDay(iso: string | null | undefined, date: string): boolean {
  return !!iso && iso.slice(0, 10) === date;
}

function isDueTodayOrPast(date: string | null | undefined, today: string): boolean {
  return !!date && date <= today;
}

function collectSearchText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map(collectSearchText).join(" ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key} ${collectSearchText(entry)}`)
      .join(" ");
  }
  return "";
}

function importedLeadMatchesQuery(lead: ImportedLandLead, query: string): boolean {
  const terms = query.split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = collectSearchText(lead).toLowerCase();
  return terms.every(term => haystack.includes(term));
}

function draftFromDeal(deal: Deal): DealInput & { linksText: string } {
  return {
    title: deal.title,
    source: deal.source ?? "",
    property_type: deal.property_type,
    strategy: deal.strategy,
    status: deal.status,
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
    review_intent: deal.review_intent ?? "needs-info-review",
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
    linksText: deal.links.join("\n"),
  };
}

function buildPayload(draft: DealInput & { linksText: string }, status: DealStatus): DealInput {
  return {
    title: draft.title.trim(),
    source: draft.source?.trim() || "VA intake",
    property_type: draft.property_type,
    strategy: draft.strategy.trim() || "review",
    status,
    urgency: draft.urgency,
    address: draft.address?.trim() || null,
    parcel_id: draft.parcel_id?.trim() || null,
    seller_name: draft.seller_name?.trim() || null,
    seller_phone: draft.seller_phone?.trim() || null,
    asking_price: draft.asking_price ?? null,
    arv: draft.arv ?? null,
    repair_estimate: draft.repair_estimate ?? null,
    acreage: draft.acreage ?? null,
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
    disposition_status: draft.disposition_status || "not-started",
    exit_strategy: draft.exit_strategy?.trim() || null,
    target_buyer_type: draft.target_buyer_type?.trim() || null,
    target_resale_price: draft.target_resale_price ?? null,
    minimum_acceptable_price: draft.minimum_acceptable_price ?? null,
    best_buyer_offer: draft.best_buyer_offer ?? null,
    buyer_demand_evidence: draft.buyer_demand_evidence?.trim() || null,
    disposition_owner: draft.disposition_owner?.trim() || null,
    disposition_next_step: draft.disposition_next_step?.trim() || null,
    closing_costs_estimate: draft.closing_costs_estimate ?? null,
    holding_costs_estimate: draft.holding_costs_estimate ?? null,
    marketing_costs_estimate: draft.marketing_costs_estimate ?? null,
    desired_minimum_spread: draft.desired_minimum_spread ?? null,
    risk_buffer: draft.risk_buffer ?? null,
    calculator_notes: draft.calculator_notes?.trim() || null,
    links: draft.linksText.split(/\r?\n/).map(l => l.trim()).filter(Boolean),
  };
}

async function notifyMembersForReview(deal: Deal, actor: string, shouldCreateVoteTasks: boolean, memberNames: string[]): Promise<string[]> {
  const message = [
    deal.submission_summary || deal.analysis?.recommendation || "Needs Review",
    deal.requested_next_step ? `Next: ${deal.requested_next_step}` : "",
    deal.submit_uncertainties ? `Uncertain: ${deal.submit_uncertainties}` : "",
  ].filter(Boolean).join(" · ");
  const notifications = memberNames.map(member =>
    createNotification({
      title: shouldCreateVoteTasks ? `Deal needs your vote: ${deal.title}` : `Deal needs review: ${deal.title}`,
      body: message,
      priority: deal.urgency === "hot" ? "urgent" : "high",
      assigned_to: member,
      href: `/opportunity?deal=${deal.id}`,
      source_table: "meridian_deals",
      source_id: deal.id,
      notification_type: shouldCreateVoteTasks ? "deal_vote" : "deal-review",
    }, actor)
  );
  const actionItems = shouldCreateVoteTasks ? memberNames.map(member => createActionItem({
      title: `Review deal: ${deal.title}`,
      description: message,
      assigned_to: member,
      due_date: addDays(deal.urgency === "hot" ? 1 : 2),
    }, actor)) : [];
  const results = await Promise.all([...notifications, ...actionItems]);
  return results.map(r => r.error).filter((error): error is string => !!error);
}

export default function VaPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<DealDueDiligenceItem[]>([]);
  const [attachments, setAttachments] = useState<DealAttachment[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [attachmentDraft, setAttachmentDraft] = useState(EMPTY_ATTACHMENT);
  const [briefDraft, setBriefDraft] = useState<VaDailyBriefInput>(EMPTY_BRIEF);
  const [briefs, setBriefs] = useState<VaDailyBrief[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<ActionItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<VaTimeEntry[]>([]);
  const [timeChangeRequests, setTimeChangeRequests] = useState<VaTimeChangeRequest[]>([]);
  const [openShift, setOpenShift] = useState<VaTimeEntry | null>(null);
  const [shiftNotes, setShiftNotes] = useState("");
  const [timeRequestDraft, setTimeRequestDraft] = useState<{
    entryId: string;
    requestType: VaTimeChangeRequestType;
    clockIn: string;
    clockOut: string;
    notes: string;
    reason: string;
  }>({ entryId: "", requestType: "add-shift", clockIn: "", clockOut: "", notes: "", reason: "" });
  const [inlineTimeEditId, setInlineTimeEditId] = useState<string | null>(null);
  const [inlineTimeDraft, setInlineTimeDraft] = useState<{
    entryId: string;
    requestType: VaTimeChangeRequestType;
    clockIn: string;
    clockOut: string;
    notes: string;
    reason: string;
  }>({ entryId: "", requestType: "edit-shift", clockIn: "", clockOut: "", notes: "", reason: "" });
  const [timeRequestSaving, setTimeRequestSaving] = useState(false);
  const [editingBriefId, setEditingBriefId] = useState<string | null>(null);
  const [briefRevisionNote, setBriefRevisionNote] = useState("");
  const [clockBusy, setClockBusy] = useState(false);
  const [, setClockTick] = useState(0);
  const [importedLeads, setImportedLeads] = useState<ImportedLandLead[]>([]);
  const [leadBatches, setLeadBatches] = useState<LandLeadBatch[]>([]);
  const [selectedImportedLeadId, setSelectedImportedLeadId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [leadActivities, setLeadActivities] = useState<ImportedLandLeadActivity[]>([]);
  const [communicationEvents, setCommunicationEvents] = useState<CommunicationEvent[]>([]);
  const [unmatchedSms, setUnmatchedSms] = useState<CommunicationEvent[]>([]);
  const [recentInboundSms, setRecentInboundSms] = useState<CommunicationEvent[]>([]);
  const [importPreview, setImportPreview] = useState<LandLeadImportPreview | null>(null);
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [importStage, setImportStage] = useState<ImportStage>("idle");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState<ImportStatusFilter>("all");
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");
  const [uploadSource, setUploadSource] = useState("Land Portal");
  const [uploadCampaign, setUploadCampaign] = useState("");
  const [activityDraft, setActivityDraft] = useState<{ activityType: ImportedLandLeadActivity["activity_type"]; summary: string; nextFollowUpDate: string }>({ activityType: "called", summary: "", nextFollowUpDate: "" });
  const [dispositionDraft, setDispositionDraft] = useState<{ disposition: LeadDisposition; note: string; nextFollowUpDate: string }>({ disposition: "no-answer", note: "", nextFollowUpDate: "" });
  const [smsDraft, setSmsDraft] = useState("");
  const [bulkSmsDrawerOpen, setBulkSmsDrawerOpen] = useState(false);
  const [draftCommunicationEventId, setDraftCommunicationEventId] = useState<string | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [briefSaving, setBriefSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<VaTab>("today");
  const [notifyReviewUpdate, setNotifyReviewUpdate] = useState(false);
  const [activeMemberNames, setActiveMemberNames] = useState<string[]>([]);
  const leadCsvInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async (memberName = user) => {
    setLoading(true);
    const [rows, briefRows, timeRows, requestRows, currentShift, importRows, batchRows, smsRows, recentSmsRows, taskRows, memberNames] = await Promise.all([
      fetchDeals(),
      fetchVaDailyBriefs(8),
      fetchVaTimeEntries(80),
      fetchVaTimeChangeRequests(50),
      memberName ? fetchOpenVaTimeEntry(memberName) : Promise.resolve(null),
      fetchImportedLandLeads(500),
      fetchLandLeadBatches(),
      fetchCommunicationEvents({ unmatched: true, limit: 25 }),
      fetchCommunicationEvents({ limit: 120 }),
      fetchActionItems(),
      fetchActiveMemberNames(),
    ]);
    const activeRows = rows.filter(deal =>
      !["closed", "active-project", "stabilized", "sold"].includes(deal.status)
      && (!memberName || deal.created_by === memberName || deal.submitted_by === memberName || deal.assigned_to === memberName)
    );
    setDeals(activeRows);
    setBriefs(briefRows);
    setAssignedTasks(taskRows.filter(task => isVaTask(task)));
    setTimeEntries(timeRows);
    setTimeChangeRequests(requestRows.filter(request => !memberName || request.operator_name === memberName));
    setOpenShift(currentShift);
    setImportedLeads(importRows);
    setLeadBatches(batchRows);
    setUnmatchedSms(smsRows);
    setRecentInboundSms(recentSmsRows.filter(event => event.direction === "inbound").slice(0, 40));
    setActiveMemberNames(memberNames);
    setSelectedId(prev => prev && activeRows.some(d => d.id === prev) ? prev : activeRows[0]?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void reload(u);
  }, [router, reload]);

  useEffect(() => {
    const readUrlTab = () => {
      const tab = new URLSearchParams(window.location.search).get("tab") || "today";
      if (TABS.some(item => item.value === tab)) setActiveTab(tab as VaTab);
    };
    const handleTabEvent = (event: Event) => {
      const tab = (event as CustomEvent<VaTab>).detail;
      if (TABS.some(item => item.value === tab)) setActiveTab(tab);
    };
    readUrlTab();
    window.addEventListener("popstate", readUrlTab);
    window.addEventListener("meridian-va-tab", handleTabEvent);
    return () => {
      window.removeEventListener("popstate", readUrlTab);
      window.removeEventListener("meridian-va-tab", handleTabEvent);
    };
  }, []);

  useEffect(() => {
    if (!openShift) return;
    const timer = window.setInterval(() => setClockTick(tick => tick + 1), 30000);
    return () => window.clearInterval(timer);
  }, [openShift]);

  const selected = useMemo(() => deals.find(deal => deal.id === selectedId) ?? null, [deals, selectedId]);
  const liveInput = useMemo(() => buildPayload(draft, draft.status ?? "lead"), [draft]);
  const liveAnalysis = useMemo(() => calculateDealAnalysis(liveInput), [liveInput]);
  const liveChecklist = useMemo(() => generateDueDiligenceChecklist(liveInput), [liveInput]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todaysSubmittedMinutes = useMemo(() => timeEntries
    .filter(entry => vaDateKey(entry.clock_in_at) === briefDraft.work_date && entry.duration_minutes)
    .reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0),
    [briefDraft.work_date, timeEntries],
  );
  const liveShiftMinutes = openShift ? currentShiftMinutes(openShift) : 0;
  const openAssignedTasks = useMemo(() => assignedTasks.filter(task => task.status !== "done"), [assignedTasks]);
  const completedAssignedTasksToday = useMemo(() => assignedTasks.filter(task =>
    task.status === "done"
    && task.completed_at
    && vaDateKey(task.completed_at) === briefDraft.work_date
  ), [assignedTasks, briefDraft.work_date]);
  const followUpsDue = useMemo(() => deals.filter(deal => isDueTodayOrPast(deal.next_follow_up_date, today)), [deals, today]);
  const draftLeads = useMemo(() => deals.filter(deal => deal.status === "lead"), [deals]);
  const interestedLeads = useMemo(() => importedLeads.filter(lead => lead.status === "interested"), [importedLeads]);
  const selectedImportedLead = useMemo(() => importedLeads.find(lead => lead.id === selectedImportedLeadId) ?? null, [importedLeads, selectedImportedLeadId]);
  const selectedBatch = useMemo(() => leadBatches.find(batch => batch.id === selectedBatchId) ?? null, [leadBatches, selectedBatchId]);
  const filteredImportedLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    const min = toNumber(minAcreage);
    const max = toNumber(maxAcreage);
    const rows = importedLeads.filter(lead => {
      if (selectedBatchId && lead.batch_id !== selectedBatchId) return false;
      if (lead.status === "converted") return false;
      if (leadFilter === "duplicates" && lead.duplicate_status === "new") return false;
      if (leadFilter === "has-phone" && !lead.phone && !lead.phone_2) return false;
      if (leadFilter === "no-phone" && (lead.phone || lead.phone_2)) return false;
      if (leadFilter === "score-60" && (lead.lead_score ?? 0) < 60) return false;
      if (leadFilter === "landlocked" && !String(lead.raw_data?.["Land Locked"] ?? lead.raw_data?.["Tag:Land Locked"] ?? "").toLowerCase().startsWith("y")) return false;
      if (leadFilter === "flood" && !(toNumber(String(lead.raw_data?.["Flood Zone Percent"] ?? "")) ?? 0)) return false;
      if (leadFilter === "wetlands" && !(toNumber(String(lead.raw_data?.["Wetlands Percent"] ?? "")) ?? 0)) return false;
      if (["new", "contacted", "interested", "passed"].includes(leadFilter) && lead.status !== leadFilter) return false;
      if (min !== null && (lead.acreage ?? 0) < min) return false;
      if (max !== null && (lead.acreage ?? 0) > max) return false;
      return importedLeadMatchesQuery(lead, query);
    });
    return rows.sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0)).slice(0, 120);
  }, [importedLeads, leadFilter, leadSearch, maxAcreage, minAcreage, selectedBatchId]);
  const bulkSmsCategorization = useMemo(() => categorizeForBulkSms(filteredImportedLeads), [filteredImportedLeads]);
  const bulkEligibleLeads = bulkSmsCategorization.eligible;
  const batchLeads = useMemo(() => selectedBatchId ? importedLeads.filter(lead => lead.batch_id === selectedBatchId) : importedLeads, [importedLeads, selectedBatchId]);
  const nextBestLead = useMemo(() => filteredImportedLeads.find(lead => lead.status === "new" || lead.status === "contacted") ?? filteredImportedLeads[0] ?? null, [filteredImportedLeads]);
  const priorityImportedLeads = useMemo(() => filteredImportedLeads
    .filter(lead => lead.status === "new" || lead.status === "contacted")
    .sort((a, b) => {
      const aDue = a.next_follow_up_date && a.next_follow_up_date <= today ? 1000 : 0;
      const bDue = b.next_follow_up_date && b.next_follow_up_date <= today ? 1000 : 0;
      const aFresh = a.status === "new" ? 40 : 0;
      const bFresh = b.status === "new" ? 40 : 0;
      return ((b.lead_score ?? 0) + bDue + bFresh) - ((a.lead_score ?? 0) + aDue + aFresh);
    })
    .slice(0, 12), [filteredImportedLeads, today]);
  const workdeskLeadRows = useMemo(() => {
    const seen = new Set<string>();
    return [...interestedLeads, ...priorityImportedLeads, ...filteredImportedLeads]
      .filter(lead => {
        if (seen.has(lead.id)) return false;
        seen.add(lead.id);
        return lead.status !== "converted" && lead.status !== "passed";
      })
      .slice(0, 10);
  }, [filteredImportedLeads, interestedLeads, priorityImportedLeads]);
  const importStats = useMemo(() => ({
    newRows: importedLeads.filter(lead => lead.status === "new").length,
    contacted: importedLeads.filter(lead => lead.status === "contacted").length,
    interested: importedLeads.filter(lead => lead.status === "interested").length,
    duplicates: importedLeads.filter(lead => lead.duplicate_status && lead.duplicate_status !== "new").length,
    converted: importedLeads.filter(lead => lead.status === "converted").length,
    avgScore: importedLeads.length ? Math.round(importedLeads.reduce((sum, lead) => sum + (lead.lead_score ?? 0), 0) / importedLeads.length) : 0,
  }), [importedLeads]);
  const portalStats = useMemo(() => ({
    addedToday: deals.filter(deal => isSameDay(deal.created_at, today)).length,
    updatedToday: deals.filter(deal => isSameDay(deal.updated_at, today)).length,
    submittedToday: deals.filter(deal => deal.status === "under-review" && isSameDay(deal.updated_at, today)).length,
    briefSubmitted: briefs.some(brief => brief.work_date === today),
  }), [briefs, deals, today]);
  const tabCounts: Record<VaTab, number> = {
    today: recentInboundSms.length + followUpsDue.length + interestedLeads.length + openAssignedTasks.length,
    outreach: recentInboundSms.length + followUpsDue.length,
    lists: importedLeads.length,
    packet: deals.length,
    brief: portalStats.briefSubmitted ? 1 : 0,
  };
  const readinessItems = useMemo(() => [
    { label: "Address or parcel", done: !!(liveInput.address || liveInput.parcel_id) },
    { label: "Seller contact", done: !!(liveInput.seller_name || liveInput.seller_phone) },
    { label: "Asking price", done: typeof liveInput.asking_price === "number" && Number.isFinite(liveInput.asking_price) },
    { label: liveInput.property_type === "land" ? "Exit value or comp support" : "ARV or value", done: typeof liveInput.arv === "number" && Number.isFinite(liveInput.arv) },
    { label: "Disposition thesis", done: !!(liveInput.exit_strategy && liveInput.target_buyer_type && liveInput.buyer_demand_evidence) },
    { label: "Calculator assumptions", done: typeof liveInput.desired_minimum_spread === "number" || typeof liveInput.minimum_acceptable_price === "number" },
    { label: "Notes added", done: !!liveInput.notes },
    { label: "Link or attachment", done: (liveInput.links?.length ?? 0) > 0 || attachments.length > 0 },
  ], [attachments.length, liveInput]);
  const readyCount = readinessItems.filter(item => item.done).length;
  const missingReadyItems = readinessItems.filter(item => !item.done).map(item => item.label);
  const submissionReady = readyCount === readinessItems.length
    && !!liveInput.submission_summary
    && !!liveInput.requested_next_step
    && !!liveInput.review_intent;

  useEffect(() => {
    if (!selected) {
      setChecklist([]);
      setAttachments([]);
      setDraft(EMPTY_DRAFT);
      setDraftCommunicationEventId(null);
      return;
    }
    setDraft(draftFromDeal(selected));
    setDraftCommunicationEventId(null);
    void Promise.all([fetchDealChecklist(selected.id), fetchDealAttachments(selected.id)]).then(([items, files]) => {
      setChecklist(items);
      setAttachments(files);
    });
  }, [selected]);

  useEffect(() => {
    if (!selectedImportedLeadId) { setLeadActivities([]); setCommunicationEvents([]); return; }
    void Promise.all([
      fetchImportedLandLeadActivities(selectedImportedLeadId),
      fetchCommunicationEvents({ leadId: selectedImportedLeadId, limit: 30 }),
    ]).then(([activities, comms]) => {
      setLeadActivities(activities);
      setCommunicationEvents(comms);
    });
  }, [selectedImportedLeadId]);

  useEffect(() => {
    if (activeTab !== "brief" || editingBriefId || loading) return;
    const date = briefDraft.work_date;
    const sameDay = (iso?: string | null) => !!iso && iso.slice(0, 10) === date;
    const ownDeals = deals.filter(deal => deal.created_by === user || deal.submitted_by === user || deal.assigned_to === user);
    const touchedImportedLeads = importedLeads.filter(lead => sameDay(lead.last_activity_at) || sameDay(lead.last_sms_at));
    setBriefDraft(prev => ({
      ...prev,
      leads_added: prev.leads_added ?? ownDeals.filter(deal => sameDay(deal.created_at)).length,
      leads_updated: prev.leads_updated ?? (ownDeals.filter(deal => sameDay(deal.updated_at)).length + touchedImportedLeads.length),
      outreach_sent: prev.outreach_sent ?? touchedImportedLeads.filter(lead => ["called", "texted", "emailed", "left-voicemail"].includes(lead.last_activity_type || "") || lead.last_sms_direction === "outbound").length,
      seller_replies: prev.seller_replies ?? touchedImportedLeads.filter(lead => lead.status === "interested" || lead.last_sms_direction === "inbound").length,
      calls_completed: prev.calls_completed ?? touchedImportedLeads.filter(lead => lead.last_activity_type === "called" || lead.last_activity_type === "left-voicemail").length,
      deals_submitted: prev.deals_submitted ?? ownDeals.filter(deal => deal.status === "under-review" && sameDay(deal.updated_at)).length,
      va_tasks_completed: prev.va_tasks_completed ?? completedAssignedTasksToday.length,
      hours_worked: prev.hours_worked ?? (todaysSubmittedMinutes > 0 ? Number((todaysSubmittedMinutes / 60).toFixed(2)) : prev.hours_worked),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, editingBriefId, loading]);

  if (!user) return null;

  const leadLabel = (lead: ImportedLandLead) => lead.owner_name || lead.property_address || lead.parcel_id || "Selected lead";
  const goToTab = (tab: VaTab) => {
    setActiveTab(tab);
    router.replace(tab === "today" ? "/va" : `/va?tab=${tab}`, { scroll: false });
    window.dispatchEvent(new CustomEvent("meridian-va-tab", { detail: tab }));
    window.setTimeout(() => document.getElementById(`va-tab-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const startNewImport = () => {
    goToTab("lists");
    setImportStep("upload");
    setImportPreview(null);
    setSelectedBatchId(null);
    setSelectedImportedLeadId(null);
    setBulkSmsDrawerOpen(false);
    setMessage("Choose a Land Portal or Land Insights CSV to preview.");
    if (!importing) leadCsvInputRef.current?.click();
  };
  const openIncomingSms = (event: CommunicationEvent) => {
    if (event.matched_lead_id) {
      const lead = importedLeads.find(item => item.id === event.matched_lead_id);
      if (lead) {
        selectImportedLead(lead, "outreach");
        return;
      }
    }
    if (event.matched_deal_id) {
      router.push(`/opportunity?deal=${event.matched_deal_id}`);
      return;
    }
    createLeadDraftFromSms(event);
  };

  const addToDailyBrief = (line: string, patch: Partial<VaDailyBriefInput> = {}) => {
    setBriefDraft(prev => ({
      ...prev,
      ...patch,
      activities_completed: patch.activities_completed ?? appendBriefText(prev.activities_completed, line),
    }));
  };

  const saveLeadDisposition = async (disposition: LeadDisposition, note = dispositionDraft.note, nextFollowUpDate = dispositionDraft.nextFollowUpDate) => {
    if (!selectedImportedLead) { setMessage("Select an imported lead first."); return; }
    const config = LEAD_DISPOSITIONS.find(item => item.value === disposition);
    if (!config) return;
    const summary = note.trim() || config.label;
    const { error } = await createImportedLandLeadActivity({
      leadId: selectedImportedLead.id,
      actor: user,
      activityType: config.activityType,
      summary,
      nextFollowUpDate: nextFollowUpDate || null,
    });
    if (error) { setMessage(error); return; }
    await updateImportedLandLeadStatus(selectedImportedLead.id, config.nextStatus, selectedImportedLead.deal_id);
    const [leadRows, activityRows] = await Promise.all([
      fetchImportedLandLeads(500),
      fetchImportedLandLeadActivities(selectedImportedLead.id),
    ]);
    setImportedLeads(leadRows);
    setLeadActivities(activityRows);
    setDispositionDraft({ disposition: "no-answer", note: "", nextFollowUpDate: "" });
    const line = `${config.label}: ${leadLabel(selectedImportedLead)}${summary && summary !== config.label ? ` — ${summary}` : ""}`;
    addToDailyBrief(line, {
      outreach_sent: config.briefType === "outreach" ? (briefDraft.outreach_sent ?? 0) + 1 : briefDraft.outreach_sent,
      seller_replies: config.briefType === "reply" ? (briefDraft.seller_replies ?? 0) + 1 : briefDraft.seller_replies,
      leads_updated: (briefDraft.leads_updated ?? 0) + 1,
      follow_ups_needed: config.briefType === "follow-up" ? appendBriefText(briefDraft.follow_ups_needed, `${leadLabel(selectedImportedLead)} follow-up set for ${nextFollowUpDate || "next available date"}.`) : briefDraft.follow_ups_needed,
    });
    setMessage(`${config.label} saved for ${leadLabel(selectedImportedLead)}.`);
  };

  const applyLeadDisposition = async () => {
    await saveLeadDisposition(dispositionDraft.disposition);
  };

  const quickLeadDisposition = async (disposition: LeadDisposition, note: string, followUpDays?: number) => {
    await saveLeadDisposition(disposition, note, followUpDays ? addDays(followUpDays) : "");
  };

  const startNew = () => {
    setSelectedId(null);
    setSelectedImportedLeadId(null);
    setChecklist([]);
    setAttachments([]);
    setDraft(EMPTY_DRAFT);
    setAttachmentDraft(EMPTY_ATTACHMENT());
    setDraftCommunicationEventId(null);
    setMessage("");
    setActiveTab("packet");
    setNotifyReviewUpdate(false);
  };

  const openDealBrief = (deal: Deal) => {
    setSelectedImportedLeadId(null);
    setSelectedId(deal.id);
    setMessage("");
    setActiveTab("packet");
  };

  const selectImportedLead = (lead: ImportedLandLead, tab: VaTab = "today") => {
    setSelectedId(null);
    setSelectedImportedLeadId(lead.id);
    setActiveTab(tab);
    setMessage("");
  };

  const saveDeal = async (status: DealStatus) => {
    if (!draft.title.trim()) { setMessage("Add a deal title before saving."); return; }
    const now = new Date().toISOString();
    const existingRound = selected?.review_round ?? draft.review_round ?? 0;
    const isReviewSubmit = status === "under-review";
    const shouldNotifyMembers = isReviewSubmit && (!selected?.last_review_notification_at || selected.status !== "under-review" || notifyReviewUpdate);
    if (isReviewSubmit) {
      if (!submissionReady) {
        setActiveTab("packet");
        setMessage([
          missingReadyItems.length ? `Complete before submitting: ${missingReadyItems.join(", ")}.` : "",
          !liveInput.submission_summary ? "Add a VA submission summary." : "",
          !liveInput.requested_next_step ? "Add the requested member next step." : "",
        ].filter(Boolean).join(" "));
        return;
      }
      const intentLabel = REVIEW_INTENTS.find(intent => intent.value === draft.review_intent)?.label ?? "member review";
      const confirmText = shouldNotifyMembers
        ? `Submit this deal as "${intentLabel}"? This will notify members${draft.review_intent === "ready-for-vote" ? " and create vote tasks" : ""}.`
        : "Update this under-review deal without sending duplicate member notifications?";
      if (!window.confirm(confirmText)) return;
    }
    setSaving(true);
    setMessage("");
    const payload = buildPayload(draft, status);
    payload.submitted_by = payload.submitted_by || user;
    payload.assigned_to = payload.assigned_to || user;
    if (isReviewSubmit) {
      payload.first_submitted_at = selected?.first_submitted_at || draft.first_submitted_at || now;
      payload.last_submitted_at = now;
      payload.review_round = shouldNotifyMembers ? existingRound + 1 : existingRound;
      payload.last_review_notification_at = shouldNotifyMembers ? now : selected?.last_review_notification_at || draft.last_review_notification_at || null;
    }
    const result = selected
      ? await updateDeal(selected.id, payload, user)
      : await createDeal(payload, user);
    setSaving(false);
    if (result.error && !result.data) { setMessage(result.error); return; }
    if (!result.data) { setMessage("Deal could not be saved."); return; }
    const matchingLead = importedLeads.find(lead => lead.id === selectedImportedLeadId) ?? importedLeads.find(lead =>
      lead.status === "interested"
      && ((payload.parcel_id && lead.parcel_id === payload.parcel_id) || (payload.seller_phone && (lead.phone === payload.seller_phone || lead.phone_2 === payload.seller_phone)))
    );
    if (matchingLead) {
      await updateImportedLandLeadStatus(matchingLead.id, "converted", result.data.id);
      await createImportedLandLeadActivity({
        leadId: matchingLead.id,
        actor: user,
        activityType: "converted",
        summary: `Converted to deal packet: ${result.data.title}`,
      });
      addToDailyBrief(`Converted lead to deal packet: ${leadLabel(matchingLead)} → ${result.data.title}`, {
        leads_updated: (briefDraft.leads_updated ?? 0) + 1,
      });
      setImportedLeads(await fetchImportedLandLeads());
    }
    if (draftCommunicationEventId) {
      await attachCommunicationEventToDeal(draftCommunicationEventId, result.data.id, user);
      setDraftCommunicationEventId(null);
      setUnmatchedSms(await fetchCommunicationEvents({ unmatched: true, limit: 25 }));
    }
    if (status === "under-review") {
      if (shouldNotifyMembers) {
        const errors = await notifyMembersForReview(result.data, user, result.data.review_intent === "ready-for-vote", activeMemberNames);
        await createDealActivity({
          deal_id: result.data.id,
          actor: user,
          activity_type: "submitted-review",
          summary: `Submitted review packet: ${REVIEW_INTENTS.find(intent => intent.value === result.data?.review_intent)?.label ?? "Member Review"}`,
          field_changes: {
            review_intent: result.data.review_intent,
            review_round: result.data.review_round,
            requested_next_step: result.data.requested_next_step,
          },
        });
        if (errors.length) setMessage(`Deal submitted, but review notifications had an issue: ${errors[0]}`);
        else setMessage(result.data.review_intent === "ready-for-vote" ? "Deal submitted for member vote." : "Deal submitted for member review.");
        addToDailyBrief(`Submitted deal for member review: ${result.data.title}`, {
          deals_submitted: (briefDraft.deals_submitted ?? 0) + 1,
        });
      } else {
        setMessage("Deal packet updated. Members were not notified again.");
      }
    } else {
      setMessage("Draft saved.");
    }
    await reload();
    setSelectedId(result.data.id);
    setNotifyReviewUpdate(false);
  };

  const updateChecklist = async (item: DealDueDiligenceItem, status: ChecklistStatus) => {
    const { error } = await updateChecklistItemStatus(item.id, status, user);
    if (error) { setMessage(error); return; }
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, status, updated_by: user, updated_at: new Date().toISOString() } : i));
  };

  const addAttachment = async () => {
    if (!selected) { setMessage("Save the lead before adding attachments."); return; }
    const { data, error } = await createDealAttachment({ ...attachmentDraft, deal_id: selected.id }, user);
    if (error) { setMessage(error); return; }
    if (data) {
      setAttachments(prev => [data, ...prev]);
      setAttachmentDraft(EMPTY_ATTACHMENT());
      setMessage("Attachment added.");
    }
  };

  const handleLeadCsvUpload = async (file: File | null) => {
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".numbers")) {
      setMessage("Apple Numbers files need to be exported to CSV first: File > Export To > CSV, then upload the .csv here.");
      return;
    }
    setImporting(true);
    setImportStage("previewing");
    setMessage("");
    const text = await file.text();
    const preview = await previewLandLeadsCsv({
      csvText: text,
      filename: file.name,
      sourceSystem: uploadSource,
      campaignSource: uploadCampaign,
      actor: user,
    });
    setImporting(false);
    setImportStage("idle");
    if (preview.error) { setMessage(preview.error); return; }
    setImportPreview(preview);
    setImportStep("preview");
    setMessage(`Preview ready. Meridian found ${preview.safeToImport} new propert${preview.safeToImport === 1 ? "y" : "ies"} across ${preview.uniqueLeadCount} lead${preview.uniqueLeadCount === 1 ? "" : "s"} and ${preview.skippedDuplicates} overlap${preview.skippedDuplicates === 1 ? "" : "s"} to skip.`);
    setActiveTab("lists");
  };

  const confirmLeadImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    setImportStage("creating-batch");
    setImportStep("importing");
    setMessage(`Importing ${importPreview.safeToImport} property row${importPreview.safeToImport === 1 ? "" : "s"} now. Large lists can take a minute; keep this tab open.`);
    try {
      setImportStage("saving-leads");
      const response = await fetch("/api/import-land-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: importPreview.csvText,
          filename: importPreview.filename,
          sourceSystem: uploadSource,
          campaignSource: uploadCampaign,
          actor: user,
        }),
      });
      const result = await response.json() as { importedCount?: number; batchId?: string | null; warning?: string | null; error?: string };
      if (!response.ok || result.error) { setImportStep("preview"); setMessage(`Import failed: ${result.error || response.statusText}`); return; }
      setImportStage("refreshing");
      const [leadRows, batchRows] = await Promise.all([fetchImportedLandLeads(1500), fetchLandLeadBatches()]);
      setImportedLeads(leadRows);
      setLeadBatches(batchRows);
      setSelectedBatchId(result.batchId ?? batchRows[0]?.id ?? null);
      setSelectedImportedLeadId(leadRows.find(lead => lead.batch_id === (result.batchId ?? batchRows[0]?.id))?.id ?? leadRows[0]?.id ?? null);
      setImportPreview(null);
      setImportStep("work");
      setImportStage("done");
      setMessage([
        `Imported ${result.importedCount ?? importPreview.safeToImport} new propert${(result.importedCount ?? importPreview.safeToImport) === 1 ? "y" : "ies"} from ${importPreview.filename}.`,
        importPreview.skippedDuplicates ? `Skipped ${importPreview.skippedDuplicates} overlapping record${importPreview.skippedDuplicates === 1 ? "" : "s"} already in Meridian.` : "",
        result.warning || "",
      ].filter(Boolean).join(" "));
      setActiveTab("lists");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown upload error.";
      setImportStep("preview");
      setMessage(`Import failed before it could finish: ${detail}`);
    } finally {
      setImporting(false);
    }
  };

  const loadImportedLead = async (lead: ImportedLandLead, markInterested = true) => {
    const imported = leadToDealDraft(lead);
    setSelectedId(null);
    setChecklist([]);
    setAttachments([]);
    setDraftCommunicationEventId(null);
    setDraft({
      ...EMPTY_DRAFT,
      ...imported,
      linksText: imported.linksText ?? "",
      submitted_by: user,
      assigned_to: user,
      source: imported.source || lead.source_system,
      campaign_source: imported.campaign_source || lead.campaign_source || "",
    });
    setActiveTab("packet");
    setSelectedImportedLeadId(lead.id);
    setMessage("Imported lead loaded into the deal form.");
    if (markInterested && lead.status !== "interested") {
      await updateImportedLandLeadStatus(lead.id, "interested", lead.deal_id);
      setImportedLeads(await fetchImportedLandLeads());
      addToDailyBrief(`Marked interested and loaded deal brief: ${leadLabel(lead)}`, {
        leads_updated: (briefDraft.leads_updated ?? 0) + 1,
        seller_replies: (briefDraft.seller_replies ?? 0) + 1,
      });
    }
  };

  const refreshSelectedLeadMessages = async (leadId: string) => {
    const [leadRows, activityRows, commRows, unmatchedRows, recentRows] = await Promise.all([
      fetchImportedLandLeads(500),
      fetchImportedLandLeadActivities(leadId),
      fetchCommunicationEvents({ leadId, limit: 30 }),
      fetchCommunicationEvents({ unmatched: true, limit: 25 }),
      fetchCommunicationEvents({ limit: 120 }),
    ]);
    setImportedLeads(leadRows);
    setLeadActivities(activityRows);
    setCommunicationEvents(commRows);
    setUnmatchedSms(unmatchedRows);
    setRecentInboundSms(recentRows.filter(event => event.direction === "inbound").slice(0, 40));
  };

  const sendSmsToLead = async () => {
    if (!selectedImportedLead) { setMessage("Select an imported lead first."); return; }
    const compliance = checkLeadSmsCompliance(selectedImportedLead);
    if (!compliance.allowed) {
      const prefix = compliance.severity === "compliance"
        ? "Blocked for compliance"
        : compliance.severity === "data-quality"
          ? "Cannot send"
          : "Excluded";
      setMessage(`${prefix}: ${compliance.blockLabel}.`);
      return;
    }
    const toNumber = compliance.phone!.number;
    const body = smsDraft.trim();
    if (!body) { setMessage("Write a text message before sending."); return; }
    setSmsSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/sakari/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber,
          message: body,
          actor: user,
          leadId: selectedImportedLead.id,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        setMessage(`SMS failed: ${result.error || response.statusText}`);
        return;
      }
      setSmsDraft("");
      await refreshSelectedLeadMessages(selectedImportedLead.id);
      addToDailyBrief(`SMS sent to ${leadLabel(selectedImportedLead)}: ${body}`, {
        outreach_sent: (briefDraft.outreach_sent ?? 0) + 1,
        leads_updated: (briefDraft.leads_updated ?? 0) + 1,
      });
      setMessage("SMS sent through Sakari.");
    } catch (error) {
      setMessage(`SMS failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSmsSending(false);
    }
  };

  const sendBulkSms = async ({ message: body, recipients }: { message: string; recipients: Array<{ leadId: string; toNumber: string; label: string | null; rendered: string }> }): Promise<{ sent?: number; error?: string }> => {
    if (!body.trim()) return { error: "Write a bulk SMS message before sending." };
    if (recipients.length === 0) return { error: "No eligible leads in the current filtered list." };
    setMessage("");
    const response = await fetch("/api/sakari/bulk-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: user,
        message: body,
        recipients: recipients.map(r => ({
          leadId: r.leadId,
          toNumber: r.toNumber,
          label: r.label,
          message: r.rendered,
        })),
      }),
    });
    const result = await response.json().catch(() => ({})) as { sent?: number; error?: string };
    if (!response.ok || result.error) {
      const errorMessage = result.error || response.statusText;
      setMessage(`Bulk SMS failed: ${errorMessage}`);
      return { error: errorMessage };
    }
    const sentCount = result.sent ?? recipients.length;
    const [leadRows, unmatchedRows] = await Promise.all([
      fetchImportedLandLeads(1500),
      fetchCommunicationEvents({ unmatched: true, limit: 25 }),
    ]);
    setImportedLeads(leadRows);
    setUnmatchedSms(unmatchedRows);
    setBriefDraft(prev => ({
      ...prev,
      outreach_sent: (prev.outreach_sent ?? 0) + sentCount,
      activities_completed: appendBriefText(prev.activities_completed, `Bulk SMS sent to ${sentCount} seller${sentCount === 1 ? "" : "s"} from ${selectedBatch?.campaign_source || selectedBatch?.original_filename || "current filtered list"}.`),
    }));
    setMessage(`Bulk SMS sent to ${sentCount} seller${sentCount === 1 ? "" : "s"}.`);
    return { sent: sentCount };
  };

  const attachUnmatchedSmsToLead = async (event: CommunicationEvent) => {
    if (!selectedImportedLead) { setMessage("Select the matching imported lead first."); return; }
    const { error } = await attachCommunicationEventToLead(event.id, selectedImportedLead.id, user);
    if (error) { setMessage(error); return; }
    await refreshSelectedLeadMessages(selectedImportedLead.id);
    setMessage("SMS attached to the selected lead.");
  };

  const createLeadDraftFromSms = (event: CommunicationEvent) => {
    setSelectedId(null);
    setChecklist([]);
    setAttachments([]);
    setDraftCommunicationEventId(event.id);
    setDraft({
      ...EMPTY_DRAFT,
      title: `SMS lead · ${event.contact_number || event.from_number || "Unknown number"}`,
      source: "Sakari SMS",
      property_type: "land",
      seller_name: event.contact_name || "",
      seller_phone: event.contact_number || event.from_number || "",
      notes: [
        "Lead started from unmatched Sakari message.",
        event.body ? `Seller text: ${event.body}` : "",
        event.provider_created_at ? `Received: ${formatDate(event.provider_created_at)}` : "",
      ].filter(Boolean).join("\n"),
      submitted_by: user,
      assigned_to: user,
      campaign_source: "Inbound SMS",
      lead_temperature: event.direction === "inbound" ? "hot" : "warm",
    });
    setActiveTab("packet");
    setMessage("Unmatched SMS loaded as a new lead draft. Add property details before saving.");
  };

  const logLeadActivity = async () => {
    if (!selectedImportedLead) { setMessage("Select an imported lead first."); return; }
    const summary = activityDraft.summary.trim() || LEAD_ACTIVITY_TYPES.find(type => type.value === activityDraft.activityType)?.label || "Activity logged";
    const { error } = await createImportedLandLeadActivity({
      leadId: selectedImportedLead.id,
      actor: user,
      activityType: activityDraft.activityType,
      summary,
      nextFollowUpDate: activityDraft.nextFollowUpDate || null,
    });
    if (error) { setMessage(error); return; }
    const [leadRows, activityRows] = await Promise.all([fetchImportedLandLeads(500), fetchImportedLandLeadActivities(selectedImportedLead.id)]);
    setImportedLeads(leadRows);
    setLeadActivities(activityRows);
    addToDailyBrief(`${statusLabel(activityDraft.activityType)}: ${leadLabel(selectedImportedLead)} — ${summary}`, {
      outreach_sent: ["called", "texted", "emailed", "left-voicemail"].includes(activityDraft.activityType) ? (briefDraft.outreach_sent ?? 0) + 1 : briefDraft.outreach_sent,
      seller_replies: activityDraft.activityType === "interested" ? (briefDraft.seller_replies ?? 0) + 1 : briefDraft.seller_replies,
      leads_updated: (briefDraft.leads_updated ?? 0) + 1,
      calls_completed: ["called", "left-voicemail"].includes(activityDraft.activityType) ? (briefDraft.calls_completed ?? 0) + 1 : briefDraft.calls_completed,
      follow_ups_needed: activityDraft.activityType === "follow-up-set" ? appendBriefText(briefDraft.follow_ups_needed, `${leadLabel(selectedImportedLead)} follow-up set for ${activityDraft.nextFollowUpDate || "next available date"}.`) : briefDraft.follow_ups_needed,
    });
    setActivityDraft({ activityType: "called", summary: "", nextFollowUpDate: "" });
    setMessage("Lead activity logged.");
  };

  const handleClockIn = async () => {
    if (!user) return;
    setClockBusy(true);
    setMessage("");
    const { data, error } = await clockInVa(user);
    setClockBusy(false);
    if (error && !data) { setMessage(error); return; }
    if (data) setOpenShift(data);
    void reload(user);
    setMessage("Clocked in. Your biweekly time period is now tracking.");
  };

  const handleClockOut = async () => {
    if (!user || !openShift) return;
    setClockBusy(true);
    setMessage("");
    const { data, error } = await clockOutVa(openShift, shiftNotes);
    setClockBusy(false);
    if (error) { setMessage(error); return; }
    setOpenShift(null);
    setShiftNotes("");
    if (data) {
      setBriefDraft(prev => ({
        ...prev,
        work_date: vaDateKey(data.clock_in_at),
        hours_worked: Number(((todaysSubmittedMinutes + (data.duration_minutes ?? 0)) / 60).toFixed(2)),
      }));
    }
    void reload(user);
    setMessage("Clocked out. Submitted time is ready for member review.");
  };

  const startInlineTimeEdit = (entry: VaTimeEntry, requestType: VaTimeChangeRequestType) => {
    setInlineTimeEditId(entry.id);
    setInlineTimeDraft({
      entryId: entry.id,
      requestType,
      clockIn: toVaDateTimeInput(entry.clock_in_at),
      clockOut: toVaDateTimeInput(entry.clock_out_at),
      notes: entry.notes ?? "",
      reason: "",
    });
  };

  const sendTimeChangeRequest = async (draft: typeof timeRequestDraft, afterSave: () => void) => {
    if (!user) return;
    setTimeRequestSaving(true);
    setMessage("");
    const selectedEntry = timeEntries.find(entry => entry.id === draft.entryId);
    const { data, error } = await createVaTimeChangeRequest({
      entryId: draft.entryId || null,
      operatorName: user,
      requestType: draft.requestType,
      requestedClockInAt: draft.requestType === "void-shift"
        ? selectedEntry?.clock_in_at ?? null
        : fromVaDateTimeInput(draft.clockIn),
      requestedClockOutAt: draft.requestType === "void-shift"
        ? selectedEntry?.clock_out_at ?? null
        : fromVaDateTimeInput(draft.clockOut),
      requestedNotes: draft.notes,
      reason: draft.reason,
    });
    setTimeRequestSaving(false);
    if (error) { setMessage(error); return; }
    if (data) {
      setTimeChangeRequests(prev => [data, ...prev].slice(0, 50));
      await Promise.all(activeMemberNames.map(member => createNotification({
        title: `VA time correction requested: ${user}`,
        body: `${statusLabel(data.request_type)} · ${data.reason}`,
        priority: "high",
        assigned_to: member,
        href: "/operations",
        source_table: "meridian_va_time_change_requests",
        source_id: data.id,
        notification_type: "va-time-change-request",
      }, user)));
    }
    afterSave();
    setMessage("Time change request sent for member review.");
  };

  const submitTimeChangeRequest = async () => {
    await sendTimeChangeRequest(timeRequestDraft, () => {
      setTimeRequestDraft({ entryId: "", requestType: "add-shift", clockIn: "", clockOut: "", notes: "", reason: "" });
    });
  };

  const submitInlineTimeEdit = async () => {
    await sendTimeChangeRequest(inlineTimeDraft, () => {
      setInlineTimeEditId(null);
      setInlineTimeDraft({ entryId: "", requestType: "edit-shift", clockIn: "", clockOut: "", notes: "", reason: "" });
    });
  };

  const startBriefEdit = (brief: VaDailyBrief) => {
    setEditingBriefId(brief.id);
    setBriefRevisionNote("");
    setBriefDraft({
      work_date: brief.work_date,
      hours_worked: brief.hours_worked ?? null,
      leads_added: brief.leads_added ?? null,
      leads_updated: brief.leads_updated ?? null,
      outreach_sent: brief.outreach_sent ?? null,
      seller_replies: brief.seller_replies ?? null,
      calls_completed: brief.calls_completed ?? null,
      deals_submitted: brief.deals_submitted ?? null,
      va_tasks_completed: brief.va_tasks_completed ?? null,
      checklist_items_cleared: brief.checklist_items_cleared ?? null,
      activities_completed: brief.activities_completed,
      follow_ups_needed: brief.follow_ups_needed ?? "",
      blockers: brief.blockers ?? "",
      tomorrow_plan: brief.tomorrow_plan ?? "",
    });
    setActiveTab("brief");
    setMessage("Brief loaded for editing.");
  };

  const cancelBriefEdit = () => {
    setEditingBriefId(null);
    setBriefRevisionNote("");
    setBriefDraft(EMPTY_BRIEF());
  };

  const autofillBriefStats = () => {
    const date = briefDraft.work_date;
    const sameDay = (iso?: string | null) => !!iso && iso.slice(0, 10) === date;
    const ownDeals = deals.filter(deal => deal.created_by === user || deal.submitted_by === user || deal.assigned_to === user);
    const touchedImportedLeads = importedLeads.filter(lead => sameDay(lead.last_activity_at) || sameDay(lead.last_sms_at));
    setBriefDraft(prev => ({
      ...prev,
      leads_added: ownDeals.filter(deal => sameDay(deal.created_at)).length,
      leads_updated: ownDeals.filter(deal => sameDay(deal.updated_at)).length + touchedImportedLeads.length,
      outreach_sent: touchedImportedLeads.filter(lead => ["called", "texted", "emailed", "left-voicemail"].includes(lead.last_activity_type || "") || lead.last_sms_direction === "outbound").length,
      seller_replies: touchedImportedLeads.filter(lead => lead.status === "interested" || lead.last_sms_direction === "inbound").length,
      calls_completed: touchedImportedLeads.filter(lead => lead.last_activity_type === "called" || lead.last_activity_type === "left-voicemail").length,
      deals_submitted: ownDeals.filter(deal => deal.status === "under-review" && sameDay(deal.updated_at)).length,
      va_tasks_completed: completedAssignedTasksToday.length,
      checklist_items_cleared: checklist.filter(item => sameDay(item.updated_at) && (item.status === "cleared" || item.status === "not-applicable") && item.updated_by === user).length,
      hours_worked: todaysSubmittedMinutes > 0 ? Number((todaysSubmittedMinutes / 60).toFixed(2)) : prev.hours_worked,
    }));
  };

  const changeAssignedTaskStatus = async (task: ActionItem, status: ActionItemStatus) => {
    if (!user) return;
    const note = status === "blocked" ? window.prompt("What is blocking this task?") ?? "" : "";
    const { error } = await updateActionItemStatus(task.id, status, user, note);
    if (error) { setMessage(error); return; }
    const now = new Date().toISOString();
    const nextTask = {
      ...task,
      status,
      updated_at: now,
      updated_by: user,
      completed_at: status === "done" ? now : null,
      completed_by: status === "done" ? user : null,
      blocker_reason: status === "blocked" ? note.trim() || null : null,
    };
    setAssignedTasks(prev => prev.map(row => row.id === task.id ? nextTask : row));
    if (status === "done") {
      setBriefDraft(prev => ({
        ...prev,
        va_tasks_completed: (prev.va_tasks_completed ?? completedAssignedTasksToday.length) + 1,
        activities_completed: appendBriefText(prev.activities_completed, `Completed member-assigned task: ${task.title}`),
      }));
      const doneRecipients = task.created_by ? [task.created_by] : [null];
      await Promise.all(doneRecipients.map(recipient => createNotification({
        title: `VA task completed: ${task.title}`,
        body: `${user} marked this task done. ${taskRecordLabel(task)}.`,
        priority: "normal",
        assigned_to: recipient,
        href: "/actions",
        source_table: "action_items",
        source_id: task.id,
        notification_type: "va-task-completed",
      }, user)));
    }
    if (status === "blocked") {
      const blockedRecipients = Array.from(new Set([task.created_by, ...activeMemberNames].filter(Boolean))) as string[];
      await Promise.all(blockedRecipients.map(recipient => createNotification({
        title: `VA task blocked: ${task.title}`,
        body: `${note.trim() || `${user} marked this task blocked.`} ${taskRecordLabel(task)}.`,
        priority: "high",
        assigned_to: recipient,
        href: "/actions",
        source_table: "action_items",
        source_id: task.id,
        notification_type: "va-task-blocked",
        dedupe: true,
      }, user)));
    }
    setMessage(status === "done" ? "Task completed and added to the daily brief." : `Task marked ${statusLabel(status)}.`);
  };

  const pullSakariBrief = async () => {
    const date = briefDraft.work_date;
    const sameDay = (iso?: string | null) => !!iso && iso.slice(0, 10) === date;
    const rows = await fetchCommunicationEvents({ limit: 200 });
    const todayEvents = rows.filter(event => sameDay(event.provider_created_at || event.created_at));
    const outbound = todayEvents.filter(event => event.direction === "outbound");
    const inbound = todayEvents.filter(event => event.direction === "inbound");
    const unmatchedInbound = inbound.filter(event => !event.matched_lead_id && !event.matched_deal_id);
    const hotReplies = inbound.filter(event => {
      const body = (event.body || "").toLowerCase();
      return event.matched_lead_id || event.matched_deal_id || ["offer", "price", "interested", "call", "yes", "sell"].some(term => body.includes(term));
    }).slice(0, 6);
    const lineFor = (event: CommunicationEvent) => {
      const who = event.contact_name || event.contact_number || event.from_number || event.to_number || "Unknown seller";
      const body = event.body ? `: ${event.body}` : "";
      return `- ${who}${body}`;
    };
    const activityLines = [
      `Sakari SMS: ${outbound.length} sent, ${inbound.length} seller replies received.`,
      hotReplies.length ? `Priority replies:\n${hotReplies.map(lineFor).join("\n")}` : "",
    ].filter(Boolean).join("\n");
    const followUpLines = [
      unmatchedInbound.length ? `Unmatched inbound SMS needing match/review:\n${unmatchedInbound.slice(0, 8).map(lineFor).join("\n")}` : "",
    ].filter(Boolean).join("\n");
    setBriefDraft(prev => ({
      ...prev,
      outreach_sent: Math.max(prev.outreach_sent ?? 0, outbound.length),
      seller_replies: Math.max(prev.seller_replies ?? 0, inbound.length),
      leads_updated: Math.max(prev.leads_updated ?? 0, importedLeads.filter(lead => sameDay(lead.last_sms_at)).length),
      activities_completed: appendBriefText(prev.activities_completed, activityLines || "Sakari SMS: no messages for this work date."),
      follow_ups_needed: appendBriefText(prev.follow_ups_needed, followUpLines),
      blockers: unmatchedInbound.length
        ? appendBriefText(prev.blockers, `${unmatchedInbound.length} inbound SMS ${unmatchedInbound.length === 1 ? "is" : "are"} unmatched and need lead/deal assignment.`)
        : prev.blockers,
    }));
    setMessage(todayEvents.length ? `Pulled ${todayEvents.length} Sakari event${todayEvents.length === 1 ? "" : "s"} into the daily brief.` : "No Sakari messages found for that work date.");
  };

  const submitDailyBrief = async () => {
    setBriefSaving(true);
    setMessage("");
    const { data, error } = editingBriefId
      ? await updateVaDailyBrief(editingBriefId, briefDraft, user, briefRevisionNote)
      : await createVaDailyBrief(briefDraft, user);
    setBriefSaving(false);
    if (error) { setMessage(error); return; }
    if (data) {
      await Promise.all(activeMemberNames.map(member => createNotification({
        title: editingBriefId ? `VA daily brief updated: ${data.submitted_by}` : `VA daily brief ready: ${data.submitted_by}`,
        body: `${data.work_date} · ${data.hours_worked ?? 0} hours · ${data.leads_added ?? 0} leads added · ${data.deals_submitted ?? 0} deals submitted`,
        priority: data.blockers ? "high" : "normal",
        assigned_to: member,
        href: "/operations",
        source_table: "meridian_va_daily_briefs",
        source_id: data.id,
        notification_type: editingBriefId ? "va-daily-brief-update" : "va-daily-brief",
      }, user)));
      setBriefs(prev => editingBriefId
        ? prev.map(brief => brief.id === data.id ? data : brief)
        : [data, ...prev].slice(0, 8));
      setBriefDraft(EMPTY_BRIEF());
      setEditingBriefId(null);
      setBriefRevisionNote("");
      setMessage(editingBriefId ? "Daily brief updated for member review." : "Daily brief submitted for member review.");
    }
  };

  const cleared = checklist.filter(i => i.status === "cleared" || i.status === "not-applicable").length;
  const blocked = checklist.filter(i => i.status === "blocked").length;
  const vaFlowCards = [
    {
      label: "Clock",
      value: openShift ? formatDuration(liveShiftMinutes) : "Ready",
      detail: openShift ? "Shift is running" : "Start shift before work",
      action: openShift ? "Clock Out" : "Clock In",
      onAction: openShift ? handleClockOut : handleClockIn,
      hot: !!openShift,
      disabled: clockBusy,
    },
    {
      label: "Lists",
      value: String(importedLeads.length),
      detail: "Imported leads available",
      action: "Open Lists",
      onAction: () => goToTab("lists"),
      hot: importStats.newRows > 0,
    },
    {
      label: "Queue",
      value: String(workdeskLeadRows.length),
      detail: "Seller records in queue",
      action: "Work Queue",
      onAction: () => goToTab("outreach"),
      hot: unmatchedSms.length > 0 || followUpsDue.length > 0,
    },
    {
      label: "Packets",
      value: String(draftLeads.length),
      detail: "Draft deal briefs",
      action: "Build Packet",
      onAction: () => draftLeads[0] ? openDealBrief(draftLeads[0]) : goToTab("packet"),
      hot: interestedLeads.length > 0,
    },
    {
      label: "Brief",
      value: portalStats.briefSubmitted ? "Done" : "Open",
      detail: "Member daily summary",
      action: "End Shift",
      onAction: () => goToTab("brief"),
      hot: !portalStats.briefSubmitted,
    },
  ];
  const headerCopy: Record<VaTab, { eyebrow: string; title: string; subtitle: string }> = {
    today: {
      eyebrow: "VA Desk",
      title: "Sophie Workdesk",
      subtitle: "Start the shift, see the next priority, then jump into calls, lists, packets, tasks, records, or the daily brief.",
    },
    outreach: {
      eyebrow: "Contact Queue",
      title: "Contact Queue",
      subtitle: "Work seller replies, due follow-ups, calls, texts, and outcomes from one queue.",
    },
    lists: {
      eyebrow: "Lists",
      title: "List Workspace",
      subtitle: "Import audiences, check eligibility, clean records, bulk text compliant rows, and move replies into the contact queue.",
    },
    packet: {
      eyebrow: "Packets",
      title: "Packet Builder",
      subtitle: "Turn qualified seller interest into a member-ready review packet with diligence, calculator notes, and a clear ask.",
    },
    brief: {
      eyebrow: "Daily Brief",
      title: "End Shift Brief",
      subtitle: "Review time, summarize completed work, log blockers, and set the next-shift plan for members.",
    },
  };
  const headerSecondaryAction = {
    ...secondaryButton,
    background: "rgba(237,230,214,0.04)",
    borderColor: "rgba(237,230,214,0.55)",
    color: "var(--bone)",
  };
  const headerPrimaryAction = {
    ...primaryButton,
    background: "var(--brass)",
    borderColor: "var(--brass)",
    color: "var(--obsidian)",
  };
  const headerActions: Record<VaTab, React.ReactNode> = {
    today: (
      <>
      <button onClick={() => goToTab("lists")} style={headerSecondaryAction}>Import List</button>
      <button onClick={() => selectedImportedLead ? document.getElementById("va-workdesk-note")?.focus() : goToTab("outreach")} style={headerSecondaryAction}>Log Call</button>
      <button onClick={startNew} style={headerPrimaryAction}>New Deal Brief</button>
      <button onClick={() => goToTab("brief")} style={headerSecondaryAction}>End Shift Brief</button>
      </>
    ),
    outreach: (
      <>
      <button onClick={() => setBulkSmsDrawerOpen(true)} disabled={bulkEligibleLeads.length === 0} style={{ ...headerSecondaryAction, opacity: bulkEligibleLeads.length === 0 ? 0.55 : 1 }}>Bulk Text</button>
      <button onClick={startNew} style={headerPrimaryAction}>New Deal Brief</button>
      </>
    ),
    lists: (
      <>
      <button onClick={startNewImport} style={headerSecondaryAction}>New Import</button>
      <button onClick={() => setBulkSmsDrawerOpen(true)} disabled={bulkEligibleLeads.length === 0} style={{ ...headerSecondaryAction, opacity: bulkEligibleLeads.length === 0 ? 0.55 : 1 }}>Bulk Text</button>
      <button onClick={() => goToTab("outreach")} style={headerPrimaryAction}>Work Contact Queue</button>
      </>
    ),
    packet: (
      <>
      <button onClick={startNew} style={headerSecondaryAction}>New Packet</button>
      {selected && <button onClick={() => router.push(`/opportunity?deal=${selected.id}`)} style={headerSecondaryAction}>Shared File</button>}
      <button onClick={() => saveDeal("under-review")} disabled={saving} style={{ ...headerPrimaryAction, opacity: saving ? 0.6 : 1 }}>Submit Review</button>
      </>
    ),
    brief: (
      <>
      <button onClick={autofillBriefStats} style={headerSecondaryAction}>Auto-fill</button>
      <button onClick={pullSakariBrief} style={headerSecondaryAction}>Pull Comms</button>
      <button onClick={openShift ? handleClockOut : handleClockIn} disabled={clockBusy} style={{ ...headerPrimaryAction, opacity: clockBusy ? 0.65 : 1 }}>
        {clockBusy ? "Saving..." : openShift ? "Clock Out" : "Clock In"}
      </button>
      </>
    ),
  };
  const headerStats = activeTab === "today" ? vaFlowCards.map(card => ({
    label: card.label,
    value: card.value,
    detail: card.detail,
    action: card.action,
    onAction: card.disabled ? undefined : card.onAction,
    tone: card.hot ? "hot" as const : card.label === "Brief" && portalStats.briefSubmitted ? "good" as const : "default" as const,
  })) : activeTab === "outreach" ? [
    { label: "Seller Replies", value: String(recentInboundSms.length), detail: "Recent seller replies", action: "Open", onAction: () => goToTab("outreach"), tone: recentInboundSms.length ? "hot" as const : "default" as const },
    { label: "Follow-ups", value: String(followUpsDue.length), detail: "Dated follow-ups due", action: "Review", onAction: () => goToTab("outreach"), tone: followUpsDue.length ? "hot" as const : "default" as const },
    { label: "Interested", value: String(interestedLeads.length), detail: "Sellers showing interest", action: "Open Leads", onAction: () => { setLeadFilter("interested"); goToTab("lists"); }, tone: interestedLeads.length ? "hot" as const : "default" as const },
    { label: "Draft Packets", value: String(draftLeads.length), detail: "Leads ready to package", action: "Build", onAction: () => draftLeads[0] ? openDealBrief(draftLeads[0]) : goToTab("packet"), tone: draftLeads.length ? "hot" as const : "default" as const },
  ] : activeTab === "lists" ? [
    { label: "Imported", value: String(importedLeads.length), detail: "Total list records", action: "Upload", onAction: startNewImport, tone: "default" as const },
    { label: "New", value: String(importStats.newRows), detail: "Fresh from lists", action: "Filter", onAction: () => setLeadFilter("new"), tone: importStats.newRows ? "hot" as const : "default" as const },
    { label: "Eligible", value: String(bulkEligibleLeads.length), detail: "Current view recipients", action: "Bulk Text", onAction: () => setBulkSmsDrawerOpen(true), tone: bulkEligibleLeads.length ? "hot" as const : "default" as const },
    { label: "Converted", value: String(importStats.converted), detail: "Moved into deal flow", action: "Packets", onAction: () => goToTab("packet"), tone: "default" as const },
  ] : activeTab === "packet" ? [
    { label: "Active Packets", value: String(deals.length), detail: "Drafts and reviews", action: "New", onAction: startNew, tone: "default" as const },
    { label: "Ready Checks", value: `${readyCount}/${readinessItems.length}`, detail: "Quality checks complete", action: "Review", onAction: () => goToTab("packet"), tone: submissionReady ? "hot" as const : "default" as const },
    { label: "Submitted Today", value: String(portalStats.submittedToday), detail: "Member review packets", action: "Open Records", onAction: () => router.push("/crm?view=deals"), tone: "default" as const },
    { label: "Missing Items", value: String(missingReadyItems.length), detail: "Before packet is clean", action: "Fix", onAction: () => goToTab("packet"), tone: missingReadyItems.length ? "hot" as const : "default" as const },
  ] : [
    { label: "Clock", value: openShift ? formatDuration(liveShiftMinutes) : "Ready", detail: openShift ? "Shift is running" : "Not clocked in", action: openShift ? "Clock Out" : "Clock In", onAction: openShift ? handleClockOut : handleClockIn, tone: openShift ? "hot" as const : "default" as const },
    { label: "Hours", value: String(briefDraft.hours_worked ?? (todaysSubmittedMinutes / 60).toFixed(2)), detail: "For this brief date", action: "Auto-fill", onAction: autofillBriefStats, tone: "default" as const },
    { label: "Tasks Done", value: String(briefDraft.va_tasks_completed ?? completedAssignedTasksToday.length), detail: "Member-assigned work completed", action: "Review", onAction: () => goToTab("today"), tone: "default" as const },
    { label: "Brief", value: portalStats.briefSubmitted ? "Done" : "Open", detail: "Member daily summary", action: "Submit", onAction: submitDailyBrief, tone: portalStats.briefSubmitted ? "good" as const : "hot" as const },
  ];

  return (
    <div className="va-root" style={{ maxWidth: 1680, margin: "0 auto", padding: "82px 20px 100px" }}>
      <div className="va-tabs" style={{ ...panel, padding: 8, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => goToTab(tab.value)}
            style={activeTab === tab.value ? tabActive : tabButton}
          >
            {tab.label}
            <span style={activeTab === tab.value ? tabCountActive : tabCount}>
              {tabCounts[tab.value]}
            </span>
          </button>
        ))}
      </div>

      <OperatingHeader
        eyebrow={headerCopy[activeTab].eyebrow}
        title={headerCopy[activeTab].title}
        subtitle={headerCopy[activeTab].subtitle}
        user={user}
        mode="va"
        actions={headerActions[activeTab]}
        stats={headerStats}
      />

      <TwilioPhoneDock actor={user} />

      <input
        ref={leadCsvInputRef}
        type="file"
        accept=".csv,text/csv"
        disabled={importing}
        onChange={e => { void handleLeadCsvUpload(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
        style={{ display: "none" }}
      />

      {message && (
        <div style={{ ...panel, padding: 12, marginBottom: 16, borderColor: message.includes("issue") || message.includes("Add") || message.includes("could") ? "var(--obsidian)" : "var(--brass)" }}>
          <p style={{ fontSize: 13, color: "var(--ink)" }}>{message}</p>
        </div>
      )}

      {!openShift && (
        <section style={clockInBanner} className="va-clock-banner">
          <div>
            <p style={{ ...eyebrowSmall, color: "var(--bone)", opacity: 0.85 }}>Shift status</p>
            <h2 style={{ ...sectionTitle, color: "var(--bone)", fontSize: 24, marginTop: 2 }}>You&apos;re not clocked in</h2>
            <p style={{ color: "var(--bone)", opacity: 0.78, fontSize: 13, marginTop: 6 }}>
              Clock in before logging activity. Your shift drives the daily brief, time approvals, and payroll.
            </p>
          </div>
          <button
            onClick={handleClockIn}
            disabled={clockBusy}
            style={{ ...primaryButton, background: "var(--brass)", color: "var(--obsidian)", borderColor: "var(--brass)", minHeight: 52, padding: "12px 22px", fontSize: 12, opacity: clockBusy ? 0.65 : 1 }}
          >
            {clockBusy ? "Saving..." : "Clock In"}
          </button>
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: activeTab === "packet" ? "330px minmax(0, 1fr)" : "1fr", gap: 18 }} className="va-workspace">
        {activeTab === "packet" && <aside style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={sectionTitle}>Packets</h2>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{deals.length} active</span>
          </div>
          {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading...</p>}
          {!loading && deals.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No active packets yet.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {deals.map(deal => {
              const active = selected?.id === deal.id;
              return (
                <button
                  key={deal.id}
                  onClick={() => { setSelectedImportedLeadId(null); setSelectedId(deal.id); setMessage(""); }}
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
                    <span style={deal.status === "under-review" ? hotPill : pill}>{statusLabel(deal.status)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.66, marginBottom: 6 }}>
                  {deal.address || deal.parcel_id || "No property detail added"}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                    <span>{deal.analysis?.recommendation ?? "Needs Review"}</span>
                    <span>{formatDate(deal.updated_at || deal.created_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid var(--fog)", marginTop: 14, paddingTop: 14 }}>
            <h3 style={{ ...sectionTitle, fontSize: 18 }}>Follow-ups</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {deals.filter(deal => deal.next_follow_up_date).slice(0, 6).map(deal => (
                <button key={`follow-${deal.id}`} onClick={() => { setSelectedImportedLeadId(null); setSelectedId(deal.id); }} style={{
                  textAlign: "left",
                  background: "var(--surface)",
                  border: "1px solid var(--fog)",
                  borderRadius: 8,
                  padding: 10,
                  cursor: "pointer",
                }}>
                  <strong style={{ display: "block", fontSize: 12, color: "var(--obsidian)" }}>{deal.title}</strong>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Due {deal.next_follow_up_date}</span>
                </button>
              ))}
              {deals.filter(deal => deal.next_follow_up_date).length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 12 }}>No dated follow-ups yet.</p>
              )}
            </div>
          </div>
        </aside>}

        <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {activeTab === "today" && (
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <p style={eyebrowSmall}>Briefing</p>
                <h2 style={sectionTitle}>{`Good ${greetingForHour(new Date().getHours())}${user ? `, ${user.split(" ")[0]}` : ""}`}</h2>
                <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                  {openShift ? `On shift for ${formatDuration(liveShiftMinutes)}.` : "Start with clock-in above."} {portalStats.briefSubmitted ? "Daily brief is submitted." : "Daily brief still open."}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => goToTab("outreach")} style={secondaryButton}>Open Contact Queue</button>
                <button onClick={() => draftLeads[0] ? openDealBrief(draftLeads[0]) : goToTab("packet")} style={secondaryButton}>Build packet</button>
                <button onClick={() => goToTab("brief")} style={primaryButton}>End shift</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }} className="va-briefing-grid">
              <BriefingCard
                eyebrow="Member notes"
                title={openAssignedTasks.length ? `${openAssignedTasks.length} task${openAssignedTasks.length === 1 ? "" : "s"} from members` : "No new member notes"}
                detail={openAssignedTasks[0]
                  ? `${openAssignedTasks[0].title}${openAssignedTasks[0].created_by ? ` — from ${openAssignedTasks[0].created_by}` : ""}`
                  : "Members will route tasks here when they need something done."}
                tone={openAssignedTasks.length ? "hot" : "calm"}
                actionLabel={openAssignedTasks[0] ? "Open Record" : undefined}
                onAction={openAssignedTasks[0] ? () => router.push(taskRecordHref(openAssignedTasks[0])) : undefined}
              />
              <BriefingCard
                eyebrow="Overnight replies"
                title={recentInboundSms.length ? `${recentInboundSms.length} new seller reply${recentInboundSms.length === 1 ? "" : "ies"}` : "No new replies"}
                detail={recentInboundSms[0]
                  ? `${recentInboundSms[0].contact_name || recentInboundSms[0].contact_number || recentInboundSms[0].from_number || "Seller"}: ${(recentInboundSms[0].body || "").slice(0, 80)}${(recentInboundSms[0].body || "").length > 80 ? "…" : ""}`
                  : "Sakari inbox is clear since last shift."}
                tone={recentInboundSms.length ? "hot" : "calm"}
                actionLabel={recentInboundSms.length ? "Read Replies" : undefined}
                onAction={recentInboundSms.length ? () => goToTab("outreach") : undefined}
              />
              <BriefingCard
                eyebrow="Hot deals"
                title={deals.filter(deal => deal.urgency === "hot").length
                  ? `${deals.filter(deal => deal.urgency === "hot").length} flagged hot`
                  : interestedLeads.length
                    ? `${interestedLeads.length} interested seller${interestedLeads.length === 1 ? "" : "s"}`
                    : "No hot items"}
                detail={(() => {
                  const hot = deals.find(deal => deal.urgency === "hot");
                  if (hot) return `${hot.title} — ${statusLabel(hot.status)}`;
                  if (interestedLeads[0]) return `${interestedLeads[0].owner_name || "Interested seller"} replied. Build a packet.`;
                  return "No urgent deals or interested sellers right now.";
                })()}
                tone={(deals.some(deal => deal.urgency === "hot") || interestedLeads.length) ? "hot" : "calm"}
                actionLabel={deals.some(deal => deal.urgency === "hot") ? "Open Deal" : interestedLeads.length ? "Build Packet" : undefined}
                onAction={(() => {
                  const hot = deals.find(deal => deal.urgency === "hot");
                  if (hot) return () => openDealBrief(hot);
                  if (interestedLeads[0]) return () => loadImportedLead(interestedLeads[0], false);
                  return undefined;
                })()}
              />
              <BriefingCard
                eyebrow="Blockers"
                title={(() => {
                  const blockedTasks = assignedTasks.filter(task => task.status === "blocked");
                  if (blockedTasks.length) return `${blockedTasks.length} task${blockedTasks.length === 1 ? "" : "s"} blocked`;
                  const lastBlock = briefs.find(brief => brief.blockers && brief.blockers.trim());
                  if (lastBlock) return "Open blocker from last brief";
                  return "No blockers";
                })()}
                detail={(() => {
                  const blockedTasks = assignedTasks.filter(task => task.status === "blocked");
                  if (blockedTasks[0]) return `${blockedTasks[0].title}: ${blockedTasks[0].blocker_reason || "Needs member input"}`;
                  const lastBlock = briefs.find(brief => brief.blockers && brief.blockers.trim());
                  if (lastBlock) return (lastBlock.blockers || "").slice(0, 100);
                  return "Nothing waiting on a member decision.";
                })()}
                tone={assignedTasks.some(task => task.status === "blocked") ? "warn" : "calm"}
                actionLabel={assignedTasks.some(task => task.status === "blocked") ? "Open Record" : undefined}
                onAction={(() => {
                  const blockedTask = assignedTasks.find(task => task.status === "blocked");
                  if (blockedTask) return () => router.push(taskRecordHref(blockedTask));
                  return undefined;
                })()}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.8fr) minmax(0, 1.2fr) minmax(320px, 0.9fr)", gap: 14 }} className="va-home-grid">
              <section style={{ ...subPanel, background: "var(--obsidian)", color: "var(--bone)", borderColor: "rgba(20,17,13,0.88)" }}>
                <p style={{ ...eyebrowSmall, color: "var(--brass)" }}>Shift</p>
                <h3 style={{ fontFamily: DISPLAY_FONT, fontSize: 32, fontWeight: 500, color: "var(--bone)", lineHeight: 1.05, marginTop: 6 }}>
                  {openShift ? formatDuration(liveShiftMinutes) : "Ready"}
                </h3>
                <p style={{ color: "rgba(247,242,232,0.72)", fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                  {openShift ? "You are clocked in. Work the next queue, then submit the daily brief before leaving." : "Clock in first, then work seller replies, assigned tasks, and packets."}
                </p>
                <button onClick={openShift ? handleClockOut : handleClockIn} disabled={clockBusy} style={{ ...primaryButton, width: "100%", marginTop: 14, background: "var(--bone)", color: "var(--obsidian)", borderColor: "var(--bone)", opacity: clockBusy ? 0.65 : 1 }}>
                  {clockBusy ? "Saving..." : openShift ? "Clock Out" : "Clock In"}
                </button>
              </section>

              <section style={subPanel}>
                <p style={eyebrowSmall}>Next best action</p>
                <h3 style={{ ...sectionTitle, fontSize: 28, marginTop: 5 }}>
                  {recentInboundSms.length ? "Review seller replies" : openAssignedTasks.length ? "Handle member-assigned tasks" : interestedLeads.length ? "Build interested seller packets" : importStats.newRows ? "Start with new list leads" : "Review the daily brief"}
                </h3>
                <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
                  {recentInboundSms.length ? `${recentInboundSms.length} seller repl${recentInboundSms.length === 1 ? "y is" : "ies are"} visible in Contact Queue, including matched and unmatched replies.`
                    : openAssignedTasks.length ? `${openAssignedTasks.length} task${openAssignedTasks.length === 1 ? "" : "s"} from members need a status update.`
                      : interestedLeads.length ? `${interestedLeads.length} interested seller${interestedLeads.length === 1 ? "" : "s"} can be moved toward a deal packet.`
                        : importStats.newRows ? `${importStats.newRows} new imported lead${importStats.newRows === 1 ? "" : "s"} are ready for outreach.`
                          : "No urgent seller queue is waiting. Keep the brief current or prep the next list."}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 14 }} className="two-col">
                  <button onClick={() => goToTab("outreach")} style={secondaryButton}>Open Contact Queue</button>
                  <button onClick={() => goToTab("brief")} style={primaryButton}>Daily Brief</button>
                </div>
              </section>

              <section style={subPanel}>
                <p style={eyebrowSmall}>Member-assigned tasks</p>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginTop: 4, marginBottom: 10 }}>
                  <h3 style={{ ...sectionTitle, fontSize: 24 }}>{openAssignedTasks.length} open</h3>
                  <button onClick={() => router.push("/actions")} style={inlineTextButton}>All tasks →</button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {openAssignedTasks.slice(0, 3).map(task => (
                    <button key={task.id} onClick={() => router.push(taskRecordHref(task))} style={{ ...subPanel, textAlign: "left", cursor: "pointer", padding: 10 }}>
                      <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{task.title}</strong>
                      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{task.due_date ? `Due ${task.due_date}` : "No due date"} · {statusLabel(task.priority || "normal")}</p>
                    </button>
                  ))}
                  {openAssignedTasks.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.45 }}>No member-assigned VA tasks are open.</p>}
                </div>
              </section>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 14 }} className="number-grid">
              <button onClick={() => goToTab("outreach")} style={homeMetricButton}>
                <span>Incoming Texts</span>
                <strong>{recentInboundSms.length}</strong>
                <small>Matched + unmatched</small>
              </button>
              <button onClick={() => goToTab("outreach")} style={homeMetricButton}>
                <span>Follow-ups</span>
                <strong>{followUpsDue.length}</strong>
                <small>Due now</small>
              </button>
              <button onClick={() => { setLeadFilter("new"); goToTab("lists"); }} style={homeMetricButton}>
                <span>New Leads</span>
                <strong>{importStats.newRows}</strong>
                <small>From lists</small>
              </button>
              <button onClick={() => draftLeads[0] ? openDealBrief(draftLeads[0]) : goToTab("packet")} style={homeMetricButton}>
                <span>Draft Packets</span>
                <strong>{draftLeads.length}</strong>
                <small>Ready to build</small>
              </button>
            </div>

            <div style={{ display: "none" }} className="workdesk-grid">
              <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
                <section style={subPanel}>
                  <p style={eyebrowSmall}>Today&apos;s queues</p>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <QueueButton label="New imported leads" detail="Fresh from land lists" count={importStats.newRows} onClick={() => { setActiveTab("lists"); setLeadFilter("new"); }} />
                    <QueueButton label="Seller replies" detail="Matched and unmatched conversations" count={recentInboundSms.length} hot={!!recentInboundSms.length} onClick={() => setActiveTab("outreach")} />
                    <QueueButton label="Interested sellers" detail="Replied and expressed interest" count={interestedLeads.length} hot={!!interestedLeads.length} onClick={() => { setLeadFilter("interested"); setActiveTab("lists"); }} />
                    <QueueButton label="Follow-up due" detail="No reply in 24-72 hrs" count={followUpsDue.length} hot={!!followUpsDue.length} onClick={() => setActiveTab("outreach")} />
                    <QueueButton label="Member-assigned tasks" detail="From member portal" count={openAssignedTasks.length} hot={!!openAssignedTasks.length} onClick={() => setActiveTab("today")} />
                    <QueueButton label="Bad numbers / DNC" detail="Invalid or do not contact" count={importedLeads.filter(lead => lead.status === "passed" || lead.sms_opt_status === "opted-out").length} onClick={() => { setLeadFilter("passed"); setActiveTab("lists"); }} />
                    <QueueButton label="Deal brief drafts" detail="In progress" count={draftLeads.length} onClick={() => draftLeads[0] ? openDealBrief(draftLeads[0]) : setActiveTab("packet")} />
                  </div>
                </section>
                <section style={subPanel}>
                  <p style={eyebrowSmall}>My stats today</p>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <MiniStat label="Texts sent" value={String(briefDraft.outreach_sent ?? 0)} />
                    <MiniStat label="Replies received" value={String(briefDraft.seller_replies ?? unmatchedSms.length)} />
                    <MiniStat label="Leads updated" value={String(briefDraft.leads_updated ?? portalStats.updatedToday)} />
                    <MiniStat label="Tasks done" value={String(briefDraft.va_tasks_completed ?? completedAssignedTasksToday.length)} />
                    <MiniStat label="On shift" value={openShift ? formatDuration(liveShiftMinutes) : "Ready"} />
                  </div>
                  <button onClick={openShift ? handleClockOut : handleClockIn} disabled={clockBusy} style={{ ...primaryButton, width: "100%", marginTop: 10, opacity: clockBusy ? 0.65 : 1 }}>
                    {clockBusy ? "Saving..." : openShift ? "Clock Out" : "Clock In"}
                  </button>
                </section>
              </aside>

              <section style={subPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <p style={eyebrowSmall}>Work queue</p>
                    <h2 style={{ ...sectionTitle, fontSize: 22 }}>Seller replies and lead actions</h2>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={secondaryButton}>Priority</button>
                    <button onClick={() => void reload(user)} style={secondaryButton}>Refresh</button>
                  </div>
                </div>
                <div style={{ overflowX: "auto", border: "1px solid var(--fog)", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                    <thead>
                      <tr>
                        {["Priority", "Owner / phone", "County", "Acres", "Parcel ID", "Source list", "Status", "Last touch", "Next action", "Actions"].map(head => (
                          <th key={head} style={tableHead}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {workdeskLeadRows.map(lead => {
                        const active = selectedImportedLeadId === lead.id;
                        const phone = lead.phone || lead.phone_2 || "No phone";
                        return (
                          <tr key={lead.id} onClick={() => selectImportedLead(lead)} style={{ background: active ? "rgba(176,137,84,0.14)" : "var(--surface)", cursor: "pointer" }}>
                            <td style={tableCell}>{(lead.lead_score ?? 0) >= 70 || lead.status === "interested" ? "★" : "☆"}</td>
                            <td style={tableCell}><strong>{lead.owner_name || "Owner unknown"}</strong><br /><span>{phone}</span></td>
                            <td style={tableCell}>{lead.county || "—"}</td>
                            <td style={tableCell}>{lead.acreage ?? "—"}</td>
                            <td style={tableCell}>{lead.parcel_id || "—"}</td>
                            <td style={tableCell}>{lead.campaign_source || lead.source_system || "List"}</td>
                            <td style={tableCell}><span style={lead.status === "interested" ? hotPill : pill}>{statusLabel(lead.status)}</span></td>
                            <td style={tableCell}>{lead.last_sms_at ? formatDate(lead.last_sms_at) : lead.last_activity_at ? formatDate(lead.last_activity_at) : "—"}</td>
                            <td style={tableCell}>{sellerActionState(lead).primary}</td>
                            <td style={tableCell}>
                              <div style={{ display: "flex", gap: 5 }}>
                                <button onClick={event => { event.stopPropagation(); setActivityDraft({ activityType: "called", summary: "", nextFollowUpDate: "" }); selectImportedLead(lead); }} style={iconButton}>Call</button>
                                <button onClick={event => { event.stopPropagation(); selectImportedLead(lead); window.setTimeout(() => document.getElementById("va-workdesk-sms")?.focus(), 80); }} style={iconButton}>Text</button>
                                <button onClick={event => { event.stopPropagation(); router.push(`/lead/${lead.id}`); }} style={iconButton}>Record</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {workdeskLeadRows.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, padding: 14 }}>No seller work items yet. Import a list or wait for inbound replies.</p>}
                </div>
              </section>

              <section style={subPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Member-assigned tasks</p>
                    <h2 style={{ ...sectionTitle, fontSize: 22 }}>VA work routing</h2>
                  </div>
                  <span style={pill}>{openAssignedTasks.length} open</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {openAssignedTasks.slice(0, 6).map(task => (
                    <div key={task.id} style={{ ...subPanel, background: task.status === "blocked" ? "rgba(176,137,84,0.08)" : "var(--bone)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                        <div>
                          <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{task.title}</strong>
                          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>{task.description || "No task details added."}</p>
                          <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 5 }}>
                            {task.created_by ? `Assigned by ${task.created_by}` : "Assigned"}{task.due_date ? ` · Due ${task.due_date}` : ""} · {taskRecordLabel(task)} · {statusLabel(task.status)}
                          </p>
                          {task.blocker_reason && <p style={{ color: "var(--brass)", fontSize: 12, marginTop: 5 }}>Blocked: {task.blocker_reason}</p>}
                        </div>
                        <span style={task.priority === "urgent" || task.priority === "high" ? hotPill : pill}>{statusLabel(task.priority || "normal")}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                        {task.status !== "in-progress" && <button onClick={() => changeAssignedTaskStatus(task, "in-progress")} style={secondaryButton}>Start</button>}
                        <button onClick={() => router.push(taskRecordHref(task))} style={secondaryButton}>Open Record</button>
                        <button onClick={() => changeAssignedTaskStatus(task, "done")} style={primaryButton}>Done</button>
                        <button onClick={() => changeAssignedTaskStatus(task, "blocked")} style={secondaryButton}>Blocked</button>
                      </div>
                    </div>
                  ))}
                  {openAssignedTasks.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No member-assigned VA tasks are open.</p>}
                </div>
              </section>

              <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
                {selectedImportedLead ? (
                  <SellerCommandCenter
                    lead={selectedImportedLead}
                    communications={communicationEvents}
                    activities={leadActivities}
                    smsDraft={smsDraft}
                    setSmsDraft={setSmsDraft}
                    smsSending={smsSending}
                    onSendSms={sendSmsToLead}
                    dispositionDraft={dispositionDraft}
                    setDispositionDraft={setDispositionDraft}
                    onSaveDisposition={applyLeadDisposition}
                    onQuickDisposition={quickLeadDisposition}
                    activityDraft={activityDraft}
                    setActivityDraft={setActivityDraft}
                    onLogActivity={logLeadActivity}
                    onOpenFile={() => router.push(`/lead/${selectedImportedLead.id}`)}
                    onBuildPacket={() => loadImportedLead(selectedImportedLead, true)}
                    onPass={async () => { await updateImportedLandLeadStatus(selectedImportedLead.id, "passed", selectedImportedLead.deal_id); setImportedLeads(await fetchImportedLandLeads(500)); }}
                    compact
                  />
                ) : (
                  <section style={subPanel}>
                    <p style={eyebrowSmall}>Lead panel</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22 }}>Pick a seller</h3>
                    <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>Select a row to see property data, communication history, text composer, dispositions, calculator quick estimates, and packet actions.</p>
                  </section>
                )}
              </aside>
            </div>

            <section style={{ display: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                <div>
                  <p style={eyebrowSmall}>Daily shift brief</p>
                  <h3 style={{ ...sectionTitle, fontSize: 22 }}>Member review summary</h3>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={autofillBriefStats} style={secondaryButton}>Auto-fill</button>
                  <button onClick={pullSakariBrief} style={secondaryButton}>Pull Comms</button>
                  <button onClick={() => setActiveTab("brief")} style={secondaryButton}>Edit Brief</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 10 }} className="number-grid">
                <ShiftCard label="Calls made" value={String(briefDraft.calls_completed ?? 0)} />
                <ShiftCard label="Texts sent" value={String(briefDraft.outreach_sent ?? 0)} />
                <ShiftCard label="Replies received" value={String(briefDraft.seller_replies ?? unmatchedSms.length)} tone={unmatchedSms.length ? "hot" : "calm"} />
                <ShiftCard label="Deals submitted" value={String(briefDraft.deals_submitted ?? portalStats.submittedToday)} />
                <ShiftCard label="Tasks completed" value={String(briefDraft.va_tasks_completed ?? completedAssignedTasksToday.length)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 260px", gap: 12 }} className="workdesk-brief-grid">
                <div>
                  <label style={label}>Top activities</label>
                  <textarea rows={4} value={briefDraft.activities_completed} onChange={e => setBriefDraft({ ...briefDraft, activities_completed: e.target.value })} placeholder="Calls, texts, records updated, leads converted, research completed." />
                </div>
                <div>
                  <label style={label}>Blockers / notes to members</label>
                  <textarea rows={4} value={briefDraft.follow_ups_needed ?? ""} onChange={e => setBriefDraft({ ...briefDraft, follow_ups_needed: e.target.value })} placeholder="Who needs follow-up and what members need to know." />
                </div>
                <div style={{ display: "grid", gap: 8, alignContent: "end" }}>
                  <MiniStat label="Clock" value={openShift ? formatDuration(liveShiftMinutes) : "Not clocked in"} />
                  <button onClick={submitDailyBrief} disabled={briefSaving} style={{ ...primaryButton, width: "100%", opacity: briefSaving ? 0.6 : 1 }}>
                    {briefSaving ? "Submitting..." : "Submit Brief"}
                  </button>
                </div>
              </div>
            </section>
          </section>
          )}

          {activeTab === "packet" && (
          <section id="va-tab-brief" style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <p style={eyebrowSmall}>Member review packet</p>
                <h2 style={sectionTitle}>Build the deal packet</h2>
              </div>
              <span style={submissionReady ? hotPill : pill}>{submissionReady ? "Ready to submit" : `${readyCount}/${readinessItems.length} ready`}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(300px, 0.9fr)", gap: 18 }} className="va-form-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={label}>Packet title</label>
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
                    <label style={label}>Status</label>
                    <select value={draft.status ?? "lead"} onChange={e => setDraft({ ...draft, status: e.target.value as DealStatus })}>
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={twoCol} className="two-col">
                  <div>
                    <label style={label}>Urgency</label>
                    <select value={draft.urgency} onChange={e => setDraft({ ...draft, urgency: e.target.value as DealUrgency })}>
                      {URGENCY.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Source</label>
                    <input type="text" value={draft.source ?? ""} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Land portal, SMS, call, referral" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }} className="three-col">
                  <div>
                    <label style={label}>Lead temperature</label>
                    <select value={draft.lead_temperature ?? ""} onChange={e => setDraft({ ...draft, lead_temperature: (e.target.value || null) as DealInput["lead_temperature"] })}>
                      <option value="">Unset</option>
                      {LEAD_TEMPERATURES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Campaign</label>
                    <input type="text" value={draft.campaign_source ?? ""} onChange={e => setDraft({ ...draft, campaign_source: e.target.value })} placeholder="Mail batch, SMS list, portal saved search" />
                  </div>
                  <div>
                    <label style={label}>Next follow-up</label>
                    <input type="date" value={draft.next_follow_up_date ?? ""} onChange={e => setDraft({ ...draft, next_follow_up_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={label}>Strategy / recommendation</label>
                  <input type="text" value={draft.strategy} onChange={e => setDraft({ ...draft, strategy: e.target.value })} placeholder="wholesale, list retail, land resale, needs review" />
                </div>
                <div style={subPanel}>
                  <p style={eyebrowSmall}>Member-facing ask</p>
                  <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                    Pick the review type that matches what you want members to do. Use <strong>Ready For Vote</strong> only when the packet is complete and you want a yes/no decision.
                  </p>
                  <div style={twoCol} className="two-col">
                    <div>
                      <label style={label}>Review type</label>
                      <select value={draft.review_intent ?? "needs-info-review"} onChange={e => setDraft({ ...draft, review_intent: e.target.value as DealReviewIntent })}>
                        {REVIEW_INTENTS.map(intent => <option key={intent.value} value={intent.value}>{intent.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Requested next step</label>
                      <input type="text" value={draft.requested_next_step ?? ""} onChange={e => setDraft({ ...draft, requested_next_step: e.target.value })} placeholder="Vote, answer blocker, request more info, pass" />
                    </div>
                  </div>
                  <div style={{
                    borderLeft: "3px solid var(--brass)",
                    background: "rgba(176,137,84,0.08)",
                    padding: "8px 12px",
                    marginTop: 10,
                    borderRadius: 4,
                  }}>
                    <p style={{ fontSize: 12, color: "var(--obsidian)", lineHeight: 1.5 }}>
                      <strong>{REVIEW_INTENTS.find(intent => intent.value === draft.review_intent)?.label}:</strong>{" "}
                      {REVIEW_INTENTS.find(intent => intent.value === draft.review_intent)?.description}
                    </p>
                    {draft.review_intent === "ready-for-vote" && !submissionReady && (
                      <p style={{ fontSize: 12, color: "var(--obsidian)", marginTop: 6, lineHeight: 1.5 }}>
                        Still missing: {missingReadyItems.slice(0, 3).join(", ")}{missingReadyItems.length > 3 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={label}>VA summary for members</label>
                    <textarea rows={3} value={draft.submission_summary ?? ""} onChange={e => setDraft({ ...draft, submission_summary: e.target.value })} placeholder="Why this deal is worth member attention and what you found." />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={label}>Missing / uncertain items</label>
                    <textarea rows={2} value={draft.submit_uncertainties ?? ""} onChange={e => setDraft({ ...draft, submit_uncertainties: e.target.value })} placeholder="Open questions, weak comps, seller uncertainty, county records still pending." />
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
                <div style={subPanel}>
                  <p style={eyebrowSmall}>Acquisition + disposition math</p>
                  <div style={twoCol} className="two-col">
                    <div>
                      <label style={label}>Exit strategy</label>
                      <input value={draft.exit_strategy ?? ""} onChange={e => setDraft({ ...draft, exit_strategy: e.target.value })} placeholder="Assignment, retail resale, neighbor sale, builder exit" />
                    </div>
                    <div>
                      <label style={label}>Disposition status</label>
                      <select value={draft.disposition_status ?? "not-started"} onChange={e => setDraft({ ...draft, disposition_status: e.target.value as DispositionStatus })}>
                        {DISPOSITION_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }} className="number-grid">
                    <NumberField label="Target resale" value={draft.target_resale_price} onChange={v => setDraft({ ...draft, target_resale_price: v, arv: v ?? draft.arv })} />
                    <NumberField label="Minimum sale" value={draft.minimum_acceptable_price} onChange={v => setDraft({ ...draft, minimum_acceptable_price: v })} />
                    <NumberField label="Best buyer offer" value={draft.best_buyer_offer} onChange={v => setDraft({ ...draft, best_buyer_offer: v })} />
                    <NumberField label="Target spread" value={draft.desired_minimum_spread} onChange={v => setDraft({ ...draft, desired_minimum_spread: v })} />
                    <NumberField label="Closing costs" value={draft.closing_costs_estimate} onChange={v => setDraft({ ...draft, closing_costs_estimate: v })} />
                    <NumberField label="Holding costs" value={draft.holding_costs_estimate} onChange={v => setDraft({ ...draft, holding_costs_estimate: v })} />
                    <NumberField label="Marketing costs" value={draft.marketing_costs_estimate} onChange={v => setDraft({ ...draft, marketing_costs_estimate: v })} />
                    <NumberField label="Risk buffer" value={draft.risk_buffer} onChange={v => setDraft({ ...draft, risk_buffer: v })} />
                  </div>
                  <div style={twoCol} className="two-col">
                    <div>
                      <label style={label}>Target buyer type</label>
                      <input value={draft.target_buyer_type ?? ""} onChange={e => setDraft({ ...draft, target_buyer_type: e.target.value })} placeholder="Builder, neighbor, investor, developer" />
                    </div>
                    <div>
                      <label style={label}>Disposition owner</label>
                      <input value={draft.disposition_owner ?? ""} onChange={e => setDraft({ ...draft, disposition_owner: e.target.value })} placeholder="Member or VA owner" />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={label}>Buyer demand evidence</label>
                    <textarea rows={2} value={draft.buyer_demand_evidence ?? ""} onChange={e => setDraft({ ...draft, buyer_demand_evidence: e.target.value })} placeholder="Buyer list, comp support, nearby builders, neighbor interest, active buyer replies." />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={label}>Disposition next step / calculator notes</label>
                    <textarea rows={2} value={draft.disposition_next_step ?? draft.calculator_notes ?? ""} onChange={e => setDraft({ ...draft, disposition_next_step: e.target.value, calculator_notes: e.target.value })} placeholder="What must happen next to validate or execute the exit." />
                  </div>
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
                <div>
                  <label style={label}>Links</label>
                  <textarea rows={3} value={draft.linksText} onChange={e => setDraft({ ...draft, linksText: e.target.value })} placeholder="One county, portal, comp, map, photo, or document link per line" />
                </div>
                <div>
                  <label style={label}>Seller / research notes</label>
                  <textarea rows={5} value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Seller motivation, timeline, condition, due diligence notes, county calls, concerns, next follow-up" />
                </div>
              </div>

              <aside style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 16, alignSelf: "start", maxHeight: "calc(100vh - 32px)", overflowY: "auto" }} className="va-deal-aside">
                <div style={subPanel}>
                  <p style={eyebrowSmall}>Live analysis</p>
                  <h2 style={{ fontFamily: DISPLAY_FONT, color: "var(--obsidian)", fontSize: 26, fontWeight: 500, marginBottom: 8 }}>
                    {liveAnalysis.recommendation}
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{liveAnalysis.summary}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    {liveAnalysis.metrics.slice(0, 4).map(metric => (
                      <div key={metric.label} style={miniStat}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <p style={miniLabel}>Missing info</p>
                    <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                      {liveAnalysis.missingInfo.length ? liveAnalysis.missingInfo.join(", ") : "Core information present."}
                    </p>
                  </div>
                </div>
                <div style={subPanel}>
                  <p style={eyebrowSmall}>Member decision math</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <MiniStat label="Recommended offer" value={liveAnalysis.acquisition.recommendedOffer ? `$${liveAnalysis.acquisition.recommendedOffer.toLocaleString()}` : "N/A"} />
                    <MiniStat label="Max offer" value={liveAnalysis.acquisition.maxOffer ? `$${liveAnalysis.acquisition.maxOffer.toLocaleString()}` : "N/A"} />
                    <MiniStat label="Spread @ ask" value={liveAnalysis.acquisition.projectedSpreadAtAsk !== null ? `$${liveAnalysis.acquisition.projectedSpreadAtAsk.toLocaleString()}` : "N/A"} />
                    <MiniStat label="Exit confidence" value={liveAnalysis.disposition.exitConfidence} />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginTop: 10 }}>
                    {liveAnalysis.disposition.exitStrategy || "Exit strategy pending"} · {liveAnalysis.disposition.targetBuyerType || "Buyer type pending"}
                  </p>
                </div>
                <div style={subPanel}>
                  <p style={eyebrowSmall}>Ready to submit?</p>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                    {readyCount}/{readinessItems.length} quality checks complete. Submission also requires a summary and requested next step.
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {readinessItems.map(item => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: item.done ? "var(--obsidian)" : "var(--muted)" }}>
                        <span style={item.done ? readyDot : openDot} />
                        {item.label}
                      </div>
                    ))}
                  </div>
                  {selected?.last_review_notification_at && selected.status === "under-review" && (
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.4 }}>
                      <input
                        type="checkbox"
                        checked={notifyReviewUpdate}
                        onChange={e => setNotifyReviewUpdate(e.target.checked)}
                        style={{ width: 16, minHeight: 16, marginTop: 1 }}
                      />
                      Notify members again about this updated packet.
                    </label>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  {selected && (
                    <button onClick={() => router.push(`/opportunity?deal=${selected.id}`)} style={secondaryButton}>
                      Open Shared File
                    </button>
                  )}
                  <button onClick={() => saveDeal(draft.status ?? "lead")} disabled={saving} style={{ ...secondaryButton, opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Saving..." : "Save Updates"}
                  </button>
                  <button onClick={() => saveDeal("lead")} disabled={saving} style={{ ...secondaryButton, opacity: saving ? 0.6 : 1 }}>
                    Save As Draft Lead
                  </button>
                  <button onClick={() => saveDeal("under-review")} disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}>
                    {selected?.last_review_notification_at && selected.status === "under-review" ? "Update Review Packet" : "Submit For Member Review"}
                  </button>
                </div>
              </aside>
            </div>
          </section>
          )}

          {activeTab === "lists" && (
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <p style={eyebrowSmall}>Lists</p>
                <h2 style={sectionTitle}>{selectedBatch ? selectedBatch.campaign_source || selectedBatch.original_filename || "Work imported batch" : "Import and work land lists"}</h2>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={startNewImport} style={secondaryButton}>New Import</button>
                <span style={pill}>{importedLeads.length} imported · Avg score {importStats.avgScore}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }} className="number-grid">
              {(["upload", "preview", "importing", "work"] as ImportStep[]).map((step, index) => (
                <div key={step} style={{
                  border: importStep === step ? "1px solid var(--brass)" : "1px solid var(--fog)",
                  background: importStep === step ? "rgba(176,137,84,0.14)" : "var(--surface)",
                  borderRadius: 8,
                  padding: 10,
                }}>
                  <p style={miniLabel}>Step {index + 1}</p>
                  <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{step === "upload" ? "Upload" : step === "preview" ? "Map & Preview" : step === "importing" ? "Import Progress" : "Work The List"}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }} className="number-grid">
              <ShiftCard label="New" value={String(importStats.newRows)} />
              <ShiftCard label="Contacted" value={String(importStats.contacted)} />
              <ShiftCard label="Interested" value={String(importStats.interested)} tone={importStats.interested ? "hot" : "calm"} />
              <ShiftCard label="Duplicates" value={String(importStats.duplicates)} />
              <ShiftCard label="Converted" value={String(importStats.converted)} />
            </div>

            {(importStep === "upload" || (!importPreview && importedLeads.length === 0)) && (
              <div id="va-list-upload" style={{ ...subPanel, marginBottom: 12, borderColor: "var(--brass)", background: "rgba(176,137,84,0.08)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 14, alignItems: "stretch" }} className="two-col">
                  <button type="button" onClick={() => leadCsvInputRef.current?.click()} disabled={importing} style={{
                    border: "1px dashed var(--brass)",
                    borderRadius: 8,
                    minHeight: 156,
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    cursor: importing ? "default" : "pointer",
                    background: "rgba(255,252,245,0.72)",
                    padding: 16,
                    width: "100%",
                  }}>
                    <span>
                      <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 16, marginBottom: 6 }}>{importing && importStage === "previewing" ? "Reading CSV..." : "Choose CSV"}</strong>
                      <span style={{ display: "block", color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>Land Portal or Land Insights export</span>
                    </span>
                  </button>
                  <div>
                    <p style={eyebrowSmall}>New list import</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22, marginTop: 4 }}>Upload a CSV to preview before saving.</h3>
                    <div style={{ ...twoCol, marginTop: 12 }} className="two-col">
                      <div>
                        <label style={label}>Source</label>
                        <select value={uploadSource} onChange={e => setUploadSource(e.target.value)}>
                          <option>Land Portal</option>
                          <option>Land Insights</option>
                          <option>County Export</option>
                          <option>Skip Trace List</option>
                          <option>Other Land List</option>
                        </select>
                      </div>
                      <div>
                        <label style={label}>List name</label>
                        <input value={uploadCampaign} onChange={e => setUploadCampaign(e.target.value)} placeholder="Gwinnett County GA Odessa" />
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.55 }}>
                      The file will preview first so you can confirm mapped fields, property rows, grouped lead count, duplicate signals, and safe-to-text count.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!loading && importedLeads.length === 0 && (
              <div style={{ ...subPanel, marginBottom: 12, borderColor: "rgba(176,137,84,0.45)", background: "rgba(176,137,84,0.08)" }}>
                <p style={eyebrowSmall}>First list setup</p>
                <h3 style={{ ...sectionTitle, fontSize: 22 }}>Upload a Land Portal or Land Insights CSV to start the VA queue.</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }} className="number-grid">
                  <div style={subPanel}>
                    <p style={miniLabel}>1. Choose CSV</p>
                    <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>Use the export from the list source. Each row is treated as a property, then grouped under the right owner when possible.</p>
                  </div>
                  <div style={subPanel}>
                    <p style={miniLabel}>2. Confirm mapping</p>
                    <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>Review detected Land Insights columns, skipped rows, duplicate signals, and the unique-lead funnel before saving the list.</p>
                  </div>
                  <div style={subPanel}>
                    <p style={miniLabel}>3. Text the audience</p>
                    <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>Use the saved list as the audience source, bulk text eligible owners, and work replies from the Contact Queue.</p>
                  </div>
                </div>
              </div>
            )}

            <div style={{ ...subPanel, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                <div>
                  <p style={eyebrowSmall}>All imported leads</p>
                  <h3 style={{ ...sectionTitle, fontSize: 22 }}>
                    {filteredImportedLeads.length} visible of {importedLeads.filter(lead => lead.status !== "converted").length} active imported leads
                  </h3>
                </div>
                {selectedBatch && <span style={hotPill}>{batchLeads.length} in selected batch</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(320px, 1.05fr)", gap: 12 }} className="va-form-grid">
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: 8, marginBottom: 8 }} className="two-col">
                    <div>
                      <label style={label}>Search all imported leads</label>
                      <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Search any imported lead field" />
                    </div>
                    <div>
                      <label style={label}>Filter</label>
                      <select value={leadFilter} onChange={e => setLeadFilter(e.target.value as ImportStatusFilter)}>
                        {IMPORT_STATUS_FILTERS.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }} className="two-col">
                    <input value={minAcreage} onChange={e => setMinAcreage(e.target.value)} placeholder="Min acreage" />
                    <input value={maxAcreage} onChange={e => setMaxAcreage(e.target.value)} placeholder="Max acreage" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 760, overflow: "auto", paddingRight: 2 }}>
                    {filteredImportedLeads.map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => selectImportedLead(lead, "lists")}
                        style={{
                          ...subPanel,
                          textAlign: "left",
                          cursor: "pointer",
                          background: selectedImportedLeadId === lead.id ? "rgba(176,137,84,0.14)" : "var(--bone)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                          <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{lead.owner_name || "Owner unknown"}</strong>
                          <span style={lead.status === "interested" ? hotPill : pill}>Score {lead.lead_score ?? 0}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                          {lead.property_address || "No property address"}{lead.parcel_id ? ` · ${lead.parcel_id}` : ""}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45, marginTop: 4 }}>
                          {lead.phone || lead.phone_2 || "No phone"}{lead.acreage ? ` · ${lead.acreage} acres` : ""}{lead.county ? ` · ${lead.county}` : ""}
                        </p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          <span style={lead.status === "interested" ? hotPill : pill}>{statusLabel(lead.status)}</span>
                          {lead.duplicate_status && lead.duplicate_status !== "new" && <span style={pill}>{statusLabel(lead.duplicate_status)}</span>}
                          {!!lead.outreach_count && <span style={pill}>{lead.outreach_count} touches</span>}
                        </div>
                      </button>
                    ))}
                    {filteredImportedLeads.length === 0 && (
                      <p style={{ fontSize: 13, color: "var(--muted)" }}>No imported leads match this search yet.</p>
                    )}
                  </div>
                </div>

                <aside style={subPanel}>
                  {!selectedImportedLead && <p style={{ fontSize: 13, color: "var(--muted)" }}>Select any imported lead to review details, log outreach, text the seller, pass it, or build a deal packet.</p>}
                  {selectedImportedLead && (
                    <SellerCommandCenter
                      lead={selectedImportedLead}
                      communications={communicationEvents}
                      activities={leadActivities}
                      smsDraft={smsDraft}
                      setSmsDraft={setSmsDraft}
                      smsSending={smsSending}
                      onSendSms={sendSmsToLead}
                      dispositionDraft={dispositionDraft}
                      setDispositionDraft={setDispositionDraft}
                      onSaveDisposition={applyLeadDisposition}
                      onQuickDisposition={quickLeadDisposition}
                      activityDraft={activityDraft}
                      setActivityDraft={setActivityDraft}
                      onLogActivity={logLeadActivity}
                      onOpenFile={() => router.push(`/lead/${selectedImportedLead.id}`)}
                      onBuildPacket={() => loadImportedLead(selectedImportedLead, true)}
                      onPass={async () => { await updateImportedLandLeadStatus(selectedImportedLead.id, "passed", selectedImportedLead.deal_id); setImportedLeads(await fetchImportedLandLeads(500)); }}
                      compact
                    />
                  )}
                </aside>
              </div>
            </div>

            <div style={{ ...subPanel, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <p style={eyebrowSmall}>Campaign outreach</p>
                <h3 style={{ ...sectionTitle, fontSize: 20 }}>{bulkEligibleLeads.length} eligible · {bulkSmsCategorization.excluded.length} excluded</h3>
                <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                  Audience is the current Lists filter. The send drawer shows the full exclusion breakdown and a 3-recipient preview before any text leaves the system.
                </p>
              </div>
              <button onClick={() => setBulkSmsDrawerOpen(true)} disabled={bulkEligibleLeads.length === 0} style={{ ...primaryButton, opacity: bulkEligibleLeads.length === 0 ? 0.55 : 1 }}>
                Send Bulk Text →
              </button>
            </div>

            {unmatchedSms.length > 0 && (
              <div style={{ ...subPanel, marginBottom: 12, borderColor: "var(--brass)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                  <p style={eyebrowSmall}>Unmatched seller replies</p>
                    <h3 style={{ ...sectionTitle, fontSize: 20 }}>{unmatchedSms.length} message{unmatchedSms.length === 1 ? "" : "s"} need matching</h3>
                  </div>
                  <button onClick={() => { void fetchCommunicationEvents({ unmatched: true, limit: 25 }).then(setUnmatchedSms); }} style={secondaryButton}>Refresh</button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {unmatchedSms.slice(0, 5).map(event => (
                    <div key={event.id} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                        <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{event.contact_number || event.from_number || "Unknown number"}</strong>
                        <span style={pill}>{formatDate(event.provider_created_at || event.created_at)}</span>
                      </div>
                      <p style={{ color: "var(--ink)", fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>{event.body || event.status || event.provider_event_type}</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => attachUnmatchedSmsToLead(event)} style={secondaryButton}>Attach To Selected Lead</button>
                        <button onClick={() => createLeadDraftFromSms(event)} style={primaryButton}>Create Packet</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importPreview && (
              <div style={{ ...subPanel, marginBottom: 12, borderColor: "var(--brass)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Map & Preview</p>
                    <h3 style={{ ...sectionTitle, fontSize: 20 }}>{importPreview.filename}</h3>
                    <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Land list format recognized · rows become properties, then properties group under leads</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => { setImportPreview(null); setImportStep("upload"); }} style={secondaryButton}>Cancel</button>
                    <button onClick={confirmLeadImport} disabled={importing || importPreview.safeToImport === 0} style={{ ...primaryButton, opacity: importing || importPreview.safeToImport === 0 ? 0.6 : 1 }}>
                      {importing ? "Importing..." : `Import ${importPreview.safeToImport} New Properties`}
                    </button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }} className="number-grid">
                  <MiniStat label="CSV rows" value={String(importPreview.rowsFound)} />
                  <MiniStat label="Properties" value={String(importPreview.propertyRows)} />
                  <MiniStat label="Unique leads" value={String(importPreview.uniqueLeadCount)} />
                  <MiniStat label="Textable leads" value={String(importPreview.textableLeadCount)} />
                  <MiniStat label="Multi-property" value={String(importPreview.multiPropertyLeadCount)} />
                  <MiniStat label="New properties" value={String(importPreview.safeToImport)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8 }} className="number-grid">
                  <MiniStat label="Exact match" value={String(importPreview.exactDuplicates)} />
                  <MiniStat label="Possible match" value={String(Math.max(0, importPreview.possibleDuplicates - importPreview.exactDuplicates))} />
                  <MiniStat label="No phone" value={String(importPreview.missingPhone)} />
                  <MiniStat label="Avg score" value={String(importPreview.averageScore)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)", gap: 12, marginTop: 12 }} className="two-col">
                  <div style={subPanel}>
                    <p style={eyebrowSmall}>Detected Land Insights fields</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginTop: 8 }} className="two-col">
                      {importPreview.detectedFields.map(field => (
                        <div key={field.label} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 8, background: field.status === "mapped" ? "rgba(34,119,84,0.08)" : "var(--surface)" }}>
                          <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 12 }}>{field.label}</strong>
                          <span style={{ color: field.status === "mapped" ? "var(--pine)" : "var(--muted)", fontSize: 11 }}>{field.mappedFrom || "Not found"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={subPanel}>
                    <p style={eyebrowSmall}>Grouped lead preview</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, maxHeight: 270, overflow: "auto" }}>
                      {importPreview.groupedLeadSamples.map(group => (
                        <div key={`${group.leadLabel}-${group.phone}-${group.sampleProperties.join("|")}`} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 9, background: "var(--surface)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{group.leadLabel}</strong>
                            <span style={group.propertyCount > 1 ? hotPill : pill}>{group.propertyCount} propert{group.propertyCount === 1 ? "y" : "ies"}</span>
                          </div>
                          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{group.phone || "No phone"}{group.counties.length ? ` · ${group.counties.join(", ")}` : ""}</p>
                          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>{group.sampleProperties.join(" · ")}</p>
                        </div>
                      ))}
                      {importPreview.groupedLeadSamples.length === 0 && <p style={{ color: "var(--muted)", fontSize: 12 }}>No grouped leads found in this file.</p>}
                    </div>
                  </div>
                </div>
                {importPreview.skippedDuplicates > 0 && (
                  <div style={{ ...subPanel, marginTop: 12, background: "rgba(176,137,84,0.10)", borderColor: "var(--brass)" }}>
                    <p style={eyebrowSmall}>Overlap review</p>
                    <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                      Meridian will skip overlapping Land Insights/Land Portal records by default. Review these matches before deciding whether to update an existing lead.
                    </p>
                    <div style={{ display: "grid", gap: 8 }}>
                      {importPreview.duplicateMatches.map(match => (
                        <div key={`${match.duplicateOf}-${match.incomingLabel}`} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                            <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{match.incomingLabel}</strong>
                            <span style={match.confidence === "already-converted" ? hotPill : pill}>{statusLabel(match.confidence)}</span>
                          </div>
                          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>
                            Existing: {match.existingLabel} · {match.existingStatus ? statusLabel(match.existingStatus) : "Status unknown"}{match.existingDealId ? " · already has deal" : ""}
                          </p>
                          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
                            Why: {match.reasons.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: "var(--muted)", textAlign: "left", borderBottom: "1px solid var(--fog)" }}>
                        <th style={th}>Owner</th>
                        <th style={th}>APN</th>
                        <th style={th}>Address</th>
                        <th style={th}>Phone</th>
                        <th style={th}>Acres</th>
                        <th style={th}>Score</th>
                        <th style={th}>Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.sampleLeads.map((lead, index) => (
                        <tr key={`${lead.parcel_id}-${index}`} style={{ borderBottom: "1px solid var(--fog)" }}>
                          <td style={td}>{lead.owner_name || "Owner unknown"}</td>
                          <td style={td}>{lead.parcel_id || "N/A"}</td>
                          <td style={td}>{lead.property_address || "No parcel address"}</td>
                          <td style={td}>{lead.phone || lead.phone_2 || "No phone"}</td>
                          <td style={td}>{lead.acreage ?? "N/A"}</td>
                          <td style={td}>{lead.lead_score ?? 0}</td>
                          <td style={td}><FlagRow lead={lead} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "none" }}>
                  {importPreview.sampleLeads.map((lead, index) => (
                    <div key={`${lead.parcel_id}-${index}`} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" }}>
                      <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{lead.owner_name || "Owner unknown"}</strong>
                      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{lead.property_address || lead.parcel_id || "No parcel address"} · Score {lead.lead_score ?? 0}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importStep === "importing" && (
              <div style={{ ...subPanel, marginBottom: 12, borderColor: "var(--brass)" }}>
                <p style={eyebrowSmall}>Import Progress</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }} className="three-col">
                  <StageCard label="Creating batch" active={["creating-batch", "saving-leads", "refreshing", "done"].includes(importStage)} />
                  <StageCard label="Saving leads" active={["saving-leads", "refreshing", "done"].includes(importStage)} />
                  <StageCard label="Refreshing list" active={["refreshing", "done"].includes(importStage)} />
                </div>
              </div>
            )}

            <div style={{ ...subPanel, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline", marginBottom: 8 }}>
                <p style={eyebrowSmall}>Batch workflow</p>
                {selectedBatch && <span style={hotPill}>{batchLeads.length} in selected batch</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }} className="three-col">
                {leadBatches.slice(0, 6).map(batch => (
                  <div key={batch.id} style={{ border: selectedBatchId === batch.id ? "1px solid var(--brass)" : "1px solid var(--fog)", borderRadius: 8, padding: 10, background: selectedBatchId === batch.id ? "rgba(176,137,84,0.12)" : "var(--surface)" }}>
                    <button onClick={() => { setSelectedBatchId(batch.id); setImportStep("work"); }} style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", width: "100%" }}>
                      <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 13 }}>{batch.campaign_source || batch.original_filename || batch.source_system}</strong>
                    </button>
                    <p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 8px" }}>{batch.row_count} rows · {statusLabel(batch.status || "not-started")}</p>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        value={batch.status || "not-started"}
                        onChange={async e => {
                          await updateLandLeadBatch(batch.id, { status: e.target.value as LandLeadBatch["status"], assigned_to: user });
                          setLeadBatches(await fetchLandLeadBatches());
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <option value="not-started">Not Started</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button
                        onClick={() => router.push(`/lists/${batch.id}`)}
                        style={{ ...secondaryButton, padding: "8px 10px", fontSize: 10, minHeight: 32 }}
                      >
                        Open →
                      </button>
                    </div>
                  </div>
                ))}
                {leadBatches.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No import batches yet.</p>}
              </div>
            </div>

            {nextBestLead && (
              <div style={{ ...subPanel, marginBottom: 12, borderColor: "var(--brass)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <p style={eyebrowSmall}>Next best lead</p>
                    <h3 style={{ ...sectionTitle, fontSize: 20 }}>{nextBestLead.owner_name || "Owner unknown"}</h3>
                    <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{nextBestLead.property_address || nextBestLead.parcel_id || "No address"} · Score {nextBestLead.lead_score ?? 0}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => selectImportedLead(nextBestLead, "lists")} style={secondaryButton}>Review</button>
                        <button onClick={() => loadImportedLead(nextBestLead, true)} style={primaryButton}>Build Packet</button>
                  </div>
                </div>
              </div>
            )}

          </section>
          )}

          {activeTab === "outreach" && (
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <p style={eyebrowSmall}>Contact Queue</p>
                <h2 style={sectionTitle}>Seller conversations and follow-ups</h2>
              </div>
              <span style={(followUpsDue.length || recentInboundSms.length || interestedLeads.length) ? hotPill : pill}>
                {followUpsDue.length + recentInboundSms.length + interestedLeads.length} needs review
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }} className="number-grid">
              <ShiftCard label="Seller replies" value={String(recentInboundSms.length)} tone={recentInboundSms.length ? "hot" : "calm"} />
              <ShiftCard label="Due follow-ups" value={String(followUpsDue.length)} tone={followUpsDue.length ? "hot" : "calm"} />
              <ShiftCard label="Interested sellers" value={String(interestedLeads.length)} tone={interestedLeads.length ? "hot" : "calm"} />
              <ShiftCard label="Textable leads" value={String(workdeskLeadRows.filter(lead => lead.phone || lead.phone_2).length)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 420px", gap: 14 }} className="lead-inbox-grid">
              <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
                <section style={{ ...subPanel, borderColor: recentInboundSms.length ? "var(--brass)" : "var(--fog)", background: recentInboundSms.length ? "rgba(176,137,84,0.08)" : "var(--bone)" }}>
                  <p style={eyebrowSmall}>Recent seller replies</p>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {recentInboundSms.slice(0, 8).map(event => (
                      <button key={event.id} onClick={() => openIncomingSms(event)} style={{ ...miniInboxButton, borderColor: event.matched_lead_id || event.matched_deal_id ? "var(--fog)" : "var(--brass)" }}>
                        <strong>{event.contact_name || event.contact_number || event.from_number || "Unknown seller"}</strong>
                        <span>{event.body || event.status || "Inbound SMS"}</span>
                        <em>{event.matched_deal_id ? "Matched deal" : event.matched_lead_id ? "Matched lead" : "Unmatched"}</em>
                      </button>
                    ))}
                    {recentInboundSms.length === 0 && <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45 }}>No seller replies have been received yet.</p>}
                  </div>
                </section>

                <section style={subPanel}>
                  <p style={eyebrowSmall}>Conversation queues</p>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <QueueButton label="Unmatched replies" detail="Need lead/deal matching" count={unmatchedSms.length} hot={!!unmatchedSms.length} onClick={() => void reload(user)} />
                    <QueueButton label="Interested sellers" detail="Ready for response" count={interestedLeads.length} hot={!!interestedLeads.length} onClick={() => { setLeadFilter("interested"); goToTab("lists"); }} />
                    <QueueButton label="Follow-up due" detail="Needs call or text" count={followUpsDue.length} hot={!!followUpsDue.length} onClick={() => goToTab("outreach")} />
                    <QueueButton label="New imported leads" detail="Start first touch" count={importStats.newRows} onClick={() => { setLeadFilter("new"); goToTab("lists"); }} />
                  </div>
                </section>

                {unmatchedSms.length > 0 && (
                  <section style={{ ...subPanel, borderColor: "var(--brass)", background: "rgba(176,137,84,0.08)" }}>
                    <p style={eyebrowSmall}>Unmatched inbound</p>
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      {unmatchedSms.slice(0, 5).map(event => (
                        <button key={event.id} onClick={() => createLeadDraftFromSms(event)} style={{ ...miniInboxButton, borderColor: "var(--brass)" }}>
                          <strong>{event.contact_number || event.from_number || "Unknown number"}</strong>
                          <span>{event.body || event.status || "Inbound message"}</span>
                          <em>Create packet or match</em>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </aside>

              <section style={subPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <p style={eyebrowSmall}>Seller queue</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22 }}>Select a seller to text</h3>
                  </div>
                  <button onClick={() => void reload(user)} style={secondaryButton}>Refresh</button>
                </div>
                <div style={{ display: "grid", gap: 8, maxHeight: 720, overflow: "auto", paddingRight: 2 }}>
                  {workdeskLeadRows.map(lead => {
                    const active = selectedImportedLeadId === lead.id;
                    const action = sellerActionState(lead);
                    return (
                      <button
                        key={lead.id}
                        onClick={() => selectImportedLead(lead, "outreach")}
                        style={{
                          ...subPanel,
                          padding: 12,
                          textAlign: "left",
                          cursor: "pointer",
                          background: active ? "rgba(176,137,84,0.15)" : "var(--surface)",
                          borderColor: active ? "var(--brass)" : "var(--fog)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                          <div>
                            <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{lead.owner_name || "Owner unknown"}</strong>
                            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                              {lead.phone || lead.phone_2 || "No phone"} · {lead.county || "County pending"} · {lead.acreage ?? "N/A"} acres
                            </p>
                          </div>
                          <span style={lead.status === "interested" ? hotPill : pill}>{statusLabel(lead.status)}</span>
                        </div>
                        <p style={{ color: "var(--ink)", fontSize: 12, lineHeight: 1.45, marginTop: 8 }}>
                          {lead.property_address || lead.parcel_id || "No property detail"} · {action.primary}
                        </p>
                      </button>
                    );
                  })}
                  {workdeskLeadRows.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No seller work items yet. Import a list or wait for inbound replies.</p>}
                </div>
              </section>

              <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
                {selectedImportedLead ? (
                  <SellerCommandCenter
                    lead={selectedImportedLead}
                    communications={communicationEvents}
                    activities={leadActivities}
                    smsDraft={smsDraft}
                    setSmsDraft={setSmsDraft}
                    smsSending={smsSending}
                    onSendSms={sendSmsToLead}
                    dispositionDraft={dispositionDraft}
                    setDispositionDraft={setDispositionDraft}
                    onSaveDisposition={applyLeadDisposition}
                    onQuickDisposition={quickLeadDisposition}
                    activityDraft={activityDraft}
                    setActivityDraft={setActivityDraft}
                    onLogActivity={logLeadActivity}
                    onOpenFile={() => router.push(`/lead/${selectedImportedLead.id}`)}
                    onBuildPacket={() => loadImportedLead(selectedImportedLead, true)}
                    onPass={async () => { await updateImportedLandLeadStatus(selectedImportedLead.id, "passed", selectedImportedLead.deal_id); setImportedLeads(await fetchImportedLandLeads(500)); }}
                    compact
                  />
                ) : (
                  <section style={subPanel}>
                    <p style={eyebrowSmall}>Seller workspace</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22 }}>Pick a seller</h3>
                    <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                      Select a seller from the queue to see conversation history, send a Sakari text, log a call, set disposition, or build a packet.
                    </p>
                  </section>
                )}
              </aside>
            </div>
          </section>
          )}

          {activeTab === "packet" && (
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <p style={eyebrowSmall}>Research quality</p>
                <h2 style={sectionTitle}>Diligence & readiness</h2>
              </div>
              <span style={readyCount >= readinessItems.length ? hotPill : pill}>{readyCount}/{readinessItems.length} ready</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)", gap: 14 }} className="two-col">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={subPanel}>
                  <p style={eyebrowSmall}>Ready to submit?</p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {readinessItems.map(item => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: item.done ? "var(--obsidian)" : "var(--muted)" }}>
                        <span style={item.done ? readyDot : openDot} />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={subPanel}>
                  <p style={eyebrowSmall}>Research attachments</p>
                  {!selected && <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Save the lead before adding attachment records.</p>}
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 150px", gap: 8 }} className="two-col">
                    <input placeholder="Title" value={attachmentDraft.title} onChange={e => setAttachmentDraft({ ...attachmentDraft, title: e.target.value })} disabled={!selected} />
                    <select value={attachmentDraft.attachment_type} onChange={e => setAttachmentDraft({ ...attachmentDraft, attachment_type: e.target.value as DealAttachmentType })} disabled={!selected}>
                      {ATTACHMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <input style={{ marginTop: 8 }} placeholder="URL" value={attachmentDraft.url} onChange={e => setAttachmentDraft({ ...attachmentDraft, url: e.target.value })} disabled={!selected} />
                  <input style={{ marginTop: 8 }} placeholder="Notes" value={attachmentDraft.notes} onChange={e => setAttachmentDraft({ ...attachmentDraft, notes: e.target.value })} disabled={!selected} />
                  <button onClick={addAttachment} disabled={!selected} style={{ ...secondaryButton, marginTop: 8, opacity: selected ? 1 : 0.5 }}>Add Attachment</button>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    {attachments.map(file => (
                      <a key={file.id} href={file.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brass)", overflowWrap: "anywhere" }}>
                        {file.title} · {file.attachment_type}
                      </a>
                    ))}
                    {selected && attachments.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>No attachments added yet.</p>}
                  </div>
                </div>
              </div>
              <div style={subPanel}>
                <p style={eyebrowSmall}>Checklist</p>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                  {selected ? `${cleared}/${checklist.length} cleared · ${blocked} blocked` : `${liveChecklist.length} items will be created when saved.`}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 560, overflow: "auto" }}>
                  {selected ? checklist.map(item => (
                    <div key={item.id} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", marginBottom: 4 }}>{item.title}</p>
                      <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{item.required_evidence}</p>
                      <select value={item.status} onChange={e => updateChecklist(item, e.target.value as ChecklistStatus)} style={{ marginTop: 8 }}>
                        {CHECKLIST_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  )) : liveChecklist.map((item, index) => (
                    <div key={item.sort_order} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--obsidian)", marginBottom: 4 }}>{item.title}</p>
                      <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{item.required_evidence}</p>
                      <p style={{ ...miniLabel, marginTop: 8 }}>Item {index + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          )}

          {activeTab === "brief" && (
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <p style={eyebrowSmall}>End of shift</p>
                <h2 style={sectionTitle}>Daily Brief</h2>
                <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                  Numbers below were filled from your shift activity. Write the narrative — members read the activities, blockers, and tomorrow plan.
                </p>
              </div>
              <span style={pill}>Members review in Operations</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }} className="number-grid">
              <div>
                <label style={label}>Work date</label>
                <input type="date" value={briefDraft.work_date} onChange={e => setBriefDraft({ ...briefDraft, work_date: e.target.value })} />
              </div>
              <NumberField label="Hours" value={briefDraft.hours_worked} onChange={v => setBriefDraft({ ...briefDraft, hours_worked: v })} />
              <NumberField label="Leads added" value={briefDraft.leads_added} onChange={v => setBriefDraft({ ...briefDraft, leads_added: v })} />
              <NumberField label="Leads updated" value={briefDraft.leads_updated} onChange={v => setBriefDraft({ ...briefDraft, leads_updated: v })} />
              <NumberField label="Outreach sent" value={briefDraft.outreach_sent} onChange={v => setBriefDraft({ ...briefDraft, outreach_sent: v })} />
              <NumberField label="Seller replies" value={briefDraft.seller_replies} onChange={v => setBriefDraft({ ...briefDraft, seller_replies: v })} />
              <NumberField label="Calls completed" value={briefDraft.calls_completed} onChange={v => setBriefDraft({ ...briefDraft, calls_completed: v })} />
              <NumberField label="Deals submitted" value={briefDraft.deals_submitted} onChange={v => setBriefDraft({ ...briefDraft, deals_submitted: v })} />
              <NumberField label="VA tasks done" value={briefDraft.va_tasks_completed} onChange={v => setBriefDraft({ ...briefDraft, va_tasks_completed: v })} />
              <NumberField label="Checklist cleared" value={briefDraft.checklist_items_cleared} onChange={v => setBriefDraft({ ...briefDraft, checklist_items_cleared: v })} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={autofillBriefStats} style={secondaryButton}>
                Auto-fill Portal Stats
              </button>
              <button onClick={pullSakariBrief} style={secondaryButton}>
                Pull Sakari Activity
              </button>
            </div>
            <div style={{ ...subPanel, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <div>
                  <p style={eyebrowSmall}>Time clock</p>
                  <strong style={{ color: "var(--obsidian)" }}>{briefDraft.work_date}</strong>
                </div>
                <span style={pill}>{(todaysSubmittedMinutes / 60).toFixed(2)} submitted hrs</span>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {timeEntries.filter(entry => vaDateKey(entry.clock_in_at) === briefDraft.work_date).slice(0, 4).map(entry => (
                  <div key={entry.id} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "rgba(255,253,248,0.5)" }}>
                    {inlineTimeEditId === entry.id ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>
                            {inlineTimeDraft.requestType === "void-shift" ? "Void this shift" : "Edit this shift"}
                          </strong>
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>{formatDuration(entry.duration_minutes ?? currentShiftMinutes(entry))}</span>
                        </div>
                        {inlineTimeDraft.requestType !== "void-shift" && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }} className="two-col">
                            <div>
                              <label style={label}>Clock in</label>
                              <input type="datetime-local" value={inlineTimeDraft.clockIn} onChange={e => setInlineTimeDraft({ ...inlineTimeDraft, clockIn: e.target.value })} />
                            </div>
                            <div>
                              <label style={label}>Clock out</label>
                              <input type="datetime-local" value={inlineTimeDraft.clockOut} onChange={e => setInlineTimeDraft({ ...inlineTimeDraft, clockOut: e.target.value })} />
                            </div>
                          </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }} className="two-col">
                          <div>
                            <label style={label}>Notes</label>
                            <input value={inlineTimeDraft.notes} onChange={e => setInlineTimeDraft({ ...inlineTimeDraft, notes: e.target.value })} placeholder="Optional shift note" />
                          </div>
                          <div>
                            <label style={label}>Reason</label>
                            <input value={inlineTimeDraft.reason} onChange={e => setInlineTimeDraft({ ...inlineTimeDraft, reason: e.target.value })} placeholder="Why this change is needed" />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={submitInlineTimeEdit} disabled={timeRequestSaving} style={{ ...secondaryButton, opacity: timeRequestSaving ? 0.6 : 1 }}>
                            {timeRequestSaving ? "Sending..." : inlineTimeDraft.requestType === "void-shift" ? "Request Void" : "Send Edit Request"}
                          </button>
                          <button
                            onClick={() => setInlineTimeEditId(null)}
                            style={{ ...secondaryButton, background: "transparent", color: "var(--obsidian)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 10, fontSize: 12, color: "var(--ink)", alignItems: "center" }} className="brief-grid">
                        <span style={{ display: "grid", gap: 5 }}>
                          <span><strong>Clock in:</strong> {formatVaDateTime(entry.clock_in_at)}</span>
                          <span><strong>Clock out:</strong> {entry.clock_out_at ? formatVaDateTime(entry.clock_out_at) : "Still clocked in"}</span>
                        </span>
                        <span>{formatDuration(entry.duration_minutes ?? currentShiftMinutes(entry))}</span>
                        <span style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => startInlineTimeEdit(entry, "edit-shift")} style={secondaryButton}>Edit Time</button>
                          <button onClick={() => startInlineTimeEdit(entry, "void-shift")} style={secondaryButton}>Void</button>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {timeEntries.filter(entry => vaDateKey(entry.clock_in_at) === briefDraft.work_date).length === 0 && (
                  <p style={{ color: "var(--muted)", fontSize: 12 }}>No clocked shifts for this date yet.</p>
                )}
              </div>
            </div>
            <div style={{ ...subPanel, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <div>
                  <p style={eyebrowSmall}>Time correction</p>
                  <strong style={{ color: "var(--obsidian)" }}>Request an edit</strong>
                </div>
                <span style={pill}>{timeChangeRequests.filter(request => request.status === "pending").length} pending</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", gap: 8, marginBottom: 8 }} className="two-col">
                <div>
                  <label style={label}>Request</label>
                  <select
                    value={timeRequestDraft.requestType}
                    onChange={e => setTimeRequestDraft({ ...timeRequestDraft, requestType: e.target.value as VaTimeChangeRequestType })}
                  >
                    <option value="add-shift">Forgot to clock in/out</option>
                    <option value="edit-shift">Edit a shift</option>
                    <option value="void-shift">Delete / void a shift</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Shift</label>
                  <select
                    value={timeRequestDraft.entryId}
                    onChange={e => {
                      const entry = timeEntries.find(row => row.id === e.target.value);
                      setTimeRequestDraft({
                        ...timeRequestDraft,
                        entryId: e.target.value,
                        clockIn: toVaDateTimeInput(entry?.clock_in_at),
                        clockOut: toVaDateTimeInput(entry?.clock_out_at),
                        notes: entry?.notes ?? timeRequestDraft.notes,
                      });
                    }}
                    disabled={timeRequestDraft.requestType === "add-shift"}
                  >
                    <option value="">{timeRequestDraft.requestType === "add-shift" ? "New missing shift" : "Select shift"}</option>
                    {timeEntries.slice(0, 20).map(entry => (
                      <option key={entry.id} value={entry.id}>
                        Clock in: {formatVaDateTime(entry.clock_in_at)} · Clock out: {entry.clock_out_at ? formatVaDateTime(entry.clock_out_at) : "still clocked in"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {timeRequestDraft.requestType !== "void-shift" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }} className="two-col">
                  <div>
                    <label style={label}>Clock in</label>
                    <input type="datetime-local" value={timeRequestDraft.clockIn} onChange={e => setTimeRequestDraft({ ...timeRequestDraft, clockIn: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Clock out</label>
                    <input type="datetime-local" value={timeRequestDraft.clockOut} onChange={e => setTimeRequestDraft({ ...timeRequestDraft, clockOut: e.target.value })} />
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }} className="two-col">
                <div>
                  <label style={label}>Notes</label>
                  <input value={timeRequestDraft.notes} onChange={e => setTimeRequestDraft({ ...timeRequestDraft, notes: e.target.value })} placeholder="Optional shift note" />
                </div>
                <div>
                  <label style={label}>Reason</label>
                  <input value={timeRequestDraft.reason} onChange={e => setTimeRequestDraft({ ...timeRequestDraft, reason: e.target.value })} placeholder="Why this correction is needed" />
                </div>
              </div>
              <button onClick={submitTimeChangeRequest} disabled={timeRequestSaving} style={{ ...secondaryButton, marginTop: 10, opacity: timeRequestSaving ? 0.6 : 1 }}>
                {timeRequestSaving ? "Sending..." : "Send Time Change Request"}
              </button>
              {timeChangeRequests.length > 0 && (
                <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                  {timeChangeRequests.slice(0, 4).map(request => (
                    <div key={request.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "var(--ink)" }}>
                      <span>{statusLabel(request.request_type)} · {request.reason}</span>
                      <span style={pill}>{statusLabel(request.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }} className="two-col">
              <div>
                <label style={label}>Activities completed</label>
                <textarea rows={5} value={briefDraft.activities_completed} onChange={e => setBriefDraft({ ...briefDraft, activities_completed: e.target.value })} placeholder="List completed work: leads researched, calls/messages handled, records updated, diligence completed." />
              </div>
              <div>
                <label style={label}>Follow-ups needed</label>
                <textarea rows={5} value={briefDraft.follow_ups_needed ?? ""} onChange={e => setBriefDraft({ ...briefDraft, follow_ups_needed: e.target.value })} placeholder="Who needs follow-up, when, and why." />
              </div>
              <div>
                <label style={label}>Blockers / decisions needed</label>
                <textarea rows={4} value={briefDraft.blockers ?? ""} onChange={e => setBriefDraft({ ...briefDraft, blockers: e.target.value })} placeholder="Missing access, unclear direction, member decisions needed, seller issues." />
              </div>
              <div>
                <label style={label}>Plan for next shift</label>
                <textarea rows={4} value={briefDraft.tomorrow_plan ?? ""} onChange={e => setBriefDraft({ ...briefDraft, tomorrow_plan: e.target.value })} placeholder="What you will pick up next." />
              </div>
            </div>
            {editingBriefId && (
              <div style={{ ...subPanel, marginTop: 12 }}>
                <label style={label}>Revision note</label>
                <input value={briefRevisionNote} onChange={e => setBriefRevisionNote(e.target.value)} placeholder="What changed in this brief?" />
                <button onClick={cancelBriefEdit} style={{ ...secondaryButton, marginTop: 10 }}>Cancel Edit</button>
              </div>
            )}
            <button onClick={submitDailyBrief} disabled={briefSaving} style={{ ...primaryButton, marginTop: 12, opacity: briefSaving ? 0.6 : 1 }}>
              {briefSaving ? "Saving..." : editingBriefId ? "Update Daily Brief" : "Submit Daily Brief"}
            </button>

            <div style={{ marginTop: 18 }}>
              <h3 style={{ ...sectionTitle, fontSize: 20 }}>Recent briefs</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {briefs.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No daily briefs submitted yet.</p>}
                {briefs.map(brief => (
                  <div key={brief.id} style={subPanel}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <strong style={{ color: "var(--obsidian)" }}>{formatDate(brief.work_date)}</strong>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={pill}>{brief.hours_worked ?? 0} hrs</span>
                        <button onClick={() => startBriefEdit(brief)} style={secondaryButton}>Edit</button>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                      Leads {brief.leads_added ?? 0} added / {brief.leads_updated ?? 0} updated · Outreach {brief.outreach_sent ?? 0} · Deals submitted {brief.deals_submitted ?? 0} · VA tasks {brief.va_tasks_completed ?? 0}
                    </p>
                    {brief.revised_at && (
                      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                        Revised {formatDate(brief.revised_at)}{brief.revision_note ? ` · ${brief.revision_note}` : ""}
                      </p>
                    )}
                    <p style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{brief.activities_completed}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}
        </main>
      </div>

      <BulkSmsDrawer
        open={bulkSmsDrawerOpen}
        onClose={() => setBulkSmsDrawerOpen(false)}
        audienceLabel={selectedBatch ? `List: ${selectedBatch.campaign_source || selectedBatch.original_filename || selectedBatch.source_system}` : "Imported leads · current Lists filter"}
        audienceContext={[
          leadFilter !== "all" ? `Status filter: ${leadFilter}` : null,
          leadSearch.trim() ? `Search: "${leadSearch.trim()}"` : null,
          minAcreage || maxAcreage ? `Acres: ${minAcreage || "0"}–${maxAcreage || "∞"}` : null,
        ].filter(Boolean).join(" · ") || undefined}
        categorization={bulkSmsCategorization}
        onSend={sendBulkSms}
      />

      <style jsx>{`
        input, select, textarea {
          width: 100%;
          border: 1px solid var(--fog);
          border-radius: 6px;
          background: var(--surface);
          color: var(--ink);
          padding: 10px 11px;
          font-family: var(--font-body);
          font-size: 13px;
        }
        textarea { resize: vertical; line-height: 1.45; }
        .va-flow-strip {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (max-width: 880px) {
          .va-root { padding-top: 28px !important; }
          .va-tabs {
            position: sticky;
            top: 0;
            z-index: 20;
          }
          .va-workspace, .va-form-grid, .workdesk-grid, .two-col, .three-col, .number-grid, .va-briefing-grid, .va-home-grid {
            grid-template-columns: 1fr !important;
          }
          .compact-shift-grid button {
            min-height: 52px !important;
          }
          .va-flow-strip {
            grid-template-columns: 1fr !important;
          }
          .va-clock-banner {
            flex-direction: column;
            align-items: stretch !important;
          }
          .va-deal-aside {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
          }
        }
        @media (min-width: 881px) and (max-width: 1180px) {
          .va-flow-strip {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .va-briefing-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}

function NumberField({ label: text, value, onChange }: { label: string; value: number | null | undefined; onChange: (value: number | null) => void }) {
  return (
    <div>
      <label style={label}>{text}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value ?? ""}
        onChange={e => onChange(toNumber(e.target.value))}
      />
    </div>
  );
}

function SellerCommandCenter({
  lead,
  communications,
  activities,
  smsDraft,
  setSmsDraft,
  smsSending,
  onSendSms,
  dispositionDraft,
  setDispositionDraft,
  onSaveDisposition,
  onQuickDisposition,
  activityDraft,
  setActivityDraft,
  onLogActivity,
  onOpenFile,
  onBuildPacket,
  onPass,
  compact = false,
}: {
  lead: ImportedLandLead;
  communications: CommunicationEvent[];
  activities: ImportedLandLeadActivity[];
  smsDraft: string;
  setSmsDraft: (value: string) => void;
  smsSending: boolean;
  onSendSms: () => void;
  dispositionDraft: { disposition: LeadDisposition; note: string; nextFollowUpDate: string };
  setDispositionDraft: (draft: { disposition: LeadDisposition; note: string; nextFollowUpDate: string }) => void;
  onSaveDisposition: () => void;
  onQuickDisposition: (disposition: LeadDisposition, note: string, followUpDays?: number) => void;
  activityDraft: { activityType: ImportedLandLeadActivity["activity_type"]; summary: string; nextFollowUpDate: string };
  setActivityDraft: (draft: { activityType: ImportedLandLeadActivity["activity_type"]; summary: string; nextFollowUpDate: string }) => void;
  onLogActivity: () => void;
  onOpenFile: () => void;
  onBuildPacket: () => void;
  onPass: () => void;
  compact?: boolean;
}) {
  const action = sellerActionState(lead);
  const conversation = buildConversationItems(communications, activities);
  const conversationActivities = activities.map(activity => ({
    id: activity.id,
    title: statusLabel(activity.activity_type),
    date: activity.created_at,
    body: activity.summary,
    meta: activity.next_follow_up_date ? `Follow up ${activity.next_follow_up_date}` : undefined,
  }));
  const smsCompliance = checkLeadSmsCompliance(lead);
  const callCompliance = checkLeadCallCompliance(lead);
  const smsBlocked = !smsCompliance.allowed;
  const smsDisabled = smsSending || smsBlocked;
  const smsBlockSeverity = smsCompliance.severity;
  const ownerFirst = (lead.owner_name || "").split(/\s+/).find(Boolean) || "";
  const propertyHint = lead.property_address ? ` at ${lead.property_address}` : lead.parcel_id ? ` parcel ${lead.parcel_id}` : "";
  const hasContact = conversation.length > 0 || !!lead.last_activity_type || !!lead.last_sms_at;
  const hasOutcome = !!lead.last_activity_type || ["contacted", "interested", "passed", "converted"].includes(lead.status);
  const packetReady = lead.status === "interested" || lead.status === "converted" || action.primary === "Build Packet";
  const smsTemplates = [
    {
      label: "Intro",
      body: `Hi${ownerFirst ? ` ${ownerFirst}` : ""}, this is Meridian. I was reaching out about your property${propertyHint}. Would you consider selling?`,
    },
    {
      label: "Follow Up",
      body: `Just following up on your property${propertyHint}. What price would make sense for you?`,
    },
    {
      label: "Next Step",
      body: "Thanks for the info. I am going to review the property details and follow up with next steps.",
    },
  ];
  const primaryAction = action.primary === "Build Packet" ? onBuildPacket : action.primary === "Set Follow-Up"
    ? () => setDispositionDraft({ ...dispositionDraft, disposition: "follow-up", nextFollowUpDate: addDays(2) })
    : undefined;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{
        border: action.tone === "hot" || action.tone === "warn" || action.tone === "success" ? "1px solid var(--brass)" : "1px solid var(--fog)",
        borderRadius: 8,
        padding: 12,
        background: action.tone === "hot" || action.tone === "warn" ? "rgba(176,137,84,0.12)" : action.tone === "success" ? "rgba(67,126,74,0.12)" : "var(--surface)",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <div>
          <p style={eyebrowSmall}>Next action</p>
          <h3 style={{ ...sectionTitle, fontSize: 22 }}>{action.label}</h3>
          <p style={{ color: "var(--obsidian)", fontSize: 13, fontWeight: 800, marginTop: 3 }}>{action.title}</p>
          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>{action.detail}</p>
        </div>
        <button onClick={primaryAction || onSendSms} disabled={action.primary.includes("SMS") && smsDisabled} style={{ ...primaryButton, opacity: action.primary.includes("SMS") && smsDisabled ? 0.55 : 1 }}>
          {action.primary}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }} className="number-grid">
        <LeadPathCard label="1. Contact" detail={hasContact ? "Touch logged" : "Call or text seller"} done={hasContact} active={!hasContact} />
        <LeadPathCard label="2. Outcome" detail={hasOutcome ? statusLabel(lead.last_activity_type || lead.status) : "Log result"} done={hasOutcome} active={hasContact && !hasOutcome} />
        <LeadPathCard label="3. Packet" detail={packetReady ? "Ready for brief" : "Need interest or facts"} done={packetReady} active={hasOutcome && !packetReady} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0, 1fr) 300px", gap: 12 }} className="two-col">
        <section style={subPanel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <p style={eyebrowSmall}>Seller record</p>
              <h3 style={{ ...sectionTitle, fontSize: 24 }}>{lead.owner_name || "Owner unknown"}</h3>
            </div>
            <span style={lead.status === "interested" ? hotPill : pill}>{statusLabel(lead.status)}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }} className="number-grid">
            <MiniStat label="Last touch" value={lead.last_sms_at ? formatDate(lead.last_sms_at) : lead.last_activity_at ? formatDate(lead.last_activity_at) : "None"} />
            <MiniStat label="Touches" value={String(lead.outreach_count ?? 0)} />
            <MiniStat label="Follow-up" value={lead.next_follow_up_date || "None"} />
            <MiniStat label="SMS" value={statusLabel(lead.sms_opt_status || "unknown")} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }} className="two-col">
            <InfoStack title="Contact">
              <p>Phone: {[lead.phone, lead.phone_2].filter(Boolean).join(" / ") || "Missing"}</p>
              <p>Email: {lead.email || "Missing"}</p>
              <p>Source: {lead.source_system || "Unknown"}{lead.campaign_source ? ` / ${lead.campaign_source}` : ""}</p>
            </InfoStack>
            <InfoStack title="Property">
              <p>{lead.property_address || "No address"}</p>
              <p>Parcel: {lead.parcel_id || "Missing"}</p>
              <p>{lead.county || "County pending"} · {lead.acreage ? `${lead.acreage} acres` : "Acres pending"}</p>
            </InfoStack>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {lead.property_url && <a href={lead.property_url} target="_blank" rel="noreferrer" style={secondaryButton}>Open Parcel</a>}
            {typeof lead.raw_data?.["Google Map"] === "string" && <a href={lead.raw_data["Google Map"]} target="_blank" rel="noreferrer" style={secondaryButton}>Map</a>}
            <button onClick={onOpenFile} style={secondaryButton}>Open Record</button>
            <button onClick={onBuildPacket} style={primaryButton}>Build Packet</button>
            <button onClick={onPass} style={secondaryButton}>Pass</button>
          </div>

          <ConversationPanel
            eyebrow="Conversation"
            title="Seller timeline"
            subject={[lead.phone, lead.phone_2].filter(Boolean).join(" / ") || "No phone"}
            communications={communications}
            activities={conversationActivities}
            emptyText="No communication yet. Start with a text, call, or outcome note."
            maxHeight={compact ? 340 : 520}
          />
        </section>

        <aside style={subPanel}>
          <p style={eyebrowSmall}>Action panel</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <button onClick={() => onQuickDisposition("no-answer", "No answer")} style={secondaryButton}>No Answer</button>
            <button onClick={() => onQuickDisposition("left-voicemail", "Left voicemail")} style={secondaryButton}>Voicemail</button>
            <button onClick={() => onQuickDisposition("wrong-number", "Wrong number")} style={secondaryButton}>Wrong #</button>
            <button onClick={() => onQuickDisposition("interested", "Seller is interested")} style={secondaryButton}>Interested</button>
            <button onClick={() => onQuickDisposition("follow-up", "Follow-up set", 2)} style={secondaryButton}>Follow Up</button>
          </div>

          <div style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <div>
                <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>Call seller</strong>
                <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{lead.phone || lead.phone_2 || "No phone"}</p>
              </div>
              <TwilioCallButton
                toNumber={callCompliance.phone?.number || lead.phone || lead.phone_2}
                leadId={lead.id}
                disabled={!callCompliance.allowed}
                disabledReason={!callCompliance.allowed ? `Call blocked: ${callCompliance.blockLabel}.` : null}
              />
            </div>
          </div>

          <div style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>Message seller</strong>
              <span style={pill}>{smsCompliance.phone?.number || lead.phone || lead.phone_2 || "No phone"}</span>
            </div>
            {smsBlocked && (
              <p style={{
                color: "var(--bone)",
                background: smsBlockSeverity === "compliance" ? "var(--obsidian)" : "rgba(176,137,84,0.16)",
                border: smsBlockSeverity === "compliance" ? "1px solid var(--obsidian)" : "1px solid var(--brass)",
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 8,
              }}>
                <strong style={{ color: smsBlockSeverity === "compliance" ? "var(--brass)" : "var(--obsidian)", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10 }}>
                  {smsBlockSeverity === "compliance" ? "⛔ Compliance block" : "⚠ Cannot text"}
                </strong>
                <span style={{ color: smsBlockSeverity === "compliance" ? "var(--bone)" : "var(--obsidian)" }}>
                  {smsCompliance.blockLabel} — SMS to this lead is disabled.
                </span>
              </p>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {smsTemplates.map(template => (
                <button
                  key={template.label}
                  onClick={() => setSmsDraft(template.body)}
                  disabled={smsBlocked}
                  style={{ ...secondaryButton, padding: "7px 9px", fontSize: 10, opacity: smsBlocked ? 0.55 : 1 }}
                >
                  {template.label}
                </button>
              ))}
            </div>
            <textarea
              id="va-workdesk-sms"
              rows={4}
              value={smsDraft}
              onChange={e => setSmsDraft(e.target.value)}
              placeholder={smsBlocked ? "SMS disabled for this lead." : "Type SMS to send through Sakari."}
              disabled={smsBlocked}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{smsDraft.trim().length} chars</span>
              <button onClick={onSendSms} disabled={smsDisabled} style={{ ...primaryButton, opacity: smsDisabled ? 0.55 : 1 }}>
                {smsSending ? "Sending..." : "Send SMS"}
              </button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--fog)", paddingTop: 12 }}>
            <p style={eyebrowSmall}>Log call or text outcome</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              <select value={dispositionDraft.disposition} onChange={e => setDispositionDraft({ ...dispositionDraft, disposition: e.target.value as LeadDisposition })}>
                {LEAD_DISPOSITIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <input value={dispositionDraft.note} onChange={e => setDispositionDraft({ ...dispositionDraft, note: e.target.value })} placeholder="Short result note" />
              <input value={dispositionDraft.nextFollowUpDate} onChange={e => setDispositionDraft({ ...dispositionDraft, nextFollowUpDate: e.target.value })} type="date" />
              <button onClick={onSaveDisposition} style={primaryButton}>Save Outcome</button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--fog)", paddingTop: 12, marginTop: 12 }}>
            <p style={eyebrowSmall}>Manual note</p>
            <select value={activityDraft.activityType} onChange={e => setActivityDraft({ ...activityDraft, activityType: e.target.value as ImportedLandLeadActivity["activity_type"] })}>
              {LEAD_ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <input style={{ marginTop: 8 }} value={activityDraft.nextFollowUpDate} onChange={e => setActivityDraft({ ...activityDraft, nextFollowUpDate: e.target.value })} type="date" />
            <textarea id="va-workdesk-note" rows={3} value={activityDraft.summary} onChange={e => setActivityDraft({ ...activityDraft, summary: e.target.value })} placeholder="Call notes, email notes, seller response, or research context." style={{ marginTop: 8 }} />
            <button onClick={onLogActivity} style={{ ...secondaryButton, marginTop: 8 }}>Save Note</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LeadPathCard({ label: text, detail, done, active }: { label: string; detail: string; done: boolean; active: boolean }) {
  return (
    <div style={{
      border: done || active ? "1px solid var(--brass)" : "1px solid var(--fog)",
      borderRadius: 8,
      background: done ? "rgba(176,137,84,0.12)" : active ? "rgba(255,252,245,0.9)" : "var(--surface)",
      padding: 10,
      minHeight: 82,
    }}>
      <p style={miniLabel}>{text}</p>
      <strong style={{ display: "block", color: done ? "var(--brass)" : "var(--obsidian)", fontSize: 13, marginTop: 6 }}>
        {done ? "Complete" : active ? "Now" : "Waiting"}
      </strong>
      <p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.35, marginTop: 4 }}>{detail}</p>
    </div>
  );
}

function ShiftCard({ label: text, value, tone = "calm" }: { label: string; value: string; tone?: "calm" | "hot" }) {
  return (
    <div style={{
      background: tone === "hot" ? "rgba(176,137,84,0.14)" : "var(--surface)",
      border: tone === "hot" ? "1px solid var(--brass)" : "1px solid var(--fog)",
      borderRadius: 8,
      padding: 12,
      minHeight: 72,
    }}>
      <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>{text}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: "var(--obsidian)", lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function MiniStat({ label: text, value }: { label: string; value: string }) {
  return (
    <div style={miniStat}>
      <span>{text}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StageCard({ label: text, active }: { label: string; active: boolean }) {
  return (
    <div style={{
      border: active ? "1px solid var(--brass)" : "1px solid var(--fog)",
      background: active ? "rgba(176,137,84,0.14)" : "var(--surface)",
      borderRadius: 8,
      padding: 12,
    }}>
      <span style={active ? readyDot : openDot} />
      <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 13, marginTop: 8 }}>{text}</strong>
    </div>
  );
}

function leadFlagLabels(lead: Partial<ImportedLandLead>): string[] {
  const flags: string[] = [];
  const raw = lead.raw_data ?? {};
  if (!lead.phone && !lead.phone_2) flags.push("No Phone");
  if (lead.duplicate_status && lead.duplicate_status !== "new") flags.push("Duplicate");
  if (String(raw["Land Locked"] ?? raw["Tag:Land Locked"] ?? "").toLowerCase().startsWith("y")) flags.push("Landlocked");
  if ((toNumber(String(raw["Flood Zone Percent"] ?? "")) ?? 0) > 0) flags.push("Flood");
  if ((toNumber(String(raw["Wetlands Percent"] ?? "")) ?? 0) > 0) flags.push("Wetlands");
  if ((lead.lead_score ?? 0) >= 60) flags.push("High Score");
  return flags.slice(0, 4);
}

function FlagRow({ lead }: { lead: Partial<ImportedLandLead> }) {
  const flags = leadFlagLabels(lead);
  if (!flags.length) return <span style={{ color: "var(--muted)" }}>Clear</span>;
  return (
    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {flags.map(flag => <span key={flag} style={flagChip}>{flag}</span>)}
    </span>
  );
}

function QueueButton({ label: text, detail, count, hot = false, onClick }: { label: string; detail: string; count: number; hot?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        textAlign: "left",
        border: hot ? "1px solid var(--brass)" : "1px solid var(--fog)",
        borderRadius: 8,
        padding: "10px 12px",
        background: hot ? "rgba(176,137,84,0.14)" : "var(--surface)",
      }}
    >
      <span>
        <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 13 }}>{text}</strong>
        <span style={{ display: "block", color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{detail}</span>
      </span>
      <span style={{ ...pill, color: hot ? "var(--obsidian)" : "var(--muted)", background: hot ? "rgba(176,137,84,0.18)" : "rgba(255,255,255,0.5)" }}>{count}</span>
    </button>
  );
}

function BriefingCard({ eyebrow, title, detail, tone = "calm", actionLabel, onAction }: { eyebrow: string; title: string; detail: string; tone?: "calm" | "hot" | "warn"; actionLabel?: string; onAction?: () => void }) {
  const border = tone === "hot" ? "1px solid var(--brass)" : tone === "warn" ? "1px solid var(--obsidian)" : "1px solid var(--fog)";
  const background = tone === "hot" ? "rgba(176,137,84,0.10)" : tone === "warn" ? "rgba(20,17,13,0.04)" : "var(--bone)";
  return (
    <div style={{ border, background, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8, minHeight: 144 }}>
      <p style={{ ...eyebrowSmall, color: tone === "hot" ? "var(--brass)" : "var(--muted)" }}>{eyebrow}</p>
      <strong style={{ color: "var(--obsidian)", fontSize: 15, lineHeight: 1.3 }}>{title}</strong>
      <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, flex: 1 }}>{detail}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} style={{ ...secondaryButton, fontSize: 10, padding: "8px 10px", minHeight: 32 }}>{actionLabel}</button>
      )}
    </div>
  );
}

function InfoStack({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)", color: "var(--muted)", fontSize: 12, lineHeight: 1.55 }}>
      <p style={miniLabel}>{title}</p>
      <div style={{ display: "grid", gap: 3, marginTop: 5 }}>{children}</div>
    </div>
  );
}

const clockInBanner: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(20,17,13,0.96), rgba(48,38,27,0.94))",
  color: "var(--bone)",
  border: "1px solid var(--obsidian)",
  borderRadius: 10,
  padding: "14px 20px",
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  boxShadow: "0 18px 48px rgba(20,17,13,0.18)",
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 16px 44px rgba(20,17,13,0.06)",
};

const subPanel: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 14,
};

const primaryButton: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  border: "1px solid var(--obsidian)",
  borderRadius: 6,
  padding: "10px 13px",
  minHeight: 42,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontFamily: "var(--font-body)",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "transparent",
  color: "var(--obsidian)",
  border: "1px solid var(--fog)",
};

const inlineTextButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--brass)",
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  padding: 0,
};

const homeMetricButton: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
  padding: 14,
  minHeight: 110,
  textAlign: "left",
  cursor: "pointer",
  display: "grid",
  gap: 6,
  alignContent: "start",
  boxShadow: "0 10px 26px rgba(20,17,13,0.04)",
};

const miniInboxButton: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "var(--surface)",
  padding: 10,
  textAlign: "left",
  cursor: "pointer",
  display: "grid",
  gap: 4,
  color: "var(--ink)",
  fontSize: 12,
  lineHeight: 1.35,
};

const tabButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.58)",
  color: "var(--ink)",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  padding: "10px 13px",
  minHeight: 40,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "var(--font-body)",
  cursor: "pointer",
};

const tabActive: React.CSSProperties = {
  ...tabButton,
  background: "var(--obsidian)",
  color: "var(--bone)",
  borderColor: "var(--obsidian)",
};

const tabCount: React.CSSProperties = {
  minWidth: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  background: "var(--surface)",
  color: "var(--muted)",
  fontSize: 10,
  letterSpacing: 0,
};

const tabCountActive: React.CSSProperties = {
  ...tabCount,
  background: "rgba(237,230,214,0.16)",
  color: "var(--bone)",
};

const label: React.CSSProperties = {
  display: "block",
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const eyebrow: React.CSSProperties = {
  color: "var(--brass)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  marginBottom: 8,
};

const eyebrowSmall: React.CSSProperties = {
  ...eyebrow,
  fontSize: 10,
  marginBottom: 6,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  color: "var(--obsidian)",
  fontSize: 24,
  fontWeight: 500,
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  padding: "3px 7px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  whiteSpace: "nowrap",
};

const hotPill: React.CSSProperties = {
  ...pill,
  borderColor: "var(--brass)",
  color: "var(--obsidian)",
  background: "rgba(176,137,84,0.14)",
};

const readyDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "var(--brass)",
  flexShrink: 0,
};

const openDot: React.CSSProperties = {
  ...readyDot,
  background: "transparent",
  border: "1px solid var(--fog)",
};

const miniStat: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 10,
  display: "grid",
  gap: 4,
  fontSize: 11,
  color: "var(--muted)",
};

const miniLabel: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const th: React.CSSProperties = {
  padding: "8px 8px 8px 0",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const td: React.CSSProperties = {
  padding: "9px 8px 9px 0",
  color: "var(--ink)",
  verticalAlign: "top",
};

const tableHead: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid var(--fog)",
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  textAlign: "left",
  background: "rgba(245,239,224,0.82)",
  whiteSpace: "nowrap",
};

const tableCell: React.CSSProperties = {
  padding: "11px 8px",
  borderBottom: "1px solid var(--fog)",
  color: "var(--ink)",
  fontSize: 12,
  lineHeight: 1.35,
  verticalAlign: "middle",
};

const iconButton: React.CSSProperties = {
  border: "1px solid var(--fog)",
  background: "rgba(255,255,255,0.55)",
  color: "var(--obsidian)",
  borderRadius: 6,
  minHeight: 30,
  padding: "5px 7px",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const flagChip: React.CSSProperties = {
  ...pill,
  fontSize: 9,
  padding: "2px 6px",
  letterSpacing: "0.06em",
};
