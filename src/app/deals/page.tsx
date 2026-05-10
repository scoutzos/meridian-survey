"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calculateDealAnalysis,
  buildDealAgreementMemo,
  createDeal,
  fetchDealActivity,
  fetchDealAttachments,
  fetchDealChecklist,
  fetchDealAgreement,
  fetchDeals,
  fetchDealVotes,
  generateDueDiligenceChecklist,
  updateChecklistItemStatus,
  updateDeal,
  upsertDealAgreement,
  upsertDealVote,
  type ChecklistStatus,
  type Deal,
  type DealActivity,
  type DealAttachment,
  type DealAgreement,
  type DealAgreementInput,
  type DealAgreementStatus,
  type DealDueDiligenceItem,
  type DealInput,
  type DealPropertyType,
  type DealUrgency,
  type DealVote,
  type DealVoteOption,
} from "@/lib/deals";
import { createProjectFromDeal } from "@/lib/projects";
import { createActionItem } from "@/lib/action-items";
import { createNotification, markNotificationRead } from "@/lib/operations";
import { saveGeneratedMemo } from "@/lib/governance";
import { supabase } from "@/lib/supabase";
import { MEMBERS } from "@/data/questions";
import { isVaUser } from "@/lib/identity";
import { fetchCommunicationEvents, type CommunicationEvent } from "@/lib/communications";

