-- =============================================================================
-- VA daily brief authenticated RLS repair
--
-- Browsers with a Supabase Auth session send requests as `authenticated`, so
-- prototype anon policies do not cover the VA daily brief flow after auth
-- cutover. This keeps the current member-name model working while allowing
-- authenticated VA users to submit briefs and members to review them.
-- =============================================================================

alter table if exists meridian_va_daily_briefs enable row level security;
alter table if exists meridian_va_daily_brief_reviews enable row level security;

create or replace function meridian_current_member_name()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'member_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'member_name', ''),
    nullif(auth.jwt() ->> 'name', ''),
    nullif(current_setting('request.jwt.claim.member_name', true), ''),
    (
      select name
      from meridian_members
      where auth_user_id = auth.uid()
      limit 1
    ),
    (
      select name
      from meridian_members
      where lower(auth_email) = lower(auth.email())
      limit 1
    )
  );
$$;

create or replace function meridian_current_member_role()
returns text
language sql
stable
as $$
  select coalesce((
    select role
    from meridian_members
    where name = meridian_current_member_name()
    limit 1
  ), 'member');
$$;

create or replace function meridian_is_va()
returns boolean
language sql
stable
as $$
  select meridian_current_member_role() = 'va';
$$;

create or replace function meridian_is_member()
returns boolean
language sql
stable
as $$
  select meridian_current_member_name() is not null
    and meridian_current_member_role() = 'member';
$$;

create or replace function meridian_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((
    select is_admin
    from tracker_member_profiles
    where member_name = meridian_current_member_name()
    limit 1
  ), false);
$$;

drop policy if exists "meridian_va_daily_briefs authenticated read" on meridian_va_daily_briefs;
drop policy if exists "meridian_va_daily_briefs authenticated va insert" on meridian_va_daily_briefs;
drop policy if exists "meridian_va_daily_briefs authenticated va update own" on meridian_va_daily_briefs;
drop policy if exists "meridian_va_daily_briefs authenticated member review update" on meridian_va_daily_briefs;
drop policy if exists "meridian_va_daily_brief_reviews authenticated read" on meridian_va_daily_brief_reviews;
drop policy if exists "meridian_va_daily_brief_reviews authenticated member insert" on meridian_va_daily_brief_reviews;
drop policy if exists "meridian_va_daily_brief_reviews authenticated member update own" on meridian_va_daily_brief_reviews;

create policy "meridian_va_daily_briefs authenticated read"
  on meridian_va_daily_briefs
  for select
  to authenticated
  using (
    meridian_current_member_name() is not null
    and deleted_at is null
  );

create policy "meridian_va_daily_briefs authenticated va insert"
  on meridian_va_daily_briefs
  for insert
  to authenticated
  with check (
    meridian_is_va()
    and submitted_by = meridian_current_member_name()
  );

create policy "meridian_va_daily_briefs authenticated va update own"
  on meridian_va_daily_briefs
  for update
  to authenticated
  using (
    meridian_is_va()
    and deleted_at is null
    and submitted_by = meridian_current_member_name()
  )
  with check (
    meridian_is_va()
    and submitted_by = meridian_current_member_name()
  );

create policy "meridian_va_daily_briefs authenticated member review update"
  on meridian_va_daily_briefs
  for update
  to authenticated
  using (
    (meridian_is_member() or meridian_is_admin())
    and deleted_at is null
  )
  with check (
    meridian_is_member() or meridian_is_admin()
  );

create policy "meridian_va_daily_brief_reviews authenticated read"
  on meridian_va_daily_brief_reviews
  for select
  to authenticated
  using (meridian_current_member_name() is not null);

create policy "meridian_va_daily_brief_reviews authenticated member insert"
  on meridian_va_daily_brief_reviews
  for insert
  to authenticated
  with check (
    (meridian_is_member() or meridian_is_admin())
    and member_name = meridian_current_member_name()
  );

create policy "meridian_va_daily_brief_reviews authenticated member update own"
  on meridian_va_daily_brief_reviews
  for update
  to authenticated
  using (
    (meridian_is_member() or meridian_is_admin())
    and member_name = meridian_current_member_name()
  )
  with check (
    (meridian_is_member() or meridian_is_admin())
    and member_name = meridian_current_member_name()
  );

comment on policy "meridian_va_daily_briefs authenticated va insert" on meridian_va_daily_briefs is
  'Allows authenticated VA operators to submit their own daily brief after Supabase Auth cutover.';

comment on policy "meridian_va_daily_brief_reviews authenticated member insert" on meridian_va_daily_brief_reviews is
  'Allows authenticated members/admins to record their own review receipt for a VA daily brief.';
