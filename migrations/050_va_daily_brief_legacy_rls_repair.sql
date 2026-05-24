-- =============================================================================
-- VA daily brief legacy RLS repair
--
-- Sophie is still using the legacy portal login, which sends Supabase requests
-- as the anon role. Keep the daily brief flow usable until the VA account is
-- fully migrated to Supabase Auth.
-- =============================================================================

alter table if exists meridian_va_daily_briefs enable row level security;
alter table if exists meridian_va_daily_brief_reviews enable row level security;

drop policy if exists "meridian_va_daily_briefs prototype anon read" on meridian_va_daily_briefs;
drop policy if exists "meridian_va_daily_briefs prototype anon write" on meridian_va_daily_briefs;

create policy "meridian_va_daily_briefs prototype anon read"
  on meridian_va_daily_briefs
  for select
  to anon
  using (deleted_at is null);

create policy "meridian_va_daily_briefs prototype anon write"
  on meridian_va_daily_briefs
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "meridian_va_daily_brief_reviews prototype anon read" on meridian_va_daily_brief_reviews;
drop policy if exists "meridian_va_daily_brief_reviews prototype anon write" on meridian_va_daily_brief_reviews;

create policy "meridian_va_daily_brief_reviews prototype anon read"
  on meridian_va_daily_brief_reviews
  for select
  to anon
  using (true);

create policy "meridian_va_daily_brief_reviews prototype anon write"
  on meridian_va_daily_brief_reviews
  for all
  to anon
  using (true)
  with check (true);

comment on policy "meridian_va_daily_briefs prototype anon write" on meridian_va_daily_briefs is
  'Temporary compatibility for legacy VA portal login until Sophie is migrated to Supabase Auth.';
