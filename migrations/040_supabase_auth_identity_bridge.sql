-- =============================================================================
-- Supabase Auth identity bridge
--
-- Adds mapping fields so Meridian can migrate one user at a time from the
-- current prototype password table to Supabase Auth.
-- =============================================================================

alter table meridian_members
  add column if not exists auth_email text,
  add column if not exists auth_user_id uuid,
  add column if not exists auth_provider text not null default 'legacy'
    check (auth_provider in ('legacy','supabase-auth')),
  add column if not exists auth_migrated_at timestamptz;

create unique index if not exists meridian_members_auth_email_idx
  on meridian_members(lower(auth_email))
  where auth_email is not null;

create unique index if not exists meridian_members_auth_user_id_idx
  on meridian_members(auth_user_id)
  where auth_user_id is not null;

comment on column meridian_members.auth_email is
  'Supabase Auth email for this Meridian user. When present, the login page signs in through Supabase Auth instead of the legacy password column.';

comment on column meridian_members.auth_user_id is
  'Optional Supabase Auth user id for auditing and future RLS joins.';

comment on column meridian_members.auth_provider is
  'legacy until the user has been migrated to Supabase Auth; supabase-auth after cutover.';

comment on column meridian_members.auth_migrated_at is
  'Timestamp when this Meridian user was switched to Supabase Auth.';
