-- =============================================================================
-- Meeting transcript column — raw transcript text attached to a meeting note.
--
-- Lets a member upload a transcript (.txt/.vtt/.srt/.docx) when logging a
-- meeting and have the AI extraction pipeline attach the source text alongside
-- the synthesized notes + action items.
--
-- Idempotent: safe to re-run.
-- =============================================================================

alter table meeting_notes
  add column if not exists transcript text;

alter table meeting_notes
  add column if not exists transcript_filename text;

comment on column meeting_notes.transcript is
  'Raw transcript text uploaded with the meeting (txt/vtt/srt/docx after parse).';
comment on column meeting_notes.transcript_filename is
  'Original filename of the uploaded transcript, for reference in the UI.';
