"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSurveyById, type SurveyQuestion } from "@/data/surveys";
import { supabase } from "@/lib/supabase";
import { migrateLocalStorage, getStorageKey } from "@/lib/migration";

// =============================================================
// PALETTE DATA  (exact colors from meridian_collective_palette_options.html)
// =============================================================
type PaletteColors = {
  bg: string;
  accent: string;
  accentDeep: string;
  fg: string;
  neutral: string;
  isDark: boolean;
  swatches: string[];
};

const PALETTE_DATA: Record<string, PaletteColors> = {
  "01 Obsidian & Brass":   { bg: "#0C0F0D", accent: "#B08954", accentDeep: "#8E6B3F", fg: "#F4EFE6", neutral: "#D6D1C4", isDark: true,  swatches: ["#0C0F0D", "#B08954", "#F4EFE6", "#D6D1C4", "#1A1A1A"] },
  "02 Forest & Cognac":    { bg: "#1C2E24", accent: "#A06A3A", accentDeep: "#7E5229", fg: "#EEE6D4", neutral: "#B8B09A", isDark: true,  swatches: ["#1C2E24", "#A06A3A", "#EEE6D4", "#B8B09A", "#1A1A1A"] },
  "03 Midnight & Oxblood": { bg: "#0D1B2E", accent: "#7A2935", accentDeep: "#5F1D28", fg: "#EFE7D6", neutral: "#BFB5A1", isDark: true,  swatches: ["#0D1B2E", "#7A2935", "#EFE7D6", "#BFB5A1", "#0A0A0A"] },
  "04 Bone & Terracotta":  { bg: "#F5EFE3", accent: "#B86B48", accentDeep: "#8E4F32", fg: "#2D2A24", neutral: "#8A9088", isDark: false, swatches: ["#F5EFE3", "#B86B48", "#2D2A24", "#8A9088", "#1A1A1A"] },
  "05 Graphite & Sage":    { bg: "#2B3130", accent: "#8FA394", accentDeep: "#5E7268", fg: "#F0EDE6", neutral: "#C9C4B8", isDark: true,  swatches: ["#2B3130", "#8FA394", "#F0EDE6", "#C9C4B8", "#1A1A1A"] },
  "06A Imperial Gold":     { bg: "#1A1409", accent: "#D4AF37", accentDeep: "#B8922A", fg: "#F8F0DC", neutral: "#8C6239", isDark: true,  swatches: ["#1A1409", "#D4AF37", "#F8F0DC", "#8C6239", "#1A1A1A"] },
  "06B Black & Burnished": { bg: "#0D0D0D", accent: "#A67C52", accentDeep: "#8C6239", fg: "#E8E0D0", neutral: "#6B4C30", isDark: true,  swatches: ["#0D0D0D", "#A67C52", "#E8E0D0", "#6B4C30", "#1A1A1A"] },
  "06C Navy & Gold":       { bg: "#0A1628", accent: "#C9A826", accentDeep: "#B08920", fg: "#E8E4D8", neutral: "#1E3A6E", isDark: true,  swatches: ["#0A1628", "#C9A826", "#E8E4D8", "#1E3A6E", "#1A1A1A"] },
};

const DEFAULT_PALETTE = "01 Obsidian & Brass";

// =============================================================
// LOGO COMPONENTS  (extracted from meridian_collective_logo_options.html)
// =============================================================

function Logo01({ c, full }: { c: PaletteColors; full: boolean }) {
  const w = full ? 160 : 80;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: full ? 18 : 10 }}>
      <svg width={w} height={Math.round(w * 0.35)} viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
        <line x1="15" y1="55" x2="185" y2="55" stroke={c.accent} strokeWidth="1" />
        <line x1="15" y1="48" x2="15" y2="62" stroke={c.accent} strokeWidth="1" />
        <line x1="185" y1="48" x2="185" y2="62" stroke={c.accent} strokeWidth="1" />
        <circle cx="100" cy="28" r="4.5" fill={c.accent} />
        <line x1="100" y1="34" x2="100" y2="55" stroke={c.accent} strokeWidth="0.4" strokeDasharray="1 3" />
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Fraunces', 'Times New Roman', serif", fontWeight: 300, fontSize: full ? 34 : 18, letterSpacing: "0.16em", color: c.fg, lineHeight: 1 }}>Meridian</div>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: full ? 10 : 6, letterSpacing: full ? "0.55em" : "0.4em", fontWeight: 500, textTransform: "uppercase", color: c.accent, paddingLeft: "0.5em", marginTop: full ? 6 : 3 }}>Collective</div>
      </div>
    </div>
  );
}

