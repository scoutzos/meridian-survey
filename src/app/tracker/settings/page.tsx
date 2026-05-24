"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  allTrackerMembers,
  isAdmin,
  logAudit,
  type MemberProfile,
  type MemberStatus,
  type TrackerSettings,
} from "@/lib/tracker";
import { fetchMonetaryDecisions, type MonetaryKind } from "@/lib/decisions";
import TrackerShell, { trackerCard, trackerInput, trackerBtn } from "@/components/TrackerShell";

type DecisionMoney = Awaited<ReturnType<typeof fetchMonetaryDecisions>>;

export default function TrackerSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // editable copies
  const [llcStartDate, setLlcStartDate] = useState("");
  const [monthsTracked, setMonthsTracked] = useState(3);
  const [llcNames, setLlcNames] = useState<Record<string, string>>({});
  const [adminFlags, setAdminFlags] = useState<Record<string, boolean>>({});
  const [memberStatuses, setMemberStatuses] = useState<Record<string, MemberStatus>>({});
  const [withdrawalDates, setWithdrawalDates] = useState<Record<string, string>>({});
  const [withdrawalNotes, setWithdrawalNotes] = useState<Record<string, string>>({});
  // Confirmed-decision monetary values surfaced as authoritative.
  const [decisionMoney, setDecisionMoney] = useState<DecisionMoney>({});

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [s, p, money] = await Promise.all([
      supabase.from("tracker_settings").select("*").eq("key", "tracker").maybeSingle(),
      supabase.from("tracker_member_profiles").select("*").order("member_name"),
      fetchMonetaryDecisions(),
    ]);
    setDecisionMoney(money);
    const settingsRow = (s.data as TrackerSettings | null) ?? null;
    const profileRows = (p.data as MemberProfile[] | null) ?? [];
    setSettings(settingsRow);
    setProfiles(profileRows);
    setLlcStartDate(settingsRow?.llc_start_date ?? "");
    setMonthsTracked(settingsRow?.months_tracked ?? 3);
    const llcMap: Record<string, string> = {};
    const adminMap: Record<string, boolean> = {};
    const statusMap: Record<string, MemberStatus> = {};
    const withdrawalDateMap: Record<string, string> = {};
    const withdrawalNoteMap: Record<string, string> = {};
    const memberNames = allTrackerMembers(profileRows).map(member => member.name);
    for (const m of memberNames) {
      const row = profileRows.find(r => r.member_name === m);
      llcMap[m] = row?.llc_name ?? "";
      adminMap[m] = row?.is_admin ?? false;
      statusMap[m] = row?.member_status === "withdrawn" ? "withdrawn" : "active";
      withdrawalDateMap[m] = row?.withdrawn_effective_date ?? "";
      withdrawalNoteMap[m] = row?.withdrawal_note ?? "";
    }
    setLlcNames(llcMap);
    setAdminFlags(adminMap);
    setMemberStatuses(statusMap);
    setWithdrawalDates(withdrawalDateMap);
    setWithdrawalNotes(withdrawalNoteMap);
    setLoading(false);
  }

  if (!user) return null;

  const admin = isAdmin(profiles, user);

  async function save() {
    if (!supabase || !user) return;
    setSaving(true);
    setMsg(null);
    const memberNames = allTrackerMembers(profiles).map(member => member.name);
    for (const m of memberNames) {
      if (memberStatuses[m] === "withdrawn" && !withdrawalDates[m]) {
        setMsg(`Error on ${m}: withdrawal effective date is required.`);
        setSaving(false);
        return;
      }
    }
    if (memberStatuses[user] === "withdrawn") {
      setMsg("Error: ask another active admin to mark your own profile withdrawn.");
      setSaving(false);
      return;
    }
    const activeAdminsAfter = memberNames.filter(m => memberStatuses[m] !== "withdrawn" && adminFlags[m]).length;
    if (activeAdminsAfter < 1) {
      setMsg("Error: at least one active admin is required.");
      setSaving(false);
      return;
    }
    const before = settings;
    const newStart = llcStartDate || null;
    const { error: e1 } = await supabase
      .from("tracker_settings")
      .update({
        llc_start_date: newStart,
        months_tracked: Number(monthsTracked) || 0,
        updated_at: new Date().toISOString(),
        updated_by: user,
      })
      .eq("key", "tracker");
    if (e1) { setMsg(`Error: ${e1.message}`); setSaving(false); return; }
    await logAudit({
      actor: user,
      table_name: "tracker_settings",
      row_id: "tracker",
      action: "update",
      diff: {
        before: { llc_start_date: before?.llc_start_date, months_tracked: before?.months_tracked },
        after:  { llc_start_date: newStart, months_tracked: Number(monthsTracked) || 0 },
      },
    });

    for (const m of memberNames) {
      const existing = profiles.find(p => p.member_name === m);
      const newLlc = llcNames[m]?.trim() || m;
      const newStatus = memberStatuses[m] ?? "active";
      const newAdmin = newStatus === "withdrawn" ? false : !!adminFlags[m];
      const newWithdrawalDate = newStatus === "withdrawn" ? withdrawalDates[m] || null : null;
      const newWithdrawalNote = newStatus === "withdrawn" ? withdrawalNotes[m]?.trim() || null : null;
      const wasWithdrawn = existing?.member_status === "withdrawn";
      const nextProfile = {
        member_name: m,
        llc_name: newLlc,
        is_admin: newAdmin,
        member_status: newStatus,
        withdrawn_effective_date: newWithdrawalDate,
        withdrawn_at: newStatus === "withdrawn" ? existing?.withdrawn_at ?? new Date().toISOString() : null,
        withdrawn_by: newStatus === "withdrawn" ? existing?.withdrawn_by ?? user : null,
        withdrawal_note: newWithdrawalNote,
        updated_at: new Date().toISOString(),
      };
      if (
        existing
        && existing.llc_name === newLlc
        && existing.is_admin === newAdmin
        && (existing.member_status ?? "active") === newStatus
        && (existing.withdrawn_effective_date ?? null) === newWithdrawalDate
        && (existing.withdrawal_note ?? null) === newWithdrawalNote
      ) continue;
      const { error: e2 } = await supabase
        .from("tracker_member_profiles")
        .upsert(nextProfile, { onConflict: "member_name" });
      if (e2) { setMsg(`Error on ${m}: ${e2.message}`); setSaving(false); return; }
      await logAudit({
        actor: user,
        table_name: "tracker_member_profiles",
        row_id: m,
        action: existing ? "update" : "create",
        diff: {
          before: existing,
          after: nextProfile,
          withdrawal_changed: wasWithdrawn !== (newStatus === "withdrawn"),
        },
      });
    }
    setMsg("Saved.");
    setSaving(false);
    void load();
  }

  if (loading) {
    return (
      <TrackerShell title="Settings">
        <div style={{ color: "var(--muted)" }}>Loading…</div>
      </TrackerShell>
    );
  }

  if (!admin) {
    return (
      <TrackerShell title="Settings">
        <div style={{ ...trackerCard, color: "var(--muted)" }}>
          Settings are visible to admins only.
        </div>
      </TrackerShell>
    );
  }

  const moneyEntries = (Object.entries(decisionMoney) as Array<[
    MonetaryKind,
    { value: number; decisionId: string; finalAnswer: string | null; meetingDate: string | null },
  ]>);
  const memberRows = allTrackerMembers(profiles);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <TrackerShell
      title="Settings"
      subtitle="LLC start date, tracking horizon, and per-member LLC entity names."
    >
      {moneyEntries.length > 0 && (
        <div style={{ ...trackerCard, marginBottom: 16, borderLeft: "4px solid var(--gold)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>OA-derived values</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            These dollar amounts come from confirmed decisions on the Decisions page and are the authoritative source for the tracker. To change them, edit the corresponding decision (admin) — not the fields below.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {moneyEntries.map(([kind, info]) => (
              <div key={kind} style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                padding: "8px 12px", background: "var(--surface2)", borderRadius: 8,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{kind.replace(/_/g, " ")}</div>
                  {info.finalAnswer && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{info.finalAnswer}</div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>
                    ${Number(info.value).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    decision {info.decisionId}{info.meetingDate ? ` · ${info.meetingDate}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...trackerCard, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>LLC formation</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ fontSize: 13 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>LLC start date</div>
            <input
              type="date"
              value={llcStartDate}
              onChange={e => setLlcStartDate(e.target.value)}
              style={trackerInput}
            />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              Placeholder until OA is signed. Drives M1/M2/Pre-formation classification.
            </div>
          </label>
          <label style={{ fontSize: 13 }}>
            <div style={{ color: "var(--muted)", marginBottom: 4 }}>Months tracked</div>
            <input
              type="number"
              min={1}
              value={monthsTracked}
              onChange={e => setMonthsTracked(Number(e.target.value))}
              style={trackerInput}
            />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              Total months of expenses tracked. Monthly dues target divides M2…Mn over (months − 1).
            </div>
          </label>
        </div>
      </div>

      <div style={{ ...trackerCard, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Member profiles</h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          Active members are included in future votes, assignments, and money splits. Withdrawn members keep their historical records, but are excluded from money dated on or after the effective date.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {memberRows.map(member => member.name).map(m => {
            const status = memberStatuses[m] ?? "active";
            return (
            <div
              key={m}
              style={{
                display: "grid",
                gridTemplateColumns: "190px minmax(180px, 1fr) 118px 154px 1fr 90px",
                gap: 12,
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>{m}</span>
              <input
                type="text"
                value={llcNames[m] ?? ""}
                placeholder="LLC entity name"
                onChange={e => setLlcNames({ ...llcNames, [m]: e.target.value })}
                style={trackerInput}
              />
              <select
                value={status}
                onChange={e => {
                  const nextStatus = e.target.value as MemberStatus;
                  setMemberStatuses({ ...memberStatuses, [m]: nextStatus });
                  if (nextStatus === "withdrawn") {
                    setWithdrawalDates({ ...withdrawalDates, [m]: withdrawalDates[m] || today });
                    setAdminFlags({ ...adminFlags, [m]: false });
                  }
                }}
                style={trackerInput}
              >
                <option value="active">Active</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
              <input
                type="date"
                value={withdrawalDates[m] ?? ""}
                disabled={status !== "withdrawn"}
                onChange={e => setWithdrawalDates({ ...withdrawalDates, [m]: e.target.value })}
                style={{ ...trackerInput, opacity: status === "withdrawn" ? 1 : 0.55 }}
              />
              <input
                type="text"
                value={withdrawalNotes[m] ?? ""}
                disabled={status !== "withdrawn"}
                placeholder="Withdrawal note"
                onChange={e => setWithdrawalNotes({ ...withdrawalNotes, [m]: e.target.value })}
                style={{ ...trackerInput, opacity: status === "withdrawn" ? 1 : 0.55 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  checked={status !== "withdrawn" && !!adminFlags[m]}
                  disabled={status === "withdrawn"}
                  onChange={e => setAdminFlags({ ...adminFlags, [m]: e.target.checked })}
                />
                Admin
              </label>
            </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ ...trackerBtn, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith("Error") ? "var(--obsidian)" : "var(--gold)" }}>{msg}</span>}
      </div>
    </TrackerShell>
  );
}
