"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProjects, type Project } from "@/lib/projects";
import {
  calculateScenario,
  createCalendarEvent,
  createDistribution,
  createReimbursement,
  createScenario,
  fetchCalendarEvents,
  fetchDistributions,
  fetchReimbursements,
  fetchScenarios,
  updateReimbursementStatus,
  type CalendarEvent,
  type DealScenario,
  type Distribution,
  type Reimbursement,
  type ReimbursementStatus,
} from "@/lib/governance";
import {
  fetchVaDailyBriefReviews,
  fetchVaDailyBriefs,
  upsertVaDailyBriefReview,
  type VaDailyBrief,
  type VaDailyBriefReview,
} from "@/lib/va-briefs";
import {
  approveVaPayPeriod,
  fetchVaTimeEntries,
  formatDuration,
  formatPayPeriod,
  summarizeVaPayPeriods,
  type VaTimeEntry,
} from "@/lib/va-time";
import {
  fetchLandLeadBatches,
  fetchImportedLandLeads,
  type ImportedLandLead,
  type LandLeadBatch,
} from "@/lib/land-leads";
import { isVaUser } from "@/lib/identity";

const DISPLAY_FONT = "var(--font-display)";

function money(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "$0";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "No date";
  try { return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}

function labelize(value: string): string {
  return value.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export default function OperationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [scenarios, setScenarios] = useState<DealScenario[]>([]);
  const [vaBriefs, setVaBriefs] = useState<VaDailyBrief[]>([]);
  const [vaBriefReviews, setVaBriefReviews] = useState<VaDailyBriefReview[]>([]);
  const [vaTimeEntries, setVaTimeEntries] = useState<VaTimeEntry[]>([]);
  const [approvingPeriod, setApprovingPeriod] = useState<string | null>(null);
  const [landLeadBatches, setLandLeadBatches] = useState<LandLeadBatch[]>([]);
  const [importedLeads, setImportedLeads] = useState<ImportedLandLead[]>([]);
  const [briefReviewNotes, setBriefReviewNotes] = useState<Record<string, string>>({});
  const [eventDraft, setEventDraft] = useState({ title: "", event_date: "", event_type: "deadline", assigned_to: "", notes: "", project_id: "" });
  const [reimbursementDraft, setReimbursementDraft] = useState({ member_name: "", amount: "", vendor: "", category: "Project", expense_date: "", receipt_url: "", notes: "", project_id: "" });
  const [distributionDraft, setDistributionDraft] = useState({ distribution_date: "", total_amount: "", reason: "", project_id: "" });
  const [scenarioDraft, setScenarioDraft] = useState({ name: "", strategy: "flip", purchase_price: "", rehab_or_site_cost: "", closing_costs: "", holding_costs: "", financing_costs: "", exit_value: "", expected_rent: "", notes: "", project_id: "" });

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    if (isVaUser(u)) { router.push("/va"); return; }
    setUser(u);
    setReimbursementDraft(prev => ({ ...prev, member_name: u }));
    void Promise.all([
      fetchProjects(),
      fetchCalendarEvents(),
      fetchReimbursements(),
      fetchDistributions(),
      fetchScenarios(),
      fetchVaDailyBriefs(12),
      fetchVaTimeEntries(120),
      fetchLandLeadBatches(12),
      fetchImportedLandLeads(250),
    ]).then(([projectRows, eventRows, reimbursementRows, distributionRows, scenarioRows, briefRows, timeRows, batchRows, leadRows]) => {
      setProjects(projectRows);
      setEvents(eventRows);
      setReimbursements(reimbursementRows);
      setDistributions(distributionRows);
      setScenarios(scenarioRows);
      setVaBriefs(briefRows);
      setVaTimeEntries(timeRows);
      setLandLeadBatches(batchRows);
      setImportedLeads(leadRows);
      void fetchVaDailyBriefReviews(briefRows.map(brief => brief.id)).then(setVaBriefReviews);
    });
  }, [router]);

  const leadReviewStats = useMemo(() => ({
    imported: importedLeads.length,
    interested: importedLeads.filter(lead => lead.status === "interested").length,
    converted: importedLeads.filter(lead => lead.status === "converted").length,
    duplicates: importedLeads.filter(lead => lead.duplicate_status && lead.duplicate_status !== "new").length,
    averageScore: importedLeads.length ? Math.round(importedLeads.reduce((sum, lead) => sum + (lead.lead_score ?? 0), 0) / importedLeads.length) : 0,
  }), [importedLeads]);

  const vaPayPeriods = useMemo(() => summarizeVaPayPeriods(vaTimeEntries), [vaTimeEntries]);
  const vaSubmittedHours = useMemo(() => vaTimeEntries.reduce((sum, entry) => sum + ((entry.status === "submitted" || entry.status === "approved") ? (entry.duration_minutes ?? 0) : 0), 0) / 60, [vaTimeEntries]);
  const vaSubmittedCost = useMemo(() => vaTimeEntries.reduce((sum, entry) => sum + ((entry.status === "submitted" || entry.status === "approved") ? Number(entry.cost_amount ?? 0) : 0), 0), [vaTimeEntries]);

  const scenarioPreview = useMemo(() => calculateScenario({
    purchase_price: toNumber(scenarioDraft.purchase_price),
    rehab_or_site_cost: toNumber(scenarioDraft.rehab_or_site_cost),
    closing_costs: toNumber(scenarioDraft.closing_costs),
    holding_costs: toNumber(scenarioDraft.holding_costs),
    financing_costs: toNumber(scenarioDraft.financing_costs),
    exit_value: toNumber(scenarioDraft.exit_value),
  }), [scenarioDraft]);

  const approvePeriod = async (periodKey: string) => {
    if (!user) return;
    const period = vaPayPeriods.find(row => `${row.operatorName}:${row.periodStart}` === periodKey);
    if (!period) return;
    setApprovingPeriod(periodKey);
    const { error } = await approveVaPayPeriod(period, user);
    setApprovingPeriod(null);
    if (error) { alert(error); return; }
    setVaTimeEntries(await fetchVaTimeEntries(120));
  };

  if (!user) return null;

  const addEvent = async () => {
    if (!eventDraft.title.trim() || !eventDraft.event_date) return;
    const { data, error } = await createCalendarEvent({
      title: eventDraft.title,
      event_date: eventDraft.event_date,
      event_type: eventDraft.event_type,
      assigned_to: eventDraft.assigned_to || null,
      notes: eventDraft.notes || null,
      project_id: eventDraft.project_id || null,
    }, user);
    if (error) { alert(error); return; }
    if (data) setEvents(prev => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    setEventDraft({ title: "", event_date: "", event_type: "deadline", assigned_to: "", notes: "", project_id: "" });
  };

  const addReimbursement = async () => {
    const amount = toNumber(reimbursementDraft.amount);
    if (!reimbursementDraft.member_name.trim() || !amount) return;
    const { data, error } = await createReimbursement({
      member_name: reimbursementDraft.member_name,
      amount,
      vendor: reimbursementDraft.vendor,
      category: reimbursementDraft.category,
      expense_date: reimbursementDraft.expense_date || null,
      receipt_url: reimbursementDraft.receipt_url,
      notes: reimbursementDraft.notes,
      project_id: reimbursementDraft.project_id || null,
    }, user);
    if (error) { alert(error); return; }
    if (data) setReimbursements(prev => [data, ...prev]);
    setReimbursementDraft({ member_name: user, amount: "", vendor: "", category: "Project", expense_date: "", receipt_url: "", notes: "", project_id: "" });
  };

  const setReimbursementStatus = async (item: Reimbursement, status: ReimbursementStatus) => {
    const { error } = await updateReimbursementStatus(item.id, status, user);
    if (error) { alert(error); return; }
    setReimbursements(prev => prev.map(r => r.id === item.id ? { ...r, status, reviewed_by: user, reviewed_at: new Date().toISOString() } : r));
  };

  const addDistribution = async () => {
    const total = toNumber(distributionDraft.total_amount);
    if (!distributionDraft.distribution_date || !total) return;
    const { data, error } = await createDistribution({
      distribution_date: distributionDraft.distribution_date,
      total_amount: total,
      reason: distributionDraft.reason,
      project_id: distributionDraft.project_id || null,
    }, user);
    if (error) { alert(error); return; }
    if (data) setDistributions(prev => [data, ...prev]);
    setDistributionDraft({ distribution_date: "", total_amount: "", reason: "", project_id: "" });
  };

  const addScenario = async () => {
    if (!scenarioDraft.name.trim()) return;
    const { data, error } = await createScenario({
      name: scenarioDraft.name,
      strategy: scenarioDraft.strategy,
      project_id: scenarioDraft.project_id || null,
      purchase_price: toNumber(scenarioDraft.purchase_price),
      rehab_or_site_cost: toNumber(scenarioDraft.rehab_or_site_cost),
      closing_costs: toNumber(scenarioDraft.closing_costs),
      holding_costs: toNumber(scenarioDraft.holding_costs),
      financing_costs: toNumber(scenarioDraft.financing_costs),
      exit_value: toNumber(scenarioDraft.exit_value),
      expected_rent: toNumber(scenarioDraft.expected_rent),
      notes: scenarioDraft.notes,
    }, user);
    if (error) { alert(error); return; }
    if (data) setScenarios(prev => [data, ...prev]);
    setScenarioDraft({ name: "", strategy: "flip", purchase_price: "", rehab_or_site_cost: "", closing_costs: "", holding_costs: "", financing_costs: "", exit_value: "", expected_rent: "", notes: "", project_id: "" });
  };

  const pendingReimbursements = reimbursements.filter(r => r.status === "submitted" || r.status === "approved");

  const reviewBrief = async (brief: VaDailyBrief) => {
    const { data, error } = await upsertVaDailyBriefReview(brief.id, user, briefReviewNotes[brief.id] ?? "");
    if (error) { alert(error); return; }
    if (data) {
      setVaBriefReviews(prev => [data, ...prev.filter(review => !(review.brief_id === brief.id && review.member_name === user))]);
      setVaBriefs(prev => prev.map(row => row.id === brief.id ? {
        ...row,
        reviewed_status: "reviewed",
        reviewed_by: user,
        reviewed_at: data.reviewed_at,
        review_note: data.note,
      } : row));
      setBriefReviewNotes(prev => ({ ...prev, [brief.id]: "" }));
    }
  };

  return (
    <div className="operations-root" style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 20px 100px" }}>
      <header style={{ marginBottom: 24 }}>
        <p style={eyebrow}>Company Operations</p>
        <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 50px)", fontWeight: 500, color: "var(--obsidian)", marginBottom: 6 }}>
          Governance & finance
        </h1>
        <p style={{ color: "var(--ink)", opacity: 0.66, fontSize: 14, maxWidth: 760 }}>
          Calendar, reimbursements, distributions, and deal scenarios. This is the operating layer around projects and decisions.
        </p>
        <p style={comingSoonPill}>Bank sync + receipt file upload coming soon</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }} className="stat-grid">
        <Stat label="Calendar items" value={String(events.length)} />
        <Stat label="Pending reimbursements" value={String(pendingReimbursements.length)} />
        <Stat label="Distributions" value={String(distributions.length)} />
        <Stat label="Scenarios" value={String(scenarios.length)} />
        <Stat label="VA briefs" value={String(vaBriefs.length)} />
      </div>

      <section style={{ ...panel, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <p style={eyebrow}>VA Accountability</p>
            <h2 style={sectionTitle}>Biweekly time and daily briefs</h2>
          </div>
          <span style={comingSoonPill}>Biweekly payroll</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }} className="stat-grid">
          <MiniStat label="Submitted VA hours" value={`${vaSubmittedHours.toFixed(2)} hrs`} />
          <MiniStat label="Submitted VA cost" value={money(vaSubmittedCost)} />
          <MiniStat label="Pay periods" value={String(vaPayPeriods.length)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 18 }} className="brief-grid">
          {vaPayPeriods.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No VA time entries have been submitted yet.</p>}
          {vaPayPeriods.slice(0, 4).map(period => {
            const periodKey = `${period.operatorName}:${period.periodStart}`;
            const canApprove = !period.open && !period.approved && period.totalCost > 0;
            return (
              <article key={periodKey} style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <p style={rowTitle}>{formatPayPeriod(period)}</p>
                    <p style={rowMeta}>{period.operatorName} · {period.entries.length} shift{period.entries.length === 1 ? "" : "s"}</p>
                  </div>
                  <span style={smallPill}>{period.approved ? "Approved" : period.open ? "Open" : "Submitted"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <MiniStat label="Hours" value={period.totalHours.toFixed(2)} />
                  <MiniStat label="Cost" value={money(period.totalCost)} />
                </div>
                <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                  {period.entries.slice(0, 4).map(entry => (
                    <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "var(--ink)" }}>
                      <span>{fmtDate(entry.clock_in_at)}{entry.clock_out_at ? ` - ${fmtDate(entry.clock_out_at)}` : " - active"}</span>
                      <span>{formatDuration(entry.duration_minutes ?? 0)} · {money(Number(entry.cost_amount ?? 0))}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => approvePeriod(periodKey)}
                  disabled={!canApprove || approvingPeriod === periodKey}
                  style={{ ...primaryButton, opacity: !canApprove || approvingPeriod === periodKey ? 0.55 : 1, cursor: !canApprove ? "not-allowed" : "pointer" }}
                >
                  {period.approved ? "Synced to Expenses" : approvingPeriod === periodKey ? "Approving..." : "Approve + Sync Expense"}
                </button>
              </article>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <p style={eyebrow}>End-of-shift reports</p>
            <h3 style={{ ...sectionTitle, fontSize: 24 }}>Daily briefs</h3>
          </div>
          <span style={comingSoonPill}>Member review</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="brief-grid">
          {vaBriefs.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No VA daily briefs have been submitted yet.</p>}
          {vaBriefs.map(brief => (
            <article key={brief.id} style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                <div>
                  <p style={rowTitle}>{fmtDate(brief.work_date)}</p>
                  <p style={rowMeta}>{brief.submitted_by} · {brief.hours_worked ?? 0} hrs</p>
                </div>
                <span style={smallPill}>{vaBriefReviews.filter(review => review.brief_id === brief.id).length} reviewed</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <MiniStat label="Leads" value={`${brief.leads_added ?? 0} new / ${brief.leads_updated ?? 0} updated`} />
                <MiniStat label="Outreach" value={`${brief.outreach_sent ?? 0} sent`} />
                <MiniStat label="Replies" value={`${brief.seller_replies ?? 0}`} />
                <MiniStat label="Calls" value={`${brief.calls_completed ?? 0}`} />
              </div>
              <p style={briefLabel}>Completed</p>
              <p style={briefText}>{brief.activities_completed}</p>
              {brief.follow_ups_needed && (
                <>
                  <p style={briefLabel}>Follow-ups</p>
                  <p style={briefText}>{brief.follow_ups_needed}</p>
                </>
              )}
              {brief.blockers && (
                <>
                  <p style={briefLabel}>Blockers</p>
                  <p style={briefText}>{brief.blockers}</p>
                </>
              )}
              {brief.tomorrow_plan && (
                <>
                  <p style={briefLabel}>Next shift</p>
                  <p style={briefText}>{brief.tomorrow_plan}</p>
                </>
              )}
              <div style={{ borderTop: "1px solid var(--fog)", marginTop: 12, paddingTop: 10 }}>
                <p style={briefLabel}>Member review</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {vaBriefReviews.filter(review => review.brief_id === brief.id).map(review => (
                    <span key={review.id} style={smallPill}>{review.member_name}</span>
                  ))}
                  {vaBriefReviews.filter(review => review.brief_id === brief.id).length === 0 && (
                    <span style={rowMeta}>No member review yet</span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={briefReviewNotes[brief.id] ?? ""}
                  onChange={e => setBriefReviewNotes(prev => ({ ...prev, [brief.id]: e.target.value }))}
                  placeholder="Optional review note"
                />
                <button onClick={() => reviewBrief(brief)} style={{ ...primaryButton, marginTop: 8 }}>Mark Reviewed</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...panel, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <p style={eyebrow}>Imported Land Lists</p>
            <h2 style={sectionTitle}>VA lead progress</h2>
          </div>
          <span style={comingSoonPill}>Member review</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }} className="stat-grid">
          <MiniStat label="Imported" value={String(leadReviewStats.imported)} />
          <MiniStat label="Interested" value={String(leadReviewStats.interested)} />
          <MiniStat label="Converted" value={String(leadReviewStats.converted)} />
          <MiniStat label="Duplicates" value={String(leadReviewStats.duplicates)} />
          <MiniStat label="Avg score" value={String(leadReviewStats.averageScore)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)", gap: 12 }} className="brief-grid">
          <div>
            <p style={briefLabel}>Recent batches</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {landLeadBatches.slice(0, 5).map(batch => (
                <div key={batch.id} style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 10 }}>
                  <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{batch.campaign_source || batch.original_filename || batch.source_system}</strong>
                  <p style={rowMeta}>{batch.row_count} rows · {labelize(batch.status || "not-started")} · {batch.assigned_to || batch.uploaded_by || "Unassigned"}</p>
                </div>
              ))}
              {landLeadBatches.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No imported land batches yet.</p>}
            </div>
          </div>
          <div>
            <p style={briefLabel}>Interested sellers</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {importedLeads.filter(lead => lead.status === "interested").slice(0, 6).map(lead => (
                <div key={lead.id} style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong style={{ color: "var(--obsidian)", fontSize: 13 }}>{lead.owner_name || "Owner unknown"}</strong>
                    <span style={smallPill}>Score {lead.lead_score ?? 0}</span>
                  </div>
                  <p style={rowMeta}>{lead.property_address || lead.parcel_id || "No address"} · {lead.phone || lead.phone_2 || "No phone"}</p>
                  <p style={rowMeta}>{lead.last_activity_type ? `Last touch: ${labelize(lead.last_activity_type)}` : "No outreach logged"}{lead.deal_id ? " · Deal packet created" : ""}</p>
                </div>
              ))}
              {importedLeads.filter(lead => lead.status === "interested").length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No interested imported sellers yet.</p>}
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="ops-grid">
        <section style={panel}>
          <h2 style={sectionTitle}>Operating calendar</h2>
          <div style={twoCol}>
            <input placeholder="Title" value={eventDraft.title} onChange={e => setEventDraft({ ...eventDraft, title: e.target.value })} />
            <input type="date" value={eventDraft.event_date} onChange={e => setEventDraft({ ...eventDraft, event_date: e.target.value })} />
          </div>
          <div style={{ ...twoCol, marginTop: 10 }}>
            <input placeholder="Type: vote, closing, inspection..." value={eventDraft.event_type} onChange={e => setEventDraft({ ...eventDraft, event_type: e.target.value })} />
            <ProjectSelect projects={projects} value={eventDraft.project_id} onChange={project_id => setEventDraft({ ...eventDraft, project_id })} />
          </div>
          <input style={{ marginTop: 10 }} placeholder="Notes" value={eventDraft.notes} onChange={e => setEventDraft({ ...eventDraft, notes: e.target.value })} />
          <button onClick={addEvent} style={{ ...primaryButton, marginTop: 10 }}>Add Event</button>
          <ListShell empty="No calendar events yet.">
            {events.slice(0, 6).map(event => (
              <Row key={event.id} title={event.title} meta={`${fmtDate(event.event_date)} · ${labelize(event.event_type)}`} detail={event.notes} />
            ))}
          </ListShell>
        </section>

        <section style={panel}>
          <h2 style={sectionTitle}>Reimbursements</h2>
          <div style={twoCol}>
            <input placeholder="Member" value={reimbursementDraft.member_name} onChange={e => setReimbursementDraft({ ...reimbursementDraft, member_name: e.target.value })} />
            <input placeholder="Amount" value={reimbursementDraft.amount} onChange={e => setReimbursementDraft({ ...reimbursementDraft, amount: e.target.value })} />
          </div>
          <div style={{ ...twoCol, marginTop: 10 }}>
            <input placeholder="Vendor" value={reimbursementDraft.vendor} onChange={e => setReimbursementDraft({ ...reimbursementDraft, vendor: e.target.value })} />
            <input placeholder="Category" value={reimbursementDraft.category} onChange={e => setReimbursementDraft({ ...reimbursementDraft, category: e.target.value })} />
          </div>
          <div style={{ ...twoCol, marginTop: 10 }}>
            <input type="date" value={reimbursementDraft.expense_date} onChange={e => setReimbursementDraft({ ...reimbursementDraft, expense_date: e.target.value })} />
            <ProjectSelect projects={projects} value={reimbursementDraft.project_id} onChange={project_id => setReimbursementDraft({ ...reimbursementDraft, project_id })} />
          </div>
          <input style={{ marginTop: 10 }} placeholder="Receipt URL / notes" value={reimbursementDraft.receipt_url || reimbursementDraft.notes} onChange={e => setReimbursementDraft({ ...reimbursementDraft, notes: e.target.value })} />
          <button onClick={addReimbursement} style={{ ...primaryButton, marginTop: 10 }}>Submit</button>
          <ListShell empty="No reimbursements yet.">
            {reimbursements.slice(0, 6).map(item => (
              <div key={item.id} style={rowStyle}>
                <div>
                  <p style={rowTitle}>{item.member_name} · {money(item.amount)}</p>
                  <p style={rowMeta}>{labelize(item.status)} · {item.vendor || item.category}</p>
                </div>
                <select value={item.status} onChange={e => setReimbursementStatus(item, e.target.value as ReimbursementStatus)} style={{ maxWidth: 130 }}>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            ))}
          </ListShell>
        </section>

        <section style={panel}>
          <h2 style={sectionTitle}>Scenario modeling</h2>
          <div style={twoCol}>
            <input placeholder="Scenario name" value={scenarioDraft.name} onChange={e => setScenarioDraft({ ...scenarioDraft, name: e.target.value })} />
            <input placeholder="Strategy" value={scenarioDraft.strategy} onChange={e => setScenarioDraft({ ...scenarioDraft, strategy: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }} className="three-col">
            <input placeholder="Purchase" value={scenarioDraft.purchase_price} onChange={e => setScenarioDraft({ ...scenarioDraft, purchase_price: e.target.value })} />
            <input placeholder="Rehab/site" value={scenarioDraft.rehab_or_site_cost} onChange={e => setScenarioDraft({ ...scenarioDraft, rehab_or_site_cost: e.target.value })} />
            <input placeholder="Exit value" value={scenarioDraft.exit_value} onChange={e => setScenarioDraft({ ...scenarioDraft, exit_value: e.target.value })} />
            <input placeholder="Closing" value={scenarioDraft.closing_costs} onChange={e => setScenarioDraft({ ...scenarioDraft, closing_costs: e.target.value })} />
            <input placeholder="Holding" value={scenarioDraft.holding_costs} onChange={e => setScenarioDraft({ ...scenarioDraft, holding_costs: e.target.value })} />
            <input placeholder="Financing" value={scenarioDraft.financing_costs} onChange={e => setScenarioDraft({ ...scenarioDraft, financing_costs: e.target.value })} />
          </div>
          <div style={{ ...twoCol, marginTop: 10 }}>
            <ProjectSelect projects={projects} value={scenarioDraft.project_id} onChange={project_id => setScenarioDraft({ ...scenarioDraft, project_id })} />
            <div style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 10 }}>
              <p style={rowMeta}>Projected profit</p>
              <p style={rowTitle}>{money(scenarioPreview.projected_profit)} · {scenarioPreview.roi_percent === null ? "ROI —" : `${Math.round(scenarioPreview.roi_percent)}% ROI`}</p>
            </div>
          </div>
          <button onClick={addScenario} style={{ ...primaryButton, marginTop: 10 }}>Save Scenario</button>
          <ListShell empty="No scenarios yet.">
            {scenarios.slice(0, 6).map(s => (
              <Row key={s.id} title={s.name} meta={`${s.strategy} · ${money(s.projected_profit)} · ${s.roi_percent === null ? "ROI —" : `${Math.round(s.roi_percent)}% ROI`}`} detail={s.notes} />
            ))}
          </ListShell>
        </section>

        <section style={panel}>
          <h2 style={sectionTitle}>Distributions</h2>
          <div style={twoCol}>
            <input type="date" value={distributionDraft.distribution_date} onChange={e => setDistributionDraft({ ...distributionDraft, distribution_date: e.target.value })} />
            <input placeholder="Total amount" value={distributionDraft.total_amount} onChange={e => setDistributionDraft({ ...distributionDraft, total_amount: e.target.value })} />
          </div>
          <div style={{ ...twoCol, marginTop: 10 }}>
            <input placeholder="Reason" value={distributionDraft.reason} onChange={e => setDistributionDraft({ ...distributionDraft, reason: e.target.value })} />
            <ProjectSelect projects={projects} value={distributionDraft.project_id} onChange={project_id => setDistributionDraft({ ...distributionDraft, project_id })} />
          </div>
          <button onClick={addDistribution} style={{ ...primaryButton, marginTop: 10 }}>Propose Distribution</button>
          <ListShell empty="No distributions yet.">
            {distributions.slice(0, 6).map(d => (
              <Row key={d.id} title={`${money(d.total_amount)} distribution`} meta={`${fmtDate(d.distribution_date)} · ${labelize(d.status)} · ${money(d.per_member_amount)} / member`} detail={d.reason} />
            ))}
          </ListShell>
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .ops-grid, .brief-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 680px) {
          .operations-root { padding-top: 28px !important; }
          .stat-grid,
          .three-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function ProjectSelect({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">No project</option>
      {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
      <p style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: "var(--obsidian)" }}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 6, padding: 8 }}>
      <p style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--obsidian)" }}>{value}</p>
    </div>
  );
}

function ListShell({ empty, children }: { empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {hasChildren ? children : <p style={{ color: "var(--muted)", fontSize: 13 }}>{empty}</p>}
    </div>
  );
}

function Row({ title, meta, detail }: { title: string; meta: string; detail?: string | null }) {
  return (
    <div style={rowStyle}>
      <div>
        <p style={rowTitle}>{title}</p>
        <p style={rowMeta}>{meta}</p>
        {detail && <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.68 }}>{detail}</p>}
      </div>
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

const sectionTitle: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  color: "var(--obsidian)",
  fontSize: 24,
  fontWeight: 500,
  marginBottom: 10,
};

const panel: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 12,
  padding: 18,
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

const smallPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fog)",
  borderRadius: 999,
  color: "var(--muted)",
  padding: "3px 7px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const rowStyle: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const rowTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--obsidian)",
};

const rowMeta: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
};

const briefLabel: React.CSSProperties = {
  fontSize: 10,
  color: "var(--muted)",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginTop: 10,
  marginBottom: 3,
};

const briefText: React.CSSProperties = {
  fontSize: 12,
  color: "var(--ink)",
  opacity: 0.74,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
};