function Logo02({ c, full }: { c: PaletteColors; full: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      <span style={{ fontFamily: "'Fraunces', 'Times New Roman', serif", fontWeight: 300, fontSize: full ? 130 : 64, lineHeight: 0.9, letterSpacing: "-0.04em", color: c.fg }}>M</span>
      <span style={{ fontFamily: "'Fraunces', 'Times New Roman', serif", fontSize: full ? 38 : 20, color: c.accent, marginTop: "0.05em", fontWeight: 400 }}>°</span>
    </div>
  );
}

function Logo03({ c, full }: { c: PaletteColors; full: boolean }) {
  const sz = full ? 150 : 72;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: full ? 20 : 10 }}>
      <svg width={sz} height={sz} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="42" fill="none" stroke={c.accent} strokeWidth="0.8" />
        <circle cx="50" cy="50" r="32" fill="none" stroke={c.accent} strokeWidth="0.4" opacity="0.5" />
        <line x1="50" y1="12" x2="50" y2="88" stroke={c.accent} strokeWidth="0.8" />
        <line x1="12" y1="50" x2="88" y2="50" stroke={c.accent} strokeWidth="0.8" />
        <circle cx="50" cy="50" r="3" fill={c.accent} />
        <line x1="50" y1="4" x2="50" y2="9" stroke={c.accent} strokeWidth="0.8" />
        <line x1="50" y1="91" x2="50" y2="96" stroke={c.accent} strokeWidth="0.8" />
        <line x1="4" y1="50" x2="9" y2="50" stroke={c.accent} strokeWidth="0.8" />
        <line x1="91" y1="50" x2="96" y2="50" stroke={c.accent} strokeWidth="0.8" />
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Fraunces', 'Times New Roman', serif", fontWeight: 300, fontSize: full ? 32 : 16, letterSpacing: "0.18em", color: c.fg, lineHeight: 1 }}>Meridian</div>
        <div style={{ fontFamily: "system-ui, sans-serif", fontSize: full ? 10 : 6, letterSpacing: full ? "0.5em" : "0.35em", fontWeight: 500, textTransform: "uppercase", color: c.accent, paddingLeft: "0.5em", marginTop: full ? 6 : 3 }}>Collective</div>
      </div>
    </div>
  );
}

function Logo04({ c, full }: { c: PaletteColors; full: boolean }) {
  const sz = full ? 220 : 110;
  const uid = `seal-${full ? "f" : "t"}-${c.bg.replace("#", "")}`;
  return (
    <svg width={sz} height={sz} viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <path id={`${uid}-top`} d="M 120,120 m -95,0 a 95,95 0 1,1 190,0" />
        <path id={`${uid}-bot`} d="M 120,120 m -95,0 a 95,95 0 1,0 190,0" />
      </defs>
      <circle cx="120" cy="120" r="108" fill="none" stroke={c.accent} strokeWidth="0.6" />
      <circle cx="120" cy="120" r="98" fill="none" stroke={c.accent} strokeWidth="0.4" opacity="0.4" />
      <circle cx="120" cy="120" r="68" fill="none" stroke={c.accent} strokeWidth="0.4" opacity="0.4" />
      <text fontFamily="system-ui, sans-serif" fontSize="8.5" letterSpacing="4" fill={c.fg} fontWeight="500">
        <textPath href={`#${uid}-top`} startOffset="50%" textAnchor="middle">MERIDIAN · COLLECTIVE</textPath>
      </text>
      <text fontFamily="system-ui, sans-serif" fontSize="7.5" letterSpacing="5" fill={c.fg} fontWeight="500" opacity="0.75">
        <textPath href={`#${uid}-bot`} startOffset="50%" textAnchor="middle">· ATLANTA · EST · MMXXVI ·</textPath>
      </text>
      <line x1="40" y1="120" x2="56" y2="120" stroke={c.accent} strokeWidth="0.5" />
      <line x1="184" y1="120" x2="200" y2="120" stroke={c.accent} strokeWidth="0.5" />
      <line x1="80" y1="140" x2="160" y2="140" stroke={c.accent} strokeWidth="0.8" />
      <line x1="80" y1="134" x2="80" y2="146" stroke={c.accent} strokeWidth="0.8" />
      <line x1="160" y1="134" x2="160" y2="146" stroke={c.accent} strokeWidth="0.8" />
      <circle cx="120" cy="112" r="3.5" fill={c.accent} />
      <text x="120" y="102" fontFamily="'Fraunces', serif" fontSize="14" fill={c.fg} textAnchor="middle" fontStyle="italic" fontWeight="300">est.</text>
    </svg>
  );
}

