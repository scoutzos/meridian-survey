// Decisions data layer — fetch from the `decisions` table, fall back to the
// hardcoded src/data/decisions.ts seed if Supabase is unavailable or the table
// hasn't been migrated yet.
//
// The hardcoded array is now seed data, not the runtime source. The DB row
// shape uses snake_case to match Postgres conventions; the front-end Decision
// type stays camelCase for UI continuity.

import { supabase } from "./supabase";
import { decisions as seedDecisions, type Decision, type DecisionStatus } from "@/data/decisions";

export type MonetaryKind =
  | "initial_contribution"
  | "monthly_dues"
  | "capital_call_threshold"
  | "spending_authority_threshold"
  | "max_personal_risk_year_one";

export interface DecisionRow {
  id: string;
  question_id: string | null;
  category: string;
  topic: string;
  status: DecisionStatus;
  final_answer: string | null;
  meeting_date: string | null;
  notes: string | null;
  monetary_kind: MonetaryKind | null;
  monetary_value: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

/** Convert a DB row to the front-end Decision shape used by existing UI code. */
export function rowToDecision(r: DecisionRow): Decision {
  return {
    id: r.id,
    questionId: r.question_id,
    category: r.category,
    topic: r.topic,
    status: r.status,
    finalAnswer: r.final_answer,
    meetingDate: r.meeting_date,
    notes: r.notes,
  };
}

/** Convert hardcoded seed decisions to the row shape (for fallback). */
function seedToRow(d: Decision): DecisionRow {
  return {
    id: d.id,
    question_id: d.questionId,
    category: d.category,
    topic: d.topic,
    status: d.status,
    final_answer: d.finalAnswer,
    meeting_date: d.meetingDate,
    notes: d.notes,
    monetary_kind: null,
    monetary_value: null,
    created_at: "",
    created_by: null,
    updated_at: "",
    updated_by: null,
    deleted_at: null,
  };
}

/**
 * Fetch decisions from DB, fall back to the hardcoded seed if anything goes
 * wrong or the table is empty (e.g., migration not applied yet).
 */
export async function fetchDecisions(): Promise<DecisionRow[]> {
  if (!supabase) return seedDecisions.map(seedToRow);
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .is("deleted_at", null)
    .order("id");
  if (error || !data || data.length === 0) {
    return seedDecisions.map(seedToRow);
  }
  return data as DecisionRow[];
}

/**
 * Fetch confirmed monetary values that the tracker reads as authoritative.
 * Returns a map of kind → { value, decisionId } so callers can show "this
 * comes from confirmed decision dN".
 */
export async function fetchMonetaryDecisions(): Promise<
  Partial<Record<MonetaryKind, { value: number; decisionId: string; finalAnswer: string | null; meetingDate: string | null }>>
> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("decisions_monetary_values")
    .select("monetary_kind, monetary_value, decision_id, final_answer, meeting_date");
  if (error || !data) return {};
  const out: Partial<Record<MonetaryKind, { value: number; decisionId: string; finalAnswer: string | null; meetingDate: string | null }>> = {};
  for (const r of data as Array<{ monetary_kind: MonetaryKind; monetary_value: number; decision_id: string; final_answer: string | null; meeting_date: string | null }>) {
    out[r.monetary_kind] = {
      value: Number(r.monetary_value),
      decisionId: r.decision_id,
      finalAnswer: r.final_answer,
      meetingDate: r.meeting_date,
    };
  }
  return out;
}

/** Update a single decision row. Used by the admin UI on the decisions page. */
export async function updateDecision(
  id: string,
  patch: Partial<Pick<DecisionRow, "status" | "final_answer" | "notes" | "meeting_date" | "monetary_kind" | "monetary_value">>,
  actor: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase
    .from("decisions")
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: actor })
    .eq("id", id);
  return { error: error?.message ?? null };
}
