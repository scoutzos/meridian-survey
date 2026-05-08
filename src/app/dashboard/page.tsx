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

type SurveyProgress = {
  surveyId: string;
  title: string;
  description: string;
  answered: number;
  total: number;
  status: "Completed" | "In Progress" | "Not Started";
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
  { title: "Member Portal", eyebrow: "Full Record", href: "/members" },
  { title: "Vote on Proposals", eyebrow: "Approvals", href: "/tracker/planning" },
  { title: "Applications", eyebrow: "Member Review", href: "/members/candidates" },
  { title: "My Balances", eyebrow: "Money", href: "/tracker/members" },
  { title: "Task Inbox", eyebrow: "Work", href: "/actions" },
  { title: "Documents", eyebrow: "Records", href: "/documents" },
  { title: "Main Website", eyebrow: "Public Site", href: "https://meridian-website-red.vercel.app", external: true },
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
  const [capitalCalls, setCapitalCalls] = useState<CapitalCall[]>([]);
  const [pendingCandidateVotes, setPendingCandidateVotes] = useState<MembershipCandidate[]>([]);
  const [pendingProposalVotes, setPendingProposalVotes] = useState<PendingExpenseProposalVote[]>([]);
  const [pendingDealVotes, setPendingDealVotes] = useState<PendingDealVote[]>([]);
  const [loaded, setLoaded] = useState(false);

  const surveys = useMemo(() => getAllSurveys(), []);

  useEffect(() => {
    const raw = localStorage.getItem("meridian_user");
    if (!raw) { router.push("/"); return; }
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
      ]);

      setActionItems(items);
      setNextMeeting(meeting);
      setDeals(dealRows);
      setProjects(projectRows);
      setNotifications(notices);
      setPendingCandidateVotes(candidateVoteRows);
      setPendingProposalVotes(proposalVoteRows);
      setPendingDealVotes(dealVoteRows);
      setReimbursements(reimbursementRows);
      setDecisions(hub.decisions.slice(0, 4));

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
      body: `${deal.recommendation ?? "Needs Review"} · ${deal.urgency === "hot" ? "Hot deal" : "Review requested"}`,
      notification_type: "deal_vote",
      priority: deal.urgency === "hot" ? "urgent" : "high",
      assigned_to: user,
      href: `/deals?deal=${deal.id}`,
      source_table: "meridian_deals",
      source_id: deal.id,
      read_at: null,
      created_at: deal.submitted_at,
      created_by: "Deal Desk",
    }));
  const pendingVotes = [...notificationVotes, ...proposalVoteNotices, ...candidateVoteNotices, ...dealVoteNotices];
  const openCapitalCalls = capitalCalls.filter(c => !c.deleted_at && c.status === "open");
  const suggestedCapitalCalls = capitalCalls.filter(c => !c.deleted_at && c.status === "suggested");
  const hotDeals = deals.filter(d => d.urgency === "hot" || d.analysis?.recommendation === "Strong Review").slice(0, 3);
  const activeProjects = projects.filter(p => !["sold", "passed"].includes(p.status)).slice(0, 3);
  const pendingReimbursements = reimbursements.filter(r => r.status === "submitted" || r.status === "approved");
  const incompleteSurveys = progress.filter(p => p.status !== "Completed");
  const surveyAnswered = progress.reduce((sum, p) => sum + p.answered, 0);
  const surveyTotal = progress.reduce((sum, p) => sum + p.total, 0);
  const surveyPct = surveyTotal > 0 ? Math.round((surveyAnswered / surveyTotal) * 100) : 0;
  const attentionCount = pendingVotes.length + myItems.length + openCapitalCalls.length + suggestedCapitalCalls.length;
  const taskInboxCount = pendingVotes.length + myItems.length;

  const activity = [
    ...notifications.slice(0, 4).map(n => ({
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
  };

  const handleMarkDone = async (item: ActionItem) => {
    const { error } = await updateActionItemStatus(item.id, "done", user);
    if (error) { alert(error); return; }
    setActionItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "done", completed_at: new Date().toISOString() } : i));
  };

  return (
    <div
      className="dashboard-root"
      style={{ minHeight: "100vh", background: bone, color: ink, fontFamily: BODY_FONT, padding: "84px 20px 40px" }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: brass, fontWeight: 700, marginBottom: 8 }}>
              Home
            </p>
            <h1 style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(34px, 6vw, 52px)",
              fontWeight: 500,
              lineHeight: 1.05,
              color: obsidian,
              letterSpacing: 0,
              marginBottom: 6,
            }}>
              Welcome back, {firstName}
            </h1>
            <p style={{ color: ink, opacity: 0.62, fontSize: 14 }}>
              What needs your attention today, with links into the deeper records.
            </p>
          </div>
          <button
            onClick={() => router.push("/members")}
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
            Open Member Portal
          </button>
        </header>

        <section style={{ marginBottom: 28 }}>
          <SectionHeader
            title="Needs My Attention"
            subtitle={attentionCount ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} waiting on you.` : "Nothing urgent is waiting on you."}
            cta={{ label: "Task inbox", onClick: () => router.push("/actions") }}
          />
          <div className="attention-grid">
            <AttentionCard
              title="Task inbox"
              value={String(taskInboxCount)}
              detail={taskInboxCount ? "Votes and assigned tasks waiting on you." : "No votes or assigned tasks waiting."}
              action="Open"
              onClick={() => router.push("/actions")}
              strong={taskInboxCount > 0}
            />
            <AttentionCard
              title="Capital calls"
              value={String(openCapitalCalls.length + suggestedCapitalCalls.length)}
              detail={openCapitalCalls.length ? "Open calls may need payment or review." : suggestedCapitalCalls.length ? "Suggested calls are waiting for admin review." : "No capital calls waiting."}
              action="View"
              onClick={() => router.push("/tracker/capital-calls")}
              strong={openCapitalCalls.length + suggestedCapitalCalls.length > 0}
            />
            <AttentionCard
              title="Surveys"
              value={`${surveyPct}%`}
              detail={incompleteSurveys.length ? "One or more surveys still need answers." : "All survey work is complete."}
              action="Continue"
              onClick={() => router.push("/surveys")}
              strong={incompleteSurveys.length > 0}
            />
          </div>

          {notifications.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {notifications.slice(0, 3).map(notice => (
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

          <Panel title="Task Inbox Preview" cta={{ label: "Tasks", onClick: () => router.push("/actions") }}>
            {!loaded && <SkeletonCard />}
            {loaded && myItems.length === 0 && <EmptyText>Nothing assigned to you right now.</EmptyText>}
            {myItems.slice(0, 4).map(item => {
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
          </Panel>
        </section>

        <section className="dashboard-two-col" style={{ marginBottom: 28 }}>
          <Panel title="Operating Signals" cta={{ label: "Deal desk", onClick: () => router.push("/deals") }}>
            {hotDeals.length === 0 && activeProjects.length === 0 && pendingReimbursements.length === 0 && (
              <EmptyText>No deal, project, or finance signals need attention.</EmptyText>
            )}
            {hotDeals.map(deal => (
              <SignalItem
                key={deal.id}
                label="Deal"
                title={deal.title}
                detail={`${deal.analysis?.recommendation ?? "Needs Review"} · ${deal.address || deal.parcel_id || "Location pending"}`}
                onClick={() => router.push("/deals")}
              />
            ))}
            {activeProjects.slice(0, 2).map(project => (
              <SignalItem
                key={project.id}
                label="Project"
                title={project.name}
                detail={`${project.status.replace(/-/g, " ")} · ${project.next_step || "Next step pending"}`}
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

          <Panel title="Recent Group Activity" cta={{ label: "Hub", onClick: () => router.push("/hub") }}>
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
        @media (max-width: 900px) {
          .attention-grid { grid-template-columns: repeat(2, 1fr); }
          .dashboard-two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .dashboard-root { padding-top: 28px !important; }
          .attention-grid,
          .survey-grid { grid-template-columns: 1fr; }
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

function AttentionCard({
  title,
  value,
  detail,
  action,
  onClick,
  strong,
}: {
  title: string;
  value: string;
  detail: string;
  action: string;
  onClick: () => void;
  strong: boolean;
}) {
  return (
    <button onClick={onClick} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", minHeight: 150, borderColor: strong ? COLORS.obsidian : COLORS.fog }}>
      <p style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: COLORS.brass, fontWeight: 800, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 32, fontWeight: 900, color: strong ? COLORS.obsidian : COLORS.brass, marginBottom: 6 }}>{value}</p>
      <p style={{ fontSize: 12, lineHeight: 1.45, color: COLORS.ink, opacity: 0.7, marginBottom: 10 }}>{detail}</p>
      <span style={{ marginTop: "auto", fontSize: 11, color: COLORS.brass, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{action} →</span>
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
