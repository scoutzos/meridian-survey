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
  fetchVaTimeChangeRequests,
  formatVaDateTime,
  formatDuration,
  formatPayPeriod,
  fromVaDateTimeInput,
  reviewVaTimeChangeRequest,
  summarizeVaPayPeriods,
  toVaDateTimeInput,
  updateVaTimeEntry,
  voidVaTimeEntry,
  type VaTimeEntry,
  type VaTimeChangeRequest,
} from "@/lib/va-time";
import {
  fetchLandLeadBatches,
  fetchImportedLandLeads,
  type ImportedLandLead,
  type LandLeadBatch,
} from "@/lib/land-leads";
import {
  VA_ASSIGNEE_LABEL,
  addActionItemComment,
  fetchActionItemEvents,
  fetchActionItems,
  isVaTask,
  updateActionItemStatus,
  type ActionItem,
  type ActionItemEvent,
} from "@/lib/action-items";
import { isVaUser } from "@/lib/identity";
import { createNotification } from "@/lib/operations";

const DISPLAY_FONT = "var(--font-display)";

type OperationsTab = "overview" | "escalations" | "va-briefs" | "time" | "lead-ops" | "finance" | "calendar" | "scenarios";

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
  try {
    const value = iso.includes("T") ? iso : `${iso}T00:00:00`;
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  catch { return iso; }
}

function fmtDateTime(iso: string | null): string {
  return formatVaDateTime(iso);
}

function addMinutesToInput(value: string, minutes: number): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]) + minutes));
  return date.toISOString().slice(0, 16);
}

function fallbackShiftStart(entry: VaTimeEntry): string {
  return toVaDateTimeInput(entry.clock_in_at) || `${entry.pay_period_start}T09:00`;
}

function fallbackShiftEnd(entry: VaTimeEntry, start: string): string {
  return toVaDateTimeInput(entry.clock_out_at) || addMinutesToInput(start, entry.duration_minutes ?? 60) || `${entry.pay_period_start}T10:00`;
}

