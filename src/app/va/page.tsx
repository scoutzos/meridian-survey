"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
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
  type DealPropertyType,
  type DealReviewIntent,
  type DealStatus,
  type DealUrgency,
  type DealDueDiligenceItem,
} from "@/lib/deals";
import { createActionItem } from "@/lib/action-items";
import { createNotification } from "@/lib/operations";
import {
  createImportedLandLeadActivity,
  fetchImportedLandLeadActivities,
  fetchLandLeadBatches,
  fetchImportedLandLeads,
  importLandLeadsFromCsv,
  leadToDealDraft,
  previewLandLeadsCsv,
  updateLandLeadBatch,
  updateImportedLandLeadStatus,
  type ImportedLandLeadActivity,
  type ImportedLandLead,
  type LandLeadBatch,
  type LandLeadImportPreview,
} from "@/lib/land-leads";
import {
  createVaDailyBrief,
  fetchVaDailyBriefs,
  type VaDailyBrief,
  type VaDailyBriefInput,
} from "@/lib/va-briefs";

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

type VaTab = "leads" | "imports" | "follow-ups" | "diligence" | "brief";

const TABS: Array<{ value: VaTab; label: string }> = [
  { value: "leads", label: "Leads" },
  { value: "imports", label: "Imports" },
  { value: "follow-ups", label: "Follow-ups" },
  { value: "diligence", label: "Diligence" },
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
  return value.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function isSameDay(iso: string | null | undefined, date: string): boolean {
  return !!iso && iso.slice(0, 10) === date;
}

function isDueTodayOrPast(date: string | null | undefined, today: string): boolean {
  return !!date && date <= today;
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
    links: draft.linksText.split(/\r?\n/).map(l => l.trim()).filter(Boolean),
  };
}