function Logo05({ c, full }: { c: PaletteColors; full: boolean }) {
  const fontSize = full ? 76 : 38;
  const hairW = full ? 40 : 22;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ fontFamily: "'Fraunces', 'Times New Roman', serif", fontWeight: 300, fontSize, letterSpacing: "0.02em", lineHeight: 1, color: c.fg }}>
        Mer<span style={{ fontStyle: "italic", color: c.accent }}>i</span>dian
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: full ? 14 : 8, marginTop: full ? 20 : 10 }}>
        <span style={{ width: hairW, height: 1, background: c.accent, display: "block", flexShrink: 0 }} />
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: full ? 12 : 7, letterSpacing: full ? "0.55em" : "0.4em", fontWeight: 500, textTransform: "uppercase", color: c.accent, paddingLeft: "0.5em", whiteSpace: "nowrap" }}>Collective</span>
        <span style={{ width: hairW, height: 1, background: c.accent, display: "block", flexShrink: 0 }} />
      </div>
    </div>
  );
}

function Logo06({ c, full }: { c: PaletteColors; full: boolean }) {
  const sz = full ? 160 : 76;
  return (
    <svg width={sz} height={sz} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="28" stroke={c.accent} strokeWidth="1.5" />
      <ellipse cx="32" cy="32" rx="13" ry="28" stroke={c.accent} strokeWidth="0.75" />
      <line x1="4" y1="32" x2="60" y2="32" stroke={c.accent} strokeWidth="0.75" />
      <line x1="8" y1="20" x2="56" y2="20" stroke={c.accent} strokeWidth="0.5" />
      <line x1="8" y1="44" x2="56" y2="44" stroke={c.accent} strokeWidth="0.5" />
    </svg>
  );
}

function LogoRender({ logoKey, c, full }: { logoKey: string; c: PaletteColors; full: boolean }) {
  if (logoKey.startsWith("01")) return <Logo01 c={c} full={full} />;
  if (logoKey.startsWith("02")) return <Logo02 c={c} full={full} />;
  if (logoKey.startsWith("03")) return <Logo03 c={c} full={full} />;
  if (logoKey.startsWith("04")) return <Logo04 c={c} full={full} />;
  if (logoKey.startsWith("05")) return <Logo05 c={c} full={full} />;
  return <Logo06 c={c} full={full} />;
}

const shortPaletteName = (key: string) => key.replace(/^\d+[A-C]?\s/, "");

// =============================================================
// HOOKS & HELPERS
// =============================================================

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

