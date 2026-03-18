"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { categories, MEMBERS, Question } from "@/data/questions";

const priorityBadge = (p: Question["priority"]) => {
  const config = {
    critical: { label: "Critical", color: "#e55" },
    important: { label: "Important", color: "#da5" },
    recommended: { label: "Recommended", color: "#5a5" },
  };
  const c = config[p];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: c.color, marginLeft: 8, whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.color, marginRight: 4 }} /> {c.label}
    </span>
  );
};

export default function ResultsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [allAnswers, setAllAnswers] = useState<Record<string, Record<string, string[] | string>>>({});
  const [activeCategory, setActiveCategory] = useState(0);
  const [showCriticalSummary, setShowCriticalSummary] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    const data: Record<string, Record<string, string>> = {};
    MEMBERS.forEach(m => {
      const raw = localStorage.getItem(`meridian_answers_${m}`);
      if (raw) data[m] = JSON.parse(raw);
    });
    setAllAnswers(data);
  }, [router]);

  if (!user) return null;

  const qKey = (ci: number, qi: number) => `${ci}-${qi}`;
  const membersWithData = MEMBERS.filter(m => allAnswers[m]);

  const parseSelections = (val: string[] | string | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim()) return [val];
    return [];
  };

  const getOptionTally = (ci: number, qi: number) => {
    const allSelections: string[][] = [];
    MEMBERS.forEach(m => {
      const sel = parseSelections(allAnswers[m]?.[qKey(ci, qi)]);
      if (sel.length > 0) allSelections.push(sel);
    });
    if (allSelections.length === 0) return null;
    const counts: Record<string, number> = {};
    allSelections.forEach(sel => {
      sel.forEach(opt => { counts[opt] = (counts[opt] || 0) + 1; });
    });
    const sharedOptions = Object.entries(counts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
    const total = allSelections.length;
    return { counts, sharedOptions, total };
  };

  const criticalQuestions: { ci: number; qi: number; catName: string; q: Question }[] = [];
  categories.forEach((cat, ci) => {
    cat.questions.forEach((q, qi) => {
      if (q.priority === "critical") criticalQuestions.push({ ci, qi, catName: cat.name, q });
    });
  });

  const renderQuestion = (ci: number, qi: number, q: Question, displayNum: number, showCategory?: string) => {
    const tally = getOptionTally(ci, qi);
    return (
      <div key={`${ci}-${qi}`} style={{ background: "var(--surface)", borderRadius: 12, padding: 24 }}>
        {showCategory && (
          <p style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{showCategory}</p>
        )}
        <p style={{ fontWeight: 600, marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: "var(--gold)" }}>{displayNum}.</span> {q.text}
          {priorityBadge(q.priority)}
        </p>
        {tally && tally.sharedOptions.length > 0 && (
          <div style={{
            background: "rgba(200,170,50,0.12)", border: "1px solid rgba(200,170,50,0.25)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12,
          }}>
            {tally.sharedOptions.map(([opt, count]) => {
              const isFull = count === tally.total;
              return (
                <div key={opt} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: isFull ? "#5a5" : "var(--gold)" }}>
                    {isFull ? "✓" : "⚡"} {count}/{tally.total} selected
                  </span>{" "}
                  <span style={{ color: "var(--fg)" }}>{opt}</span>
                </div>
              );
            })}
          </div>
        )}
        {membersWithData.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>No responses yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MEMBERS.map(m => {
              const raw = allAnswers[m]?.[qKey(ci, qi)];
              const selections = parseSelections(raw);
              if (selections.length === 0) return null;
              return (
                <div key={m} style={{ background: "var(--surface2)", borderRadius: 8, padding: "12px 16px", borderLeft: "3px solid transparent" }}>
                  <p style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{m}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selections.map((sel, i) => (
                      <span key={i} style={{
                        display: "inline-block", padding: "4px 10px", borderRadius: 12,
                        background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, lineHeight: 1.4,
                      }}>{sel}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: "72px 20px 80px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Survey Results</h1>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>{membersWithData.length} of {MEMBERS.length} members have responded</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => setShowCriticalSummary(false)}
          style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border)",
            background: !showCriticalSummary ? "var(--gold)" : "transparent",
            color: !showCriticalSummary ? "var(--bg)" : "var(--muted)",
            fontWeight: !showCriticalSummary ? 600 : 400, cursor: "pointer",
          }}
        >
          By Category
        </button>
        <button
          onClick={() => setShowCriticalSummary(true)}
          style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border)",
            background: showCriticalSummary ? "#e55" : "transparent",
            color: showCriticalSummary ? "#fff" : "var(--muted)",
            fontWeight: showCriticalSummary ? 600 : 400, cursor: "pointer",
          }}
        >
          Critical Questions ({criticalQuestions.length})
        </button>
      </div>

      {showCriticalSummary ? (
        <>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
            These {criticalQuestions.length} questions must be answered before the operating agreement can be drafted.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {criticalQuestions.map((cq, idx) => renderQuestion(cq.ci, cq.qi, cq.q, idx + 1, cq.catName))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
            {categories.map((cat, ci) => (
              <button key={ci} onClick={() => setActiveCategory(ci)} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, border: "1px solid var(--border)",
                background: ci === activeCategory ? "var(--gold)" : "transparent",
                color: ci === activeCategory ? "var(--bg)" : "var(--muted)",
                fontWeight: ci === activeCategory ? 600 : 400,
              }}>
                {cat.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {categories[activeCategory].questions.map((q, qi) => renderQuestion(activeCategory, qi, q, qi + 1))}
          </div>
        </>
      )}
    </div>
  );
}