async function notifyMembersForReview(deal: Deal, actor: string, shouldCreateVoteTasks: boolean): Promise<string[]> {
  const message = [
    deal.submission_summary || deal.analysis?.recommendation || "Needs Review",
    deal.requested_next_step ? `Next: ${deal.requested_next_step}` : "",
    deal.submit_uncertainties ? `Uncertain: ${deal.submit_uncertainties}` : "",
  ].filter(Boolean).join(" · ");
  const notifications = MEMBERS.map(member =>
    createNotification({
      title: shouldCreateVoteTasks ? `Deal needs your vote: ${deal.title}` : `Deal needs review: ${deal.title}`,
      body: message,
      priority: deal.urgency === "hot" ? "urgent" : "high",
      assigned_to: member,
      href: `/deals?deal=${deal.id}`,
      source_table: "meridian_deals",
      source_id: deal.id,
      notification_type: shouldCreateVoteTasks ? "deal_vote" : "deal-review",
    }, actor)
  );
  const actionItems = shouldCreateVoteTasks ? MEMBERS.map(member => createActionItem({
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
  const [importedLeads, setImportedLeads] = useState<ImportedLandLead[]>([]);
  const [leadBatches, setLeadBatches] = useState<LandLeadBatch[]>([]);
  const [selectedImportedLeadId, setSelectedImportedLeadId] = useState<string | null>(null);
  const [leadActivities, setLeadActivities] = useState<ImportedLandLeadActivity[]>([]);
  const [importPreview, setImportPreview] = useState<LandLeadImportPreview | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState<ImportStatusFilter>("all");
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");
  const [uploadSource, setUploadSource] = useState("Land Portal");
  const [uploadCampaign, setUploadCampaign] = useState("");
  const [activityDraft, setActivityDraft] = useState<{ activityType: ImportedLandLeadActivity["activity_type"]; summary: string; nextFollowUpDate: string }>({ activityType: "called", summary: "", nextFollowUpDate: "" });
  const [saving, setSaving] = useState(false);
  const [briefSaving, setBriefSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<VaTab>("leads");
  const [notifyReviewUpdate, setNotifyReviewUpdate] = useState(false);

  const reload = useCallback(async (memberName = user) => {
    setLoading(true);
    const [rows, briefRows, importRows, batchRows] = await Promise.all([fetchDeals(), fetchVaDailyBriefs(8), fetchImportedLandLeads(500), fetchLandLeadBatches()]);
    const activeRows = rows.filter(deal =>
      !["closed", "active-project", "stabilized", "sold"].includes(deal.status)
      && (!memberName || deal.created_by === memberName || deal.submitted_by === memberName || deal.assigned_to === memberName)
    );
    setDeals(activeRows);
    setBriefs(briefRows);
    setImportedLeads(importRows);
    setLeadBatches(batchRows);
    setSelectedId(prev => prev && activeRows.some(d => d.id === prev) ? prev : activeRows[0]?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void reload(u);
  }, [router, reload]);

  const selected = useMemo(() => deals.find(deal => deal.id === selectedId) ?? null, [deals, selectedId]);
  const liveInput = useMemo(() => buildPayload(draft, draft.status ?? "lead"), [draft]);
  const liveAnalysis = useMemo(() => calculateDealAnalysis(liveInput), [liveInput]);
  const liveChecklist = useMemo(() => generateDueDiligenceChecklist(liveInput), [liveInput]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const followUpsDue = useMemo(() => deals.filter(deal => isDueTodayOrPast(deal.next_follow_up_date, today)), [deals, today]);
  const draftLeads = useMemo(() => deals.filter(deal => deal.status === "lead"), [deals]);
  const submittedDeals = useMemo(() => deals.filter(deal => deal.status === "under-review"), [deals]);
  const interestedLeads = useMemo(() => importedLeads.filter(lead => lead.status === "interested"), [importedLeads]);
  const selectedImportedLead = useMemo(() => importedLeads.find(lead => lead.id === selectedImportedLeadId) ?? null, [importedLeads, selectedImportedLeadId]);
  const filteredImportedLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    const min = toNumber(minAcreage);
    const max = toNumber(maxAcreage);
    const rows = importedLeads.filter(lead => {
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
      if (!query) return true;
      return [
      lead.owner_name,
      lead.phone,
      lead.phone_2,
      lead.property_address,
      lead.parcel_id,
      lead.county,
      lead.city,
      lead.campaign_source,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
    return rows.sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0)).slice(0, 120);
  }, [importedLeads, leadFilter, leadSearch, maxAcreage, minAcreage]);
  const importStats = useMemo(() => ({
    newRows: importedLeads.filter(lead => lead.status === "new").length,
    contacted: importedLeads.filter(lead => lead.status === "contacted").length,
    interested: importedLeads.filter(lead => lead.status === "interested").length,
    duplicates: importedLeads.filter(lead => lead.duplicate_status && lead.duplicate_status !== "new").length,
    converted: importedLeads.filter(lead => lead.status === "converted").length,
    avgScore: importedLeads.length ? Math.round(importedLeads.reduce((sum, lead) => sum + (lead.lead_score ?? 0), 0) / importedLeads.length) : 0,
  }), [importedLeads]);
  const blockedItems = useMemo(() => checklist.filter(item => item.status === "blocked"), [checklist]);
  const portalStats = useMemo(() => ({
    addedToday: deals.filter(deal => isSameDay(deal.created_at, today)).length,
    updatedToday: deals.filter(deal => isSameDay(deal.updated_at, today)).length,
    submittedToday: deals.filter(deal => deal.status === "under-review" && isSameDay(deal.updated_at, today)).length,
    briefSubmitted: briefs.some(brief => brief.work_date === today),
  }), [briefs, deals, today]);
  const readinessItems = useMemo(() => [
    { label: "Address or parcel", done: !!(liveInput.address || liveInput.parcel_id) },
    { label: "Seller contact", done: !!(liveInput.seller_name || liveInput.seller_phone) },
    { label: "Asking price", done: typeof liveInput.asking_price === "number" && Number.isFinite(liveInput.asking_price) },
    { label: liveInput.property_type === "land" ? "Exit value or comp support" : "ARV or value", done: typeof liveInput.arv === "number" && Number.isFinite(liveInput.arv) },
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
      return;
    }
    setDraft(draftFromDeal(selected));
    void Promise.all([fetchDealChecklist(selected.id), fetchDealAttachments(selected.id)]).then(([items, files]) => {
      setChecklist(items);
      setAttachments(files);
    });
  }, [selected]);

  useEffect(() => {
    if (!selectedImportedLeadId) { setLeadActivities([]); return; }
    void fetchImportedLandLeadActivities(selectedImportedLeadId).then(setLeadActivities);
  }, [selectedImportedLeadId]);

  if (!user) return null;

  const startNew = () => {
    setSelectedId(null);
    setChecklist([]);
    setAttachments([]);
    setDraft(EMPTY_DRAFT);
    setAttachmentDraft(EMPTY_ATTACHMENT());
    setMessage("");
    setActiveTab("leads");
    setNotifyReviewUpdate(false);
  };

  const saveDeal = async (status: DealStatus) => {
    if (!draft.title.trim()) { setMessage("Add a deal title before saving."); return; }
    const now = new Date().toISOString();
    const existingRound = selected?.review_round ?? draft.review_round ?? 0;
    const isReviewSubmit = status === "under-review";
    const shouldNotifyMembers = isReviewSubmit && (!selected?.last_review_notification_at || selected.status !== "under-review" || notifyReviewUpdate);
    if (isReviewSubmit) {
      if (!submissionReady) {
        setActiveTab("leads");
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
      setImportedLeads(await fetchImportedLandLeads());
    }
    if (status === "under-review") {
      if (shouldNotifyMembers) {
        const errors = await notifyMembersForReview(result.data, user, result.data.review_intent === "ready-for-vote");
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
    if (preview.error) { setMessage(preview.error); return; }
    setImportPreview(preview);
    setMessage(`Preview ready. Review the import preview card and click Confirm Import to save ${preview.usableLeads} usable leads.`);
    setActiveTab("imports");
  };

  const confirmLeadImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    setMessage(`Importing ${importPreview.usableLeads} leads now. Large lists can take a minute; keep this tab open.`);
    try {
      const result = await importLandLeadsFromCsv({
        csvText: importPreview.csvText,
        filename: importPreview.filename,
        sourceSystem: uploadSource,
        campaignSource: uploadCampaign,
        actor: user,
      });
      if (result.error) { setMessage(`Import failed: ${result.error}`); return; }
      const [leadRows, batchRows] = await Promise.all([fetchImportedLandLeads(500), fetchLandLeadBatches()]);
      setImportedLeads(leadRows);
      setLeadBatches(batchRows);
      setImportPreview(null);
      setMessage([
        `Imported ${result.leads.length} lead${result.leads.length === 1 ? "" : "s"} from ${importPreview.filename}.`,
        result.warning || "",
      ].filter(Boolean).join(" "));
      setActiveTab("imports");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown upload error.";
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
    setDraft({
      ...EMPTY_DRAFT,
      ...imported,
      linksText: imported.linksText ?? "",
      submitted_by: user,
      assigned_to: user,
      source: imported.source || lead.source_system,
      campaign_source: imported.campaign_source || lead.campaign_source || "",
    });
    setActiveTab("leads");
    setSelectedImportedLeadId(lead.id);
    setMessage("Imported lead loaded into the deal form.");
    if (markInterested && lead.status !== "interested") {
      await updateImportedLandLeadStatus(lead.id, "interested", lead.deal_id);
      setImportedLeads(await fetchImportedLandLeads());
    }
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
    setActivityDraft({ activityType: "called", summary: "", nextFollowUpDate: "" });
    setMessage("Lead activity logged.");
  };

  const autofillBriefStats = () => {
    const date = briefDraft.work_date;
    const sameDay = (iso?: string | null) => !!iso && iso.slice(0, 10) === date;
    const ownDeals = deals.filter(deal => deal.created_by === user || deal.submitted_by === user || deal.assigned_to === user);
    const touchedImportedLeads = importedLeads.filter(lead => sameDay(lead.last_activity_at));
    setBriefDraft(prev => ({
      ...prev,
      leads_added: ownDeals.filter(deal => sameDay(deal.created_at)).length,
      leads_updated: ownDeals.filter(deal => sameDay(deal.updated_at)).length + touchedImportedLeads.length,
      outreach_sent: touchedImportedLeads.filter(lead => ["called", "texted", "emailed", "left-voicemail"].includes(lead.last_activity_type || "")).length,
      seller_replies: touchedImportedLeads.filter(lead => lead.status === "interested").length,
      calls_completed: touchedImportedLeads.filter(lead => lead.last_activity_type === "called" || lead.last_activity_type === "left-voicemail").length,
      deals_submitted: ownDeals.filter(deal => deal.status === "under-review" && sameDay(deal.updated_at)).length,
      checklist_items_cleared: checklist.filter(item => sameDay(item.updated_at) && (item.status === "cleared" || item.status === "not-applicable") && item.updated_by === user).length,
    }));
  };

  const submitDailyBrief = async () => {
    setBriefSaving(true);
    setMessage("");
    const { data, error } = await createVaDailyBrief(briefDraft, user);
    setBriefSaving(false);
    if (error) { setMessage(error); return; }
    if (data) {
      await Promise.all(MEMBERS.map(member => createNotification({
        title: `VA daily brief ready: ${data.submitted_by}`,
        body: `${data.work_date} · ${data.hours_worked ?? 0} hours · ${data.leads_added ?? 0} leads added · ${data.deals_submitted ?? 0} deals submitted`,
        priority: data.blockers ? "high" : "normal",
        assigned_to: member,
        href: "/operations",
        source_table: "meridian_va_daily_briefs",
        source_id: data.id,
        notification_type: "va-daily-brief",
      }, user)));
      setBriefs(prev => [data, ...prev].slice(0, 8));
      setBriefDraft(EMPTY_BRIEF());
      setMessage("Daily brief submitted for member review.");
    }
  };

  const cleared = checklist.filter(i => i.status === "cleared" || i.status === "not-applicable").length;
  const blocked = checklist.filter(i => i.status === "blocked").length;

  return (
    <div className="va-root" style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 20px 100px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <p style={eyebrow}>VA Desk</p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 50px)", fontWeight: 500, color: "var(--obsidian)", marginBottom: 6 }}>
            Lead intake & follow-up
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.66, fontSize: 14, maxWidth: 720 }}>
            Submit leads, update seller notes, attach research, and move clean opportunities to member review.
          </p>
        </div>
        <button onClick={startNew} style={primaryButton}>New Lead</button>
      </header>

      {message && (
        <div style={{ ...panel, padding: 12, marginBottom: 16, borderColor: message.includes("issue") || message.includes("Add") || message.includes("could") ? "var(--obsidian)" : "var(--brass)" }}>
          <p style={{ fontSize: 13, color: "var(--ink)" }}>{message}</p>
        </div>
      )}

      <section style={{ ...panel, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <p style={eyebrowSmall}>Today&apos;s work</p>
            <h2 style={sectionTitle}>Shift dashboard</h2>
          </div>
          <span style={portalStats.briefSubmitted ? hotPill : pill}>
            {portalStats.briefSubmitted ? "Brief submitted" : "Brief pending"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }} className="number-grid">
          <ShiftCard label="Follow-ups due" value={String(followUpsDue.length)} tone={followUpsDue.length ? "hot" : "calm"} />
          <ShiftCard label="Draft leads" value={String(draftLeads.length)} />
          <ShiftCard label="Submitted today" value={String(portalStats.submittedToday)} />
          <ShiftCard label="Blocked items" value={String(blockedItems.length)} tone={blockedItems.length ? "hot" : "calm"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }} className="number-grid">
          <ShiftCard label="Leads added" value={String(portalStats.addedToday)} />
          <ShiftCard label="Leads updated" value={String(portalStats.updatedToday)} />
          <ShiftCard label="Under review" value={String(submittedDeals.length)} />
          <ShiftCard label="Interested imports" value={String(interestedLeads.length)} tone={interestedLeads.length ? "hot" : "calm"} />
        </div>
      </section>

      <div style={{ ...panel, padding: 8, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            style={activeTab === tab.value ? tabActive : tabButton}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "330px minmax(0, 1fr)", gap: 18 }} className="va-workspace">
        <aside style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={sectionTitle}>Lead Queue</h2>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{deals.length} active</span>
          </div>
          {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading...</p>}
          {!loading && deals.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No active leads yet.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {deals.map(deal => {
              const active = selected?.id === deal.id;
              return (
                <button
                  key={deal.id}
                  onClick={() => { setSelectedId(deal.id); setMessage(""); }}
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
                    {deal.address || deal.parcel_id || "No location added"}
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
                <button key={`follow-${deal.id}`} onClick={() => setSelectedId(deal.id)} style={{
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
        </aside>

        <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {activeTab === "leads" && (
          <section style={panel}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(300px, 0.9fr)", gap: 18 }} className="va-form-grid">
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
                  <p style={eyebrowSmall}>Member submission packet</p>
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
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                    {REVIEW_INTENTS.find(intent => intent.value === draft.review_intent)?.description}
                  </p>
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
                    <input type="text" value={draft.seller_phone ?? ""} onChange={e => setDraft({ ...draft, seller_phone: e.target.value })} />
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
                <div>
                  <label style={label}>Links</label>
                  <textarea rows={3} value={draft.linksText} onChange={e => setDraft({ ...draft, linksText: e.target.value })} placeholder="One county, portal, comp, map, photo, or document link per line" />
                </div>
                <div>
                  <label style={label}>Seller / research notes</label>
                  <textarea rows={5} value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Seller motivation, timeline, condition, due diligence notes, county calls, concerns, next follow-up" />
                </div>
              </div>

              <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

          {activeTab === "imports" && (
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <p style={eyebrowSmall}>Land lists</p>
                <h2 style={sectionTitle}>Upload & search imported leads</h2>
              </div>
              <span style={pill}>{importedLeads.length} imported · Avg score {importStats.avgScore}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }} className="number-grid">
              <ShiftCard label="New" value={String(importStats.newRows)} />
              <ShiftCard label="Contacted" value={String(importStats.contacted)} />
              <ShiftCard label="Interested" value={String(importStats.interested)} tone={importStats.interested ? "hot" : "calm"} />
              <ShiftCard label="Duplicates" value={String(importStats.duplicates)} />
              <ShiftCard label="Converted" value={String(importStats.converted)} />
            </div>
            <div style={{ ...subPanel, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr) 190px", gap: 10 }} className="three-col">
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
                  <label style={label}>Campaign / list name</label>
                  <input value={uploadCampaign} onChange={e => setUploadCampaign(e.target.value)} placeholder="Example: Fulton infill lots May 2026" />
                </div>
                <div>
                  <label style={label}>CSV upload</label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={importing}
                    onChange={e => { void handleLeadCsvUpload(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
                  />
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.45 }}>
                The importer recognizes Land Portal and Land Insights CSV columns like APN, owner name(s), mail, address, city, state, ZIP, county, acreage, price/value, property tax, email, maps, and property URL. Apple Numbers files should be exported to CSV before upload.
              </p>
            </div>

            {importPreview && (
              <div style={{ ...subPanel, marginBottom: 12, borderColor: "var(--brass)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={eyebrowSmall}>Import preview</p>
                    <h3 style={{ ...sectionTitle, fontSize: 20 }}>{importPreview.filename}</h3>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setImportPreview(null)} style={secondaryButton}>Cancel</button>
                    <button onClick={confirmLeadImport} disabled={importing} style={{ ...primaryButton, opacity: importing ? 0.6 : 1 }}>
                      {importing ? "Importing..." : "Confirm Import"}
                    </button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }} className="number-grid">
                  <MiniStat label="Rows" value={String(importPreview.rowsFound)} />
                  <MiniStat label="Usable" value={String(importPreview.usableLeads)} />
                  <MiniStat label="No phone" value={String(importPreview.missingPhone)} />
                  <MiniStat label="No owner" value={String(importPreview.missingOwner)} />
                  <MiniStat label="Duplicates" value={String(importPreview.possibleDuplicates + importPreview.alreadyConverted)} />
                  <MiniStat label="Avg score" value={String(importPreview.averageScore)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 10 }} className="two-col">
                  {importPreview.sampleLeads.map((lead, index) => (
                    <div key={`${lead.parcel_id}-${index}`} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" }}>
                      <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{lead.owner_name || "Owner unknown"}</strong>
                      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{lead.property_address || lead.parcel_id || "No parcel address"} · Score {lead.lead_score ?? 0}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ ...subPanel, marginBottom: 12 }}>
              <p style={eyebrowSmall}>Batch workflow</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }} className="three-col">
                {leadBatches.slice(0, 6).map(batch => (
                  <div key={batch.id} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 10, background: "var(--surface)" }}>
                    <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 13 }}>{batch.campaign_source || batch.original_filename || batch.source_system}</strong>
                    <p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 8px" }}>{batch.row_count} rows · {statusLabel(batch.status || "not-started")}</p>
                    <select
                      value={batch.status || "not-started"}
                      onChange={async e => {
                        await updateLandLeadBatch(batch.id, { status: e.target.value as LandLeadBatch["status"], assigned_to: user });
                        setLeadBatches(await fetchLandLeadBatches());
                      }}
                    >
                      <option value="not-started">Not Started</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                ))}
                {leadBatches.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No import batches yet.</p>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(320px, 1.05fr)", gap: 12 }} className="va-form-grid">
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: 8, marginBottom: 8 }} className="two-col">
                  <div>
                    <label style={label}>Search imported list</label>
                    <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Search owner, phone, parcel, address, county, city, or campaign" />
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
                      onClick={() => setSelectedImportedLeadId(lead.id)}
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
                {!selectedImportedLead && <p style={{ fontSize: 13, color: "var(--muted)" }}>Select a lead to review details, log outreach, or convert it to a deal packet.</p>}
                {selectedImportedLead && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
                      <div>
                        <p style={eyebrowSmall}>Lead detail</p>
                        <h3 style={{ ...sectionTitle, fontSize: 22 }}>{selectedImportedLead.owner_name || "Owner unknown"}</h3>
                      </div>
                      <span style={selectedImportedLead.status === "interested" ? hotPill : pill}>{statusLabel(selectedImportedLead.status)}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }} className="two-col">
                      <MiniStat label="Score" value={String(selectedImportedLead.lead_score ?? 0)} />
                      <MiniStat label="Touches" value={String(selectedImportedLead.outreach_count ?? 0)} />
                      <MiniStat label="Acreage" value={selectedImportedLead.acreage ? String(selectedImportedLead.acreage) : "N/A"} />
                      <MiniStat label="Value" value={selectedImportedLead.market_value ? `$${selectedImportedLead.market_value.toLocaleString()}` : "N/A"} />
                    </div>
                    <div style={{ display: "grid", gap: 8, fontSize: 13, color: "var(--ink)", marginBottom: 12 }}>
                      <p><strong>Parcel:</strong> {selectedImportedLead.parcel_id || "N/A"}</p>
                      <p><strong>Address:</strong> {selectedImportedLead.property_address || "N/A"}</p>
                      <p><strong>Mailing:</strong> {selectedImportedLead.mailing_address || "N/A"}</p>
                      <p><strong>Phone:</strong> {[selectedImportedLead.phone, selectedImportedLead.phone_2].filter(Boolean).join(" / ") || "N/A"}</p>
                      <p><strong>Email:</strong> {selectedImportedLead.email || "N/A"}</p>
                      <p><strong>Zoning / use:</strong> {[selectedImportedLead.zoning, selectedImportedLead.land_use].filter(Boolean).join(" / ") || "N/A"}</p>
                      <p><strong>Flags:</strong> Land locked {String(selectedImportedLead.raw_data?.["Land Locked"] ?? selectedImportedLead.raw_data?.["Tag:Land Locked"] ?? "N/A")} · Flood {String(selectedImportedLead.raw_data?.["Flood Zone Percent"] ?? "0")} · Wetlands {String(selectedImportedLead.raw_data?.["Wetlands Percent"] ?? "0")}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      {selectedImportedLead.property_url && <a href={selectedImportedLead.property_url} target="_blank" rel="noreferrer" style={secondaryButton}>Open Parcel</a>}
                      {typeof selectedImportedLead.raw_data?.["Google Map"] === "string" && <a href={selectedImportedLead.raw_data["Google Map"]} target="_blank" rel="noreferrer" style={secondaryButton}>Map</a>}
                      <button onClick={() => loadImportedLead(selectedImportedLead, true)} style={primaryButton}>Use Lead</button>
                      <button onClick={async () => { await updateImportedLandLeadStatus(selectedImportedLead.id, "passed", selectedImportedLead.deal_id); setImportedLeads(await fetchImportedLandLeads(500)); }} style={secondaryButton}>Pass</button>
                    </div>
                    {!!selectedImportedLead.score_reasons?.length && (
                      <div style={{ marginBottom: 14 }}>
                        <p style={miniLabel}>Score reasons</p>
                        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{selectedImportedLead.score_reasons.join(", ")}</p>
                      </div>
                    )}
                    <div style={{ borderTop: "1px solid var(--fog)", paddingTop: 12 }}>
                      <p style={eyebrowSmall}>Log outreach</p>
                      <div style={{ display: "grid", gridTemplateColumns: "160px minmax(0, 1fr)", gap: 8 }} className="two-col">
                        <select value={activityDraft.activityType} onChange={e => setActivityDraft({ ...activityDraft, activityType: e.target.value as ImportedLandLeadActivity["activity_type"] })}>
                          {LEAD_ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                        <input value={activityDraft.nextFollowUpDate} onChange={e => setActivityDraft({ ...activityDraft, nextFollowUpDate: e.target.value })} type="date" />
                      </div>
                      <textarea rows={3} value={activityDraft.summary} onChange={e => setActivityDraft({ ...activityDraft, summary: e.target.value })} placeholder="What happened? Include seller response, wrong number, voicemail, follow-up notes, or next action." style={{ marginTop: 8 }} />
                      <button onClick={logLeadActivity} style={{ ...secondaryButton, marginTop: 8 }}>Save Activity</button>
                    </div>
                    <div style={{ borderTop: "1px solid var(--fog)", paddingTop: 12, marginTop: 12 }}>
                      <p style={eyebrowSmall}>Activity history</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflow: "auto" }}>
                        {leadActivities.map(activity => (
                          <div key={activity.id} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 8, background: "var(--surface)" }}>
                            <strong style={{ display: "block", color: "var(--obsidian)", fontSize: 12 }}>{statusLabel(activity.activity_type)} · {formatDate(activity.created_at)}</strong>
                            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{activity.summary}</p>
                            {activity.next_follow_up_date && <p style={{ ...miniLabel, marginTop: 6 }}>Follow up {activity.next_follow_up_date}</p>}
                          </div>
                        ))}
                        {leadActivities.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>No activity logged for this lead yet.</p>}
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </section>
          )}

          {activeTab === "follow-ups" && (
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <p style={eyebrowSmall}>Next actions</p>
                <h2 style={sectionTitle}>Follow-up queue</h2>
              </div>
              <span style={followUpsDue.length ? hotPill : pill}>{followUpsDue.length} due now</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="two-col">
              {(followUpsDue.length ? followUpsDue : deals.filter(deal => deal.next_follow_up_date).slice(0, 8)).map(deal => (
                <button
                  key={deal.id}
                  onClick={() => { setSelectedId(deal.id); setActiveTab("leads"); }}
                  style={{
                    ...subPanel,
                    textAlign: "left",
                    cursor: "pointer",
                    background: selected?.id === deal.id ? "rgba(176,137,84,0.14)" : "var(--bone)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <strong style={{ color: "var(--obsidian)", fontSize: 14 }}>{deal.title}</strong>
                    <span style={deal.urgency === "hot" ? hotPill : pill}>{deal.next_follow_up_date || "No date"}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{deal.seller_name || "Seller pending"} · {deal.seller_phone || "Phone pending"}</p>
                  <p style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{deal.notes || "No follow-up notes yet."}</p>
                </button>
              ))}
              {deals.filter(deal => deal.next_follow_up_date).length === 0 && (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>No follow-ups have been dated yet.</p>
              )}
            </div>
          </section>
          )}

          {activeTab === "diligence" && (
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
              </div>
              <span style={pill}>Members can review in Operations</span>
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
              <NumberField label="Checklist cleared" value={briefDraft.checklist_items_cleared} onChange={v => setBriefDraft({ ...briefDraft, checklist_items_cleared: v })} />
            </div>
            <button onClick={autofillBriefStats} style={{ ...secondaryButton, marginTop: 10 }}>
              Auto-fill Portal Stats
            </button>
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
            <button onClick={submitDailyBrief} disabled={briefSaving} style={{ ...primaryButton, marginTop: 12, opacity: briefSaving ? 0.6 : 1 }}>
              {briefSaving ? "Submitting..." : "Submit Daily Brief"}
            </button>

            <div style={{ marginTop: 18 }}>
              <h3 style={{ ...sectionTitle, fontSize: 20 }}>Recent briefs</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {briefs.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No daily briefs submitted yet.</p>}
                {briefs.map(brief => (
                  <div key={brief.id} style={subPanel}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <strong style={{ color: "var(--obsidian)" }}>{formatDate(brief.work_date)}</strong>
                      <span style={pill}>{brief.hours_worked ?? 0} hrs</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                      Leads {brief.leads_added ?? 0} added / {brief.leads_updated ?? 0} updated · Outreach {brief.outreach_sent ?? 0} · Deals submitted {brief.deals_submitted ?? 0}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{brief.activities_completed}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}
        </main>
      </div>

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
        @media (max-width: 880px) {
          .va-root { padding-top: 28px !important; }
          .va-workspace, .va-form-grid, .two-col, .three-col, .number-grid {
            grid-template-columns: 1fr !important;
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

const tabButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--muted)",
  border: "1px solid transparent",
  borderRadius: 6,
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
