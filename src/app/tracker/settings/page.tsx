"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  MemberProfile,
  TrackerSettings,
  isAdmin,
  logAudit,
} from "@/lib/tracker";
import { MEMBERS } from "@/data/questions";
import TrackerShell, { trackerCard, trackerInput, trackerBtn } from "@/components/TrackerShell";

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
    const [s, p] = await Promise.all([
      supabase.from("tracker_settings").select("*").eq("key", "tracker").maybeSingle(),
      supabase.from("tracker_member_profiles").select("*").order("member_name"),
    ]);
    const settingsRow = (s.data as TrackerSettings | null) ?? null;
    const profileRows = (p.data as MemberProfile[] | null) ?? [];
    setSettings(settingsRow);
    setProfiles(profileRows);
    setLlcStartDate(settingsRow?.llc_start_date ?? "");
    setMonthsTracked(settingsRow?.months_tracked ?? 3);
    const llcMap: Record<string, string> = {};
    const adminMap: Record<string, boolean> = {};
    for (const m of MEMBERS) {
      const row = profileRows.find(r => r.member_name === m);
      llcMap[m] = row?.llc_name ?? "";
      adminMap[m] = row?.is_admin ?? false;
    }
    setLlcNames(llcMap);
    setAdminFlags(adminMap);
    setLoading(false);
  }

  if (!user) return null;

  const admin = isAdmin(profiles, user);

  async function save() {
    if (!supabase || !user) return;
    setSaving(true);
    setMsg(null);
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

    for (const m of MEMBERS) {
      const existing = profiles.find(p => p.member_name === m);
      const newLlc = llcNames[m]?.trim() || m;
      const newAdmin = !!adminFlags[m];
      if (existing && existing.llc_name === newLlc && existing.is_admin === newAdmin) continue;
      const { error: e2 } = await supabase
        .from("tracker_member_profiles")
        .upsert({
          member_name: m,
          llc_name: newLlc,
          is_admin: newAdmin,
          updated_at: new Date().toISOString(),
        });
      if (e2) { setMsg(`Error on ${m}: ${e2.message}`); setSaving(false); return; }
      await logAudit({
        actor: user,
        table_name: "tracker_member_profiles",
        row_id: m,
        action: existing ? "update" : "create",
        diff: { before: existing, after: { member_name: m, llc_name: newLlc, is_admin: newAdmin } },
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

  return (
    <TrackerShell
      title="Settings"
      subtitle="LLC start date, tracking horizon, and per-member LLC entity names."
    >
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
          Each member is a person in the auth table; their LLC entity name is shown across the tracker. Admin flag controls who can edit other members&apos; data, settings, and approve capital calls.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MEMBERS.map(m => (
            <div
              key={m}
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr 90px",
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
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  checked={!!adminFlags[m]}
                  onChange={e => setAdminFlags({ ...adminFlags, [m]: e.target.checked })}
                />
                Admin
              </label>
            </div>
          ))}
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
