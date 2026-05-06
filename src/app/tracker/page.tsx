"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CapitalCall,
  Contribution,
  Expense,
  MEMBER_COUNT,
  MemberProfile,
  TrackerSettings,
  computeFundingStatus,
  computeMemberBalances,
  computeTargets,
  fmtUSD,
  isAdmin,
  logAudit,
  monthBucket,
} from "@/lib/tracker";
import { MEMBERS } from "@/data/questions";
import TrackerShell, {
  trackerCard,
  trackerBtn,
  trackerBtnSubtle,
} from "@/components/TrackerShell";

export default function TrackerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [calls, setCalls] = useState<CapitalCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingCall, setCreatingCall] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
    if (!supabase) return;
    const sb = supabase;
    const ch = sb
      .channel("tracker_dashboard_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_expenses" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_contributions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_capital_calls" }, () => load())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [s, p, e, c, k] = await Promise.all([
      supabase.from("tracker_settings").select("*").eq("key", "tracker").maybeSingle(),
      supabase.from("tracker_member_profiles").select("*").order("member_name"),
      supabase.from("tracker_expenses").select("*").is("deleted_at", null),
      supabase.from("tracker_contributions").select("*").is("deleted_at", null),
      supabase.from("tracker_capital_calls").select("*").is("deleted_at", null),
    ]);
    setSettings((s.data as TrackerSettings | null) ?? null);
    setProfiles((p.data as MemberProfile[] | null) ?? []);
    setExpenses((e.data as Expense[] | null) ?? []);
    setContributions((c.data as Contribution[] | null) ?? []);
    setCalls((k.data as CapitalCall[] | null) ?? []);
    setLoading(false);
  }

  const status = useMemo(
    () => computeFundingStatus(expenses, contributions, calls),
    [expenses, contributions, calls],
  );

  const targets = useMemo(() => computeTargets(expenses, settings), [expenses, settings]);

  const balances = useMemo(() => {
    const llcOf = (m: string) => profiles.find(p => p.member_name === m)?.llc_name || m;
    return computeMemberBalances({
      members: MEMBERS.map(m => ({ name: m, llcName: llcOf(m) })),
      expenses,
      contributions,
      capitalCalls: calls,
      settings,
    });
  }, [profiles, expenses, contributions, calls, settings]);

  if (!user) return null;
  const admin = isAdmin(profiles, user);
  const start = settings?.llc_start_date ?? null;

  // alerts
  const unclassified = expenses.filter(e => !e.deleted_at && monthBucket(e.expense_date, start) === "Unclassified");
  const suggestedCalls = calls.filter(c => !c.deleted_at && c.status === "suggested");
  const behindMembers = balances.filter(b => b.totalRemaining > b.totalOwed * 0.5).slice(0, 3);

  // bank
  const bankBalance = status.totalDeposits - status.totalExpenses;

  async function createSuggestedCall() {
    if (!supabase || !user) return;
    if (status.shortfall <= 0) return;
    setCreatingCall(true);
    const row = {
      date_called: new Date().toISOString().slice(0, 10),
      reason: `Auto-suggested: cover funding shortfall of ${fmtUSD(status.shortfall)}`,
      total_amount: Number(status.shortfall.toFixed(2)),
      per_member_amount: MEMBER_COUNT > 0 ? Number((status.shortfall / MEMBER_COUNT).toFixed(2)) : 0,
      status: "suggested" as const,
      auto_suggested: true,
      created_by: user,
      updated_by: user,
    };
    const { data, error } = await supabase.from("tracker_capital_calls").insert(row).select().single();
    setCreatingCall(false);
    if (error) { alert(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_capital_calls",
      row_id: String((data as CapitalCall).id),
      action: "create",
      diff: { after: data, source: "shortfall-suggestion" },
    });
    router.push("/tracker/capital-calls");
  }

  return (
    <TrackerShell title="Contribution Tracker" subtitle="Funding health, expenses, deposits, and per-member balances.">
      {loading && <div style={{ color: "var(--muted)" }}>Loading…</div>}

      {/* Funding shortfall banner */}
      {status.shortfall > 0 ? (
        <div
          style={{
            background: "rgba(20,17,13,0.10)",
            border: "1px solid rgba(20,17,13,0.4)",
            borderLeft: "4px solid var(--obsidian)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--obsidian)", marginBottom: 4 }}>
              Funding shortfall: {fmtUSD(status.shortfall)}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg)" }}>
              Suggested capital call of <b>{fmtUSD(status.shortfallPerMember, { fractionDigits: 2 })}</b> per member
              ({MEMBER_COUNT} members) to cover {fmtUSD(status.totalFundingNeed)} of need against {fmtUSD(status.totalDeposits)} deposited.
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
              The system suggests; the human approves. The call will be created with status &quot;Suggested&quot; for review.
            </div>
          </div>
          <button
            onClick={createSuggestedCall}
            disabled={creatingCall || !!suggestedCalls.length}
            style={{
              ...trackerBtn,
              background: "var(--obsidian)",
              color: "var(--surface)",
              opacity: creatingCall || suggestedCalls.length ? 0.6 : 1,
              cursor: creatingCall || suggestedCalls.length ? "not-allowed" : "pointer",
            }}
          >
            {suggestedCalls.length ? "Suggested call already pending" : creatingCall ? "Creating…" : "Create suggested capital call"}
          </button>
        </div>
      ) : (
        <div
          style={{
            background: "rgba(201,168,120,0.10)",
            border: "1px solid rgba(201,168,120,0.4)",
            borderLeft: "4px solid var(--gold)",
            borderRadius: 12,
            padding: "12px 18px",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          Funding is covered. Deposits + expected calls meet or exceed the {fmtUSD(status.totalFundingNeed)} of total need.
        </div>
      )}

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <Stat label="Total expenses" value={fmtUSD(status.totalExpenses)} />
        <Stat label="Total deposits" value={fmtUSD(status.totalDeposits)} accent="var(--gold)" />
        <Stat label="Open capital calls" value={fmtUSD(status.openCapitalCalls)} />
        <Stat label="Bank balance (est.)" value={fmtUSD(bankBalance)} accent={bankBalance >= 0 ? "var(--gold)" : "var(--obsidian)"} />
      </div>

      {/* Targets row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <Stat label="Initial target / member" value={fmtUSD(targets.initialTarget)} sub={`(M1 + Pre-formation expenses) ÷ ${MEMBER_COUNT}`} />
        <Stat label="Monthly dues / member / mo" value={fmtUSD(targets.monthlyTargetPerMonth)} sub={`Total monthly bucket ÷ ${MEMBER_COUNT} ÷ ${Math.max(0, (settings?.months_tracked ?? 3) - 1)} mos`} />
        <Stat label="Months tracked" value={String(settings?.months_tracked ?? 3)} sub={`Start: ${settings?.llc_start_date ?? "not set"}`} />
      </div>

      {/* Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Alert title="Unclassified expenses" empty="None — all expenses are dated.">
          {unclassified.slice(0, 5).map(e => (
            <div key={e.id} style={alertItem}>
              <span>{e.description}</span>
              <span style={{ color: "var(--muted)" }}>{fmtUSD(Number(e.amount))}</span>
            </div>
          ))}
          {unclassified.length > 5 && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>+{unclassified.length - 5} more</div>
          )}
          {unclassified.length > 0 && (
            <button onClick={() => router.push("/tracker/expenses")} style={{ ...trackerBtnSubtle, marginTop: 10, fontSize: 12 }}>
              Fix in Expenses →
            </button>
          )}
        </Alert>
        <Alert title="Members behind" empty="Everyone is at or near target.">
          {behindMembers.map(b => (
            <div key={b.memberName} style={alertItem}>
              <span>{b.llcName}</span>
              <span style={{ color: "var(--gold)" }}>{fmtUSD(b.totalRemaining)} remaining</span>
            </div>
          ))}
          {behindMembers.length > 0 && (
            <button onClick={() => router.push("/tracker/members")} style={{ ...trackerBtnSubtle, marginTop: 10, fontSize: 12 }}>
              See full breakdown →
            </button>
          )}
        </Alert>
      </div>

      {/* Suggested calls callout */}
      {suggestedCalls.length > 0 && (
        <div style={{ ...trackerCard, marginBottom: 16, borderLeft: "4px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)" }}>
                {suggestedCalls.length} suggested capital call{suggestedCalls.length === 1 ? "" : "s"} awaiting approval
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {admin ? "You can approve or dismiss them." : "An admin needs to review and approve."}
              </div>
            </div>
            <button onClick={() => router.push("/tracker/capital-calls")} style={trackerBtnSubtle}>
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div style={{ ...trackerCard, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <QuickLink label="Member Balances" desc="Per-LLC owed vs. paid" href="/tracker/members" router={router} />
        <QuickLink label="Expenses" desc="Log and categorize costs" href="/tracker/expenses" router={router} />
        <QuickLink label="Contributions" desc="Member bank deposits" href="/tracker/contributions" router={router} />
        <QuickLink label="Capital Calls" desc="Approve, close, or dismiss calls" href="/tracker/capital-calls" router={router} />
      </div>
    </TrackerShell>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={trackerCard}>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? "var(--gold)", marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Alert({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.flat().filter(Boolean).length === 0;
  return (
    <div style={trackerCard}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {isEmpty ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{empty}</div> : <>{children}</>}
    </div>
  );
}

function QuickLink({ label, desc, href, router }: { label: string; desc: string; href: string; router: ReturnType<typeof useRouter> }) {
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
        color: "var(--fg)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)" }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{desc}</div>
    </button>
  );
}

const alertItem: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 13,
  padding: "4px 0",
  borderBottom: "1px solid var(--border)",
};
