"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import { supabase } from "@/lib/supabase";

const SURVEY_ID = "branding";
const RANK_PTS = [3, 2, 1];

const LOGOS = [
  { id: "01", key: "01 The Meridian", name: "The Meridian", sub: "Architectural · Literal" },
  { id: "02", key: "02 M° The Monogram", name: "M° The Monogram", sub: "Typographic · Minimal" },
  { id: "03", key: "03 The Coordinate", name: "The Coordinate", sub: "Geometric · Navigational" },
  { id: "04", key: "04 The Seal", name: "The Seal", sub: "Classical · Institutional" },
  { id: "05", key: "05 The Wordmark", name: "The Wordmark", sub: "Pure Typographic · Editorial" },
  { id: "06", key: "06 The Globe", name: "The Globe", sub: "Ornamental · Sovereign" },
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

type VoterEntry = { member: string; rank: number };
type RankedResult<T> = T & { points: number; voters: VoterEntry[] };

function calcRankedPoints<T extends { key: string }>(
  allAnswers: Record<string, Record<string, string[] | string>>,
  qId: string,
  items: T[]
): RankedResult<T>[] {
  const pointMap: Record<string, number> = {};
  const voterMap: Record<string, VoterEntry[]> = {};
  for (const item of items) { pointMap[item.key] = 0; voterMap[item.key] = []; }

  for (const member of MEMBERS) {
    const val = allAnswers[member]?.[qId];
    const ranked: string[] = Array.isArray(val) ? val : [];
    ranked.forEach((key, idx) => {
      if (!key || pointMap[key] === undefined) return;
      pointMap[key] += RANK_PTS[idx] || 0;
      voterMap[key].push({ member, rank: idx + 1 });
    });
  }

  return items
    .map(item => ({ ...item, points: pointMap[item.key], voters: voterMap[item.key] }))
    .sort((a, b) => b.points - a.points);
}

const rankLabel = (r: number) => r === 1 ? "1st" : r === 2 ? "2nd" : "3rd";
const MAX_POSSIBLE = MEMBERS.length * 3;

export default function BrandingResultsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [allAnswers, setAllAnswers] = useState<Record<string, Record<string, string[] | string>>>({});
  const [activeView, setActiveView] = useState<"logos" | "palettes" | "members">("logos");

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    if (!supabase) return;
    supabase.from("meridian_responses").select("member_name, question_id, answer")
      .eq("survey_id", SURVEY_ID)
      .then(({ data: rows }) => {
        const data: Record<string, Record<string, string[] | string>> = {};
        for (const row of rows || []) {
          if (!data[row.member_name]) data[row.member_name] = {};
          try { data[row.member_name][row.question_id] = JSON.parse(row.answer); }
          catch { data[row.member_name][row.question_id] = row.answer; }
        }
        setAllAnswers(data);
      });
  }, [router]);

  if (!user) return null;

  const membersWithData = MEMBERS.filter(m => allAnswers[m]);
  const logoResults = calcRankedPoints(allAnswers, "branding-logo-rank", LOGOS);
  const paletteResults = calcRankedPoints(allAnswers, "branding-palette-rank", PALETTES);
  const logoLeader = logoResults[0]?.points > 0 ? logoResults[0] : null;
  const paletteLeader = paletteResults[0]?.points > 0 ? paletteResults[0] : null;

  const renderLogoResults = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {logoResults.map((logo, idx) => {
        const isLeader = idx === 0 && logo.points > 0;
        const pct = MAX_POSSIBLE > 0 ? (logo.points / MAX_POSSIBLE) * 100 : 0;
        return (
          <div key={logo.key} style={{
            background: isLeader ? "rgba(197,165,114,0.08)" : "var(--surface)",
            border: `1px solid ${isLeader ? "var(--gold)" : "var(--border)"}`,
            borderRadius: 10, padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: logo.voters.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: isLeader ? "var(--gold)" : "var(--muted)", minWidth: 28, textAlign: "right" }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{logo.name}</span>
                  {isLeader && <span style={{ fontSize: 11, background: "var(--gold)", color: "var(--bg)", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>LEADING</span>}
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{logo.sub}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: isLeader ? "var(--gold)" : "var(--fg)" }}>{logo.points}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>pts</div>
              </div>
            </div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: logo.voters.length > 0 ? 10 : 0 }}>
              <div style={{ height: "100%", background: isLeader ? "var(--gold)" : "var(--muted)", borderRadius: 2, width: `${pct}%`, transition: "width 0.3s" }} />
            </div>
            {logo.voters.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {logo.voters.map(v => (
                  <span key={v.member} style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 10,
                    background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)",
                  }}>
                    {v.member.split(" ")[0]} — {rankLabel(v.rank)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderPaletteResults = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {paletteResults.map((palette, idx) => {
        const isLeader = idx === 0 && palette.points > 0;
        const pct = MAX_POSSIBLE > 0 ? (palette.points / MAX_POSSIBLE) * 100 : 0;
        return (
          <div key={palette.key} style={{
            background: isLeader ? "rgba(197,165,114,0.08)" : "var(--surface)",
            border: `1px solid ${isLeader ? "var(--gold)" : "var(--border)"}`,
            borderRadius: 10, padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: palette.voters.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: isLeader ? "var(--gold)" : "var(--muted)", minWidth: 28, textAlign: "right" }}>
                {idx + 1}
              </div>
              <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" }}>
                {palette.colors.map((c, i) => (
                  <div key={i} style={{ width: 24, height: 44, background: c }} />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{palette.name}</span>
                  {isLeader && <span style={{ fontSize: 11, background: "var(--gold)", color: "var(--bg)", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>LEADING</span>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {palette.colors.map((c, i) => (
                    <span key={i} style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>{c}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: isLeader ? "var(--gold)" : "var(--fg)" }}>{palette.points}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>pts</div>
              </div>
            </div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: palette.voters.length > 0 ? 10 : 0 }}>
              <div style={{ height: "100%", background: isLeader ? "var(--gold)" : "var(--muted)", borderRadius: 2, width: `${pct}%` }} />
            </div>
            {palette.voters.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {palette.voters.map(v => (
                  <span key={v.member} style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 10,
                    background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)",
                  }}>
                    {v.member.split(" ")[0]} — {rankLabel(v.rank)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderMemberView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {MEMBERS.map(m => {
        const logoRanked: string[] = Array.isArray(allAnswers[m]?.["branding-logo-rank"]) ? allAnswers[m]["branding-logo-rank"] as string[] : [];
        const paletteRanked: string[] = Array.isArray(allAnswers[m]?.["branding-palette-rank"]) ? allAnswers[m]["branding-palette-rank"] as string[] : [];
        const comments = allAnswers[m]?.["branding-comments"];
        const hasData = !!allAnswers[m];
        return (
          <div key={m} style={{
            background: "var(--surface)", borderRadius: 12, padding: 20,
            border: "1px solid var(--border)", opacity: hasData ? 1 : 0.45,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)", marginBottom: 16 }}>{m}</h3>
            {!hasData ? (
              <p style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>Hasn&apos;t voted yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Logo Votes</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[0, 1, 2].map(i => {
                      const key = logoRanked[i];
                      if (!key) return <span key={i} style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>{rankLabel(i + 1)}: not chosen</span>;
                      const logo = LOGOS.find(l => l.key === key);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>{rankLabel(i + 1)}</span>
                          <span style={{ fontSize: 12 }}>{logo?.name || key}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Palette Votes</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[0, 1, 2].map(i => {
                      const key = paletteRanked[i];
                      if (!key) return <span key={i} style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>{rankLabel(i + 1)}: not chosen</span>;
                      const palette = PALETTES.find(p => p.key === key);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>{rankLabel(i + 1)}</span>
                          {palette && (
                            <div style={{ display: "flex", borderRadius: 2, overflow: "hidden" }}>
                              {palette.colors.map((c, ci) => <div key={ci} style={{ width: 10, height: 16, background: c }} />)}
                            </div>
                          )}
                          <span style={{ fontSize: 12 }}>{palette?.name || key}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {typeof comments === "string" && (comments as string).trim() && (
                  <div>
                    <p style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Comments</p>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fg)", fontStyle: "italic" }}>&ldquo;{comments as string}&rdquo;</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ padding: "72px 20px 80px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Branding Vote</p>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Results</h1>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>{membersWithData.length} of {MEMBERS.length} members have voted</p>
        </div>
        <button onClick={() => router.push("/survey/branding")} style={{
          padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
          background: "transparent", color: "var(--gold)", fontSize: 13, cursor: "pointer",
        }}>
          Cast Vote
        </button>
      </div>

      {/* Leader banner */}
      {(logoLeader || paletteLeader) && (
        <div style={{
          background: "rgba(197,165,114,0.08)", border: "1px solid rgba(197,165,114,0.25)",
          borderRadius: 12, padding: "20px 28px", marginBottom: 28,
          display: "flex", gap: 40, flexWrap: "wrap",
        }}>
          {logoLeader && (
            <div>
              <p style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Leading Logo</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)", marginBottom: 2 }}>{logoLeader.name}</p>
              <p style={{ fontSize: 12, color: "var(--muted)" }}>{logoLeader.points} pts · {logoLeader.sub}</p>
            </div>
          )}
          {paletteLeader && (
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Leading Palette</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)", marginBottom: 2 }}>{paletteLeader.name}</p>
                <p style={{ fontSize: 12, color: "var(--muted)" }}>{paletteLeader.points} pts · {paletteLeader.sub}</p>
              </div>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", marginTop: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
                {paletteLeader.colors.map((c: string, i: number) => (
                  <div key={i} style={{ width: 36, height: 48, background: c }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {membersWithData.length === 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 28 }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No votes yet</p>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Be the first to cast your vote.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        {(["logos", "palettes", "members"] as const).map(view => (
          <button key={view} onClick={() => setActiveView(view)} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border)",
            background: activeView === view ? "var(--gold)" : "transparent",
            color: activeView === view ? "var(--bg)" : "var(--muted)",
            fontWeight: activeView === view ? 600 : 400, cursor: "pointer",
          }}>
            {view === "logos" ? "Logo Rankings" : view === "palettes" ? "Palette Rankings" : "Member Votes"}
          </button>
        ))}
      </div>

      {activeView === "logos" && renderLogoResults()}
      {activeView === "palettes" && renderPaletteResults()}
      {activeView === "members" && renderMemberView()}
    </div>
  );
}
