"use client";
import { useState, useEffect } from "react";
import { categories, MEMBERS, Question } from "@/data/questions";

const priorityBadge = (p: Question["priority"]) => {
  const config = {
    critical: { emoji: "🔴", label: "Critical", color: "#e55" },
    important: { emoji: "🟡", label: "Important", color: "#da5" },
    recommended: { emoji: "🟢", label: "Recommended", color: "#5a5" },
  };
  const c = config[p];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: c.color, marginLeft: 8, whiteSpace: "nowrap" }}>
      {c.emoji} {c.label}
    </span>
  );
};

export default function ResultsPage() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState("");
  const [allAnswers, setAllAnswers] = useState<Record<string, Record<string, string>>>({});
  const [activeCategory, setActiveCategory] = useState(0);
  const [showCriticalSummary, setShowCriticalSummary] = useState(false);

  useEffect(() => {
    if (!authed) return;
    const data: Record<string, Record<string, string>> = {};
    MEMBERS.forEach(m => {
      const raw = localStorage.getItem(`meridian_answers_${m}`);
      if (raw) data[m] = JSON.parse(raw);
    });
    setAllAnswers(data);
  }, [authed]);

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Results Access</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>Enter admin code to view all responses.</p>
          <form onSubmit={e => { e.preventDefault(); if (code === "admin2026") setAuthed(true); }} style={{ display: "flex", gap: 12 }}>
            <input
              type="password" placeholder="Admin code" value={code} onChange={e => setCode(e.target.value)}
              style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)", borderRadius: 8, padding: "10px 14px", fontSize: 14 }}
            />
            <button type="submit" style={{ background: "var(--gold)", color: "var(--bg)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14 }}>
              View
            </button>
          </form>
        </div>
      </div>
    );
  }

  const qKey = (ci: number, qi: number) => `${ci}-${qi}`;
  const membersWithData = MEMBERS.filter(m => allAnswers[m]);

  const getConsensus = (ci: number, qi: number) => {
    const responses: string[] = [];
    MEMBERS.forEach(m => {
      const answer = allAnswers[m]?.[qKey(ci, qi)]?.trim();
      if (answer) responses.push(answer);
    });
    if (responses.length < 2) return null;

    const counts: Record<string, number> = {};
    responses.forEach(r => { counts[r] = (counts[r] || 0) + 1; });

    const maxCount = Math.max(...Object.values(counts));
    if (maxCount < 2) return null;

    const topAnswer = Object.entries(counts).find(([, c]) => c === maxCount)!;
    return { answer: topAnswer[0], count: topAnswer[1], total: responses.length };
  };

  // Gather all critical questions across all categories
  const criticalQuestions: { ci: number; qi: number; catName: string; q: Question }[] = [];
  categories.forEach((cat, ci) => {
    cat.questions.forEach((q, qi) => {
      if (q.priority === "critical") {
        criticalQuestions.push({ ci, qi, catName: cat.name, q });
      }
    });
  });

  const renderQuestion = (ci: number, qi: number, q: Question, displayNum: number, showCategory?: string) => {
    const consensus = getConsensus(ci, qi);
    return (
      <div key={`${ci}-${qi}`} style={{ background: "var(--surface)", borderRadius: 12, padding: 24 }}>
        {showCategory && (
          <p style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{showCategory}</p>
        )}
        <p style={{ fontWeight: 600, marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: "var(--gold)" }}>{displayNum}.</span> {q.text}
          {priorityBadge(q.priority)}
        </p>

        {consensus && (
          <div style={{
            background: consensus.count === consensus.total ? "rgba(90,170,90,0.15)" : "rgba(200,170,50,0.12)",
            border: consensus.count === consensus.total ? "1px solid rgba(90,170,90,0.3)" : "1px solid rgba(200,170,50,0.25)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12,
          }}>
            <span style={{ fontWeight: 600, color: consensus.count === consensus.total ? "#5a5" : "var(--gold)" }}>
              {consensus.count === consensus.total ? "✓ Full Consensus" : `⚡ ${consensus.count}/${consensus.total} agree`}:
            </span>{" "}
            <span style={{ color: "var(--fg)" }}>{consensus.answer}</span>
          </div>
        )}

        {membersWithData.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>No responses yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MEMBERS.map(m => {
              const answer = allAnswers[m]?.[qKey(ci, qi)];
              if (!answer?.trim()) return null;
              const isConsensusAnswer = consensus && answer === consensus.answer;
              return (
                <div key={m} style={{
                  background: "var(--surface2)", borderRadius: 8, padding: "12px 16px",
                  borderLeft: isConsensusAnswer ? "3px solid #5a5" : "3px solid transparent",
                }}>
                  <p style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{m}</p>
                  <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{answer}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: "40px 20px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Survey Results</h1>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>{membersWithData.length} of {MEMBERS.length} members have responded</p>
        </div>
        <a href="/" style={{ color: "var(--gold)", fontSize: 13, textDecoration: "none" }}>← Back</a>
      </div>

      {/* View toggle: Critical Summary vs Categories */}
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
          🔴 Critical Questions ({criticalQuestions.length})
        </button>
      </div>

      {showCriticalSummary ? (
        <>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
            These {criticalQuestions.length} questions must be answered before the operating agreement can be drafted.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {criticalQuestions.map((cq, idx) =>
              renderQuestion(cq.ci, cq.qi, cq.q, idx + 1, cq.catName)
            )}
          </div>
        </>
      ) : (
        <>
          {/* Category tabs */}
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

          {/* Questions & answers */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {categories[activeCategory].questions.map((q, qi) =>
              renderQuestion(activeCategory, qi, q, qi + 1)
            )}
          </div>
        </>
      )}
    </div>
  );
}