const DISPLAY_FONT = "var(--font-display)";

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
  return value.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
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

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchDeals();
    setDeals(rows);
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
      return;
    }
    void fetchDealChecklist(selected.id).then(setChecklist);
    void fetchDealVotes(selected.id).then(setVotes);
    void fetchDealActivity(selected.id).then(setActivity);
    void fetchDealAttachments(selected.id).then(setAttachments);
    void fetchCommunicationEvents({ dealId: selected.id, limit: 30 }).then(setCommunicationEvents);
    void fetchDealAgreement(selected.id).then(row => {
      setAgreement(row);
      setAgreementDraft(row ?? emptyAgreementDraft(selected.id));
    });
  }, [selected]);

  const liveInput: DealInput = useMemo(() => ({
    ...draft,
    links: draft.linksText.split(/\r?\n/).map(l => l.trim()).filter(Boolean),
  }), [draft]);
  const liveAnalysis = useMemo(() => calculateDealAnalysis(liveInput), [liveInput]);
  const liveChecklist = useMemo(() => generateDueDiligenceChecklist(liveInput), [liveInput]);

  if (!user) return null;

  const notifyDealReviewWork = async (deal: Deal, message: string): Promise<string[]> => {
    const results = await Promise.all(MEMBERS.flatMap(member => [
      createNotification({
        title: `Deal needs your vote: ${deal.title}`,
        body: message,
        priority: deal.urgency === "hot" ? "urgent" : "high",
        assigned_to: member,
        href: `/deals?deal=${deal.id}`,
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
    if (!draft.title.trim()) { alert("Deal title is required."); return; }
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
    if (error && !data) { alert(error); return; }
    if (error && data) {
      alert(`Deal saved, but one follow-up step did not finish: ${error}`);
    }
    if (data) {
      const workErrors = await notifyDealReviewWork(
        data,
        editingDealId
          ? `Updated deal details are ready for review. ${data.analysis?.recommendation ?? "Needs Review"} · ${data.address || data.parcel_id || "Location pending"}`
          : `${data.analysis?.recommendation ?? "Needs Review"} · ${data.address || data.parcel_id || "Location pending"}`,
      );
      if (workErrors.length) {
        alert(`Deal saved, but member vote notifications or action items did not fully create: ${workErrors[0]}`);
      }
    }
    setDraft(EMPTY_DRAFT);
    setEditingDealId(null);
    setShowNew(false);
    await reload();
    if (data) setSelectedId(data.id);
  };

  const startEdit = (deal: Deal) => {
    setDraft(draftFromDeal(deal));
    setEditingDealId(deal.id);
    setShowNew(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleChecklistStatus = async (item: DealDueDiligenceItem, status: ChecklistStatus) => {
    const { error } = await updateChecklistItemStatus(item.id, status, user);
    if (error) { alert(error); return; }
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, status, updated_by: user, updated_at: new Date().toISOString() } : i));
  };

  const sendSmsFromDeal = async () => {
    if (!selected) return;
    const toNumber = selected.seller_phone?.trim();
    if (!toNumber) { alert("This deal does not have a seller phone number."); return; }
    const message = smsDraft.trim();
    if (!message) { alert("Write a text message before sending."); return; }
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
        alert(`SMS failed: ${result.error || response.statusText}`);
        return;
      }
      setSmsDraft("");
      setCommunicationEvents(await fetchCommunicationEvents({ dealId: selected.id, limit: 30 }));
      setActivity(await fetchDealActivity(selected.id));
    } finally {
      setSmsSending(false);
    }
  };

  const handleVote = async (vote: DealVoteOption) => {
    if (!selected) return;
    const { error } = await upsertDealVote(selected.id, user, vote, voteNote);
    if (error) { alert(error); return; }
    await markDealVoteWorkComplete(selected, user);
    setVoteNote("");
    setVotes(await fetchDealVotes(selected.id));
  };

  const handleConvertToProject = async () => {
    if (!selected) return;
    const gate = conversionBlockReason();
    if (gate) { alert(gate); return; }
    setConverting(true);
    const { data, error } = await createProjectFromDeal(selected, user);
    setConverting(false);
    if (error) { alert(error); return; }
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
      `- Max allowable offer: ${money(deal.analysis?.maxAllowableOffer ?? null)}`,
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
    if (error) { alert(error); return; }
    setAgreement(data);
    if (data) setAgreementDraft(data);
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
    if (error) { alert(error); return; }
    await navigator.clipboard?.writeText(body).catch(() => undefined);
    alert("Deal Approval Memo saved. I also copied the memo text when browser permissions allowed it.");
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
    if (error) { alert(error); return; }
    await navigator.clipboard?.writeText(body).catch(() => undefined);
    alert("Deal brief saved. I also copied the memo text when browser permissions allowed it.");
  };

  const cleared = checklist.filter(i => i.status === "cleared" || i.status === "not-applicable").length;
  const blocked = checklist.filter(i => i.status === "blocked").length;
  const myVote = selected ? votes.find(v => v.member_name === user) : null;
  const voteCounts = VOTES.map(v => ({ ...v, count: votes.filter(row => row.vote === v.value).length })).filter(v => v.count > 0);
  const quorumNeeded = 4;
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
  const conversionBlockReason = () => {
    if (!selected) return "Select a deal before converting it to a project.";
    if (approvalVotes < quorumNeeded) return `This deal needs ${quorumNeeded} Make Offer or Counter votes before it can become a project.`;
    if (!agreementReady) return "Approve or sign the deal agreement before converting this deal to a project.";
    if (blockedDiligence > 0) return "Resolve blocked due diligence items before converting this deal to a project.";
    return "";
  };
  const canConvert = !!selected && !conversionBlockReason();

  return (
    <div className="deals-root" style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 20px 100px" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={eyebrow}>Deal Desk</p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 50px)", fontWeight: 500, color: "var(--obsidian)", marginBottom: 6 }}>
            Deal intake & decisions
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.66, fontSize: 14, maxWidth: 680 }}>
            Capture leads from land portals and calls, analyze the numbers, generate diligence, and get the group to a clear next step.
          </p>
          <p style={comingSoonPill}>Land portal + call tool sync coming soon</p>
        </div>
        <button
          onClick={() => {
            setShowNew(s => !s);
            setEditingDealId(null);
            setDraft(EMPTY_DRAFT);
          }}
          style={showNew ? secondaryButton : primaryButton}
        >
          {showNew ? "Cancel" : "New Deal"}
        </button>
      </header>

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
                <textarea rows={3} value={draft.linksText} onChange={e => setDraft({ ...draft, linksText: e.target.value })} placeholder="One county, portal, comp, or map link per line" />
              </div>
              <div>
                <label style={label}>VA / seller notes</label>
                <textarea rows={4} value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Seller motivation, call notes, condition, timing, concerns" />
              </div>
            </div>

            <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No deals yet. Create the first intake packet above.</p>
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
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={selected.urgency === "hot" ? hotPillLarge : pillLarge}>{statusLabel(selected.urgency)}</span>
                    <button onClick={() => startEdit(selected)} style={secondaryButton}>
                      Edit Deal
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

              <section style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 12 }}>
                  <div>
                    <p style={eyebrowSmall}>Seller communications</p>
                    <h2 style={sectionTitle}>SMS thread</h2>
                  </div>
                  <span style={pill}>{selected.seller_phone || "No seller phone"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 12 }} className="two-col">
                  <div style={subPanel}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflow: "auto" }}>
                      {communicationEvents.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>No Sakari messages are attached to this deal yet.</p>}
                      {communicationEvents.map(event => (
                        <div key={event.id} style={{
                          border: "1px solid var(--fog)",
                          borderRadius: 8,
                          padding: 10,
                          background: event.direction === "inbound" ? "rgba(176,137,84,0.08)" : "var(--surface)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                            <strong style={{ color: "var(--obsidian)", fontSize: 12 }}>
                              {event.direction === "inbound" ? "Seller reply" : event.direction === "outbound" ? "Meridian sent" : "Sakari update"}
                            </strong>
                            <span style={miniLabel}>{formatDate(event.provider_created_at || event.created_at)}</span>
                          </div>
                          <p style={{ color: "var(--ink)", fontSize: 13, lineHeight: 1.45 }}>{event.body || event.status || event.provider_event_type}</p>
                          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{event.status || event.provider_event_type}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={subPanel}>
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
                </div>
              </section>

              {(attachments.length > 0 || activity.length > 0) && (
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
                    Quorum rule: {quorumNeeded} of {MEMBERS.length} members must respond. Offer authority is reached when {quorumNeeded} members vote Make Offer or Counter.
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
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .deal-workspace,
          .deal-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 680px) {
          .deals-root { padding-top: 28px !important; }
          .two-col,
          .three-col,
          .number-grid,
          .agreement-number-grid,
          .checklist-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
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
