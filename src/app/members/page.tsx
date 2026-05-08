"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { getAllSurveys } from "@/data/surveys";
import { supabase } from "@/lib/supabase";
import {
  fetchAll,
  fmtUSD,
  computeMemberBalances,
  type MemberBalance,
  type MemberProfile as TrackerMemberProfile,
} from "@/lib/tracker";
import { fetchActionItems, isOwnedBy, type ActionItem } from "@/lib/action-items";
import { fetchNotifications, type Notification } from "@/lib/operations";
import { fetchHubData, type Decision } from "@/lib/hub";
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

const DISPLAY_FONT = "var(--font-display)";

interface MemberRow {
  name: string;
  llc_name: string | null;
  is_admin: boolean;
  role: string;
  contact: string;
  lastActive: string;
  responsesBySurvey: Record<string, number>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusLabel(notice: Notification): string {
  if (notice.notification_type === "expense_proposal_vote") return "Vote";
  if (notice.notification_type === "membership_candidate_vote") return "Member";
  if (notice.notification_type === "deal_vote" || notice.notification_type === "deal-review") return "Deal";
  if (notice.notification_type.includes("capital")) return "Capital";
  if (notice.notification_type.includes("expense")) return "Money";
  return "Notice";
}

export default function MembersPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingCandidateVotes, setPendingCandidateVotes] = useState<MembershipCandidate[]>([]);
  const [pendingProposalVotes, setPendingProposalVotes] = useState<PendingExpenseProposalVote[]>([]);
  const [pendingDealVotes, setPendingDealVotes] = useState<PendingDealVote[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [myBalance, setMyBalance] = useState<MemberBalance | null>(null);
  const [surveyCounts, setSurveyCounts] = useState<Record<string, number>>({});

  const surveys = useMemo(() => getAllSurveys(), []);
  const totalsBySurvey = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const s of surveys) totals[s.id] = s.categories.reduce((sum, c) => sum + c.questions.length, 0);
    return totals;
  }, [surveys]);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);

    async function load(memberName: string) {
      setLoading(true);
      const seed: MemberRow[] = MEMBERS.map(m => ({
        name: m,
        llc_name: null,
        is_admin: false,
        role: "",
        contact: "",
        lastActive: "",
        responsesBySurvey: {},
      }));

      const [trackerData, actionRows, noticeRows, hub, candidateVoteRows, proposalVoteRows, dealVoteRows] = await Promise.all([
        fetchAll(),
        fetchActionItems(),
        fetchNotifications(memberName),
        fetchHubData(),
        fetchPendingMembershipCandidateVotes(memberName),
        fetchPendingExpenseProposalVotes(memberName),
        fetchPendingDealVotes(memberName),
      ]);

      const responseCounts: Record<string, Record<string, number>> = {};
      if (supabase) {
        const { data } = await supabase.from("meridian_responses").select("member_name, survey_id");
        for (const r of data ?? []) {
          const sid = r.survey_id || "operating-agreement";
          if (!responseCounts[r.member_name]) responseCounts[r.member_name] = {};
          responseCounts[r.member_name][sid] = (responseCounts[r.member_name][sid] || 0) + 1;
        }
      }

      const trackerProfiles = trackerData?.profiles ?? [];
      const hubProfiles = hub.profiles;
      const nextRows = seed.map(m => {
        const trackerProfile = trackerProfiles.find(x => x.member_name === m.name);
        const hubProfile = hubProfiles[m.name];
        return {
          ...m,
          llc_name: trackerProfile?.llc_name ?? null,
          is_admin: !!trackerProfile?.is_admin,
          role: hubProfile?.role ?? "",
          contact: hubProfile?.contact ?? "",
          lastActive: hubProfile?.lastActive ?? "",
          responsesBySurvey: responseCounts[m.name] ?? {},
        };
      });

      if (trackerData) {
        const balances = computeMemberBalances({
          members: MEMBERS.map(m => ({
            name: m,
            llcName: trackerProfiles.find((p: TrackerMemberProfile) => p.member_name === m)?.llc_name || m,
          })),
          expenses: trackerData.expenses,
          contributions: trackerData.contributions,
          capitalCalls: trackerData.capitalCalls,
          settings: trackerData.settings,
        });
        setMyBalance(balances.find(b => b.memberName === memberName) ?? null);
      }

      setRows(nextRows);
      setActions(actionRows.filter(item => item.status !== "done" && isOwnedBy(item, memberName)));
      setNotifications(noticeRows);
      setPendingCandidateVotes(candidateVoteRows);
      setPendingProposalVotes(proposalVoteRows);
      setPendingDealVotes(dealVoteRows);
      setDecisions(hub.decisions.slice(0, 4));
      setSurveyCounts(responseCounts[memberName] ?? {});
      setLoading(false);
    }

    void load(u);
  }, [router]);

  if (!user) return null;

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
  const moneyNotices = notifications.filter(n => n.notification_type.includes("expense") || n.notification_type.includes("capital"));
  const myRow = rows.find(row => row.name === user);
  const surveyTotal = surveys.reduce((sum, s) => sum + (totalsBySurvey[s.id] || 0), 0);
  const surveyAnswered = surveys.reduce((sum, s) => sum + (surveyCounts[s.id] || 0), 0);
  const surveyPct = surveyTotal > 0 ? Math.round((surveyAnswered / surveyTotal) * 100) : 0;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "84px 20px 100px" }} className="members-root">
      <header style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
            Member Portal
          </p>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 50px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: "-0.5px", marginBottom: 6 }}>
            Welcome, {user.split(" ")[0]}
          </h1>
          <p style={{ color: "var(--ink)", opacity: 0.65, fontSize: 14 }}>
            Your money, votes, commitments, profile, and collective directory in one place.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/members/candidates")} style={buttonStyle}>Member Reviews</button>
          <button onClick={() => router.push("/actions")} style={buttonStyle}>Tasks</button>
          <button onClick={() => router.push("/tracker/planning")} style={buttonStyle}>Planning</button>
          <button onClick={() => router.push("/tracker/members")} style={buttonStyle}>Balances</button>
        </div>
      </header>

      {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}

      <section className="portal-grid" style={{ marginBottom: 24 }}>
        <SnapshotCard
          title="My balance"
          value={myBalance ? fmtUSD(myBalance.totalRemaining, { fractionDigits: 2 }) : "No tracker data"}
          detail={myBalance ? `${fmtUSD(myBalance.totalOwed, { fractionDigits: 2 })} total obligation` : "Set up Money to calculate balances."}
          action="View balances"
          onClick={() => router.push("/tracker/members")}
          tone={myBalance && myBalance.totalRemaining > 0 ? "strong" : "normal"}
        />
        <SnapshotCard
          title="Votes needed"
          value={String(pendingVotes.length)}
          detail={pendingVotes.length ? "Deals, proposals, or member reviews waiting on you." : "No votes waiting."}
          action="Review votes"
          onClick={() => router.push(pendingVotes[0]?.href || "/tracker/planning")}
          tone={pendingVotes.length ? "strong" : "normal"}
        />
        <SnapshotCard
          title="My actions"
          value={String(actions.length)}
          detail={actions.length ? "Open or in-progress commitments." : "Nothing assigned right now."}
          action="Open actions"
          onClick={() => router.push("/actions")}
          tone={actions.length ? "strong" : "normal"}
        />
        <SnapshotCard
          title="Survey progress"
          value={`${surveyPct}%`}
          detail={`${surveyAnswered} of ${surveyTotal} questions answered across all surveys.`}
          action="Continue surveys"
          onClick={() => router.push("/surveys")}
          tone={surveyPct < 100 ? "normal" : "quiet"}
        />
      </section>

      <section className="portal-two-col" style={{ marginBottom: 28 }}>
        <Panel title="Needs My Attention" cta="Dashboard" onClick={() => router.push("/dashboard")}>
          {notifications.length === 0 && actions.length === 0 && (
            <EmptyText>Nothing is waiting on you right now.</EmptyText>
          )}
          {pendingVotes.slice(0, 3).map(notice => (
            <AttentionItem
              key={notice.id}
              label={statusLabel(notice)}
              title={notice.title}
              detail={notice.body ?? "Review details and submit your vote."}
              onClick={() => router.push(notice.href || "/tracker/planning")}
            />
          ))}
          {actions.slice(0, 3).map(item => (
            <AttentionItem
              key={item.id}
              label={formatDueDate(item.due_date) ? `Due ${formatDueDate(item.due_date)}` : "Action"}
              title={item.title}
              detail={item.description ?? "Assigned to you."}
              onClick={() => router.push("/actions")}
            />
          ))}
          {moneyNotices.filter(n => n.notification_type !== "expense_proposal_vote").slice(0, 2).map(notice => (
            <AttentionItem
              key={notice.id}
              label={statusLabel(notice)}
              title={notice.title}
              detail={notice.body ?? "Review the money update."}
              onClick={() => router.push(notice.href || "/tracker")}
            />
          ))}
        </Panel>

        <Panel title="My Money" cta="Money" onClick={() => router.push("/tracker")}>
          {myBalance ? (
            <>
              <MoneyRow label="Initial remaining" value={fmtUSD(myBalance.initialRemaining, { fractionDigits: 2 })} />
              <MoneyRow label="Monthly remaining" value={fmtUSD(myBalance.monthlyRemaining, { fractionDigits: 2 })} />
              <MoneyRow label="Capital calls remaining" value={fmtUSD(myBalance.capitalRemaining, { fractionDigits: 2 })} />
              <div style={{ borderTop: "1px solid var(--fog)", marginTop: 10, paddingTop: 10 }}>
                <MoneyRow label="Total remaining" value={fmtUSD(myBalance.totalRemaining, { fractionDigits: 2 })} strong />
              </div>
            </>
          ) : (
            <EmptyText>No balance data available yet.</EmptyText>
          )}
        </Panel>
      </section>

      <section className="portal-two-col" style={{ marginBottom: 28 }}>
        <Panel title="Recent Decisions" cta="Hub" onClick={() => router.push("/hub")}>
          {decisions.length === 0 && <EmptyText>No decisions logged yet.</EmptyText>}
          {decisions.map(decision => (
            <div key={decision.id} style={listItemStyle}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)", marginBottom: 4 }}>{decision.description}</p>
              <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.65 }}>
                {decision.outcome || "Outcome pending"} · {formatDate(decision.date)}
              </p>
            </div>
          ))}
        </Panel>

        <Panel title="My Profile" cta="Edit in Hub" onClick={() => router.push("/hub")}>
          <div style={listItemStyle}>
            <p style={{ fontSize: 16, fontWeight: 800, color: "var(--obsidian)", marginBottom: 4 }}>{myRow?.llc_name || "LLC pending"}</p>
            <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.72 }}>{myRow?.role || "Role/skills not added yet."}</p>
            {myRow?.contact && <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.62, marginTop: 6 }}>{myRow.contact}</p>}
            {myRow?.is_admin && <p style={{ fontSize: 11, color: "var(--brass)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 10 }}>Managing Member</p>}
          </div>
        </Panel>
      </section>

      <section>
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 6 }}>
            Directory
          </p>
          <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 500, color: "var(--obsidian)" }}>
            The Collective
          </h2>
        </div>

        <div className="members-grid">
          {rows.map(m => {
            const isMe = m.name === user;
            const completion = surveys.map(s => {
              const total = totalsBySurvey[s.id] || 0;
              const answered = m.responsesBySurvey[s.id] || 0;
              const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
              return { id: s.id, title: s.title, pct };
            });
            return (
              <article key={m.name} style={{ ...cardStyle, borderColor: isMe ? "var(--brass)" : "var(--fog)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <h3 style={{ fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 500, color: "var(--obsidian)" }}>{m.name}</h3>
                    {isMe && <Badge>You</Badge>}
                    {m.is_admin && <Badge>Managing</Badge>}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.72 }}>{m.llc_name ?? "LLC pending"}</p>
                  {m.role && <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.62, marginTop: 4 }}>{m.role}</p>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600 }}>Survey progress</p>
                  {completion.map(c => (
                    <div key={c.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink)", opacity: 0.78, marginBottom: 3 }}>
                        <span>{c.title}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.pct}%</span>
                      </div>
                      <div style={{ height: 4, background: "var(--fog)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${c.pct}%`, background: "var(--brass)", transition: "width 0.3s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <style jsx>{`
        .portal-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .portal-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .members-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        @media (max-width: 900px) {
          .portal-grid { grid-template-columns: repeat(2, 1fr); }
          .portal-two-col { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .members-root { padding-top: 28px !important; }
          .portal-grid,
          .members-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function SnapshotCard({
  title,
  value,
  detail,
  action,
  onClick,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  action: string;
  onClick: () => void;
  tone: "strong" | "normal" | "quiet";
}) {
  return (
    <button onClick={onClick} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", minHeight: 154 }}>
      <p style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--brass)", fontWeight: 800, marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 30, fontWeight: 900, color: tone === "strong" ? "var(--obsidian)" : "var(--brass)", marginBottom: 6 }}>{value}</p>
      <p style={{ fontSize: 12, lineHeight: 1.45, color: "var(--ink)", opacity: tone === "quiet" ? 0.55 : 0.72, marginBottom: 12 }}>{detail}</p>
      <span style={{ marginTop: "auto", fontSize: 11, color: "var(--brass)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{action} →</span>
    </button>
  );
}

function Panel({ title, cta, onClick, children }: { title: string; cta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <section style={{ ...cardStyle, minHeight: 240 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 12 }}>
        <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 24, fontWeight: 500, color: "var(--obsidian)" }}>{title}</h2>
        <button onClick={onClick} style={{ background: "transparent", border: "none", color: "var(--brass)", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>{cta} →</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </section>
  );
}

function AttentionItem({ label, title, detail, onClick }: { label: string; title: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...listItemStyle, textAlign: "left", cursor: "pointer" }}>
      <p style={{ fontSize: 10, color: "var(--brass)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color: "var(--obsidian)", marginBottom: 3 }}>{title}</p>
      <p style={{ fontSize: 12, color: "var(--ink)", opacity: 0.68, lineHeight: 1.45 }}>{detail}</p>
    </button>
  );
}

function MoneyRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", padding: "7px 0" }}>
      <span style={{ fontSize: 13, color: "var(--ink)", opacity: 0.7 }}>{label}</span>
      <strong style={{ fontSize: strong ? 18 : 14, color: "var(--obsidian)", fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.58 }}>{children}</p>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: "var(--brass)",
      fontWeight: 800,
      padding: "2px 8px",
      borderRadius: 999,
      border: "1px solid var(--brass)",
    }}>{children}</span>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 12,
  padding: "18px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  color: "var(--ink)",
};

const listItemStyle: React.CSSProperties = {
  background: "var(--bone)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: "12px 14px",
  color: "var(--ink)",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--brass)",
  color: "var(--obsidian)",
  border: "none",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer",
};
