"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { getAllSurveys } from "@/data/surveys";
import { supabase } from "@/lib/supabase";
import { getStorageKey } from "@/lib/migration";
import { isAdmin, type CapitalCall, type MemberProfile } from "@/lib/tracker";
import { fetchAll } from "@/lib/tracker";
import {
  fetchPendingMembershipCandidateVotes,
  type MembershipCandidate,
} from "@/lib/membership-candidates";
import {
  fetchPendingExpenseProposalVotes,
  type PendingExpenseProposalVote,
} from "@/lib/expense-proposal-votes";
import {
  fetchPendingDealVotes,
  type PendingDealVote,
} from "@/lib/deal-votes";
import {
  ALL_MEMBERS_LABEL,
  createActionItem,
  deleteActionItem,
  fetchActionItems,
  isOwnedBy,
  updateActionItemStatus,
  type ActionItem,
  type ActionItemStatus,
} from "@/lib/action-items";

const DISPLAY_FONT = "var(--font-display)";

const STATUS_ORDER: ActionItemStatus[] = ["open", "in-progress", "done"];
const STATUS_LABEL: Record<ActionItemStatus, string> = {
  "open": "Open",
  "in-progress": "In Progress",
  "done": "Done",
};
type TaskFilter = "needs-me" | "votes" | "money" | "surveys" | "actions" | "completed";