function labelize(value: string): string {
  return value.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function actionHref(item: ActionItem): string {
  if (item.source_table === "meridian_deals" && item.source_id) return `/opportunity?deal=${item.source_id}`;
  if (item.source_table === "meridian_imported_land_leads" && item.source_id) return `/opportunity?lead=${item.source_id}`;
  if (item.source_table === "meridian_projects" && item.source_id) return "/projects";
  if (item.source_table === "meeting_notes" && item.source_id) return "/meetings";
  return "/actions";
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
  const [vaTimeChangeRequests, setVaTimeChangeRequests] = useState<VaTimeChangeRequest[]>([]);
  const [approvingPeriod, setApprovingPeriod] = useState<string | null>(null);
  const [reviewingTimeRequest, setReviewingTimeRequest] = useState<string | null>(null);
  const [timeRequestNotes, setTimeRequestNotes] = useState<Record<string, string>>({});
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftEditDraft, setShiftEditDraft] = useState({ clockIn: "", clockOut: "", notes: "" });
  const [savingShiftEdit, setSavingShiftEdit] = useState(false);
  const [landLeadBatches, setLandLeadBatches] = useState<LandLeadBatch[]>([]);
  const [importedLeads, setImportedLeads] = useState<ImportedLandLead[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionItemEvents, setActionItemEvents] = useState<ActionItemEvent[]>([]);
  const [escalationResponses, setEscalationResponses] = useState<Record<string, string>>({});
  const [briefReviewNotes, setBriefReviewNotes] = useState<Record<string, string>>({});
  const [eventDraft, setEventDraft] = useState({ title: "", event_date: "", event_type: "deadline", assigned_to: "", notes: "", project_id: "" });
  const [reimbursementDraft, setReimbursementDraft] = useState({ member_name: "", amount: "", vendor: "", category: "Project", expense_date: "", receipt_url: "", notes: "", project_id: "" });
  const [distributionDraft, setDistributionDraft] = useState({ distribution_date: "", total_amount: "", reason: "", project_id: "" });
  const [scenarioDraft, setScenarioDraft] = useState({ name: "", strategy: "flip", purchase_price: "", rehab_or_site_cost: "", closing_costs: "", holding_costs: "", financing_costs: "", exit_value: "", expected_rent: "", notes: "", project_id: "" });
  const [activeTab, setActiveTab] = useState<OperationsTab>("overview");

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
      fetchVaTimeChangeRequests(100),
      fetchLandLeadBatches(12),
      fetchImportedLandLeads(250),
      fetchActionItems(),
    ]).then(([projectRows, eventRows, reimbursementRows, distributionRows, scenarioRows, briefRows, timeRows, timeRequestRows, batchRows, leadRows, actionRows]) => {
      setProjects(projectRows);
      setEvents(eventRows);
      setReimbursements(reimbursementRows);
      setDistributions(distributionRows);
      setScenarios(scenarioRows);
      setVaBriefs(briefRows);
      setVaTimeEntries(timeRows);
      setVaTimeChangeRequests(timeRequestRows);
      setLandLeadBatches(batchRows);
      setImportedLeads(leadRows);
      setActionItems(actionRows);
      void fetchActionItemEvents(actionRows.map(item => item.id)).then(setActionItemEvents);
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
  const pendingTimeRequests = useMemo(() => vaTimeChangeRequests.filter(request => request.status === "pending"), [vaTimeChangeRequests]);
  const blockedVaTasks = useMemo(() => actionItems.filter(item => isVaTask(item) && item.status === "blocked"), [actionItems]);
  const actionItemEventsById = useMemo(() => {
    const out: Record<string, ActionItemEvent[]> = {};
    for (const event of actionItemEvents) {
      out[event.action_item_id] = [...(out[event.action_item_id] ?? []), event];
    }
    return out;
  }, [actionItemEvents]);

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

  const reviewTimeRequest = async (request: VaTimeChangeRequest, decision: "approved" | "rejected") => {
    if (!user) return;
    setReviewingTimeRequest(request.id);
    const { error } = await reviewVaTimeChangeRequest(request, decision, user, timeRequestNotes[request.id] ?? "");
    setReviewingTimeRequest(null);
    if (error) { alert(error); return; }
    const [timeRows, requestRows] = await Promise.all([fetchVaTimeEntries(120), fetchVaTimeChangeRequests(100)]);
    setVaTimeEntries(timeRows);
    setVaTimeChangeRequests(requestRows);
    setTimeRequestNotes(prev => ({ ...prev, [request.id]: "" }));
  };

  const startShiftEdit = (entry: VaTimeEntry) => {
    const clockIn = fallbackShiftStart(entry);
    setEditingShiftId(entry.id);
    setShiftEditDraft({
      clockIn,
      clockOut: fallbackShiftEnd(entry, clockIn),
      notes: entry.notes ?? "",
    });
  };

  const saveShiftEdit = async () => {
    if (!user || !editingShiftId) return;
    const clockInAt = fromVaDateTimeInput(shiftEditDraft.clockIn);
    const clockOutAt = fromVaDateTimeInput(shiftEditDraft.clockOut);
    if (!clockInAt || !clockOutAt) { alert("Clock in and clock out are required."); return; }
    setSavingShiftEdit(true);
    const { error } = await updateVaTimeEntry({
      entryId: editingShiftId,
      clockInAt,
      clockOutAt,
      notes: shiftEditDraft.notes,
      actor: user,
    });
    setSavingShiftEdit(false);
    if (error) { alert(error); return; }
    setEditingShiftId(null);
    setVaTimeEntries(await fetchVaTimeEntries(120));
    alert("Shift updated.");
  };

  const voidShift = async (entry: VaTimeEntry) => {
    if (!user) return;
    if (!confirm("Void this VA shift? This removes it from submitted pay-period totals.")) return;
    const { error } = await voidVaTimeEntry(entry.id);
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

  const sendEscalationResponse = async (task: ActionItem) => {
    if (!user) return;
    const note = (escalationResponses[task.id] || "").trim();
    if (!note) return;
    const { error } = await addActionItemComment(task.id, user, note);
    if (error) { alert(error); return; }
    const reopenResult = task.status === "blocked"
      ? await updateActionItemStatus(task.id, "open", user, "Member responded to blocker.")
      : { error: null };
    if (reopenResult.error) { alert(reopenResult.error); return; }
    const now = new Date().toISOString();
    setActionItemEvents(prev => [
      ...prev,
      {
        id: `local-comment-${task.id}-${now}`,
        action_item_id: task.id,
        event_type: "comment",
        previous_status: null,
        next_status: null,
        note,
        created_by: user,
        created_at: now,
      },
      ...(task.status === "blocked" ? [{
        id: `local-reopened-${task.id}-${now}`,
        action_item_id: task.id,
        event_type: "reopened" as const,
        previous_status: "blocked" as const,
        next_status: "open" as const,
        note: "Member responded to blocker.",
        created_by: user,
        created_at: now,
      }] : []),
    ]);
    setActionItems(prev => prev.map(item => item.id === task.id ? {
      ...item,
      status: task.status === "blocked" ? "open" : item.status,
      blocker_reason: task.status === "blocked" ? null : item.blocker_reason,
      updated_at: now,
      updated_by: user,
    } : item));
    setEscalationResponses(prev => ({ ...prev, [task.id]: "" }));
    await createNotification({
      title: `Blocked task reopened: ${task.title}`,
      body: `${note}\n\nThe task was reopened and is ready to continue.`,
      priority: "high",
      assigned_to: task.assigned_to || VA_ASSIGNEE_LABEL,
      href: "/va",
      source_table: "action_items",
      source_id: task.id,
      notification_type: "va-task-member-response",
      dedupe: true,
    }, user);
  };

  const pendingReimbursements = reimbursements.filter(r => r.status === "submitted" || r.status === "approved");
  const unreviewedBriefs = vaBriefs.filter(brief => !vaBriefReviews.some(review => review.brief_id === brief.id && review.member_name === user));
  const activeFinanceItems = pendingReimbursements.length + distributions.filter(distribution => distribution.status !== "paid").length;
  const operationTabs: { id: OperationsTab; label: string; count: number }[] = [
    { id: "overview", label: "Overview", count: pendingTimeRequests.length + unreviewedBriefs.length + pendingReimbursements.length + blockedVaTasks.length },
    { id: "escalations", label: "Escalations", count: blockedVaTasks.length },
    { id: "va-briefs", label: "VA Briefs", count: unreviewedBriefs.length },
    { id: "time", label: "Time Approval", count: pendingTimeRequests.length },
    { id: "lead-ops", label: "Lead Ops", count: leadReviewStats.interested },
    { id: "finance", label: "Money", count: activeFinanceItems },
    { id: "calendar", label: "Calendar", count: events.length },
    { id: "scenarios", label: "Scenarios", count: scenarios.length },
  ];

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
        <p style={eyebrow}>Member Portal</p>
        <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 50px)", fontWeight: 500, color: "var(--obsidian)", marginBottom: 6 }}>
          Operations
        </h1>
        <p style={{ color: "var(--ink)", opacity: 0.66, fontSize: 14, maxWidth: 760 }}>
          Review VA accountability, imported lead progress, reimbursements, operating dates, and scenario work from one member workspace.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }} className="stat-grid">
        <Stat label="Calendar items" value={String(events.length)} />
        <Stat label="Pending reimbursements" value={String(pendingReimbursements.length)} />
        <Stat label="Distributions" value={String(distributions.length)} />
        <Stat label="Scenarios" value={String(scenarios.length)} />
        <Stat label="VA briefs" value={String(vaBriefs.length)} />
      </div>

      <nav className="operations-tabs" aria-label="Operations sections">
        {operationTabs.map(tab => (
          <OperationsTabButton
            key={tab.id}
            label={tab.label}
            count={tab.count}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </nav>

      {(activeTab === "overview" || activeTab === "escalations") && (
        <section style={{ ...panel, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <p style={eyebrow}>Escalations</p>
              <h2 style={sectionTitle}>Blocked VA work</h2>
              <p style={briefText}>Tasks marked blocked by the VA so members can make a decision, provide missing information, or reassign the work.</p>
            </div>
            <span style={blockedVaTasks.length ? warningPill : comingSoonPill}>{blockedVaTasks.length ? `${blockedVaTasks.length} needs decision` : "Clear"}</span>
          </div>
          {blockedVaTasks.length === 0 ? (
            <div style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 14 }}>
              <p style={rowTitle}>No blocked VA tasks right now.</p>
              <p style={rowMeta}>When Sophie marks a task blocked, it will appear here and notify members.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {blockedVaTasks.map(task => (
                <article key={task.id} style={{ background: "var(--bone)", border: "1px solid rgba(176,137,84,0.45)", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 8 }}>
                    <div>
                      <p style={rowTitle}>{task.title}</p>
                      <p style={rowMeta}>{task.assigned_to || "VA"} · assigned by {task.created_by || "Unknown"}{task.due_date ? ` · due ${task.due_date}` : ""}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button onClick={() => router.push("/actions")} style={{ ...primaryButton, background: "transparent", border: "1px solid var(--fog)", color: "var(--obsidian)" }}>Open Task</button>
                      <button onClick={() => router.push(actionHref(task))} style={primaryButton}>Open Record</button>
                    </div>
                  </div>
                  <p style={{ ...briefText, marginBottom: 8 }}>{task.blocker_reason || task.description || "No blocker reason added."}</p>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {(actionItemEventsById[task.id] ?? []).filter(event => event.event_type === "comment").slice(-3).map(event => (
                      <div key={event.id} style={{ background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 8, padding: 10 }}>
                        <p style={rowMeta}>{event.created_by || "Member"} · {fmtDateTime(event.created_at)}</p>
                        <p style={{ ...briefText, marginTop: 4 }}>{event.note}</p>
                      </div>
                    ))}
                    <textarea
                      value={escalationResponses[task.id] || ""}
                      onChange={e => setEscalationResponses(prev => ({ ...prev, [task.id]: e.target.value }))}
                      placeholder="Reply with the decision, missing detail, or next instruction for Sophie..."
                      style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <p style={rowMeta}>Response is saved to task history, reopens the task, and notifies the VA.</p>
                      <button onClick={() => sendEscalationResponse(task)} disabled={!escalationResponses[task.id]?.trim()} style={primaryButton}>Send + Reopen</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {(activeTab === "overview" || activeTab === "time" || activeTab === "va-briefs") && (
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
          <MiniStat label="Time edits pending" value={String(pendingTimeRequests.length)} />
        </div>
        {(activeTab === "overview" || activeTab === "time") && pendingTimeRequests.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 18 }} className="brief-grid">
            {pendingTimeRequests.map(request => (
              <article key={request.id} style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                  <div>
                    <p style={rowTitle}>{labelize(request.request_type)}</p>
                    <p style={rowMeta}>{request.operator_name} · requested {fmtDate(request.created_at)}</p>
                  </div>
                  <span style={smallPill}>Pending</span>
                </div>
                <p style={briefLabel}>Requested time</p>
                <p style={briefText}>
                  {request.request_type === "void-shift"
                    ? "Void/delete the selected shift"
                    : `${request.requested_clock_in_at ? fmtDateTime(request.requested_clock_in_at) : "No start"} - ${request.requested_clock_out_at ? fmtDateTime(request.requested_clock_out_at) : "No end"}`}
                </p>
                {request.requested_notes && (
                  <>
                    <p style={briefLabel}>Shift notes</p>
                    <p style={briefText}>{request.requested_notes}</p>
                  </>
                )}
                <p style={briefLabel}>Reason</p>
                <p style={briefText}>{request.reason}</p>
                <textarea
                  rows={2}
                  value={timeRequestNotes[request.id] ?? ""}
                  onChange={e => setTimeRequestNotes(prev => ({ ...prev, [request.id]: e.target.value }))}
                  placeholder="Optional review note"
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    onClick={() => reviewTimeRequest(request, "approved")}
                    disabled={reviewingTimeRequest === request.id}
                    style={{ ...primaryButton, opacity: reviewingTimeRequest === request.id ? 0.6 : 1 }}
                  >
                    Approve Correction
                  </button>
                  <button
                    onClick={() => reviewTimeRequest(request, "rejected")}
                    disabled={reviewingTimeRequest === request.id}
                    style={{
                      ...primaryButton,
                      background: "transparent",
                      border: "1px solid var(--fog)",
                      color: "var(--obsidian)",
                      opacity: reviewingTimeRequest === request.id ? 0.6 : 1,
                    }}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {(activeTab === "overview" || activeTab === "time") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: activeTab === "time" ? 0 : 18 }} className="brief-grid">
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
                    <div key={entry.id} style={{ border: "1px solid var(--fog)", borderRadius: 8, padding: 8, background: "rgba(255,255,255,0.48)" }}>
                      {editingShiftId === entry.id ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }} className="brief-grid">
                            <input type="datetime-local" value={shiftEditDraft.clockIn} onChange={e => setShiftEditDraft({ ...shiftEditDraft, clockIn: e.target.value })} />
                            <input type="datetime-local" value={shiftEditDraft.clockOut} onChange={e => setShiftEditDraft({ ...shiftEditDraft, clockOut: e.target.value })} />
                          </div>
                          <input value={shiftEditDraft.notes} onChange={e => setShiftEditDraft({ ...shiftEditDraft, notes: e.target.value })} placeholder="Shift note" />
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={saveShiftEdit} disabled={savingShiftEdit} style={{ ...primaryButton, opacity: savingShiftEdit ? 0.6 : 1 }}>
                              {savingShiftEdit ? "Saving..." : "Save Shift"}
                            </button>
                            <button
                              onClick={() => setEditingShiftId(null)}
                              style={{ ...primaryButton, background: "transparent", border: "1px solid var(--fog)", color: "var(--obsidian)" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "var(--ink)", flexWrap: "wrap" }}>
                            <span>{fmtDateTime(entry.clock_in_at)}{entry.clock_out_at ? ` - ${fmtDateTime(entry.clock_out_at)}` : " - active"}</span>
                            <span>{formatDuration(entry.duration_minutes ?? 0)} · {money(Number(entry.cost_amount ?? 0))}</span>
                          </div>
                          {entry.notes && <p style={{ ...rowMeta, marginTop: 4 }}>{entry.notes}</p>}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                            <button onClick={() => startShiftEdit(entry)} style={{ ...primaryButton, padding: "7px 10px" }}>Edit Shift</button>
                            <button
                              onClick={() => voidShift(entry)}
                              style={{ ...primaryButton, padding: "7px 10px", background: "transparent", border: "1px solid var(--fog)", color: "var(--obsidian)" }}
                            >
                              Void
                            </button>
                          </div>
                        </>
                      )}
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
        )}
        {(activeTab === "overview" || activeTab === "va-briefs") && (
        <>
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
                <MiniStat label="VA tasks" value={`${brief.va_tasks_completed ?? 0}`} />
              </div>
              {brief.revised_at && (
                <>
                  <p style={briefLabel}>Revision</p>
                  <p style={briefText}>
                    Updated {fmtDate(brief.revised_at)}{brief.revision_note ? ` · ${brief.revision_note}` : ""}
                  </p>
                </>
              )}
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
        </>
        )}
      </section>
      )}

      {(activeTab === "overview" || activeTab === "lead-ops") && (
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
      )}

      {(activeTab === "overview" || activeTab === "finance" || activeTab === "calendar" || activeTab === "scenarios") && (
      <>
      <div style={{ margin: "8px 0 14px" }}>
        <p style={eyebrow}>Finance tools</p>
        <h2 style={{ ...sectionTitle, marginBottom: 4 }}>
          {activeTab === "calendar" ? "Operating calendar" : activeTab === "scenarios" ? "Scenario modeling" : activeTab === "finance" ? "Money operations" : "Operating forms"}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          {activeTab === "calendar"
            ? "Keep closings, deadlines, votes, and project dates visible to the whole team."
            : activeTab === "scenarios"
              ? "Model project economics before they become deal votes or operating decisions."
              : activeTab === "finance"
                ? "Submit reimbursements, approve expenses, and record distributions in one lane."
                : "Calendar, reimbursements, scenario modeling, and distributions sit below VA approvals."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="ops-grid">
        {(activeTab === "overview" || activeTab === "calendar") && (
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
        )}

        {(activeTab === "overview" || activeTab === "finance") && (
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
        )}

        {(activeTab === "overview" || activeTab === "scenarios") && (
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
        )}

        {(activeTab === "overview" || activeTab === "finance") && (
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
        )}
      </div>
      </>
      )}

      <style jsx>{`
        .operations-root :global(input),
        .operations-root :global(select),
        .operations-root :global(textarea) {
          appearance: none;
          width: 100%;
          min-height: 42px;
          border: 1px solid var(--fog);
          border-radius: 8px;
          background: rgba(255,255,255,0.72);
          color: var(--ink);
          padding: 10px 12px;
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.25;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45);
        }
        .operations-root :global(input[type="date"]) {
          appearance: auto;
        }
        .operations-root :global(textarea) {
          min-height: 76px;
          resize: vertical;
        }
        .operations-root :global(input:focus),
        .operations-root :global(select:focus),
        .operations-root :global(textarea:focus) {
          outline: none;
          border-color: var(--brass);
          box-shadow: 0 0 0 3px rgba(198,157,101,0.14);
        }
        .operations-root :global(input::placeholder),
        .operations-root :global(textarea::placeholder) {
          color: rgba(31,28,23,0.48);
        }
        .operations-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 2px 0 14px;
          margin-bottom: 10px;
          scrollbar-width: thin;
        }
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

function OperationsTabButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 42,
        border: active ? "1px solid var(--obsidian)" : "1px solid var(--fog)",
        borderRadius: 999,
        background: active ? "var(--obsidian)" : "rgba(255,255,255,0.7)",
        color: active ? "var(--bone)" : "var(--ink)",
        padding: "8px 13px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
    >
      {label}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 22,
          height: 22,
          borderRadius: 999,
          background: active ? "rgba(255,255,255,0.14)" : "var(--bone)",
          color: active ? "var(--bone)" : "var(--muted)",
          fontSize: 10,
          letterSpacing: 0,
        }}
      >
        {count}
      </span>
    </button>
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--ink)",
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.45,
  outline: "none",
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

const warningPill: React.CSSProperties = {
  ...comingSoonPill,
  border: "1px solid rgba(176,137,84,0.65)",
  color: "var(--brass)",
  background: "rgba(176,137,84,0.1)",
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
