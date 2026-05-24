"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Contribution,
  ContributionType,
  CapitalCall,
  MemberProfile,
  CONTRIBUTION_TYPE_LABEL,
  allTrackerMembers,
  activeTrackerMembers,
  fmtUSD,
  fmtDate,
  isAdmin,
  logAudit,
} from "@/lib/tracker";
import TrackerShell, {
  trackerCard,
  trackerInput,
  trackerBtn,
} from "@/components/TrackerShell";

const TYPE_COLOR: Record<ContributionType, string> = {
  initial_contribution: "var(--gold)",
  monthly_dues: "var(--gold)",
  capital_call: "var(--gold-dim)",
  expense: "var(--obsidian)",
};

export default function ContributionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [openCalls, setOpenCalls] = useState<CapitalCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // form
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memberName, setMemberName] = useState("");
  const [type, setType] = useState<ContributionType>("monthly_dues");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [relatedCallId, setRelatedCallId] = useState<string>("");

  // filters
  const [filterMember, setFilterMember] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    setMemberName(u);
    void load();
    if (!supabase) return;
    const sb = supabase;
    const ch = sb
      .channel("tracker_contributions_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_contributions" }, () => load())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [p, c, k] = await Promise.all([
      supabase.from("tracker_member_profiles").select("*").order("member_name"),
      supabase.from("tracker_contributions").select("*").is("deleted_at", null).order("contribution_date", { ascending: false }),
      supabase.from("tracker_capital_calls").select("*").is("deleted_at", null).eq("status", "open"),
    ]);
    setProfiles((p.data as MemberProfile[] | null) ?? []);
    setContributions((c.data as Contribution[] | null) ?? []);
    setOpenCalls((k.data as CapitalCall[] | null) ?? []);
    setLoading(false);
  }

  if (!user) return null;

  const admin = isAdmin(profiles, user);
  const llcOf = (m: string) => profiles.find(p => p.member_name === m)?.llc_name || m;
  const trackerMembers = allTrackerMembers(profiles);
  const activeMembers = activeTrackerMembers(profiles);

  // non-admins can only log contributions for themselves.
  const allowedMembers: readonly string[] = admin ? trackerMembers.map(member => member.name) : activeMembers.some(member => member.name === user) ? [user] : [];

  const filtered = contributions.filter(c => {
    if (filterMember !== "all" && c.member_name !== filterMember) return false;
    if (filterType !== "all" && c.type !== filterType) return false;
    return true;
  });

  const total = filtered.reduce((s, c) => s + Number(c.amount), 0);

  async function add() {
    if (!supabase || !user) return;
    if (!allowedMembers.includes(memberName)) {
      setMessage("You can only log deposits for your own LLC. Ask an admin for others.");
      return;
    }
    const amt = Number(amount.replace(/[$,]/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (!date) return;
    const row = {
      contribution_date: date,
      member_name: memberName,
      type,
      amount: amt,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      related_capital_call_id: type === "capital_call" && relatedCallId ? Number(relatedCallId) : null,
      created_by: user,
      updated_by: user,
    };
    const { data, error } = await supabase.from("tracker_contributions").insert(row).select().single();
    if (error) { setMessage(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_contributions",
      row_id: String((data as Contribution).id),
      action: "create",
      diff: { after: data },
    });
    setAmount(""); setReference(""); setNotes(""); setRelatedCallId("");
    setMessage("Deposit logged.");
    void load();
  }

  async function remove(c: Contribution) {
    if (!supabase || !user) return;
    if (!admin && c.member_name !== user) return;
    if (!confirm(`Delete ${CONTRIBUTION_TYPE_LABEL[c.type]} of ${fmtUSD(Number(c.amount))}?`)) return;
    const { error } = await supabase
      .from("tracker_contributions")
      .update({ deleted_at: new Date().toISOString(), updated_by: user })
      .eq("id", c.id);
    if (error) { setMessage(error.message); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_contributions",
      row_id: String(c.id),
      action: "delete",
      diff: { before: c },
    });
    setMessage("Deposit deleted.");
    void load();
  }

  return (
    <TrackerShell title="Contributions" subtitle="Member deposits into the LLC bank account.">
      {message && (
        <div style={{ ...trackerCard, marginBottom: 16, padding: "12px 14px", background: "rgba(201,168,120,0.12)", fontSize: 13 }}>
          {message}
        </div>
      )}
      {loading && <div style={{ color: "var(--muted)" }}>Loading…</div>}

      <div style={{ ...trackerCard, marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Log a deposit</h2>
        <div style={{ display: "grid", gridTemplateColumns: "140px 200px 160px 120px 1fr 120px", gap: 8, alignItems: "end" }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Date</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={trackerInput} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Member</div>
            <select value={memberName} onChange={e => setMemberName(e.target.value)} style={trackerInput}>
              {allowedMembers.map(m => <option key={m} value={m}>{llcOf(m)}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Type</div>
            <select value={type} onChange={e => setType(e.target.value as ContributionType)} style={trackerInput}>
              {(Object.keys(CONTRIBUTION_TYPE_LABEL) as ContributionType[]).map(t => (
                <option key={t} value={t}>{CONTRIBUTION_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Amount</div>
            <input type="text" placeholder="$0" value={amount} onChange={e => setAmount(e.target.value)} style={trackerInput} />
          </label>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Reference / notes</div>
            <input type="text" placeholder="Zelle conf #, check #, etc." value={reference} onChange={e => setReference(e.target.value)} style={trackerInput} />
          </label>
          <button onClick={add} style={trackerBtn}>Log</button>
        </div>
        {type === "capital_call" && (
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12 }}>
              <div style={{ color: "var(--muted)", marginBottom: 4 }}>Related capital call (optional)</div>
              <select value={relatedCallId} onChange={e => setRelatedCallId(e.target.value)} style={{ ...trackerInput, maxWidth: 360 }}>
                <option value="">— none —</option>
                {openCalls.map(c => (
                  <option key={c.id} value={c.id}>
                    #{c.id} · {fmtDate(c.date_called)} · {fmtUSD(Number(c.total_amount))} · {c.reason}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div style={{ marginTop: 6 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Notes</div>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={trackerInput} />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Filter:</span>
        <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={{ ...trackerInput, width: "auto" }}>
          <option value="all">All members</option>
          {trackerMembers.map(member => <option key={member.name} value={member.name}>{member.llcName || llcOf(member.name)}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...trackerInput, width: "auto" }}>
          <option value="all">All types</option>
          {(Object.keys(CONTRIBUTION_TYPE_LABEL) as ContributionType[]).map(t => (
            <option key={t} value={t}>{CONTRIBUTION_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--muted)" }}>
          {filtered.length} deposits · <b style={{ color: "var(--fg)" }}>{fmtUSD(total)}</b>
        </span>
      </div>

      <div style={{ ...trackerCard, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface2)", textAlign: "left" }}>
              <th style={th}>Date</th>
              <th style={th}>Member</th>
              <th style={th}>Type</th>
              <th style={{ ...th, textAlign: "right" }}>Amount</th>
              <th style={th}>Reference</th>
              <th style={th}>Notes</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const editable = admin || c.member_name === user;
              return (
                <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{fmtDate(c.contribution_date)}</td>
                  <td style={td}>{llcOf(c.member_name)}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                      color: TYPE_COLOR[c.type], background: `${TYPE_COLOR[c.type]}1f`,
                      border: `1px solid ${TYPE_COLOR[c.type]}33`,
                    }}>
                      {CONTRIBUTION_TYPE_LABEL[c.type]}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtUSD(Number(c.amount))}</td>
                  <td style={td}>{c.reference ?? "—"}</td>
                  <td style={td}>{c.notes ?? "—"}</td>
                  <td style={td}>
                    {editable
                      ? <button onClick={() => remove(c)} style={iconBtnDanger}>Delete</button>
                      : <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && !loading && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: 24 }}>No deposits yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </TrackerShell>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
const iconBtnDanger: React.CSSProperties = { background: "transparent", border: "1px solid rgba(20,17,13,0.3)", color: "var(--obsidian)", borderRadius: 4, padding: "3px 8px", fontSize: 11, cursor: "pointer" };