interface TaskCard {
  id: string;
  kind: "Vote" | "Money" | "Survey" | "Action";
  title: string;
  detail: string;
  href: string;
  status: "Open" | "In Progress" | "Done";
  due: string | null;
  sourceItem?: ActionItem;
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ActionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [candidateVotes, setCandidateVotes] = useState<MembershipCandidate[]>([]);
  const [proposalVotes, setProposalVotes] = useState<PendingExpenseProposalVote[]>([]);
  const [dealVotes, setDealVotes] = useState<PendingDealVote[]>([]);
  const [capitalCalls, setCapitalCalls] = useState<CapitalCall[]>([]);
  const [surveyCounts, setSurveyCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<TaskFilter>("needs-me");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    assigned_to: ALL_MEMBERS_LABEL,
    due_date: "",
  });
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const currentUser = localStorage.getItem("meridian_user");
    if (!currentUser) return;
    setLoading(true);
    const [data, pendingCandidates, pendingProposals, pendingDeals, trackerData] = await Promise.all([
      fetchActionItems(),
      fetchPendingMembershipCandidateVotes(currentUser),
      fetchPendingExpenseProposalVotes(currentUser),
      fetchPendingDealVotes(currentUser),
      fetchAll(),
    ]);
    setItems(data);
    setCandidateVotes(pendingCandidates);
    setProposalVotes(pendingProposals);
    setDealVotes(pendingDeals);
    setCapitalCalls(trackerData?.capitalCalls ?? []);

    const surveys = getAllSurveys();
    const counts: Record<string, number> = {};
    if (supabase) {
      const { data: responses } = await supabase
        .from("meridian_responses")
        .select("survey_id")
        .eq("member_name", currentUser);
      for (const row of responses ?? []) {
        const sid = row.survey_id || "operating-agreement";
        counts[sid] = (counts[sid] || 0) + 1;
      }
    } else {
      for (const survey of surveys) {
        const raw = localStorage.getItem(getStorageKey(survey.id, currentUser));
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          counts[survey.id] = Object.values(parsed).filter(v => Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "").length;
        } catch { /* ignore malformed local survey cache */ }
      }
    }
    setSurveyCounts(counts);

    if (supabase) {
      const { data: prof } = await supabase.from("tracker_member_profiles").select("*");
      setProfiles((prof as MemberProfile[] | null) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void reload();
  }, [router, reload]);

  const grouped = useMemo(() => {
    const out: Record<ActionItemStatus, ActionItem[]> = { open: [], "in-progress": [], done: [] };
    for (const i of items) out[i.status].push(i);
    return out;
  }, [items]);

  if (!user) return null;
  const admin = isAdmin(profiles, user);
  const surveys = getAllSurveys();
  const openCapitalCalls = capitalCalls.filter(c => !c.deleted_at && c.status === "open");
  const suggestedCapitalCalls = capitalCalls.filter(c => !c.deleted_at && c.status === "suggested");
  const surveyTasks: TaskCard[] = surveys
    .map(survey => {
      const total = survey.categories.reduce((sum, c) => sum + c.questions.length, 0);
      const answered = surveyCounts[survey.id] || 0;
      return { survey, total, answered };
    })
    .filter(row => row.total > 0 && row.answered < row.total)
    .map(({ survey, total, answered }) => ({
      id: `survey-${survey.id}`,
      kind: "Survey",
      title: survey.title,
      detail: `${answered}/${total} questions answered.`,
      href: `/survey/${survey.id}`,
      status: answered > 0 ? "In Progress" : "Open",
      due: null,
    }));
  const hasTiebreakerSurveyTask = surveyTasks.some(task => task.id === "survey-tiebreaker-decisions");
  const taskCards: TaskCard[] = [
    ...proposalVotes.map(proposal => ({
      id: `proposal-${proposal.id}`,
      kind: "Vote" as const,
      title: `Vote on proposal: ${proposal.title}`,
      detail: `Version ${proposal.revision_number ?? 1} is waiting for your review.`,
      href: `/tracker/planning?proposal=${proposal.id}`,
      status: "Open" as const,
      due: null,
    })),
    ...candidateVotes.map(candidate => ({
      id: `candidate-${candidate.id}`,
      kind: "Vote" as const,
      title: `Review application: ${candidate.full_name}`,
      detail: "Member application vote needed.",
      href: `/members/candidates?candidate=${candidate.id}`,
      status: "Open" as const,
      due: null,
    })),
    ...dealVotes.map(deal => ({
      id: `deal-${deal.id}`,
      kind: "Vote" as const,
      title: `Review deal: ${deal.title}`,
      detail: `${deal.recommendation ?? "Needs Review"} · ${deal.urgency === "hot" ? "Hot deal" : "Review requested"}`,
      href: `/deals?deal=${deal.id}`,
      status: "Open" as const,
      due: null,
    })),
    ...openCapitalCalls.map(call => ({
      id: `capital-${call.id}`,
      kind: "Money" as const,
      title: `Capital call: ${call.reason}`,
      detail: `${call.per_member_amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })} per member.`,
      href: "/tracker/capital-calls",
      status: "Open" as const,
      due: call.date_called,
    })),
    ...suggestedCapitalCalls.map(call => ({
      id: `suggested-capital-${call.id}`,
      kind: "Money" as const,
      title: `Review suggested capital call: ${call.reason}`,
      detail: `${call.total_amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} total suggested.`,
      href: "/tracker/capital-calls",
      status: "Open" as const,
      due: call.date_called,
    })),
    ...surveyTasks,
    ...items.filter(item => {
      if (item.status === "done" || !isOwnedBy(item, user)) return false;
      if (hasTiebreakerSurveyTask && item.title === "Complete Tiebreaker Survey") return false;
      return true;
    }).map(item => ({
      id: `action-${item.id}`,
      kind: "Action" as const,
      title: item.title,
      detail: item.description || "Assigned action item.",
      href: "/actions",
      status: item.status === "in-progress" ? "In Progress" as const : "Open" as const,
      due: item.due_date,
      sourceItem: item,
    })),
  ];
  const completedTasks: TaskCard[] = items.filter(item => item.status === "done" && isOwnedBy(item, user)).map(item => ({
    id: `action-${item.id}`,
    kind: "Action",
    title: item.title,
    detail: item.description || "Completed action item.",
    href: "/actions",
    status: "Done",
    due: item.completed_at,
    sourceItem: item,
  }));
  const visibleTasks = (filter === "completed" ? completedTasks : taskCards).filter(task => {
    if (filter === "needs-me" || filter === "completed") return true;
    if (filter === "votes") return task.kind === "Vote";
    if (filter === "money") return task.kind === "Money";
    if (filter === "surveys") return task.kind === "Survey";
    return task.kind === "Action";
  });
  const filterCounts: Record<TaskFilter, number> = {
    "needs-me": taskCards.length,
    votes: taskCards.filter(task => task.kind === "Vote").length,
    money: taskCards.filter(task => task.kind === "Money").length,
    surveys: taskCards.filter(task => task.kind === "Survey").length,
    actions: taskCards.filter(task => task.kind === "Action").length,
    completed: completedTasks.length,
  };

  const handleStatusChange = async (item: ActionItem, status: ActionItemStatus) => {
    const { error } = await updateActionItemStatus(item.id, status, user);
    if (error) { alert(error); return; }
    setItems(prev => prev.map(i => i.id === item.id ? {
      ...i, status, completed_at: status === "done" ? new Date().toISOString() : null,
    } : i));
  };

  const handleDelete = async (item: ActionItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const { error } = await deleteActionItem(item.id, user);
    if (error) { alert(error); return; }
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handleCreate = async () => {
    if (!draft.title.trim()) { alert("Title is required."); return; }
    setSaving(true);
    const { error } = await createActionItem({
      title: draft.title,
      description: draft.description,
      assigned_to: draft.assigned_to,
      due_date: draft.due_date || null,
    }, user);
    setSaving(false);
    if (error) { alert(error); return; }
    setDraft({ title: "", description: "", assigned_to: ALL_MEMBERS_LABEL, due_date: "" });
    setShowNew(false);
    void reload();
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "84px 20px 100px" }} className="actions-root">
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
            Operations
          </p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 48px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: "-0.5px", marginBottom: 6 }}>
            Task inbox
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.65, fontSize: 14 }}>
            One place for votes, money tasks, surveys, and assigned action items.
          </p>
        </div>
        {admin && (
          <button
            onClick={() => setShowNew(s => !s)}
            style={{
              background: showNew ? "transparent" : "var(--brass)",
              color: showNew ? "var(--brass)" : "var(--obsidian)",
              border: showNew ? "1px solid var(--brass)" : "none",
              borderRadius: 6, padding: "10px 16px", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            {showNew ? "Cancel" : "New action"}
          </button>
        )}
      </header>

      {showNew && admin && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--fog)", borderRadius: 12,
          padding: 18, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12,
        }}>
          <input
            placeholder="Title (required)"
            value={draft.title}
            onChange={e => setDraft({ ...draft, title: e.target.value })}
          />
          <textarea
            placeholder="Description (optional)"
            value={draft.description}
            onChange={e => setDraft({ ...draft, description: e.target.value })}
            rows={3}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="action-form-row">
            <div>
              <label style={labelStyle}>Assigned to</label>
              <select
                value={draft.assigned_to}
                onChange={e => setDraft({ ...draft, assigned_to: e.target.value })}
              >
                <option value={ALL_MEMBERS_LABEL}>{ALL_MEMBERS_LABEL}</option>
                {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Due date</label>
              <input
                type="date"
                value={draft.due_date}
                onChange={e => setDraft({ ...draft, due_date: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                background: "var(--brass)", color: "var(--obsidian)", border: "none",
                borderRadius: 6, padding: "10px 18px", fontSize: 11, fontWeight: 600,
                letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}

      {!loading && (
        <>
          <section style={{
            background: "var(--surface)",
            border: "1px solid var(--fog)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--brass)", marginBottom: 6 }}>
                  Needs My Attention
                </p>
                <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 500, color: "var(--obsidian)" }}>
                  {filterCounts["needs-me"]} open task{filterCounts["needs-me"] === 1 ? "" : "s"}
                </h2>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([
                  ["needs-me", "All"],
                  ["votes", "Votes"],
                  ["money", "Money"],
                  ["surveys", "Surveys"],
                  ["actions", "Actions"],
                  ["completed", "Done"],
                ] as Array<[TaskFilter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    style={{
                      ...(filter === value ? primaryBtnStyle : subtleBtnStyle),
                      padding: "8px 10px",
                      fontSize: 10,
                    }}
                  >
                    {label} {filterCounts[value]}
                  </button>
                ))}
              </div>
            </div>
            {visibleTasks.length === 0 ? (
              <p style={{ color: "var(--ink)", opacity: 0.58, fontSize: 13 }}>Nothing in this view.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {visibleTasks.map(task => (
                  <div key={task.id} style={{
                    background: "var(--bone)",
                    border: "1px solid var(--fog)",
                    borderLeft: `3px solid ${task.status === "Done" ? "var(--fog)" : "var(--brass)"}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    opacity: task.status === "Done" ? 0.68 : 1,
                  }}>
                    <button
                      onClick={() => router.push(task.href)}
                      style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", flex: 1, color: "var(--ink)" }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                        <span style={{
                          background: "var(--surface)",
                          border: "1px solid var(--fog)",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontSize: 10,
                          fontWeight: 800,
                          color: "var(--brass)",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                        }}>{task.kind}</span>
                        <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.58 }}>{task.status}</span>
                        {task.due && <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.58 }}>{formatDue(task.due)}</span>}
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--obsidian)", lineHeight: 1.3 }}>{task.title}</p>
                      <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.7, lineHeight: 1.45, marginTop: 4 }}>{task.detail}</p>
                    </button>
                    {task.sourceItem && task.status !== "Done" && (
                      <button onClick={() => handleStatusChange(task.sourceItem!, "done")} style={primaryBtnStyle}>
                        Done
                      </button>
                    )}
                    {task.sourceItem && task.status === "Done" && (
                      <button onClick={() => handleStatusChange(task.sourceItem!, "open")} style={subtleBtnStyle}>
                        Reopen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <details style={{ marginBottom: 24 }}>
            <summary style={{ cursor: "pointer", color: "var(--brass)", fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
              Manual action board
            </summary>
            <div style={{ marginTop: 12 }}>
              {STATUS_ORDER.map(status => {
        const list = grouped[status];
        return (
          <section key={status} style={{ marginBottom: 24 }}>
            <h2 style={{
              fontSize: 11, fontWeight: 700, color: "var(--brass)",
              letterSpacing: "0.22em", textTransform: "uppercase",
              marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--fog)",
            }}>
              {STATUS_LABEL[status]} · {list.length}
            </h2>
            {list.length === 0 && (
              <p style={{ color: "var(--ink)", opacity: 0.5, fontSize: 13, padding: "8px 0" }}>
                Nothing here.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map(item => {
                const due = formatDue(item.due_date);
                const mine = isOwnedBy(item, user);
                const canMarkDone = mine || admin;
                return (
                  <div key={item.id} style={{
                    background: "var(--surface)",
                    border: "1px solid var(--fog)",
                    borderLeft: `3px solid ${status === "done" ? "var(--fog)" : "var(--brass)"}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    opacity: status === "done" ? 0.65 : 1,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <p style={{
                        fontSize: 15, fontWeight: 600, color: "var(--obsidian)", lineHeight: 1.3,
                        textDecoration: status === "done" ? "line-through" : "none",
                      }}>
                        {item.title}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {due && (
                          <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.6, alignSelf: "center" }}>
                            {due}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.description && (
                      <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.72, lineHeight: 1.5 }}>
                        {item.description}
                      </p>
                    )}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 8, flexWrap: "wrap", paddingTop: 4,
                    }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--ink)", opacity: 0.7 }}>
                        <span style={{
                          background: "var(--bone)", border: "1px solid var(--fog)",
                          padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500,
                        }}>
                          {item.assigned_to ?? "Unassigned"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {canMarkDone && status !== "in-progress" && status !== "done" && (
                          <button onClick={() => handleStatusChange(item, "in-progress")} style={subtleBtnStyle}>
                            Start
                          </button>
                        )}
                        {canMarkDone && status !== "done" && (
                          <button onClick={() => handleStatusChange(item, "done")} style={primaryBtnStyle}>
                            Mark done
                          </button>
                        )}
                        {canMarkDone && status === "done" && (
                          <button onClick={() => handleStatusChange(item, "open")} style={subtleBtnStyle}>
                            Reopen
                          </button>
                        )}
                        {admin && (
                          <button onClick={() => handleDelete(item)} style={subtleBtnStyle}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
            </div>
          </details>
        </>
      )}

      <style jsx>{`
        @media (max-width: 600px) {
          .actions-root { padding-top: 28px !important; }
          :global(.action-form-row) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em",
  textTransform: "uppercase", color: "var(--brass)", marginBottom: 6,
};

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--brass)", color: "var(--obsidian)", border: "none",
  borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
};

const subtleBtnStyle: React.CSSProperties = {
  background: "transparent", color: "var(--brass)", border: "1px solid var(--fog)",
  borderRadius: 6, padding: "8px 14px", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
};
