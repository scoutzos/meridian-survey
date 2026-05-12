"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllSurveys } from "@/data/surveys";
import { supabase } from "@/lib/supabase";
import { getStorageKey } from "@/lib/migration";
import { isAdmin, type CapitalCall, type MemberProfile } from "@/lib/tracker";
import { fetchAll } from "@/lib/tracker";
import { activeMemberNamesFromProfiles } from "@/lib/members";
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
import { fetchDeals, type Deal } from "@/lib/deals";
import { fetchImportedLandLeads, type ImportedLandLead } from "@/lib/land-leads";
import { fetchMeetingNotes, type MeetingNote } from "@/lib/meetings";
import { fetchProjects, type Project } from "@/lib/projects";
import {
  ALL_MEMBERS_LABEL,
  VA_ASSIGNEE_LABEL,
  addActionItemComment,
  createActionItem,
  deleteActionItem,
  fetchActionItemEvents,
  fetchActionItems,
  isOwnedBy,
  isVaTask,
  reassignActionItem,
  updateActionItemStatus,
  type ActionItem,
  type ActionItemEvent,
  type ActionItemStatus,
} from "@/lib/action-items";
import { createNotification } from "@/lib/operations";
import { labelForStatus } from "@/lib/status-map";
import { isVaUser } from "@/lib/identity";

const DISPLAY_FONT = "var(--font-display)";

const STATUS_ORDER: ActionItemStatus[] = ["open", "in-progress", "blocked", "done"];
const STATUS_LABEL: Record<ActionItemStatus, string> = {
  "open": "Open",
  "in-progress": "In Progress",
  "blocked": "Blocked",
  "done": "Done",
};
type TaskFilter = "needs-me" | "votes" | "money" | "surveys" | "actions" | "va" | "assigned-by-me" | "completed";
const TASK_FILTERS: TaskFilter[] = ["needs-me", "votes", "money", "surveys", "actions", "va", "assigned-by-me", "completed"];
type LinkType = "general" | "lead" | "deal" | "project" | "meeting" | "document";

interface TaskCard {
  id: string;
  kind: "Vote" | "Money" | "Survey" | "Action" | "VA Task";
  title: string;
  detail: string;
  href: string;
  status: "Open" | "In Progress" | "Done";
  due: string | null;
  sourceItem?: ActionItem;
}

interface LinkOption {
  type: LinkType;
  table: string | null;
  id: string;
  label: string;
  detail: string;
  href: string;
}

const DOCUMENT_LINK_OPTIONS: LinkOption[] = [
  {
    type: "document",
    table: "document_library",
    id: "operating-agreement-working-draft",
    label: "Operating Agreement Working Draft",
    detail: "Governance · Working Draft",
    href: "/documents",
  },
  {
    type: "document",
    table: "document_library",
    id: "brand-guidelines-vol-i",
    label: "Brand Guidelines Vol. I",
    detail: "Brand · PDF",
    href: "/documents",
  },
  {
    type: "document",
    table: "document_library",
    id: "forms-of-contribution-reference",
    label: "Forms of Contribution Reference",
    detail: "Money · Doc",
    href: "/documents",
  },
  {
    type: "document",
    table: "document_library",
    id: "meridian-website",
    label: "Meridian Website",
    detail: "Platform · Link",
    href: "/documents",
  },
];

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function taskHref(item: ActionItem): string {
  if (item.source_table === "meridian_deals" && item.source_id) return `/opportunity?deal=${item.source_id}`;
  if (item.source_table === "meridian_imported_land_leads" && item.source_id) return `/lead/${item.source_id}`;
  if (item.source_table === "meridian_buyer_offers" && item.source_id) return `/crm?view=dispo&offer=${item.source_id}`;
  if (item.source_table === "meridian_projects" && item.source_id) return `/projects?project=${item.source_id}`;
  if (item.source_table === "meeting_notes" && item.source_id) return `/meetings?note=${item.source_id}`;
  if (item.source_table === "document_library" && item.source_id) return `/documents?doc=${item.source_id}`;
  if (isVaTask(item)) return "/va";
  return "/actions";
}

