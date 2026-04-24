"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { migrateLocalStorage, getStorageKey } from "@/lib/migration";

const SURVEY_ID = "branding";

const LOGOS = [
  { id: "01", key: "01 The Meridian", name: "The Meridian", sub: "Architectural · Literal", desc: "Surveyor's transit line with apex dot" },
  { id: "02", key: "02 M° The Monogram", name: "M° The Monogram", sub: "Typographic · Minimal", desc: "Letter M with degree symbol" },
  { id: "03", key: "03 The Coordinate", name: "The Coordinate", sub: "Geometric · Navigational", desc: "Crosshair/target with concentric circles" },
  { id: "04", key: "04 The Seal", name: "The Seal", sub: "Classical · Institutional", desc: "Circular seal with arced text" },
  { id: "05", key: "05 The Wordmark", name: "The Wordmark", sub: "Pure Typographic · Editorial", desc: 'Just "Meridian" with italic i' },
  { id: "06", key: "06 The Globe", name: "The Globe", sub: "Ornamental · Sovereign", desc: "Golden globe with wings and starburst" },
];

const PALETTES = [
  { id: "01", key: "01 Obsidian & Brass", name: "Obsidian & Brass", sub: "warm dark", colors: ["#0C0F0D", "#B08954"] },
  { id: "02", key: "02 Forest & Cognac", name: "Forest & Cognac", sub: "earthy", colors: ["#1C2E24", "#A06A3A"] },
  { id: "03", key: "03 Midnight & Oxblood", name: "Midnight & Oxblood", sub: "traditional", colors: ["#0D1B2E", "#7A2935"] },
  { id: "04", key: "04 Bone & Terracotta", name: "Bone & Terracotta", sub: "light editorial", colors: ["#F5EFE3", "#B86B48"] },
  { id: "05", key: "05 Graphite & Sage", name: "Graphite & Sage", sub: "contemporary", colors: ["#2B3130", "#8FA394"] },
  { id: "06A", key: "06A Imperial Gold", name: "Imperial Gold", sub: "regal, for Globe logo", colors: ["#1A1208", "#D4A843"] },
  { id: "06B", key: "06B Black & Burnished", name: "Black & Burnished", sub: "dramatic", colors: ["#0A0A0A", "#C8963C"] },
  { id: "06C", key: "06C Navy & Gold", name: "Navy & Gold", sub: "institutional", colors: ["#0D1B2E", "#D4A843"] },
];

const CATEGORIES = [
  { id: "logo", name: "Logo Vote" },
  { id: "palette", name: "Palette Vote" },
  { id: "comments", name: "Comments" },
];

const GOLD = "#C5A572";

