"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calculateDealAnalysis,
  createDeal,
  createDealActivity,
  createDealAttachment,
  fetchDealActivity,
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
  type ActionItem,
} from "@/lib/action-items";
import { createNotification } from "@/lib/operations";
import {
  createImportedLandLeadActivity,
  fetchImportedLandLeadActivities,
  fetchLandLeadBatches,
  fetchImportedLandLeads,
  leadToDealDraft,
  previewLandLeadsCsv,
  updateImportedLandLeadStatus,
  type ImportedLandLeadActivity,
  type ImportedLandLead,
  type LandLeadBatch,
  type LandLeadImportPreview,
} from "@/lib/land-leads";
import { attachCommunicationEventToDeal, fetchCommunicationEvents, markCommunicationEventsRead, type CommunicationEvent } from "@/lib/communications";
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
import ConversationPanel, { type ConversationActivity } from "@/components/ConversationPanel";
import LandUnderwritingPanel from "@/components/LandUnderwritingPanel";
import { labelForStatus } from "@/lib/status-map";
import { getLeadNextAction, type WorkflowTone } from "@/lib/workflow-actions";
import OperatingHeader from "@/components/OperatingHeader";
import TwilioCallButton from "@/components/TwilioCallButton";
import {
  BULK_SMS_MERGE_FIELDS,
  EXCLUSION_REASONS_BY_SEVERITY,
  EXCLUSION_SEVERITY_LABEL,
  EXCLUSION_SEVERITY_ORDER,
  appendComplianceFooter,
  categorizeForBulkSms,
  checkLeadCallCompliance,
  checkLeadSmsCompliance,
  estimateSegments,
  exclusionReasonLabel,
  renderMessageForRecipient,
} from "@/lib/bulk-sms";
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
type ContactQueueMode = "inbox" | "callbacks" | "campaigns" | "unmatched" | "relationships" | "recommended";
type ContactThreadFilter = "all" | "unread" | "read" | "needs-matching" | "linked";
type ListsView = "batches" | "properties" | "contacts" | "segments" | "campaigns";

const TABS: Array<{ value: VaTab; label: string }> = [
  { value: "today", label: "Dashboard" },
  { value: "outreach", label: "Contact Queue" },
  { value: "lists", label: "Lists" },
  { value: "packet", label: "Packets" },
  { value: "brief", label: "Daily Brief" },
];

