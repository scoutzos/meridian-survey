import { MEMBERS } from "@/data/questions";
import { supabase } from "./supabase";
import { createNotification, markNotificationRead } from "./operations";

export type CandidateStatus = "under_review" | "approved" | "declined" | "withdrawn";
export type CandidateVoteDecision = "approve" | "discuss" | "hold" | "decline";

export interface MembershipCandidate {
  id: string;
  full_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  join_as: string;
  entity_name: string | null;
  entity_state: string | null;
  entity_title: string | null;
  participation: string;
  max_deal_contribution: number | null;
  cash_available: number | null;
  credit_available: number | null;
  deal_readiness: string | null;
  credit_pull_comfort: string | null;
  table_contribution: string | null;
  relationships: string | null;
  first_90_days: string | null;
  support_requested: string | null;
  member_notes: string | null;
  status: CandidateStatus;
  submitted_at: string;
  updated_at: string;
}

export interface MembershipCandidateVote {
  id: string;
  candidate_id: string;
  member_name: string;
  decision: CandidateVoteDecision;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type CandidateDraft = Omit<
  MembershipCandidate,
  "id" | "status" | "submitted_at" | "updated_at"
>;

export const MEMBERSHIP_CANDIDATE_VOTE = "membership_candidate_vote";

export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCandidateMoney(value: number | null | undefined): string {
  if (value == null) return "Not provided";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function voteLabel(decision: CandidateVoteDecision): string {
  return {
    approve: "Approve",
    discuss: "Discuss",
    hold: "Hold",
    decline: "Decline",
  }[decision];
}

export async function createMembershipCandidate(
  draft: CandidateDraft,
): Promise<{ data: MembershipCandidate | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase
    .from("membership_candidates")
    .insert({
      ...draft,
      contact_email: draft.contact_email?.trim() || null,
      contact_phone: draft.contact_phone?.trim() || null,
      entity_name: draft.entity_name?.trim() || null,
      entity_state: draft.entity_state?.trim() || null,
      entity_title: draft.entity_title?.trim() || null,
      deal_readiness: draft.deal_readiness?.trim() || null,
      credit_pull_comfort: draft.credit_pull_comfort?.trim() || null,
      table_contribution: draft.table_contribution?.trim() || null,
      relationships: draft.relationships?.trim() || null,
      first_90_days: draft.first_90_days?.trim() || null,
      support_requested: draft.support_requested?.trim() || null,
      member_notes: draft.member_notes?.trim() || null,
    })
    .select()
    .single();

  if (error || !data) return { data: null, error: error?.message ?? "Could not submit candidate" };

  const candidate = data as MembershipCandidate;
  const noticeResults = await Promise.all(MEMBERS.map(member => createNotification({
    title: `New member review: ${candidate.full_name}`,
    body: "Review readiness, capital, credit, relationships, and what this applicant can bring to Meridian.",
    priority: "high",
    assigned_to: member,
    href: `/members/candidates?candidate=${candidate.id}`,
    source_table: "membership_candidates",
    source_id: candidate.id,
    notification_type: MEMBERSHIP_CANDIDATE_VOTE,
  }, "Membership Application")));
  const noticeError = noticeResults.find(result => result.error)?.error;
  if (noticeError) {
    return {
      data: candidate,
      error: `Application saved, but member vote notifications could not be created: ${noticeError}`,
    };
  }

  return { data: candidate, error: null };
}

export async function fetchPendingMembershipCandidateVotes(memberName: string): Promise<MembershipCandidate[]> {
  if (!supabase) return [];
  const [candidatesResult, votesResult] = await Promise.all([
    supabase
      .from("membership_candidates")
      .select("*")
      .eq("status", "under_review")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("membership_candidate_votes")
      .select("candidate_id")
      .eq("member_name", memberName),
  ]);

  if (candidatesResult.error || !candidatesResult.data) return [];
  const votedIds = new Set((votesResult.data ?? []).map(row => row.candidate_id));
  return (candidatesResult.data as MembershipCandidate[]).filter(candidate => !votedIds.has(candidate.id));
}

export async function fetchMembershipCandidates(): Promise<MembershipCandidate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("membership_candidates")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error || !data) return [];
  return data as MembershipCandidate[];
}

export async function fetchMembershipCandidateVotes(): Promise<MembershipCandidateVote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("membership_candidate_votes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as MembershipCandidateVote[];
}

export async function voteOnMembershipCandidate(
  candidateId: string,
  memberName: string,
  decision: CandidateVoteDecision,
  note: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("membership_candidate_votes")
    .upsert({
      candidate_id: candidateId,
      member_name: memberName,
      decision,
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "candidate_id,member_name" });

  if (error) return { error: error.message };

  const { data: notices } = await supabase
    .from("meridian_notifications")
    .select("id")
    .eq("notification_type", MEMBERSHIP_CANDIDATE_VOTE)
    .eq("assigned_to", memberName)
    .eq("source_id", candidateId)
    .is("read_at", null);

  await Promise.all((notices ?? []).map(notice => markNotificationRead(notice.id)));
  return { error: null };
}
