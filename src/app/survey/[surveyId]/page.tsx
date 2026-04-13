"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSurveyById, type SurveyQuestion } from "@/data/surveys";
import { supabase } from "@/lib/supabase";
import { migrateLocalStorage, getStorageKey } from "@/lib/migration";

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

  const toggleOption = (qId: string, option: string) => {
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

            return (
              <div key={q.id}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: q.context ? 6 : 12, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--gold)", marginRight: 8 }}>{displayIdx + 1}.</span>
                  {q.text}
                  {priorityBadge(q.priority)}
                  {hasOptions && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>(select all that apply)</span>}
                </label>
                {q.context && (
                  <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12, paddingLeft: 24, borderLeft: "2px solid var(--border)" }}>
                    {q.context}
                  </p>
                )}

                {hasOptions ? (
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
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOption(q.id, option)}
                            style={{ accentColor: "var(--gold)", flexShrink: 0 }}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                    {/* Other option */}
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
                    {otherSelected && (
                      <textarea
                        value={otherText}
                        onChange={e => setOtherText(q.id, e.target.value)}
                        placeholder="Please specify..."
                        rows={3}
                        style={{ marginLeft: 28 }}
                      />
                    )}
                  </div>
                ) : (
                  <textarea
                    value={typeof currentAnswer === "string" ? currentAnswer : ""}
                    onChange={e => save({ ...answers, [q.id]: e.target.value })}
                    placeholder="Type your answer..."
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