function sourceLabel(item: ActionItem): string {
  if (item.source_table === "meridian_deals") return "Deal";
  if (item.source_table === "meridian_imported_land_leads") return "Lead";
  if (item.source_table === "meridian_buyer_offers") return "Buyer Offer";
  if (item.source_table === "meridian_projects") return "Project";
  if (item.source_table === "meeting_notes") return "Meeting";
  if (item.source_table === "document_library") return "Document";
  return isVaTask(item) ? "VA work" : "General";
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ActionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [taskEvents, setTaskEvents] = useState<ActionItemEvent[]>([]);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [candidateVotes, setCandidateVotes] = useState<MembershipCandidate[]>([]);
  const [proposalVotes, setProposalVotes] = useState<PendingExpenseProposalVote[]>([]);
  const [dealVotes, setDealVotes] = useState<PendingDealVote[]>([]);
  const [capitalCalls, setCapitalCalls] = useState<CapitalCall[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<ImportedLandLead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [surveyCounts, setSurveyCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<TaskFilter>("needs-me");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [taskAssignees, setTaskAssignees] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    assigned_to: ALL_MEMBERS_LABEL,
    due_date: "",
    task_type: "general",
    priority: "normal",
    link_type: "general" as LinkType,
    source_key: "",
  });
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const currentUser = localStorage.getItem("meridian_user");
    if (!currentUser) return;
    setLoading(true);
    const [data, pendingCandidates, pendingProposals, pendingDeals, trackerData, dealRows, leadRows, projectRows, meetingRows] = await Promise.all([
      fetchActionItems(),
      fetchPendingMembershipCandidateVotes(currentUser),
      fetchPendingExpenseProposalVotes(currentUser),
      fetchPendingDealVotes(currentUser),
      fetchAll(),
      fetchDeals(),
      fetchImportedLandLeads(120),
      fetchProjects(),
      fetchMeetingNotes(),
    ]);
    const events = await fetchActionItemEvents(data.map(item => item.id));
    setItems(data);
    setTaskEvents(events);
    setCandidateVotes(pendingCandidates);
    setProposalVotes(pendingProposals);
    setDealVotes(pendingDeals);
    setCapitalCalls(trackerData?.capitalCalls ?? []);
    setDeals(dealRows);
    setLeads(leadRows);
    setProjects(projectRows);
    setMeetings(meetingRows);

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
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "va") {
      setShowNew(true);
      setFilter("va");
      setDraft(prev => ({
        ...prev,
        assigned_to: VA_ASSIGNEE_LABEL,
        task_type: "va-work",
      }));
    }
    const requestedFilter = params.get("filter");
    if (requestedFilter && TASK_FILTERS.includes(requestedFilter as TaskFilter)) {
      setFilter(requestedFilter as TaskFilter);
    } else if (isVaUser(u) && params.get("new") !== "va" && !params.get("task")) {
      setFilter("va");
    }
    const requestedTask = params.get("task");
    if (requestedTask) {
      setSelectedTaskId(requestedTask);
      setFilter("actions");
    }
    void reload();
  }, [router, reload]);

  const grouped = useMemo(() => {
    const out: Record<ActionItemStatus, ActionItem[]> = { open: [], "in-progress": [], blocked: [], done: [] };
    for (const i of items) out[i.status].push(i);
    return out;
  }, [items]);

  useEffect(() => {
    if (selectedTaskId && !items.some(item => item.id === selectedTaskId)) setSelectedTaskId(null);
  }, [items, selectedTaskId]);

  const linkOptions = useMemo<LinkOption[]>(() => [
    ...leads.slice(0, 60).map(lead => ({
      type: "lead" as const,
      table: "meridian_imported_land_leads",
      id: lead.id,
      label: lead.owner_name || lead.property_address || lead.parcel_id || lead.phone || "Imported lead",
      detail: `${lead.county || "County pending"} · ${labelForStatus(lead.status)}`,
      href: `/lead/${lead.id}`,
    })),
    ...deals.slice(0, 80).map(deal => ({
      type: "deal" as const,
      table: "meridian_deals",
      id: deal.id,
      label: deal.title,
      detail: `${deal.address || deal.parcel_id || "Location pending"} · ${labelForStatus(deal.status)}`,
      href: `/opportunity?deal=${deal.id}`,
    })),
    ...projects.slice(0, 60).map(project => ({
      type: "project" as const,
      table: "meridian_projects",
      id: project.id,
      label: project.name,
      detail: `${labelForStatus(project.status)} · ${project.next_step || "Next step pending"}`,
      href: "/projects",
    })),
    ...meetings.slice(0, 40).map(meeting => ({
      type: "meeting" as const,
      table: "meeting_notes",
      id: meeting.id,
      label: meeting.agenda || `Meeting ${meeting.meeting_date}`,
      detail: meeting.meeting_date,
      href: "/meetings",
    })),
    ...DOCUMENT_LINK_OPTIONS,
  ], [deals, leads, meetings, projects]);
  const taskEventsById = useMemo(() => {
    const out: Record<string, ActionItemEvent[]> = {};
    for (const event of taskEvents) {
      out[event.action_item_id] = [...(out[event.action_item_id] ?? []), event];
    }
    return out;
  }, [taskEvents]);
  const selectedLink = linkOptions.find(option => `${option.table}:${option.id}` === draft.source_key) ?? null;

  if (!user) return null;
  const admin = isAdmin(profiles, user);
  const vaMode = isVaUser(user);
  const activeMemberNames = activeMemberNamesFromProfiles(profiles);
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
      detail: `${deal.recommendation ?? labelForStatus("needs-review")} · ${deal.urgency === "hot" ? "Hot Deal" : "Review Requested"}`,
      href: `/opportunity?deal=${deal.id}`,
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
      kind: item.assigned_to === VA_ASSIGNEE_LABEL || item.task_type === "va-work" ? "VA Task" as const : "Action" as const,
      title: item.title,
      detail: item.description || "Assigned action item.",
      href: taskHref(item),
      status: item.status === "done" ? "Done" as const : item.status === "in-progress" ? "In Progress" as const : item.status === "blocked" ? "In Progress" as const : "Open" as const,
      due: item.due_date,
      sourceItem: item,
    })),
  ];
  const completedTasks: TaskCard[] = items.filter(item => item.status === "done" && isOwnedBy(item, user)).map(item => ({
    id: `action-${item.id}`,
    kind: item.assigned_to === VA_ASSIGNEE_LABEL || item.task_type === "va-work" ? "VA Task" : "Action",
    title: item.title,
    detail: item.description || "Completed action item.",
      href: taskHref(item),
    status: "Done",
    due: item.completed_at,
    sourceItem: item,
  }));
  const visibleTasks = (filter === "completed" ? completedTasks : taskCards).filter(task => {
    if (filter === "needs-me") return true;
    if (filter === "completed") return vaMode ? task.kind === "VA Task" : true;
    if (filter === "votes") return task.kind === "Vote";
    if (filter === "money") return task.kind === "Money";
    if (filter === "surveys") return task.kind === "Survey";
    if (filter === "va") return task.kind === "VA Task";
    if (filter === "assigned-by-me") return Boolean(task.sourceItem && task.sourceItem.created_by === user);
    return task.kind === "Action";
  });
  const filterCounts: Record<TaskFilter, number> = {
    "needs-me": taskCards.length,
    votes: taskCards.filter(task => task.kind === "Vote").length,
    money: taskCards.filter(task => task.kind === "Money").length,
    surveys: taskCards.filter(task => task.kind === "Survey").length,
    actions: taskCards.filter(task => task.kind === "Action" || task.kind === "VA Task").length,
    va: taskCards.filter(task => task.kind === "VA Task").length,
    "assigned-by-me": taskCards.filter(task => task.sourceItem?.created_by === user).length,
    completed: completedTasks.length,
  };
  const openAssignedActions = taskCards.filter(task => task.kind === "Action").length;
  const vaOpenTasks = taskCards.filter(task => task.kind === "VA Task");
  const vaDoneTasks = completedTasks.filter(task => task.kind === "VA Task");
  const vaBlockedTasks = items.filter(item => isVaTask(item) && isOwnedBy(item, user) && item.status === "blocked").length;
  const visibleFilterButtons: Array<[TaskFilter, string]> = vaMode
    ? [["va", "VA Tasks"], ["actions", "All Assigned"], ["completed", "Done"]]
    : [["needs-me", "All Open"], ["votes", "Votes"], ["money", "Money"], ["surveys", "Surveys"], ["actions", "Actions"], ["va", "VA Tasks"], ["assigned-by-me", "Assigned By Me"], ["completed", "Done"]];
  const selectedTask = selectedTaskId ? items.find(item => item.id === selectedTaskId) ?? null : null;

  const handleStatusChange = async (item: ActionItem, status: ActionItemStatus, note = "") => {
    const { error } = await updateActionItemStatus(item.id, status, user, note);
    if (error) { setMessage(error); return; }
    const now = new Date().toISOString();
    const eventType = status === "done" ? "completed" : status === "blocked" ? "blocked" : status === "open" ? "reopened" : "status-changed";
    setItems(prev => prev.map(i => i.id === item.id ? {
      ...i,
      status,
      updated_at: now,
      updated_by: user,
      completed_at: status === "done" ? now : null,
      completed_by: status === "done" ? user : null,
      completion_note: status === "done" ? note.trim() || null : null,
      blocker_reason: status === "blocked" ? note.trim() || null : null,
    } : i));
    setTaskEvents(prev => [
      ...prev,
      {
        id: `local-${item.id}-${now}`,
        action_item_id: item.id,
        event_type: eventType,
        previous_status: item.status,
        next_status: status,
        note: note.trim() || null,
        created_by: user,
        created_at: now,
      },
    ]);
    setMessage(`Task marked ${STATUS_LABEL[status]}.`);
  };

  const promptStatusChange = async (item: ActionItem, status: ActionItemStatus) => {
    const note = status === "done"
      ? window.prompt("Completion note (optional):") ?? ""
      : status === "blocked"
        ? window.prompt("What is blocking this task?") ?? ""
        : "";
    await handleStatusChange(item, status, note);
  };

  const handleDelete = async (item: ActionItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const { error } = await deleteActionItem(item.id, user);
    if (error) { setMessage(error); return; }
    setItems(prev => prev.filter(i => i.id !== item.id));
    setTaskEvents(prev => prev.filter(event => event.action_item_id !== item.id));
    setMessage("Task deleted.");
  };

  const handleAddTaskComment = async (item: ActionItem) => {
    const note = (taskComments[item.id] || "").trim();
    if (!note) return;
    const { error } = await addActionItemComment(item.id, user, note);
    if (error) { setMessage(error); return; }
    const now = new Date().toISOString();
    setTaskEvents(prev => [
      ...prev,
      {
        id: `local-comment-${item.id}-${now}`,
        action_item_id: item.id,
        event_type: "comment",
        previous_status: null,
        next_status: null,
        note,
        created_by: user,
        created_at: now,
      },
    ]);
    setItems(prev => prev.map(row => row.id === item.id ? { ...row, updated_at: now, updated_by: user } : row));
    setTaskComments(prev => ({ ...prev, [item.id]: "" }));
    const recipient = item.created_by === user ? item.assigned_to : item.created_by;
    if (recipient && recipient !== ALL_MEMBERS_LABEL && recipient !== user) {
      await createNotification({
        title: `Task reply: ${item.title}`,
        body: note,
        priority: item.status === "blocked" ? "high" : "normal",
        assigned_to: recipient,
        href: "/actions",
        source_table: "action_items",
        source_id: item.id,
        notification_type: "task-comment",
        dedupe: item.status === "blocked",
      }, user);
    }
    setMessage("Comment added.");
  };

  const handleReassignTask = async (item: ActionItem) => {
    const assignedTo = taskAssignees[item.id] || item.assigned_to || ALL_MEMBERS_LABEL;
    if (!assignedTo || assignedTo === item.assigned_to) return;
    const { data, error } = await reassignActionItem(item.id, user, assignedTo);
    if (error) { setMessage(error); return; }
    const updated = data ?? { ...item, assigned_to: assignedTo, task_type: assignedTo === VA_ASSIGNEE_LABEL ? "va-work" as const : "general" as const };
    const now = updated.updated_at || new Date().toISOString();
    setItems(prev => prev.map(row => row.id === item.id ? updated : row));
    setTaskEvents(prev => [
      ...prev,
      {
        id: `local-reassigned-${item.id}-${now}`,
        action_item_id: item.id,
        event_type: "reassigned",
        previous_status: null,
        next_status: null,
        note: `Reassigned from ${item.assigned_to || "Unassigned"} to ${assignedTo}.`,
        created_by: user,
        created_at: now,
      },
    ]);
    setTaskAssignees(prev => ({ ...prev, [item.id]: assignedTo }));
    if (assignedTo !== ALL_MEMBERS_LABEL && assignedTo !== user) {
      await createNotification({
        title: `Task assigned: ${item.title}`,
        body: `${user} reassigned this task to you.`,
        priority: updated.priority === "urgent" ? "urgent" : updated.priority === "high" ? "high" : "normal",
        assigned_to: assignedTo,
        href: "/actions",
        source_table: "action_items",
        source_id: item.id,
        notification_type: "task-reassigned",
        dedupe: true,
      }, user);
    }
    setMessage(`Task reassigned to ${assignedTo}.`);
  };

  const handleCreate = async () => {
    if (!draft.title.trim()) { setMessage("Title is required."); return; }
    setSaving(true);
    const { error } = await createActionItem({
      title: draft.title,
      description: draft.description,
      assigned_to: draft.assigned_to,
      due_date: draft.due_date || null,
      task_type: draft.assigned_to === VA_ASSIGNEE_LABEL ? "va-work" : draft.task_type as ActionItem["task_type"],
      priority: draft.priority as ActionItem["priority"],
      source_table: selectedLink?.table ?? null,
      source_id: selectedLink?.id ?? null,
    }, user);
    setSaving(false);
    if (error) { setMessage(error); return; }
    setDraft({ title: "", description: "", assigned_to: ALL_MEMBERS_LABEL, due_date: "", task_type: "general", priority: "normal", link_type: "general", source_key: "" });
    setShowNew(false);
    void reload();
    setMessage("Task assigned.");
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "84px 20px 100px" }} className="actions-root">
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
            {vaMode ? "VA Tasks" : "Member Portal"}
          </p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 48px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: "-0.5px", marginBottom: 6 }}>
            {vaMode ? "Assigned VA Work" : "My Tasks"}
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.65, fontSize: 14 }}>
            {vaMode
              ? "Member-assigned tasks for Sophie. Open the linked record, update status, and flag blockers."
              : "One review queue for votes, money items, surveys, and assigned work."}
          </p>
        </div>
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
          {showNew ? "Cancel" : "Assign task"}
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
                <option value={VA_ASSIGNEE_LABEL}>{VA_ASSIGNEE_LABEL}</option>
                {activeMemberNames.map(m => <option key={m} value={m}>{m}</option>)}
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
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }} className="action-form-row">
            <div>
              <label style={labelStyle}>Linked record</label>
              <select
                value={draft.link_type}
                onChange={e => setDraft({ ...draft, link_type: e.target.value as LinkType, source_key: "" })}
              >
                <option value="general">General task</option>
                <option value="lead">Lead</option>
                <option value="deal">Deal / opportunity</option>
                <option value="project">Project</option>
                <option value="meeting">Meeting</option>
                <option value="document">Document</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Record</label>
              <select
                value={draft.source_key}
                disabled={draft.link_type === "general"}
                onChange={e => setDraft({ ...draft, source_key: e.target.value })}
              >
                <option value="">{draft.link_type === "general" ? "No record needed" : "Choose a record"}</option>
                {linkOptions.filter(option => option.type === draft.link_type).map(option => (
                  <option key={`${option.table}:${option.id}`} value={`${option.table}:${option.id}`}>
                    {option.label} · {option.detail}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedLink && (
            <p style={{ color: "var(--ink)", opacity: 0.68, fontSize: 12 }}>
              This task will link to {selectedLink.label}. The assignee can open the related record from their task list.
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="action-form-row">
            <div>
              <label style={labelStyle}>Task type</label>
              <select
                value={draft.assigned_to === VA_ASSIGNEE_LABEL ? "va-work" : draft.task_type}
                disabled={draft.assigned_to === VA_ASSIGNEE_LABEL}
                onChange={e => setDraft({ ...draft, task_type: e.target.value })}
              >
                <option value="general">General</option>
                <option value="va-work">VA work</option>
                <option value="meeting-follow-up">Meeting follow-up</option>
                <option value="deal-follow-up">Deal follow-up</option>
                <option value="project-task">Project task</option>
                <option value="document-review">Document review</option>
                <option value="money-approval">Money approval</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                value={draft.priority}
                onChange={e => setDraft({ ...draft, priority: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
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
          <section className="task-summary-grid" style={{ marginBottom: 18 }}>
            {vaMode ? (
              <>
                <TaskSummaryCard label="Open VA" value={vaOpenTasks.length} detail="Assigned to Sophie / VA" active={filter === "va"} onClick={() => setFilter("va")} />
                <TaskSummaryCard label="Blocked" value={vaBlockedTasks} detail="Needs member input" active={false} onClick={() => setFilter("va")} />
                <TaskSummaryCard label="Done" value={vaDoneTasks.length} detail="Completed assigned work" active={filter === "completed"} onClick={() => setFilter("completed")} />
                <TaskSummaryCard label="All Assigned" value={filterCounts.actions} detail="VA plus general actions" active={filter === "actions"} onClick={() => setFilter("actions")} />
              </>
            ) : (
              <>
                <TaskSummaryCard label="Open queue" value={filterCounts["needs-me"]} detail="Everything waiting on you" active={filter === "needs-me"} onClick={() => setFilter("needs-me")} />
                <TaskSummaryCard label="Votes" value={filterCounts.votes} detail="Deals, applications, proposals" active={filter === "votes"} onClick={() => setFilter("votes")} />
                <TaskSummaryCard label="Money" value={filterCounts.money} detail="Capital calls and approvals" active={filter === "money"} onClick={() => setFilter("money")} />
                <TaskSummaryCard label="Surveys" value={filterCounts.surveys} detail="Unfinished member input" active={filter === "surveys"} onClick={() => setFilter("surveys")} />
                <TaskSummaryCard label="VA tasks" value={filterCounts.va} detail="Assigned to Sophie / VA" active={filter === "va"} onClick={() => setFilter("va")} />
                <TaskSummaryCard label="Assigned work" value={openAssignedActions} detail="Manual action items" active={filter === "actions"} onClick={() => setFilter("actions")} />
              </>
            )}
          </section>

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
                  {vaMode ? "VA Task Queue" : "Review Queue"}
                </p>
                <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 500, color: "var(--obsidian)" }}>
                  {vaMode
                    ? `${vaOpenTasks.length} open VA task${vaOpenTasks.length === 1 ? "" : "s"}`
                    : `${filterCounts["needs-me"]} open task${filterCounts["needs-me"] === 1 ? "" : "s"}`}
                </h2>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {visibleFilterButtons.map(([value, label]) => (
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
                      onClick={() => task.sourceItem ? setSelectedTaskId(task.sourceItem.id) : router.push(task.href)}
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
                        {task.sourceItem && <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.58 }}>{sourceLabel(task.sourceItem)}</span>}
                        {task.due && <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.58 }}>{formatDue(task.due)}</span>}
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--obsidian)", lineHeight: 1.3 }}>{task.title}</p>
                      <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.7, lineHeight: 1.45, marginTop: 4 }}>{task.detail}</p>
                    </button>
                    {task.sourceItem && task.status !== "Done" && (
                      <button onClick={() => promptStatusChange(task.sourceItem!, "done")} style={primaryBtnStyle}>
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

          {selectedTask && (
            <TaskDetailPanel
              task={selectedTask}
              events={taskEventsById[selectedTask.id] ?? []}
              commentValue={taskComments[selectedTask.id] || ""}
              assigneeValue={taskAssignees[selectedTask.id] || selectedTask.assigned_to || ALL_MEMBERS_LABEL}
              assigneeOptions={[ALL_MEMBERS_LABEL, VA_ASSIGNEE_LABEL, ...activeMemberNames]}
              onCommentChange={value => setTaskComments(prev => ({ ...prev, [selectedTask.id]: value }))}
              onAddComment={() => handleAddTaskComment(selectedTask)}
              onAssigneeChange={value => setTaskAssignees(prev => ({ ...prev, [selectedTask.id]: value }))}
              onReassign={() => handleReassignTask(selectedTask)}
              onClose={() => setSelectedTaskId(null)}
              onOpenRecord={() => router.push(taskHref(selectedTask))}
              onStart={() => handleStatusChange(selectedTask, "in-progress")}
              onBlock={() => promptStatusChange(selectedTask, "blocked")}
              onDone={() => promptStatusChange(selectedTask, "done")}
              onReopen={() => handleStatusChange(selectedTask, "open")}
              onDelete={admin ? () => handleDelete(selectedTask) : undefined}
            />
          )}

          <details style={{ marginBottom: 24 }}>
            <summary style={{ cursor: "pointer", color: "var(--brass)", fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
              Assigned action board
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
                        <span style={{
                          background: "var(--bone)", border: "1px solid var(--fog)",
                          padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500,
                        }}>
                          {sourceLabel(item)}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {canMarkDone && status !== "in-progress" && status !== "done" && (
                          <button onClick={() => handleStatusChange(item, "in-progress")} style={subtleBtnStyle}>
                            Start
                          </button>
                        )}
                        {canMarkDone && status !== "done" && (
                          <button onClick={() => promptStatusChange(item, "done")} style={primaryBtnStyle}>
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
                        <button onClick={() => setSelectedTaskId(item.id)} style={subtleBtnStyle}>
                          Details
                        </button>
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
        .task-summary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 600px) {
          .actions-root { padding-top: 28px !important; }
          :global(.action-form-row) { grid-template-columns: 1fr !important; }
          .task-summary-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 601px) and (max-width: 900px) {
          .task-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}

function TaskSummaryCard({
  label,
  value,
  detail,
  active,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--obsidian)" : "var(--surface)",
        border: `1px solid ${active ? "var(--obsidian)" : "var(--fog)"}`,
        borderRadius: 12,
        padding: "14px 15px",
        textAlign: "left",
        cursor: "pointer",
        minHeight: 126,
        color: active ? "var(--bone)" : "var(--ink)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--brass)", fontWeight: 900 }}>
        {label}
      </span>
      <strong style={{ fontSize: 32, lineHeight: 1, color: active ? "var(--bone)" : "var(--obsidian)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
      <span style={{ fontSize: 12, lineHeight: 1.35, color: active ? "rgba(237,230,214,0.78)" : "var(--muted)" }}>
        {detail}
      </span>
    </button>
  );
}

function TaskDetailPanel({
  task,
  events,
  commentValue,
  assigneeValue,
  assigneeOptions,
  onClose,
  onOpenRecord,
  onStart,
  onBlock,
  onDone,
  onReopen,
  onCommentChange,
  onAddComment,
  onAssigneeChange,
  onReassign,
  onDelete,
}: {
  task: ActionItem;
  events: ActionItemEvent[];
  commentValue: string;
  assigneeValue: string;
  assigneeOptions: string[];
  onClose: () => void;
  onOpenRecord: () => void;
  onStart: () => void;
  onBlock: () => void;
  onDone: () => void;
  onReopen: () => void;
  onCommentChange: (value: string) => void;
  onAddComment: () => void;
  onAssigneeChange: (value: string) => void;
  onReassign: () => void;
  onDelete?: () => void;
}) {
  const fallbackHistory = [
    { label: "Created", who: task.created_by || "Unknown", at: task.created_at, detail: "Task was assigned." },
    task.updated_at !== task.created_at
      ? {
          label: STATUS_LABEL[task.status],
          who: task.updated_by || "Unknown",
          at: task.updated_at,
          detail: task.blocker_reason || task.completion_note || "Status updated.",
        }
      : null,
    task.completed_at
      ? {
          label: "Completed",
          who: task.completed_by || task.updated_by || "Unknown",
          at: task.completed_at,
          detail: task.completion_note || "Marked done.",
        }
      : null,
  ].filter((item): item is { label: string; who: string; at: string; detail: string } => Boolean(item));
  const history = events.length
    ? events.map(event => ({
        label: eventLabel(event),
        who: event.created_by || "Unknown",
        at: event.created_at,
        detail: event.note || eventDetail(event),
      }))
    : fallbackHistory;

  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--fog)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        boxShadow: "0 10px 26px rgba(20,17,13,0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", color: "var(--brass)", textTransform: "uppercase", marginBottom: 6 }}>
            Task Detail
          </p>
          <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 500, color: "var(--obsidian)" }}>{task.title}</h2>
          <p style={{ color: "var(--ink)", opacity: 0.7, fontSize: 13, lineHeight: 1.5, marginTop: 5 }}>{task.description || "No description added."}</p>
        </div>
        <button onClick={onClose} style={subtleBtnStyle}>Close</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }} className="action-form-row">
        <TaskDetailStat label="Status" value={STATUS_LABEL[task.status]} />
        <TaskDetailStat label="Assignee" value={task.assigned_to || "Unassigned"} />
        <TaskDetailStat label="Priority" value={labelForStatus(task.priority || "normal")} />
        <TaskDetailStat label="Due" value={formatDue(task.due_date) || "No due date"} />
        <TaskDetailStat label="Created By" value={task.created_by || "Unknown"} />
        <TaskDetailStat label="Record" value={sourceLabel(task)} />
        <TaskDetailStat label="Updated" value={formatDateTime(task.updated_at)} />
        <TaskDetailStat label="Completed By" value={task.completed_by || "Not completed"} />
      </div>

      {(task.blocker_reason || task.completion_note) && (
        <div style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass)", marginBottom: 5 }}>
            {task.blocker_reason ? "Blocker" : "Completion Note"}
          </p>
          <p style={{ color: "var(--ink)", opacity: 0.75, fontSize: 13, lineHeight: 1.5 }}>{task.blocker_reason || task.completion_note}</p>
        </div>
      )}

      <div style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <label style={{ ...labelStyle, marginBottom: 8 }}>Reassign Task</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={assigneeValue}
            onChange={event => onAssigneeChange(event.target.value)}
            style={{
              minWidth: 220,
              flex: "1 1 220px",
              border: "1px solid var(--fog)",
              borderRadius: 8,
              background: "var(--surface)",
              color: "var(--ink)",
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {assigneeOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <button onClick={onReassign} disabled={assigneeValue === (task.assigned_to || ALL_MEMBERS_LABEL)} style={subtleBtnStyle}>Reassign</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass)" }}>History</p>
        {history.map((event, index) => (
          <div key={`${event.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, borderBottom: "1px solid var(--fog)", paddingBottom: 8 }}>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{formatDateTime(event.at)}</span>
            <span style={{ color: "var(--ink)", fontSize: 13 }}>
              <strong style={{ color: "var(--obsidian)" }}>{event.label}</strong> by {event.who}. {event.detail}
            </span>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <label style={{ ...labelStyle, marginBottom: 8 }}>Add Comment</label>
        <textarea
          value={commentValue}
          onChange={event => onCommentChange(event.target.value)}
          placeholder="Add an update, answer, instruction, or context for this task..."
          style={{
            width: "100%",
            minHeight: 78,
            border: "1px solid var(--fog)",
            borderRadius: 8,
            background: "var(--surface)",
            color: "var(--ink)",
            padding: "10px 12px",
            fontSize: 13,
            lineHeight: 1.45,
            resize: "vertical",
            outline: "none",
            marginBottom: 8,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>Saved to task history and notifies the other owner when available.</p>
          <button onClick={onAddComment} disabled={!commentValue.trim()} style={primaryBtnStyle}>Post Comment</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onOpenRecord} style={subtleBtnStyle}>Open Linked Record</button>
        {task.status !== "in-progress" && task.status !== "done" && <button onClick={onStart} style={subtleBtnStyle}>Start</button>}
        {task.status !== "done" && <button onClick={onDone} style={primaryBtnStyle}>Mark Done</button>}
        {task.status !== "blocked" && task.status !== "done" && <button onClick={onBlock} style={subtleBtnStyle}>Mark Blocked</button>}
        {task.status === "done" && <button onClick={onReopen} style={subtleBtnStyle}>Reopen</button>}
        {onDelete && <button onClick={onDelete} style={subtleBtnStyle}>Delete</button>}
      </div>
    </section>
  );
}

function eventLabel(event: ActionItemEvent): string {
  if (event.event_type === "created") return "Created";
  if (event.event_type === "completed") return "Completed";
  if (event.event_type === "blocked") return "Blocked";
  if (event.event_type === "reopened") return "Reopened";
  if (event.event_type === "deleted") return "Deleted";
  if (event.event_type === "comment") return "Comment";
  if (event.event_type === "reassigned") return "Reassigned";
  return "Status Changed";
}

function eventDetail(event: ActionItemEvent): string {
  if (event.previous_status && event.next_status) {
    return `${STATUS_LABEL[event.previous_status]} to ${STATUS_LABEL[event.next_status]}.`;
  }
  if (event.next_status) return `Set to ${STATUS_LABEL[event.next_status]}.`;
  return "Task event recorded.";
}

function TaskDetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bone)", border: "1px solid var(--fog)", borderRadius: 10, padding: 10 }}>
      <p style={{ fontSize: 10, color: "var(--brass)", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <strong style={{ color: "var(--obsidian)", fontSize: 13, lineHeight: 1.3 }}>{value}</strong>
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