function LogoSvg({ id }: { id: string }) {
  if (id === "01") return (
    <svg viewBox="0 0 80 80" width={80} height={80} fill="none">
      <circle cx="40" cy="10" r="4" fill={GOLD} />
      <line x1="40" y1="14" x2="40" y2="66" stroke={GOLD} strokeWidth="2" />
      <line x1="29" y1="42" x2="51" y2="42" stroke={GOLD} strokeWidth="1" />
      <line x1="24" y1="54" x2="56" y2="54" stroke={GOLD} strokeWidth="1" />
      <line x1="20" y1="66" x2="60" y2="66" stroke={GOLD} strokeWidth="1.5" />
    </svg>
  );
  if (id === "02") return (
    <svg viewBox="0 0 80 80" width={80} height={80} fill="none">
      <path d="M10 64 L10 16 L40 54 L70 16 L70 64" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="miter" fill="none" />
      <circle cx="74" cy="14" r="6" stroke={GOLD} strokeWidth="1.5" fill="none" />
    </svg>
  );
  if (id === "03") return (
    <svg viewBox="0 0 80 80" width={80} height={80} fill="none">
      <line x1="40" y1="6" x2="40" y2="74" stroke={GOLD} strokeWidth="1.5" />
      <line x1="6" y1="40" x2="74" y2="40" stroke={GOLD} strokeWidth="1.5" />
      <circle cx="40" cy="40" r="26" stroke={GOLD} strokeWidth="1.5" />
      <circle cx="40" cy="40" r="13" stroke={GOLD} strokeWidth="1.5" />
      <circle cx="40" cy="40" r="3.5" fill={GOLD} />
    </svg>
  );
  if (id === "04") return (
    <svg viewBox="0 0 80 80" width={80} height={80} fill="none">
      <circle cx="40" cy="40" r="34" stroke={GOLD} strokeWidth="2" />
      <circle cx="40" cy="40" r="28" stroke={GOLD} strokeWidth="0.75" />
      <circle cx="40" cy="40" r="18" stroke={GOLD} strokeWidth="1" />
      <text x="40" y="46" textAnchor="middle" fill={GOLD} fontSize="16" fontFamily="Georgia, serif" fontWeight="bold">M</text>
    </svg>
  );
  if (id === "05") return (
    <svg viewBox="0 0 80 80" width={80} height={80} fill="none">
      <text x="40" y="35" textAnchor="middle" fill={GOLD} fontSize="10" fontFamily="Georgia, serif" letterSpacing="3" fontWeight="600">MERIDIAN</text>
      <line x1="10" y1="45" x2="70" y2="45" stroke={GOLD} strokeWidth="0.75" />
      <text x="40" y="57" textAnchor="middle" fill={GOLD} fontSize="6.5" fontFamily="Georgia, serif" letterSpacing="3.5">COLLECTIVE</text>
    </svg>
  );
  if (id === "06") return (
    <svg viewBox="0 0 80 80" width={80} height={80} fill="none">
      <circle cx="40" cy="46" r="18" stroke={GOLD} strokeWidth="1.5" />
      <ellipse cx="40" cy="46" rx="18" ry="7" stroke={GOLD} strokeWidth="0.75" />
      <line x1="40" y1="28" x2="40" y2="64" stroke={GOLD} strokeWidth="0.75" />
      <path d="M22 46 C15 41 11 34 13 28" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 46 C13 43 9 38 10 32" stroke={GOLD} strokeWidth="1" strokeLinecap="round" />
      <path d="M58 46 C65 41 69 34 67 28" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M58 46 C67 43 71 38 70 32" stroke={GOLD} strokeWidth="1" strokeLinecap="round" />
      <circle cx="40" cy="23" r="3" fill={GOLD} />
      <line x1="40" y1="16" x2="40" y2="20" stroke={GOLD} strokeWidth="1.5" />
      <line x1="45" y1="18" x2="43" y2="21" stroke={GOLD} strokeWidth="1.5" />
      <line x1="35" y1="18" x2="37" y2="21" stroke={GOLD} strokeWidth="1.5" />
    </svg>
  );
  return null;
}

function useDebouncedSave() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  return useCallback((answers: Record<string, string[] | string>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!supabase) return;
      const user = localStorage.getItem("meridian_user");
      if (!user) return;
      try {
        await supabase.from("meridian_responses").delete().eq("member_name", user).eq("survey_id", SURVEY_ID);
        const rows = Object.entries(answers)
          .filter(([, v]) => Array.isArray(v) ? (v as string[]).some(x => x) : typeof v === "string" && (v as string).trim())
          .map(([questionId, answer]) => ({
            member_name: user, question_id: questionId, survey_id: SURVEY_ID,
            answer: JSON.stringify(answer), updated_at: new Date().toISOString(),
          }));
        if (rows.length > 0) await supabase.from("meridian_responses").insert(rows);
      } catch (e) { console.error("Save failed:", e); }
    }, 1000);
  }, []);
}

