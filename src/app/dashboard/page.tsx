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
  updateActionItemStatus,
  type ActionItem,
} from "@/lib/action-items";
import { fetchNextMeeting, type NextMeeting } from "@/lib/meetings";
import { fetchDeals, type Deal } from "@/lib/deals";
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

const QUICK_LINKS: Array<{ title: string; href: string; eyebrow: string; external?: boolean }> = [
  { title: "Task Inbox", eyebrow: "Needs Review", href: "/actions" },
  { title: "Deal Reviews", eyebrow: "Packets", href: "/deals" },
  { title: "Money Approvals", eyebrow: "Capital", href: "/tracker/planning" },
  { title: "Operations", eyebrow: "VA + Finance", href: "/operations" },
  { title: "Applications", eyebrow: "Member Review", href: "/members/candidates" },
  { title: "My Balances", eyebrow: "Money", href: "/tracker/members" },
  { title: "Documents", eyebrow: "Records", href: "/documents" },
];

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
      void fetchVaDailyBriefReviews(briefRows.map(brief => brief.id)).then(setVaBriefReviews);
      setReimbursements(reimbursementRows);
      setDecisions(hub.decisions.slice(0, 4));
      setMemberDirectory(MEMBERS.map(member => {
        const trackerProfile = trackerData?.profiles.find(profile => profile.member_name === member);
        const hubProfile = hub.profiles[member];
        return {
          name: member,
          llcName: trackerProfile?.llc_name ?? null,
          isAdmin: trackerProfile?.is_admin === true,
          role: hubProfile?.role ?? "",
          contact: hubProfile?.contact ?? "",
          lastActive: hubProfile?.lastActive ?? "",
        };
      }));

      if (trackerData) {
        setCapitalCalls(trackerData.capitalCalls);
        const balances = computeMemberBalances({
          members: MEMBERS.map(m => ({
            name: m,
            llcName: trackerData.profiles.find(p => p.member_name === m)?.llc_name || m,
          })),
          expenses: trackerData.expenses,
          contributions: trackerData.contributions,
          capitalCalls: trackerData.capitalCalls,
          settings: trackerData.settings,
        });
        setMyBalance(balances.find(b => b.memberName === u) ?? null);
      }
    }

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
      return;
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
  const previewVotes = pendingVotes.slice(0, 4);
  const previewActions = myItems.slice(0, Math.max(0, 4 - previewVotes.length));
  const previewSurveys = incompleteSurveys.slice(0, Math.max(0, 4 - previewVotes.length - previewActions.length));
  const taskInboxCount = pendingVotes.length + myItems.length + openCapitalCalls.length + suggestedCapitalCalls.length + incompleteSurveys.length;
  const attentionCount = taskInboxCount + unmatchedSellerReplies.length;
  const dealReviewCount = pendingDealVotes.length + hotDeals.length;
  const latestVaBrief = vaBriefs[0] ?? null;
  const latestVaBriefReviewedByMe = latestVaBrief ? vaBriefReviews.some(review => review.brief_id === latestVaBrief.id && review.member_name === user) : false;
  const unreviewedVaBriefs = vaBriefs.filter(brief => !vaBriefReviews.some(review => review.brief_id === brief.id && review.member_name === user));
  const operationsCount = openCapitalCalls.length + suggestedCapitalCalls.length + pendingReimbursements.length + unmatchedSellerReplies.length + unreviewedVaBriefs.length;
  const memberHeaderStats = [
    {
      label: "Review Queue",
      value: taskInboxCount,
      detail: "Votes, tasks, capital items, and surveys waiting.",
      action: "Open Tasks",
      onAction: () => router.push("/actions"),
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
      onAction: () => router.push("/operations"),
      tone: operationsCount ? "hot" as const : "default" as const,
    },
    {
      label: "Active Projects",
      value: activeProjects.length,
      detail: latestVaBrief && !latestVaBriefReviewedByMe ? "Latest VA brief still needs review." : "Projects and VA updates are connected here.",
      action: latestVaBrief && !latestVaBriefReviewedByMe ? "Review Brief" : "Open Projects",
      onAction: () => router.push(latestVaBrief && !latestVaBriefReviewedByMe ? "/operations" : "/projects"),
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

  const handleMarkDone = async (item: ActionItem) => {
    const { error } = await updateActionItemStatus(item.id, "done", user);
    if (error) { setMessage(error); return; }
    setActionItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "done", completed_at: new Date().toISOString() } : i));
    setMessage("Task marked done.");
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

        <section style={{ marginBottom: 28 }}>
          <SectionHeader
            title="Member Decision Center"
            subtitle={attentionCount ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need review, follow-up, or monitoring.` : "No urgent member work is waiting."}
            cta={{ label: "Open my tasks", onClick: () => router.push("/actions") }}
          />
          <div className="member-command-grid">
            <DecisionCenterCard
              title="My Review Queue"
              count={taskInboxCount}
              eyebrow="Votes / Tasks / Surveys"
              actionLabel="Open My Tasks"
              onAction={() => router.push("/actions")}
            >
              <DecisionQueueRow label="Votes waiting" value={pendingVotes.length} urgent={pendingVotes.length > 0} />
              <DecisionQueueRow label="Assigned actions" value={myItems.length} urgent={myItems.length > 0} />
              <DecisionQueueRow label="Capital items" value={openCapitalCalls.length + suggestedCapitalCalls.length} urgent={openCapitalCalls.length > 0} />
              <DecisionQueueRow label="Surveys incomplete" value={incompleteSurveys.length} urgent={incompleteSurveys.length > 0} />
            </DecisionCenterCard>

            <DecisionCenterCard
              title="Deal Reviews"
              count={dealReviewCount}
              eyebrow="Packets / Calculator / Vote"
              actionLabel="Open Deal Reviews"
              onAction={() => router.push("/deals")}
            >
              {pendingDealVotes.length === 0 && hotDeals.length === 0 ? (
                <EmptyText>No deal packets need member review right now.</EmptyText>
              ) : (
                <>
                  {pendingDealVotes.slice(0, 2).map(deal => (
                    <MiniRecordButton
                      key={`vote-${deal.id}`}
                      label="Vote needed"
                      title={deal.title}
                      detail={deal.recommendation ?? "Review Requested"}
                      onClick={() => router.push(`/opportunity?deal=${deal.id}`)}
                    />
                  ))}
                  {hotDeals.slice(0, Math.max(0, 3 - pendingDealVotes.length)).map(deal => (
                    <MiniRecordButton
                      key={`hot-${deal.id}`}
                      label={deal.urgency === "hot" ? "Hot Deal" : "Strong Review"}
                      title={deal.title}
                      detail={deal.address || deal.parcel_id || "Location pending"}
                      onClick={() => router.push(`/opportunity?deal=${deal.id}`)}
                    />
                  ))}
                </>
              )}
            </DecisionCenterCard>

            <DecisionCenterCard
              title="Operations Watch"
              count={operationsCount}
              eyebrow="Money / VA / Seller Replies"
              actionLabel="Open Operations"
              onAction={() => router.push("/operations")}
            >
              <DecisionQueueRow label="Capital calls" value={openCapitalCalls.length + suggestedCapitalCalls.length} urgent={openCapitalCalls.length > 0} />
              <DecisionQueueRow label="Reimbursements" value={pendingReimbursements.length} urgent={pendingReimbursements.length > 0} />
              <DecisionQueueRow label="Unmatched seller replies" value={unmatchedSellerReplies.length} urgent={unmatchedSellerReplies.length > 0} />
              <DecisionQueueRow label="VA briefs to review" value={unreviewedVaBriefs.length} urgent={unreviewedVaBriefs.length > 0} />
              <DecisionQueueRow label="Next meeting" value={nextMeeting?.meeting_date ? 1 : 0} />
            </DecisionCenterCard>
          </div>

          {operationalNotifications.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {operationalNotifications.slice(0, 3).map(notice => (
                <div key={notice.id} style={{
                  background: notice.priority === "urgent" ? "rgba(20,17,13,0.10)" : "rgba(176,137,84,0.12)",
                  border: `1px solid ${notice.priority === "urgent" ? obsidian : brass}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}>
                  <button
                    onClick={() => notice.href && router.push(notice.href)}
                    style={{ background: "transparent", border: "none", textAlign: "left", cursor: notice.href ? "pointer" : "default", flex: 1 }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 800, color: obsidian }}>{notice.title}</p>
                    {notice.body && <p style={{ fontSize: 12, color: ink, opacity: 0.7 }}>{notice.body}</p>}
                  </button>
                  <button onClick={() => dismissNotice(notice)} style={{ background: "transparent", border: "none", color: brass, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
                    Clear
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-two-col" style={{ marginBottom: 28 }}>
          <Panel title="My Money" cta={{ label: "Balances", onClick: () => router.push("/tracker/members") }}>
            {myBalance ? (
              <>
                <MoneyHero value={fmtUSD(myBalance.totalRemaining, { fractionDigits: 2 })} label="Total remaining" />
                <MoneyRow label="Initial remaining" value={fmtUSD(myBalance.initialRemaining, { fractionDigits: 2 })} />
                <MoneyRow label="Monthly remaining" value={fmtUSD(myBalance.monthlyRemaining, { fractionDigits: 2 })} />
                <MoneyRow label="Capital calls remaining" value={fmtUSD(myBalance.capitalRemaining, { fractionDigits: 2 })} />
                <button onClick={() => router.push("/tracker/planning")} style={inlineLinkStyle}>Model a proposed expense →</button>
              </>
            ) : (
              <EmptyText>No balance data is available yet.</EmptyText>
            )}
          </Panel>

          <Panel title="My Task Preview" cta={{ label: "Open tasks", onClick: () => router.push("/actions") }}>
            {!loaded && <SkeletonCard />}
            {loaded && pendingVotes.length === 0 && myItems.length === 0 && incompleteSurveys.length === 0 && <EmptyText>Nothing assigned to you right now.</EmptyText>}
            {previewVotes.map(notice => (
              <div key={notice.id} style={listItemStyle}>
                <button
                  onClick={() => router.push(notice.href || "/actions")}
                  style={{ background: "transparent", border: "none", textAlign: "left", cursor: "pointer", width: "100%" }}
                >
                  <p style={{ fontSize: 14, fontWeight: 800, color: obsidian, marginBottom: 3 }}>{notice.title}</p>
                  {notice.body && <p style={{ fontSize: 12, color: ink, opacity: 0.68, lineHeight: 1.45 }}>{notice.body}</p>}
                  <p style={{ fontSize: 11, color: brass, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>
                    {notice.notification_type.includes("deal") ? "Deal review" : "Vote needed"}
                  </p>
                </button>
              </div>
            ))}
            {previewActions.map(item => {
              const due = formatDueDate(item.due_date);
              return (
                <div key={item.id} style={listItemStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: obsidian, marginBottom: 3 }}>{item.title}</p>
                      {item.description && <p style={{ fontSize: 12, color: ink, opacity: 0.68, lineHeight: 1.45 }}>{item.description}</p>}
                      <p style={{ fontSize: 11, color: ink, opacity: 0.58, marginTop: 6 }}>
                        {item.status === "in-progress" ? "In progress" : "Open"}{due ? ` · Due ${due}` : ""}
                      </p>
                    </div>
                    <button onClick={() => handleMarkDone(item)} style={smallButtonStyle}>Done</button>
                  </div>
                </div>
              );
            })}
            {previewSurveys.map(survey => (
              <div key={survey.surveyId} style={listItemStyle}>
                <button
                  onClick={() => router.push(survey.status === "Completed" ? `/results/${survey.surveyId}` : `/survey/${survey.surveyId}`)}
                  style={{ background: "transparent", border: "none", textAlign: "left", cursor: "pointer", width: "100%" }}
                >
                  <p style={{ fontSize: 14, fontWeight: 800, color: obsidian, marginBottom: 3 }}>{survey.title}</p>
                  <p style={{ fontSize: 12, color: ink, opacity: 0.68, lineHeight: 1.45 }}>
                    {survey.answered}/{survey.total} questions answered.
                  </p>
                  <p style={{ fontSize: 11, color: brass, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>
                    {survey.status === "In Progress" ? "Continue survey" : "Start survey"}
                  </p>
                </button>
              </div>
            ))}
          </Panel>
        </section>

        <section className="dashboard-two-col" style={{ marginBottom: 28 }}>
          <Panel title="Deal Reviews + Operations" cta={{ label: "Deal reviews", onClick: () => router.push("/deals") }}>
            {hotDeals.length === 0 && activeProjects.length === 0 && pendingReimbursements.length === 0 && (
              <EmptyText>No deal, project, or finance signals need attention.</EmptyText>
            )}
            {hotDeals.map(deal => (
              <SignalItem
                key={deal.id}
                label="Deal"
                title={deal.title}
                detail={`${deal.analysis?.recommendation ?? labelForStatus("needs-review")} · ${deal.address || deal.parcel_id || "Location pending"}`}
                onClick={() => router.push(`/opportunity?deal=${deal.id}`)}
              />
            ))}
            {activeProjects.slice(0, 2).map(project => (
              <SignalItem
                key={project.id}
                label="Project"
                title={project.name}
                detail={`${labelForStatus(project.status)} · ${project.next_step || "Next step pending"}`}
                onClick={() => router.push("/projects")}
              />
            ))}
            {pendingReimbursements.slice(0, 2).map(item => (
              <SignalItem
                key={item.id}
                label="Finance"
                title={`${item.member_name} · ${Number(item.amount).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`}
                detail={`${item.status} · ${item.vendor || item.category}`}
                onClick={() => router.push("/operations")}
              />
            ))}
          </Panel>

          <Panel title="VA Daily Brief" cta={{ label: "Review brief", onClick: () => router.push("/operations") }}>
            {!latestVaBrief ? (
              <EmptyText>No VA daily brief has been submitted yet.</EmptyText>
            ) : (
              <>
                <div style={briefSummaryStyle}>
                  <div>
                    <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
                      {formatActivityDate(latestVaBrief.work_date)} · {latestVaBrief.submitted_by}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 850, color: COLORS.obsidian }}>
                      {latestVaBriefReviewedByMe ? "You reviewed the latest brief." : "Latest brief needs review."}
                    </p>
                  </div>
                  <Badge>{latestVaBrief.reviewed_status === "reviewed" ? "Reviewed" : "New"}</Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }} className="brief-metrics">
                  <BriefMetric label="Texts" value={latestVaBrief.outreach_sent ?? 0} />
                  <BriefMetric label="Replies" value={latestVaBrief.seller_replies ?? 0} />
                  <BriefMetric label="Calls" value={latestVaBrief.calls_completed ?? 0} />
                  <BriefMetric label="Deals" value={latestVaBrief.deals_submitted ?? 0} />
                  <BriefMetric label="Tasks" value={latestVaBrief.va_tasks_completed ?? 0} />
                </div>
                <div style={listItemStyle}>
                  <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Completed</p>
                  <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.72, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                    {latestVaBrief.activities_completed}
                  </p>
                </div>
                {latestVaBrief.blockers && (
                  <div style={{ ...listItemStyle, borderColor: "rgba(20,17,13,0.35)" }}>
                    <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Blockers</p>
                    <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.76, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                      {latestVaBrief.blockers}
                    </p>
                  </div>
                )}
              </>
            )}
          </Panel>
        </section>

        <section className="dashboard-two-col" style={{ marginBottom: 28 }}>
          <Panel title="Seller Communications" cta={{ label: "CRM inbox", onClick: () => router.push("/crm") }}>
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
          <Panel title="Recent Group Activity" cta={{ label: "Activity hub", onClick: () => router.push("/hub") }}>
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
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 28 }} className="dashboard-two-col">
          <article style={{
            background: obsidian,
            color: bone,
            borderRadius: 16,
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            <div>
              <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: brass, fontWeight: 700, marginBottom: 8 }}>
                Next meeting
              </p>
              <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 500, color: bone, lineHeight: 1.1, marginBottom: 4, letterSpacing: 0 }}>
                {formatMeetingDate(nextMeeting?.meeting_date ?? null) ?? "Meeting date pending"}
              </h2>
              <p style={{ fontSize: 14, color: fog }}>{nextMeeting?.meeting_time ?? "Time pending"}</p>
            </div>
            {nextMeeting?.agenda && (
              <pre style={{
                fontFamily: BODY_FONT,
                fontSize: 13,
                color: bone,
                opacity: 0.88,
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
                margin: 0,
              }}>
                {nextMeeting.agenda}
              </pre>
            )}
            <button onClick={() => router.push("/meetings")} style={{ ...darkPanelButtonStyle, marginTop: "auto" }}>
              Meeting hub
            </button>
          </article>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: brass, fontWeight: 700 }}>
              Quick Links
            </p>
            {QUICK_LINKS.map(link => {
              const onClick = () => {
                if (link.external) window.open(link.href, "_blank", "noopener");
                else router.push(link.href);
              };
              return (
                <button key={link.title} onClick={onClick} style={quickLinkStyle}>
                  <div>
                    <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: brass, fontWeight: 700, marginBottom: 4 }}>
                      {link.eyebrow}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: obsidian }}>{link.title}</p>
                  </div>
                  <span style={{ color: brass, fontSize: 18, lineHeight: 1 }}>{link.external ? "↗" : "→"}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section id="directory" style={{ marginBottom: 32 }}>
          <SectionHeader
            title="Member Directory"
            subtitle="LLCs, roles, and profile details for the collective."
            cta={{ label: "Edit profiles", onClick: () => router.push("/hub") }}
          />
          <div className="members-grid">
            {memberDirectory.length === 0 && loaded && <EmptyText>No member profiles available yet.</EmptyText>}
            {memberDirectory.map(member => (
              <article key={member.name} style={{ ...cardStyle, borderColor: member.name === user ? brass : fog }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                  <h3 style={{ fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 500, color: obsidian, letterSpacing: 0 }}>{member.name}</h3>
                  {member.name === user && <Badge>You</Badge>}
                  {member.isAdmin && <Badge>Managing</Badge>}
                </div>
                <p style={{ fontSize: 13, color: ink, opacity: 0.72 }}>{member.llcName ?? "LLC pending"}</p>
                {member.role && <p style={{ fontSize: 12, color: ink, opacity: 0.65, lineHeight: 1.45 }}>{member.role}</p>}
                {member.contact && <p style={{ fontSize: 12, color: ink, opacity: 0.58, lineHeight: 1.45 }}>{member.contact}</p>}
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 32 }}>
          <SectionHeader
            title="Surveys"
            subtitle="Pick up where you left off."
            cta={{ label: "All surveys", onClick: () => router.push("/surveys") }}
          />
          <div className="survey-grid">
            {progress.length === 0 && loaded && <EmptyText>No surveys available.</EmptyText>}
            {progress.map(p => {
              const pct = p.total > 0 ? Math.round((p.answered / p.total) * 100) : 0;
              const ctaLabel = p.status === "Completed" ? "View results" : p.status === "In Progress" ? "Continue" : "Start";
              const ctaHref = p.status === "Completed" ? `/results/${p.surveyId}` : `/survey/${p.surveyId}`;
              return (
                <button key={p.surveyId} onClick={() => router.push(ctaHref)} style={{ ...cardStyle, textAlign: "left", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <h3 style={{ fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 500, lineHeight: 1.2, color: obsidian, letterSpacing: 0 }}>
                      {p.title}
                    </h3>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      padding: "3px 8px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                      background: p.status === "Completed" ? brass : bone,
                      color: p.status === "Completed" ? obsidian : "var(--gold-dim)",
                      border: `1px solid ${p.status === "Completed" ? brass : fog}`,
                    }}>
                      {p.status}
                    </span>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: ink, opacity: 0.72 }}>
                      <span>{p.answered} / {p.total}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: fog, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: brass, transition: "width 0.3s" }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: brass, fontWeight: 700 }}>{ctaLabel} →</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <style jsx>{`
        .attention-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .member-command-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr 1fr;
          gap: 14px;
          align-items: stretch;
        }
        .dashboard-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .survey-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        .members-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
        }
        @media (max-width: 900px) {
          .attention-grid { grid-template-columns: repeat(2, 1fr); }
          .member-command-grid { grid-template-columns: 1fr; }
          .dashboard-two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .dashboard-root { padding-top: 28px !important; }
          .attention-grid,
          .member-command-grid,
          .survey-grid,
          .members-grid,
          .brief-metrics { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ title, subtitle, cta }: {
  title: string;
  subtitle?: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 500, color: COLORS.obsidian, marginBottom: 2, letterSpacing: 0 }}>
          {title}
        </h2>
        {subtitle && <p style={{ fontSize: 13, color: COLORS.ink, opacity: 0.6 }}>{subtitle}</p>}
      </div>
      {cta && (
        <button onClick={cta.onClick} style={inlineLinkStyle}>
          {cta.label} →
        </button>
      )}
    </div>
  );
}

function DecisionCenterCard({
  title,
  eyebrow,
  count,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  eyebrow: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <section style={{ ...cardStyle, minHeight: 280, borderColor: count > 0 ? COLORS.obsidian : COLORS.fog }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: COLORS.brass, fontWeight: 900, marginBottom: 6 }}>
            {eyebrow}
          </p>
          <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, lineHeight: 1.02, fontWeight: 500, color: COLORS.obsidian, letterSpacing: 0 }}>
            {title}
          </h2>
        </div>
        <span style={{
          minWidth: 44,
          height: 44,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: count > 0 ? COLORS.obsidian : COLORS.bone,
          color: count > 0 ? COLORS.bone : COLORS.brass,
          border: `1px solid ${count > 0 ? COLORS.obsidian : COLORS.fog}`,
          fontSize: 18,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
        }}>
          {count}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {children}
      </div>
      <button onClick={onAction} style={{ ...darkPanelButtonStyle, alignSelf: "stretch", marginTop: "auto" }}>
        {actionLabel}
      </button>
    </section>
  );
}

function DecisionQueueRow({ label, value, urgent = false }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 12,
      padding: "9px 0",
      borderBottom: "1px solid rgba(214,205,183,0.72)",
    }}>
      <span style={{ fontSize: 13, color: COLORS.ink, opacity: 0.72 }}>{label}</span>
      <strong style={{ fontSize: 14, color: urgent ? COLORS.obsidian : COLORS.brass, fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    </div>
  );
}

function MiniRecordButton({ label, title, detail, onClick }: { label: string; title: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...listItemStyle, textAlign: "left", cursor: "pointer", padding: "10px 12px" }}>
      <p style={{ fontSize: 10, color: COLORS.brass, fontWeight: 900, letterSpacing: "0.13em", textTransform: "uppercase", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 850, color: COLORS.obsidian, lineHeight: 1.25 }}>{title}</p>
      <p style={{ fontSize: 12, color: COLORS.ink, opacity: 0.66, lineHeight: 1.35, marginTop: 2 }}>{detail}</p>
    </button>
  );
}

function Panel({ title, cta, children }: { title: string; cta: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <section style={{ ...cardStyle, minHeight: 260 }}>
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

const smallButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--brass)",
  border: "1px solid var(--brass)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  flexShrink: 0,
};

const darkPanelButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  background: "var(--brass)",
  color: "var(--obsidian)",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const quickLinkStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--ink)",
  border: "1px solid var(--fog)",
  borderRadius: 12,
  padding: "13px 15px",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  fontFamily: BODY_FONT,
};
