-- =============================================================================
-- Work routing RLS readiness
--
-- This adds production-oriented Auth/RLS helpers and policies for member-to-VA
-- task routing. It intentionally does not drop the existing prototype anon
-- policies, because the current app still uses a client-side member login.
--
-- Cutover note:
--   1. Move login to Supabase Auth.
--   2. Add a `member_name` claim or user_metadata.member_name for each user.
--   3. Verify these authenticated policies.
--   4. Drop the older "prototype anon read/write" policies.
-- =============================================================================

alter table if exists action_items enable row level security;
alter table if exists meridian_notifications enable row level security;

create or replace function meridian_current_member_name()
returns text
language sql
stable
as $$
  select nullif(coalesce(
    auth.jwt() ->> 'member_name',
    auth.jwt() -> 'user_metadata' ->> 'member_name',
    auth.jwt() ->> 'name',
    current_setting('request.jwt.claim.member_name', true)
  ), '');
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

drop policy if exists "action_items authenticated member read" on action_items;
drop policy if exists "action_items authenticated va read" on action_items;
drop policy if exists "action_items authenticated member insert" on action_items;
drop policy if exists "action_items authenticated member update" on action_items;
drop policy if exists "action_items authenticated va update assigned" on action_items;
drop policy if exists "action_items authenticated admin delete" on action_items;

create policy "action_items authenticated member read"
  on action_items
  for select
  to authenticated
  using (
    meridian_is_member()
    and deleted_at is null
    and (
      assigned_to is null
      or assigned_to = 'All Members'
      or assigned_to = meridian_current_member_name()
      or created_by = meridian_current_member_name()
      or task_type = 'va-work'
    )
  );

create policy "action_items authenticated va read"
  on action_items
  for select
  to authenticated
  using (
    meridian_is_va()
    and deleted_at is null
    and (
      assigned_to = meridian_current_member_name()
      or assigned_to = 'Sophie / VA'
      or task_type = 'va-work'
    )
  );

create policy "action_items authenticated member insert"
  on action_items
  for insert
  to authenticated
  with check (
    meridian_is_member()
    and created_by = meridian_current_member_name()
  );

create policy "action_items authenticated member update"
  on action_items
  for update
  to authenticated
  using (
    meridian_is_member()
    and deleted_at is null
    and (
      assigned_to = meridian_current_member_name()
      or created_by = meridian_current_member_name()
      or meridian_is_admin()
    )
  )
  with check (
    meridian_is_member()
    and (
      assigned_to = meridian_current_member_name()
      or created_by = meridian_current_member_name()
      or meridian_is_admin()
    )
  );

create policy "action_items authenticated va update assigned"
  on action_items
  for update
  to authenticated
  using (
    meridian_is_va()
    and deleted_at is null
    and (
      assigned_to = meridian_current_member_name()
      or assigned_to = 'Sophie / VA'
      or task_type = 'va-work'
    )
  )
  with check (
    meridian_is_va()
    and (
      assigned_to = meridian_current_member_name()
      or assigned_to = 'Sophie / VA'
      or task_type = 'va-work'
    )
  );

create policy "action_items authenticated admin delete"
  on action_items
  for delete
  to authenticated
  using (meridian_is_admin());

drop policy if exists "meridian_notifications authenticated read own" on meridian_notifications;
drop policy if exists "meridian_notifications authenticated insert" on meridian_notifications;
drop policy if exists "meridian_notifications authenticated mark own read" on meridian_notifications;

create policy "meridian_notifications authenticated read own"
  on meridian_notifications
  for select
  to authenticated
  using (
    assigned_to is null
    or assigned_to = meridian_current_member_name()
  );

create policy "meridian_notifications authenticated insert"
  on meridian_notifications
  for insert
  to authenticated
  with check (
    meridian_current_member_name() is not null
    and created_by = meridian_current_member_name()
  );

create policy "meridian_notifications authenticated mark own read"
  on meridian_notifications
  for update
  to authenticated
  using (
    assigned_to is null
    or assigned_to = meridian_current_member_name()
  )
  with check (
    assigned_to is null
    or assigned_to = meridian_current_member_name()
  );

comment on function meridian_current_member_name() is
  'Reads the Meridian member name from Supabase Auth JWT claims/user metadata. Used by production RLS policies.';

comment on policy "action_items authenticated va update assigned" on action_items is
  'Allows VA operators to update only assigned VA work after Supabase Auth cutover. Prototype anon policies must be removed before this becomes restrictive.';
