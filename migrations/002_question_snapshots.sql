-- =============================================================================
-- Question versioning — snapshot the question's text/options/priority at save
-- time so an OA decision derived from "answer to oa-3-2" doesn't silently shift
-- meaning if someone edits questions.ts later.
--
-- Idempotent: safe to re-run.
-- =============================================================================

alter table meridian_responses
  add column if not exists question_snapshot jsonb,
  add column if not exists snapshot_version  text;

-- snapshot_version is a short hash of the snapshot content; same answer to the
-- same exact question content yields the same hash. Lets the results page tell
-- "two members answered the same version" vs. "the question changed between
-- their saves."
create index if not exists meridian_responses_snapshot_version_idx
  on meridian_responses(survey_id, question_id, snapshot_version);

comment on column meridian_responses.question_snapshot is
  'JSONB: { text, options[], priority, inputType } at the moment of save. Null for legacy rows; renders fall back to current questions.ts.';
comment on column meridian_responses.snapshot_version is
  'Short content hash of question_snapshot. Mismatch across rows = question text changed between member saves.';