export default function BrandingSurveyPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({});
  const [activeCategory, setActiveCategory] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveToServer = useDebouncedSave();

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    migrateLocalStorage(u);
    const storageKey = getStorageKey(SURVEY_ID, u);
    if (!supabase) {
      const saved = localStorage.getItem(storageKey);
      if (saved) setAnswers(JSON.parse(saved));
      return;
    }
    supabase.from("meridian_responses").select("question_id, answer")
      .eq("member_name", u).eq("survey_id", SURVEY_ID)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const parsed: Record<string, string[] | string> = {};
          for (const row of data) {
            try { parsed[row.question_id] = JSON.parse(row.answer); }
            catch { parsed[row.question_id] = row.answer; }
          }
          setAnswers(parsed);
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        } else {
          const saved = localStorage.getItem(storageKey);
          if (saved) setAnswers(JSON.parse(saved));
        }
      });
  }, [router]);

  const save = useCallback((newAnswers: Record<string, string[] | string>) => {
    if (!user) return;
    setAnswers(newAnswers);
    localStorage.setItem(getStorageKey(SURVEY_ID, user), JSON.stringify(newAnswers));
    saveToServer(newAnswers);
  }, [user, saveToServer]);

  const getRanked = (qId: string): string[] => {
    const val = answers[qId];
    if (Array.isArray(val)) return val;
    return [];
  };

  const getRank = (qId: string, optionKey: string): number | null => {
    const ranked = getRanked(qId);
    const idx = ranked.indexOf(optionKey);
    return idx >= 0 ? idx + 1 : null;
  };

  const setRank = (qId: string, optionKey: string, rank: number | null) => {
    const current = [...getRanked(qId)];
    while (current.length < 3) current.push("");
    for (let i = 0; i < 3; i++) {
      if (current[i] === optionKey) current[i] = "";
    }
    if (rank !== null) current[rank - 1] = optionKey;
    save({ ...answers, [qId]: current });
  };

  const getCategoryAnswered = (ci: number): number => {
    if (ci === 0) return getRanked("branding-logo-rank").some(x => x) ? 1 : 0;
    if (ci === 1) return getRanked("branding-palette-rank").some(x => x) ? 1 : 0;
    if (ci === 2) return typeof answers["branding-comments"] === "string" && (answers["branding-comments"] as string).trim() ? 1 : 0;
    return 0;
  };

  const totalAnswered = CATEGORIES.reduce((s, _, ci) => s + getCategoryAnswered(ci), 0);
  const overallPct = Math.round((totalAnswered / 3) * 100);

  const rankLabel = (r: number) => r === 1 ? "1st" : r === 2 ? "2nd" : "3rd";

  const renderLogoVote = () => (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>
        Use the rank dropdowns on each card to select your top 3 logos. 1st = 3pts, 2nd = 2pts, 3rd = 1pt.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {LOGOS.map(logo => {
          const rank = getRank("branding-logo-rank", logo.key);
          return (
            <div key={logo.id} style={{
              background: rank ? "var(--surface2)" : "var(--surface)",
              border: `1px solid ${rank ? "var(--gold)" : "var(--border)"}`,
              borderRadius: 12, padding: 20, position: "relative", transition: "all 0.15s",
            }}>
              {rank && (
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  background: "var(--gold)", color: "var(--bg)",
                  fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
                }}>{rankLabel(rank)}</div>
              )}
              <div style={{
                width: 80, height: 80, background: "rgba(0,0,0,0.3)", borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
              }}>
                <LogoSvg id={logo.id} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{logo.name}</p>
              <p style={{ fontSize: 11, color: "var(--gold)", marginBottom: 4 }}>{logo.sub}</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14, lineHeight: 1.4 }}>{logo.desc}</p>
              <select
                value={rank ?? 0}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  setRank("branding-logo-rank", logo.key, v === 0 ? null : v);
                }}
                style={{
                  width: "100%", background: "var(--bg)", border: "1px solid var(--border)",
                  color: rank ? "var(--gold)" : "var(--muted)",
                  borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer",
                }}
              >
                <option value={0}>— Not ranked</option>
                <option value={1}>1st choice (3pts)</option>
                <option value={2}>2nd choice (2pts)</option>
                <option value={3}>3rd choice (1pt)</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPaletteVote = () => (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>
        Rank your top 3 color palettes. 1st = 3pts, 2nd = 2pts, 3rd = 1pt.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PALETTES.map(palette => {
          const rank = getRank("branding-palette-rank", palette.key);
          return (
            <div key={palette.id} style={{
              background: rank ? "var(--surface2)" : "var(--surface)",
              border: `1px solid ${rank ? "var(--gold)" : "var(--border)"}`,
              borderRadius: 10, padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 16, transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" }}>
                {palette.colors.map((c, i) => (
                  <div key={i} style={{ width: 48, height: 52, background: c }} />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                  <span style={{ color: "var(--muted)", fontSize: 11, marginRight: 6 }}>{palette.id}</span>
                  {palette.name}
                </p>
                <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{palette.sub}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {palette.colors.map((c, i) => (
                    <span key={i} style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>{c}</span>
                  ))}
                </div>
              </div>
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {rank && (
                  <span style={{
                    background: "var(--gold)", color: "var(--bg)",
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                  }}>{rankLabel(rank)}</span>
                )}
                <select
                  value={rank ?? 0}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    setRank("branding-palette-rank", palette.key, v === 0 ? null : v);
                  }}
                  style={{
                    background: "var(--bg)", border: "1px solid var(--border)",
                    color: rank ? "var(--gold)" : "var(--muted)",
                    borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer",
                  }}
                >
                  <option value={0}>— Not ranked</option>
                  <option value={1}>1st (3pts)</option>
                  <option value={2}>2nd (2pts)</option>
                  <option value={3}>3rd (1pt)</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderComments = () => (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>
        Share any additional thoughts on the branding direction.
      </p>
      <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
        Any thoughts on branding direction?
      </label>
      <textarea
        value={typeof answers["branding-comments"] === "string" ? answers["branding-comments"] as string : ""}
        onChange={e => save({ ...answers, "branding-comments": e.target.value })}
        placeholder="Share your thoughts on the overall branding direction..."
        rows={6}
        style={{
          width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
          color: "var(--fg)", borderRadius: 8, padding: "12px 16px", fontSize: 14,
          lineHeight: 1.6, resize: "vertical", boxSizing: "border-box",
        }}
      />
    </div>
  );

  if (!user) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile header */}
      <div style={{
        display: "none", position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "12px 16px",
        alignItems: "center", justifyContent: "space-between",
      }} className="mobile-header">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "var(--fg)", fontSize: 20 }}>☰</button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Branding Vote</span>
        <span style={{ fontSize: 12, color: "var(--gold)" }}>{overallPct}%</span>
      </div>

      {/* Sidebar */}
      <aside style={{
        width: 280, minWidth: 280, background: "var(--surface)", borderRight: "1px solid var(--border)",
        padding: "76px 0 20px", overflowY: "auto", height: "100vh", position: "sticky", top: 0,
        ...(sidebarOpen ? { position: "fixed" as const, zIndex: 40, left: 0, top: 0 } : {}),
      }} className="sidebar">
        <div style={{ padding: "0 20px 20px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>◆ Branding Vote</h2>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Logged in as <span style={{ color: "var(--gold)" }}>{user}</span></p>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            <span>Overall Progress</span>
            <span>{totalAnswered}/3 ({overallPct}%)</span>
          </div>
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
            <div style={{ height: "100%", background: "var(--gold)", borderRadius: 2, width: `${overallPct}%`, transition: "width 0.3s" }} />
          </div>
        </div>
        <nav>
          {CATEGORIES.map((cat, ci) => {
            const done = getCategoryAnswered(ci);
            return (
              <button key={ci}
                onClick={() => { setActiveCategory(ci); setSidebarOpen(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 20px",
                  background: ci === activeCategory ? "var(--surface2)" : "transparent",
                  border: "none", borderLeft: ci === activeCategory ? "3px solid var(--gold)" : "3px solid transparent",
                  color: ci === activeCategory ? "var(--fg)" : "var(--muted)",
                  fontSize: 13, transition: "all 0.15s", cursor: "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{cat.name}</span>
                  <span style={{ fontSize: 11, color: done ? "#5a5" : "var(--muted)" }}>{done}/1</span>
                </div>
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => router.push(`/results/${SURVEY_ID}`)}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--gold)", fontSize: 12, padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            View Results
          </button>
          <button onClick={() => router.push("/surveys")}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--gold)", fontSize: 12, padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>
            All Surveys
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 35 }} />
      )}

      {/* Main content */}
      <main style={{ flex: 1, padding: "80px 40px 80px", maxWidth: 900 }} className="main-content">
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: "var(--gold)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Section {activeCategory + 1} of {CATEGORIES.length}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{CATEGORIES[activeCategory].name}</h1>
        </div>

        {activeCategory === 0 && renderLogoVote()}
        {activeCategory === 1 && renderPaletteVote()}
        {activeCategory === 2 && renderComments()}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, gap: 16 }}>
          <button
            onClick={() => { setActiveCategory(Math.max(0, activeCategory - 1)); window.scrollTo(0, 0); }}
            disabled={activeCategory === 0}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: activeCategory === 0 ? "var(--border)" : "var(--fg)",
              fontSize: 14, cursor: activeCategory === 0 ? "default" : "pointer",
            }}>
            ← Previous
          </button>
          {activeCategory === CATEGORIES.length - 1 ? (
            <button
              onClick={async () => {
                if (!user) return;
                if (supabase) {
                  try {
                    await supabase.from("meridian_responses").delete().eq("member_name", user).eq("survey_id", SURVEY_ID);
                    const rows = Object.entries(answers)
                      .filter(([, v]) => Array.isArray(v) ? (v as string[]).some(x => x) : typeof v === "string" && (v as string).trim())
                      .map(([questionId, answer]) => ({
                        member_name: user, question_id: questionId, survey_id: SURVEY_ID,
                        answer: JSON.stringify(answer), updated_at: new Date().toISOString(),
                      }));
                    if (rows.length > 0) await supabase.from("meridian_responses").insert(rows);
                  } catch (e) { console.error("Final save failed:", e); }
                }
                router.push(`/results/${SURVEY_ID}`);
              }}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "var(--gold)", color: "var(--bg)", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
              Submit
            </button>
          ) : (
            <button
              onClick={() => { setActiveCategory(Math.min(CATEGORIES.length - 1, activeCategory + 1)); window.scrollTo(0, 0); }}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "var(--gold)", color: "var(--bg)", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
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
