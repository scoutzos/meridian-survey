-- =============================================================================
-- Deal activity authenticated RLS repair
--
-- The prototype policies allow anon reads/writes, but browsers with a Supabase
-- Auth session send requests as `authenticated`. This grants authenticated
-- Meridian users the same activity visibility/write path while the app finishes
-- the auth cutover.
-- =============================================================================

alter table if exists meridian_deal_activity enable row level security;

drop policy if exists "meridian_deal_activity authenticated read" on meridian_deal_activity;
drop policy if exists "meridian_deal_activity authenticated write" on meridian_deal_activity;

create policy "meridian_deal_activity authenticated read"
  on meridian_deal_activity
  for select
  to authenticated
  using (meridian_current_member_name() is not null);

create policy "meridian_deal_activity authenticated write"
  on meridian_deal_activity
  for insert
  to authenticated
  with check (
    meridian_current_member_name() is not null
    and (
      actor is null
      or actor = meridian_current_member_name()
      or meridian_is_va()
      or meridian_is_admin()
    )
  );
