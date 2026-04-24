"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSurveyById, type SurveyQuestion } from "@/data/surveys";
import { supabase } from "@/lib/supabase";
import { migrateLocalStorage, getStorageKey } from "@/lib/migration";

const LOGO_PREVIEWS: Record<string, JSX.Element> = {
  "01 The Meridian": (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="26" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="4 3"/>
        <line x1="28" y1="2" x2="28" y2="54" stroke="var(--gold)" strokeWidth="1"/>
        <line x1="2" y1="28" x2="54" y2="28" stroke="var(--gold)" strokeWidth="1"/>
        <polygon points="28,16 32,26 28,30 24,26" fill="var(--gold)"/>
      </svg>
      <span style={{ fontSize: 8, letterSpacing: 3, color: "var(--gold)", fontWeight: 600, fontFamily: "Georgia, serif" }}>MERIDIAN</span>
    </div>
  ),
  "02 M° The Monogram": (
    <div style={{ display: "flex", alignItems: "flex-start", lineHeight: 1 }}>
      <span style={{ fontSize: 54, fontWeight: 800, color: "var(--gold)", fontFamily: "Georgia, serif", lineHeight: 0.9 }}>M</span>
      <span style={{ fontSize: 22, fontWeight: 400, color: "var(--gold)", marginTop: 2 }}>°</span>
    </div>
  ),
  "03 The Coordinate": (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <line x1="8" y1="32" x2="56" y2="32" stroke="var(--gold)" strokeWidth="1.5"/>
      <line x1="32" y1="8" x2="32" y2="56" stroke="var(--gold)" strokeWidth="1.5"/>
      <circle cx="32" cy="32" r="14" stroke="var(--gold)" strokeWidth="1" strokeDasharray="3 2"/>
      <circle cx="32" cy="32" r="3.5" fill="var(--gold)"/>
      <line x1="32" y1="8" x2="36" y2="14" stroke="var(--gold)" strokeWidth="1.5"/>
      <line x1="32" y1="8" x2="28" y2="14" stroke="var(--gold)" strokeWidth="1.5"/>
    </svg>
  ),
  "04 The Seal": (
    <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
      <circle cx="34" cy="34" r="32" stroke="var(--gold)" strokeWidth="1.5"/>
      <circle cx="34" cy="34" r="26" stroke="var(--gold)" strokeWidth="0.75"/>
      <text x="34" y="42" textAnchor="middle" fill="var(--gold)" fontSize="28" fontWeight="700" fontFamily="Georgia, serif">M</text>
      <text x="34" y="57" textAnchor="middle" fill="var(--gold)" fontSize="5.5" letterSpacing="2.5" fontFamily="Georgia, serif">MERIDIAN</text>
    </svg>
  ),
  "05 The Wordmark": (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 6, color: "var(--gold)", fontFamily: "Georgia, serif" }}>MERIDIAN</span>
      <div style={{ width: 120, height: 1, background: "var(--gold)" }}/>
      <span style={{ fontSize: 7, letterSpacing: 4, color: "var(--muted)", fontFamily: "Georgia, serif" }}>COLLECTIVE</span>
    </div>
  ),
  "06 The Globe": (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="28" stroke="var(--gold)" strokeWidth="1.5"/>
      <ellipse cx="32" cy="32" rx="13" ry="28" stroke="var(--gold)" strokeWidth="0.75"/>
      <line x1="4" y1="32" x2="60" y2="32" stroke="var(--gold)" strokeWidth="0.75"/>
      <line x1="8" y1="20" x2="56" y2="20" stroke="var(--gold)" strokeWidth="0.5"/>
      <line x1="8" y1="44" x2="56" y2="44" stroke="var(--gold)" strokeWidth="0.5"/>
    </svg>
  ),
};

