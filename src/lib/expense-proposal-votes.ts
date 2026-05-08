import { supabase } from "./supabase";

export interface PendingExpenseProposalVote {
  id: string;
  title: string;
  status: string;
  revision_number: number | null;
  submitted_at: string;
}

export const EXPENSE_PROPOSAL_VOTE_TYPES = [
  "expense_proposal_vote",
  "expense_proposal_revised",
];

export async function fetchPendingExpenseProposalVotes(memberName: string): Promise<PendingExpenseProposalVote[]> {
  if (!supabase) return [];
  const [proposalResult, voteResult] = await Promise.all([
    supabase
      .from("tracker_expense_proposals")
      .select("id, title, status, revision_number, created_at, updated_at")
      .in("status", ["review"])
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("tracker_expense_proposal_votes")
      .select("proposal_id, proposal_version")
      .eq("member_name", memberName),
  ]);

  if (proposalResult.error || !proposalResult.data) return [];
  const voted = new Set((voteResult.data ?? []).map(row => `${row.proposal_id}:${row.proposal_version ?? 1}`));
  return proposalResult.data
    .filter(row => !voted.has(`${row.id}:${row.revision_number ?? 1}`))
    .map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
      revision_number: row.revision_number ?? 1,
      submitted_at: row.updated_at ?? row.created_at,
    }));
}
