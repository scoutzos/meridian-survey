"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CapitalCall,
  CapitalCallStatus,
  MemberProfile,
  CAPITAL_CALL_STATUS_LABEL,
  MEMBER_COUNT,
  fmtUSD,
  fmtDate,
  isAdmin,
  logAudit,
} from "@/lib/tracker";
import TrackerShell, {
  trackerCard,
  trackerInput,
  trackerBtn,
  trackerBtnGhost,
  trackerBtnSubtle,
} from "@/components/TrackerShell";

const STATUS_STYLE: Record<CapitalCallStatus, { color: string; bg: string }> = {
  suggested: { color: "var(--gold)", bg: "rgba(201,168,120,0.12)" },
  open:      { color: "var(--gold)", bg: "rgba(201,168,120,0.12)" },
  closed:    { color: "var(--muted)",    bg: "rgba(214,209,196,0.10)" },
  cancelled: { color: "var(--muted)",    bg: "rgba(214,209,196,0.06)" },
};

export default function CapitalCallsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [calls, setCalls] = useState<CapitalCall[]>([]);
  const [loading, setLoading] = useState(true);

  // manual create
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
    if (!supabase) return;
    const sb = supabase;
    const ch = sb
      .channel("tracker_capital_calls_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_capital_calls" }, () => load())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.from("tracker_member_profiles").select("*").order("member_name"),
      supabase.from("tracker_capital_calls").select("*").is("deleted_at", null).order("date_called", { ascending: false }),
    ]);
    setProfiles((p.data as MemberProfile[] | null) ?? []);
    setCalls((c.data as CapitalCall[] | null) ?? []);
    setLoading(false);
  }

  if (!user) return null;

  const admin = isAdmin(profiles, user);

  async function create() {
    if (!supabase || !user || !admin) return;
    const total = Number(totalAmount.replace(/[$,]/g, ""));
    if (!Number.isFinite(total) || total <= 0) return;
    if (!reason.trim() || !date) return;
    const row = {
      date_called: date,
      reason: reason.trim(),
      total_amount: total,
      per_member_amount: MEMBER_COUNT > 0 ? Number((total / MEMBER_COUNT).toFixed(2)) : 0,
      status: "open" as CapitalCallStatus,
      auto_suggested: false,
      created_by: user,
      updated_by: user,
    };
    const { data, error } = await supabase.from("tracker_capital_calls").insert(row).select().single();
    if (error) { alert(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_capital_calls",
      row_id: String((data as CapitalCall).id),
      action: "create",
      diff: { after: data },
    });
    setReason(""); setTotalAmount("");
    void load();
  }

  async function setStatus(c: CapitalCall, status: CapitalCallStatus) {
    if (!supabase || !user || !admin) return;
    const update: Partial<CapitalCall> & { updated_at: string } = {
      status,
      updated_by: user,
      updated_at: new Date().toISOString(),
    };
    if (status === "open" && c.status === "suggested") {
      update.approved_by = user;
      update.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("tracker_capital_calls").update(update).eq("id", c.id);
    if (error) { alert(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_capital_calls",
      row_id: String(c.id),
      action: "update",
      diff: { before: { status: c.status }, after: update },
    });
    void load();
  }

  async function remove(c: CapitalCall) {
    if (!supabase || !user || !admin) return;
    if (!confirm(`Delete capital call #${c.id}?`)) return;
    const { error } = await supabase
      .from("tracker_capital_calls")
      .update({ deleted_at: new Date().toISOString(), updated_by: user })
      .eq("id", c.id);
    if (error) { alert(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_capital_calls",
      row_id: String(c.id),
      action: "delete",
      diff: { before: c },
    });
    void load();
  }

  return (
    <TrackerShell title="Capital Calls" subtitle="Suggested calls require human approval before counting against members.">
      {loading && <div style={{ color: "var(--muted)" }}>Loading…</div>}

      {admin && (
        <div style={{ ...trackerCard, marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Create capital call</h2>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 140px 120px", gap: 8, alignItems: "end" }}>
            <label style={{ fontSize: 12 }}>
              <div style={{ color: "var(--muted)", marginBottom: 4 }}>Date called</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={trackerInput} />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ color: "var(--muted)", marginBottom: 4 }}>Reason</div>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} style={trackerInput} />
            </label>
            <label style={{ fontSize: 12 }}>
              <div style={{ color: "var(--muted)", marginBottom: 4 }}>Total amount</div>
              <input type="text" placeholder="$0" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} style={trackerInput} />
            </label>
            <button onClick={create} style={trackerBtn}>Create</button>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            Manually-created calls open immediately. The dashboard&apos;s shortfall feature creates suggested calls that require approval.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {calls.map(c => {
          const cfg = STATUS_STYLE[c.status];
          return (
            <div
              key={c.id}
              style={{
                ...trackerCard,
                borderLeft: `4px solid ${cfg.color}`,
                padding: "14px 18px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>#{c.id} · {c.reason}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg,
                      padding: "2px 8px", borderRadius: 4, letterSpacing: "0.5px",
                    }}>
                      {CAPITAL_CALL_STATUS_LABEL[c.status].toUpperCase()}
                    </span>
                    {c.auto_suggested && (
                      <span style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>
                        auto-suggested by shortfall detection
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--muted)" }}>
                    <span>Called: {fmtDate(c.date_called)}</span>
                    <span>Total: <b style={{ color: "var(--fg)" }}>{fmtUSD(Number(c.total_amount))}</b></span>
                    <span>Per member: <b style={{ color: "var(--fg)" }}>{fmtUSD(Number(c.per_member_amount), { fractionDigits: 2 })}</b></span>
                  </div>
                  {c.approved_by && c.approved_at && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                      Approved by {c.approved_by} on {fmtDate(c.approved_at)}
                    </div>
                  )}
                </div>
                {admin && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {c.status === "suggested" && (
                      <>
                        <button onClick={() => setStatus(c, "open")} style={trackerBtn}>Approve &amp; Open</button>
                        <button onClick={() => setStatus(c, "cancelled")} style={trackerBtnSubtle}>Dismiss</button>
                      </>
                    )}
                    {c.status === "open" && (
                      <button onClick={() => setStatus(c, "closed")} style={trackerBtnGhost}>Close</button>
                    )}
                    {(c.status === "closed" || c.status === "cancelled") && (
                      <button onClick={() => setStatus(c, "open")} style={trackerBtnSubtle}>Re-open</button>
                    )}
                    <button onClick={() => remove(c)} style={{ ...trackerBtnSubtle, color: "var(--obsidian)", borderColor: "rgba(20,17,13,0.3)" }}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!calls.length && !loading && (
          <div style={{ ...trackerCard, color: "var(--muted)", textAlign: "center" }}>
            No capital calls yet. Run the dashboard&apos;s shortfall check to generate one.
          </div>
        )}
      </div>
    </TrackerShell>
  );
}
