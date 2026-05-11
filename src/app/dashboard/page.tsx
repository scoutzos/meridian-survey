"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllSurveys } from "@/data/surveys";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";
import { migrateLocalStorage, getStorageKey } from "@/lib/migration";
import {
  fetchActionItems,
  isOwnedBy,
  type ActionItem,
} from "@/lib/action-items";
import { fetchNextMeeting, type NextMeeting } from "@/lib/meetings";
import { fetchDeals, type Deal } from "@/lib/deals";
import { fetchImportedLandLeadActivities, type ImportedLandLeadActivity } from "@/lib/land-leads";
import { fetchProjects, type Project } from "@/lib/projects";
import {
  fetchNotifications,
  markNotificationRead,
  type Notification,
} from "@/lib/operations";
import {
  fetchPendingMembershipCandidateVotes,
  MEMBERSHIP_CANDIDATE_VOTE,
  type MembershipCandidate,
} from "@/lib/membership-candidates";
import {
  EXPENSE_PROPOSAL_VOTE_TYPES,
  fetchPendingExpenseProposalVotes,
  type PendingExpenseProposalVote,
} from "@/lib/expense-proposal-votes";
import {
  DEAL_VOTE_TYPES,
  fetchPendingDealVotes,
  type PendingDealVote,
} from "@/lib/deal-votes";
import { fetchCommunicationEvents, type CommunicationEvent } from "@/lib/communications";
import { labelForStatus } from "@/lib/status-map";
import {
  fetchReimbursements,
  type Reimbursement,
} from "@/lib/governance";
import {
  computeMemberBalances,
  fetchAll,
  fmtUSD,
  activeTrackerMembers,
  type CapitalCall,
  type MemberBalance,
} from "@/lib/tracker";
import { fetchHubData, type Decision } from "@/lib/hub";
import { isVaUser } from "@/lib/identity";
import OperatingHeader from "@/components/OperatingHeader";
import {
  fetchVaDailyBriefReviews,
  fetchVaDailyBriefs,
  type VaDailyBrief,
  type VaDailyBriefReview,
} from "@/lib/va-briefs";
import {
  currentShiftMinutes,
  fetchVaTimeEntries,
  formatDuration,
  vaDateKey,
  type VaTimeEntry,
} from "@/lib/va-time";

type SurveyProgress = {
  surveyId: string;
  title: string;
  description: string;
  answered: number;
  total: number;
  status: "Completed" | "In Progress" | "Not Started";
};

type MemberDirectoryRow = {
  name: string;
  llcName: string | null;
  isAdmin: boolean;
  role: string;
  contact: string;
  lastActive: string;
};

const DISPLAY_FONT = "var(--font-display)";
const BODY_FONT = "var(--font-body)";

const COLORS = {
  obsidian: "var(--obsidian)",
  brass: "var(--brass)",
  bone: "var(--bone)",
  fog: "var(--fog)",
  ink: "var(--ink)",
};

