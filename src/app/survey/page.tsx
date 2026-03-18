"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { categories } from "@/data/questions";

const totalQuestions = categories.reduce((s, c) => s + c.questions.length, 0);

function getStorageKey(user: string) { return `meridian_answers_${user}`; }

export default function SurveyPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    const saved = localStorage.getItem(getStorageKey(u));
    if (saved) setAnswers(JSON.parse(saved));
  }, [router]);

  const save = useCallback((newAnswers: Record<string, string>) => {
    if (!user) return;
    setAnswers(newAnswers);
    localStorage.setItem(getStorageKey(user), JSON.stringify(newAnswers));
  }, [user]);

  const qKey = (ci: number, qi: number) => `${ci}-${qi}`;

  const answeredInCategory = (ci: number) =>
    categories[ci].questions.filter((_, qi) => answers[qKey(ci, qi)]?.trim()).length;

  const totalAnswered = Object.values(answers).filter(v => v?.trim()).length;
  const overallPct = Math.round((totalAnswered / totalQuestions) * 100);

  // Determine if the current answer is "Other"
  const isOtherSelected = (ci: number, qi: number) => {
    const answer = answers[qKey(ci, qi)] || "";
    const q = categories[ci].questions[qi];
    if (!q.options || q.options.length === 0) return false;
    if (!answer) return false;
    if (answer.startsWith("Other: ")) return true;
    return !q.options.includes(answer);
  };

  const getOtherText = (ci: number, qi: number) => {
    const answer = answers[qKey(ci, qi)] || "";
    if (answer.startsWith("Other: ")) return answer.slice(7);
    const q = categories[ci].questions[qi];
    if (q.options && !q.options.includes(answer) && answer) return answer;
    return "";
  };

  if (!user) return null;

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
        padding: "20px 0", overflowY: "auto", height: "100vh", position: "sticky", top: 0,
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
                onClick={() => { setActiveCategory(ci); setSidebarOpen(false); }}
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

        <div style={{ padding: "20px" }}>
          <button onClick={() => { localStorage.removeItem("meridian_user"); router.push("/"); }}
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, textDecoration: "underline" }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 35
      }} />}

      {/* Main content */}
      <main style={{ flex: 1, padding: "40px 40px 80px", maxWidth: 800 }} className="main-content">
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, color: "var(--gold)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Category {activeCategory + 1} of {categories.length}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{categories[activeCategory].name}</h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {categories[activeCategory].questions.map((q, qi) => {
            const key = qKey(activeCategory, qi);
            const currentAnswer = answers[key] || "";
            const hasOptions = q.options && q.options.length > 0;
            const otherSelected = isOtherSelected(activeCategory, qi);
            const otherText = getOtherText(activeCategory, qi);

            return (
              <div key={qi}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--gold)", marginRight: 8 }}>{qi + 1}.</span>{q.text}
                </label>

                {hasOptions ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {q.options!.map((option, oi) => (
                      <label
                        key={oi}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 14px", borderRadius: 8,
                          background: currentAnswer === option ? "var(--surface2)" : "var(--surface)",
                          border: currentAnswer === option ? "1px solid var(--gold)" : "1px solid var(--border)",
                          cursor: "pointer", fontSize: 13, lineHeight: 1.5,
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="radio"
                          name={key}
                          checked={currentAnswer === option}
                          onChange={() => save({ ...answers, [key]: option })}
                          style={{ accentColor: "var(--gold)", flexShrink: 0 }}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
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
                        type="radio"
                        name={key}
                        checked={otherSelected}
                        onChange={() => save({ ...answers, [key]: "Other: " })}
                        style={{ accentColor: "var(--gold)", flexShrink: 0 }}
                      />
                      <span>Other</span>
                    </label>
                    {otherSelected && (
                      <textarea
                        value={otherText}
                        onChange={e => save({ ...answers, [key]: `Other: ${e.target.value}` })}
                        placeholder="Please specify..."
                        rows={3}
                        style={{ marginLeft: 28 }}
                      />
                    )}
                  </div>
                ) : (
                  <textarea
                    value={currentAnswer}
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
            onClick={() => { setActiveCategory(Math.max(0, activeCategory - 1)); window.scrollTo(0, 0); }}
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
            onClick={() => { setActiveCategory(Math.min(categories.length - 1, activeCategory + 1)); window.scrollTo(0, 0); }}
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
          .main-content { padding: 70px 16px 40px !important; }
        }
      `}</style>
    </div>
  );
}
