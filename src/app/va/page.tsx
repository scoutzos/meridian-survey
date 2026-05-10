"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import {
  calculateDealAnalysis,
  createDeal,
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
  type DealStatus,
  type DealUrgency,
  type DealDueDiligenceItem,
} from "@/lib/deals";
import { createActionItem } from "@/lib/action-items";
import { createNotification } from "@/lib/operations";
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
    links: draft.linksText.split(/\r?\n/).map(l => l.trim()).filter(Boolean),
  };
}

async function notifyMembersForReview(deal: Deal, actor: string): Promise<string[]> {
  const message = `${deal.analysis?.recommendation ?? "Needs Review"} - ${deal.address || deal.parcel_id || "Location pending"}`;
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
    }, actor),
    createActionItem({
      title: `Review deal: ${deal.title}`,
      description: message,
      assigned_to: member,
      due_date: addDays(deal.urgency === "hot" ? 1 : 2),
    }, actor),
  ]));
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
  const [saving, setSaving] = useState(false);
  const [briefSaving, setBriefSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const reload = useCallback(async (memberName = user) => {
    setLoading(true);
    const [rows, briefRows] = await Promise.all([fetchDeals(), fetchVaDailyBriefs(8)]);
    const activeRows = rows.filter(deal =>
      !["closed", "active-project", "stabilized", "sold"].includes(deal.status)
      && (!memberName || deal.created_by === memberName || deal.submitted_by === memberName || deal.assigned_to === memberName)
    );
    setDeals(activeRows);
    setBriefs(briefRows);
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

  if (!user) return null;

  const startNew = () => {
    setSelectedId(null);
    setChecklist([]);
    setAttachments([]);
    setDraft(EMPTY_DRAFT);
    setAttachmentDraft(EMPTY_ATTACHMENT());
    setMessage("");
  };

  const saveDeal = async (status: DealStatus) => {
    if (!draft.title.trim()) { setMessage("Add a deal title before saving."); return; }
    setSaving(true);
    setMessage("");
    const payload = buildPayload(draft, status);
    payload.submitted_by = payload.submitted_by || user;
    payload.assigned_to = payload.assigned_to || user;
    const result = selected
      ? await updateDeal(selected.id, payload, user)
      : await createDeal(payload, user);
    setSaving(false);
    if (result.error && !result.data) { setMessage(result.error); return; }
    if (!result.data) { setMessage("Deal could not be saved."); return; }
    if (status === "under-review") {
      const errors = await notifyMembersForReview(result.data, user);
      if (errors.length) setMessage(`Deal submitted, but review notifications had an issue: ${errors[0]}`);
      else setMessage("Deal submitted for member review.");
    } else {
      setMessage("Draft saved.");
    }
    await reload();
    setSelectedId(result.data.id);
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

  const autofillBriefStats = () => {
    const date = briefDraft.work_date;
    const sameDay = (iso?: string | null) => !!iso && iso.slice(0, 10) === date;
    const ownDeals = deals.filter(deal => deal.created_by === user || deal.submitted_by === user || deal.assigned_to === user);
    setBriefDraft(prev => ({
      ...prev,
      leads_added: ownDeals.filter(deal => sameDay(deal.created_at)).length,
      leads_updated: ownDeals.filter(deal => sameDay(deal.updated_at)).length,
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
                  <p style={eyebrowSmall}>Generated diligence</p>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                    {selected ? `${cleared}/${checklist.length} cleared · ${blocked} blocked` : `${liveChecklist.length} items will be created when saved.`}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflow: "auto" }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  <button onClick={() => saveDeal(draft.status ?? "lead")} disabled={saving} style={{ ...secondaryButton, opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Saving..." : "Save Updates"}
                  </button>
                  <button onClick={() => saveDeal("lead")} disabled={saving} style={{ ...secondaryButton, opacity: saving ? 0.6 : 1 }}>
                    Save As Draft Lead
                  </button>
                  <button onClick={() => saveDeal("under-review")} disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}>
                    Submit For Member Review
                  </button>
                </div>
              </aside>
            </div>
          </section>

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
