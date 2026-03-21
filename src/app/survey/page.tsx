"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { categories, Question } from "@/data/questions";

const totalQuestions = categories.reduce((s, c) => s + c.questions.length, 0);

function getStorageKey(user: string) { return `meridian_answers_${user}`; }

// Debounced save to server
function useDebouncedSaveToServer() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveToServer = useCallback((member: string, answers: Record<string, string[] | string>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member, answers }),
      }).catch(console.error);
    }, 1000); // 1s debounce
  }, []);
  return saveToServer;
}

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

const priorityOrder = { critical: 0, important: 1, recommended: 2 };

type PriorityFilter = "all" | "critical" | "important" | "recommended";

export default function SurveyPage() {
  const router = useRouter();
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

    // Load from server first, fallback to localStorage
    fetch(`/api/responses?member=${encodeURIComponent(u)}`)
      .then(r => r.json())
      .then(serverAnswers => {
        if (serverAnswers && Object.keys(serverAnswers).length > 0) {
          setAnswers(serverAnswers);
          // Also update localStorage as cache
          localStorage.setItem(getStorageKey(u), JSON.stringify(serverAnswers));
        } else {
          // No server data — check localStorage (may have unsaved responses)
          const saved = localStorage.getItem(getStorageKey(u));
          if (saved) {
            const parsed = JSON.parse(saved);
            setAnswers(parsed);
            // Push localStorage data to server (migration)
            if (Object.keys(parsed).length > 0) {
              fetch("/api/responses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ member: u, answers: parsed }),
              }).catch(console.error);
            }
          }
        }
      })
      .catch(() => {
        // Server unreachable — fall back to localStorage
        const saved = localStorage.getItem(getStorageKey(u));
        if (saved) setAnswers(JSON.parse(saved));
      });
  }, [router]);

  const save = useCallback((newAnswers: Record<string, string[] | string>) => {
    if (!user) return;
    setAnswers(newAnswers);
    localStorage.setItem(getStorageKey(user), JSON.stringify(newAnswers));
    saveToServer(user, newAnswers);
  }, [user, saveToServer]);

  const qKey = (ci: number, qi: number) => `${ci}-${qi}`;

  const isAnswered = (val: string[] | string | undefined): boolean => {
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return typeof val === "string" && val.trim() !== "";
  };

  const answeredInCategory = (ci: number) =>
    categories[ci].questions.filter((_, qi) => isAnswered(answers[qKey(ci, qi)])).length;

  const totalAnswered = Object.values(answers).filter(v => isAnswered(v)).length;
  const overallPct = Math.round((totalAnswered / totalQuestions) * 100);

  const getSelections = (ci: number, qi: number): string[] => {
    const val = answers[qKey(ci, qi)];
    if (Array.isArray(val)) return val;
    // migrate legacy string answers
    if (typeof val === "string" && val.trim()) return [val];
    return [];
  };

  const isOtherSelected = (ci: number, qi: number) => {
    return getSelections(ci, qi).some(s => s.startsWith("Other: "));
  };

  const getOtherText = (ci: number, qi: number) => {
    const other = getSelections(ci, qi).find(s => s.startsWith("Other: "));
    return other ? other.slice(7) : "";
  };

  const toggleOption = (ci: number, qi: number, option: string) => {
    const key = qKey(ci, qi);
    const current = getSelections(ci, qi);
    const newSelections = current.includes(option)
      ? current.filter(s => s !== option)
      : [...current, option];
    save({ ...answers, [key]: newSelections });
  };

  const toggleOther = (ci: number, qi: number) => {
    const key = qKey(ci, qi);
    const current = getSelections(ci, qi);
    if (isOtherSelected(ci, qi)) {
      save({ ...answers, [key]: current.filter(s => !s.startsWith("Other: ")) });
    } else {
      save({ ...answers, [key]: [...current, "Other: "] });
    }
  };

  const setOtherText = (ci: number, qi: number, text: string) => {
    const key = qKey(ci, qi);
    const current = getSelections(ci, qi).filter(s => !s.startsWith("Other: "));
    save({ ...answers, [key]: [...current, `Other: ${text}`] });
  };

  // Sort questions: critical first, then important, then recommended
  const getSortedQuestions = (ci: number) => {
    const questions = categories[ci].questions.map((q, qi) => ({ q, originalIndex: qi }));
    questions.sort((a, b) => priorityOrder[a.q.priority] - priorityOrder[b.q.priority]);
    return questions;
  };

  const getFilteredQuestions = (ci: number) => {
    const sorted = getSortedQuestions(ci);
    if (priorityFilter === "all") return sorted;
    return sorted.filter(({ q }) => q.priority === priorityFilter);
  };

  if (!user) return null;

  const filterButtons: { value: PriorityFilter; label: string; emoji: string }[] = [
    { value: "all", label: "All", emoji: "" },
    { value: "critical", label: "Critical", emoji: "" },
    { value: "important", label: "Important", emoji: "" },
    { value: "recommended", label: "Recommended", emoji: "" },
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>Meridian Survey</span>
        <span style={{ fontSize: 12, color: "var(--gold)" }}>{overallPct}%</span>
      </div>

      {/* Sidebar */}
      <aside style={{
        width: 280, minWidth: 280, background: "var(--surface)", borderRight: "1px solid var(--border)",
        padding: "76px 0 20px", overflowY: "auto", height: "100vh", position: "sticky", top: 0,
        ...(sidebarOpen ? { position: "fixed", zIndex: 40, left: 0, top: 0 } : {}),
      }} className="sidebar">
        <div style={{ padding: "0 20px 20px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>◆ Meridian Collective</h2>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Logged in as <span style={{ color: "var(--gold)" }}>{user}</span></p>
        </div>

        {/* Overall progress */}
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            <span>Overall Progress</span>
            <span>{totalAnswered}/{totalQuestions} ({overallPct}%)</span>
          </div>
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
            <div style={{ height: "100%", background: "var(--gold)", borderRadius: 2, width: `${overallPct}%`, transition: "width 0.3s" }} />
          </div>
        </div>

        <nav>
          {categories.map((cat, ci) => {
            const done = answeredInCategory(ci);
            const total = cat.questions.length;
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
          <button onClick={() => router.push("/results")}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--gold)", fontSize: 12, padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            View Results
          </button>
          <button onClick={() => router.push("/hub")}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--gold)", fontSize: 12, padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            Partnership Hub
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
              {fb.emoji ? `${fb.emoji} ` : ""}{fb.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {getFilteredQuestions(activeCategory).map(({ q, originalIndex: qi }, displayIdx) => {
            const key = qKey(activeCategory, qi);
            const currentAnswer = answers[key];
            const selections = getSelections(activeCategory, qi);
            const hasOptions = q.options && q.options.length > 0;
            const otherSelected = isOtherSelected(activeCategory, qi);
            const otherText = getOtherText(activeCategory, qi);

            return (
              <div key={qi}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--gold)", marginRight: 8 }}>{displayIdx + 1}.</span>
                  {q.text}
                  {priorityBadge(q.priority)}
                  <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>(select all that apply)</span>
                </label>

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
                            onChange={() => toggleOption(activeCategory, qi, option)}
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
                        onChange={() => toggleOther(activeCategory, qi)}
                        style={{ accentColor: "var(--gold)", flexShrink: 0 }}
                      />
                      <span>Other</span>
                    </label>
                    {otherSelected && (
                      <textarea
                        value={otherText}
                        onChange={e => setOtherText(activeCategory, qi, e.target.value)}
                        placeholder="Please specify..."
                        rows={3}
                        style={{ marginLeft: 28 }}
                      />
                    )}
                  </div>
                ) : (
                  <textarea
                    value={typeof currentAnswer === "string" ? currentAnswer : ""}
                    onChange={e => save({ ...answers, [key]: e.target.value })}
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
          <button
            onClick={() => { setActiveCategory(Math.min(categories.length - 1, activeCategory + 1)); setPriorityFilter("all"); window.scrollTo(0, 0); }}
            disabled={activeCategory === categories.length - 1}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none",
              background: activeCategory === categories.length - 1 ? "var(--border)" : "var(--gold)",
              color: "var(--bg)", fontSize: 14, fontWeight: 600,
            }}
          >
            Next →
          </button>
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
