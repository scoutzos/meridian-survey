"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAllSurveys } from "@/data/surveys";
import {
  admitMembershipCandidate,
  fetchMembershipCandidates,
  fetchMembershipCandidateVotes,
  formatCandidateMoney,
  voteLabel,
  voteOnMembershipCandidate,
  type CandidateVoteDecision,
  type MembershipCandidate,
  type MembershipCandidateVote,
} from "@/lib/membership-candidates";
import { supabase } from "@/lib/supabase";
import { activeTrackerMembers, isAdmin, type MemberProfile } from "@/lib/tracker";

const voteOptions: CandidateVoteDecision[] = ["approve", "discuss", "hold", "decline"];
type CandidateView = "needs-my-vote" | "started" | "my-votes" | "all";

const candidateQuestions = {
  join_as: "Are you seeking to join as an individual or through your own LLC?",
  max_deal_contribution: "Most you could contribute to a single deal, between cash and credit",
  cash_available: "How much of that is cash?",
  credit_available: "How much is available credit?",
  monthly_dues_comfort: "Would you be comfortable paying monthly dues for shared operating costs like VA support, software, call tools, and admin?",
  monthly_dues_max: "If yes, what is the most you would be comfortable paying per month?",
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
  const activeView = (searchParams.get("view") === "started" || searchParams.get("view") === "my-votes" || searchParams.get("view") === "all"
    ? searchParams.get("view")
    : "needs-my-vote") as CandidateView;
  const [user, setUser] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MembershipCandidate[]>([]);
  const [votes, setVotes] = useState<MembershipCandidateVote[]>([]);
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [admissionName, setAdmissionName] = useState("");
  const [admissionPassword, setAdmissionPassword] = useState("meridian2026");
  const [admissionLlcName, setAdmissionLlcName] = useState("");
  const [admissionAdmin, setAdmissionAdmin] = useState(false);
  const [assignedSurveyIds, setAssignedSurveyIds] = useState<string[]>(() => getAllSurveys().map(survey => survey.id));
  const [admitting, setAdmitting] = useState(false);
  const [admissionMessage, setAdmissionMessage] = useState("");

  const surveys = useMemo(() => getAllSurveys(), []);

  async function load() {
    const [candidateRows, voteRows, profileRows] = await Promise.all([
      fetchMembershipCandidates(),
      fetchMembershipCandidateVotes(),
      supabase
        ? supabase.from("tracker_member_profiles").select("*").order("member_name").then(({ data }) => (data as MemberProfile[] | null) ?? [])
        : Promise.resolve([] as MemberProfile[]),
    ]);
    setCandidates(candidateRows);
    setVotes(voteRows);
    setProfiles(profileRows);
    setLoading(false);
  }

  useEffect(() => {
    const u = localStorage.getItem("meridian_user");
    if (!u) { router.push("/"); return; }
    setUser(u);
    void load();
  }, [router]);

  const myVotedCandidateIds = useMemo(() => {
    if (!user) return new Set<string>();
    return new Set(votes.filter(vote => vote.member_name === user).map(vote => vote.candidate_id));
  }, [user, votes]);

  const visibleCandidates = useMemo(() => {
    if (activeView === "my-votes") return candidates.filter(candidate => myVotedCandidateIds.has(candidate.id));
    if (activeView === "started") return candidates.filter(candidate => candidate.status === "started");
    if (activeView === "all") return candidates;
    return candidates.filter(candidate => candidate.status === "under_review" && !myVotedCandidateIds.has(candidate.id));
  }, [activeView, candidates, myVotedCandidateIds]);

  const selectedCandidate = useMemo(() => {
    if (selectedId) return candidates.find(candidate => candidate.id === selectedId) ?? visibleCandidates[0] ?? null;
    return visibleCandidates[0] ?? null;
  }, [candidates, selectedId, visibleCandidates]);

  const candidateVotes = useMemo(() => {
    if (!selectedCandidate) return [];
    return votes.filter(vote => vote.candidate_id === selectedCandidate.id);
  }, [votes, selectedCandidate]);

  const myVote = user ? candidateVotes.find(vote => vote.member_name === user) : undefined;
  const admin = isAdmin(profiles, user);
  const votingMembers = activeTrackerMembers(profiles).map(member => member.name);

  useEffect(() => {
    setNote(myVote?.note ?? "");
  }, [myVote?.id, myVote?.note]);

  useEffect(() => {
    if (!selectedCandidate) return;
    setAdmissionName(candidateDisplayName(selectedCandidate));
    setAdmissionPassword("meridian2026");
    setAdmissionLlcName(
      selectedCandidate.join_as === "Through my LLC"
        ? selectedCandidate.entity_name || candidateDisplayName(selectedCandidate)
        : candidateDisplayName(selectedCandidate),
    );
    setAdmissionAdmin(false);
    setAdmissionMessage("");
  }, [selectedCandidate]);

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

  async function admitCandidate() {
    if (!selectedCandidate || !user) return;
    setAdmitting(true);
    setError("");
    setAdmissionMessage("");
    const result = await admitMembershipCandidate({
      candidateId: selectedCandidate.id,
      memberName: admissionName,
      password: admissionPassword,
      llcName: admissionLlcName,
      isAdmin: admissionAdmin,
      assignedSurveyIds,
      actor: user,
    });
    setAdmitting(false);
    if (result.error) { setError(result.error); return; }
    setAdmissionMessage("Member admitted. Portal access, tracker profile, and survey assignments are live.");
    await load();
  }

  const counts = voteOptions.reduce<Record<CandidateVoteDecision, number>>((acc, decision) => {
    acc[decision] = candidateVotes.filter(vote => vote.decision === decision).length;
    return acc;
  }, { approve: 0, discuss: 0, hold: 0, decline: 0 });

  const myPastVotes = votes
    .filter(vote => vote.member_name === user)
    .map(vote => ({ vote, candidate: candidates.find(candidate => candidate.id === vote.candidate_id) }))
    .filter((row): row is { vote: MembershipCandidateVote; candidate: MembershipCandidate } => !!row.candidate)
    .sort((a, b) => b.vote.updated_at.localeCompare(a.vote.updated_at));

  const viewHref = (view: CandidateView) => `/members/candidates?view=${view}`;
  const startedCount = candidates.filter(candidate => candidate.status === "started").length;
  const submittedCount = candidates.filter(candidate => candidate.status !== "started").length;
  const needsMyVoteCount = candidates.filter(candidate => candidate.status === "under_review" && !myVotedCandidateIds.has(candidate.id)).length;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 20px 100px" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <p style={eyebrow}>Member Portal</p>
          <h1 style={heading}>New Member Reviews</h1>
          <p style={muted}>Review submitted applicants, see applications that have been started, and submit your vote.</p>
        </div>
        <button onClick={() => router.push("/dashboard")} style={buttonGhost}>Back to Portal</button>
      </header>

      <section className="application-bridge-grid">
        <button onClick={() => router.push(viewHref("needs-my-vote"))} className="application-bridge-card">
          <span>Needs My Vote</span>
          <strong>{needsMyVoteCount}</strong>
          <p>Submitted applicants waiting for your member review.</p>
        </button>
        <button onClick={() => router.push(viewHref("started"))} className="application-bridge-card">
          <span>Started</span>
          <strong>{startedCount}</strong>
          <p>Draft applications visible before member voting opens.</p>
        </button>
        <button onClick={() => router.push(viewHref("all"))} className="application-bridge-card">
          <span>Applicant File</span>
          <strong>{submittedCount}</strong>
          <p>Submitted member candidates and vote history.</p>
        </button>
        <button onClick={() => router.push("/apply")} className="application-bridge-card">
          <span>Public Form</span>
          <strong>Apply</strong>
          <p>Open the membership readiness and contribution review.</p>
        </button>
      </section>

      <section style={systemNote}>
        <p style={eyebrow}>How this fits</p>
        <p style={muted}>
          Membership applications are not separate from the operating system. A submitted application becomes a member review item, votes are recorded here, and the outcome can be referenced from Decisions and the Hub.
        </p>
      </section>

      <section style={viewPanel}>
        <div>
          <p style={eyebrow}>Application Views</p>
          <p style={muted}>Jump between applicants waiting on you, your voting history, and the full applicant list.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => router.push(viewHref("needs-my-vote"))} style={activeView === "needs-my-vote" ? buttonPrimary : buttonGhost}>
            Needs My Vote
          </button>
          <button onClick={() => router.push(viewHref("started"))} style={activeView === "started" ? buttonPrimary : buttonGhost}>
            Started ({startedCount})
          </button>
          <button onClick={() => router.push(viewHref("my-votes"))} style={activeView === "my-votes" ? buttonPrimary : buttonGhost}>
            My Past Votes
          </button>
          <button onClick={() => router.push(viewHref("all"))} style={activeView === "all" ? buttonPrimary : buttonGhost}>
            All Applicants
          </button>
        </div>
      </section>

      {loading && <p style={muted}>Loading candidates...</p>}

      {!loading && candidates.length === 0 && (
        <section style={emptyCard}>
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>No applicants yet</h2>
          <p style={muted}>When someone starts or submits the membership review form, they will show up here.</p>
          <button onClick={() => router.push("/apply")} style={{ ...buttonPrimary, marginTop: 16 }}>
            Open Application Form
          </button>
        </section>
      )}

      {!loading && activeView === "my-votes" && (
        <section style={{ ...mainCard, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <p style={eyebrow}>My Vote History</p>
              <h2 style={{ fontSize: 22, color: "var(--obsidian)", marginBottom: 4 }}>Past member application votes</h2>
              <p style={muted}>Every member-review vote you have submitted, newest first.</p>
            </div>
            <div style={voteSummary}>
              <strong>{myPastVotes.length}</strong>
              <span>votes cast</span>
            </div>
          </div>
          {myPastVotes.length === 0 ? (
            <p style={muted}>You have not voted on any member applications yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {myPastVotes.map(({ vote, candidate }) => (
                <button
                  key={vote.id}
                  onClick={() => router.push(`/members/candidates?view=my-votes&candidate=${candidate.id}`)}
                  style={{
                    background: selectedCandidate?.id === candidate.id ? "rgba(201,168,120,0.12)" : "var(--bone)",
                    border: `1px solid ${selectedCandidate?.id === candidate.id ? "var(--brass)" : "var(--fog)"}`,
                    borderRadius: 8,
                    padding: 12,
                    textAlign: "left",
                    cursor: "pointer",
                    display: "grid",
                    gap: 5,
                    color: "var(--ink)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--obsidian)" }}>{candidate.full_name}</strong>
                    <span style={{ color: "var(--brass)", fontWeight: 800 }}>{voteLabel(vote.decision)}</span>
                  </div>
                  <span style={{ color: "var(--ink)", opacity: 0.6, fontSize: 12 }}>
                    Updated {new Date(vote.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {vote.note && <span style={{ color: "var(--ink)", opacity: 0.72, fontSize: 13 }}>{vote.note}</span>}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && candidates.length > 0 && visibleCandidates.length === 0 && activeView !== "my-votes" && (
        <section style={{ ...emptyCard, marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>No applicants in this view</h2>
          <p style={muted}>Switch to All Applicants or My Past Votes to review older applications.</p>
        </section>
      )}

      {selectedCandidate && (
        <div className="candidate-layout">
          <aside style={sideCard}>
          <p style={sideTitle}>{activeView === "needs-my-vote" ? "Needs My Vote" : activeView === "started" ? "Started Applications" : activeView === "my-votes" ? "Voted Applicants" : "Applicants"}</p>
            {visibleCandidates.map(candidate => {
              const applicantVotes = votes.filter(vote => vote.candidate_id === candidate.id);
              const voted = applicantVotes.some(vote => vote.member_name === user);
              const active = candidate.id === selectedCandidate.id;
              const started = candidate.status === "started";
              return (
                <button
                  key={candidate.id}
                  onClick={() => router.push(`/members/candidates?view=${activeView}&candidate=${candidate.id}`)}
                  style={{
                    ...candidateButton,
                    borderColor: active ? "var(--brass)" : "var(--fog)",
                    background: active ? "rgba(201,168,120,0.12)" : "var(--bone)",
                  }}
                >
                  <strong>{candidateDisplayName(candidate)}</strong>
                  <span>
                    {started
                      ? `started · updated ${formatShortDate(candidate.updated_at)}`
                      : `${applicantVotes.length}/${votingMembers.length} votes · ${voted ? "you voted" : "needs your vote"}`}
                  </span>
                </button>
              );
            })}
            {visibleCandidates.length === 0 && <p style={{ ...muted, fontSize: 12 }}>Nothing in this view.</p>}
          </aside>

          <section style={mainCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
              <div>
                <p style={eyebrow}>Applicant</p>
                <h2 style={{ ...heading, fontSize: "clamp(30px, 5vw, 46px)" }}>{candidateDisplayName(selectedCandidate)}</h2>
                <p style={muted}>
                  {selectedCandidate.status === "started"
                    ? `Started application · last updated ${formatShortDate(selectedCandidate.updated_at)}`
                    : `Submitted ${formatShortDate(selectedCandidate.submitted_at)}`}
                </p>
              </div>
              <div style={selectedCandidate.status === "started" ? startedSummary : voteSummary}>
                <strong>{selectedCandidate.status === "started" ? "Started" : `${candidateVotes.length}/${votingMembers.length}`}</strong>
                <span>{selectedCandidate.status === "started" ? "not submitted yet" : "member votes"}</span>
              </div>
            </div>

            {selectedCandidate.status === "started" && (
              <section style={startedPanel}>
                <p style={eyebrow}>Application In Progress</p>
                <p style={muted}>
                  This person has started the application but has not submitted it for member review yet. Voting opens after they submit the form.
                </p>
              </section>
            )}

            <div className="candidate-stats">
              <Stat label="Join as" question={candidateQuestions.join_as} value={selectedCandidate.join_as} />
              <Stat label="Max deal contribution" question={candidateQuestions.max_deal_contribution} value={formatCandidateMoney(selectedCandidate.max_deal_contribution)} />
              <Stat label="Cash available" question={candidateQuestions.cash_available} value={formatCandidateMoney(selectedCandidate.cash_available)} />
              <Stat label="Credit available" question={candidateQuestions.credit_available} value={formatCandidateMoney(selectedCandidate.credit_available)} />
              <Stat label="Monthly dues" question={candidateQuestions.monthly_dues_comfort} value={selectedCandidate.monthly_dues_comfort || "Not provided"} />
              <Stat label="Monthly dues max" question={candidateQuestions.monthly_dues_max} value={formatCandidateMoney(selectedCandidate.monthly_dues_max)} />
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

            {selectedCandidate.status !== "started" && (
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
            )}

            {selectedCandidate.status !== "started" && (
            <section style={resultsPanel}>
              <p style={eyebrow}>Vote Results</p>
              <div className="vote-counts">
                {voteOptions.map(decision => <Stat key={decision} label={voteLabel(decision)} value={String(counts[decision])} />)}
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                {votingMembers.map(member => {
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
            )}

            {admin && selectedCandidate.status !== "started" && (
              <section style={admissionPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <p style={eyebrow}>Admin Admission Workflow</p>
                    <h3 style={{ fontSize: 18, marginBottom: 6 }}>Give portal access and connect the money tracker</h3>
                    <p style={muted}>
                      Use the approved application responses to create the member login, add their LLC to tracker calculations, and assign onboarding surveys.
                    </p>
                  </div>
                  <div style={selectedCandidate.status === "approved" ? approvedBadge : startedSummary}>
                    <strong>{selectedCandidate.status === "approved" ? "Approved" : `${counts.approve}/${votingMembers.length}`}</strong>
                    <span>{selectedCandidate.status === "approved" ? "admitted" : "approve votes"}</span>
                  </div>
                </div>

                {admissionMessage && <div style={successBox}>{admissionMessage}</div>}

                <div className="admission-grid">
                  <label style={fieldLabel}>
                    <span>Portal member name</span>
                    <input value={admissionName} onChange={e => setAdmissionName(e.target.value)} style={inputStyle} />
                  </label>
                  <label style={fieldLabel}>
                    <span>Temporary password</span>
                    <input value={admissionPassword} onChange={e => setAdmissionPassword(e.target.value)} style={inputStyle} />
                  </label>
                  <label style={fieldLabel}>
                    <span>LLC / tracker display name</span>
                    <input value={admissionLlcName} onChange={e => setAdmissionLlcName(e.target.value)} style={inputStyle} />
                  </label>
                  <label style={{ ...fieldLabel, justifyContent: "end" }}>
                    <span>Admin access</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 45 }}>
                      <input type="checkbox" checked={admissionAdmin} onChange={e => setAdmissionAdmin(e.target.checked)} />
                      Can edit tracker settings
                    </span>
                  </label>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <p style={{ ...eyebrow, marginBottom: 0 }}>Assign Surveys</p>
                  <div className="survey-assignment-grid">
                    {surveys.map(survey => {
                      const checked = assignedSurveyIds.includes(survey.id);
                      return (
                        <label key={survey.id} style={surveyChoice}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setAssignedSurveyIds(prev => e.target.checked ? [...prev, survey.id] : prev.filter(id => id !== survey.id))}
                          />
                          <span>
                            <strong>{survey.title}</strong>
                            <em>{survey.categories.reduce((sum, category) => sum + category.questions.length, 0)} questions</em>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={admitCandidate}
                  disabled={admitting || selectedCandidate.status === "approved"}
                  style={{ ...buttonPrimary, opacity: admitting || selectedCandidate.status === "approved" ? 0.55 : 1, cursor: admitting || selectedCandidate.status === "approved" ? "not-allowed" : "pointer", justifySelf: "start" }}
                >
                  {selectedCandidate.status === "approved" ? "Already Admitted" : admitting ? "Admitting..." : "Admit Member"}
                </button>
              </section>
            )}
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
        .admission-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .survey-assignment-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px;
        }
        .application-bridge-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .application-bridge-card {
          appearance: none;
          background: var(--surface);
          border: 1px solid var(--fog);
          border-radius: 8px;
          cursor: pointer;
          min-height: 126px;
          padding: 16px;
          text-align: left;
        }
        .application-bridge-card span {
          color: var(--brass);
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .application-bridge-card strong {
          color: var(--obsidian);
          display: block;
          font-size: 22px;
          line-height: 1.2;
          margin-bottom: 8px;
        }
        .application-bridge-card p {
          color: var(--ink);
          font-size: 12px;
          line-height: 1.45;
          opacity: 0.68;
        }
        @media (max-width: 980px) {
          .application-bridge-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 820px) {
          .candidate-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .application-bridge-grid { grid-template-columns: 1fr; }
          .admission-grid { grid-template-columns: 1fr; }
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

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function candidateDisplayName(candidate: MembershipCandidate): string {
  if (candidate.full_name && candidate.full_name !== "Started application") return candidate.full_name;
  return candidate.contact_email || candidate.contact_phone || "Started application";
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

const viewPanel: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 16,
  marginBottom: 18,
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
};

const systemNote: React.CSSProperties = {
  background: "rgba(201,168,120,0.1)",
  border: "1px solid rgba(201,168,120,0.24)",
  borderRadius: 8,
  padding: 16,
  marginBottom: 18,
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

const startedSummary: React.CSSProperties = {
  ...voteSummary,
  background: "rgba(201,168,120,0.18)",
  color: "var(--obsidian)",
  border: "1px solid rgba(201,168,120,0.35)",
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

const startedPanel: React.CSSProperties = {
  background: "rgba(201,168,120,0.12)",
  border: "1px solid rgba(201,168,120,0.3)",
  borderRadius: 8,
  padding: 16,
  marginBottom: 18,
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

const admissionPanel: React.CSSProperties = {
  marginTop: 18,
  background: "rgba(201,168,120,0.10)",
  border: "1px solid rgba(201,168,120,0.28)",
  borderRadius: 8,
  padding: 16,
  display: "grid",
  gap: 14,
};

const approvedBadge: React.CSSProperties = {
  ...voteSummary,
  background: "rgba(45,106,79,0.14)",
  color: "#254f3c",
  border: "1px solid rgba(45,106,79,0.25)",
};

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 5,
  fontSize: 12,
  color: "var(--ink)",
};

const surveyChoice: React.CSSProperties = {
  display: "flex",
  gap: 9,
  alignItems: "flex-start",
  background: "var(--surface)",
  border: "1px solid var(--fog)",
  borderRadius: 8,
  padding: 10,
  fontSize: 12,
  color: "var(--ink)",
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

const successBox: React.CSSProperties = {
  background: "rgba(45,106,79,0.08)",
  border: "1px solid rgba(45,106,79,0.25)",
  color: "#254f3c",
  borderRadius: 6,
  padding: 12,
  fontSize: 13,
};
