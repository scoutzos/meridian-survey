"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { getAllSurveys } from "@/data/surveys";
import { supabase } from "@/lib/supabase";
import type { MemberProfile } from "@/lib/tracker";

const DISPLAY_FONT = "var(--font-display)";

interface MemberRow {
  name: string;
  llc_name: string | null;
  is_admin: boolean;
  responsesBySurvey: Record<string, number>;
}

export default function MembersPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const surveys = getAllSurveys();
  const totalsBySurvey: Record<string, number> = {};
  for (const s of surveys) {
    totalsBySurvey[s.id] = s.categories.reduce((sum, c) => sum + c.questions.length, 0);
  }

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);

    const seed: MemberRow[] = MEMBERS.map(m => ({
      name: m, llc_name: null, is_admin: false, responsesBySurvey: {},
    }));

    if (!supabase) {
      setRows(seed);
      setLoading(false);
      return;
    }

    Promise.all([
      supabase.from("tracker_member_profiles").select("*"),
      supabase.from("meridian_responses").select("member_name, survey_id"),
    ]).then(([prof, resp]) => {
      const profiles = (prof.data as MemberProfile[] | null) ?? [];
      const counts: Record<string, Record<string, number>> = {};
      for (const r of resp.data ?? []) {
        const sid = r.survey_id || "operating-agreement";
        if (!counts[r.member_name]) counts[r.member_name] = {};
        counts[r.member_name][sid] = (counts[r.member_name][sid] || 0) + 1;
      }
      const next: MemberRow[] = MEMBERS.map(m => {
        const p = profiles.find(x => x.member_name === m);
        return {
          name: m,
          llc_name: p?.llc_name ?? null,
          is_admin: !!p?.is_admin,
          responsesBySurvey: counts[m] ?? {},
        };
      });
      setRows(next);
      setLoading(false);
    });
  }, [router, surveys]);

  if (!user) return null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "84px 20px 100px" }} className="members-root">
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600, marginBottom: 8 }}>
          The Collective
        </p>
        <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: "clamp(34px, 5vw, 48px)", fontWeight: 500, color: "var(--obsidian)", letterSpacing: "-0.5px", marginBottom: 6 }}>
          Member directory
        </h1>
        <p style={{ color: "var(--ink)", opacity: 0.65, fontSize: 14 }}>
          Six founding members. LLC names per the operating agreement working draft.
        </p>
      </header>

      {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>}

      <div className="members-grid">
        {rows.map(m => {
          const isMe = m.name === user;
          const completion: Array<{ id: string; title: string; pct: number }> = surveys.map(s => {
            const total = totalsBySurvey[s.id] || 0;
            const answered = m.responsesBySurvey[s.id] || 0;
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
            return { id: s.id, title: s.title, pct };
          });
          return (
            <article
              key={m.name}
              style={{
                background: "var(--surface)",
                border: `1px solid ${isMe ? "var(--brass)" : "var(--fog)"}`,
                borderRadius: 14,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 500, color: "var(--obsidian)" }}>
                    {m.name}
                  </h2>
                  {isMe && (
                    <span style={{
                      fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
                      color: "var(--brass)", fontWeight: 700,
                      padding: "2px 8px", borderRadius: 999, border: "1px solid var(--brass)",
                    }}>You</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "var(--ink)", opacity: 0.7 }}>
                  {m.llc_name ?? "LLC pending"}
                </p>
                {m.is_admin && (
                  <p style={{ fontSize: 11, color: "var(--brass)", fontWeight: 600, marginTop: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Managing Member
                  </p>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--brass)", fontWeight: 600 }}>
                  Survey progress
                </p>
                {completion.map(c => (
                  <div key={c.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink)", opacity: 0.78, marginBottom: 3 }}>
                      <span>{c.title}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.pct}%</span>
                    </div>
                    <div style={{ height: 4, background: "var(--fog)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${c.pct}%`, background: "var(--brass)", transition: "width 0.3s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <style jsx>{`
        .members-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        @media (max-width: 600px) {
          .members-root { padding-top: 28px !important; }
          .members-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
