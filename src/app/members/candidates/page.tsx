"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MEMBERS } from "@/data/questions";
import {
  fetchMembershipCandidates,
  fetchMembershipCandidateVotes,
  formatCandidateMoney,
  voteLabel,
  voteOnMembershipCandidate,
  type CandidateVoteDecision,
  type MembershipCandidate,
  type MembershipCandidateVote,
} from "@/lib/membership-candidates";

const voteOptions: CandidateVoteDecision[] = ["approve", "discuss", "hold", "decline"];

const candidateQuestions = {
  join_as: "Are you seeking to join as an individual or through your own LLC?",
  max_deal_contribution: "Most you could contribute to a single deal, between cash and credit",
  cash_available: "How much of that is cash?",
  credit_available: "How much is available credit?",
  deal_readiness: "If the group found a deal tomorrow, how quickly could you have your contribution ready?",
  credit_pull_comfort: "Are you comfortable with a lender pulling your credit if required for financing?",
  participation: "Are you committed to actively participating in Meridian business?",
  table_contribution: "What else do you bring to the table besides money?",
  relationships: "Do you have relationships or resources that could help Meridian find, fund, renovate, manage, or sell deals?",
  first_90_days: "What would you be able to contribute in your first 90 days?",
  support_requested: "What support would you be looking for from Meridian Collective?",
  member_notes: "Is there anything current members should know before voting on your membership?",
};

export default function CandidateReviewsPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 20px 100px" }}>Loading candidates...</main>}>
      <CandidateReviewsContent />
    </Suspense>
  );
}

function CandidateReviewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("candidate");
  const [user, setUser] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MembershipCandidate[]>([]);
  const [votes, setVotes] = useState<MembershipCandidateVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [candidateRows, voteRows] = await Promise.all([
      fetchMembershipCandidates(),
      fetchMembershipCandidateVotes(),
    ]);
    setCandidates(candidateRows);
    setVotes(voteRows);
    setLoading(false);
  }

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
  }, [router]);

  const selectedCandidate = useMemo(() => {
    if (selectedId) return candidates.find(candidate => candidate.id === selectedId) ?? candidates[0] ?? null;
    return candidates.find(candidate => candidate.status === "under_review") ?? candidates[0] ?? null;
  }, [candidates, selectedId]);

  const candidateVotes = useMemo(() => {
    if (!selectedCandidate) return [];
    return votes.filter(vote => vote.candidate_id === selectedCandidate.id);
  }, [votes, selectedCandidate]);

  const myVote = user ? candidateVotes.find(vote => vote.member_name === user) : undefined;

  useEffect(() => {
    setNote(myVote?.note ?? "");
  }, [myVote?.id, myVote?.note]);

  if (!user) return null;

  async function castVote(decision: CandidateVoteDecision) {
    if (!selectedCandidate || !user) return;
    setSaving(true);
    setError("");
    const result = await voteOnMembershipCandidate(selectedCandidate.id, user, decision, note);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    await load();
  }

  const counts = voteOptions.reduce<Record<CandidateVoteDecision, number>>((acc, decision) => {
    acc[decision] = candidateVotes.filter(vote => vote.decision === decision).length;
    return acc;
  }, { approve: 0, discuss: 0, hold: 0, decline: 0 });

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 20px 100px" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <p style={eyebrow}>Member Portal</p>
          <h1 style={heading}>New Member Reviews</h1>
          <p style={muted}>Review potential members, compare what they can bring, and submit your vote.</p>
        </div>
        <button onClick={() => router.push("/members")} style={buttonGhost}>Back to Portal</button>
      </header>

      {loading && <p style={muted}>Loading candidates...</p>}

      {!loading && candidates.length === 0 && (
        <section style={emptyCard}>
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>No applicants yet</h2>
          <p style={muted}>When someone submits the membership review form, they will show up here for member voting.</p>
          <button onClick={() => router.push("/apply")} style={{ ...buttonPrimary, marginTop: 16 }}>
            Open Application Form
          </button>
        </section>
      )}

      {selectedCandidate && (
        <div className="candidate-layout">
          <aside style={sideCard}>
            <p style={sideTitle}>Applicants</p>
            {candidates.map(candidate => {
              const applicantVotes = votes.filter(vote => vote.candidate_id === candidate.id);
              const voted = applicantVotes.some(vote => vote.member_name === user);
              const active = candidate.id === selectedCandidate.id;
              return (
                <button
                  key={candidate.id}
                  onClick={() => router.push(`/members/candidates?candidate=${candidate.id}`)}
                  style={{
                    ...candidateButton,
                    borderColor: active ? "var(--brass)" : "var(--fog)",
                    background: active ? "rgba(201,168,120,0.12)" : "var(--bone)",
                  }}
                >
                  <strong>{candidate.full_name}</strong>
                  <span>{applicantVotes.length}/{MEMBERS.length} votes · {voted ? "you voted" : "needs your vote"}</span>
                </button>
              );
            })}
          </aside>

          <section style={mainCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
              <div>
                <p style={eyebrow}>Applicant</p>
                <h2 style={{ ...heading, fontSize: "clamp(30px, 5vw, 46px)" }}>{selectedCandidate.full_name}</h2>
                <p style={muted}>
                  Submitted {new Date(selectedCandidate.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div style={voteSummary}>
                <strong>{candidateVotes.length}/{MEMBERS.length}</strong>
                <span>member votes</span>
              </div>
            </div>

            <div className="candidate-stats">
              <Stat label="Join as" question={candidateQuestions.join_as} value={selectedCandidate.join_as} />
              <Stat label="Max deal contribution" question={candidateQuestions.max_deal_contribution} value={formatCandidateMoney(selectedCandidate.max_deal_contribution)} />
              <Stat label="Cash available" question={candidateQuestions.cash_available} value={formatCandidateMoney(selectedCandidate.cash_available)} />
              <Stat label="Credit available" question={candidateQuestions.credit_available} value={formatCandidateMoney(selectedCandidate.credit_available)} />
              <Stat label="Deal readiness" question={candidateQuestions.deal_readiness} value={selectedCandidate.deal_readiness || "Not provided"} />
              <Stat label="Credit pull" question={candidateQuestions.credit_pull_comfort} value={selectedCandidate.credit_pull_comfort || "Not provided"} />
            </div>

            {selectedCandidate.join_as === "Through my LLC" && (
              <div style={detailBand}>
                <Detail label="Entity" value={selectedCandidate.entity_name || "Not provided"} />
                <Detail label="State" value={selectedCandidate.entity_state || "Not provided"} />
                <Detail label="Title" value={selectedCandidate.entity_title || "Not provided"} />
              </div>
            )}

            <div className="review-grid">
              <ReviewBlock title="Participation" question={candidateQuestions.participation} value={selectedCandidate.participation} />
              <ReviewBlock title="What They Bring Besides Money" question={candidateQuestions.table_contribution} value={selectedCandidate.table_contribution} />
              <ReviewBlock title="Relationships & Resources" question={candidateQuestions.relationships} value={selectedCandidate.relationships} />
              <ReviewBlock title="First 90 Days" question={candidateQuestions.first_90_days} value={selectedCandidate.first_90_days} />
              <ReviewBlock title="Support Requested" question={candidateQuestions.support_requested} value={selectedCandidate.support_requested} />
              <ReviewBlock title="Notes For Members" question={candidateQuestions.member_notes} value={selectedCandidate.member_notes} />
            </div>

            <section style={votePanel}>
              <div>
                <p style={eyebrow}>Your Vote</p>
                <h3 style={{ fontSize: 18, marginBottom: 6 }}>{myVote ? `Current vote: ${voteLabel(myVote.decision)}` : "Submit your review"}</h3>
                <p style={muted}>Your vote is recorded under your member name and can be updated while review is open.</p>
              </div>
              {error && <div style={errorBox}>{error}</div>}
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional note for the group"
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {voteOptions.map(decision => (
                  <button key={decision} disabled={saving} onClick={() => castVote(decision)} style={decision === "approve" ? buttonPrimary : buttonGhost}>
                    {saving ? "Saving..." : voteLabel(decision)}
                  </button>
                ))}
              </div>
            </section>

            <section style={resultsPanel}>
              <p style={eyebrow}>Vote Results</p>
              <div className="vote-counts">
                {voteOptions.map(decision => <Stat key={decision} label={voteLabel(decision)} value={String(counts[decision])} />)}
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                {MEMBERS.map(member => {
                  const vote = candidateVotes.find(v => v.member_name === member);
                  return (
                    <div key={member} style={voteRow}>
                      <strong>{member}</strong>
                      <span>{vote ? voteLabel(vote.decision) : "Not voted"}</span>
                      <em>{vote?.note || ""}</em>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>
        </div>
      )}

      <style jsx>{`
        .candidate-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 18px;
          align-items: start;
        }
        .candidate-stats,
        .vote-counts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .review-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
        }
        @media (max-width: 820px) {
          .candidate-layout { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value, question }: { label: string; value: string; question?: string }) {
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--fog)", borderRadius: 8, padding: 14 }}>
      <p style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass)", marginBottom: 6 }}>{label}</p>
      {question && <p style={{ color: "var(--ink)", opacity: 0.54, fontSize: 11, lineHeight: 1.45, marginBottom: 8 }}>{question}</p>}
      <strong style={{ fontSize: 15, color: "var(--obsidian)", lineHeight: 1.35 }}>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <span><strong>{label}:</strong> {value}</span>;
}

function ReviewBlock({ title, question, value }: { title: string; question: string; value: string | null }) {
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--fog)", borderRadius: 8, padding: 16 }}>
      <h3 style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--obsidian)", marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "var(--ink)", opacity: 0.56, lineHeight: 1.5, fontSize: 12, marginBottom: 10 }}>{question}</p>
      <p style={{ color: "var(--ink)", opacity: 0.72, lineHeight: 1.6, fontSize: 13, whiteSpace: "pre-wrap" }}>{value || "Not provided"}</p>
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--brass)",
  marginBottom: 8,
};

const heading: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(34px, 5vw, 52px)",
  fontWeight: 500,
  lineHeight: 1.03,
  color: "var(--obsidian)",
};

const muted: React.CSSProperties = {
  color: "var(--ink)",
  opacity: 0.65,
  fontSize: 14,
  lineHeight: 1.55,
};

const sideCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 10,
};

const sideTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--obsidian)",
  marginBottom: 4,
};

const candidateButton: React.CSSProperties = {
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 12,
  textAlign: "left",
  display: "grid",
  gap: 4,
  cursor: "pointer",
  color: "var(--ink)",
};

const mainCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 22,
};

const emptyCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 26,
};

const voteSummary: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  borderRadius: 8,
  padding: "14px 18px",
  minWidth: 150,
  display: "grid",
  gap: 2,
  alignContent: "center",
};

const detailBand: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 14,
  background: "rgba(201,168,120,0.12)",
  border: "1px solid rgba(201,168,120,0.25)",
  borderRadius: 8,
  padding: 14,
  marginBottom: 18,
  fontSize: 13,
};

const votePanel: React.CSSProperties = {
  marginTop: 18,
  background: "rgba(12,15,13,0.04)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 16,
  display: "grid",
  gap: 12,
};

const resultsPanel: React.CSSProperties = {
  marginTop: 18,
  borderTop: "1px solid var(--fog)",
  paddingTop: 18,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--fog)",
  borderRadius: 6,
  background: "#fffaf0",
  color: "var(--ink)",
  padding: "12px",
  fontSize: 14,
  fontFamily: "var(--font-body)",
};

const buttonPrimary: React.CSSProperties = {
  background: "var(--obsidian)",
  color: "var(--bone)",
  border: "none",
  borderRadius: 6,
  padding: "12px 14px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const buttonGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--obsidian)",
  border: "1px solid var(--brass)",
  borderRadius: 6,
  padding: "12px 14px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const voteRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "150px 90px 1fr",
  gap: 10,
  alignItems: "start",
  background: "var(--surface2)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 10,
  fontSize: 12,
};

const errorBox: React.CSSProperties = {
  background: "rgba(122,41,53,0.08)",
  border: "1px solid rgba(122,41,53,0.35)",
  color: "#7a2935",
  borderRadius: 6,
  padding: 12,
  fontSize: 13,
};
