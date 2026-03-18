"use client";
import { useState, useEffect } from "react";
import { categories, MEMBERS } from "@/data/questions";

export default function ResultsPage() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState("");
  const [allAnswers, setAllAnswers] = useState<Record<string, Record<string, string>>>({});
  const [activeCategory, setActiveCategory] = useState(0);

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

  // Find consensus for a question
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
    if (maxCount < 2) return null; // no agreement

    const topAnswer = Object.entries(counts).find(([, c]) => c === maxCount)!;
    return { answer: topAnswer[0], count: topAnswer[1], total: responses.length };
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
        {categories[activeCategory].questions.map((q, qi) => {
          const consensus = getConsensus(activeCategory, qi);

          return (
            <div key={qi} style={{ background: "var(--surface)", borderRadius: 12, padding: 24 }}>
              <p style={{ fontWeight: 600, marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
                <span style={{ color: "var(--gold)" }}>{qi + 1}.</span> {q.text}
              </p>

              {/* Consensus banner */}
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
                    const answer = allAnswers[m]?.[qKey(activeCategory, qi)];
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
        })}
      </div>
    </div>
  );
}