const LISTS_VIEWS: Array<{ value: ListsView; label: string }> = [
  { value: "batches", label: "Batches" },
  { value: "properties", label: "Properties" },
  { value: "contacts", label: "Contacts" },
  { value: "segments", label: "Segments" },
  { value: "campaigns", label: "Campaigns" },
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
type BulkTextStep = "audience" | "compliance" | "message";
type SegmentBooleanFilter = "any" | "yes" | "no";
type SavedLeadSegment = {
  id: string;
  name: string;
  status: ImportStatusFilter;
  batchId: string;
  counties: string[];
  states: string[];
  cities: string[];
  zips: string[];
  mailStates: string[];
  minScore: string;
  minAcreage: string;
  maxAcreage: string;
  minMarketValue: string;
  maxMarketValue: string;
  landUse: string;
  ownerType: string;
  ownerOutOfState: SegmentBooleanFilter;
  ownerOutOfCounty: SegmentBooleanFilter;
  taxDelinquent: SegmentBooleanFilter;
  inHoa: SegmentBooleanFilter;
  landLocked: SegmentBooleanFilter;
  flood: SegmentBooleanFilter;
  wetlands: SegmentBooleanFilter;
  roadFrontage: SegmentBooleanFilter;
  tagOddShape: SegmentBooleanFilter;
  tagStructure: SegmentBooleanFilter;
  tagFarmland: SegmentBooleanFilter;
  tagSubdivide: SegmentBooleanFilter;
  tagEntitlement: SegmentBooleanFilter;
  createdAt: string;
};

const SAVED_LEAD_SEGMENTS_KEY = "meridian_va_saved_lead_segments";

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
type ContactComposerMode = "text" | "note" | "log";

const BULK_TEXT_TEMPLATES = [
  {
    label: "First touch",
    body: "Hi {{first_name}}, this is Meridian. Are you open to talking about {{property_list}}?",
  },
  {
    label: "Offer check",
    body: "Hi {{first_name}}, we are reviewing land in {{county}} and wanted to see if you would consider an offer on {{property_list}}.",
  },
  {
    label: "Follow-up",
    body: "Hi {{first_name}}, just following up on {{property_list}}. Would a quick call today or tomorrow work?",
  },
];

const DEFAULT_SEGMENT_FILTERS: Omit<SavedLeadSegment, "id" | "name" | "createdAt"> = {
  status: "all",
  batchId: "all",
  counties: [],
  states: [],
  cities: [],
  zips: [],
  mailStates: [],
  minScore: "",
  minAcreage: "",
  maxAcreage: "",
  minMarketValue: "",
  maxMarketValue: "",
  landUse: "",
  ownerType: "",
  ownerOutOfState: "any",
  ownerOutOfCounty: "any",
  taxDelinquent: "any",
  inHoa: "any",
  landLocked: "any",
  flood: "any",
  wetlands: "any",
  roadFrontage: "any",
  tagOddShape: "any",
  tagStructure: "any",
  tagFarmland: "any",
  tagSubdivide: "any",
  tagEntitlement: "any",
};

function segmentWithDefaults(segment: Partial<SavedLeadSegment>): SavedLeadSegment {
  const legacy = segment as Partial<SavedLeadSegment> & {
    county?: string;
    state?: string;
    city?: string;
    zip?: string;
    mailState?: string;
  };
  return {
    ...DEFAULT_SEGMENT_FILTERS,
    id: segment.id || `segment-${Date.now()}`,
    name: segment.name || "Saved segment",
    createdAt: segment.createdAt || new Date().toISOString(),
    status: segment.status || "all",
    batchId: segment.batchId || "all",
    counties: segment.counties?.length ? segment.counties : legacy.county ? [legacy.county] : [],
    states: segment.states?.length ? segment.states : legacy.state ? [legacy.state] : [],
    cities: segment.cities?.length ? segment.cities : legacy.city ? [legacy.city] : [],
    zips: segment.zips?.length ? segment.zips : legacy.zip ? [legacy.zip] : [],
    mailStates: segment.mailStates?.length ? segment.mailStates : legacy.mailState ? [legacy.mailState] : [],
    minScore: segment.minScore || "",
    minAcreage: segment.minAcreage || "",
    maxAcreage: segment.maxAcreage || "",
    minMarketValue: segment.minMarketValue || "",
    maxMarketValue: segment.maxMarketValue || "",
    landUse: segment.landUse || "",
    ownerType: segment.ownerType || "",
    ownerOutOfState: segment.ownerOutOfState || "any",
    ownerOutOfCounty: segment.ownerOutOfCounty || "any",
    taxDelinquent: segment.taxDelinquent || "any",
    inHoa: segment.inHoa || "any",
    landLocked: segment.landLocked || "any",
    flood: segment.flood || "any",
    wetlands: segment.wetlands || "any",
    roadFrontage: segment.roadFrontage || "any",
    tagOddShape: segment.tagOddShape || "any",
    tagStructure: segment.tagStructure || "any",
    tagFarmland: segment.tagFarmland || "any",
    tagSubdivide: segment.tagSubdivide || "any",
    tagEntitlement: segment.tagEntitlement || "any",
  };
}

function matchesTextFilter(value: string | null | undefined, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (value || "").toLowerCase().includes(normalized);
}

function matchesAnyTextFilter(value: string | null | undefined, queries: string[]): boolean {
  const active = queries.map(query => query.trim()).filter(Boolean);
  if (active.length === 0) return true;
  return active.some(query => matchesTextFilter(value, query));
}

function toggleValue(values: string[], next: string): string[] {
  const trimmed = next.trim();
  if (!trimmed) return values;
  return values.includes(trimmed) ? values.filter(value => value !== trimmed) : [...values, trimmed];
}

function matchesBooleanFilter(value: boolean | null | undefined, filter: SegmentBooleanFilter): boolean {
  if (filter === "any") return true;
  return filter === "yes" ? value === true : value !== true;
}

function uniqueSortedOptions(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(value => (value || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function hasPositive(value: number | null | undefined): boolean {
  return typeof value === "number" && value > 0;
}

function leadMatchesBulkTextCriteria(
  lead: ImportedLandLead,
  rawCriteria: Partial<SavedLeadSegment>,
): boolean {
  const criteria = segmentWithDefaults(rawCriteria);
  const minScore = toNumber(criteria.minScore);
  const minAcres = toNumber(criteria.minAcreage);
  const maxAcres = toNumber(criteria.maxAcreage);
  const minMarketValue = toNumber(criteria.minMarketValue);
  const maxMarketValue = toNumber(criteria.maxMarketValue);

  if (criteria.batchId !== "all" && lead.batch_id !== criteria.batchId) return false;
  if (criteria.status === "duplicates" && lead.duplicate_status === "new") return false;
  if (criteria.status === "has-phone" && !lead.phone && !lead.phone_2) return false;
  if (criteria.status === "no-phone" && (lead.phone || lead.phone_2)) return false;
  if (criteria.status === "score-60" && (lead.lead_score ?? 0) < 60) return false;
  if (criteria.status === "landlocked" && !String(lead.raw_data?.["Land Locked"] ?? lead.raw_data?.["Tag:Land Locked"] ?? "").toLowerCase().startsWith("y")) return false;
  if (criteria.status === "flood" && !(toNumber(String(lead.raw_data?.["Flood Zone Percent"] ?? "")) ?? 0)) return false;
  if (criteria.status === "wetlands" && !(toNumber(String(lead.raw_data?.["Wetlands Percent"] ?? "")) ?? 0)) return false;
  if (["new", "contacted", "interested", "passed"].includes(criteria.status) && lead.status !== criteria.status) return false;
  if (!matchesAnyTextFilter(lead.county, criteria.counties)) return false;
  if (!matchesAnyTextFilter(lead.state, criteria.states)) return false;
  if (!matchesAnyTextFilter(lead.city, criteria.cities)) return false;
  if (!matchesAnyTextFilter(lead.zip, criteria.zips)) return false;
  if (!matchesAnyTextFilter(lead.mail_state, criteria.mailStates)) return false;
  if (!matchesTextFilter(lead.land_use, criteria.landUse)) return false;
  if (!matchesTextFilter(lead.owner_type, criteria.ownerType)) return false;
  if (minScore !== null && (lead.lead_score ?? 0) < minScore) return false;
  if (minAcres !== null && (lead.acreage ?? 0) < minAcres) return false;
  if (maxAcres !== null && (lead.acreage ?? 0) > maxAcres) return false;
  if (minMarketValue !== null && (lead.market_value ?? lead.total_parcel_value ?? 0) < minMarketValue) return false;
  if (maxMarketValue !== null && (lead.market_value ?? lead.total_parcel_value ?? 0) > maxMarketValue) return false;
  if (!matchesBooleanFilter(lead.owner_out_of_state, criteria.ownerOutOfState)) return false;
  if (!matchesBooleanFilter(lead.owner_out_of_county, criteria.ownerOutOfCounty)) return false;
  if (!matchesBooleanFilter(lead.tax_delinquent, criteria.taxDelinquent)) return false;
  if (!matchesBooleanFilter(lead.in_hoa, criteria.inHoa)) return false;
  if (!matchesBooleanFilter(lead.is_land_locked, criteria.landLocked)) return false;
  if (!matchesBooleanFilter(hasPositive(lead.flood_zone_percent), criteria.flood)) return false;
  if (!matchesBooleanFilter(hasPositive(lead.wetlands_percent), criteria.wetlands)) return false;
  if (!matchesBooleanFilter(hasPositive(lead.road_frontage_ft), criteria.roadFrontage)) return false;
  if (!matchesBooleanFilter(lead.tag_odd_shape, criteria.tagOddShape)) return false;
  if (!matchesBooleanFilter(lead.tag_structure, criteria.tagStructure)) return false;
  if (!matchesBooleanFilter(lead.tag_farmland, criteria.tagFarmland)) return false;
  if (!matchesBooleanFilter(lead.tag_subdivide, criteria.tagSubdivide)) return false;
  if (!matchesBooleanFilter(lead.tag_entitlement, criteria.tagEntitlement)) return false;
  return true;
}

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

function formatQueueDueReason(dueDate: string | null | undefined): string {
  if (!dueDate) return "Why: follow-up date is due.";
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - due.getTime()) / 86400000);
  if (diff > 1) return `Why: follow-up is ${diff} days overdue.`;
  if (diff === 1) return "Why: follow-up was due yesterday.";
  if (diff === 0) return "Why: follow-up is due today.";
  return `Why: follow-up is due ${dueDate}.`;
}

function formatCallSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function normalizedPhone(value: string | null | undefined): string | null {
  if (String(value || "").toLowerCase().startsWith("client:")) return null;
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value?.startsWith("+") ? value : null;
}

function communicationPhoneCandidates(event: CommunicationEvent): Array<string | null | undefined> {
  if (event.channel === "voice") {
    return event.direction === "inbound"
      ? [event.contact_number, event.from_number, event.to_number]
      : [event.contact_number, event.to_number, event.from_number];
  }
  return [event.contact_number, event.direction === "inbound" ? event.from_number : event.to_number, event.from_number, event.to_number];
}

function phoneForCommunicationEvent(event: CommunicationEvent | null): string | null {
  if (!event) return null;
  for (const value of communicationPhoneCandidates(event)) {
    const phone = normalizedPhone(value);
    if (phone) return phone;
  }
  return null;
}

type ConversationItem = {
  id: string;
  kind: "sms-in" | "sms-out" | "activity";
  title: string;
  date: string;
  body: string;
  meta?: string;
};

type ContactThread = {
  key: string;
  phone: string | null;
  title: string;
  statusLabel: "Deal linked" | "Lead linked" | "Needs matching";
  latestEvent: CommunicationEvent;
  events: CommunicationEvent[];
  unreadCount: number;
  latestAt: string;
  preview: string;
};

function communicationEventDate(event: CommunicationEvent): string {
  return event.provider_created_at || event.created_at;
}

function threadKeyForCommunicationEvent(event: CommunicationEvent): string {
  const phone = phoneForCommunicationEvent(event);
  const phoneDigits = (phone ?? "").replace(/\D/g, "");
  const phoneKey = phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits;
  if (event.matched_deal_id) return `deal:${event.matched_deal_id}`;
  if (event.matched_lead_id) return `lead:${event.matched_lead_id}`;
  if (phoneKey) return `phone:${phoneKey}`;
  if (event.provider_conversation_id) return `conversation:${event.provider_conversation_id}`;
  return `event:${event.id}`;
}

function buildContactThreads(events: CommunicationEvent[]): ContactThread[] {
  const groups = new Map<string, CommunicationEvent[]>();
  events.forEach(event => {
    const key = threadKeyForCommunicationEvent(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  });

  return Array.from(groups.entries()).map(([key, rows]) => {
    const sorted = rows.slice().sort((a, b) => communicationEventDate(b).localeCompare(communicationEventDate(a)));
    const latestEvent = sorted[0];
    const phone = phoneForCommunicationEvent(latestEvent);
    const statusLabel: ContactThread["statusLabel"] = latestEvent.matched_deal_id ? "Deal linked" : latestEvent.matched_lead_id ? "Lead linked" : "Needs matching";
    const unreadCount = sorted.filter(event => event.direction === "inbound" && !event.read_at).length;
    return {
      key,
      phone,
      title: latestEvent.contact_name || phone || "Unknown contact",
      statusLabel,
      latestEvent,
      events: sorted,
      unreadCount,
      latestAt: communicationEventDate(latestEvent),
      preview: latestEvent.body || latestEvent.status || latestEvent.provider_event_type || "Conversation update",
    };
  }).sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

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
        : event.direction === "inbound" ? "Contact SMS" : event.direction === "outbound" ? "Meridian SMS" : "SMS update",
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

function dealActivitiesToConversationItems(rows: Awaited<ReturnType<typeof fetchDealActivity>>): ConversationActivity[] {
  return rows.map(activity => ({
    id: activity.id,
    title: statusLabel(activity.activity_type),
    date: activity.created_at,
    body: activity.summary,
    meta: activity.actor || undefined,
  }));
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
  const [selectedCommunicationEventId, setSelectedCommunicationEventId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [leadActivities, setLeadActivities] = useState<ImportedLandLeadActivity[]>([]);
  const [communicationEvents, setCommunicationEvents] = useState<CommunicationEvent[]>([]);
  const [eventActivities, setEventActivities] = useState<ConversationActivity[]>([]);
  const [unmatchedSms, setUnmatchedSms] = useState<CommunicationEvent[]>([]);
  const [recentInboundSms, setRecentInboundSms] = useState<CommunicationEvent[]>([]);
  const [importPreview, setImportPreview] = useState<LandLeadImportPreview | null>(null);
  const [importStep, setImportStep] = useState<ImportStep>("work");
  const [importStage, setImportStage] = useState<ImportStage>("idle");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState<ImportStatusFilter>("all");
  const [listsView, setListsView] = useState<ListsView>("properties");
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");
  const [uploadSource, setUploadSource] = useState("Land Portal");
  const [uploadCampaign, setUploadCampaign] = useState("");
  const [activityDraft, setActivityDraft] = useState<{ activityType: ImportedLandLeadActivity["activity_type"]; summary: string; nextFollowUpDate: string }>({ activityType: "called", summary: "", nextFollowUpDate: "" });
  const [dispositionDraft, setDispositionDraft] = useState<{ disposition: LeadDisposition; note: string; nextFollowUpDate: string }>({ disposition: "no-answer", note: "", nextFollowUpDate: "" });
  const [smsDraft, setSmsDraft] = useState("");
  const [contactComposerMode, setContactComposerMode] = useState<ContactComposerMode>("text");
  const [bulkTextModalOpen, setBulkTextModalOpen] = useState(false);
  const [bulkTextStep, setBulkTextStep] = useState<BulkTextStep>("audience");
  const [contactQueueMode, setContactQueueMode] = useState<ContactQueueMode>("inbox");
  const [contactFiltersOpen, setContactFiltersOpen] = useState(false);
  const [contactThreadFilter, setContactThreadFilter] = useState<ContactThreadFilter>("all");
  const [contactActionMenuOpen, setContactActionMenuOpen] = useState(false);
  const [savedLeadSegments, setSavedLeadSegments] = useState<SavedLeadSegment[]>([]);
  const [activeLeadSegmentId, setActiveLeadSegmentId] = useState<string | null>(null);
  const [leadSegmentName, setLeadSegmentName] = useState("");
  const [bulkTextAudienceStatus, setBulkTextAudienceStatus] = useState<ImportStatusFilter>("all");
  const [bulkTextBatchId, setBulkTextBatchId] = useState("all");
  const [bulkTextCounties, setBulkTextCounties] = useState<string[]>([]);
  const [bulkTextStates, setBulkTextStates] = useState<string[]>([]);
  const [bulkTextCities, setBulkTextCities] = useState<string[]>([]);
  const [bulkTextZips, setBulkTextZips] = useState<string[]>([]);
  const [bulkTextMailStates, setBulkTextMailStates] = useState<string[]>([]);
  const [bulkTextMinScore, setBulkTextMinScore] = useState("");
  const [bulkTextMinAcreage, setBulkTextMinAcreage] = useState("");
  const [bulkTextMaxAcreage, setBulkTextMaxAcreage] = useState("");
  const [bulkTextMinMarketValue, setBulkTextMinMarketValue] = useState("");
  const [bulkTextMaxMarketValue, setBulkTextMaxMarketValue] = useState("");
  const [bulkTextLandUse, setBulkTextLandUse] = useState("");
  const [bulkTextOwnerType, setBulkTextOwnerType] = useState("");
  const [bulkTextOwnerOutOfState, setBulkTextOwnerOutOfState] = useState<SegmentBooleanFilter>("any");
  const [bulkTextOwnerOutOfCounty, setBulkTextOwnerOutOfCounty] = useState<SegmentBooleanFilter>("any");
  const [bulkTextTaxDelinquent, setBulkTextTaxDelinquent] = useState<SegmentBooleanFilter>("any");
  const [bulkTextInHoa, setBulkTextInHoa] = useState<SegmentBooleanFilter>("any");
  const [bulkTextLandLocked, setBulkTextLandLocked] = useState<SegmentBooleanFilter>("any");
  const [bulkTextFlood, setBulkTextFlood] = useState<SegmentBooleanFilter>("any");
  const [bulkTextWetlands, setBulkTextWetlands] = useState<SegmentBooleanFilter>("any");
  const [bulkTextRoadFrontage, setBulkTextRoadFrontage] = useState<SegmentBooleanFilter>("any");
  const [bulkTextTagOddShape, setBulkTextTagOddShape] = useState<SegmentBooleanFilter>("any");
  const [bulkTextTagStructure, setBulkTextTagStructure] = useState<SegmentBooleanFilter>("any");
  const [bulkTextTagFarmland, setBulkTextTagFarmland] = useState<SegmentBooleanFilter>("any");
  const [bulkTextTagSubdivide, setBulkTextTagSubdivide] = useState<SegmentBooleanFilter>("any");
  const [bulkTextTagEntitlement, setBulkTextTagEntitlement] = useState<SegmentBooleanFilter>("any");
  const [bulkTextMessage, setBulkTextMessage] = useState("");
  const [bulkTextSendWindow, setBulkTextSendWindow] = useState("Business hours");
  const [bulkTextThrottle, setBulkTextThrottle] = useState("50/hour");
  const [bulkTextSending, setBulkTextSending] = useState(false);
  const [bulkTextResult, setBulkTextResult] = useState<{ sent?: number; error?: string } | null>(null);
  const [draftCommunicationEventId, setDraftCommunicationEventId] = useState<string | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [briefSaving, setBriefSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<VaTab>("today");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [commsStatus, setCommsStatus] = useState<{
    phoneState: "offline" | "connecting" | "online" | "ringing" | "in-call" | "error";
    phoneMessage: string;
    unread: number;
    callDuration: number;
    open: boolean;
  }>({ phoneState: "offline", phoneMessage: "Global comms is closed.", unread: 0, callDuration: 0, open: false });
  const [notifyReviewUpdate, setNotifyReviewUpdate] = useState(false);
  const [activeMemberNames, setActiveMemberNames] = useState<string[]>([]);
  const leadCsvInputRef = useRef<HTMLInputElement | null>(null);
  const urlPrefillRef = useRef("");

  const reload = useCallback(async (memberName = user) => {
    setLoading(true);
    const results = await Promise.allSettled([
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
    const value = <T,>(index: number, fallback: T) => {
      const result = results[index] as PromiseSettledResult<T>;
      return result.status === "fulfilled" ? result.value : fallback;
    };
    const rows = value<Deal[]>(0, []);
    const briefRows = value<VaDailyBrief[]>(1, []);
    const timeRows = value<VaTimeEntry[]>(2, []);
    const requestRows = value<VaTimeChangeRequest[]>(3, []);
    const currentShift = value<VaTimeEntry | null>(4, null);
    const importRows = value<ImportedLandLead[]>(5, []);
    const batchRows = value<LandLeadBatch[]>(6, []);
    const smsRows = value<CommunicationEvent[]>(7, []);
    const recentSmsRows = value<CommunicationEvent[]>(8, []);
    const taskRows = value<ActionItem[]>(9, []);
    const memberNames = value<string[]>(10, []);
    const failedLoads = results
      .map((result, index) => result.status === "rejected" ? index : null)
      .filter((index): index is number => index !== null);
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
    setLastRefreshedAt(new Date().toISOString());
    if (failedLoads.length) {
      setMessage("Some VA data did not load. Refresh the queue or check the deployment environment if counts stay at zero.");
    }
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
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") || "today";
      if (TABS.some(item => item.value === tab)) setActiveTab(tab as VaTab);
      const sellerPhone = params.get("seller_phone") || "";
      const sellerName = params.get("seller_name") || "";
      const leadId = params.get("lead") || "";
      const prefillKey = [tab, sellerPhone, sellerName, leadId].join("|");
      if (tab === "packet" && sellerPhone && prefillKey !== urlPrefillRef.current) {
        urlPrefillRef.current = prefillKey;
        setSelectedId(null);
        setSelectedImportedLeadId(null);
        setDraft({
          ...EMPTY_DRAFT,
          title: sellerName || `Contact ${sellerPhone}`,
          seller_name: sellerName,
          seller_phone: sellerPhone,
          source: "Comms",
          notes: "Created from an unmatched global comms contact. Add the property address, parcel, and relationship context before submitting.",
        });
        setMessage("Started a packet from the unmatched comms contact. Add property details before saving.");
      }
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_LEAD_SEGMENTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedLeadSegment>[];
      if (Array.isArray(parsed)) setSavedLeadSegments(parsed.map(segmentWithDefaults));
    } catch {
      setSavedLeadSegments([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_LEAD_SEGMENTS_KEY, JSON.stringify(savedLeadSegments));
  }, [savedLeadSegments]);

  useEffect(() => {
    const handleCommsStatus = (event: Event) => {
      const detail = (event as CustomEvent<typeof commsStatus>).detail;
      if (detail) setCommsStatus(detail);
    };
    window.addEventListener("meridian-comms-status", handleCommsStatus);
    return () => window.removeEventListener("meridian-comms-status", handleCommsStatus);
  }, []);

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
  const leadFollowUpsDue = useMemo(() => importedLeads.filter(lead =>
    isDueTodayOrPast(lead.next_follow_up_date, today)
    && lead.status !== "converted"
    && lead.status !== "passed"
  ), [importedLeads, today]);
  const blockedAssignedTasks = useMemo(() => openAssignedTasks.filter(task => task.status === "blocked"), [openAssignedTasks]);
  const memberAssignedTasks = useMemo(() => openAssignedTasks.filter(task => task.status !== "blocked"), [openAssignedTasks]);
  const dashboardWorkQueueCount = leadFollowUpsDue.length + followUpsDue.length + interestedLeads.length + draftLeads.length + memberAssignedTasks.length + blockedAssignedTasks.length;
  const selectedImportedLead = useMemo(() => importedLeads.find(lead => lead.id === selectedImportedLeadId) ?? null, [importedLeads, selectedImportedLeadId]);
  const selectedCommunicationEvent = useMemo(() => {
    if (!selectedCommunicationEventId) return null;
    return [...recentInboundSms, ...unmatchedSms].find(event => event.id === selectedCommunicationEventId) ?? null;
  }, [recentInboundSms, selectedCommunicationEventId, unmatchedSms]);
  const activeCommunicationEvent = useMemo(() => {
    if (selectedImportedLead) return null;
    if (selectedCommunicationEvent) return selectedCommunicationEvent;
    if (activeTab !== "outreach") return null;
    return recentInboundSms[0] ?? unmatchedSms[0] ?? null;
  }, [activeTab, recentInboundSms, selectedCommunicationEvent, selectedImportedLead, unmatchedSms]);
  const activeCommunicationThreadKey = activeCommunicationEvent ? threadKeyForCommunicationEvent(activeCommunicationEvent) : null;
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
  const bulkTextAudience = useMemo(() => {
    const criteria = {
      status: bulkTextAudienceStatus,
      batchId: bulkTextBatchId,
      counties: bulkTextCounties,
      states: bulkTextStates,
      cities: bulkTextCities,
      zips: bulkTextZips,
      mailStates: bulkTextMailStates,
      minScore: bulkTextMinScore,
      minAcreage: bulkTextMinAcreage,
      maxAcreage: bulkTextMaxAcreage,
      minMarketValue: bulkTextMinMarketValue,
      maxMarketValue: bulkTextMaxMarketValue,
      landUse: bulkTextLandUse,
      ownerType: bulkTextOwnerType,
      ownerOutOfState: bulkTextOwnerOutOfState,
      ownerOutOfCounty: bulkTextOwnerOutOfCounty,
      taxDelinquent: bulkTextTaxDelinquent,
      inHoa: bulkTextInHoa,
      landLocked: bulkTextLandLocked,
      flood: bulkTextFlood,
      wetlands: bulkTextWetlands,
      roadFrontage: bulkTextRoadFrontage,
      tagOddShape: bulkTextTagOddShape,
      tagStructure: bulkTextTagStructure,
      tagFarmland: bulkTextTagFarmland,
      tagSubdivide: bulkTextTagSubdivide,
      tagEntitlement: bulkTextTagEntitlement,
    };
    return importedLeads
      .filter(lead => leadMatchesBulkTextCriteria(lead, criteria))
      .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
      .slice(0, 500);
  }, [
    bulkTextAudienceStatus,
    bulkTextBatchId,
    bulkTextCities,
    bulkTextCounties,
    bulkTextFlood,
    bulkTextInHoa,
    bulkTextLandLocked,
    bulkTextLandUse,
    bulkTextMailStates,
    bulkTextMaxAcreage,
    bulkTextMaxMarketValue,
    bulkTextMinAcreage,
    bulkTextMinMarketValue,
    bulkTextMinScore,
    bulkTextOwnerOutOfCounty,
    bulkTextOwnerOutOfState,
    bulkTextOwnerType,
    bulkTextRoadFrontage,
    bulkTextStates,
    bulkTextTagEntitlement,
    bulkTextTagFarmland,
    bulkTextTagOddShape,
    bulkTextTagStructure,
    bulkTextTagSubdivide,
    bulkTextTaxDelinquent,
    bulkTextWetlands,
    bulkTextZips,
    importedLeads,
  ]);
  const bulkTextCategorization = useMemo(() => categorizeForBulkSms(bulkTextAudience), [bulkTextAudience]);
  const bulkTextSegments = useMemo(() => estimateSegments(bulkTextMessage), [bulkTextMessage]);
  const bulkTextFinalMessage = useMemo(() => appendComplianceFooter(bulkTextMessage), [bulkTextMessage]);
  const bulkTextPreviewLeads = bulkTextCategorization.eligible.slice(0, 3);
  const bulkTextLocationOptions = useMemo(() => {
    const countyRows = importedLeads;
    const stateRows = importedLeads.filter(lead => matchesAnyTextFilter(lead.county, bulkTextCounties));
    const cityRows = importedLeads.filter(lead =>
      matchesAnyTextFilter(lead.county, bulkTextCounties)
      && matchesAnyTextFilter(lead.state, bulkTextStates)
    );
    const zipRows = importedLeads.filter(lead =>
      matchesAnyTextFilter(lead.county, bulkTextCounties)
      && matchesAnyTextFilter(lead.state, bulkTextStates)
      && matchesAnyTextFilter(lead.city, bulkTextCities)
    );
    return {
      counties: uniqueSortedOptions(countyRows.map(lead => lead.county)),
      states: uniqueSortedOptions(stateRows.map(lead => lead.state)),
      cities: uniqueSortedOptions(cityRows.map(lead => lead.city)),
      zips: uniqueSortedOptions(zipRows.map(lead => lead.zip)),
      mailStates: uniqueSortedOptions(importedLeads.map(lead => lead.mail_state)),
    };
  }, [bulkTextCities, bulkTextCounties, bulkTextStates, importedLeads]);
  const batchLeads = useMemo(() => selectedBatchId ? importedLeads.filter(lead => lead.batch_id === selectedBatchId) : importedLeads, [importedLeads, selectedBatchId]);
  const contactRelationshipRows = useMemo(() => {
    const groups = new Map<string, ImportedLandLead[]>();
    importedLeads.forEach(lead => {
      if (lead.status === "converted") return;
      const phone = normalizedPhone(lead.phone || lead.phone_2) || "";
      const key = phone || `${(lead.owner_name || "Unknown contact").toLowerCase()}|${(lead.mailing_address || lead.county || "").toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), lead]);
    });
    return Array.from(groups.entries()).map(([key, leads]) => {
      const primary = leads.slice().sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))[0];
      const textable = leads.some(lead => checkLeadSmsCompliance(lead).allowed);
      return {
        key,
        primary,
        leads,
        propertyCount: leads.length,
        textable,
        highestScore: Math.max(...leads.map(lead => lead.lead_score ?? 0)),
        latestTouch: leads.map(lead => lead.last_activity_at || lead.last_sms_at || lead.updated_at || lead.created_at).filter(Boolean).sort().at(-1) || primary.updated_at,
      };
    }).sort((a, b) => b.highestScore - a.highestScore || b.propertyCount - a.propertyCount);
  }, [importedLeads]);
  const listBatchRows = useMemo(() => leadBatches.map(batch => {
    const leads = importedLeads.filter(lead => lead.batch_id === batch.id);
    const textable = categorizeForBulkSms(leads).eligible.length;
    const duplicates = leads.filter(lead => lead.duplicate_status && lead.duplicate_status !== "new").length;
    return { batch, leads, textable, duplicates };
  }), [importedLeads, leadBatches]);
  const selectedPropertyBatch = selectedImportedLead?.batch_id ? leadBatches.find(batch => batch.id === selectedImportedLead.batch_id) ?? null : null;
  const selectedContactProperties = selectedImportedLead ? contactRelationshipRows.find(row => row.leads.some(lead => lead.id === selectedImportedLead.id))?.leads ?? [selectedImportedLead] : [];
  const listKpis = {
    batches: leadBatches.length,
    properties: importedLeads.length,
    contacts: contactRelationshipRows.length,
    textable: categorizeForBulkSms(importedLeads).eligible.length,
    packets: importedLeads.filter(lead => lead.deal_id || lead.status === "converted").length,
  };
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
  const campaignReadyLeads = useMemo(() => categorizeForBulkSms(importedLeads).eligible, [importedLeads]);
  const contactQueueRows = useMemo(() => {
    if (contactQueueMode === "callbacks") return leadFollowUpsDue.slice(0, 25);
    if (contactQueueMode === "campaigns") return campaignReadyLeads.slice(0, 25);
    if (contactQueueMode === "relationships") return filteredImportedLeads.slice(0, 25);
    if (contactQueueMode === "recommended") return workdeskLeadRows;
    return [...interestedLeads, ...leadFollowUpsDue, ...workdeskLeadRows].filter((lead, index, rows) => rows.findIndex(item => item.id === lead.id) === index).slice(0, 25);
  }, [campaignReadyLeads, contactQueueMode, filteredImportedLeads, interestedLeads, leadFollowUpsDue, workdeskLeadRows]);
  const inboxEventRows = useMemo(() => {
    const seen = new Set<string>();
    return [...recentInboundSms, ...unmatchedSms].filter(event => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    }).slice(0, 35);
  }, [recentInboundSms, unmatchedSms]);
  const filterThreadRows = useCallback((threads: ContactThread[]) => threads.filter(thread => {
    if (contactThreadFilter === "unread" && thread.unreadCount === 0) return false;
    if (contactThreadFilter === "read" && thread.unreadCount > 0) return false;
    if (contactThreadFilter === "needs-matching" && thread.statusLabel !== "Needs matching") return false;
    if (contactThreadFilter === "linked" && thread.statusLabel === "Needs matching") return false;
    const query = leadSearch.trim().toLowerCase();
    if (!query) return true;
    return [thread.title, thread.phone, thread.preview, thread.statusLabel]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query));
  }), [contactThreadFilter, leadSearch]);
  const inboxThreadRows = useMemo(() => filterThreadRows(buildContactThreads(inboxEventRows)), [filterThreadRows, inboxEventRows]);
  const unmatchedThreadRows = useMemo(() => filterThreadRows(buildContactThreads(unmatchedSms)).slice(0, 25), [filterThreadRows, unmatchedSms]);
  const activeCommunicationThread = useMemo(() => {
    if (!activeCommunicationThreadKey) return null;
    return [...buildContactThreads(inboxEventRows), ...buildContactThreads(unmatchedSms)].find(thread => thread.key === activeCommunicationThreadKey) ?? null;
  }, [activeCommunicationThreadKey, inboxEventRows, unmatchedSms]);
  const activeFilterCount = [
    leadSearch.trim(),
    leadFilter !== "all" ? leadFilter : "",
    minAcreage.trim(),
    maxAcreage.trim(),
    contactThreadFilter !== "all" ? contactThreadFilter : "",
  ].filter(Boolean).length;
  const contactQueueModeCounts = useMemo<Record<ContactQueueMode, number>>(() => ({
    inbox: inboxThreadRows.length || contactQueueRows.length,
    callbacks: leadFollowUpsDue.length,
    campaigns: campaignReadyLeads.length,
    unmatched: unmatchedThreadRows.length,
    relationships: filteredImportedLeads.length,
    recommended: workdeskLeadRows.length,
  }), [campaignReadyLeads.length, contactQueueRows.length, filteredImportedLeads.length, inboxThreadRows.length, leadFollowUpsDue.length, unmatchedThreadRows.length, workdeskLeadRows.length]);
  useEffect(() => {
    if (activeTab !== "outreach" || selectedImportedLeadId || selectedCommunicationEventId) return;
    const firstThread = inboxThreadRows[0] ?? null;
    if (firstThread) {
      setSelectedCommunicationEventId(firstThread.latestEvent.id);
      return;
    }
    const firstLead = contactQueueRows[0] ?? null;
    if (firstLead) setSelectedImportedLeadId(firstLead.id);
  }, [activeTab, contactQueueRows, inboxThreadRows, selectedCommunicationEventId, selectedImportedLeadId]);
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
  const tabCounts = useMemo<Record<VaTab, number>>(() => ({
    today: dashboardWorkQueueCount,
    outreach: recentInboundSms.length + followUpsDue.length,
    lists: importedLeads.length,
    packet: deals.length,
    brief: portalStats.briefSubmitted ? 1 : 0,
  }), [dashboardWorkQueueCount, deals.length, followUpsDue.length, importedLeads.length, portalStats.briefSubmitted, recentInboundSms.length]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("meridian-va-tab-counts", { detail: tabCounts }));
  }, [tabCounts]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("meridian-contact-queue-state", {
      detail: { active: contactQueueMode, counts: contactQueueModeCounts },
    }));
  }, [contactQueueMode, contactQueueModeCounts]);
  useEffect(() => {
    const handleMode = (event: Event) => {
      const detail = (event as CustomEvent<ContactQueueMode>).detail;
      if (detail) setContactQueueMode(detail);
    };
    const handleSearch = (event: Event) => {
      setLeadSearch((event as CustomEvent<string>).detail || "");
    };
    const handleBulkText = () => openBulkTextWorkflow();
    window.addEventListener("meridian-contact-queue-mode", handleMode);
    window.addEventListener("meridian-contact-queue-search", handleSearch);
    window.addEventListener("meridian-contact-queue-bulk-text", handleBulkText);
    return () => {
      window.removeEventListener("meridian-contact-queue-mode", handleMode);
      window.removeEventListener("meridian-contact-queue-search", handleSearch);
      window.removeEventListener("meridian-contact-queue-bulk-text", handleBulkText);
    };
  });
  const readinessItems = useMemo(() => [
    { label: "Address or parcel", done: !!(liveInput.address || liveInput.parcel_id) },
    { label: "Contact", done: !!(liveInput.seller_name || liveInput.seller_phone) },
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
    if (!selectedImportedLeadId) {
      setLeadActivities([]);
      if (!selectedCommunicationEventId) setEventActivities([]);
      if (!selectedCommunicationEventId) setCommunicationEvents([]);
      return;
    }
    void Promise.all([
      fetchImportedLandLeadActivities(selectedImportedLeadId),
      fetchCommunicationEvents({ leadId: selectedImportedLeadId, limit: 80 }),
    ]).then(([activities, comms]) => {
      setLeadActivities(activities);
      setCommunicationEvents(comms);
    });
  }, [selectedCommunicationEventId, selectedImportedLeadId]);

  useEffect(() => {
    if (!selectedCommunicationEvent || selectedImportedLeadId) {
      if (!selectedCommunicationEvent) setEventActivities([]);
      return;
    }
    setCommunicationEvents([selectedCommunicationEvent]);
    setEventActivities([]);
    const phone = phoneForCommunicationEvent(selectedCommunicationEvent);
    const loadDealActivity = selectedCommunicationEvent.matched_deal_id
      ? fetchDealActivity(selectedCommunicationEvent.matched_deal_id).then(rows => setEventActivities(dealActivitiesToConversationItems(rows)))
      : Promise.resolve();
    if (!phone && !selectedCommunicationEvent.matched_deal_id) {
      setCommunicationEvents([selectedCommunicationEvent]);
      void loadDealActivity;
      return;
    }
    void Promise.all([fetchCommunicationEvents({
      phone,
      dealId: selectedCommunicationEvent.matched_deal_id,
      limit: 80,
    }), loadDealActivity]).then(([comms]) => {
      setCommunicationEvents(comms.length ? comms : [selectedCommunicationEvent]);
    });
  }, [selectedCommunicationEvent, selectedImportedLeadId]);

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

  useEffect(() => {
    const handleGlobalCommsSent = (event: Event) => {
      const detail = (event as CustomEvent<{ leadId?: string | null; body?: string }>).detail ?? {};
      const lead = detail.leadId ? importedLeads.find(row => row.id === detail.leadId) ?? null : null;
      const label = lead?.owner_name || lead?.property_address || lead?.parcel_id || "global comms contact";
      const body = detail.body?.trim();
      const line = `SMS sent to ${label}${body ? `: ${body}` : ""}`;
      setBriefDraft(prev => ({
        ...prev,
        outreach_sent: (prev.outreach_sent ?? 0) + 1,
        leads_updated: lead ? (prev.leads_updated ?? 0) + 1 : prev.leads_updated,
        activities_completed: appendBriefText(prev.activities_completed, line),
      }));
    };
    window.addEventListener("meridian-comms-sent", handleGlobalCommsSent);
    return () => window.removeEventListener("meridian-comms-sent", handleGlobalCommsSent);
  }, [importedLeads]);

  if (!user) return null;

  const leadLabel = (lead: ImportedLandLead) => lead.owner_name || lead.property_address || lead.parcel_id || "Selected lead";
  const goToTab = (tab: VaTab) => {
    setActiveTab(tab);
    router.replace(tab === "today" ? "/va" : `/va?tab=${tab}`, { scroll: false });
    window.dispatchEvent(new CustomEvent("meridian-va-tab", { detail: tab }));
    window.setTimeout(() => document.getElementById(`va-tab-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const openBulkTextWorkflow = (useCurrentListFilters = false) => {
    if (useCurrentListFilters) {
      setBulkTextBatchId(selectedBatchId || "all");
      setBulkTextAudienceStatus(leadFilter === "no-phone" ? "all" : leadFilter);
      setBulkTextMinAcreage(minAcreage);
      setBulkTextMaxAcreage(maxAcreage);
    }
    setBulkTextModalOpen(true);
    setBulkTextStep("audience");
    setBulkTextResult(null);
  };
  const startNewImport = () => {
    goToTab("lists");
    setImportStep("upload");
    setImportPreview(null);
    setSelectedBatchId(null);
    setSelectedImportedLeadId(null);
    setBulkTextModalOpen(false);
    setMessage("Choose a Land Portal or Land Insights CSV to preview.");
    if (!importing) leadCsvInputRef.current?.click();
  };
  const openCommsThreadForEvent = (event: CommunicationEvent) => {
    const contactPhone = event.contact_number || (event.direction === "inbound" ? event.from_number : event.to_number);
    const phoneDigits = (contactPhone ?? "").replace(/\D/g, "");
    const phone = phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits;
    const threadKey = event.matched_lead_id
      ? `lead:${event.matched_lead_id}`
      : event.matched_deal_id
        ? `deal:${event.matched_deal_id}`
        : phone
          ? `phone:${phone}`
          : `event:${event.id}`;

    window.dispatchEvent(new CustomEvent("meridian-open-comms-thread", {
      detail: {
        threadKey,
        phone,
        leadId: event.matched_lead_id,
        dealId: event.matched_deal_id,
        eventId: event.id,
      },
    }));
  };
  const openIncomingSms = (event: CommunicationEvent) => {
    setContactActionMenuOpen(false);
    if (event.matched_lead_id) {
      const lead = importedLeads.find(item => item.id === event.matched_lead_id);
      if (lead) {
        setSelectedCommunicationEventId(null);
        selectImportedLead(lead, "outreach");
        window.setTimeout(() => document.getElementById("va-tab-outreach")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        return;
      }
    }
    setSelectedImportedLeadId(null);
    setSelectedCommunicationEventId(event.id);
  };
  const openIncomingThread = (thread: ContactThread) => {
    openIncomingSms(thread.latestEvent);
  };
  const markContactThreadReadState = async (thread: ContactThread, read: boolean) => {
    const eventIds = thread.events
      .filter(event => event.direction === "inbound")
      .map(event => event.id);
    const { error } = await markCommunicationEventsRead(eventIds, user, read);
    if (error) {
      setMessage(error);
      return;
    }
    const [unmatchedRows, recentRows] = await Promise.all([
      fetchCommunicationEvents({ unmatched: true, limit: 25 }),
      fetchCommunicationEvents({ limit: 120 }),
    ]);
    setUnmatchedSms(unmatchedRows);
    setRecentInboundSms(recentRows.filter(event => event.direction === "inbound").slice(0, 40));
    if (activeCommunicationEvent && thread.key === threadKeyForCommunicationEvent(activeCommunicationEvent)) {
      await refreshSelectedEventMessages(activeCommunicationEvent);
    }
    setMessage(read ? "Thread marked read." : "Thread marked unread.");
  };

  const setUnlinkedActionMessage = (action: string) => {
    setMessage(`${action} needs a linked relationship first. Use Find Match or the selected record card to connect this contact.`);
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
    setSelectedCommunicationEventId(null);
    setSelectedId(deal.id);
    setMessage("");
    setActiveTab("packet");
  };

  const openLinkedDeal = (dealId: string | null | undefined) => {
    if (!dealId) {
      setMessage("No linked deal packet found for this contact yet.");
      return;
    }
    const deal = deals.find(row => row.id === dealId);
    if (deal) {
      openDealBrief(deal);
      return;
    }
    router.push(`/opportunity?deal=${dealId}`);
  };

  const selectImportedLead = (lead: ImportedLandLead, tab: VaTab = "today") => {
    setSelectedId(null);
    setSelectedImportedLeadId(lead.id);
    setSelectedCommunicationEventId(null);
    setContactActionMenuOpen(false);
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
      fetchCommunicationEvents({ leadId, limit: 80 }),
      fetchCommunicationEvents({ unmatched: true, limit: 25 }),
      fetchCommunicationEvents({ limit: 120 }),
    ]);
    setImportedLeads(leadRows);
    setLeadActivities(activityRows);
    setCommunicationEvents(commRows);
    setUnmatchedSms(unmatchedRows);
    setRecentInboundSms(recentRows.filter(event => event.direction === "inbound").slice(0, 40));
  };

  const refreshSelectedEventMessages = async (event: CommunicationEvent) => {
    const phone = phoneForCommunicationEvent(event);
    const [commRows, unmatchedRows, recentRows, activityRows] = await Promise.all([
      fetchCommunicationEvents({ phone, dealId: event.matched_deal_id, limit: 80 }),
      fetchCommunicationEvents({ unmatched: true, limit: 25 }),
      fetchCommunicationEvents({ limit: 120 }),
      event.matched_deal_id ? fetchDealActivity(event.matched_deal_id) : Promise.resolve([]),
    ]);
    setCommunicationEvents(commRows.length ? commRows : [event]);
    setEventActivities(dealActivitiesToConversationItems(activityRows));
    setUnmatchedSms(unmatchedRows);
    setRecentInboundSms(recentRows.filter(row => row.direction === "inbound").slice(0, 40));
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

  const sendSmsToSelectedEvent = async () => {
    if (!activeCommunicationEvent) { setMessage("Select a contact first."); return; }
    const toNumber = phoneForCommunicationEvent(activeCommunicationEvent);
    if (!toNumber) { setMessage("This contact does not have a usable phone number."); return; }
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
          dealId: activeCommunicationEvent.matched_deal_id,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || result.error) {
        setMessage(`SMS failed: ${result.error || response.statusText}`);
        return;
      }
      setSmsDraft("");
      await refreshSelectedEventMessages(activeCommunicationEvent);
      addToDailyBrief(`SMS sent to ${toNumber}: ${body}`, {
        outreach_sent: (briefDraft.outreach_sent ?? 0) + 1,
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
      activities_completed: appendBriefText(prev.activities_completed, `Bulk SMS sent to ${sentCount} contact${sentCount === 1 ? "" : "s"} from ${selectedBatch?.campaign_source || selectedBatch?.original_filename || "current filtered list"}.`),
    }));
    setMessage(`Bulk SMS sent to ${sentCount} contact${sentCount === 1 ? "" : "s"}.`);
    return { sent: sentCount };
  };

  const sendBulkTextFromQueue = async () => {
    if (!bulkTextMessage.trim()) {
      setBulkTextResult({ error: "Write a message before sending." });
      return;
    }
    if (bulkTextCategorization.eligible.length === 0) {
      setBulkTextResult({ error: "No eligible recipients passed the current audience and compliance review." });
      return;
    }
    const confirmed = window.confirm(`Send this bulk text to ${bulkTextCategorization.eligible.length} eligible contact${bulkTextCategorization.eligible.length === 1 ? "" : "s"}?`);
    if (!confirmed) return;

    setBulkTextSending(true);
    setBulkTextResult(null);
    try {
      const result = await sendBulkSms({
        message: bulkTextMessage.trim(),
        recipients: bulkTextCategorization.eligible.map(lead => ({
          leadId: lead.id,
          toNumber: bulkTextCategorization.eligiblePhones[lead.id],
          label: lead.owner_name,
          rendered: renderMessageForRecipient(bulkTextMessage.trim(), lead),
        })),
      });
      setBulkTextResult(result.error ? { error: result.error } : { sent: result.sent ?? bulkTextCategorization.eligible.length });
      if (!result.error) {
        setBulkTextMessage("");
        setBulkTextModalOpen(false);
        setBulkTextStep("audience");
      }
    } catch (error) {
      setBulkTextResult({ error: error instanceof Error ? error.message : "Bulk text failed." });
    } finally {
      setBulkTextSending(false);
    }
  };

  const applyLeadSegment = (segment: SavedLeadSegment) => {
    const normalized = segmentWithDefaults(segment);
    setActiveLeadSegmentId(segment.id);
    setLeadSegmentName(normalized.name);
    setBulkTextAudienceStatus(normalized.status);
    setBulkTextBatchId(normalized.batchId);
    setBulkTextCounties(normalized.counties);
    setBulkTextStates(normalized.states);
    setBulkTextCities(normalized.cities);
    setBulkTextZips(normalized.zips);
    setBulkTextMailStates(normalized.mailStates);
    setBulkTextMinScore(normalized.minScore);
    setBulkTextMinAcreage(normalized.minAcreage);
    setBulkTextMaxAcreage(normalized.maxAcreage);
    setBulkTextMinMarketValue(normalized.minMarketValue);
    setBulkTextMaxMarketValue(normalized.maxMarketValue);
    setBulkTextLandUse(normalized.landUse);
    setBulkTextOwnerType(normalized.ownerType);
    setBulkTextOwnerOutOfState(normalized.ownerOutOfState);
    setBulkTextOwnerOutOfCounty(normalized.ownerOutOfCounty);
    setBulkTextTaxDelinquent(normalized.taxDelinquent);
    setBulkTextInHoa(normalized.inHoa);
    setBulkTextLandLocked(normalized.landLocked);
    setBulkTextFlood(normalized.flood);
    setBulkTextWetlands(normalized.wetlands);
    setBulkTextRoadFrontage(normalized.roadFrontage);
    setBulkTextTagOddShape(normalized.tagOddShape);
    setBulkTextTagStructure(normalized.tagStructure);
    setBulkTextTagFarmland(normalized.tagFarmland);
    setBulkTextTagSubdivide(normalized.tagSubdivide);
    setBulkTextTagEntitlement(normalized.tagEntitlement);
    setBulkTextStep("audience");
    setBulkTextResult(null);
  };

  const saveLeadSegment = () => {
    const name = leadSegmentName.trim() || [
      bulkTextCounties.length ? bulkTextCounties.join(", ") : null,
      bulkTextAudienceStatus !== "all" ? IMPORT_STATUS_FILTERS.find(filter => filter.value === bulkTextAudienceStatus)?.label : null,
      bulkTextMinScore.trim() ? `Score ${bulkTextMinScore.trim()}+` : null,
    ].filter(Boolean).join(" · ") || "Saved segment";
    const segment: SavedLeadSegment = {
      id: activeLeadSegmentId || `segment-${Date.now()}`,
      name,
      status: bulkTextAudienceStatus,
      batchId: bulkTextBatchId,
      counties: bulkTextCounties,
      states: bulkTextStates,
      cities: bulkTextCities,
      zips: bulkTextZips,
      mailStates: bulkTextMailStates,
      minScore: bulkTextMinScore.trim(),
      minAcreage: bulkTextMinAcreage.trim(),
      maxAcreage: bulkTextMaxAcreage.trim(),
      minMarketValue: bulkTextMinMarketValue.trim(),
      maxMarketValue: bulkTextMaxMarketValue.trim(),
      landUse: bulkTextLandUse.trim(),
      ownerType: bulkTextOwnerType.trim(),
      ownerOutOfState: bulkTextOwnerOutOfState,
      ownerOutOfCounty: bulkTextOwnerOutOfCounty,
      taxDelinquent: bulkTextTaxDelinquent,
      inHoa: bulkTextInHoa,
      landLocked: bulkTextLandLocked,
      flood: bulkTextFlood,
      wetlands: bulkTextWetlands,
      roadFrontage: bulkTextRoadFrontage,
      tagOddShape: bulkTextTagOddShape,
      tagStructure: bulkTextTagStructure,
      tagFarmland: bulkTextTagFarmland,
      tagSubdivide: bulkTextTagSubdivide,
      tagEntitlement: bulkTextTagEntitlement,
      createdAt: new Date().toISOString(),
    };
    setSavedLeadSegments(prev => {
      const withoutCurrent = prev.filter(item => item.id !== segment.id);
      return [segment, ...withoutCurrent].slice(0, 12);
    });
    setActiveLeadSegmentId(segment.id);
    setLeadSegmentName(name);
    setBulkTextResult(null);
  };

  const deleteLeadSegment = (segmentId: string) => {
    setSavedLeadSegments(prev => prev.filter(segment => segment.id !== segmentId));
    if (activeLeadSegmentId === segmentId) {
      setActiveLeadSegmentId(null);
      setLeadSegmentName("");
    }
  };

  const clearLeadSegmentFilters = () => {
    setActiveLeadSegmentId(null);
    setLeadSegmentName("");
    setBulkTextAudienceStatus("all");
    setBulkTextBatchId("all");
    setBulkTextCounties([]);
    setBulkTextStates([]);
    setBulkTextCities([]);
    setBulkTextZips([]);
    setBulkTextMailStates([]);
    setBulkTextMinScore("");
    setBulkTextMinAcreage("");
    setBulkTextMaxAcreage("");
    setBulkTextMinMarketValue("");
    setBulkTextMaxMarketValue("");
    setBulkTextLandUse("");
    setBulkTextOwnerType("");
    setBulkTextOwnerOutOfState("any");
    setBulkTextOwnerOutOfCounty("any");
    setBulkTextTaxDelinquent("any");
    setBulkTextInHoa("any");
    setBulkTextLandLocked("any");
    setBulkTextFlood("any");
    setBulkTextWetlands("any");
    setBulkTextRoadFrontage("any");
    setBulkTextTagOddShape("any");
    setBulkTextTagStructure("any");
    setBulkTextTagFarmland("any");
    setBulkTextTagSubdivide("any");
    setBulkTextTagEntitlement("any");
    setBulkTextResult(null);
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
        event.body ? `Contact text: ${event.body}` : "",
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

  const saveContactQueueNote = async () => {
    const summary = activityDraft.summary.trim();
    if (!summary) { setMessage("Write a note before saving."); return; }
    if (selectedImportedLead) {
      const { error } = await createImportedLandLeadActivity({
        leadId: selectedImportedLead.id,
        actor: user,
        activityType: "note",
        summary,
        nextFollowUpDate: null,
      });
      if (error) { setMessage(error); return; }
      await refreshSelectedLeadMessages(selectedImportedLead.id);
      setActivityDraft({ activityType: "called", summary: "", nextFollowUpDate: "" });
      addToDailyBrief(`Note: ${leadLabel(selectedImportedLead)} — ${summary}`, {
        leads_updated: (briefDraft.leads_updated ?? 0) + 1,
      });
      setMessage("Note saved.");
      return;
    }
    if (activeCommunicationEvent?.matched_deal_id) {
      const { error } = await createDealActivity({
        deal_id: activeCommunicationEvent.matched_deal_id,
        actor: user || "Sophie / VA",
        activity_type: "note",
        summary,
        field_changes: { source: "va_contact_queue", communication_event_id: activeCommunicationEvent.id },
      });
      if (error) { setMessage(error); return; }
      await refreshSelectedEventMessages(activeCommunicationEvent);
      setActivityDraft({ activityType: "called", summary: "", nextFollowUpDate: "" });
      addToDailyBrief(`Note: ${phoneForCommunicationEvent(activeCommunicationEvent) || "contact"} — ${summary}`, {
        leads_updated: (briefDraft.leads_updated ?? 0) + 1,
      });
      setMessage("Note saved to the linked deal.");
      return;
    }
    setMessage("Create or match a packet before saving notes for this contact.");
  };

  const saveContactQueueLog = async () => {
    const label = LEAD_ACTIVITY_TYPES.find(type => type.value === activityDraft.activityType)?.label || "Activity logged";
    const summary = activityDraft.summary.trim() || label;
    if (selectedImportedLead) {
      await logLeadActivity();
      return;
    }
    if (activeCommunicationEvent?.matched_deal_id) {
      const { error } = await createDealActivity({
        deal_id: activeCommunicationEvent.matched_deal_id,
        actor: user || "Sophie / VA",
        activity_type: "note",
        summary: `${label}: ${summary}`,
        field_changes: {
          source: "va_contact_queue",
          communication_event_id: activeCommunicationEvent.id,
          activity_type: activityDraft.activityType,
          next_follow_up_date: activityDraft.nextFollowUpDate || null,
        },
      });
      if (error) { setMessage(error); return; }
      await refreshSelectedEventMessages(activeCommunicationEvent);
      addToDailyBrief(`${label}: ${phoneForCommunicationEvent(activeCommunicationEvent) || "contact"} — ${summary}`, {
        outreach_sent: ["called", "texted", "emailed", "left-voicemail"].includes(activityDraft.activityType) ? (briefDraft.outreach_sent ?? 0) + 1 : briefDraft.outreach_sent,
        seller_replies: activityDraft.activityType === "interested" ? (briefDraft.seller_replies ?? 0) + 1 : briefDraft.seller_replies,
        leads_updated: (briefDraft.leads_updated ?? 0) + 1,
        calls_completed: ["called", "left-voicemail"].includes(activityDraft.activityType) ? (briefDraft.calls_completed ?? 0) + 1 : briefDraft.calls_completed,
      });
      setActivityDraft({ activityType: "called", summary: "", nextFollowUpDate: "" });
      setMessage("Activity logged to the linked deal.");
      return;
    }
    setMessage("Create or match a packet before logging activity for this contact.");
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
      const who = event.contact_name || event.contact_number || event.from_number || event.to_number || "Unknown contact";
      const body = event.body ? `: ${event.body}` : "";
      return `- ${who}${body}`;
    };
    const activityLines = [
      `Sakari SMS: ${outbound.length} sent, ${inbound.length} contact replies received.`,
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
      value: String(dashboardWorkQueueCount),
      detail: "Follow-ups, leads, packets, tasks",
      action: "Work Queue",
      onAction: () => goToTab("outreach"),
      hot: leadFollowUpsDue.length > 0 || followUpsDue.length > 0 || blockedAssignedTasks.length > 0,
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
      eyebrow: "Dashboard",
      title: "Sophie Dashboard",
      subtitle: "Start the shift, then work the next priority from one clear queue.",
    },
    outreach: {
      eyebrow: "Contact Queue",
      title: "Contact Queue",
      subtitle: "Work due follow-ups, calls, texts, and outcomes from the selected contact record.",
    },
    lists: {
      eyebrow: "Lists",
      title: "List Workspace",
      subtitle: "Import audiences, check eligibility, clean records, bulk text compliant rows, and move replies into the contact queue.",
    },
    packet: {
      eyebrow: "Packets",
      title: "Packet Builder",
      subtitle: "Turn qualified relationship interest into a member-ready review packet with diligence, calculator notes, and a clear ask.",
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
      <button onClick={() => openBulkTextWorkflow()} style={headerSecondaryAction}>Bulk Text</button>
      </>
    ),
    lists: (
      <>
      <button onClick={startNewImport} style={headerSecondaryAction}>New Import</button>
      <button onClick={() => openBulkTextWorkflow(true)} style={headerSecondaryAction}>Bulk Text</button>
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
    { label: "Recent Replies", value: String(recentInboundSms.length), detail: "Recent contact replies", action: "Open", onAction: () => goToTab("outreach"), tone: recentInboundSms.length ? "hot" as const : "default" as const },
    { label: "Follow-ups", value: String(followUpsDue.length), detail: "Dated follow-ups due", action: "Review", onAction: () => goToTab("outreach"), tone: followUpsDue.length ? "hot" as const : "default" as const },
    { label: "Interested", value: String(interestedLeads.length), detail: "Contacts showing interest", action: "Open Leads", onAction: () => { setLeadFilter("interested"); goToTab("lists"); }, tone: interestedLeads.length ? "hot" as const : "default" as const },
    { label: "Draft Packets", value: String(draftLeads.length), detail: "Leads ready to package", action: "Build", onAction: () => draftLeads[0] ? openDealBrief(draftLeads[0]) : goToTab("packet"), tone: draftLeads.length ? "hot" as const : "default" as const },
  ] : activeTab === "lists" ? [
    { label: "Imported", value: String(importedLeads.length), detail: "Total list records", action: "Upload", onAction: startNewImport, tone: "default" as const },
    { label: "New", value: String(importStats.newRows), detail: "Fresh from lists", action: "Filter", onAction: () => setLeadFilter("new"), tone: importStats.newRows ? "hot" as const : "default" as const },
    { label: "Eligible", value: String(bulkEligibleLeads.length), detail: "Current view recipients", action: "Bulk Text", onAction: () => openBulkTextWorkflow(true), tone: bulkEligibleLeads.length ? "hot" as const : "default" as const },
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

  const contactQueueSubTabs: Array<{ mode: ContactQueueMode; label: string }> = [
    { mode: "inbox", label: "Inbox" },
    { mode: "callbacks", label: "Callbacks" },
    { mode: "campaigns", label: "Campaigns" },
    { mode: "relationships", label: "Relationships" },
  ];

  const renderContactQueueComposer = () => {
    const activeLead = selectedImportedLead;
    const activeEvent = activeCommunicationEvent;
    const smsCompliance = activeLead ? checkLeadSmsCompliance(activeLead) : null;
    const canText = activeLead ? !!smsCompliance?.allowed : !!phoneForCommunicationEvent(activeEvent);
    const textPlaceholder = activeLead
      ? smsCompliance?.allowed ? "Type a message..." : `SMS blocked: ${smsCompliance?.blockLabel || "Compliance review required"}.`
      : phoneForCommunicationEvent(activeEvent) ? "Type a message..." : "No usable phone number.";
    const modeButton = (mode: ContactComposerMode, label: string) => (
      <button
        type="button"
        onClick={() => setContactComposerMode(mode)}
        style={{
          background: "transparent",
          border: "none",
          borderBottom: contactComposerMode === mode ? "2px solid var(--obsidian)" : "2px solid transparent",
          color: contactComposerMode === mode ? "var(--obsidian)" : "var(--muted)",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: contactComposerMode === mode ? 800 : 600,
          padding: "0 0 5px",
        }}
      >
        {label}
      </button>
    );
    return (
      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          {modeButton("text", "Text")}
          {modeButton("note", "Note")}
          {modeButton("log", "Log")}
        </div>
        {contactComposerMode === "text" && (
          <>
            <textarea
              id="va-contact-queue-sms"
              rows={4}
              value={smsDraft}
              onChange={event => setSmsDraft(event.target.value)}
              placeholder={textPlaceholder}
              disabled={!canText}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 8 }}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{smsDraft.trim().length}/1200</span>
              <button
                onClick={activeLead ? sendSmsToLead : sendSmsToSelectedEvent}
                disabled={smsSending || !canText}
                style={{ ...compactPrimaryButton, opacity: smsSending || !canText ? 0.55 : 1 }}
              >
                {smsSending ? "Sending..." : "Send Text"}
              </button>
            </div>
          </>
        )}
        {contactComposerMode === "note" && (
          <>
            <textarea
              rows={4}
              value={activityDraft.summary}
              onChange={event => setActivityDraft({ ...activityDraft, summary: event.target.value })}
              placeholder="Internal note for this relationship..."
            />
            {!activeLead && activeEvent && !activeEvent.matched_deal_id && (
              <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 7 }}>Notes can be saved after this contact is matched or a packet is created.</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={saveContactQueueNote} style={compactPrimaryButton}>Save Note</button>
            </div>
          </>
        )}
        {contactComposerMode === "log" && (
          <div style={{ display: "grid", gap: 8 }}>
            <select value={activityDraft.activityType} onChange={event => setActivityDraft({ ...activityDraft, activityType: event.target.value as ImportedLandLeadActivity["activity_type"] })}>
              {LEAD_ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <input value={activityDraft.nextFollowUpDate} onChange={event => setActivityDraft({ ...activityDraft, nextFollowUpDate: event.target.value })} type="date" />
            <textarea
              rows={3}
              value={activityDraft.summary}
              onChange={event => setActivityDraft({ ...activityDraft, summary: event.target.value })}
              placeholder="Outcome, call notes, callback details, or next step."
            />
            {!activeLead && activeEvent && !activeEvent.matched_deal_id && (
              <p style={{ color: "var(--muted)", fontSize: 12 }}>Activity logs can be saved after this contact is matched or a packet is created.</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={saveContactQueueLog} style={compactPrimaryButton}>Save Log</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="va-root" style={{ maxWidth: 1680, margin: "0 auto", padding: "78px 20px 100px" }}>
      {activeTab !== "today" && activeTab !== "outreach" && activeTab !== "lists" && (
        <OperatingHeader
          eyebrow={headerCopy[activeTab].eyebrow}
          title={headerCopy[activeTab].title}
          subtitle={headerCopy[activeTab].subtitle}
          user={user}
          mode="va"
          actions={headerActions[activeTab]}
          stats={headerStats}
        />
      )}

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

      {!openShift && activeTab !== "today" && activeTab !== "outreach" && activeTab !== "lists" && (
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
          <section className="va-cockpit">
            <section style={{ ...panel, padding: 0, overflow: "hidden" }}>
              <div style={{
                background: "linear-gradient(135deg, rgba(20,17,13,0.98), rgba(48,38,27,0.94))",
                color: "var(--bone)",
                display: "grid",
                gridTemplateColumns: "minmax(260px, 1fr) minmax(240px, 0.55fr) auto",
                gap: 18,
                alignItems: "center",
                padding: "16px 18px",
              }} className="va-command-strip">
                <div>
                  <p style={{ ...eyebrowSmall, color: "var(--brass)" }}>Today&apos;s desk</p>
                  <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 500, color: "var(--bone)", lineHeight: 1.05, marginTop: 4 }}>
                    {`Good ${greetingForHour(new Date().getHours())}${user ? `, ${user.split(" ")[0]}` : ""}`}
                  </h2>
                  <p style={{ color: "rgba(247,242,232,0.72)", fontSize: 12, marginTop: 5 }}>
                    Work from the queue below. Calls and texts live in global comms.
                  </p>
                </div>
                <div style={{ ...subPanel, background: "rgba(247,242,232,0.08)", borderColor: "rgba(237,230,214,0.18)", padding: 12 }}>
                  <p style={{ ...eyebrowSmall, color: "var(--brass)" }}>Shift status</p>
                  <strong style={{ display: "block", color: "var(--bone)", fontSize: 22, lineHeight: 1.1, marginTop: 4 }}>
                    {openShift ? formatDuration(liveShiftMinutes) : "Ready"}
                  </strong>
                  <span style={{ display: "block", color: "rgba(247,242,232,0.68)", fontSize: 12, marginTop: 4 }}>
                    {openShift ? "Time is being tracked" : "Clock in before logging work"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button onClick={openShift ? handleClockOut : handleClockIn} disabled={clockBusy} style={{ ...primaryButton, background: "var(--brass)", borderColor: "var(--brass)", color: "var(--obsidian)", opacity: clockBusy ? 0.65 : 1 }}>
                    {clockBusy ? "Saving..." : openShift ? "Clock Out" : "Clock In"}
                  </button>
                </div>
              </div>
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(330px, 0.85fr)", gap: 14 }} className="va-cockpit-grid">
              <section id="va-work-queue" style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <p style={eyebrowSmall}>Next best work</p>
                    <h2 style={{ ...sectionTitle, fontSize: 26 }}>Work this queue first</h2>
                    <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.45, marginTop: 4 }}>
                      Follow-ups, interested contacts, packet-ready deals, and assigned tasks are prioritized here.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ alignSelf: "center", color: "var(--muted)", fontSize: 12 }}>
                      {lastRefreshedAt ? `Last refreshed ${formatDate(lastRefreshedAt)}` : loading ? "Refreshing..." : "Not refreshed yet"}
                    </span>
                    <button onClick={() => void reload(user)} style={secondaryButton}>Refresh</button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {leadFollowUpsDue.slice(0, 2).map(lead => (
                    <button key={`lead-follow-up-${lead.id}`} onClick={() => selectImportedLead(lead, "outreach")} style={{ ...workItemCard, borderColor: "var(--brass)" }}>
                      <div style={workItemIcon}>DUE</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={workItemHeader}>
                          <strong>{lead.owner_name || lead.property_address || "Due follow-up"}</strong>
                          <span style={hotPill}>Due Follow-Up</span>
                        </div>
                        <p style={workItemBody}>{lead.property_address || lead.parcel_id || "Contact follow-up is due."}</p>
                        <small style={workItemMeta}>{formatQueueDueReason(lead.next_follow_up_date)} · Open contact card</small>
                      </div>
                    </button>
                  ))}

                  {followUpsDue.slice(0, Math.max(0, 3 - leadFollowUpsDue.slice(0, 2).length)).map(deal => (
                    <button key={`deal-follow-up-${deal.id}`} onClick={() => openDealBrief(deal)} style={{ ...workItemCard, borderColor: "var(--brass)" }}>
                      <div style={workItemIcon}>DUE</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={workItemHeader}>
                          <strong>{deal.title || deal.address || "Deal follow-up"}</strong>
                          <span style={hotPill}>Due Follow-Up</span>
                        </div>
                        <p style={workItemBody}>{deal.seller_name || deal.seller_phone || "Deal follow-up is due."}</p>
                        <small style={workItemMeta}>{formatQueueDueReason(deal.next_follow_up_date)} · Open packet</small>
                      </div>
                    </button>
                  ))}

                  {interestedLeads.slice(0, Math.max(0, 5 - leadFollowUpsDue.length - followUpsDue.length)).map(lead => (
                    <button key={`interested-${lead.id}`} onClick={() => loadImportedLead(lead, true)} style={workItemCard}>
                      <div style={workItemIcon}>INT</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={workItemHeader}>
                          <strong>{lead.owner_name || lead.property_address || "Interested contact"}</strong>
                          <span style={hotPill}>Interested Contact</span>
                        </div>
                        <p style={workItemBody}>{lead.property_address || lead.parcel_id || "Property record needs review."}</p>
                        <small style={workItemMeta}>Why: contact is marked interested · {lead.phone || lead.phone_2 || "No phone"} · Build packet</small>
                      </div>
                    </button>
                  ))}

                  {draftLeads.slice(0, Math.max(0, 6 - leadFollowUpsDue.length - followUpsDue.length - interestedLeads.length)).map(deal => (
                    <button key={`packet-ready-${deal.id}`} onClick={() => openDealBrief(deal)} style={workItemCard}>
                      <div style={workItemIcon}>PKT</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={workItemHeader}>
                          <strong>{deal.title || deal.address || "Draft packet"}</strong>
                          <span style={pill}>Packet Ready</span>
                        </div>
                        <p style={workItemBody}>{deal.address || deal.parcel_id || "Draft deal brief needs readiness checks."}</p>
                        <small style={workItemMeta}>Why: draft packet needs readiness review · {deal.seller_name || deal.seller_phone || "Contact pending"}</small>
                      </div>
                    </button>
                  ))}

                  {blockedAssignedTasks.slice(0, Math.max(0, 7 - leadFollowUpsDue.length - followUpsDue.length - interestedLeads.length - draftLeads.length)).map(task => (
                    <button key={`task-${task.id}`} onClick={() => router.push(taskRecordHref(task))} style={workItemCard}>
                      <div style={workItemIcon}>BLK</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={workItemHeader}>
                          <strong>{task.title}</strong>
                          <span style={hotPill}>Blocked Task</span>
                        </div>
                        <p style={workItemBody}>{task.description || "Member-assigned task needs a status update."}</p>
                        <small style={workItemMeta}>Why: task is blocked · {task.created_by ? `Assigned by ${task.created_by}` : "Assigned"}{task.due_date ? ` · Due ${task.due_date}` : ""} · {taskRecordLabel(task)}</small>
                      </div>
                    </button>
                  ))}

                  {memberAssignedTasks.slice(0, Math.max(0, 8 - leadFollowUpsDue.length - followUpsDue.length - interestedLeads.length - draftLeads.length - blockedAssignedTasks.length)).map(task => (
                    <button key={`member-task-${task.id}`} onClick={() => router.push(taskRecordHref(task))} style={workItemCard}>
                      <div style={workItemIcon}>TSK</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={workItemHeader}>
                          <strong>{task.title}</strong>
                          <span style={task.priority === "urgent" || task.priority === "high" ? hotPill : pill}>Member Task</span>
                        </div>
                        <p style={workItemBody}>{task.description || "Member-assigned task needs a status update."}</p>
                        <small style={workItemMeta}>Why: member assigned this task{task.priority ? ` · ${statusLabel(task.priority)} priority` : ""} · {task.created_by ? `Assigned by ${task.created_by}` : "Assigned"}{task.due_date ? ` · Due ${task.due_date}` : ""}</small>
                      </div>
                    </button>
                  ))}

                  {dashboardWorkQueueCount === 0 && (
                    <div style={{ ...subPanel, background: "var(--bone)" }}>
                      <p style={eyebrowSmall}>Clear</p>
                      <h3 style={{ ...sectionTitle, fontSize: 22, marginTop: 4 }}>No urgent queue waiting</h3>
                      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>Open Lists for imported records or check Records when you need broader property history.</p>
                    </div>
                  )}
                </div>
              </section>

              <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
                <section style={panel}>
                  <p style={eyebrowSmall}>Global comms</p>
                  <h3 style={{ ...sectionTitle, fontSize: 22, marginTop: 4 }}>
                    {commsStatus.phoneState === "in-call"
                      ? `On call ${formatCallSeconds(commsStatus.callDuration)}`
                      : commsStatus.phoneState === "ringing"
                        ? "Incoming call"
                        : commsStatus.phoneState === "online"
                          ? "Phone online"
                          : commsStatus.phoneState === "connecting"
                            ? "Phone connecting"
                            : commsStatus.phoneState === "error"
                              ? "Phone needs attention"
                              : "Phone offline"}
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.45, marginTop: 6 }}>
                    {commsStatus.unread > 0 ? `${commsStatus.unread} unread message${commsStatus.unread === 1 ? "" : "s"}` : "No unread messages"} · {commsStatus.phoneMessage}
                  </p>
                </section>

                <section style={panel}>
                  <p style={eyebrowSmall}>Today&apos;s progress</p>
                  <h3 style={{ ...sectionTitle, fontSize: 22, marginTop: 4 }}>Shift activity</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }} className="compact-shift-grid">
                    <MiniStat label="Calls" value={String(briefDraft.calls_completed ?? 0)} />
                    <MiniStat label="Texts" value={String(briefDraft.outreach_sent ?? 0)} />
                    <MiniStat label="Tasks Done" value={String(briefDraft.va_tasks_completed ?? completedAssignedTasksToday.length)} />
                    <MiniStat label="Packets" value={String(briefDraft.deals_submitted ?? portalStats.submittedToday)} />
                  </div>
                </section>

                <section style={{ ...panel, background: "linear-gradient(135deg, rgba(176,137,84,0.16), rgba(255,255,255,0.82))" }}>
                  <p style={eyebrowSmall}>Daily brief</p>
                  <h3 style={{ ...sectionTitle, fontSize: 24, marginTop: 5 }}>{portalStats.briefSubmitted ? "Submitted" : "Open"}</h3>
                  <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
                    End-of-shift summary for members. Activity totals are pulled from today&apos;s work.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    <button onClick={autofillBriefStats} style={secondaryButton}>Auto-fill</button>
                    <button onClick={() => goToTab("brief")} style={primaryButton}>Edit Brief</button>
                  </div>
                </section>
              </aside>
            </div>
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
                    <textarea rows={2} value={draft.submit_uncertainties ?? ""} onChange={e => setDraft({ ...draft, submit_uncertainties: e.target.value })} placeholder="Open questions, weak comps, contact uncertainty, county records still pending." />
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
                    <label style={label}>Primary contact</label>
                    <input type="text" value={draft.seller_name ?? ""} onChange={e => setDraft({ ...draft, seller_name: e.target.value })} />
                  </div>
                  <div>
                    <label style={label}>Contact phone</label>
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
                  <label style={label}>Contact / research notes</label>
                  <textarea rows={5} value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Contact motivation, timeline, condition, due diligence notes, county calls, concerns, next follow-up" />
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
          <section style={contactQueuePage}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <h2 style={sectionTitle}>Lists</h2>
                <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
                  Browse imported batches, property records, contacts, segments, and campaign audiences.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setMessage("List settings are coming next: default filters, columns, assignment rules, and segment permissions.")} style={secondaryButton}>Lists Settings</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {LISTS_VIEWS.map(view => {
                const active = listsView === view.value;
                const count = view.value === "batches" ? listKpis.batches
                  : view.value === "properties" ? listKpis.properties
                    : view.value === "contacts" ? listKpis.contacts
                      : view.value === "segments" ? savedLeadSegments.length
                        : bulkTextCategorization.eligible.length;
                return (
                  <button
                    key={view.value}
                    type="button"
                    onClick={() => setListsView(view.value)}
                    style={{
                      ...compactButton,
                      background: active ? "var(--obsidian)" : "var(--surface)",
                      borderColor: active ? "var(--obsidian)" : "var(--fog)",
                      color: active ? "var(--bone)" : "var(--obsidian)",
                      fontSize: 10,
                      minHeight: 34,
                      padding: "8px 11px",
                    }}
                  >
                    {view.label}
                    <span style={{
                      background: active ? "rgba(237,230,214,0.18)" : "rgba(176,137,84,0.14)",
                      borderRadius: 999,
                      color: active ? "var(--bone)" : "var(--muted)",
                      display: "inline-block",
                      marginLeft: 8,
                      minWidth: 22,
                      padding: "2px 6px",
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, marginBottom: 12 }} className="number-grid">
              <MiniStat label="List Batches" value={String(listKpis.batches)} />
              <MiniStat label="Property Records" value={String(listKpis.properties)} />
              <MiniStat label="Contacts" value={String(listKpis.contacts)} />
              <MiniStat label="Textable" value={String(listKpis.textable)} />
              <MiniStat label="Deal Packets" value={String(listKpis.packets)} />
            </div>

            {((importStep === "upload" && !importPreview) || (!importPreview && importedLeads.length === 0)) && (
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

            {listsView === "properties" && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.72fr) minmax(520px, 1.72fr) minmax(300px, 0.78fr)", gap: 12, marginBottom: 12 }} className="va-form-grid">
              <aside style={subPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>List Batches</p>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>Showing {Math.min(listBatchRows.length, 8)} of {listBatchRows.length}</span>
                  </div>
                  <button onClick={startNewImport} style={{ ...compactButton, minHeight: 32, padding: "7px 10px" }}>Upload List</button>
                </div>
                <div style={{ display: "grid", gap: 7, maxHeight: 520, overflow: "auto", paddingRight: 2 }}>
                  {listBatchRows.slice(0, 8).map(({ batch, leads, textable }) => (
                    <button
                      key={batch.id}
                      onClick={() => { setSelectedBatchId(batch.id); setListsView("properties"); setImportStep("work"); }}
                      style={{
                        border: selectedBatchId === batch.id ? "1px solid var(--brass)" : "1px solid var(--fog)",
                        background: selectedBatchId === batch.id ? "rgba(176,137,84,0.12)" : "var(--surface)",
                        borderRadius: 8,
                        cursor: "pointer",
                        padding: 10,
                        textAlign: "left",
                      }}
                    >
                      <strong style={{ color: "var(--obsidian)", display: "block", fontSize: 13 }}>{batch.campaign_source || batch.original_filename || "Imported list"}</strong>
                      <p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.35, marginTop: 3 }}>{batch.original_filename || batch.source_system}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 6 }}>
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>{leads.length || batch.row_count} rows · {textable} textable</span>
                        <span style={batch.status === "completed" ? hotPill : pill}>{statusLabel(batch.status || "not-started")}</span>
                      </div>
                    </button>
                  ))}
                  {listBatchRows.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No list batches yet.</p>}
                </div>
              </aside>

              <section style={subPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ color: "var(--obsidian)", fontSize: 16, fontWeight: 800 }}>Property Records</h3>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{filteredImportedLeads.length} visible · {importedLeads.length} total</span>
                  </div>
                  {selectedBatch && <span style={hotPill}>{batchLeads.length} in selected batch</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr)) minmax(180px, 1.2fr)", gap: 8, marginBottom: 10 }} className="va-form-grid">
                  <select value={leadFilter} onChange={e => setLeadFilter(e.target.value as ImportStatusFilter)}>
                    {IMPORT_STATUS_FILTERS.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                  </select>
                  <input value={minAcreage} onChange={e => setMinAcreage(e.target.value)} placeholder="Min acres" />
                  <input value={maxAcreage} onChange={e => setMaxAcreage(e.target.value)} placeholder="Max acres" />
                  <select value={selectedBatchId || "all"} onChange={e => setSelectedBatchId(e.target.value === "all" ? null : e.target.value)}>
                    <option value="all">All batches</option>
                    {leadBatches.map(batch => <option key={batch.id} value={batch.id}>{batch.campaign_source || batch.original_filename || batch.source_system}</option>)}
                  </select>
                  <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Search APN or address..." />
                </div>
                <div style={{ overflow: "auto", border: "1px solid var(--fog)", borderRadius: 8, background: "var(--surface)", maxHeight: 548 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 860 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--fog)", color: "var(--muted)", textAlign: "left" }}>
                        <th style={th}></th>
                        <th style={th}>APN</th>
                        <th style={th}>Property Address</th>
                        <th style={th}>County</th>
                        <th style={th}>Acres</th>
                        <th style={th}>Score</th>
                        <th style={th}>Owner / Contact</th>
                        <th style={th}>Status</th>
                        <th style={th}>Linked Deal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredImportedLeads.map(lead => {
                        const active = selectedImportedLeadId === lead.id;
                        return (
                          <tr
                            key={lead.id}
                            onClick={() => selectImportedLead(lead, "lists")}
                            style={{
                              background: active ? "rgba(176,137,84,0.16)" : "transparent",
                              borderBottom: "1px solid var(--fog)",
                              cursor: "pointer",
                            }}
                          >
                            <td style={td}><input type="checkbox" checked={active} readOnly /></td>
                            <td style={td}>{lead.parcel_id || "N/A"}</td>
                            <td style={td}><strong style={{ color: "var(--obsidian)" }}>{lead.property_address || "No address"}</strong><br /><span style={{ color: "var(--muted)" }}>{lead.city || ""}{lead.state ? `, ${lead.state}` : ""}</span></td>
                            <td style={td}>{lead.county || "N/A"}</td>
                            <td style={td}>{lead.acreage ?? "N/A"}</td>
                            <td style={{ ...td, color: (lead.lead_score ?? 0) >= 80 ? "var(--pine)" : "var(--muted)", fontWeight: 800 }}>{lead.lead_score ?? 0}</td>
                            <td style={td}>{lead.owner_name || "Owner unknown"}<br /><span style={{ color: "var(--muted)" }}>{lead.phone || lead.phone_2 || "No phone"}</span></td>
                            <td style={td}><span style={lead.status === "interested" ? hotPill : pill}>{statusLabel(lead.status)}</span></td>
                            <td style={td}>{lead.deal_id ? <button onClick={event => { event.stopPropagation(); openLinkedDeal(lead.deal_id); }} style={pill}>Open</button> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredImportedLeads.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, padding: 12 }}>No imported records match this search.</p>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>Showing 1-{filteredImportedLeads.length} of {importedLeads.length}</span>
                  <button onClick={() => setMessage("CSV export is next for this inventory table.")} style={compactButton}>Export CSV</button>
                </div>
              </section>

              <aside style={subPanel}>
                {!selectedImportedLead ? (
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>Select a property to see record details, contact eligibility, linked packet, and quick actions.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                      <div>
                        <h3 style={{ color: "var(--obsidian)", fontSize: 16, fontWeight: 800 }}>Selected Property</h3>
                        <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 18, marginTop: 10 }}>{selectedImportedLead.parcel_id || "No APN"}</strong>
                        <p style={{ color: "var(--ink)", fontSize: 13, lineHeight: 1.4, marginTop: 5 }}>{selectedImportedLead.property_address || "No address"}<br />{selectedImportedLead.city || ""}{selectedImportedLead.state ? `, ${selectedImportedLead.state}` : ""}</p>
                      </div>
                      <span style={selectedImportedLead.status === "interested" ? hotPill : pill}>{statusLabel(selectedImportedLead.status)}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      <MiniStat label="County" value={selectedImportedLead.county || "N/A"} />
                      <MiniStat label="Acres" value={String(selectedImportedLead.acreage ?? "N/A")} />
                      <MiniStat label="Score" value={String(selectedImportedLead.lead_score ?? 0)} />
                    </div>
                    <InfoStack title="Primary Owner / Contact">
                      <p>{selectedImportedLead.owner_name || "Owner unknown"}</p>
                      <p>{selectedImportedLead.phone || selectedImportedLead.phone_2 || "Phone missing"}</p>
                      <p>{selectedImportedLead.email || "Email missing"}</p>
                      <p>{selectedContactProperties.length} linked propert{selectedContactProperties.length === 1 ? "y" : "ies"}</p>
                    </InfoStack>
                    <InfoStack title="Phone Eligibility">
                      <p>{checkLeadSmsCompliance(selectedImportedLead).allowed ? "Textable" : checkLeadSmsCompliance(selectedImportedLead).blockLabel}</p>
                      <p>{checkLeadCallCompliance(selectedImportedLead).allowed ? "Callable" : checkLeadCallCompliance(selectedImportedLead).blockLabel}</p>
                    </InfoStack>
                    <InfoStack title="Linked Deal Packet">
                      <p>{selectedImportedLead.deal_id || "No linked packet yet"}</p>
                    </InfoStack>
                    <InfoStack title="List Batch">
                      <p>{selectedPropertyBatch?.campaign_source || selectedPropertyBatch?.original_filename || selectedImportedLead.campaign_source || "Batch unknown"}</p>
                      <p>{selectedImportedLead.source_system || "Imported source"}</p>
                    </InfoStack>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button onClick={() => router.push(`/lead/${selectedImportedLead.id}`)} style={compactButton}>Open Property Record</button>
                      <button onClick={() => setListsView("contacts")} style={compactButton}>View Contact</button>
                      <button onClick={() => loadImportedLead(selectedImportedLead, true)} style={compactButton}>{selectedImportedLead.deal_id ? "Open Packet" : "Create Packet"}</button>
                      <button onClick={() => openBulkTextWorkflow(true)} style={compactButton}>Add to Segment</button>
                    </div>
                  </div>
                )}
              </aside>
            </div>
            )}

            {listsView === "batches" && (
              <div style={{ ...subPanel, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>List Batches</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22 }}>{leadBatches.length} uploaded source list{leadBatches.length === 1 ? "" : "s"}</h3>
                  </div>
                  <button onClick={startNewImport} style={primaryButton}>Upload List</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }} className="three-col">
                  {listBatchRows.map(({ batch, leads, textable, duplicates }) => (
                    <div key={batch.id} style={{ ...subPanel, background: selectedBatchId === batch.id ? "rgba(176,137,84,0.12)" : "var(--surface)", borderColor: selectedBatchId === batch.id ? "var(--brass)" : "var(--fog)" }}>
                      <button onClick={() => { setSelectedBatchId(batch.id); setListsView("properties"); setImportStep("work"); }} style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", width: "100%" }}>
                        <p style={eyebrowSmall}>{batch.source_system}</p>
                        <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 15 }}>{batch.campaign_source || batch.original_filename || "Imported list"}</strong>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{formatDate(batch.created_at)} · {statusLabel(batch.status || "not-started")}</p>
                      </button>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 10 }}>
                        <MiniStat label="Rows" value={String(leads.length || batch.row_count)} />
                        <MiniStat label="Textable" value={String(textable)} />
                        <MiniStat label="Dupes" value={String(duplicates)} />
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        <button onClick={() => { setSelectedBatchId(batch.id); setListsView("properties"); }} style={compactButton}>View Properties</button>
                        <button onClick={() => router.push(`/lists/${batch.id}`)} style={compactButton}>Open Batch</button>
                      </div>
                    </div>
                  ))}
                  {leadBatches.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No list batches yet. Upload a CSV to start.</p>}
                </div>
              </div>
            )}

            {listsView === "contacts" && (
              <div style={{ ...subPanel, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Contacts / Relationships</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22 }}>{contactRelationshipRows.length} owner relationship{contactRelationshipRows.length === 1 ? "" : "s"}</h3>
                  </div>
                  <span style={pill}>{listKpis.textable} textable contacts/properties</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.72fr)", gap: 12 }} className="va-form-grid">
                  <div style={{ display: "grid", gap: 8, maxHeight: 720, overflow: "auto", paddingRight: 2 }}>
                    {contactRelationshipRows.slice(0, 80).map(row => (
                      <button key={row.key} onClick={() => selectImportedLead(row.primary, "lists")} style={{ ...contactQueueCard, width: "100%", textAlign: "left", background: selectedContactProperties.some(lead => lead.id === row.primary.id) ? "rgba(176,137,84,0.12)" : "var(--surface)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                          <div>
                            <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{row.primary.owner_name || row.primary.phone || row.primary.phone_2 || "Unknown contact"}</strong>
                            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>{row.primary.phone || row.primary.phone_2 || "No phone"} · {row.propertyCount} propert{row.propertyCount === 1 ? "y" : "ies"}</p>
                          </div>
                          <span style={row.textable ? hotPill : pill}>{row.textable ? "Textable" : "Needs cleanup"}</span>
                        </div>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>{row.primary.property_address || row.primary.parcel_id || "No selected property"}</p>
                      </button>
                    ))}
                  </div>
                  <aside style={subPanel}>
                    {!selectedImportedLead ? (
                      <p style={{ color: "var(--muted)", fontSize: 13 }}>Select a contact to see linked properties and actions.</p>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        <p style={eyebrowSmall}>Selected Relationship</p>
                        <h3 style={{ ...sectionTitle, fontSize: 22 }}>{selectedImportedLead.owner_name || "Unknown contact"}</h3>
                        <InfoStack title="Contact">
                          <p>{[selectedImportedLead.phone, selectedImportedLead.phone_2].filter(Boolean).join(" / ") || "Phone missing"}</p>
                          <p>{selectedImportedLead.email || "Email missing"}</p>
                          <p>{checkLeadSmsCompliance(selectedImportedLead).allowed ? "SMS eligible" : checkLeadSmsCompliance(selectedImportedLead).blockLabel}</p>
                        </InfoStack>
                        <InfoStack title="Linked Properties">
                          {selectedContactProperties.map(lead => (
                            <button key={lead.id} onClick={() => selectImportedLead(lead, "lists")} style={{ background: "transparent", border: "none", padding: 0, color: "var(--ink)", cursor: "pointer", textAlign: "left" }}>
                              {lead.property_address || lead.parcel_id || "Property record"} · {lead.county || "County pending"}
                            </button>
                          ))}
                        </InfoStack>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <button onClick={() => setListsView("properties")} style={compactButton}>View Property</button>
                          <button onClick={() => selectImportedLead(selectedImportedLead, "outreach")} style={compactButton}>Work In Queue</button>
                        </div>
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            )}

            {listsView === "segments" && (
              <div style={{ ...subPanel, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Segments</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22 }}>Saved filtered audiences</h3>
                  </div>
                  <button onClick={() => openBulkTextWorkflow(true)} style={primaryButton}>Build Segment</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }} className="three-col">
                  {savedLeadSegments.map(segment => {
                    const audience = importedLeads.filter(lead => leadMatchesBulkTextCriteria(lead, segment));
                    const categorized = categorizeForBulkSms(audience);
                    return (
                      <div key={segment.id} style={subPanel}>
                        <strong style={{ color: "var(--obsidian)", fontSize: 15 }}>{segment.name}</strong>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 5, lineHeight: 1.45 }}>
                          {[...segment.counties, ...segment.cities, ...segment.states, ...segment.zips].filter(Boolean).slice(0, 4).join(", ") || "All locations"} · {IMPORT_STATUS_FILTERS.find(filter => filter.value === segment.status)?.label || "All statuses"}
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                          <MiniStat label="Matched" value={String(audience.length)} />
                          <MiniStat label="Eligible" value={String(categorized.eligible.length)} />
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                          <button onClick={() => { applyLeadSegment(segment); setListsView("properties"); }} style={compactButton}>Apply</button>
                          <button onClick={() => { applyLeadSegment(segment); openBulkTextWorkflow(true); }} style={compactButton}>Bulk Text</button>
                        </div>
                      </div>
                    );
                  })}
                  {savedLeadSegments.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No saved segments yet. Build one from Bulk Text filters.</p>}
                </div>
              </div>
            )}

            {listsView === "campaigns" && (
              <div style={{ ...subPanel, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <p style={eyebrowSmall}>Campaign Audiences</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22 }}>{bulkTextCategorization.eligible.length} eligible · {bulkTextCategorization.excluded.length} excluded</h3>
                    <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>Campaigns are launched from the active segment/filter and replies flow into Contact Queue.</p>
                  </div>
                  <button onClick={() => openBulkTextWorkflow(true)} style={primaryButton}>Open Bulk Text</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }} className="number-grid">
                  <MiniStat label="Considered" value={String(bulkTextCategorization.totalConsidered)} />
                  <MiniStat label="Eligible" value={String(bulkTextCategorization.eligible.length)} />
                  <MiniStat label="Excluded" value={String(bulkTextCategorization.excluded.length)} />
                  <MiniStat label="Segments" value={String(savedLeadSegments.length)} />
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
                  <MiniStat label="Columns mapped" value={`${importPreview.sourceColumnsMapped}/${importPreview.sourceColumnCount}`} />
                  <MiniStat label="Calc fields" value={String(importPreview.calculatorReadyColumnCount)} />
                  <MiniStat label="Properties" value={String(importPreview.propertyRows)} />
                  <MiniStat label="Unique leads" value={String(importPreview.uniqueLeadCount)} />
                  <MiniStat label="Textable leads" value={String(importPreview.textableLeadCount)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 8 }} className="number-grid">
                  <MiniStat label="Multi-property" value={String(importPreview.multiPropertyLeadCount)} />
                  <MiniStat label="New properties" value={String(importPreview.safeToImport)} />
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

          </section>
          )}

          {activeTab === "outreach" && (
          <section style={contactQueuePage}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <h2 style={{ ...sectionTitle, fontSize: 31 }}>Contact Queue</h2>
                <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
                  Work inbound replies, callbacks, campaigns, and unmatched relationships from one place.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => void reload(user)} style={compactButton}>Refresh</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }} aria-label="Contact queue filters">
              {contactQueueSubTabs.map(tab => {
                const active = contactQueueMode === tab.mode;
                return (
                  <button
                    key={tab.mode}
                    type="button"
                    onClick={() => {
                      setContactQueueMode(tab.mode);
                      setSelectedImportedLeadId(null);
                      setSelectedCommunicationEventId(null);
                    }}
                    style={{
                      ...compactButton,
                      background: active ? "var(--obsidian)" : "var(--surface)",
                      borderColor: active ? "var(--obsidian)" : "var(--fog)",
                      color: active ? "var(--bone)" : "var(--obsidian)",
                      minHeight: 38,
                    }}
                  >
                    {tab.label}
                    <span style={{
                      background: active ? "rgba(237,230,214,0.18)" : "rgba(176,137,84,0.14)",
                      borderRadius: 999,
                      color: active ? "var(--bone)" : "var(--muted)",
                      display: "inline-block",
                      marginLeft: 8,
                      minWidth: 22,
                      padding: "2px 6px",
                    }}>
                      {contactQueueModeCounts[tab.mode] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 0.76fr) minmax(500px, 1.36fr) minmax(300px, 0.88fr)", gap: 12 }} className="lead-inbox-grid">
              <section style={contactQueueColumnPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10, position: "relative" }}>
                  <div>
                    <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Sort: Newest</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContactFiltersOpen(open => !open)}
                    style={{
                      ...compactButton,
                      background: contactFiltersOpen || activeFilterCount ? "var(--obsidian)" : compactButton.background,
                      borderColor: contactFiltersOpen || activeFilterCount ? "var(--obsidian)" : compactButton.borderColor,
                      color: contactFiltersOpen || activeFilterCount ? "var(--bone)" : compactButton.color,
                    }}
                  >
                    Filters{activeFilterCount ? ` ${activeFilterCount}` : ""}
                  </button>
                  {contactFiltersOpen && (
                    <div style={{
                      position: "absolute",
                      right: 0,
                      top: 42,
                      zIndex: 20,
                      width: 286,
                      border: "1px solid var(--fog)",
                      borderRadius: 8,
                      background: "var(--surface)",
                      boxShadow: "0 18px 40px rgba(31,26,22,0.18)",
                      padding: 12,
                      display: "grid",
                      gap: 10,
                    }}>
                      <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Thread Status
                        <select value={contactThreadFilter} onChange={e => setContactThreadFilter(e.target.value as ContactThreadFilter)} style={{ fontSize: 13 }}>
                          <option value="all">All threads</option>
                          <option value="unread">Unread</option>
                          <option value="read">Read</option>
                          <option value="needs-matching">Needs matching</option>
                          <option value="linked">Linked</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Lead Status
                        <select value={leadFilter} onChange={e => setLeadFilter(e.target.value as ImportStatusFilter)} style={{ fontSize: 13 }}>
                          {IMPORT_STATUS_FILTERS.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                        </select>
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          Min Acres
                          <input value={minAcreage} onChange={e => setMinAcreage(e.target.value)} style={{ fontSize: 13 }} />
                        </label>
                        <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          Max Acres
                          <input value={maxAcreage} onChange={e => setMaxAcreage(e.target.value)} style={{ fontSize: 13 }} />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setLeadSearch("");
                            setLeadFilter("all");
                            setMinAcreage("");
                            setMaxAcreage("");
                            setContactThreadFilter("all");
                          }}
                          style={compactButton}
                        >
                          Clear
                        </button>
                        <button type="button" onClick={() => setContactFiltersOpen(false)} style={compactPrimaryButton}>Apply</button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 7, maxHeight: 720, overflow: "auto", paddingRight: 2 }}>
                  {contactQueueMode === "inbox" && inboxThreadRows.map(thread => (
                    <button
                      key={thread.key}
                      onClick={() => openIncomingThread(thread)}
                      style={{
                        ...contactQueueCard,
                        padding: "9px 10px",
                        textAlign: "left",
                        cursor: "pointer",
                        background: activeCommunicationThreadKey === thread.key ? "rgba(176,137,84,0.18)" : thread.statusLabel !== "Needs matching" ? "var(--surface)" : "rgba(176,137,84,0.10)",
                        borderColor: activeCommunicationThreadKey === thread.key || thread.statusLabel === "Needs matching" ? "var(--brass)" : "var(--fog)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                        <div>
                          <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{thread.title}</strong>
                          <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 2, lineHeight: 1.25 }}>
                            {thread.phone || "No phone"} · {formatDate(thread.latestAt)}
                            {thread.events.length > 1 ? ` · ${thread.events.length} messages` : ""}
                          </p>
                        </div>
                        <span style={thread.statusLabel === "Needs matching" ? hotPill : pill}>
                          {thread.statusLabel}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <span style={thread.unreadCount ? hotPill : pill}>
                          {thread.unreadCount ? `${thread.unreadCount} unread` : "Read"}
                        </span>
                      </div>
                      <p style={{ color: "var(--ink)", fontSize: 12, lineHeight: 1.35, marginTop: 6 }}>
                        {thread.preview}
                      </p>
                    </button>
                  ))}
                  {contactQueueMode === "unmatched" && unmatchedThreadRows.map(thread => (
                    <button key={thread.key} onClick={() => openIncomingThread(thread)} style={{ ...contactQueueCard, background: activeCommunicationThreadKey === thread.key ? "rgba(176,137,84,0.18)" : "rgba(176,137,84,0.10)", borderColor: "var(--brass)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                        <div>
                          <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{thread.title}</strong>
                          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                            {thread.phone || "No phone"} · {formatDate(thread.latestAt)}
                            {thread.events.length > 1 ? ` · ${thread.events.length} messages` : ""}
                          </p>
                        </div>
                        <span style={hotPill}>Needs matching</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <span style={thread.unreadCount ? hotPill : pill}>
                          {thread.unreadCount ? `${thread.unreadCount} unread` : "Read"}
                        </span>
                      </div>
                      <p style={{ color: "var(--ink)", fontSize: 12, lineHeight: 1.45, marginTop: 8 }}>{thread.preview}</p>
                    </button>
                  ))}
                  {((contactQueueMode === "inbox" && inboxThreadRows.length === 0) || (contactQueueMode !== "inbox" && contactQueueMode !== "unmatched")) && contactQueueRows.map(lead => {
                    const active = selectedImportedLeadId === lead.id;
                    const action = sellerActionState(lead);
                    const reason = contactQueueMode === "callbacks"
                      ? `Callback due ${lead.next_follow_up_date || "today"}`
                      : contactQueueMode === "campaigns"
                        ? "Eligible for compliant outreach"
                        : contactQueueMode === "recommended" || contactQueueMode === "inbox"
                          ? action.primary
                        : lead.status === "interested"
                          ? "Interested contact"
                          : action.primary;
                    return (
                      <button
                        key={lead.id}
                        onClick={() => selectImportedLead(lead, "outreach")}
                        style={{
                          ...contactQueueCard,
                          textAlign: "left",
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
                          {lead.property_address || lead.parcel_id || "No property detail"}
                        </p>
                        <span style={{ ...pill, marginTop: 8 }}>{reason}</span>
                      </button>
                    );
                  })}
                  {contactQueueMode === "inbox" && inboxThreadRows.length === 0 && contactQueueRows.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No replies, missed calls, voicemails, or contacts are waiting.</p>}
                  {contactQueueMode === "unmatched" && unmatchedThreadRows.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No unmatched contacts are waiting.</p>}
                  {contactQueueMode !== "inbox" && contactQueueMode !== "unmatched" && contactQueueRows.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No contacts in this queue yet.</p>}
                </div>
              </section>

              <section style={contactQueueWorkspacePanel}>
                {selectedImportedLead ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 10 }}>
                      <div>
                        <h3 style={{ ...sectionTitle, fontSize: 23 }}>{selectedImportedLead.owner_name || "Owner unknown"}</h3>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                          {[selectedImportedLead.phone, selectedImportedLead.phone_2].filter(Boolean).join(" / ") || "No phone"} · {selectedImportedLead.county || "County pending"}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
                        <TwilioCallButton
                          toNumber={checkLeadCallCompliance(selectedImportedLead).phone?.number || selectedImportedLead.phone || selectedImportedLead.phone_2}
                          leadId={selectedImportedLead.id}
                          disabled={!checkLeadCallCompliance(selectedImportedLead).allowed}
                          disabledReason={!checkLeadCallCompliance(selectedImportedLead).allowed ? `Call blocked: ${checkLeadCallCompliance(selectedImportedLead).blockLabel}.` : null}
                          compact
                        />
                        <button type="button" onClick={() => setContactActionMenuOpen(open => !open)} style={actionIconButton} title="More actions">...</button>
                        {contactActionMenuOpen && (
                          <div className="contact-action-menu" style={contactActionMenu}>
                            <button onClick={() => router.push(`/lead/${selectedImportedLead.id}`)}>Open record</button>
                            <button onClick={() => void reload(user)}>Refresh</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)", marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div>
                        <p style={eyebrowSmall}>{selectedImportedLead.deal_id ? "Linked record" : "Property record"}</p>
                        <strong style={{ color: "var(--obsidian)", fontSize: 15 }}>{selectedImportedLead.property_address || selectedImportedLead.parcel_id || "No property detail"}</strong>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{selectedImportedLead.city || "City pending"}{selectedImportedLead.state ? `, ${selectedImportedLead.state}` : ""} · {selectedImportedLead.acreage ?? "N/A"} acres</p>
                      </div>
                      <button onClick={() => selectedImportedLead.deal_id ? openLinkedDeal(selectedImportedLead.deal_id) : loadImportedLead(selectedImportedLead, true)} style={compactButton}>
                        {selectedImportedLead.deal_id ? "Open Packet" : "Create Packet"}
                      </button>
                    </div>
                    <ConversationPanel
                      eyebrow="Conversation"
                      title="Conversation"
                      subject={selectedImportedLead.phone || selectedImportedLead.phone_2 || "No phone"}
                      communications={communicationEvents}
                      activities={leadActivities.map(activity => ({
                        id: activity.id,
                        title: statusLabel(activity.activity_type),
                        date: activity.created_at,
                        body: activity.summary,
                        meta: activity.next_follow_up_date ? `Follow up ${activity.next_follow_up_date}` : undefined,
                      }))}
                      emptyText="No communication yet. Start with a text, call, outcome, or note."
                      maxHeight={318}
                      composer={renderContactQueueComposer()}
                    />
                  </>
                ) : activeCommunicationEvent ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 10 }}>
                      <div>
                        <h3 style={{ ...sectionTitle, fontSize: 23 }}>{activeCommunicationEvent.contact_name || activeCommunicationEvent.contact_number || activeCommunicationEvent.from_number || "Unmatched contact"}</h3>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                          {activeCommunicationEvent.contact_number || activeCommunicationEvent.from_number || "No phone"} · {activeCommunicationEvent.matched_deal_id ? "Deal linked" : "Needs matching"}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
                        {activeCommunicationThread && (
                          <button
                            type="button"
                            onClick={() => void markContactThreadReadState(activeCommunicationThread, activeCommunicationThread.unreadCount > 0)}
                            style={compactButton}
                          >
                            {activeCommunicationThread.unreadCount > 0 ? "Mark Read" : "Mark Unread"}
                          </button>
                        )}
                        <TwilioCallButton
                          toNumber={activeCommunicationEvent.contact_number || activeCommunicationEvent.from_number || activeCommunicationEvent.to_number}
                          dealId={activeCommunicationEvent.matched_deal_id}
                          compact
                        />
                        <button type="button" onClick={() => setContactActionMenuOpen(open => !open)} style={actionIconButton} title="More actions">...</button>
                        {contactActionMenuOpen && (
                          <div className="contact-action-menu" style={contactActionMenu}>
                            <button onClick={() => openCommsThreadForEvent(activeCommunicationEvent)}>Open thread</button>
                            <button onClick={() => setContactQueueMode("relationships")}>Find match</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)", marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div>
                        <p style={eyebrowSmall}>{activeCommunicationEvent.matched_deal_id ? "Linked record" : "No linked record yet"}</p>
                        <strong style={{ color: "var(--obsidian)", fontSize: 15 }}>{activeCommunicationEvent.contact_number || activeCommunicationEvent.from_number || "Unknown phone"}</strong>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                          {activeCommunicationEvent.matched_deal_id ? "This conversation is connected to a deal packet." : "Create a packet or select a matching relationship from the Relationships tab."}
                        </p>
                      </div>
                      <button onClick={() => activeCommunicationEvent.matched_deal_id ? openLinkedDeal(activeCommunicationEvent.matched_deal_id) : createLeadDraftFromSms(activeCommunicationEvent)} style={compactButton}>
                        {activeCommunicationEvent.matched_deal_id ? "Open Packet" : "Create Packet"}
                      </button>
                    </div>
                    <ConversationPanel
                      eyebrow="Conversation"
                      title="Conversation"
                      subject={phoneForCommunicationEvent(activeCommunicationEvent) || "Unknown contact"}
                      communications={communicationEvents}
                      activities={eventActivities}
                      emptyText="No communication yet."
                      maxHeight={318}
                      composer={renderContactQueueComposer()}
                    />
                  </>
                ) : (
                  <div>
                    <p style={eyebrowSmall}>Relationship workspace</p>
                    <h3 style={{ ...sectionTitle, fontSize: 22 }}>Pick a contact</h3>
                    <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                      Select a contact from the queue to see conversation history, send a Sakari text, log a call, set disposition, or build a packet.
                    </p>
                  </div>
                )}
              </section>

              <aside style={{ display: "grid", gap: 10, alignContent: "start" }}>
                {selectedImportedLead ? (
                  <>
                    <section style={contactQueueSidePanel}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
                        <p style={eyebrowSmall}>Relationship</p>
                        <button onClick={() => router.push(`/lead/${selectedImportedLead.id}`)} style={{ background: "transparent", border: "none", color: "var(--brass)", fontWeight: 800, cursor: "pointer" }}>Edit</button>
                      </div>
                      <InfoStack title="Primary Contact">
                        <p>{selectedImportedLead.owner_name || "Owner unknown"}</p>
                        <p>{[selectedImportedLead.phone, selectedImportedLead.phone_2].filter(Boolean).join(" / ") || "Phone missing"}</p>
                        <p>{selectedImportedLead.email || "Email missing"}</p>
                      </InfoStack>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                        <span style={selectedImportedLead.status === "interested" ? hotPill : pill}>{statusLabel(selectedImportedLead.status)}</span>
                        <span style={pill}>{selectedImportedLead.source_system || "Imported"}</span>
                        {selectedImportedLead.campaign_source && <span style={pill}>{selectedImportedLead.campaign_source}</span>}
                      </div>
                    </section>
                    <section style={contactQueueSidePanel}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
                        <p style={eyebrowSmall}>Linked Records</p>
                        <button onClick={() => selectedImportedLead.deal_id ? openLinkedDeal(selectedImportedLead.deal_id) : router.push(`/lead/${selectedImportedLead.id}`)} style={{ background: "transparent", border: "none", color: "var(--brass)", fontWeight: 800, cursor: "pointer" }}>View all</button>
                      </div>
                      <button onClick={() => selectedImportedLead.deal_id ? openLinkedDeal(selectedImportedLead.deal_id) : router.push(`/lead/${selectedImportedLead.id}`)} style={{ ...contactQueueCard, width: "100%", background: "var(--surface)" }}>
                        <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{selectedImportedLead.property_address || selectedImportedLead.parcel_id || "Property record"}</strong>
                        <span style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{selectedImportedLead.deal_id ? "Deal packet connected" : "Lead record"}</span>
                      </button>
                    </section>
                    <section style={contactQueueSidePanel}>
                      <p style={eyebrowSmall}>Quick Actions</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <TwilioCallButton
                          toNumber={checkLeadCallCompliance(selectedImportedLead).phone?.number || selectedImportedLead.phone || selectedImportedLead.phone_2}
                          leadId={selectedImportedLead.id}
                          disabled={!checkLeadCallCompliance(selectedImportedLead).allowed}
                          disabledReason={!checkLeadCallCompliance(selectedImportedLead).allowed ? `Call blocked: ${checkLeadCallCompliance(selectedImportedLead).blockLabel}.` : null}
                        />
                        <button onClick={() => document.getElementById("va-contact-queue-sms")?.focus()} style={compactButton}>Text</button>
                        <button onClick={() => quickLeadDisposition("left-voicemail", "Left voicemail")} style={compactButton}>Voicemail</button>
                        <button onClick={() => setDispositionDraft({ ...dispositionDraft, disposition: "follow-up", nextFollowUpDate: addDays(2) })} style={compactButton}>Set Callback</button>
                        <button onClick={applyLeadDisposition} style={compactButton}>Log Outcome</button>
                      </div>
                      <div style={{ borderTop: "1px solid var(--fog)", marginTop: 12, paddingTop: 12, display: "grid", gap: 8 }}>
                        <select value={dispositionDraft.disposition} onChange={event => setDispositionDraft({ ...dispositionDraft, disposition: event.target.value as LeadDisposition })}>
                          {LEAD_DISPOSITIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                        <input value={dispositionDraft.note} onChange={event => setDispositionDraft({ ...dispositionDraft, note: event.target.value })} placeholder="Outcome note" />
                        <input value={dispositionDraft.nextFollowUpDate} onChange={event => setDispositionDraft({ ...dispositionDraft, nextFollowUpDate: event.target.value })} type="date" />
                        <button onClick={applyLeadDisposition} style={compactPrimaryButton}>Save Outcome</button>
                      </div>
                      <div style={{ borderTop: "1px solid var(--fog)", marginTop: 12, paddingTop: 12, display: "grid", gap: 8 }}>
                        <select value={activityDraft.activityType} onChange={event => setActivityDraft({ ...activityDraft, activityType: event.target.value as ImportedLandLeadActivity["activity_type"] })}>
                          {LEAD_ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                        <textarea rows={3} value={activityDraft.summary} onChange={event => setActivityDraft({ ...activityDraft, summary: event.target.value })} placeholder="Internal note, call notes, or research context." />
                        <button onClick={logLeadActivity} style={compactButton}>Save Note</button>
                      </div>
                    </section>
                    <section style={contactQueueSidePanel}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
                        <p style={eyebrowSmall}>Compliance Status</p>
                        <span style={checkLeadSmsCompliance(selectedImportedLead).allowed && checkLeadCallCompliance(selectedImportedLead).allowed ? hotPill : pill}>
                          {checkLeadSmsCompliance(selectedImportedLead).allowed && checkLeadCallCompliance(selectedImportedLead).allowed ? "Good standing" : "Review"}
                        </span>
                      </div>
                      <InfoStack title="Outbound rules">
                        <p>SMS: {checkLeadSmsCompliance(selectedImportedLead).allowed ? "Allowed" : checkLeadSmsCompliance(selectedImportedLead).blockLabel}</p>
                        <p>Calls: {checkLeadCallCompliance(selectedImportedLead).allowed ? "Allowed" : checkLeadCallCompliance(selectedImportedLead).blockLabel}</p>
                      </InfoStack>
                    </section>
                  </>
                ) : activeCommunicationEvent ? (
                  <>
                    <section style={contactQueueSidePanel}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
                        <p style={eyebrowSmall}>Relationship</p>
                      </div>
                      <InfoStack title={activeCommunicationEvent.matched_deal_id ? "Linked Contact" : "Unmatched Contact"}>
                        <p>{activeCommunicationEvent.contact_name || "Name unknown"}</p>
                        <p>{activeCommunicationEvent.contact_number || activeCommunicationEvent.from_number || "Phone missing"}</p>
                        <p>Received {formatDate(activeCommunicationEvent.provider_created_at || activeCommunicationEvent.created_at)}</p>
                      </InfoStack>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                        <span style={activeCommunicationEvent.matched_deal_id ? pill : hotPill}>{activeCommunicationEvent.matched_deal_id ? "Deal linked" : "Needs matching"}</span>
                        <span style={pill}>Inbound</span>
                      </div>
                    </section>
                    <section style={contactQueueSidePanel}>
                      <p style={eyebrowSmall}>Linked Records</p>
                      <button
                        onClick={() => activeCommunicationEvent.matched_deal_id ? openLinkedDeal(activeCommunicationEvent.matched_deal_id) : setContactQueueMode("relationships")}
                        style={{ ...contactQueueCard, width: "100%", background: "var(--surface)" }}
                      >
                        <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{activeCommunicationEvent.matched_deal_id ? "Deal packet connected" : "No linked property yet"}</strong>
                        <span style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                          {activeCommunicationEvent.matched_deal_id ? "Open the connected packet for this relationship." : "Use the selected record card or match this phone to an existing relationship."}
                        </span>
                      </button>
                    </section>
                    <section style={contactQueueSidePanel}>
                      <p style={eyebrowSmall}>Quick Actions</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <TwilioCallButton
                          toNumber={activeCommunicationEvent.contact_number || activeCommunicationEvent.from_number || activeCommunicationEvent.to_number}
                          dealId={activeCommunicationEvent.matched_deal_id}
                        />
                        <button onClick={() => openCommsThreadForEvent(activeCommunicationEvent)} style={compactButton}>Text</button>
                        <button onClick={() => setUnlinkedActionMessage("Voicemail drop")} style={compactButton}>Voicemail Drop</button>
                        <button onClick={() => setUnlinkedActionMessage("Callback")} style={compactButton}>Set Callback</button>
                        <button onClick={() => setUnlinkedActionMessage("Log outcome")} style={compactButton}>Log Outcome</button>
                      </div>
                    </section>
                    <section style={contactQueueSidePanel}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
                        <p style={eyebrowSmall}>Compliance Status</p>
                        <span style={pill}>Review</span>
                      </div>
                      <InfoStack title="Outbound rules">
                        <p>SMS: Link before tracked reply</p>
                        <p>Calls: Link before tracked call</p>
                      </InfoStack>
                    </section>
                  </>
                ) : (
                  <section style={contactQueueSidePanel}>
                    <p style={eyebrowSmall}>Context</p>
                    <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>Relationship details, linked records, quick actions, and compliance status appear here after selecting a contact.</p>
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
              <NumberField label="Contact replies" value={briefDraft.seller_replies} onChange={v => setBriefDraft({ ...briefDraft, seller_replies: v })} />
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
                <textarea rows={4} value={briefDraft.blockers ?? ""} onChange={e => setBriefDraft({ ...briefDraft, blockers: e.target.value })} placeholder="Missing access, unclear direction, member decisions needed, contact issues." />
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

      {bulkTextModalOpen && (
        <div
          onClick={() => { if (!bulkTextSending) setBulkTextModalOpen(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(20,17,13,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Bulk text workflow"
            onClick={event => event.stopPropagation()}
            style={{
              width: "min(980px, 100%)",
              maxHeight: "calc(100vh - 48px)",
              overflow: "hidden",
              border: "1px solid var(--brass)",
              borderRadius: 10,
              background: "var(--bone)",
              boxShadow: "0 24px 80px rgba(20,17,13,0.42)",
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
            }}
          >
            <header style={{ background: "var(--obsidian)", color: "var(--bone)", padding: "20px 22px", display: "flex", justifyContent: "space-between", gap: 18, alignItems: "start" }}>
              <div>
                <p style={{ ...eyebrowSmall, color: "var(--brass)", marginBottom: 6 }}>Bulk Text</p>
                <h2 style={{ ...sectionTitle, color: "var(--bone)", fontSize: 30 }}>Campaign send workflow</h2>
                <p style={{ color: "rgba(250,246,237,0.72)", fontSize: 13, marginTop: 6 }}>
                  Build an audience, verify exclusions, preview merge fields, then send.
                </p>
              </div>
              <button onClick={() => setBulkTextModalOpen(false)} disabled={bulkTextSending} style={{ ...secondaryButton, color: "var(--bone)", borderColor: "rgba(250,246,237,0.35)", background: "transparent" }}>
                Close
              </button>
            </header>

            <div style={{ overflow: "auto", padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }} className="three-col">
                {[
                  { id: "audience" as const, label: "1. Audience", detail: `${bulkTextCategorization.totalConsidered} considered` },
                  { id: "compliance" as const, label: "2. Compliance", detail: `${bulkTextCategorization.eligible.length} eligible` },
                  { id: "message" as const, label: "3. Message", detail: `${bulkTextSegments} segment${bulkTextSegments === 1 ? "" : "s"}` },
                ].map(step => (
                  <button
                    key={step.id}
                    onClick={() => setBulkTextStep(step.id)}
                    style={{
                      border: bulkTextStep === step.id ? "1px solid var(--brass)" : "1px solid var(--fog)",
                      borderRadius: 8,
                      padding: 12,
                      background: bulkTextStep === step.id ? "rgba(176,137,84,0.14)" : "var(--surface)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 13 }}>{step.label}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{step.detail}</span>
                  </button>
                ))}
              </div>

              {bulkTextStep === "audience" && (
                <section style={subPanel}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 14 }}>
                    <div>
                      <p style={eyebrowSmall}>Audience Builder</p>
                      <h3 style={{ ...sectionTitle, fontSize: 24 }}>Choose who should enter this send</h3>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={pill}>{bulkTextCategorization.totalConsidered} considered</span>
                      <span style={hotPill}>{bulkTextCategorization.eligible.length} eligible</span>
                    </div>
                  </div>
                  <div style={{ border: "1px solid var(--fog)", borderRadius: 8, background: "var(--surface)", padding: 12, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                      <div>
                        <p style={eyebrowSmall}>Saved Segments</p>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Save reusable audiences like county, score, list, or follow-up groups.</p>
                      </div>
                      <button onClick={clearLeadSegmentFilters} style={secondaryButton}>Clear Filters</button>
                    </div>
                    <div style={{ display: "grid", gap: 8, maxHeight: 190, overflow: "auto" }}>
                      {savedLeadSegments.map(segment => {
                        const segmentAudience = importedLeads.filter(lead => leadMatchesBulkTextCriteria(lead, segment));
                        const segmentCategorization = categorizeForBulkSms(segmentAudience);
                        const batchLabel = segment.batchId === "all"
                          ? "All lists"
                          : leadBatches.find(batch => batch.id === segment.batchId)?.campaign_source
                            || leadBatches.find(batch => batch.id === segment.batchId)?.original_filename
                            || "Saved list";
                        return (
                          <div
                            key={segment.id}
                            style={{
                              border: activeLeadSegmentId === segment.id ? "1px solid var(--brass)" : "1px solid var(--fog)",
                              borderRadius: 8,
                              padding: 10,
                              background: activeLeadSegmentId === segment.id ? "rgba(176,137,84,0.12)" : "var(--bone)",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <button onClick={() => applyLeadSegment(segment)} style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", flex: 1 }}>
                              <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{segment.name}</strong>
                              <span style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                                {[
                                  segment.counties.length || segment.states.length || segment.cities.length || segment.zips.length
                                    ? [...segment.counties, ...segment.cities, ...segment.states, ...segment.zips].filter(Boolean).join(", ")
                                    : "Any location",
                                  IMPORT_STATUS_FILTERS.find(filter => filter.value === segment.status)?.label || "All",
                                  batchLabel,
                                  segment.minScore ? `Score ${segment.minScore}+` : "Any score",
                                  segment.minAcreage || segment.maxAcreage ? `${segment.minAcreage || "0"}-${segment.maxAcreage || "∞"} acres` : null,
                                ].filter(Boolean).join(" · ")}
                              </span>
                            </button>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "end" }}>
                              <span style={hotPill}>{segmentCategorization.eligible.length} eligible</span>
                              <span style={pill}>{segmentCategorization.excluded.length} excluded</span>
                              <button onClick={() => deleteLeadSegment(segment.id)} style={{ ...secondaryButton, padding: "8px 10px", fontSize: 10 }}>Delete</button>
                            </div>
                          </div>
                        );
                      })}
                      {savedLeadSegments.length === 0 && (
                        <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, margin: 0 }}>
                          No saved segments yet. Set filters below, name the audience, then save it.
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="two-col">
                    <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                      List source
                      <select value={bulkTextBatchId} onChange={event => setBulkTextBatchId(event.target.value)} style={{ minHeight: 42 }}>
                        <option value="all">All imported lists</option>
                        {leadBatches.map(batch => (
                          <option key={batch.id} value={batch.id}>{batch.campaign_source || batch.original_filename || batch.source_system}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                      Lead segment
                      <select value={bulkTextAudienceStatus} onChange={event => setBulkTextAudienceStatus(event.target.value as ImportStatusFilter)} style={{ minHeight: 42 }}>
                        {IMPORT_STATUS_FILTERS.filter(filter => filter.value !== "no-phone").map(filter => (
                          <option key={filter.value} value={filter.value}>{filter.label}</option>
                        ))}
                      </select>
                    </label>
                    <MultiSegmentSelect label="County" values={bulkTextCounties} options={bulkTextLocationOptions.counties} onChange={setBulkTextCounties} placeholder="Any county" />
                    <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                      Minimum score
                      <input value={bulkTextMinScore} onChange={event => setBulkTextMinScore(event.target.value)} placeholder="Any score" inputMode="numeric" style={{ minHeight: 42 }} />
                    </label>
                  </div>
                  <div style={{ borderTop: "1px solid var(--fog)", marginTop: 14, paddingTop: 14 }}>
                    <p style={eyebrowSmall}>Location filters</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }} className="number-grid">
                      <MultiSegmentSelect label="State" values={bulkTextStates} options={bulkTextLocationOptions.states} onChange={setBulkTextStates} placeholder="Any state" />
                      <MultiSegmentSelect label="City" values={bulkTextCities} options={bulkTextLocationOptions.cities} onChange={setBulkTextCities} placeholder="Any city" />
                      <MultiSegmentSelect label="ZIP" values={bulkTextZips} options={bulkTextLocationOptions.zips} onChange={setBulkTextZips} placeholder="Any ZIP" />
                      <MultiSegmentSelect label="Mailing state" values={bulkTextMailStates} options={bulkTextLocationOptions.mailStates} onChange={setBulkTextMailStates} placeholder="Any mailing state" />
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--fog)", marginTop: 14, paddingTop: 14 }}>
                    <p style={eyebrowSmall}>Property filters</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }} className="number-grid">
                      <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                        Min acres
                        <input value={bulkTextMinAcreage} onChange={event => setBulkTextMinAcreage(event.target.value)} placeholder="Any" inputMode="decimal" style={{ minHeight: 42 }} />
                      </label>
                      <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                        Max acres
                        <input value={bulkTextMaxAcreage} onChange={event => setBulkTextMaxAcreage(event.target.value)} placeholder="Any" inputMode="decimal" style={{ minHeight: 42 }} />
                      </label>
                      <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                        Min value
                        <input value={bulkTextMinMarketValue} onChange={event => setBulkTextMinMarketValue(event.target.value)} placeholder="$" inputMode="numeric" style={{ minHeight: 42 }} />
                      </label>
                      <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                        Max value
                        <input value={bulkTextMaxMarketValue} onChange={event => setBulkTextMaxMarketValue(event.target.value)} placeholder="$" inputMode="numeric" style={{ minHeight: 42 }} />
                      </label>
                      <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                        Land use
                        <input value={bulkTextLandUse} onChange={event => setBulkTextLandUse(event.target.value)} placeholder="Vacant, residential..." style={{ minHeight: 42 }} />
                      </label>
                      <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                        Owner type
                        <input value={bulkTextOwnerType} onChange={event => setBulkTextOwnerType(event.target.value)} placeholder="Individual, LLC..." style={{ minHeight: 42 }} />
                      </label>
                      <BooleanSegmentSelect label="Owner out of state" value={bulkTextOwnerOutOfState} onChange={setBulkTextOwnerOutOfState} />
                      <BooleanSegmentSelect label="Owner out of county" value={bulkTextOwnerOutOfCounty} onChange={setBulkTextOwnerOutOfCounty} />
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--fog)", marginTop: 14, paddingTop: 14 }}>
                    <p style={eyebrowSmall}>Risk and Land Insights filters</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }} className="number-grid">
                      <BooleanSegmentSelect label="Tax delinquent" value={bulkTextTaxDelinquent} onChange={setBulkTextTaxDelinquent} />
                      <BooleanSegmentSelect label="In HOA" value={bulkTextInHoa} onChange={setBulkTextInHoa} />
                      <BooleanSegmentSelect label="Land locked" value={bulkTextLandLocked} onChange={setBulkTextLandLocked} />
                      <BooleanSegmentSelect label="Flood flag" value={bulkTextFlood} onChange={setBulkTextFlood} />
                      <BooleanSegmentSelect label="Wetlands flag" value={bulkTextWetlands} onChange={setBulkTextWetlands} />
                      <BooleanSegmentSelect label="Road frontage" value={bulkTextRoadFrontage} onChange={setBulkTextRoadFrontage} />
                      <BooleanSegmentSelect label="Odd shape" value={bulkTextTagOddShape} onChange={setBulkTextTagOddShape} />
                      <BooleanSegmentSelect label="Structure" value={bulkTextTagStructure} onChange={setBulkTextTagStructure} />
                      <BooleanSegmentSelect label="Farmland" value={bulkTextTagFarmland} onChange={setBulkTextTagFarmland} />
                      <BooleanSegmentSelect label="Subdivide" value={bulkTextTagSubdivide} onChange={setBulkTextTagSubdivide} />
                      <BooleanSegmentSelect label="Entitlement" value={bulkTextTagEntitlement} onChange={setBulkTextTagEntitlement} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 }} className="number-grid">
                    <MiniStat label="Considered" value={String(bulkTextCategorization.totalConsidered)} />
                    <MiniStat label="Eligible" value={String(bulkTextCategorization.eligible.length)} />
                    <MiniStat label="Send cap" value="500" />
                  </div>
                  <div style={{ border: "1px solid var(--brass)", borderRadius: 8, background: "rgba(176,137,84,0.10)", padding: 12, marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                      <div>
                        <p style={eyebrowSmall}>Save This Segment</p>
                        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                          Save after the filters and counts look right.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={pill}>{bulkTextCategorization.totalConsidered} matched</span>
                        <span style={hotPill}>{bulkTextCategorization.eligible.length} eligible</span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "end" }} className="two-col">
                      <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                        Segment name
                        <input value={leadSegmentName} onChange={event => setLeadSegmentName(event.target.value)} placeholder="Example: Fulton County score 60+" style={{ minHeight: 42 }} />
                      </label>
                      <button onClick={saveLeadSegment} style={primaryButton}>
                        {activeLeadSegmentId ? "Update Segment" : "Save Segment"}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {bulkTextStep === "compliance" && (
                <section style={subPanel}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 14 }}>
                    <div>
                      <p style={eyebrowSmall}>Compliance Review</p>
                      <h3 style={{ ...sectionTitle, fontSize: 24 }}>Blocked contacts stay out automatically</h3>
                    </div>
                    <span style={bulkTextCategorization.excluded.length ? pill : hotPill}>{bulkTextCategorization.excluded.length} excluded</span>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {EXCLUSION_SEVERITY_ORDER.map(severity => {
                      const total = EXCLUSION_REASONS_BY_SEVERITY[severity].reduce((sum, reason) => sum + bulkTextCategorization.excludedByReason[reason], 0);
                      return (
                        <div key={severity} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 12, background: total ? "rgba(176,137,84,0.08)" : "var(--surface)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{EXCLUSION_SEVERITY_LABEL[severity]}</strong>
                            <span style={total ? pill : hotPill}>{total}</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                            {EXCLUSION_REASONS_BY_SEVERITY[severity].filter(reason => bulkTextCategorization.excludedByReason[reason] > 0).map(reason => (
                              <span key={reason} style={{ ...pill, fontSize: 10 }}>
                                {exclusionReasonLabel(reason)} · {bulkTextCategorization.excludedByReason[reason]}
                              </span>
                            ))}
                            {total === 0 && <span style={{ color: "var(--muted)", fontSize: 12 }}>Clear</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, marginTop: 12 }}>
                    Exclusions include DNC, TCPA litigators, opt-outs, missing phones, landlines, VOIP, recent texts, duplicates, passed records, and converted records.
                  </p>
                </section>
              )}

              {bulkTextStep === "message" && (
                <section style={subPanel}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 14 }}>
                    <div>
                      <p style={eyebrowSmall}>Message Builder</p>
                      <h3 style={{ ...sectionTitle, fontSize: 24 }}>Write once, preview per contact</h3>
                    </div>
                    <span style={pill}>{bulkTextMessage.trim() ? bulkTextFinalMessage.length : 0}/1200</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {BULK_TEXT_TEMPLATES.map(template => (
                      <button key={template.label} onClick={() => setBulkTextMessage(template.body)} style={{ ...secondaryButton, padding: "8px 10px", fontSize: 11 }}>
                        {template.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {BULK_SMS_MERGE_FIELDS.map(field => (
                      <button key={field} onClick={() => setBulkTextMessage(current => `${current}${current.endsWith(" ") || !current ? "" : " "}{{${field}}}`)} style={{ ...pill, cursor: "pointer" }}>
                        {`{{${field}}}`}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={bulkTextMessage}
                    onChange={event => setBulkTextMessage(event.target.value)}
                    placeholder="Write the contact message..."
                    rows={5}
                    style={{ width: "100%", minHeight: 130, resize: "vertical" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="two-col">
                    <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                      Send window
                      <select value={bulkTextSendWindow} onChange={event => setBulkTextSendWindow(event.target.value)} style={{ minHeight: 42 }}>
                        <option>Business hours</option>
                        <option>Tomorrow morning</option>
                        <option>Manual review first</option>
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
                      Pacing
                      <select value={bulkTextThrottle} onChange={event => setBulkTextThrottle(event.target.value)} style={{ minHeight: 42 }}>
                        <option>25/hour</option>
                        <option>50/hour</option>
                        <option>100/hour</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ borderTop: "1px solid var(--fog)", marginTop: 14, paddingTop: 12 }}>
                    <p style={eyebrowSmall}>Preview</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }} className="three-col">
                      {bulkTextPreviewLeads.map(lead => (
                        <div key={lead.id} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" }}>
                          <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{lead.owner_name || "Owner unknown"}</strong>
                          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, margin: "4px 0 0" }}>
                            {renderMessageForRecipient(bulkTextMessage || BULK_TEXT_TEMPLATES[0].body, lead)}
                          </p>
                        </div>
                      ))}
                      {bulkTextPreviewLeads.length === 0 && <p style={{ color: "var(--muted)", fontSize: 12 }}>No eligible preview recipients yet.</p>}
                    </div>
                  </div>
                </section>
              )}
            </div>

            <footer style={{ borderTop: "1px solid var(--fog)", padding: "14px 22px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", background: "var(--surface)" }}>
              <p style={{ color: bulkTextResult?.error ? "#9f3412" : "var(--muted)", fontSize: 12, margin: 0 }}>
                {bulkTextResult?.error || (bulkTextResult?.sent ? `Sent to ${bulkTextResult.sent} contacts.` : `${bulkTextCategorization.eligible.length} eligible · ${bulkTextSendWindow} · ${bulkTextThrottle}`)}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {bulkTextStep !== "audience" && <button onClick={() => setBulkTextStep(bulkTextStep === "message" ? "compliance" : "audience")} style={secondaryButton}>Back</button>}
                {bulkTextStep !== "message" ? (
                  <button onClick={() => setBulkTextStep(bulkTextStep === "audience" ? "compliance" : "message")} style={primaryButton}>Continue</button>
                ) : (
                  <button
                    onClick={() => void sendBulkTextFromQueue()}
                    disabled={bulkTextSending || bulkTextCategorization.eligible.length === 0 || !bulkTextMessage.trim()}
                    style={{ ...primaryButton, opacity: bulkTextSending || bulkTextCategorization.eligible.length === 0 || !bulkTextMessage.trim() ? 0.55 : 1 }}
                  >
                    {bulkTextSending ? "Sending..." : `Send ${bulkTextCategorization.eligible.length}`}
                  </button>
                )}
              </div>
            </footer>
          </div>
        </div>
      )}

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
          .va-workspace, .va-form-grid, .workdesk-grid, .two-col, .three-col, .number-grid, .va-briefing-grid, .va-home-grid, .va-cockpit-grid, .va-command-strip {
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
          .va-cockpit-grid {
            grid-template-columns: 1fr !important;
          }
          .va-command-strip {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function MultiSegmentSelect({
  label: text,
  values,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const remaining = options.filter(option => !values.includes(option));
  return (
    <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
      {text}
      <select
        value=""
        onChange={event => onChange(toggleValue(values, event.target.value))}
        style={{ minHeight: 42 }}
      >
        <option value="">{values.length ? "Add another..." : placeholder}</option>
        {remaining.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      {values.length > 0 && (
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", textTransform: "none", letterSpacing: 0 }}>
          {values.map(value => (
            <button
              key={value}
              type="button"
              onClick={event => {
                event.preventDefault();
                onChange(values.filter(item => item !== value));
              }}
              style={{ ...pill, cursor: "pointer", fontSize: 10 }}
              aria-label={`Remove ${value}`}
            >
              {value} x
            </button>
          ))}
        </span>
      )}
    </label>
  );
}

function BooleanSegmentSelect({
  label: text,
  value,
  onChange,
}: {
  label: string;
  value: SegmentBooleanFilter;
  onChange: (value: SegmentBooleanFilter) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2 }}>
      {text}
      <select value={value} onChange={event => onChange(event.target.value as SegmentBooleanFilter)} style={{ minHeight: 42 }}>
        <option value="any">Any</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
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

// Kept while the contact queue still owns the full relationship workflow; the Lists page now surfaces only inventory actions.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        <LeadPathCard label="1. Contact" detail={hasContact ? "Touch logged" : "Call or text contact"} done={hasContact} active={!hasContact} />
        <LeadPathCard label="2. Outcome" detail={hasOutcome ? statusLabel(lead.last_activity_type || lead.status) : "Log result"} done={hasOutcome} active={hasContact && !hasOutcome} />
        <LeadPathCard label="3. Packet" detail={packetReady ? "Ready for brief" : "Need interest or facts"} done={packetReady} active={hasOutcome && !packetReady} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0, 1fr) 300px", gap: 12 }} className="two-col">
        <section style={subPanel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <p style={eyebrowSmall}>Contact record</p>
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

          <div style={{ marginBottom: 12 }}>
            <LandUnderwritingPanel lead={lead} compact />
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
            title="Contact timeline"
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
            <button onClick={() => onQuickDisposition("interested", "Contact is interested")} style={secondaryButton}>Interested</button>
            <button onClick={() => onQuickDisposition("follow-up", "Follow-up set", 2)} style={secondaryButton}>Follow Up</button>
          </div>

          <div style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <div>
                <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>Call contact</strong>
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
              <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>Message contact</strong>
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
            <textarea id="va-workdesk-note" rows={3} value={activityDraft.summary} onChange={e => setActivityDraft({ ...activityDraft, summary: e.target.value })} placeholder="Call notes, email notes, contact response, or research context." style={{ marginTop: 8 }} />
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

const contactQueuePage: React.CSSProperties = {
  background: "transparent",
  border: "none",
  borderRadius: 0,
  padding: "6px 0 0",
  boxShadow: "none",
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

const compactPrimaryButton: React.CSSProperties = {
  ...primaryButton,
  minHeight: 34,
  padding: "8px 11px",
  fontSize: 10,
  borderRadius: 6,
};

const compactButton: React.CSSProperties = {
  ...compactPrimaryButton,
  background: "transparent",
  color: "var(--obsidian)",
  border: "1px solid var(--fog)",
};

const actionIconButton: React.CSSProperties = {
  ...compactButton,
  minWidth: 38,
  minHeight: 38,
  padding: "8px 10px",
  borderRadius: 8,
  fontSize: 15,
  letterSpacing: 0,
  lineHeight: 1,
};

const contactActionMenu: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 6px)",
  zIndex: 20,
  width: 164,
  display: "grid",
  gap: 4,
  padding: 6,
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "var(--bone)",
  boxShadow: "0 18px 38px rgba(20,17,13,0.14)",
};

const workItemCard: React.CSSProperties = {
  alignItems: "flex-start",
  background: "rgba(255,255,255,0.76)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  boxShadow: "0 10px 24px rgba(20,17,13,0.04)",
  color: "var(--ink)",
  cursor: "pointer",
  display: "grid",
  gap: 12,
  gridTemplateColumns: "48px minmax(0, 1fr)",
  minHeight: 94,
  padding: 12,
  textAlign: "left",
};

const contactQueueCard: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--ink)",
  cursor: "pointer",
  display: "block",
  padding: 10,
  textAlign: "left",
};

const contactQueueColumnPanel: React.CSSProperties = {
  ...subPanel,
  padding: 10,
  background: "rgba(255,252,245,0.62)",
};

const contactQueueWorkspacePanel: React.CSSProperties = {
  ...subPanel,
  padding: 12,
  background: "rgba(255,252,245,0.70)",
};

const contactQueueSidePanel: React.CSSProperties = {
  ...subPanel,
  padding: 11,
  background: "rgba(255,252,245,0.64)",
};

const workItemIcon: React.CSSProperties = {
  alignItems: "center",
  background: "var(--obsidian)",
  borderRadius: 8,
  color: "var(--bone)",
  display: "inline-flex",
  fontSize: 10,
  fontWeight: 900,
  height: 42,
  justifyContent: "center",
  letterSpacing: "0.08em",
  width: 42,
};

const workItemHeader: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
  minWidth: 0,
};

const workItemBody: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.45,
  marginTop: 5,
};

const workItemMeta: React.CSSProperties = {
  color: "var(--muted)",
  display: "block",
  fontSize: 11,
  marginTop: 7,
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

const flagChip: React.CSSProperties = {
  ...pill,
  fontSize: 9,
  padding: "2px 6px",
  letterSpacing: "0.06em",
};