const PALETTE_COLORS: Record<string, string[]> = {
  "01 Obsidian & Brass":   ["#1C1C1C", "#2A2A2A", "#B5914C", "#D4AA6A", "#F0C880"],
  "02 Forest & Cognac":    ["#2D4A2D", "#3A5C3A", "#8B3A1A", "#A0522D", "#C4724A"],
  "03 Midnight & Oxblood": ["#0D1B2A", "#1B2F48", "#5C1010", "#7D2020", "#A03030"],
  "04 Bone & Terracotta":  ["#E8E0CC", "#F0EDE0", "#C4622D", "#D4714A", "#E08060"],
  "05 Graphite & Sage":    ["#3A3A3A", "#4A4A4A", "#6B8F71", "#7DA882", "#9DC0A2"],
  "06A Imperial Gold":     ["#1A1409", "#2D220F", "#B8922A", "#D4AF37", "#F0C040"],
  "06B Black & Burnished": ["#0D0D0D", "#1A1A1A", "#8C6239", "#A67C52", "#C49A6C"],
  "06C Navy & Gold":       ["#0A1628", "#1E3A6E", "#112244", "#C9A826", "#D4B944"],
};

function useDebouncedSaveToServer() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveToServer = useCallback((surveyId: string, member: string, answers: Record<string, string[] | string>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!supabase) return;
      try {
        await supabase.from("meridian_responses").delete().eq("member_name", member).eq("survey_id", surveyId);
        const rows = Object.entries(answers)
          .filter(([, v]) => {
            if (Array.isArray(v)) return v.length > 0;
            return typeof v === "string" && v.trim() !== "";
          })
          .map(([questionId, answer]) => ({
            member_name: member,
            question_id: questionId,
            survey_id: surveyId,
            answer: JSON.stringify(answer),
            updated_at: new Date().toISOString(),
          }));
        if (rows.length > 0) {
          await supabase.from("meridian_responses").insert(rows);
        }
      } catch (e) { console.error("Save to DB failed:", e); }
    }, 1000);
  }, []);
  return saveToServer;
}

