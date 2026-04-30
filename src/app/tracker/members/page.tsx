"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CapitalCall,
  Contribution,
  Expense,
  MemberProfile,
  TrackerSettings,
  computeMemberBalances,
  computeTargets,
  fmtUSD,
} from "@/lib/tracker";
import { MEMBERS } from "@/data/questions";
import TrackerShell, { trackerCard } from "@/components/TrackerShell";

export default function MemberTrackerPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [calls, setCalls] = useState<CapitalCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
    if (!supabase) return;
    const sb = supabase;
    const ch = sb
      .channel("tracker_members_changes")
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

  if (!user) return null;

  const llcOf = (m: string) => profiles.find(p => p.member_name === m)?.llc_name || m;

  const members = MEMBERS.map(m => ({ name: m, llcName: llcOf(m) }));
  const balances = computeMemberBalances({
    members,
    expenses,
    contributions,
    capitalCalls: calls,
    settings,
  });

  const targets = computeTargets(expenses, settings);
  const totals = balances.reduce(
    (acc, b) => {
      acc.initialPaid += b.initialPaid;
      acc.initialRemaining += b.initialRemaining;
      acc.monthlyPaid += b.monthlyPaid;
      acc.monthlyRemaining += b.monthlyRemaining;
      acc.capitalPaid += b.capitalPaid;
      acc.capitalRemaining += b.capitalRemaining;
      acc.totalOwed += b.totalOwed;
      acc.totalRemaining += b.totalRemaining;
      return acc;
    },
    { initialPaid: 0, initialRemaining: 0, monthlyPaid: 0, monthlyRemaining: 0, capitalPaid: 0, capitalRemaining: 0, totalOwed: 0, totalRemaining: 0 },
  );

  return (
    <TrackerShell title="Member Tracker" subtitle="What each LLC owes vs. what they've paid, by bucket.">
      {loading && <div style={{ color: "var(--muted)" }}>Loading…</div>}

      <div style={{ ...trackerCard, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <SummaryStat label="Initial target / member" value={fmtUSD(targets.initialTarget)} />
        <SummaryStat label="Monthly dues / member (per mo)" value={fmtUSD(targets.monthlyTargetPerMonth)} />
        <SummaryStat label="Members" value={String(targets.memberCount)} />
      </div>

      <div style={{ ...trackerCard, padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1000 }}>
          <thead>
            <tr style={{ background: "var(--surface2)" }}>
              <th rowSpan={2} style={{ ...th, textAlign: "left" }}>Member</th>
              <th colSpan={3} style={{ ...th, borderBottom: "1px solid var(--border)" }}>Initial</th>
              <th colSpan={3} style={{ ...th, borderBottom: "1px solid var(--border)" }}>Monthly Dues</th>
              <th colSpan={3} style={{ ...th, borderBottom: "1px solid var(--border)" }}>Capital Calls</th>
              <th rowSpan={2} style={{ ...th, textAlign: "right" }}>Total Owed</th>
              <th rowSpan={2} style={{ ...th, textAlign: "right" }}>Total Remaining</th>
            </tr>
            <tr style={{ background: "var(--surface2)" }}>
              <th style={{ ...th, textAlign: "right" }}>Target</th>
              <th style={{ ...th, textAlign: "right" }}>Paid</th>
              <th style={{ ...th, textAlign: "right" }}>Remaining</th>
              <th style={{ ...th, textAlign: "right" }}>Target</th>
              <th style={{ ...th, textAlign: "right" }}>Paid</th>
              <th style={{ ...th, textAlign: "right" }}>Remaining</th>
              <th style={{ ...th, textAlign: "right" }}>Called</th>
              <th style={{ ...th, textAlign: "right" }}>Paid</th>
              <th style={{ ...th, textAlign: "right" }}>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {balances.map(b => {
              const youAreThis = b.memberName === user;
              return (
                <tr
                  key={b.memberName}
                  style={{
                    borderTop: "1px solid var(--border)",
                    background: youAreThis ? "rgba(176,137,84,0.06)" : undefined,
                  }}
                >
                  <td style={{ ...td, fontWeight: youAreThis ? 600 : 500 }}>
                    {b.llcName}
                    {youAreThis && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--gold)" }}>YOU</span>}
                  </td>
                  <td style={tdR}>{fmtUSD(b.initialTarget)}</td>
                  <td style={tdR}>{fmtUSD(b.initialPaid)}</td>
                  <td style={{ ...tdR, color: b.initialRemaining > 0 ? "var(--gold)" : "var(--muted)" }}>
                    {fmtUSD(b.initialRemaining)}
                  </td>
                  <td style={tdR}>{fmtUSD(b.monthlyTarget)}</td>
                  <td style={tdR}>{fmtUSD(b.monthlyPaid)}</td>
                  <td style={{ ...tdR, color: b.monthlyRemaining > 0 ? "var(--gold)" : "var(--muted)" }}>
                    {fmtUSD(b.monthlyRemaining)}
                  </td>
                  <td style={tdR}>{fmtUSD(b.capitalCalled, { fractionDigits: b.capitalCalled % 1 ? 2 : 0 })}</td>
                  <td style={tdR}>{fmtUSD(b.capitalPaid)}</td>
                  <td style={{ ...tdR, color: b.capitalRemaining > 0 ? "var(--gold)" : "var(--muted)" }}>
                    {fmtUSD(b.capitalRemaining)}
                  </td>
                  <td style={{ ...tdR, fontWeight: 600 }}>{fmtUSD(b.totalOwed)}</td>
                  <td style={{ ...tdR, fontWeight: 600, color: b.totalRemaining > 0 ? "#e55" : "#6B8F7B" }}>
                    {fmtUSD(b.totalRemaining)}
                  </td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface2)" }}>
              <td style={{ ...td, fontWeight: 700, color: "var(--gold)" }}>TOTAL</td>
              <td style={tdR}>{fmtUSD(targets.initialTarget * targets.memberCount)}</td>
              <td style={tdR}>{fmtUSD(totals.initialPaid)}</td>
              <td style={tdR}>{fmtUSD(totals.initialRemaining)}</td>
              <td style={tdR}>{fmtUSD(targets.monthlyTargetTotal * targets.memberCount)}</td>
              <td style={tdR}>{fmtUSD(totals.monthlyPaid)}</td>
              <td style={tdR}>{fmtUSD(totals.monthlyRemaining)}</td>
              <td style={tdR}>—</td>
              <td style={tdR}>{fmtUSD(totals.capitalPaid)}</td>
              <td style={tdR}>{fmtUSD(totals.capitalRemaining)}</td>
              <td style={{ ...tdR, fontWeight: 700 }}>{fmtUSD(totals.totalOwed)}</td>
              <td style={{ ...tdR, fontWeight: 700, color: totals.totalRemaining > 0 ? "#e55" : "#6B8F7B" }}>
                {fmtUSD(totals.totalRemaining)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </TrackerShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "10px 10px" };
const tdR: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