function canonicalMember(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  const match = MEMBERS.find(m => m.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMeetingDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatActivityDate(iso: string | null): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatActivityTime(iso: string | null | undefined): string {
  if (!iso) return "No time";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "No time";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [progress, setProgress] = useState<SurveyProgress[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [myBalance, setMyBalance] = useState<MemberBalance | null>(null);
  const [memberDirectory, setMemberDirectory] = useState<MemberDirectoryRow[]>([]);
  const [capitalCalls, setCapitalCalls] = useState<CapitalCall[]>([]);
  const [pendingCandidateVotes, setPendingCandidateVotes] = useState<MembershipCandidate[]>([]);
  const [pendingProposalVotes, setPendingProposalVotes] = useState<PendingExpenseProposalVote[]>([]);
  const [pendingDealVotes, setPendingDealVotes] = useState<PendingDealVote[]>([]);
  const [communicationEvents, setCommunicationEvents] = useState<CommunicationEvent[]>([]);
  const [vaBriefs, setVaBriefs] = useState<VaDailyBrief[]>([]);
  const [vaBriefReviews, setVaBriefReviews] = useState<VaDailyBriefReview[]>([]);
  const [vaTimeEntries, setVaTimeEntries] = useState<VaTimeEntry[]>([]);
  const [leadActivities, setLeadActivities] = useState<ImportedLandLeadActivity[]>([]);
  const [, setNowTick] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  const surveys = useMemo(() => getAllSurveys(), []);

  useEffect(() => {
    const raw = localStorage.getItem("meridian_user");
    if (!raw) { router.push("/"); return; }
    if (isVaUser(raw)) { router.push("/va"); return; }
    const u = canonicalMember(raw);
    setUser(u);
    migrateLocalStorage(u);

    const totalsBySurvey: Record<string, number> = {};
    for (const s of surveys) totalsBySurvey[s.id] = s.categories.reduce((sum, c) => sum + c.questions.length, 0);

    const buildProgressFromCounts = (counts: Record<string, Record<string, number>>) => {
      const myProgress: SurveyProgress[] = surveys.map(s => {
        const total = totalsBySurvey[s.id];
        const answered = counts[s.id]?.[u] || 0;
        let status: SurveyProgress["status"] = "Not Started";
        if (answered >= total && total > 0) status = "Completed";
        else if (answered > 0) status = "In Progress";
        return { surveyId: s.id, title: s.title, description: s.description, answered, total, status };
      });
      setProgress(myProgress);
      setLoaded(true);
    };

    async function loadSharedData() {
      const [
        items,
        meeting,
        dealRows,
        projectRows,
        notices,
        reimbursementRows,
        trackerData,
        hub,
        candidateVoteRows,
        proposalVoteRows,
        dealVoteRows,
        communicationRows,
        briefRows,
        timeRows,
        activityRows,
      ] = await Promise.all([
        fetchActionItems(),
        fetchNextMeeting(),
        fetchDeals(),
        fetchProjects(),
        fetchNotifications(u),
        fetchReimbursements(),
        fetchAll(),
        fetchHubData(),
        fetchPendingMembershipCandidateVotes(u),
        fetchPendingExpenseProposalVotes(u),
        fetchPendingDealVotes(u),
        fetchCommunicationEvents({ limit: 30 }),
        fetchVaDailyBriefs(5),
        fetchVaTimeEntries(20),
        fetchImportedLandLeadActivities(undefined, 80),
      ]);

      setActionItems(items);
      setNextMeeting(meeting);
      setDeals(dealRows);
      setProjects(projectRows);
      setNotifications(notices);
      setPendingCandidateVotes(candidateVoteRows);
      setPendingProposalVotes(proposalVoteRows);
      setPendingDealVotes(dealVoteRows);
      setCommunicationEvents(communicationRows);
      setVaBriefs(briefRows);
      setVaTimeEntries(timeRows);
      setLeadActivities(activityRows);
      void fetchVaDailyBriefReviews(briefRows.map(brief => brief.id)).then(setVaBriefReviews);
      setReimbursements(reimbursementRows);
      setDecisions(hub.decisions.slice(0, 4));
      const activeMembers = trackerData ? activeTrackerMembers(trackerData.profiles) : MEMBERS.map(member => ({ name: member, llcName: member }));
      setMemberDirectory(activeMembers.map(({ name: member, llcName }) => {
        const trackerProfile = trackerData?.profiles.find(profile => profile.member_name === member);
        const hubProfile = hub.profiles[member];
        return {
          name: member,
          llcName: trackerProfile?.llc_name ?? llcName,
          isAdmin: trackerProfile?.is_admin === true,
          role: hubProfile?.role ?? "",
          contact: hubProfile?.contact ?? "",
          lastActive: hubProfile?.lastActive ?? "",
        };
      }));

      if (trackerData) {
        setCapitalCalls(trackerData.capitalCalls);
        const balances = computeMemberBalances({
          members: activeTrackerMembers(trackerData.profiles),
          expenses: trackerData.expenses,
          contributions: trackerData.contributions,
          capitalCalls: trackerData.capitalCalls,
          settings: trackerData.settings,
        });
        setMyBalance(balances.find(b => b.memberName === u) ?? null);
      }
    }

    const refreshInterval = window.setInterval(() => {
      void loadSharedData();
    }, 45000);
    const clockInterval = window.setInterval(() => {
      setNowTick(tick => tick + 1);
    }, 60000);

    if (!supabase) {
      const counts: Record<string, Record<string, number>> = {};
      for (const s of surveys) {
        counts[s.id] = {};
        const cached = localStorage.getItem(getStorageKey(s.id, u));
        if (!cached) continue;
        try {
          const data = JSON.parse(cached) as Record<string, unknown>;
          const answered = Object.values(data).filter(v => Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "").length;
          counts[s.id][u] = answered;
        } catch { /* ignore malformed cache */ }
      }
      buildProgressFromCounts(counts);
      void loadSharedData();
      return () => {
        window.clearInterval(refreshInterval);
        window.clearInterval(clockInterval);
      };
    }

    Promise.all([
      supabase.from("meridian_responses").select("member_name, survey_id"),
      loadSharedData(),
    ]).then(([respRes]) => {
      const counts: Record<string, Record<string, number>> = {};
      for (const row of respRes.data || []) {
        const sid = row.survey_id || "operating-agreement";
        const canonical = canonicalMember(row.member_name);
        if (!counts[sid]) counts[sid] = {};
        counts[sid][canonical] = (counts[sid][canonical] || 0) + 1;
      }
      buildProgressFromCounts(counts);
    });
    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(clockInterval);
    };
  }, [router, surveys]);

  if (!user) return null;

  const firstName = user.split(" ")[0];
  const { obsidian, brass, bone, fog, ink } = COLORS;

  const myItems = actionItems.filter(i => i.status !== "done" && isOwnedBy(i, user)).slice(0, 5);
  const pendingProposalIds = new Set(pendingProposalVotes.map(proposal => proposal.id));
  const pendingCandidateIds = new Set(pendingCandidateVotes.map(candidate => candidate.id));
  const pendingDealIds = new Set(pendingDealVotes.map(deal => deal.id));
  const proposalNotificationVotes = notifications.filter(n => EXPENSE_PROPOSAL_VOTE_TYPES.includes(n.notification_type) && !!n.source_id && pendingProposalIds.has(n.source_id));
  const candidateNotificationVotes = notifications.filter(n => n.notification_type === MEMBERSHIP_CANDIDATE_VOTE && !!n.source_id && pendingCandidateIds.has(n.source_id));
  const dealNotificationVotes = notifications.filter(n => DEAL_VOTE_TYPES.includes(n.notification_type) && !!n.source_id && pendingDealIds.has(n.source_id));
  const notificationVotes = [...proposalNotificationVotes, ...candidateNotificationVotes, ...dealNotificationVotes];
  const notifiedProposalIds = new Set(proposalNotificationVotes.map(n => n.source_id));
  const notifiedCandidateIds = new Set(candidateNotificationVotes.map(n => n.source_id));
  const notifiedDealIds = new Set(dealNotificationVotes.map(n => n.source_id));
  const voteNotificationIds = new Set(notificationVotes.map(n => n.id));
  const operationalNotifications = notifications.filter(n => !voteNotificationIds.has(n.id));
  const proposalVoteNotices: Notification[] = pendingProposalVotes
    .filter(proposal => !notifiedProposalIds.has(proposal.id))
    .map(proposal => ({
      id: `proposal-${proposal.id}`,
      title: `Expense proposal needs your vote: ${proposal.title}`,
      body: `Version ${proposal.revision_number ?? 1} is waiting for your review.`,
      notification_type: "expense_proposal_vote",
      priority: "high",
      assigned_to: user,
      href: `/tracker/planning?proposal=${proposal.id}`,
      source_table: "tracker_expense_proposals",
      source_id: proposal.id,
      read_at: null,
      created_at: proposal.submitted_at,
      created_by: "Expense Planning",
    }));
  const candidateVoteNotices: Notification[] = pendingCandidateVotes
    .filter(candidate => !notifiedCandidateIds.has(candidate.id))
    .map(candidate => ({
      id: `candidate-${candidate.id}`,
      title: `New member review: ${candidate.full_name}`,
      body: "Review readiness, capital, credit, relationships, and what this applicant can bring to Meridian.",
      notification_type: MEMBERSHIP_CANDIDATE_VOTE,
      priority: "high",
      assigned_to: user,
      href: `/members/candidates?candidate=${candidate.id}`,
      source_table: "membership_candidates",
      source_id: candidate.id,
      read_at: null,
      created_at: candidate.submitted_at,
      created_by: "Membership Application",
    }));
  const dealVoteNotices: Notification[] = pendingDealVotes
    .filter(deal => !notifiedDealIds.has(deal.id))
    .map(deal => ({
      id: `deal-${deal.id}`,
      title: `Deal needs your vote: ${deal.title}`,
      body: `${deal.recommendation ?? labelForStatus("needs-review")} · ${deal.urgency === "hot" ? "Hot Deal" : "Review Requested"}`,
      notification_type: "deal_vote",
      priority: deal.urgency === "hot" ? "urgent" : "high",
      assigned_to: user,
      href: `/opportunity?deal=${deal.id}`,
      source_table: "meridian_deals",
      source_id: deal.id,
      read_at: null,
      created_at: deal.submitted_at,
      created_by: "Deal Review",
    }));
  const pendingVotes = [...notificationVotes, ...proposalVoteNotices, ...candidateVoteNotices, ...dealVoteNotices];
  const openCapitalCalls = capitalCalls.filter(c => !c.deleted_at && c.status === "open");
  const suggestedCapitalCalls = capitalCalls.filter(c => !c.deleted_at && c.status === "suggested");
  const hotDeals = deals.filter(d => (d.urgency === "hot" || d.analysis?.recommendation === "Strong Review") && !pendingDealIds.has(d.id)).slice(0, 3);
  const sellerReplies = communicationEvents.filter(event => event.direction === "inbound");
  const unmatchedSellerReplies = sellerReplies.filter(event => !event.matched_lead_id && !event.matched_deal_id);
  const activeProjects = projects.filter(p => !["sold", "passed"].includes(p.status)).slice(0, 3);
  const pendingReimbursements = reimbursements.filter(r => r.status === "submitted" || r.status === "approved");
  const incompleteSurveys = progress.filter(p => p.status !== "Completed");
  const taskInboxCount = pendingVotes.length + myItems.length + openCapitalCalls.length + suggestedCapitalCalls.length + incompleteSurveys.length;
  const dealReviewCount = pendingDealVotes.length + hotDeals.length;
  const latestVaBrief = vaBriefs[0] ?? null;
  const latestVaBriefReviewedByMe = latestVaBrief ? vaBriefReviews.some(review => review.brief_id === latestVaBrief.id && review.member_name === user) : false;
  const unreviewedVaBriefs = vaBriefs.filter(brief => !vaBriefReviews.some(review => review.brief_id === brief.id && review.member_name === user));
  const operationsCount = openCapitalCalls.length + suggestedCapitalCalls.length + pendingReimbursements.length + unmatchedSellerReplies.length + unreviewedVaBriefs.length;
  const firstIncompleteSurvey = incompleteSurveys[0];
  const firstPendingCandidate = pendingCandidateVotes[0];
  const todayKey = vaDateKey(new Date().toISOString());
  const openVaShift = vaTimeEntries.find(entry => entry.status === "open" && !entry.clock_out_at) ?? null;
  const latestVaShift = vaTimeEntries[0] ?? null;
  const liveShiftMinutes = currentShiftMinutes(openVaShift);
  const todayLeadActivities = leadActivities.filter(activityRow => vaDateKey(activityRow.created_at) === todayKey);
  const todayComms = communicationEvents.filter(event => vaDateKey(event.created_at) === todayKey);
  const todayCompletedVaTasks = actionItems.filter(item =>
    item.task_type === "va-work"
    && item.status === "done"
    && item.completed_at
    && vaDateKey(item.completed_at) === todayKey
  );
  const todayDealBriefs = deals.filter(deal => vaDateKey(deal.last_submitted_at ?? deal.first_submitted_at ?? deal.created_at) === todayKey);
  const todayLeadIds = new Set([
    ...todayLeadActivities.map(activityRow => activityRow.lead_id),
    ...todayComms.map(event => event.matched_lead_id).filter((id): id is string => Boolean(id)),
  ]);
  const vaOperator = openVaShift?.operator_name || latestVaBrief?.submitted_by || latestVaShift?.operator_name || "VA";
  const vaIsOnline = !!openVaShift;
  const liveFeed = [
    ...todayLeadActivities.map(activityRow => ({
      id: `lead-activity-${activityRow.id}`,
      label: labelForStatus(activityRow.activity_type),
      title: activityRow.summary || labelForStatus(activityRow.activity_type),
      detail: activityRow.next_follow_up_date ? `Follow-up set for ${activityRow.next_follow_up_date}` : activityRow.actor || "Lead activity",
      date: activityRow.created_at,
      href: `/opportunity?lead=${activityRow.lead_id}`,
    })),
    ...todayComms.map(event => ({
      id: `comm-${event.id}`,
      label: event.direction === "outbound" ? "Text Sent" : event.direction === "inbound" ? "Reply" : "SMS",
      title: event.contact_name || event.contact_number || event.from_number || "Seller message",
      detail: event.body || event.status || labelForStatus(event.provider_event_type),
      date: event.created_at,
      href: event.matched_deal_id ? `/opportunity?deal=${event.matched_deal_id}` : event.matched_lead_id ? `/opportunity?lead=${event.matched_lead_id}` : "/crm?view=inbox",
    })),
    ...todayCompletedVaTasks.map(item => ({
      id: `task-${item.id}`,
      label: "Task Done",
      title: item.title,
      detail: item.completion_note || "Member-assigned VA task completed.",
      date: item.completed_at || item.updated_at,
      href: `/actions?task=${item.id}`,
    })),
    ...todayDealBriefs.map(deal => ({
      id: `deal-${deal.id}`,
      label: "Deal Brief",
      title: deal.title,
      detail: deal.submission_summary || deal.address || deal.parcel_id || "Deal packet created.",
      date: deal.last_submitted_at ?? deal.first_submitted_at ?? deal.created_at,
      href: `/opportunity?deal=${deal.id}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const vaLiveStats = [
    { label: "Texts", value: todayComms.filter(event => event.direction === "outbound").length },
    { label: "Replies", value: todayComms.filter(event => event.direction === "inbound").length },
    { label: "Calls", value: todayLeadActivities.filter(activityRow => activityRow.activity_type === "called" || activityRow.activity_type === "left-voicemail").length },
    { label: "Leads", value: todayLeadIds.size },
    { label: "Tasks", value: todayCompletedVaTasks.length },
    { label: "Packets", value: todayDealBriefs.length },
  ];
  const attentionRows = [
    ...pendingVotes.slice(0, 3).map(notice => ({
      id: notice.id,
      label: notice.notification_type.includes("deal") ? "Deal Vote" : "Vote",
      title: notice.title,
      detail: notice.body || "Member decision needed.",
      href: notice.href || "/actions",
      action: "Review",
      urgent: true,
    })),
    ...myItems.slice(0, 3).map(item => ({
      id: item.id,
      label: item.task_type === "va-work" ? "VA Task" : "Task",
      title: item.title,
      detail: `${item.status === "in-progress" ? "In progress" : "Open"}${formatDueDate(item.due_date) ? ` · Due ${formatDueDate(item.due_date)}` : ""}`,
      href: `/actions?task=${item.id}`,
      action: "Open",
      urgent: item.priority === "high" || item.priority === "urgent",
    })),
    ...(openCapitalCalls.length + suggestedCapitalCalls.length > 0 ? [{
      id: "capital-work",
      label: "Money",
      title: "Capital items need review",
      detail: `${openCapitalCalls.length} open capital call${openCapitalCalls.length === 1 ? "" : "s"} · ${suggestedCapitalCalls.length} suggested`,
      href: "/tracker/planning",
      action: "Review",
      urgent: openCapitalCalls.length > 0,
    }] : []),
    ...(unreviewedVaBriefs.length > 0 ? [{
      id: "va-brief-review",
      label: "VA Brief",
      title: "Daily brief needs member review",
      detail: latestVaBrief ? `${formatActivityDate(latestVaBrief.work_date)} · ${latestVaBrief.submitted_by}` : "Latest shift summary is waiting.",
      href: "/operations?tab=va-briefs",
      action: "Review",
      urgent: true,
    }] : []),
    ...(unmatchedSellerReplies.length > 0 ? [{
      id: "seller-replies",
      label: "Seller Reply",
      title: "Unmatched seller replies",
      detail: `${unmatchedSellerReplies.length} message${unmatchedSellerReplies.length === 1 ? "" : "s"} need CRM matching.`,
      href: "/crm?view=inbox",
      action: "Open CRM",
      urgent: true,
    }] : []),
    ...(incompleteSurveys.length > 0 ? [{
      id: "survey-progress",
      label: "Survey",
      title: "Survey answers incomplete",
      detail: `${incompleteSurveys.length} survey${incompleteSurveys.length === 1 ? "" : "s"} still need answers.`,
      href: firstIncompleteSurvey ? `/survey/${firstIncompleteSurvey.surveyId}` : "/surveys",
      action: "Continue",
      urgent: false,
    }] : []),
  ].slice(0, 10);
  const secondaryTools = [
    { label: "Documents", detail: "Agreements, runbooks, and records", href: "/documents", count: 0 },
    { label: "Meetings", detail: nextMeeting?.meeting_date ? formatMeetingDate(nextMeeting.meeting_date) || "Scheduled" : "Agenda and notes", href: "/meetings", count: nextMeeting?.meeting_date ? 1 : 0 },
    { label: "Applications", detail: "Candidate/member reviews", href: firstPendingCandidate ? `/members/candidates?candidate=${firstPendingCandidate.id}` : "/members/candidates", count: pendingCandidateVotes.length },
    { label: "Surveys", detail: "Formation and member inputs", href: firstIncompleteSurvey ? `/survey/${firstIncompleteSurvey.surveyId}` : "/surveys", count: incompleteSurveys.length },
    { label: "Directory", detail: `${memberDirectory.length || MEMBERS.length} member profiles`, href: "/hub", count: memberDirectory.length || MEMBERS.length },
    { label: "Archive", detail: "Announcements and legacy records", href: "/hub", count: decisions.length },
  ];
  const memberHeaderStats = [
    {
      label: "Review Queue",
      value: taskInboxCount,
      detail: "Votes, tasks, capital items, and surveys waiting.",
      action: "Open Tasks",
      onAction: () => router.push("/actions?filter=needs-me"),
      tone: taskInboxCount ? "hot" as const : "default" as const,
    },
    {
      label: "Deal Reviews",
      value: dealReviewCount,
      detail: "Packets or hot deals that need member attention.",
      action: "Review Deals",
      onAction: () => router.push("/deals"),
      tone: dealReviewCount ? "hot" as const : "default" as const,
    },
    {
      label: "Operations",
      value: operationsCount,
      detail: "VA briefs, money items, reimbursements, and seller replies.",
      action: "Open Ops",
      onAction: () => router.push(unreviewedVaBriefs.length ? "/operations?tab=va-briefs" : pendingReimbursements.length ? "/operations?tab=finance" : "/operations?tab=overview"),
      tone: operationsCount ? "hot" as const : "default" as const,
    },
    {
      label: "Active Projects",
      value: activeProjects.length,
      detail: latestVaBrief && !latestVaBriefReviewedByMe ? "Latest VA brief still needs review." : "Projects and VA updates are connected here.",
      action: latestVaBrief && !latestVaBriefReviewedByMe ? "Review Brief" : "Open Projects",
      onAction: () => router.push(latestVaBrief && !latestVaBriefReviewedByMe ? "/operations?tab=va-briefs" : "/projects"),
      tone: latestVaBrief && !latestVaBriefReviewedByMe ? "hot" as const : "default" as const,
    },
  ];

  const activity = [
    ...operationalNotifications.slice(0, 4).map(n => ({
      id: `notice-${n.id}`,
      title: n.title,
      detail: n.body || "Notification",
      date: n.created_at,
      href: n.href || "/dashboard",
    })),
    ...decisions.slice(0, 3).map(d => ({
      id: `decision-${d.id}`,
      title: d.description,
      detail: d.outcome || "Decision logged",
      date: d.date,
      href: "/hub",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const dismissNotice = async (notice: Notification) => {
    await markNotificationRead(notice.id);
    setNotifications(prev => prev.filter(n => n.id !== notice.id));
    setMessage("Notification cleared.");
  };

  return (
    <div
      className="dashboard-root"
      style={{ minHeight: "100vh", background: bone, color: ink, fontFamily: BODY_FONT, padding: "84px 20px 40px" }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <OperatingHeader
          eyebrow="Member Portal"
          title={`Welcome back, ${firstName}`}
          subtitle="Your command center for deal votes, VA updates, money decisions, operations, projects, and assigned work."
          user={user}
          mode="member"
          actions={
            <>
            <button
              onClick={() => router.push("/actions?new=va")}
              style={{
                background: "transparent",
                color: obsidian,
                border: `1px solid ${brass}`,
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Assign VA Task
            </button>
            <button
              onClick={() => router.push("/actions")}
              style={{
                background: obsidian,
                color: bone,
                border: "none",
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Open My Tasks
            </button>
            </>
          }
          stats={memberHeaderStats}
        />

        {message && (
          <div style={{
            border: "1px solid rgba(176,137,84,0.36)",
            background: "rgba(176,137,84,0.10)",
            color: obsidian,
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
            <button onClick={() => setMessage("")} style={{ background: "transparent", border: "none", color: brass, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Clear</button>
          </div>
        )}

        <section className="dashboard-command-layout">
          <Panel title="Needs My Attention" cta={{ label: "Open tasks", onClick: () => router.push("/actions?filter=needs-me") }} variant="featured">
            <p style={{ fontSize: 13, color: ink, opacity: 0.62, marginBottom: 2 }}>
              {attentionRows.length ? `${attentionRows.length} item${attentionRows.length === 1 ? "" : "s"} need a decision, review, or follow-up.` : "No urgent member work is waiting."}
            </p>
            {!loaded && <SkeletonCard />}
            {loaded && attentionRows.length === 0 && <EmptyText>No decisions, blockers, seller exceptions, or assigned work are waiting.</EmptyText>}
            <div style={{ display: "grid", gap: 7 }}>
              {attentionRows.map(row => (
                <AttentionRow
                  key={row.id}
                  label={row.label}
                  title={row.title}
                  detail={row.detail}
                  action={row.action}
                  urgent={row.urgent}
                  onClick={() => router.push(row.href)}
                />
              ))}
            </div>
            {operationalNotifications.length > 0 && (
              <div style={{ display: "grid", gap: 7, marginTop: 4 }}>
                {operationalNotifications.slice(0, 2).map(notice => (
                  <NoticeRow
                    key={notice.id}
                    title={notice.title}
                    detail={notice.body || "Notification"}
                    urgent={notice.priority === "urgent"}
                    onOpen={() => notice.href && router.push(notice.href)}
                    onClear={() => dismissNotice(notice)}
                  />
                ))}
              </div>
            )}
          </Panel>

          <div className="dashboard-side-stack">
            <Panel title="Deal Review Queue" cta={{ label: "Deal reviews", onClick: () => router.push("/deals") }}>
              {pendingDealVotes.length === 0 && hotDeals.length === 0 ? (
                <EmptyText>No deal packets need member review right now.</EmptyText>
              ) : (
                <>
                  {pendingDealVotes.slice(0, 3).map(deal => (
                    <DealQueueItem
                      key={`vote-${deal.id}`}
                      label="Vote needed"
                      title={deal.title}
                      detail={deal.recommendation ?? "Review requested"}
                      meta={deal.urgency === "hot" ? "Hot" : "Member vote"}
                      onClick={() => router.push(`/opportunity?deal=${deal.id}`)}
                    />
                  ))}
                  {hotDeals.slice(0, Math.max(0, 3 - pendingDealVotes.length)).map(deal => (
                    <DealQueueItem
                      key={`hot-${deal.id}`}
                      label={deal.urgency === "hot" ? "Hot deal" : "Strong review"}
                      title={deal.title}
                      detail={deal.address || deal.parcel_id || "Location pending"}
                      meta={deal.analysis?.recommendation ?? "Review"}
                      onClick={() => router.push(`/opportunity?deal=${deal.id}`)}
                    />
                  ))}
                </>
              )}
            </Panel>

            <Panel title="VA Desk Today" cta={{ label: "Review brief", onClick: () => router.push("/operations?tab=va-briefs") }}>
              <div style={briefSummaryStyle}>
                <div>
                  <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
                    {vaIsOnline ? `${vaOperator} is online` : `${vaOperator} is offline`}
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 850, color: COLORS.obsidian }}>
                    {vaIsOnline
                      ? `Clocked in ${formatActivityTime(openVaShift?.clock_in_at)} · ${formatDuration(liveShiftMinutes)} on shift`
                      : latestVaShift?.clock_out_at
                        ? `Last clocked out ${formatActivityTime(latestVaShift.clock_out_at)}`
                        : "No active shift logged today."}
                  </p>
                </div>
                <Badge>{vaIsOnline ? "Live" : "Offline"}</Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }} className="brief-metrics">
                {vaLiveStats.map(stat => (
                  <BriefMetric key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </div>

              <div style={listItemStyle}>
                <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Live activity</p>
                {liveFeed.length === 0 ? (
                  <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.66, lineHeight: 1.45 }}>
                    No calls, texts, lead updates, packets, or completed VA tasks have posted today yet.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 7 }}>
                    {liveFeed.slice(0, 4).map(event => (
                      <button key={event.id} onClick={() => router.push(event.href)} style={liveActivityButtonStyle}>
                        <span style={{ color: COLORS.brass, fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>{formatActivityTime(event.date)} · {event.label}</span>
                        <strong style={{ color: COLORS.obsidian, fontSize: 12, lineHeight: 1.25 }}>{event.title}</strong>
                        <small style={{ color: COLORS.ink, opacity: 0.68, fontSize: 11, lineHeight: 1.35 }}>{event.detail}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!latestVaBrief ? (
                <div style={listItemStyle}>
                  <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Daily brief</p>
                  <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.7, lineHeight: 1.45 }}>
                    End-of-shift brief pending.
                  </p>
                </div>
              ) : (
                <div style={listItemStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>Daily brief</p>
                      <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.72, marginTop: 2 }}>
                        {formatActivityDate(latestVaBrief.work_date)} · {latestVaBrief.submitted_by}
                      </p>
                    </div>
                    <Badge>{latestVaBriefReviewedByMe ? "Reviewed" : "Needs review"}</Badge>
                  </div>
                  <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.72, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                    {latestVaBrief.activities_completed}
                  </p>
                  {latestVaBrief.blockers && (
                    <p style={{ fontSize: 12, color: COLORS.obsidian, opacity: 0.86, lineHeight: 1.45, marginTop: 8, whiteSpace: "pre-wrap" }}>
                      Blockers: {latestVaBrief.blockers}
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </section>

        <section className="dashboard-ops-grid">
          <Panel title="Money & Approvals" cta={{ label: "Money center", onClick: () => router.push("/tracker/planning") }}>
            {myBalance ? (
              <>
                <MoneyHero value={fmtUSD(myBalance.totalRemaining, { fractionDigits: 2 })} label="My remaining balance" />
                <MoneyRow label="Open capital calls" value={String(openCapitalCalls.length)} />
                <MoneyRow label="Suggested capital calls" value={String(suggestedCapitalCalls.length)} />
                <MoneyRow label="Reimbursements pending" value={String(pendingReimbursements.length)} />
                <button onClick={() => router.push("/tracker/planning")} style={inlineLinkStyle}>Open approvals →</button>
              </>
            ) : (
              <EmptyText>No balance data is available yet.</EmptyText>
            )}
          </Panel>

          <Panel title="Active Projects & Closings" cta={{ label: "Projects", onClick: () => router.push("/projects") }}>
            {activeProjects.length === 0 && <EmptyText>No active projects are waiting for member attention.</EmptyText>}
            {activeProjects.map(project => (
              <SignalItem
                key={project.id}
                label={labelForStatus(project.status)}
                title={project.name}
                detail={project.next_step || "Next step pending"}
                onClick={() => router.push(`/projects?project=${project.id}`)}
              />
            ))}
            {pendingReimbursements.slice(0, 1).map(item => (
              <SignalItem
                key={item.id}
                label="Finance"
                title={`${item.member_name} reimbursement`}
                detail={`${Number(item.amount).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} · ${item.vendor || item.category}`}
                onClick={() => router.push("/operations?tab=finance")}
              />
            ))}
          </Panel>

          <Panel title="Seller Communication Alerts" cta={{ label: "CRM inbox", onClick: () => router.push("/crm?view=inbox") }}>
            {sellerReplies.length === 0 && <EmptyText>No seller texts have arrived yet.</EmptyText>}
            {unmatchedSellerReplies.length > 0 && (
              <div style={{ ...listItemStyle, borderColor: "rgba(176,137,84,0.45)", background: "rgba(176,137,84,0.08)" }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: obsidian, marginBottom: 3 }}>
                  {unmatchedSellerReplies.length} unmatched seller repl{unmatchedSellerReplies.length === 1 ? "y" : "ies"}
                </p>
                <p style={{ fontSize: 12, color: ink, opacity: 0.7, lineHeight: 1.45 }}>
                  Needs matching to an imported lead or a new deal draft.
                </p>
              </div>
            )}
            {sellerReplies.slice(0, 4).map(event => (
              <SignalItem
                key={event.id}
                label={event.matched_deal_id ? "Matched deal" : event.matched_lead_id ? "Matched lead" : "Unmatched"}
                title={event.contact_name || event.contact_number || event.from_number || "Unknown sender"}
                detail={event.body || event.status || event.provider_event_type}
                onClick={() => router.push(event.matched_deal_id ? `/opportunity?deal=${event.matched_deal_id}` : event.matched_lead_id ? `/opportunity?lead=${event.matched_lead_id}` : "/crm")}
              />
            ))}
          </Panel>
        </section>

        <section className="dashboard-two-col" style={{ marginBottom: 20 }}>
          <Panel title="Recent Activity" cta={{ label: "Activity hub", onClick: () => router.push("/hub") }}>
            {activity.length === 0 && <EmptyText>No recent activity yet.</EmptyText>}
            {activity.map(item => (
              <SignalItem
                key={item.id}
                label={formatActivityDate(item.date)}
                title={item.title}
                detail={item.detail}
                onClick={() => router.push(item.href)}
              />
            ))}
          </Panel>

          <Panel title="Upcoming Meeting" cta={{ label: "Meeting hub", onClick: () => router.push("/meetings") }}>
            <div style={{ ...listItemStyle, background: obsidian, color: bone, borderColor: "rgba(20,17,13,0.88)" }}>
              <p style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: brass, fontWeight: 900, marginBottom: 5 }}>Next meeting</p>
              <h3 style={{ fontFamily: DISPLAY_FONT, fontSize: 25, fontWeight: 500, color: bone, lineHeight: 1.05, letterSpacing: 0 }}>
                {formatMeetingDate(nextMeeting?.meeting_date ?? null) ?? "Meeting date pending"}
              </h3>
              <p style={{ fontSize: 13, color: fog, marginTop: 4 }}>{nextMeeting?.meeting_time ?? "Time pending"}</p>
            </div>
            {nextMeeting?.agenda && (
              <pre style={{
                fontFamily: BODY_FONT,
                fontSize: 13,
                color: ink,
                opacity: 0.72,
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
                margin: 0,
              }}>
                {nextMeeting.agenda}
              </pre>
            )}
          </Panel>
        </section>

        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: brass, fontWeight: 900 }}>Secondary tools</p>
              <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 24, fontWeight: 500, color: obsidian, letterSpacing: 0 }}>Reference, records, and formation work</h2>
            </div>
          </div>
          <div className="secondary-tool-grid">
            {secondaryTools.map(tool => (
              <button key={tool.label} onClick={() => router.push(tool.href)} style={secondaryToolStyle}>
                <span>
                  <strong>{tool.label}</strong>
                  <small>{tool.detail}</small>
                </span>
                <em>{tool.count}</em>
              </button>
            ))}
          </div>
        </section>
      </div>

      <style jsx>{`
        .dashboard-command-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.85fr);
          gap: 16px;
          align-items: start;
        }
        .dashboard-side-stack {
          display: grid;
          gap: 16px;
          align-content: start;
        }
        .dashboard-ops-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .dashboard-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .secondary-tool-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 1080px) {
          .dashboard-command-layout,
          .dashboard-ops-grid,
          .dashboard-two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .dashboard-root { padding-top: 28px !important; }
          .secondary-tool-grid,
          .brief-metrics { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function AttentionRow({ label, title, detail, action, urgent, onClick }: { label: string; title: string; detail: string; action: string; urgent?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...attentionRowStyle, borderColor: urgent ? "rgba(20,17,13,0.78)" : "var(--fog)" }}>
      <span style={{ minWidth: 104 }}>
        <em style={rowEyebrowStyle}>{label}</em>
      </span>
      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <strong style={{ color: COLORS.obsidian, fontSize: 14, lineHeight: 1.25 }}>{title}</strong>
        <small style={{ color: COLORS.ink, opacity: 0.68, fontSize: 12, lineHeight: 1.35 }}>{detail}</small>
      </span>
      <span style={{ ...inlineLinkStyle, whiteSpace: "nowrap", justifySelf: "end" }}>{action} →</span>
    </button>
  );
}

function NoticeRow({ title, detail, urgent, onOpen, onClear }: { title: string; detail: string; urgent?: boolean; onOpen: () => void; onClear: () => void }) {
  return (
    <div style={{ ...attentionRowStyle, background: urgent ? "rgba(20,17,13,0.08)" : "rgba(176,137,84,0.08)", borderColor: urgent ? COLORS.obsidian : "rgba(176,137,84,0.45)" }}>
      <button onClick={onOpen} style={{ background: "transparent", border: "none", display: "grid", gap: 2, textAlign: "left", minWidth: 0 }}>
        <em style={rowEyebrowStyle}>Notice</em>
        <strong style={{ color: COLORS.obsidian, fontSize: 14, lineHeight: 1.25 }}>{title}</strong>
        <small style={{ color: COLORS.ink, opacity: 0.68, fontSize: 12, lineHeight: 1.35 }}>{detail}</small>
      </button>
      <button onClick={onClear} style={{ ...inlineLinkStyle, whiteSpace: "nowrap", justifySelf: "end" }}>Clear</button>
    </div>
  );
}

function DealQueueItem({ label, title, detail, meta, onClick }: { label: string; title: string; detail: string; meta: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...listItemStyle, textAlign: "left", cursor: "pointer", padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
        <p style={rowEyebrowStyle}>{label}</p>
        <Badge>{meta}</Badge>
      </div>
      <p style={{ fontSize: 14, fontWeight: 850, color: COLORS.obsidian, lineHeight: 1.25, marginTop: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.66, lineHeight: 1.35, marginTop: 2 }}>{detail}</p>
    </button>
  );
}

function Panel({ title, cta, children, variant = "default" }: { title: string; cta: { label: string; onClick: () => void }; children: React.ReactNode; variant?: "default" | "featured" }) {
  return (
    <section style={{ ...cardStyle, minHeight: variant === "featured" ? 410 : 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
        <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 24, fontWeight: 500, color: COLORS.obsidian, letterSpacing: 0 }}>{title}</h2>
        <button onClick={cta.onClick} style={inlineLinkStyle}>{cta.label} →</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </section>
  );
}

function MoneyHero({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ borderBottom: "1px solid var(--fog)", paddingBottom: 12, marginBottom: 2 }}>
      <p style={{ fontSize: 32, fontWeight: 900, color: COLORS.obsidian, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.64, marginTop: 4 }}>{label}</p>
    </div>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", alignItems: "baseline" }}>
      <span style={{ fontSize: 13, color: COLORS.ink, opacity: 0.72 }}>{label}</span>
      <strong style={{ fontSize: 14, color: COLORS.obsidian, fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    </div>
  );
}

function BriefMetric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: "var(--bone)",
      border: "1px solid var(--fog)",
      borderRadius: 8,
      padding: "10px 8px",
    }}>
      <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.13em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, color: COLORS.obsidian, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

function SignalItem({ label, title, detail, onClick }: { label: string; title: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...listItemStyle, textAlign: "left", cursor: "pointer" }}>
      <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.obsidian, marginBottom: 3 }}>{title}</p>
      <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.68, lineHeight: 1.45 }}>{detail}</p>
    </button>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: COLORS.ink, opacity: 0.58 }}>{children}</p>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: COLORS.brass,
      fontWeight: 800,
      padding: "2px 8px",
      borderRadius: 999,
      border: `1px solid ${COLORS.brass}`,
    }}>{children}</span>
  );
}

