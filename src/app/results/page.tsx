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

interface AlignmentInfo {
  percentage: number;
  topOption: string;
  topCount: number;
  total: number;
  breakdown: { option: string; count: number }[];
}

function getAlignmentColor(pct: number): string {
  if (pct >= 80) return "#6B8F7B";
  if (pct >= 50) return "#C5A572";
  return "#8F6B6B";
}

function getAlignmentLabel(pct: number): string {
  if (pct >= 80) return "Strong Alignment";
  if (pct >= 50) return "Partial Alignment";
  return "Needs Discussion";
}

function AlignmentBar({ percentage, size = "normal" }: { percentage: number; size?: "normal" | "large" }) {
  const color = getAlignmentColor(percentage);
  const label = getAlignmentLabel(percentage);
  const h = size === "large" ? 12 : 8;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: size === "large" ? 280 : 200 }}>
      <div style={{ flex: 1, background: "var(--surface2)", borderRadius: h / 2, height: h, overflow: "hidden" }}>
        <div style={{ width: `${percentage}%`, height: "100%", background: color, borderRadius: h / 2, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: size === "large" ? 20 : 14, fontWeight: 700, color, minWidth: 48, textAlign: "right" }}>{Math.round(percentage)}%</span>
      <span style={{ fontSize: 11, color, fontWeight: 500, minWidth: 100 }}>{label}</span>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [allAnswers, setAllAnswers] = useState<Record<string, Record<string, string[] | string>>>({});
  const [activeCategory, setActiveCategory] = useState(0);
  const [showCriticalSummary, setShowCriticalSummary] = useState(false);
  const [showAlignmentSummary, setShowAlignmentSummary] = useState(false);

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

  const getAlignment = (ci: number, qi: number): AlignmentInfo | null => {
    const tally = getOptionTally(ci, qi);
    if (!tally || tally.total === 0) return null;
    const sorted = Object.entries(tally.counts).sort((a, b) => b[1] - a[1]);
    const topOption = sorted[0][0];
    const topCount = sorted[0][1];
    const percentage = (topCount / tally.total) * 100;
    const breakdown = sorted.map(([option, count]) => ({ option, count }));
    return { percentage, topOption, topCount, total: tally.total, breakdown };
  };

  // Compute all alignments
  const allAlignments: { ci: number; qi: number; q: Question; catName: string; alignment: AlignmentInfo }[] = [];
  categories.forEach((cat, ci) => {
    cat.questions.forEach((q, qi) => {
      const a = getAlignment(ci, qi);
      if (a) allAlignments.push({ ci, qi, q, catName: cat.name, alignment: a });
    });
  });

  const overallAlignment = allAlignments.length > 0
    ? allAlignments.reduce((sum, a) => sum + a.alignment.percentage, 0) / allAlignments.length
    : 0;

  const strongCount = allAlignments.filter(a => a.alignment.percentage >= 80).length;
  const needsDiscussionCount = allAlignments.filter(a => a.alignment.percentage < 50).length;

  const sortedByAlignment = [...allAlignments].sort((a, b) => b.alignment.percentage - a.alignment.percentage);
  const top5 = sortedByAlignment.slice(0, 5);
  const bottom5 = [...allAlignments].sort((a, b) => a.alignment.percentage - b.alignment.percentage).slice(0, 5);

  const getCategoryAlignment = (ci: number): number => {
    const catAlignments = allAlignments.filter(a => a.ci === ci);
    if (catAlignments.length === 0) return 0;
    return catAlignments.reduce((sum, a) => sum + a.alignment.percentage, 0) / catAlignments.length;
  };

  const criticalQuestions: { ci: number; qi: number; catName: string; q: Question }[] = [];
  categories.forEach((cat, ci) => {
    cat.questions.forEach((q, qi) => {
      if (q.priority === "critical") criticalQuestions.push({ ci, qi, catName: cat.name, q });
    });
  });

  const renderAlignmentBreakdown = (alignment: AlignmentInfo) => (
    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
      {alignment.breakdown.map(({ option, count }) => (
        <div key={option} style={{ marginBottom: 2 }}>
          <span style={{ fontWeight: 600 }}>{count}/{alignment.total}</span> selected &ldquo;{option}&rdquo;
        </div>
      ))}
    </div>
  );

  const renderQuestion = (ci: number, qi: number, q: Question, displayNum: number, showCategory?: string) => {
    const tally = getOptionTally(ci, qi);
    const alignment = getAlignment(ci, qi);
    return (
      <div key={`${ci}-${qi}`} style={{ background: "var(--surface)", borderRadius: 12, padding: 24 }}>
        {showCategory && (
          <p style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{showCategory}</p>
        )}
        <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: "var(--gold)" }}>{displayNum}.</span> {q.text}
          {priorityBadge(q.priority)}
        </p>

        {alignment && (
          <div style={{ marginBottom: 16 }}>
            <AlignmentBar percentage={alignment.percentage} />
            {renderAlignmentBreakdown(alignment)}
          </div>
        )}

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

  const renderAlignmentSummary = () => {
    if (allAlignments.length === 0) return (
      <div style={{ background: "var(--surface)", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 32 }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No responses yet to calculate alignment.</p>
      </div>
    );
    return (
      <div style={{ background: "var(--surface)", borderRadius: 12, padding: 32, marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>📊 Alignment Summary</h2>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 28 }}>
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "20px 28px", flex: "1 1 200px", textAlign: "center" }}>
            <p style={{ fontSize: 36, fontWeight: 800, color: getAlignmentColor(overallAlignment) }}>{Math.round(overallAlignment)}%</p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Overall Alignment</p>
            <p style={{ fontSize: 11, color: getAlignmentColor(overallAlignment), fontWeight: 600 }}>{getAlignmentLabel(overallAlignment)}</p>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "20px 28px", flex: "1 1 150px", textAlign: "center" }}>
            <p style={{ fontSize: 36, fontWeight: 800, color: "#6B8F7B" }}>{strongCount}</p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Strong Alignment (80%+)</p>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "20px 28px", flex: "1 1 150px", textAlign: "center" }}>
            <p style={{ fontSize: 36, fontWeight: 800, color: "#8F6B6B" }}>{needsDiscussionCount}</p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Needs Discussion (&lt;50%)</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#6B8F7B" }}>✅ Top 5 Most Aligned</h3>
            {top5.map((a, i) => (
              <div key={i} style={{ marginBottom: 12, padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, borderLeft: `3px solid ${getAlignmentColor(a.alignment.percentage)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 12, lineHeight: 1.4, flex: 1, marginRight: 12 }}>{a.q.text.length > 80 ? a.q.text.slice(0, 80) + "…" : a.q.text}</p>
                  <span style={{ fontSize: 14, fontWeight: 700, color: getAlignmentColor(a.alignment.percentage) }}>{Math.round(a.alignment.percentage)}%</span>
                </div>
                <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{a.catName}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#8F6B6B" }}>⚠️ Top 5 Least Aligned — Discuss These</h3>
            {bottom5.map((a, i) => (
              <div key={i} style={{ marginBottom: 12, padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, borderLeft: `3px solid ${getAlignmentColor(a.alignment.percentage)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 12, lineHeight: 1.4, flex: 1, marginRight: 12 }}>{a.q.text.length > 80 ? a.q.text.slice(0, 80) + "…" : a.q.text}</p>
                  <span style={{ fontSize: 14, fontWeight: 700, color: getAlignmentColor(a.alignment.percentage) }}>{Math.round(a.alignment.percentage)}%</span>
                </div>
                <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{a.catName}</p>
              </div>
            ))}
          </div>
        </div>
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

      {/* Overall alignment score banner */}
      {allAlignments.length > 0 && (
        <div style={{
          background: `linear-gradient(135deg, ${getAlignmentColor(overallAlignment)}22, transparent)`,
          border: `1px solid ${getAlignmentColor(overallAlignment)}44`,
          borderRadius: 12, padding: "16px 24px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Total Group Alignment</p>
            <AlignmentBar percentage={overallAlignment} size="large" />
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>{allAlignments.length} questions answered</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={() => { setShowCriticalSummary(false); setShowAlignmentSummary(false); }}
          style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border)",
            background: !showCriticalSummary && !showAlignmentSummary ? "var(--gold)" : "transparent",
            color: !showCriticalSummary && !showAlignmentSummary ? "var(--bg)" : "var(--muted)",
            fontWeight: !showCriticalSummary && !showAlignmentSummary ? 600 : 400, cursor: "pointer",
          }}
        >
          By Category
        </button>
        <button
          onClick={() => { setShowCriticalSummary(true); setShowAlignmentSummary(false); }}
          style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border)",
            background: showCriticalSummary ? "#e55" : "transparent",
            color: showCriticalSummary ? "#fff" : "var(--muted)",
            fontWeight: showCriticalSummary ? 600 : 400, cursor: "pointer",
          }}
        >
          Critical Questions ({criticalQuestions.length})
        </button>
        <button
          onClick={() => { setShowAlignmentSummary(true); setShowCriticalSummary(false); }}
          style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border)",
            background: showAlignmentSummary ? "#6B8F7B" : "transparent",
            color: showAlignmentSummary ? "#fff" : "var(--muted)",
            fontWeight: showAlignmentSummary ? 600 : 400, cursor: "pointer",
          }}
        >
          📊 Alignment Summary
        </button>
      </div>

      {showAlignmentSummary ? (
        renderAlignmentSummary()
      ) : showCriticalSummary ? (
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
            {categories.map((cat, ci) => {
              const catAlign = getCategoryAlignment(ci);
              return (
                <button key={ci} onClick={() => setActiveCategory(ci)} style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 12, border: "1px solid var(--border)",
                  background: ci === activeCategory ? "var(--gold)" : "transparent",
                  color: ci === activeCategory ? "var(--bg)" : "var(--muted)",
                  fontWeight: ci === activeCategory ? 600 : 400,
                }}>
                  {cat.name} {catAlign > 0 && <span style={{ color: getAlignmentColor(catAlign), fontWeight: 700, marginLeft: 4 }}>{Math.round(catAlign)}%</span>}
                </button>
              );
            })}
          </div>

          {/* Category alignment header */}
          {(() => {
            const catAlign = getCategoryAlignment(activeCategory);
            return catAlign > 0 ? (
              <div style={{
                background: `linear-gradient(135deg, ${getAlignmentColor(catAlign)}22, transparent)`,
                border: `1px solid ${getAlignmentColor(catAlign)}44`,
                borderRadius: 12, padding: "14px 20px", marginBottom: 24,
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{categories[activeCategory].name} — Category Alignment</p>
                <AlignmentBar percentage={catAlign} size="large" />
              </div>
            ) : null;
          })()}

          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {categories[activeCategory].questions.map((q, qi) => renderQuestion(activeCategory, qi, q, qi + 1))}
          </div>
        </>
      )}
    </div>
  );
}
