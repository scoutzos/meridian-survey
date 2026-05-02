-- =============================================================================
-- Shared Hub — announcements, links, documents, and member profile notes.
--
-- Replaces browser-local "shared" Hub data with Supabase-backed records.
-- Idempotent: safe to re-run.
-- =============================================================================

create table if not exists meridian_hub_announcements (
  id          uuid primary key default gen_random_uuid(),
  author      text references meridian_members(name) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists meridian_hub_decisions (
  id          uuid primary key default gen_random_uuid(),
  author      text references meridian_members(name) on delete set null,
  description text not null,
  outcome     text,
  present     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists meridian_hub_links (
  id          uuid primary key default gen_random_uuid(),
  author      text references meridian_members(name) on delete set null,
  url         text not null,
  title       text not null,
  category    text not null default 'Other',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists meridian_hub_documents (
  id          uuid primary key default gen_random_uuid(),
  author      text references meridian_members(name) on delete set null,
  filename    text not null,
  category    text not null default 'Other',
  data        text not null,
  mime_type   text,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists meridian_hub_profiles (
  member_name text primary key references meridian_members(name) on delete cascade,
  role        text,
  contact     text,
  last_active timestamptz,
  updated_at  timestamptz not null default now()
);

create index if not exists meridian_hub_announcements_created_idx
  on meridian_hub_announcements(created_at desc) where deleted_at is null;
create index if not exists meridian_hub_decisions_created_idx
  on meridian_hub_decisions(created_at desc) where deleted_at is null;
create index if not exists meridian_hub_links_category_idx
  on meridian_hub_links(category, created_at desc) where deleted_at is null;
create index if not exists meridian_hub_documents_category_idx
  on meridian_hub_documents(category, created_at desc) where deleted_at is null;

comment on table meridian_hub_announcements is 'Shared Hub announcements visible to all Meridian members.';
comment on table meridian_hub_decisions is 'Shared Hub informal decision log.';
comment on table meridian_hub_links is 'Shared Hub saved links.';
comment on table meridian_hub_documents is 'Shared Hub document uploads stored as data URLs until Storage is wired.';
comment on table meridian_hub_profiles is 'Shared Hub member profile notes.';
