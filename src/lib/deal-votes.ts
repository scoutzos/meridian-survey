import { supabase } from "./supabase";

export const DEAL_VOTE_TYPES = ["deal-review", "deal_vote"];

export interface PendingDealVote {
  id: string;
  title: string;
  urgency: string;
  recommendation: string | null;
  submitted_at: string;
}

export async function fetchPendingDealVotes(memberName: string): Promise<PendingDealVote[]> {
  if (!supabase) return [];
  const [dealResult, voteResult] = await Promise.all([
    supabase
      .from("meridian_deals")
      .select("id, title, urgency, status, analysis, created_at, updated_at")
      .is("deleted_at", null)
      .in("status", ["lead", "under-review", "offer-made", "under-contract", "due-diligence"])
      .order("updated_at", { ascending: false }),
    supabase
      .from("meridian_deal_votes")
      .select("deal_id")
      .eq("member_name", memberName),
  ]);

  if (dealResult.error || !dealResult.data) return [];
  const voted = new Set((voteResult.data ?? []).map(row => row.deal_id));
  return dealResult.data
    .filter(row => !voted.has(row.id))
    .map(row => {
      const analysis = row.analysis && typeof row.analysis === "object" ? row.analysis as { recommendation?: string } : {};
      return {
        id: row.id,
        title: row.title,
        urgency: row.urgency,
        recommendation: analysis.recommendation ?? null,
        submitted_at: row.updated_at ?? row.created_at,
      };
    });
}