const priorityBadge = (p: SurveyQuestion["priority"]) => {
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

const priorityOrder = { critical: 0, important: 1, recommended: 2 };

type PriorityFilter = "all" | "critical" | "important" | "recommended";

export default function SurveyPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.surveyId as string;
  const survey = getSurveyById(surveyId);

  const [user, setUser] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({});
  const [activeCategory, setActiveCategory] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const saveToServer = useDebouncedSaveToServer();

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    migrateLocalStorage(u);

    if (!survey) return;

    const storageKey = getStorageKey(surveyId, u);

    if (!supabase) {
      const saved = localStorage.getItem(storageKey);
      if (saved) setAnswers(JSON.parse(saved));
      return;
    }

    supabase
      .from("meridian_responses")
      .select("question_id, answer")
      .eq("member_name", u)
      .eq("survey_id", surveyId)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const serverAnswers: Record<string, string[] | string> = {};
          for (const row of data) {
            try { serverAnswers[row.question_id] = JSON.parse(row.answer); }
            catch { serverAnswers[row.question_id] = row.answer; }
          }
          setAnswers(serverAnswers);
          localStorage.setItem(storageKey, JSON.stringify(serverAnswers));
        } else {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            setAnswers(parsed);
            if (Object.keys(parsed).length > 0) {
              const rows = Object.entries(parsed)
                .filter(([, v]) => {
                  if (Array.isArray(v)) return (v as string[]).length > 0;
                  return typeof v === "string" && (v as string).trim() !== "";
                })
                .map(([qid, answer]) => ({
                  member_name: u,
                  question_id: qid,
                  survey_id: surveyId,
                  answer: JSON.stringify(answer),
                  updated_at: new Date().toISOString(),
                }));
              if (rows.length > 0) {
                supabase!.from("meridian_responses").insert(rows).then(() => {});
              }
            }
          }
        }
      });
  }, [router, surveyId, survey]);

  const save = useCallback((newAnswers: Record<string, string[] | string>) => {
    if (!user) return;
    setAnswers(newAnswers);
    localStorage.setItem(getStorageKey(surveyId, user), JSON.stringify(newAnswers));
    saveToServer(surveyId, user, newAnswers);
  }, [user, surveyId, saveToServer]);

  const isAnswered = (val: string[] | string | undefined): boolean => {
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return typeof val === "string" && val.trim() !== "";
  };

  if (!survey) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Survey not found</h1>
          <button onClick={() => router.push("/surveys")} style={{ color: "var(--gold)", background: "none", border: "none", cursor: "pointer" }}>
            Back to surveys
          </button>
        </div>
      </div>
    );
  }

  const categories = survey.categories;

  const getSelections = (qId: string): string[] => {
    const val = answers[qId];
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim()) return [val];
    return [];
  };

  const isOtherSelected = (qId: string) => getSelections(qId).some(s => s.startsWith("Other: "));
  const getOtherText = (qId: string) => {
    const other = getSelections(qId).find(s => s.startsWith("Other: "));
    return other ? other.slice(7) : "";
  };

  const toggleOption = (qId: string, option: string, singleSelect?: boolean) => {
    if (singleSelect) {
      const current = getSelections(qId);
      // If already selected, deselect; otherwise select only this one
      save({ ...answers, [qId]: current.includes(option) ? [] : [option] });
      return;
    }
    const current = getSelections(qId);
    const newSelections = current.includes(option)
      ? current.filter(s => s !== option)
      : [...current, option];
    save({ ...answers, [qId]: newSelections });
  };

  const toggleOther = (qId: string) => {
    const current = getSelections(qId);
    if (isOtherSelected(qId)) {
      save({ ...answers, [qId]: current.filter(s => !s.startsWith("Other: ")) });
    } else {
      save({ ...answers, [qId]: [...current, "Other: "] });
    }
  };

  const setOtherText = (qId: string, text: string) => {
    const current = getSelections(qId).filter(s => !s.startsWith("Other: "));
    save({ ...answers, [qId]: [...current, `Other: ${text}`] });
  };

  const shouldShow = (q: SurveyQuestion): boolean => {
    if (!q.showIf) return true;
    const depAnswer = getSelections(q.showIf.questionId);
    return depAnswer.some(a => a.includes(q.showIf!.includes));
  };

  const visibleInCategory = (ci: number) =>
    categories[ci].questions.filter(q => shouldShow(q));

  const answeredInCategory = (ci: number) =>
    visibleInCategory(ci).filter(q => isAnswered(answers[q.id])).length;

  const totalVisible = categories.reduce((s, c, ci) => s + visibleInCategory(ci).length, 0);
  const totalAnswered = categories.reduce((s, c, ci) => s + answeredInCategory(ci), 0);
  const overallPct = totalVisible > 0 ? Math.round((totalAnswered / totalVisible) * 100) : 0;

  const getSortedQuestions = (ci: number) => {
    const questions = visibleInCategory(ci);
    questions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return questions;
  };

  const getFilteredQuestions = (ci: number) => {
    const sorted = getSortedQuestions(ci);
    if (priorityFilter === "all") return sorted;
    return sorted.filter(q => q.priority === priorityFilter);
  };

  if (!user) return null;

  const filterButtons: { value: PriorityFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "critical", label: "Critical" },
    { value: "important", label: "Important" },
    { value: "recommended", label: "Recommended" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile header */}
      <div style={{
        display: "none", position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "12px 16px",
        alignItems: "center", justifyContent: "space-between",
      }} className="mobile-header">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          background: "none", border: "none", color: "var(--fg)", fontSize: 20
        }}>☰</button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{survey.title}</span>
        <span style={{ fontSize: 12, color: "var(--gold)" }}>{overallPct}%</span>
      </div>

      {/* Sidebar */}
      <aside style={{
        width: 280, minWidth: 280, background: "var(--surface)", borderRight: "1px solid var(--border)",
        padding: "76px 0 20px", overflowY: "auto", height: "100vh", position: "sticky", top: 0,
        ...(sidebarOpen ? { position: "fixed", zIndex: 40, left: 0, top: 0 } : {}),
      }} className="sidebar">
        <div style={{ padding: "0 20px 20px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>◆ {survey.title}</h2>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Logged in as <span style={{ color: "var(--gold)" }}>{user}</span></p>
        </div>

        {/* Overall progress */}
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            <span>Overall Progress</span>
            <span>{totalAnswered}/{totalVisible} ({overallPct}%)</span>
          </div>
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
            <div style={{ height: "100%", background: "var(--gold)", borderRadius: 2, width: `${overallPct}%`, transition: "width 0.3s" }} />
          </div>
        </div>

        <nav>
          {categories.map((cat, ci) => {
            const done = answeredInCategory(ci);
            const total = visibleInCategory(ci).length;
            const pct = Math.round((done / total) * 100);
            return (
              <button
                key={ci}
                onClick={() => { setActiveCategory(ci); setSidebarOpen(false); setPriorityFilter("all"); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 20px",
                  background: ci === activeCategory ? "var(--surface2)" : "transparent",
                  border: "none", borderLeft: ci === activeCategory ? "3px solid var(--gold)" : "3px solid transparent",
                  color: ci === activeCategory ? "var(--fg)" : "var(--muted)",
                  fontSize: 13, transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ flex: 1, marginRight: 8 }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: pct === 100 ? "#5a5" : "var(--muted)", whiteSpace: "nowrap" }}>
                    {done}/{total}
                  </span>
                </div>
                <div style={{ height: 2, background: "var(--border)", borderRadius: 1, marginTop: 4 }}>
                  <div style={{ height: "100%", background: pct === 100 ? "#5a5" : "var(--gold)", borderRadius: 1, width: `${pct}%`, transition: "width 0.3s" }} />
                </div>
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => router.push(`/results/${surveyId}`)}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--gold)", fontSize: 12, padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            View Results
          </button>
          <button onClick={() => router.push("/surveys")}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--gold)", fontSize: 12, padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            All Surveys
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 35
      }} />}

      {/* Main content */}
      <main style={{ flex: 1, padding: "80px 40px 80px", maxWidth: 800 }} className="main-content">
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: "var(--gold)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Category {activeCategory + 1} of {categories.length}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{categories[activeCategory].name}</h1>
          {categories[activeCategory].description && (
            <div style={{
              marginTop: 12, padding: "14px 18px", borderRadius: 8,
              background: "rgba(197,165,114,0.08)", border: "1px solid rgba(197,165,114,0.2)",
              fontSize: 13, lineHeight: 1.6, color: "var(--muted)",
            }}>
              {categories[activeCategory].description}
            </div>
          )}
        </div>

        {/* Priority filter buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          {filterButtons.map(fb => (
            <button
              key={fb.value}
              onClick={() => setPriorityFilter(fb.value)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, border: "1px solid var(--border)",
                background: priorityFilter === fb.value ? "var(--gold)" : "transparent",
                color: priorityFilter === fb.value ? "var(--bg)" : "var(--muted)",
                fontWeight: priorityFilter === fb.value ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {fb.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {getFilteredQuestions(activeCategory).map((q, displayIdx) => {
            const currentAnswer = answers[q.id];
            const selections = getSelections(q.id);
            const hasOptions = q.options && q.options.length > 0;
            const otherSelected = isOtherSelected(q.id);
            const otherText = getOtherText(q.id);

            // Resolve {value} references in question text
            let questionText = q.text;
            if (q.referenceQuestionId) {
              const refVal = answers[q.referenceQuestionId];
              const displayVal = typeof refVal === "string" && refVal.trim() ? refVal : (Array.isArray(refVal) && refVal.length > 0 ? refVal[0] : "your amount");
              questionText = questionText.replace("{value}", displayVal);
            }

            return (
              <div key={q.id}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: q.context ? 6 : 12, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--gold)", marginRight: 8 }}>{displayIdx + 1}.</span>
                  {questionText}
                  {priorityBadge(q.priority)}
                  {hasOptions && !q.singleSelect && !q.ranked && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>(select all that apply)</span>}
                {q.ranked && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>(rank in order — click to add)</span>}
                </label>
                {q.context && (
                  <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12, paddingLeft: 24, borderLeft: "2px solid var(--border)" }}>
                    {q.context}
                  </p>
                )}

                {hasOptions && q.ranked ? (
                  <div>
                    {q.id === "brand-logo-rank" || q.id === "brand-palette-rank" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {q.options!.map((option, oi) => {
                          const rank = selections.indexOf(option);
                          const ranked = rank !== -1;
                          return (
                            <button
                              key={oi}
                              type="button"
                              onClick={() => {
                                if (ranked) {
                                  save({ ...answers, [q.id]: selections.filter(o => o !== option) });
                                } else {
                                  save({ ...answers, [q.id]: [...selections, option] });
                                }
                              }}
                              style={{
                                position: "relative", cursor: "pointer",
                                background: ranked ? "rgba(197,165,114,0.08)" : "var(--surface)",
                                border: ranked ? "2px solid var(--gold)" : "1px solid var(--border)",
                                borderRadius: 10, padding: 0, overflow: "hidden",
                                transition: "all 0.15s", color: "var(--fg)", textAlign: "left",
                              }}
                            >
                              {q.id === "brand-logo-rank" ? (
                                <div style={{
                                  height: 130, display: "flex", alignItems: "center", justifyContent: "center",
                                  background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)",
                                }}>
                                  {LOGO_PREVIEWS[option] ?? <span style={{ fontSize: 11, color: "var(--muted)" }}>Preview</span>}
                                </div>
                              ) : (
                                <div style={{ display: "flex", height: 64 }}>
                                  {(PALETTE_COLORS[option] ?? []).map((color, ci) => (
                                    <div key={ci} style={{ flex: 1, background: color }} />
                                  ))}
                                </div>
                              )}
                              <div style={{ padding: "10px 12px 12px" }}>
                                <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, display: "block" }}>{option}</span>
                                {q.id === "brand-logo-rank" && (
                                  <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 0.5 }}>placeholder — replace with final art</span>
                                )}
                              </div>
                              <div style={{
                                position: "absolute", top: 8, right: 8,
                                width: 28, height: 28, borderRadius: "50%",
                                background: ranked ? "var(--gold)" : "rgba(255,255,255,0.15)",
                                color: ranked ? "var(--bg)" : "var(--muted)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: ranked ? 13 : 10, fontWeight: 700,
                                transition: "all 0.15s",
                              }}>
                                {ranked ? rank + 1 : "·"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {q.options!.map((option, oi) => {
                          const rank = selections.indexOf(option);
                          const ranked = rank !== -1;
                          return (
                            <button
                              key={oi}
                              type="button"
                              onClick={() => {
                                if (ranked) {
                                  save({ ...answers, [q.id]: selections.filter(o => o !== option) });
                                } else {
                                  save({ ...answers, [q.id]: [...selections, option] });
                                }
                              }}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 14px", borderRadius: 8, textAlign: "left",
                                background: ranked ? "var(--surface2)" : "var(--surface)",
                                border: ranked ? "1px solid var(--gold)" : "1px solid var(--border)",
                                cursor: "pointer", fontSize: 13, lineHeight: 1.5,
                                transition: "all 0.15s", color: "var(--fg)", width: "100%",
                              }}
                            >
                              <span style={{
                                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: ranked ? "var(--gold)" : "var(--border)",
                                color: ranked ? "var(--bg)" : "var(--muted)",
                                fontSize: 11, fontWeight: 700,
                              }}>
                                {ranked ? rank + 1 : "·"}
                              </span>
                              <span>{option}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selections.length > 0 && (
                      <button
                        type="button"
                        onClick={() => save({ ...answers, [q.id]: [] })}
                        style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0", marginTop: 8 }}
                      >
                        Clear ranking
                      </button>
                    )}
                  </div>
                ) : hasOptions ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {q.options!.map((option, oi) => {
                      const checked = selections.includes(option);
                      return (
                        <label
                          key={oi}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", borderRadius: 8,
                            background: checked ? "var(--surface2)" : "var(--surface)",
                            border: checked ? "1px solid var(--gold)" : "1px solid var(--border)",
                            cursor: "pointer", fontSize: 13, lineHeight: 1.5,
                            transition: "all 0.15s",
                          }}
                        >
                          <input
                            type={q.singleSelect ? "radio" : "checkbox"}
                            name={q.singleSelect ? q.id : undefined}
                            checked={checked}
                            onChange={() => toggleOption(q.id, option, q.singleSelect)}
                            style={{ accentColor: "var(--gold)", flexShrink: 0 }}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                    {/* Other option — hide for single select */}
                    {!q.singleSelect && (
                    <label
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px", borderRadius: 8,
                        background: otherSelected ? "var(--surface2)" : "var(--surface)",
                        border: otherSelected ? "1px solid var(--gold)" : "1px solid var(--border)",
                        cursor: "pointer", fontSize: 13, lineHeight: 1.5,
                        transition: "all 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={otherSelected}
                        onChange={() => toggleOther(q.id)}
                        style={{ accentColor: "var(--gold)", flexShrink: 0 }}
                      />
                      <span>Other</span>
                    </label>
                    )}
                    {otherSelected && !q.singleSelect && (
                      <textarea
                        value={otherText}
                        onChange={e => setOtherText(q.id, e.target.value)}
                        placeholder="Please specify..."
                        rows={3}
                        style={{ marginLeft: 28 }}
                      />
                    )}
                  </div>
                ) : q.inputType === "currency" ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={typeof currentAnswer === "string" ? currentAnswer : ""}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      if (raw === "") { save({ ...answers, [q.id]: "" }); return; }
                      const num = parseInt(raw, 10);
                      const formatted = "$" + num.toLocaleString("en-US");
                      save({ ...answers, [q.id]: formatted });
                    }}
                    placeholder={q.placeholder || "$0"}
                    style={{
                      background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)",
                      borderRadius: 8, padding: "12px 16px", fontSize: 18, fontWeight: 600, width: "100%",
                    }}
                  />
                ) : (
                  <textarea
                    value={typeof currentAnswer === "string" ? currentAnswer : ""}
                    onChange={e => save({ ...answers, [q.id]: e.target.value })}
                    placeholder={q.placeholder || "Type your answer..."}
                    rows={3}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Nav buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, gap: 16 }}>
          <button
            onClick={() => { setActiveCategory(Math.max(0, activeCategory - 1)); setPriorityFilter("all"); window.scrollTo(0, 0); }}
            disabled={activeCategory === 0}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: activeCategory === 0 ? "var(--border)" : "var(--fg)",
              fontSize: 14,
            }}
          >
            ← Previous
          </button>
          {activeCategory === categories.length - 1 ? (
            <button
              onClick={async () => {
                if (!user) return;
                if (supabase) {
                  try {
                    await supabase.from("meridian_responses").delete().eq("member_name", user).eq("survey_id", surveyId);
                    const rows = Object.entries(answers)
                      .filter(([, v]) => {
                        if (Array.isArray(v)) return v.length > 0;
                        return typeof v === "string" && v.trim() !== "";
                      })
                      .map(([questionId, answer]) => ({
                        member_name: user,
                        question_id: questionId,
                        survey_id: surveyId,
                        answer: JSON.stringify(answer),
                        updated_at: new Date().toISOString(),
                      }));
                    if (rows.length > 0) {
                      await supabase.from("meridian_responses").insert(rows);
                    }
                  } catch (e) { console.error("Final save failed:", e); }
                }
                router.push(`/results/${surveyId}`);
              }}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "var(--gold)", color: "var(--bg)", fontSize: 14, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Submit
            </button>
          ) : (
            <button
              onClick={() => { setActiveCategory(Math.min(categories.length - 1, activeCategory + 1)); setPriorityFilter("all"); window.scrollTo(0, 0); }}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "var(--gold)", color: "var(--bg)", fontSize: 14, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Next →
            </button>
          )}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          .sidebar { display: ${sidebarOpen ? "block" : "none"}; width: 280px; }
          .main-content { padding: 80px 16px 40px !important; }
        }
      `}</style>
    </div>
  );
}
