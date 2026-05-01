"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { type DecisionStatus } from "@/data/decisions";
import {
  fetchDecisions,
  rowToDecision,
  updateDecision,
  type DecisionRow,
} from "@/lib/decisions";
import { supabase } from "@/lib/supabase";
import { isAdmin, type MemberProfile } from "@/lib/tracker";

const STATUS_CONFIG: Record<DecisionStatus, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Confirmed", color: "var(--gold)",   bg: "rgba(201,168,120,0.12)" },
  tabled:    { label: "Tabled",    color: "var(--gold)",   bg: "rgba(201,168,120,0.12)" },
  remaining: { label: "Remaining", color: "var(--muted)",  bg: "rgba(214,209,196,0.08)" },
};

const STATUSES: DecisionStatus[] = ["confirmed", "tabled", "remaining"];

export default function DecisionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DecisionStatus | "all">("all");
  const [rows, setRows] = useState<DecisionRow[]>([]);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ status: DecisionStatus; final_answer: string; notes: string }>(
    { status: "remaining", final_answer: "", notes: "" },
  );

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchDecisions();
    setRows(data);
    if (supabase) {
      const { data: profilesData } = await supabase
        .from("tracker_member_profiles")
        .select("*");
      setProfiles((profilesData as MemberProfile[] | null) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
    if (!supabase) return;
    const sb = supabase;
    const ch = sb
      .channel("decisions_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "decisions" }, () => load())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [router, load]);

  if (!user) return null;
  const admin = isAdmin(profiles, user);

  const decisions = rows.map(rowToDecision);
  const confirmed = decisions.filter(d => d.status === "confirmed");
  const tabled = decisions.filter(d => d.status === "tabled");
  const remaining = decisions.filter(d => d.status === "remaining");
  const total = decisions.length;
  const pct = total > 0 ? Math.round((confirmed.length / total) * 100) : 0;

  const filtered = activeTab === "all" ? decisions : decisions.filter(d => d.status === activeTab);

  const grouped: Record<string, typeof decisions> = {};
  for (const d of filtered) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  }

  function startEdit(row: DecisionRow) {
    setEditingId(row.id);
    setDraft({
      status: row.status,
      final_answer: row.final_answer ?? "",
      notes: row.notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editingId || !user) return;
    const { error } = await updateDecision(editingId, {
      status: draft.status,
      final_answer: draft.final_answer.trim() || null,
      notes: draft.notes.trim() || null,
      meeting_date: draft.status === "confirmed" || draft.status === "tabled"
        ? (rows.find(r => r.id === editingId)?.meeting_date ?? new Date().toISOString().slice(0, 10))
        : null,
    }, user);
    if (error) { alert(error); return; }
    setEditingId(null);
    void load();
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 100px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Decision Tracker</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
        Track confirmed decisions, tabled items, and remaining questions for the Operating Agreement.
        {admin && <span style={{ marginLeft: 8, color: "var(--gold)" }}>· Admin: click any decision to edit.</span>}
      </p>

      {/* Progress Bar */}
      <div style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 20, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Overall Progress</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>{pct}%</span>
        </div>
        <div style={{ background: "var(--surface2)", borderRadius: 6, height: 10, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, var(--gold-dim), var(--gold))",
            borderRadius: 6,
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          <span>{confirmed.length} of {total} items decided</span>
          <span>{remaining.length + tabled.length} remaining</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {([
          { status: "confirmed" as const, count: confirmed.length },
          { status: "tabled" as const, count: tabled.length },
          { status: "remaining" as const, count: remaining.length },
        ]).map(({ status, count }) => {
          const cfg = STATUS_CONFIG[status];
          const isActiveTab = activeTab === status;
          return (
            <button
              key={status}
              onClick={() => setActiveTab(activeTab === status ? "all" : status)}
              style={{
                background: isActiveTab ? cfg.bg : "var(--surface)",
                border: isActiveTab ? `2px solid ${cfg.color}` : "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 12px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color }}>{count}</div>
              <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600, letterSpacing: "0.5px" }}>
                {cfg.label.toUpperCase()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter indicator */}
      {activeTab !== "all" && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 14px", background: STATUS_CONFIG[activeTab].bg, borderRadius: 8, marginBottom: 16, fontSize: 13,
        }}>
          <span>Showing: <b>{STATUS_CONFIG[activeTab].label}</b> items only</span>
          <button onClick={() => setActiveTab("all")} style={{
            background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>Show All</button>
        </div>
      )}

      {loading && <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</div>}

      {/* Decision Cards by Category */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 20 }}>
          <h2 style={{
            fontSize: 13, fontWeight: 700, color: "var(--gold)", letterSpacing: "0.5px",
            marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)",
          }}>
            {category.toUpperCase()}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(d => {
              const cfg = STATUS_CONFIG[d.status];
              const row = rows.find(r => r.id === d.id);
              const isEditing = editingId === d.id;
              return (
                <div
                  key={d.id}
                  onClick={() => { if (admin && !isEditing && row) startEdit(row); }}
                  style={{
                    background: "var(--surface)",
                    border: `1px solid ${d.status === "confirmed" ? "rgba(201,168,120,0.3)" : "var(--border)"}`,
                    borderLeft: `4px solid ${cfg.color}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    cursor: admin && !isEditing ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{d.topic}</span>
                        {!isEditing && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg,
                            padding: "2px 8px", borderRadius: 4, letterSpacing: "0.5px",
                          }}>
                            {cfg.label.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {isEditing ? (
                        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                          <select
                            value={draft.status}
                            onChange={e => setDraft({ ...draft, status: e.target.value as DecisionStatus })}
                            style={inputStyle}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                          </select>
                          <textarea
                            value={draft.final_answer}
                            onChange={e => setDraft({ ...draft, final_answer: e.target.value })}
                            placeholder="Final answer (the agreed decision)"
                            rows={3}
                            style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical", minHeight: 60 }}
                          />
                          <textarea
                            value={draft.notes}
                            onChange={e => setDraft({ ...draft, notes: e.target.value })}
                            placeholder="Notes / context"
                            rows={2}
                            style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical", minHeight: 40 }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveEdit} style={btnStyle}>Save</button>
                            <button onClick={() => setEditingId(null)} style={btnSubtleStyle}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {d.finalAnswer && (
                            <p style={{ fontSize: 13, color: "var(--fg)", margin: "6px 0", lineHeight: 1.5 }}>
                              {d.finalAnswer}
                            </p>
                          )}
                          {d.notes && (
                            <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0", fontStyle: "italic" }}>
                              {d.notes}
                            </p>
                          )}
                          {row?.monetary_kind && row?.monetary_value !== null && (
                            <div style={{ marginTop: 6, fontSize: 11 }}>
                              <span style={{
                                color: "var(--gold-dim)", background: "rgba(142,107,63,0.10)",
                                padding: "2px 8px", borderRadius: 4,
                                border: "1px solid rgba(142,107,63,0.3)", fontWeight: 600,
                              }}>
                                ${Number(row.monetary_value).toLocaleString()} · {row.monetary_kind?.replace(/_/g, " ")}
                              </span>
                              <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: 10 }}>(consumed by tracker)</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {!isEditing && d.meetingDate && (
                      <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {d.meetingDate}
                      </span>
                    )}
                  </div>
                  {!isEditing && d.questionId && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        fontSize: 10, color: "var(--muted)", background: "var(--surface2)",
                        padding: "2px 6px", borderRadius: 4,
                      }}>
                        Survey Q: {d.questionId}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--fg)",
  borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%",
};
const btnStyle: React.CSSProperties = {
  background: "var(--gold)", color: "var(--bg)", border: "none",
  borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer",
};
const btnSubtleStyle: React.CSSProperties = {
  background: "var(--surface2)", color: "var(--fg)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 16px", fontWeight: 500, fontSize: 13, cursor: "pointer",
};
