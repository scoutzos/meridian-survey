"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllSurveys } from "@/data/surveys";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";
import { migrateLocalStorage, getStorageKey } from "@/lib/migration";
import {
  fetchActionItems,
  isOwnedBy,
  updateActionItemStatus,
  type ActionItem,
} from "@/lib/action-items";
import { fetchNextMeeting, type NextMeeting } from "@/lib/meetings";

type SurveyProgress = {
  surveyId: string;
  title: string;
  description: string;
  answered: number;
  total: number;
  status: "Completed" | "In Progress" | "Not Started";
};

const DISPLAY_FONT = "var(--font-display)";
const BODY_FONT = "var(--font-body)";

const COLORS = {
  obsidian: "var(--obsidian)",
  brass: "var(--brass)",
  bone: "var(--bone)",
  fog: "var(--fog)",
  ink: "var(--ink)",
};

const QUICK_LINKS: Array<{ title: string; href: string; eyebrow: string; external?: boolean }> = [
  {
    title: "Operating Agreement Draft",
    eyebrow: "Working Document",
    href: "/decisions",
  },
  {
    title: "Brand Guidelines Vol. I",
    eyebrow: "Identity",
    href: "/documents",
  },
  {
    title: "Main Website",
    eyebrow: "Public Site",
    href: "https://meridian-website-red.vercel.app",
    external: true,
  },
];

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMeetingDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function canonicalMember(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  const match = MEMBERS.find(m => m.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [progress, setProgress] = useState<SurveyProgress[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
  const [loaded, setLoaded] = useState(false);

  const surveys = useMemo(() => getAllSurveys(), []);

  useEffect(() => {
    const raw = localStorage.getItem("meridian_user");
    if (!raw) { router.push("/"); return; }
    const u = canonicalMember(raw);
    setUser(u);
    migrateLocalStorage(u);

    const totalsBySurvey: Record<string, number> = {};
    for (const s of surveys) {
      totalsBySurvey[s.id] = s.categories.reduce((sum, c) => sum + c.questions.length, 0);
    }

    const buildProgressFromCounts = (counts: Record<string, Record<string, number>>) => {
      const myProgress: SurveyProgress[] = surveys.map(s => {
        const total = totalsBySurvey[s.id];
        const answered = counts[s.id]?.[u] || 0;
        let status: SurveyProgress["status"] = "Not Started";
        if (answered >= total && total > 0) status = "Completed";
        else if (answered > 0) status = "In Progress";
        return { surveyId: s.id, title: s.title, description: s.description, answered, total, status };
      });
      setProgress(myProgress);
      setLoaded(true);
    };

    if (!supabase) {
      const counts: Record<string, Record<string, number>> = {};
      for (const s of surveys) {
        counts[s.id] = {};
        const cached = localStorage.getItem(getStorageKey(s.id, u));
        if (!cached) continue;
        try {
          const data = JSON.parse(cached) as Record<string, unknown>;
          const answered = Object.values(data).filter(v => {
            if (Array.isArray(v)) return v.length > 0;
            return typeof v === "string" && v.trim() !== "";
          }).length;
          counts[s.id][u] = answered;
        } catch { /* ignore */ }
      }
      buildProgressFromCounts(counts);
      return;
    }

    Promise.all([
      supabase.from("meridian_responses").select("member_name, survey_id"),
      fetchActionItems(),
      fetchNextMeeting(),
    ]).then(([respRes, items, meeting]) => {
      const rows = respRes.data || [];
      const counts: Record<string, Record<string, number>> = {};
      for (const row of rows) {
        const sid = row.survey_id || "operating-agreement";
        const canonical = canonicalMember(row.member_name);
        if (!counts[sid]) counts[sid] = {};
        counts[sid][canonical] = (counts[sid][canonical] || 0) + 1;
      }
      buildProgressFromCounts(counts);
      setActionItems(items);
      setNextMeeting(meeting);
    });
  }, [router, surveys]);

  if (!user) return null;

  const firstName = user.split(" ")[0];
  const { obsidian, brass, bone, fog, ink } = COLORS;

  // My open / in-progress action items, soonest first.
  const myItems = actionItems
    .filter(i => i.status !== "done" && isOwnedBy(i, user))
    .slice(0, 5);

  const handleMarkDone = async (item: ActionItem) => {
    const { error } = await updateActionItemStatus(item.id, "done", user);
    if (error) { alert(error); return; }
    setActionItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "done", completed_at: new Date().toISOString() } : i));
  };

  const statusStyle = (status: SurveyProgress["status"]) => {
    if (status === "Completed") return { background: brass, color: obsidian, border: `1px solid ${brass}` };
    if (status === "In Progress") return { background: bone, color: "var(--gold-dim)", border: `1px solid ${brass}` };
    return { background: bone, color: "var(--gold-dim)", border: `1px solid ${fog}` };
  };

  return (
    <div
      className="dashboard-root"
      style={{ minHeight: "100vh", background: bone, color: ink, fontFamily: BODY_FONT, padding: "84px 20px 40px" }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Welcome */}
        <header style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: brass, fontWeight: 600, marginBottom: 8 }}>
            Meridian Collective
          </p>
          <h1 style={{
            fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 6vw, 52px)", fontWeight: 500,
            lineHeight: 1.05, color: obsidian, letterSpacing: "-0.5px", marginBottom: 6,
          }}>
            Welcome back, {firstName}
          </h1>
          <p style={{ color: ink, opacity: 0.62, fontSize: 14 }}>
            Your operating hub for the collective.
          </p>
        </header>

        {/* ACTION ITEMS — top of fold, the most important thing */}
        <section style={{ marginBottom: 28 }}>
          <SectionHeader
            title="Your action items"
            subtitle={myItems.length > 0 ? "Items waiting on you." : "Everything assigned to you is complete."}
            cta={{ label: "View all", onClick: () => router.push("/actions") }}
          />
          <div className="dash-action-grid">
            {!loaded && <SkeletonCard />}
            {loaded && myItems.length === 0 && (
              <div style={{
                gridColumn: "1 / -1",
                background: "var(--surface)",
                border: `1px solid ${fog}`,
                borderRadius: 12,
                padding: "18px 20px",
                fontSize: 14,
                color: ink,
                opacity: 0.7,
              }}>
                Nothing assigned to you right now. Check the Actions page for the full backlog.
              </div>
            )}
            {myItems.map(item => {
              const due = formatDueDate(item.due_date);
              return (
                <article key={item.id} style={{
                  background: "var(--surface)",
                  border: `1px solid ${fog}`,
                  borderLeft: `3px solid ${brass}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: obsidian, lineHeight: 1.3 }}>
                      {item.title}
                    </p>
                    {item.status === "in-progress" && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase",
                        padding: "2px 8px", borderRadius: 999, color: brass, border: `1px solid ${brass}`, whiteSpace: "nowrap",
                      }}>
                        In Progress
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p style={{ fontSize: 13, color: ink, opacity: 0.72, lineHeight: 1.5 }}>{item.description}</p>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: ink, opacity: 0.65 }}>
                      <span>{item.assigned_to}</span>
                      {due && <span>Due {due}</span>}
                    </div>
                    <button
                      onClick={() => handleMarkDone(item)}
                      style={{
                        background: "transparent", color: brass,
                        border: `1px solid ${brass}`, borderRadius: 6,
                        padding: "6px 12px", fontSize: 11, fontWeight: 600,
                        letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                      }}
                    >
                      Mark done
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* NEXT MEETING + QUICK LINKS row */}
        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 28 }} className="dash-second-row">
          <article style={{
            background: obsidian, color: bone, borderRadius: 16, padding: "22px 24px",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div>
              <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: brass, fontWeight: 600, marginBottom: 8 }}>
                Next meeting
              </p>
              <h2 style={{
                fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 500, color: bone,
                lineHeight: 1.1, marginBottom: 4,
              }}>
                {formatMeetingDate(nextMeeting?.meeting_date ?? null) ?? "Monday"}
              </h2>
              <p style={{ fontSize: 14, color: fog }}>
                {nextMeeting?.meeting_time ?? "7:15 PM ET"}
              </p>
            </div>
            {nextMeeting?.agenda && (
              <div>
                <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: fog, fontWeight: 600, marginBottom: 6 }}>
                  Agenda
                </p>
                <pre style={{
                  fontFamily: BODY_FONT, fontSize: 13, color: bone, opacity: 0.88,
                  whiteSpace: "pre-wrap", lineHeight: 1.55, margin: 0,
                }}>
                  {nextMeeting.agenda}
                </pre>
              </div>
            )}
            <button
              onClick={() => router.push("/meetings")}
              style={{
                marginTop: "auto", alignSelf: "flex-start",
                background: brass, color: obsidian, border: "none", borderRadius: 8,
                padding: "10px 14px", fontSize: 11, fontWeight: 600,
                letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
              }}
            >
              Meeting hub
            </button>
          </article>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: brass, fontWeight: 600 }}>
              Quick links
            </p>
            {QUICK_LINKS.map(link => {
              const onClick = () => {
                if (link.external) window.open(link.href, "_blank", "noopener");
                else router.push(link.href);
              };
              return (
                <button
                  key={link.title}
                  onClick={onClick}
                  style={{
                    background: "var(--surface)", color: ink,
                    border: `1px solid ${fog}`, borderRadius: 12,
                    padding: "14px 16px", textAlign: "left", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                    transition: "border-color 0.15s",
                    fontFamily: BODY_FONT,
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = brass; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = fog; }}
                >
                  <div>
                    <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: brass, fontWeight: 600, marginBottom: 4 }}>
                      {link.eyebrow}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 500, color: obsidian }}>{link.title}</p>
                  </div>
                  <span style={{ color: brass, fontSize: 18, lineHeight: 1 }}>{link.external ? "↗" : "→"}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* COMPACT SURVEY CARDS */}
        <section style={{ marginBottom: 32 }}>
          <SectionHeader
            title="Surveys"
            subtitle="Pick up where you left off."
            cta={{ label: "All surveys", onClick: () => router.push("/surveys") }}
          />
          <div className="dash-survey-grid-compact">
            {progress.length === 0 && loaded && (
              <p style={{ color: ink, opacity: 0.6, fontSize: 14 }}>No surveys available.</p>
            )}
            {progress.map(p => {
              const pct = p.total > 0 ? Math.round((p.answered / p.total) * 100) : 0;
              const ctaLabel = p.status === "Completed" ? "View results" : p.status === "In Progress" ? "Continue" : "Start";
              const ctaHref = p.status === "Completed" ? `/results/${p.surveyId}` : `/survey/${p.surveyId}`;
              return (
                <article
                  key={p.surveyId}
                  onClick={() => router.push(ctaHref)}
                  style={{
                    background: bone,
                    color: ink,
                    border: `1px solid ${fog}`,
                    borderRadius: 12,
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = brass; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = fog; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <h3 style={{
                      fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: 500, lineHeight: 1.2, color: obsidian,
                    }}>
                      {p.title}
                    </h3>
                    <span style={{
                      ...statusStyle(p.status),
                      fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase",
                      padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap",
                    }}>
                      {p.status}
                    </span>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: ink, opacity: 0.72 }}>
                      <span>{p.answered} / {p.total}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: fog, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: brass, transition: "width 0.3s" }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: brass, fontWeight: 600 }}>{ctaLabel} →</span>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <style jsx>{`
        .dash-action-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
        }
        .dash-survey-grid-compact {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        @media (max-width: 767px) {
          .dashboard-root { padding-top: 28px !important; }
          .dash-second-row { grid-template-columns: 1fr !important; }
          .dash-action-grid { grid-template-columns: 1fr; }
          .dash-survey-grid-compact { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ title, subtitle, cta }: {
  title: string;
  subtitle?: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 500, color: COLORS.obsidian, marginBottom: 2 }}>
          {title}
        </h2>
        {subtitle && <p style={{ fontSize: 13, color: COLORS.ink, opacity: 0.6 }}>{subtitle}</p>}
      </div>
      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            background: "transparent", color: COLORS.brass,
            border: "none", padding: "4px 0", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
            fontFamily: BODY_FONT,
          }}
        >
          {cta.label} →
        </button>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      background: "var(--surface)", border: `1px solid ${COLORS.fog}`, borderRadius: 12,
      padding: "14px 16px", height: 92, opacity: 0.5,
    }} />
  );
}
