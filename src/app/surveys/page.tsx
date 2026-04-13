"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAllSurveys } from "@/data/surveys";
import { MEMBERS } from "@/data/questions";
import { migrateLocalStorage, getStorageKey } from "@/lib/migration";

export default function SurveysPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    migrateLocalStorage(u);
  }, [router]);

  if (!user) return null;

  const surveys = getAllSurveys();

  function getProgress(surveyId: string, member: string): { answered: number; total: number } {
    const survey = surveys.find(s => s.id === surveyId);
    if (!survey) return { answered: 0, total: 0 };
    const total = survey.categories.reduce((s, c) => s + c.questions.length, 0);
    const raw = localStorage.getItem(getStorageKey(surveyId, member));
    if (!raw) return { answered: 0, total };
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      const answered = Object.values(data).filter(v => {
        if (Array.isArray(v)) return v.length > 0;
        return typeof v === "string" && v.trim() !== "";
      }).length;
      return { answered, total };
    } catch { return { answered: 0, total }; }
  }

  return (
    <div style={{ minHeight: "100vh", padding: "80px 24px 40px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Meridian Collective
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Surveys</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
          Select a survey to begin or continue your responses.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {surveys.map(survey => {
          const totalQ = survey.categories.reduce((s, c) => s + c.questions.length, 0);
          const myProgress = getProgress(survey.id, user);
          const myPct = totalQ > 0 ? Math.round((myProgress.answered / totalQ) * 100) : 0;

          // Count how many members have started
          const membersStarted = MEMBERS.filter(m => {
            const p = getProgress(survey.id, m);
            return p.answered > 0;
          }).length;

          return (
            <button
              key={survey.id}
              onClick={() => router.push(`/survey/${survey.id}`)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "24px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.background = "var(--surface2)"; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{survey.title}</h2>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{survey.description}</p>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 12,
                  background: myPct === 100 ? "rgba(90,170,90,0.15)" : myPct > 0 ? "rgba(197,165,114,0.15)" : "var(--surface2)",
                  color: myPct === 100 ? "#5a5" : myPct > 0 ? "var(--gold)" : "var(--muted)",
                  whiteSpace: "nowrap", marginLeft: 16,
                }}>
                  {myPct === 100 ? "Complete" : myPct > 0 ? `${myPct}%` : "Not started"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                <span>{totalQ} questions</span>
                <span>{survey.categories.length} categories</span>
                <span>{membersStarted}/{MEMBERS.length} members started</span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                <div style={{
                  height: "100%", borderRadius: 2, transition: "width 0.3s",
                  background: myPct === 100 ? "#5a5" : "var(--gold)",
                  width: `${myPct}%`,
                }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                <span>Your progress: {myProgress.answered}/{totalQ}</span>
                <span style={{ color: "var(--gold)" }}>
                  {myPct === 100 ? "View Results →" : myPct > 0 ? "Continue →" : "Start →"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