// =============================================================
// SURVEY PAGE
// =============================================================

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
  const [logoModal, setLogoModal] = useState<{ logoKey: string; paletteId: string } | null>(null);
  const lastPaletteRef = useRef(DEFAULT_PALETTE);
  const saveToServer = useDebouncedSaveToServer();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (logoModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [logoModal]);

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

  const toggleLogoRank = (logoKey: string) => {
    const current = getSelections("brand-logo-rank");
    const newRanking = current.includes(logoKey)
      ? current.filter(o => o !== logoKey)
      : [...current, logoKey];
    save({ ...answers, "brand-logo-rank": newRanking });
  };

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

                          if (q.id === "brand-logo-rank") {
                            const thumbColors = PALETTE_DATA[DEFAULT_PALETTE];
                            return (
                              <div
                                key={oi}
                                style={{
                                  position: "relative",
                                  background: ranked ? "rgba(197,165,114,0.08)" : "var(--surface)",
                                  border: ranked ? "2px solid var(--gold)" : "1px solid var(--border)",
                                  borderRadius: 10, overflow: "hidden",
                                  transition: "all 0.15s",
                                }}
                              >
                                {/* Logo image — click opens full preview modal */}
                                <button
                                  type="button"
                                  onClick={() => setLogoModal({ logoKey: option, paletteId: lastPaletteRef.current })}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    width: "100%", height: 150, border: "none", cursor: "zoom-in",
                                    background: thumbColors.bg, position: "relative", padding: 16,
                                  }}
                                >
                                  <LogoRender logoKey={option} c={thumbColors} full={false} />
                                  <span style={{
                                    position: "absolute", top: 8, left: 8, fontSize: 9,
                                    color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em",
                                    textTransform: "uppercase", fontWeight: 500, pointerEvents: "none",
                                  }}>
                                    Preview ↗
                                  </span>
                                </button>

                                {/* Footer — click to rank */}
                                <button
                                  type="button"
                                  onClick={() => toggleLogoRank(option)}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    width: "100%", padding: "10px 12px", background: "transparent",
                                    border: "none", borderTop: "1px solid var(--border)",
                                    cursor: "pointer", color: "var(--fg)", textAlign: "left",
                                  }}
                                >
                                  <div>
                                    <span style={{ fontSize: 9, color: "var(--muted)", display: "block", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 1 }}>
                                      {option.slice(0, 2)}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 500 }}>{option.slice(3)}</span>
                                  </div>
                                  <span style={{
                                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                    background: ranked ? "var(--gold)" : "rgba(255,255,255,0.1)",
                                    color: ranked ? "var(--bg)" : "var(--muted)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: ranked ? 13 : 10, fontWeight: 700, transition: "all 0.15s",
                                  }}>
                                    {ranked ? rank + 1 : "·"}
                                  </span>
                                </button>
                              </div>
                            );
                          }

                          // Palette ranking cards
                          const swatches = PALETTE_DATA[option]?.swatches ?? [];
                          return (
                            <button
                              key={oi}
                              type="button"
                              onClick={() => {
                                const newRanking = ranked
                                  ? selections.filter(o => o !== option)
                                  : [...selections, option];
                                save({ ...answers, [q.id]: newRanking });
                              }}
                              style={{
                                position: "relative", cursor: "pointer",
                                background: ranked ? "rgba(197,165,114,0.08)" : "var(--surface)",
                                border: ranked ? "2px solid var(--gold)" : "1px solid var(--border)",
                                borderRadius: 10, padding: 0, overflow: "hidden",
                                transition: "all 0.15s", color: "var(--fg)", textAlign: "left",
                              }}
                            >
                              <div style={{ display: "flex", height: 64 }}>
                                {swatches.map((color, ci) => (
                                  <div key={ci} style={{ flex: 1, background: color }} />
                                ))}
                              </div>
                              <div style={{ padding: "10px 12px 12px" }}>
                                <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, display: "block" }}>{option}</span>
                              </div>
                              <div style={{
                                position: "absolute", top: 8, right: 8,
                                width: 28, height: 28, borderRadius: "50%",
                                background: ranked ? "var(--gold)" : "rgba(255,255,255,0.15)",
                                color: ranked ? "var(--bg)" : "var(--muted)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: ranked ? 13 : 10, fontWeight: 700, transition: "all 0.15s",
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
                                const newRanking = ranked
                                  ? selections.filter(o => o !== option)
                                  : [...selections, option];
                                save({ ...answers, [q.id]: newRanking });
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
                background: "var(--gold)", color: "var(--bg)", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Submit
            </button>
          ) : (
            <button
              onClick={() => { setActiveCategory(Math.min(categories.length - 1, activeCategory + 1)); setPriorityFilter("all"); window.scrollTo(0, 0); }}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "var(--gold)", color: "var(--bg)", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Next →
            </button>
          )}
        </div>
      </main>

      {/* ============================================================
          LOGO PREVIEW MODAL
      ============================================================ */}
      {logoModal && (() => {
        const pal = PALETTE_DATA[logoModal.paletteId] ?? PALETTE_DATA[DEFAULT_PALETTE];
        const logoSelections = getSelections("brand-logo-rank");
        const rankIndex = logoSelections.indexOf(logoModal.logoKey);
        const isRanked = rankIndex !== -1;
        const panelBg = pal.isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.06)";
        const panelBorder = pal.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
        const mutedText = pal.isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)";
        const bodyText = pal.isDark ? "rgba(255,255,255,0.68)" : "rgba(0,0,0,0.65)";

        return (
          <>
            <div
              onClick={() => setLogoModal(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 200, backdropFilter: "blur(4px)" }}
            />
            <div style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 201, width: "min(720px, 96vw)", maxHeight: "92vh",
              display: "flex", flexDirection: "column",
              background: pal.bg, borderRadius: 16, overflow: "hidden",
              border: `1px solid ${panelBorder}`,
              boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
              transition: "background 0.25s ease",
            }}>
              {/* Header */}
              <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: mutedText, fontWeight: 500 }}>
                    {logoModal.logoKey.slice(0, 2)}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: pal.fg, marginLeft: 10 }}>
                    {logoModal.logoKey.slice(3)}
                  </span>
                </div>
                <button
                  onClick={() => setLogoModal(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: mutedText, fontSize: 22, lineHeight: 1, padding: "4px 8px" }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Logo display */}
              <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "48px 48px 40px", minHeight: 280,
              }}>
                <LogoRender logoKey={logoModal.logoKey} c={pal} full={true} />
              </div>

              {/* Palette switcher */}
              <div style={{ background: panelBg, borderTop: `1px solid ${panelBorder}`, padding: "18px 24px" }}>
                <p style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: mutedText, marginBottom: 12, fontWeight: 500 }}>
                  Color Palette — click to preview
                </p>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {Object.entries(PALETTE_DATA).map(([pid, pd]) => {
                    const isActive = logoModal.paletteId === pid;
                    return (
                      <button
                        key={pid}
                        onClick={() => {
                          lastPaletteRef.current = pid;
                          setLogoModal(prev => prev ? { ...prev, paletteId: pid } : null);
                        }}
                        title={pid}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "5px 11px 5px 7px", borderRadius: 20, fontSize: 11,
                          border: `1px solid ${isActive ? pal.accent : panelBorder}`,
                          background: isActive ? pal.accent : "transparent",
                          color: isActive ? (pal.isDark ? pal.bg : "#fff") : bodyText,
                          cursor: "pointer", transition: "all 0.15s",
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: pd.accent, flexShrink: 0, display: "block" }} />
                        {shortPaletteName(pid)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rank controls */}
              <div style={{
                background: panelBg, borderTop: `1px solid ${panelBorder}`,
                padding: "14px 24px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              }}>
                <button
                  type="button"
                  onClick={() => toggleLogoRank(logoModal.logoKey)}
                  style={{
                    padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    ...(isRanked ? {
                      background: "transparent",
                      border: `1px solid ${panelBorder}`,
                      color: bodyText,
                    } : {
                      background: pal.accent,
                      border: "none",
                      color: pal.isDark ? pal.bg : "#fff",
                    }),
                  }}
                >
                  {isRanked ? `Ranked #${rankIndex + 1} — Remove` : "+ Add to My Ranking"}
                </button>
                <span style={{ fontSize: 11, color: mutedText }}>
                  {logoSelections.length > 0
                    ? `${logoSelections.length} logo${logoSelections.length !== 1 ? "s" : ""} ranked`
                    : "No logos ranked yet"}
                </span>
              </div>
            </div>
          </>
        );
      })()}

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
