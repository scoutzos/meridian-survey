-- =============================================================================
-- Meridian Base Schema — core members and survey responses.
--
-- Run before migrations/001+ on a fresh Supabase project.
-- Idempotent: safe to re-run.
-- =============================================================================

create table if not exists meridian_members (
  name              text primary key,
  password          text not null default 'meridian2026',
  password_changed  boolean not null default false,
  last_login        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

insert into meridian_members (name, password, password_changed)
values
  ('Courtney Mosely', 'meridian2026', false),
  ('Aaliyah Thomas', 'meridian2026', false),
  ('Raquel Twine', 'meridian2026', false),
  ('Odessa Patterson', 'meridian2026', false),
  ('Tiffany Stallworth', 'meridian2026', false),
  ('Peggee', 'meridian2026', false)
on conflict (name) do nothing;

create table if not exists meridian_responses (
  id            uuid primary key default gen_random_uuid(),
  member_name   text not null references meridian_members(name) on delete cascade,
  survey_id     text not null default 'operating-agreement',
  question_id   text not null,
  answer        text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(member_name, survey_id, question_id)
);

create index if not exists meridian_responses_survey_idx
  on meridian_responses(survey_id, member_name);

comment on table meridian_members is 'Prototype Meridian member table. Replace with Supabase Auth before production use.';
comment on table meridian_responses is 'Survey response rows keyed by member, survey, and question.';