function SkeletonCard() {
  return <div style={{ background: "var(--surface)", border: `1px solid ${COLORS.fog}`, borderRadius: 12, padding: "14px 16px", height: 92, opacity: 0.5 }} />;
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 12,
  padding: "16px 18px",
  color: "var(--ink)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const listItemStyle: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: "12px 14px",
  color: "var(--ink)",
};

const attentionRowStyle: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  color: "var(--ink)",
  cursor: "pointer",
  display: "grid",
  gridTemplateColumns: "110px minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "center",
  padding: "11px 12px",
  textAlign: "left",
  width: "100%",
};

const rowEyebrowStyle: React.CSSProperties = {
  color: COLORS.brass,
  fontSize: 10,
  fontStyle: "normal",
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const briefSummaryStyle: React.CSSProperties = {
  background: "rgba(201,168,120,0.10)",
  border: "1px solid rgba(201,168,120,0.34)",
  borderRadius: 10,
  padding: "12px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const liveActivityButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  borderTop: "1px solid var(--fog)",
  cursor: "pointer",
  display: "grid",
  gap: 2,
  padding: "8px 0 0",
  textAlign: "left",
  width: "100%",
};

const inlineLinkStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--brass)",
  border: "none",
  padding: 0,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: BODY_FONT,
};

const secondaryToolStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--ink)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: "12px 13px",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  fontFamily: BODY_FONT,
};
