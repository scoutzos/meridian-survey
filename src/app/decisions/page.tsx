"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { decisions, DecisionStatus } from "@/data/decisions";

const STATUS_CONFIG: Record<DecisionStatus, { label: string; color: string; bg: string; icon: string }> = {
  confirmed: { label: "Confirmed", color: "#6B8F7B", bg: "rgba(107,143,123,0.12)", icon: "✅" },
  tabled: { label: "Tabled", color: "#C5A572", bg: "rgba(197,165,114,0.12)", icon: "⚠️" },
  remaining: { label: "Remaining", color: "#888", bg: "rgba(136,136,136,0.08)", icon: "⬜" },
};

export default function DecisionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DecisionStatus | "all">("all");

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  const confirmed = decisions.filter(d => d.status === "confirmed");
  const tabled = decisions.filter(d => d.status === "tabled");
  const remaining = decisions.filter(d => d.status === "remaining");
  const total = decisions.length;
  const pct = Math.round((confirmed.length / total) * 100);

  const filtered = activeTab === "all" ? decisions : decisions.filter(d => d.status === activeTab);

  // Group by category
  const grouped: Record<string, typeof decisions> = {};
  for (const d of filtered) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 100px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Decision Tracker</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
        Track confirmed decisions, tabled items, and remaining questions for the Operating Agreement.
      </p>

      {/* Progress Bar */}
      <div style={{ background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 20, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Overall Progress</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: "#6B8F7B" }}>{pct}%</span>
        </div>
        <div style={{ background: "var(--surface2)", borderRadius: 6, height: 10, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #6B8F7B, #C5A572)",
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
          const isActive = activeTab === status;
          return (
            <button
              key={status}
              onClick={() => setActiveTab(activeTab === status ? "all" : status)}
              style={{
                background: isActive ? cfg.bg : "var(--surface)",
                border: isActive ? `2px solid ${cfg.color}` : "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 12px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color }}>{count}</div>
              <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600, letterSpacing: "0.5px" }}>
                {cfg.icon} {cfg.label.toUpperCase()}
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
              return (
                <div
                  key={d.id}
                  style={{
                    background: "var(--surface)",
                    border: `1px solid ${d.status === "confirmed" ? "rgba(107,143,123,0.3)" : "var(--border)"}`,
                    borderLeft: `4px solid ${cfg.color}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{d.topic}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg,
                          padding: "2px 8px", borderRadius: 4, letterSpacing: "0.5px",
                        }}>
                          {cfg.label.toUpperCase()}
                        </span>
                      </div>
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
                    </div>
                    {d.meetingDate && (
                      <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {d.meetingDate}
                      </span>
                    )}
                  </div>
                  {d.questionId && (
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

      {/* Last updated */}
      <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 24 }}>
        Last updated: March 26, 2026 · Meeting #2
      </div>
    </div>
  );
}
