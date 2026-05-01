"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllSurveys } from "@/data/surveys";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";
import { migrateLocalStorage, getStorageKey } from "@/lib/migration";

type SurveyProgress = {
  surveyId: string;
  title: string;
  description: string;
  answered: number;
  total: number;
  status: "Completed" | "In Progress" | "Not Started";
};

type QuickStats = {
  surveysCompleted: number;
  memberSince: string | null;
  groupCompletionPct: number;
};

const DISPLAY_FONT = "var(--font-display)";
const BODY_FONT = "var(--font-body)";

// Brand palette tokens — defined in globals.css as :root variables
const COLORS = {
  obsidian: "var(--obsidian)",
  brass: "var(--brass)",
  bone: "var(--bone)",
  fog: "var(--fog)",
  ink: "var(--ink)",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [progress, setProgress] = useState<SurveyProgress[]>([]);
  const [stats, setStats] = useState<QuickStats>({
    surveysCompleted: 0,
    memberSince: null,
    groupCompletionPct: 0,
  });
  const [loaded, setLoaded] = useState(false);

  const surveys = getAllSurveys();

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) {
      router.push("/");
      return;
    }
    setUser(u);
    migrateLocalStorage(u);

    const totalsBySurvey: Record<string, number> = {};
    for (const s of surveys) {
      totalsBySurvey[s.id] = s.categories.reduce((sum, c) => sum + c.questions.length, 0);
    }
    const grandTotal = Object.values(totalsBySurvey).reduce((a, b) => a + b, 0);

    const buildProgressFromCounts = (
      counts: Record<string, Record<string, number>>,
      memberSince: string | null,
    ) => {
      const myProgress: SurveyProgress[] = surveys.map(s => {
        const total = totalsBySurvey[s.id];
        const answered = counts[s.id]?.[u] || 0;
        let status: SurveyProgress["status"] = "Not Started";
        if (answered >= total && total > 0) status = "Completed";
        else if (answered > 0) status = "In Progress";
        return { surveyId: s.id, title: s.title, description: s.description, answered, total, status };
      });

      const surveysCompleted = myProgress.filter(p => p.status === "Completed").length;

      let groupAnswered = 0;
      for (const s of surveys) {
        const perMember = counts[s.id] || {};
        for (const m of MEMBERS) groupAnswered += perMember[m] || 0;
      }
      const groupTotal = grandTotal * MEMBERS.length;
      const groupCompletionPct = groupTotal > 0 ? Math.round((groupAnswered / groupTotal) * 100) : 0;

      setProgress(myProgress);
      setStats({ surveysCompleted, memberSince, groupCompletionPct });
      setLoaded(true);
    };

    if (!supabase) {
      // Fallback: derive from localStorage only
      const counts: Record<string, Record<string, number>> = {};
      for (const s of surveys) {
        counts[s.id] = {};
        const raw = localStorage.getItem(getStorageKey(s.id, u));
        if (!raw) continue;
        try {
          const data = JSON.parse(raw) as Record<string, unknown>;
          const answered = Object.values(data).filter(v => {
            if (Array.isArray(v)) return v.length > 0;
            return typeof v === "string" && v.trim() !== "";
          }).length;
          counts[s.id][u] = answered;
        } catch {
          /* ignore */
        }
      }
      buildProgressFromCounts(counts, null);
      return;
    }

    // Pull responses, last_login, and earliest response (for member-since)
    console.log("[dashboard] Logged-in user (meridian_user):", JSON.stringify(u));
    Promise.all([
      supabase.from("meridian_responses").select("member_name, survey_id, created_at"),
      supabase.from("meridian_members").select("name, last_login").eq("name", u).maybeSingle(),
    ]).then(([respRes, memberRes]) => {
      if (respRes.error) {
        console.error("[dashboard] meridian_responses query error:", respRes.error);
      }
      const rows = respRes.data || [];
      console.log(`[dashboard] meridian_responses returned ${rows.length} rows`);
      if (rows.length > 0) {
        console.log("[dashboard] distinct member_name values in DB:",
          Array.from(new Set(rows.map(r => r.member_name))));
        console.log("[dashboard] distinct survey_id values in DB:",
          Array.from(new Set(rows.map(r => r.survey_id || "operating-agreement"))));
      }

      // Match member_name case-insensitively + trimmed against the canonical
      // MEMBERS list. Any historic row saved with stray whitespace, mixed
      // case, or first-name-only spelling still resolves to the canonical
      // entry — without this, every card silently zeroed for the affected
      // user even though their answers were sitting in the table.
      const normalize = (raw: string | null | undefined): string => {
        const trimmed = (raw ?? "").trim();
        const match = MEMBERS.find(m => m.toLowerCase() === trimmed.toLowerCase());
        return match ?? trimmed;
      };

      const counts: Record<string, Record<string, number>> = {};
      let earliest: string | null = null;
      for (const row of rows) {
        const sid = row.survey_id || "operating-agreement";
        const canonical = normalize(row.member_name);
        if (!counts[sid]) counts[sid] = {};
        counts[sid][canonical] = (counts[sid][canonical] || 0) + 1;
        if (canonical === u && row.created_at) {
          if (!earliest || row.created_at < earliest) earliest = row.created_at;
        }
      }
      console.log(`[dashboard] count for "${u}" by survey:`,
        Object.fromEntries(surveys.map(s => [s.id, counts[s.id]?.[u] ?? 0])));

      const ll = memberRes.data?.last_login || null;
      setLastLogin(ll);

      // member-since: earliest response date if we have one, otherwise last_login as a soft fallback
      const memberSince = earliest || ll;
      buildProgressFromCounts(counts, memberSince);
    });
  }, [router, surveys]);

  if (!user) return null;

  const firstName = user.split(" ")[0];

  const { obsidian, brass, bone, fog, ink } = COLORS;

  const statusStyle = (status: SurveyProgress["status"]) => {
    if (status === "Completed") {
      // Solid brass pill on a light card pops without overpowering it.
      return { background: brass, color: obsidian, border: `1px solid ${brass}` };
    }
    if (status === "In Progress") {
      return { background: bone, color: "var(--gold-dim)", border: `1px solid ${brass}` };
    }
    // Not Started — quiet brass-on-bone with a Fog border.
    return { background: bone, color: "var(--gold-dim)", border: `1px solid ${fog}` };
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bone,
        color: ink,
        fontFamily: BODY_FONT,
        padding: "84px 20px 40px",
      }}
      className="dashboard-root"
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Welcome header */}
        <header style={{ marginBottom: 32 }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: brass,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Meridian Collective
          </p>
          <h1
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(36px, 6vw, 56px)",
              fontWeight: 500,
              lineHeight: 1.05,
              color: obsidian,
              letterSpacing: "-0.5px",
              marginBottom: 12,
            }}
          >
            Welcome back, {firstName}
          </h1>
          <p style={{ color: ink, opacity: 0.65, fontSize: 14 }}>
            Last sign-in: <span style={{ color: ink, opacity: 0.85 }}>{formatDateTime(lastLogin)}</span>
          </p>
        </header>

        {/* Quick stats */}
        <section
          style={{
            background: obsidian,
            color: bone,
            borderRadius: 16,
            padding: "20px 24px",
            marginBottom: 32,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 20,
          }}
        >
          <StatCell
            label="Surveys completed"
            value={loaded ? `${stats.surveysCompleted} / ${surveys.length}` : "—"}
            accent={brass}
            valueColor={bone}
            labelColor={fog}
          />
          <StatCell
            label="Member since"
            value={loaded ? formatDate(stats.memberSince) : "—"}
            accent={brass}
            valueColor={bone}
            labelColor={fog}
          />
          <StatCell
            label="Group completion"
            value={loaded ? `${stats.groupCompletionPct}%` : "—"}
            accent={brass}
            valueColor={bone}
            labelColor={fog}
          />
        </section>

        {/* Surveys section */}
        <section style={{ marginBottom: 32 }}>
          <SectionHeader title="Your surveys" subtitle="Pick up where you left off." />
          <div className="dash-survey-grid">
            {progress.length === 0 && loaded && (
              <p style={{ color: ink, opacity: 0.6, fontSize: 14 }}>No surveys available.</p>
            )}
            {progress.map(p => {
              const pct = p.total > 0 ? Math.round((p.answered / p.total) * 100) : 0;
              const ctaLabel =
                p.status === "Completed"
                  ? "View results"
                  : p.status === "In Progress"
                    ? "Continue"
                    : "Start";
              const ctaHref =
                p.status === "Completed"
                  ? `/results/${p.surveyId}`
                  : `/survey/${p.surveyId}`;
              return (
                <article
                  key={p.surveyId}
                  style={{
                    background: bone,
                    color: ink,
                    border: `1px solid ${fog}`,
                    borderRadius: 16,
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    boxShadow: "0 1px 2px rgba(20,17,13,0.04)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <h3
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: 24,
                        fontWeight: 500,
                        lineHeight: 1.15,
                        color: obsidian,
                      }}
                    >
                      {p.title}
                    </h3>
                    <span
                      style={{
                        ...statusStyle(p.status),
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        padding: "4px 10px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.status}
                    </span>
                  </div>

                  <p style={{ color: ink, fontSize: 14, lineHeight: 1.55, opacity: 0.78 }}>
                    {p.description}
                  </p>

                  <div>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      marginBottom: 8, fontSize: 12, color: ink, opacity: 0.72,
                      fontWeight: 500,
                    }}>
                      <span>{p.answered} / {p.total} answered</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: fog, borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: brass,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(ctaHref)}
                    style={{
                      background: brass,
                      color: obsidian,
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: 0.3,
                      cursor: "pointer",
                      transition: "background 0.15s",
                      fontFamily: BODY_FONT,
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = "var(--gold-dim)"; }}
                    onMouseOut={e => { e.currentTarget.style.background = brass; }}
                  >
                    {ctaLabel}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* Announcements */}
        <section>
          <SectionHeader title="Announcements" subtitle="Updates from the collective." />
          <div
            style={{
              background: "transparent",
              border: `1px dashed ${fog}`,
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
              color: ink,
              opacity: 0.55,
            }}
          >
            <p style={{ fontFamily: DISPLAY_FONT, fontSize: 22, marginBottom: 4, fontStyle: "italic" }}>
              No announcements
            </p>
            <p style={{ fontSize: 13 }}>
              New tiebreaker surveys, meeting reminders, and partnership updates will land here.
            </p>
          </div>
        </section>
      </div>

      <style jsx>{`
        .dash-survey-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }
        @media (max-width: 767px) {
          .dashboard-root {
            padding-top: 28px !important;
          }
          .dash-survey-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 28,
          fontWeight: 500,
          color: COLORS.obsidian,
          marginBottom: 4,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: COLORS.ink, opacity: 0.6 }}>{subtitle}</p>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
  valueColor,
  labelColor,
}: {
  label: string;
  value: string;
  accent: string;
  valueColor: string;
  labelColor: string;
}) {
  return (
    <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 14 }}>
      <p
        style={{
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: labelColor,
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 28,
          fontWeight: 500,
          color: valueColor,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
    </div>
  );
}
