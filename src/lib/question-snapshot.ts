// Question versioning — captures the question's text/options/priority at save
// time and computes a content hash so the results page can detect whether two
// members answered the *same* version of a question.
//
// Why not store the full questions.ts version with each save? Because the file
// is the source of truth for "current" — pinning per-save is enough.

import type { SurveyQuestion } from "@/data/surveys";

export interface QuestionSnapshot {
  text: string;
  options: string[];
  priority: SurveyQuestion["priority"];
  inputType?: SurveyQuestion["inputType"];
}

/** Build the snapshot payload that goes into meridian_responses.question_snapshot. */
export function buildQuestionSnapshot(q: SurveyQuestion): QuestionSnapshot {
  return {
    text: q.text,
    options: q.options ?? [],
    priority: q.priority,
    inputType: q.inputType,
  };
}

/**
 * Short, stable content hash of a snapshot. djb2-ish 32-bit hash → base36.
 * Sufficient for "did the question text change?" — not crypto.
 */
export function snapshotVersion(snap: QuestionSnapshot): string {
  const canonical = JSON.stringify({
    text: snap.text,
    options: [...snap.options],
    priority: snap.priority,
    inputType: snap.inputType ?? null,
  });
  let h = 5381;
  for (let i = 0; i < canonical.length; i++) {
    h = (((h << 5) + h) + canonical.charCodeAt(i)) | 0; // h * 33 + c, 32-bit
  }
  return (h >>> 0).toString(36); // unsigned, base36
}

/** Convenience: build {snapshot, version} from a question. */
export function snapshotWithVersion(q: SurveyQuestion): {
  question_snapshot: QuestionSnapshot;
  snapshot_version: string;
} {
  const snap = buildQuestionSnapshot(q);
  return { question_snapshot: snap, snapshot_version: snapshotVersion(snap) };
}

/**
 * Build a single meridian_responses row payload, including the question
 * snapshot if a definition is found. If the question_id is unknown to the
 * lookup (e.g. a stale answer for a removed question), snapshot is null —
 * the row is still saved so we don't lose the user's input.
 */
export function buildAnswerRow(args: {
  member: string;
  surveyId: string;
  questionId: string;
  answer: unknown;
  questions: Record<string, SurveyQuestion>;
}): {
  member_name: string;
  question_id: string;
  survey_id: string;
  answer: string;
  updated_at: string;
  question_snapshot: QuestionSnapshot | null;
  snapshot_version: string | null;
} {
  const q = args.questions[args.questionId];
  const snap = q ? snapshotWithVersion(q) : { question_snapshot: null, snapshot_version: null };
  return {
    member_name: args.member,
    question_id: args.questionId,
    survey_id: args.surveyId,
    answer: JSON.stringify(args.answer),
    updated_at: new Date().toISOString(),
    ...snap,
  };
}

/** Build a questionId → SurveyQuestion lookup from a survey's categories. */
export function buildQuestionLookup(
  categories: Array<{ questions: SurveyQuestion[] }>,
): Record<string, SurveyQuestion> {
  const out: Record<string, SurveyQuestion> = {};
  for (const c of categories) for (const q of c.questions) out[q.id] = q;
  return out;
}
