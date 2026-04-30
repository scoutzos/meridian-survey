-- =============================================================================
-- Transcripts — DB-backed meeting transcripts with Postgres full-text search.
-- Replaces the localStorage-based hub.transcripts (per-member, ~5MB cap).
--
-- Workflow:
--   Member uploads .txt (Otter export, attorney letter, hand-typed notes, etc.)
--   → client extracts plain text → row is inserted with body + optional original
--   file in Supabase Storage. The body_tsv generated column powers the search box.
--
-- Idempotent: safe to re-run.
-- =============================================================================

create table if not exists transcripts (
  id              bigserial primary key,
  title           text not null,
  occurred_at     timestamptz,                  -- when the meeting actually happened
  body            text,                         -- extracted plain text (search target)
  summary         text,                         -- optional headline/abstract
  action_items    jsonb not null default '[]'::jsonb,  -- ["item 1", "item 2", ...]
  source_url      text,                         -- e.g. Otter share link
  storage_path    text,                         -- supabase storage path of original file
  mime_type       text,
  uploaded_by     text,                         -- meridian_members.name

  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  deleted_at      timestamptz
);

-- Generated tsvector. Title weighted highest, summary middle, body bulk.
-- Stored (not virtual) so the GIN index can be used directly.
alter table transcripts
  add column if not exists body_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),   'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')),    'C')
  ) stored;

create index if not exists transcripts_body_tsv_idx     on transcripts using gin(body_tsv);
create index if not exists transcripts_occurred_at_idx  on transcripts(occurred_at desc nulls last) where deleted_at is null;
create index if not exists transcripts_uploaded_by_idx  on transcripts(uploaded_by) where deleted_at is null;

comment on table transcripts is
  'Meeting transcripts with Postgres full-text search. Body is the canonical search target; storage_path optionally points to the original file in Supabase Storage.';
