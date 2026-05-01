"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { getSurveyById, type SurveyQuestion } from "@/data/surveys";
import { supabase } from "@/lib/supabase";
import { insights } from "@/data/insights";
import { snapshotWithVersion } from "@/lib/question-snapshot";

function formatRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "Never logged in";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const priorityBadge = (p: SurveyQuestion["priority"]) => {
  const config = {
    critical: { label: "Critical", color: "var(--obsidian)" },
    important: { label: "Important", color: "var(--gold-dim)" },
    recommended: { label: "Recommended", color: "var(--gold)" },
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
  if (pct >= 80) return "var(--gold)";
  if (pct >= 50) return "var(--gold)";
  return "var(--gold-dim)";
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
    <div style={{
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      width: "100%", maxWidth: size === "large" ? 480 : 360,
    }}>
      <div style={{ flex: "1 1 140px", minWidth: 120, background: "var(--surface2)", borderRadius: h / 2, height: h, overflow: "hidden" }}>
        <div style={{ width: `${percentage}%`, height: "100%", background: color, borderRadius: h / 2, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: size === "large" ? 20 : 14, fontWeight: 700, color, minWidth: 44, textAlign: "right" }}>{Math.round(percentage)}%</span>
      <span style={{ fontSize: 11, color, fontWeight: 500, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.surveyId as string;
  const survey = getSurveyById(surveyId);

  const [user, setUser] = useState<string | null>(null);
  const [allAnswers, setAllAnswers] = useState<Record<string, Record<string, string[] | string>>>({});
  // Per-question, the set of snapshot_versions members saved with. If any
  // member's hash != the current question's hash, the question text changed
  // since they answered.
  const [savedVersions, setSavedVersions] = useState<Record<string, Set<string>>>({});
  const [memberLogins, setMemberLogins] = useState<Record<string, string | null>>({});
  const [activeCategory, setActiveCategory] = useState(0);
  const [showCriticalSummary, setShowCriticalSummary] = useState(false);
  const [showAlignmentSummary, setShowAlignmentSummary] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);

    if (!supabase) return;

    supabase
      .from("meridian_responses")
      .select("member_name, question_id, answer, snapshot_version")
      .eq("survey_id", surveyId)
      .then(({ data: rows }) => {
        const data: Record<string, Record<string, string[] | string>> = {};
        const versions: Record<string, Set<string>> = {};
        for (const row of rows || []) {
          if (!data[row.member_name]) data[row.member_name] = {};
          try { data[row.member_name][row.question_id] = JSON.parse(row.answer); }
          catch { data[row.member_name][row.question_id] = row.answer; }
          if (row.snapshot_version) {
            (versions[row.question_id] ??= new Set()).add(row.snapshot_version);
          }
        }
        setAllAnswers(data);
        setSavedVersions(versions);
      });

    supabase
      .from("meridian_members")
      .select("name, last_login")
      .then(({ data: members }) => {
        const logins: Record<string, string | null> = {};
        for (const m of members || []) logins[m.name] = m.last_login;
        setMemberLogins(logins);
      });
  }, [router, surveyId]);

  if (!user || !survey) {
    if (!survey) return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Survey not found</h1>
          <button onClick={() => router.push("/surveys")} style={{ color: "var(--gold)", background: "none", border: "none", cursor: "pointer" }}>Back to surveys</button>
        </div>
      </div>
    );
    return null;
  }

  const categories = survey.categories;
  const membersWithData = MEMBERS.filter(m => allAnswers[m]);

  // Currency helpers
  const parseCurrency = (val: string | string[] | undefined): number => {
    if (!val) return 0;
    const str = typeof val === "string" ? val : Array.isArray(val) ? val[0] : "";
    if (!str) return 0;
    // Match the first dollar amount in the string — handles both formatted values
    // like "$10,000" and old range-style option answers like "$5,000 - $10,000"
    // (takes the lower bound of a range rather than concatenating all digits)
    const match = str.match(/\$?([\d,]+)/);
    if (!match) return 0;
    const num = parseInt(match[1].replace(/,/g, ""), 10);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (num: number): string =>
    "$" + num.toLocaleString("en-US");

  // Resolve {value} placeholders in question text for display (results page has no per-member context)
  const resolveLabel = (text: string, maxLen: number): string => {
    const resolved = text.replace(/\{value\}/g, "your amount");
    return resolved.length > maxLen ? resolved.slice(0, maxLen) + "..." : resolved;
  };

  // Find all currency questions in this survey
  const currencyQuestions = categories.flatMap(c =>
    c.questions.filter(q => q.inputType === "currency")
  );

  // Compute per-member and group totals for currency questions
  const getCurrencyTotals = (qId: string) => {
    const perMember: { name: string; amount: number }[] = [];
    let total = 0;
    MEMBERS.forEach(m => {
      const amount = parseCurrency(allAnswers[m]?.[qId]);
      if (allAnswers[m]?.[qId]) perMember.push({ name: m, amount });
      total += amount;
    });
    return { perMember, total };
  };

  const parseSelections = (val: string[] | string | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim()) return [val];
    return [];
  };

  const getOptionTally = (qId: string) => {
    const allSelections: string[][] = [];
    MEMBERS.forEach(m => {
      const sel = parseSelections(allAnswers[m]?.[qId]);
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

  const getAlignment = (qId: string): AlignmentInfo | null => {
    const tally = getOptionTally(qId);
    if (!tally || tally.total === 0) return null;
    const sorted = Object.entries(tally.counts).sort((a, b) => b[1] - a[1]);
    const topOption = sorted[0][0];
    const topCount = sorted[0][1];
    const percentage = (topCount / tally.total) * 100;
    const breakdown = sorted.map(([option, count]) => ({ option, count }));
    return { percentage, topOption, topCount, total: tally.total, breakdown };
  };

  const allAlignments: { qId: string; q: SurveyQuestion; catName: string; alignment: AlignmentInfo }[] = [];
  categories.forEach(cat => {
    cat.questions.forEach(q => {
      const a = getAlignment(q.id);
      if (a) allAlignments.push({ qId: q.id, q, catName: cat.name, alignment: a });
    });
  });

  const overallAlignment = allAlignments.length > 0
    ? allAlignments.reduce((sum, a) => sum + a.alignment.percentage, 0) / allAlignments.length
    : 0;

  const unanimousItems = allAlignments.filter(a => a.alignment.percentage === 100);
  const disagreementItems = [...allAlignments].filter(a => a.alignment.percentage < 100).sort((a, b) => a.alignment.percentage - b.alignment.percentage);
  const hasEnoughData = membersWithData.length >= 2;

  const getCategoryAlignment = (ci: number): number => {
    const catQuestionIds = new Set(categories[ci].questions.map(q => q.id));
    const catAlignments = allAlignments.filter(a => catQuestionIds.has(a.qId));
    if (catAlignments.length === 0) return 0;
    return catAlignments.reduce((sum, a) => sum + a.alignment.percentage, 0) / catAlignments.length;
  };

  const criticalQuestions: { catName: string; q: SurveyQuestion }[] = [];
  categories.forEach(cat => {
    cat.questions.forEach(q => {
      if (q.priority === "critical") criticalQuestions.push({ catName: cat.name, q });
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

  const renderInsight = (qId: string) => {
    const insight = insights[qId];
    if (!insight) return null;

    const consensusColors: Record<string, string> = {
      strong: "var(--gold)",
      partial: "var(--gold)",
      disagreement: "var(--gold-dim)",
      open: "var(--muted)",
    };
    const color = consensusColors[insight.consensus] || "var(--muted)";

    return (
      <div style={{
        marginTop: 16,
        background: "linear-gradient(135deg, rgba(201,168,120,0.06), rgba(142,107,63,0.06))",
        border: "1px solid rgba(201,168,120,0.2)",
        borderRadius: 10,
        padding: "16px 20px",
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        <p style={{ fontWeight: 600, color: "var(--gold)", marginBottom: 12, fontSize: 14 }}>AI Insight</p>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: "var(--gold-dim)" }}>Consensus: </span>
          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 10, background: `${color}22`, color, fontSize: 12, fontWeight: 600 }}>{insight.consensusLabel}</span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: "var(--gold-dim)" }}>Recommendation: </span>
          <span style={{ color: "var(--fg)" }}>{insight.rec}</span>
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: "var(--gold-dim)" }}>Why it matters: </span>
          <span style={{ color: "var(--fg)" }}>{insight.why}</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontWeight: 600, color: "var(--gold-dim)" }}>Watch out: </span>
          <span style={{ color: "var(--fg)" }}>{insight.watch}</span>
        </div>
        <div style={{
          padding: "8px 12px", background: "rgba(20,17,13,0.15)", borderRadius: 6,
          borderLeft: "3px solid #6366f1", fontStyle: "italic", color: "var(--muted)", fontSize: 12,
        }}>
          Suggested OA language: &ldquo;{insight.lang}&rdquo;
        </div>
      </div>
    );
  };

  const renderQuestion = (q: SurveyQuestion, displayNum: number, showCategory?: string) => {
    const tally = getOptionTally(q.id);
    const alignment = getAlignment(q.id);
    // Detect version drift: any saved snapshot whose hash differs from the
    // current question definition's hash means the question text/options
    // changed after that member answered.
    const currentVersion = snapshotWithVersion(q).snapshot_version;
    const saved = savedVersions[q.id];
    const hasDrift = saved ? Array.from(saved).some(v => v !== currentVersion) : false;
    return (
      <div key={q.id} className="results-card" style={{ background: "var(--surface)", borderRadius: 12, padding: 24 }}>
        {showCategory && (
          <p style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{showCategory}</p>
        )}
        <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ color: "var(--gold)" }}>{displayNum}.</span> {q.text}
          {priorityBadge(q.priority)}
          {hasDrift && (
            <span
              title="The question text or options were edited after some members answered. Their saved snapshot preserves what they actually saw."
              style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                color: "var(--gold-dim)", background: "rgba(142,107,63,0.10)", border: "1px solid rgba(142,107,63,0.3)",
                whiteSpace: "nowrap",
              }}
            >
              REVISED SINCE SAVE
            </span>
          )}
        </p>

        {alignment && (
          <div style={{ marginBottom: 16 }}>
            <AlignmentBar percentage={alignment.percentage} />
            {renderAlignmentBreakdown(alignment)}
          </div>
        )}

        {tally && tally.sharedOptions.length > 0 && (
          <div style={{
            background: "rgba(201,168,120,0.12)", border: "1px solid rgba(201,168,120,0.25)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12,
          }}>
            {tally.sharedOptions.map(([opt, count]) => {
              const isFull = count === tally.total;
              return (
                <div key={opt} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: isFull ? "var(--gold)" : "var(--gold)" }}>
                    {count}/{tally.total} selected
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
              const raw = allAnswers[m]?.[q.id];
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
        {renderInsight(q.id)}
      </div>
    );
  };

  const renderAlignmentSummary = () => {
    const totalQ = categories.reduce((s, c) => s + c.questions.length, 0);
    const responseTracker = (
      <div className="results-card" style={{ background: "var(--surface)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Response Tracker</h3>
        <div className="response-tracker-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {MEMBERS.map(m => {
            const hasResponded = !!allAnswers[m];
            const answerCount = hasResponded ? Object.keys(allAnswers[m]).length : 0;
            const lastLogin = memberLogins[m];
            return (
              <div key={m} className="response-tracker-card" style={{
                padding: "14px 16px", borderRadius: 8, minHeight: 88, overflowWrap: "anywhere",
                background: hasResponded ? "rgba(201,168,120,0.12)" : "var(--surface2)",
                border: `1px solid ${hasResponded ? "rgba(201,168,120,0.3)" : "var(--border)"}`,
              }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2, lineHeight: 1.5 }}>
                  {hasResponded ? `${answerCount}/${totalQ} questions answered` : "Hasn't started yet"}
                </p>
                <p style={{ fontSize: 11, color: lastLogin ? "var(--muted)" : "#666", lineHeight: 1.5 }}>
                  Last active: <span style={{ color: lastLogin ? "var(--fg)" : "var(--muted)" }}>{formatRelativeTime(lastLogin)}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );

    if (!hasEnoughData) return (
      <div>
        {responseTracker}
        <div className="results-card" style={{ background: "var(--surface)", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Waiting for More Responses</p>
          <p style={{ color: "var(--muted)", fontSize: 13, maxWidth: 400, margin: "0 auto" }}>
            Alignment scores require at least 2 members to compare. {membersWithData.length === 1 ? `Only ${membersWithData[0]} has responded so far.` : "No one has responded yet."}
          </p>
        </div>
      </div>
    );

    return (
      <div>
        {responseTracker}
        <div className="results-card" style={{ background: "var(--surface)", borderRadius: 8, padding: 32, marginBottom: 32, border: "1px solid var(--fog)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 400, letterSpacing: "-0.015em", lineHeight: 1.1, marginBottom: 24, color: "var(--ink)" }}>Alignment Summary</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
            <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "20px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 36, fontWeight: 800, color: getAlignmentColor(overallAlignment) }}>{Math.round(overallAlignment)}%</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Overall Alignment</p>
              <p style={{ fontSize: 11, color: getAlignmentColor(overallAlignment), fontWeight: 600 }}>{getAlignmentLabel(overallAlignment)}</p>
            </div>
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "20px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 32, fontWeight: 800, color: "var(--gold)" }}>{unanimousItems.length}</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Unanimous Agreement</p>
            </div>
            <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "20px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 32, fontWeight: 800, color: disagreementItems.length > 0 ? "var(--gold)" : "var(--gold)" }}>{disagreementItems.length}</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Need Discussion</p>
            </div>
          </div>

          {disagreementItems.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--gold)" }}>Where You Differ -- Discuss These</h3>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Members chose different answers on these questions. These need a conversation.</p>
              {disagreementItems.map((a, i) => (
                <div key={i} style={{ marginBottom: 12, padding: "14px 16px", background: "var(--surface2)", borderRadius: 8, borderLeft: "3px solid var(--gold)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 13, lineHeight: 1.5, flex: "1 1 200px", minWidth: 0, fontWeight: 500, wordBreak: "break-word" }}>{a.q.text}</p>
                    <span style={{ fontSize: 14, fontWeight: 700, color: getAlignmentColor(a.alignment.percentage), whiteSpace: "nowrap" }}>{Math.round(a.alignment.percentage)}%</span>
                  </div>
                  <p style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{a.catName}</p>
                  {a.alignment.breakdown.map(({ option, count }) => (
                    <div key={option} style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, color: count === a.alignment.total ? "var(--gold)" : "var(--fg)" }}>{count}/{a.alignment.total}</span> -- {option}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {unanimousItems.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--gold)" }}>Where You All Agree ({unanimousItems.length})</h3>
              {unanimousItems.map((a, i) => (
                <div key={i} style={{ marginBottom: 8, padding: "10px 14px", background: "var(--surface2)", borderRadius: 8, borderLeft: "3px solid #6B8F7B" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 12, lineHeight: 1.4, flex: "1 1 200px", minWidth: 0, wordBreak: "break-word" }}>{a.q.text.length > 90 ? a.q.text.slice(0, 90) + "..." : a.q.text}</p>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)", whiteSpace: "nowrap" }}>Unanimous</span>
                  </div>
                  <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{a.catName} -- {a.alignment.topOption.length > 60 ? a.alignment.topOption.slice(0, 60) + "..." : a.alignment.topOption}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="results-page" style={{ padding: "72px 20px 80px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36, gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, color: "var(--brass)", textTransform: "uppercase", letterSpacing: "0.22em", marginBottom: 10 }}>{survey.title}</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.05, color: "var(--ink)", marginBottom: 8 }}>Survey Results</h1>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>{membersWithData.length} of {MEMBERS.length} members have responded</p>
        </div>
        <button onClick={() => router.push(`/survey/${surveyId}`)} style={{
          padding: "12px 20px", minHeight: 44, borderRadius: 4, border: "1px solid var(--ink)",
          background: "transparent", color: "var(--ink)",
          fontSize: 11, fontFamily: "var(--font-body)", fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase",
          cursor: "pointer", flexShrink: 0,
        }}>
          Take Survey
        </button>
      </div>

      {hasEnoughData && allAlignments.length > 0 && (
        <div style={{
          background: `linear-gradient(135deg, ${getAlignmentColor(overallAlignment)}22, transparent)`,
          border: `1px solid ${getAlignmentColor(overallAlignment)}44`,
          borderRadius: 12, padding: "16px 20px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Total Group Alignment</p>
            <AlignmentBar percentage={overallAlignment} size="large" />
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>{allAlignments.length} questions answered</p>
        </div>
      )}

      {/* Capital Summary for currency questions */}
      {currencyQuestions.length > 0 && membersWithData.length > 0 && (
        <div className="capital-summary" style={{
          background: "var(--surface)", borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Capital Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            {currencyQuestions.map(q => {
              const totals = getCurrencyTotals(q.id);
              return (
                <div key={q.id} style={{
                  background: "var(--surface2)", borderRadius: 10, padding: "16px 20px", textAlign: "center",
                }}>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "var(--gold)" }}>{formatCurrency(totals.total)}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                    {resolveLabel(q.text, 50)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Per-member breakdown table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--muted)", fontWeight: 500 }}>Member</th>
                  {currencyQuestions.map(q => (
                    <th key={q.id} style={{ textAlign: "right", padding: "8px 12px", color: "var(--muted)", fontWeight: 500, maxWidth: 140 }}>
                      {resolveLabel(q.text, 30)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEMBERS.map(m => {
                  if (!allAnswers[m]) return null;
                  return (
                    <tr key={m} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--gold)" }}>{m}</td>
                      {currencyQuestions.map(q => {
                        const amount = parseCurrency(allAnswers[m]?.[q.id]);
                        return (
                          <td key={q.id} style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>
                            {allAnswers[m]?.[q.id] ? formatCurrency(amount) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "2px solid var(--gold)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>TOTAL</td>
                  {currencyQuestions.map(q => {
                    const totals = getCurrencyTotals(q.id);
                    return (
                      <td key={q.id} style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "var(--gold)", fontSize: 14 }}>
                        {formatCurrency(totals.total)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { active: !showCriticalSummary && !showAlignmentSummary, label: "By Category", onClick: () => { setShowCriticalSummary(false); setShowAlignmentSummary(false); } },
          { active: showCriticalSummary, label: `Critical (${criticalQuestions.length})`, onClick: () => { setShowCriticalSummary(true); setShowAlignmentSummary(false); } },
          { active: showAlignmentSummary, label: "Alignment Summary", onClick: () => { setShowAlignmentSummary(true); setShowCriticalSummary(false); } },
        ].map((tab, i) => (
          <button
            key={i}
            onClick={tab.onClick}
            style={{
              padding: "12px 18px", minHeight: 44, borderRadius: 4,
              fontSize: 11, fontFamily: "var(--font-body)", fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase",
              border: tab.active ? "1px solid var(--brass)" : "1px solid var(--fog)",
              background: tab.active ? "var(--brass)" : "transparent",
              color: tab.active ? "var(--obsidian)" : "var(--muted)",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showAlignmentSummary ? (
        renderAlignmentSummary()
      ) : showCriticalSummary ? (
        <>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
            These {criticalQuestions.length} critical questions need answers from everyone.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {criticalQuestions.map((cq, idx) => renderQuestion(cq.q, idx + 1, cq.catName))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
            {categories.map((cat, ci) => {
              const catAlign = getCategoryAlignment(ci);
              return (
                <button key={ci} onClick={() => setActiveCategory(ci)} style={{
                  padding: "10px 16px", minHeight: 40, borderRadius: 20, fontSize: 13, border: "1px solid var(--border)",
                  background: ci === activeCategory ? "var(--gold)" : "transparent",
                  color: ci === activeCategory ? "var(--bg)" : "var(--muted)",
                  fontWeight: ci === activeCategory ? 600 : 400, cursor: "pointer",
                }}>
                  {cat.name} {catAlign > 0 && <span style={{ color: getAlignmentColor(catAlign), fontWeight: 700, marginLeft: 4 }}>{Math.round(catAlign)}%</span>}
                </button>
              );
            })}
          </div>

          {(() => {
            const catAlign = getCategoryAlignment(activeCategory);
            return catAlign > 0 ? (
              <div style={{
                background: `linear-gradient(135deg, ${getAlignmentColor(catAlign)}22, transparent)`,
                border: `1px solid ${getAlignmentColor(catAlign)}44`,
                borderRadius: 12, padding: "14px 20px", marginBottom: 24,
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{categories[activeCategory].name} -- Category Alignment</p>
                <AlignmentBar percentage={catAlign} size="large" />
              </div>
            ) : null;
          })()}

          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {categories[activeCategory].questions.map((q, qi) => renderQuestion(q, qi + 1))}
          </div>
        </>
      )}
      <style>{`
        @media (max-width: 960px) {
          .response-tracker-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .results-page { padding: 72px 16px 80px !important; }
          .results-card { padding: 16px !important; }
          .capital-summary { padding: 16px !important; }
        }
        @media (max-width: 600px) {
          .response-tracker-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .response-tracker-card { padding: 14px !important; }
        }
        @media (max-width: 480px) {
          .results-page { padding: 68px 12px 72px !important; }
        }
      `}</style>
    </div>
  );
}
