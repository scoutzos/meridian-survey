-- =============================================================================
-- Prototype RLS policies for membership candidate intake and voting.
--
-- The app currently uses the Supabase anon client plus app-level member login,
-- matching the existing prototype portal tables. Replace these policies with
-- Supabase Auth-backed member/applicant policies before production hardening.
-- =============================================================================

alter table if exists membership_candidates enable row level security;
alter table if exists membership_candidate_votes enable row level security;

drop policy if exists "membership_candidates prototype anon read" on membership_candidates;
drop policy if exists "membership_candidates prototype anon insert" on membership_candidates;
drop policy if exists "membership_candidates prototype anon update" on membership_candidates;

create policy "membership_candidates prototype anon read"
  on membership_candidates for select to anon using (true);

create policy "membership_candidates prototype anon insert"
  on membership_candidates for insert to anon with check (true);

create policy "membership_candidates prototype anon update"
  on membership_candidates for update to anon using (true) with check (true);

drop policy if exists "membership_candidate_votes prototype anon read" on membership_candidate_votes;
drop policy if exists "membership_candidate_votes prototype anon write" on membership_candidate_votes;

create policy "membership_candidate_votes prototype anon read"
  on membership_candidate_votes for select to anon using (true);

create policy "membership_candidate_votes prototype anon write"
  on membership_candidate_votes for all to anon using (true) with check (true);

drop policy if exists "meridian_notifications membership candidate anon insert" on meridian_notifications;
drop policy if exists "meridian_notifications membership candidate anon update" on meridian_notifications;

create policy "meridian_notifications membership candidate anon insert"
  on meridian_notifications for insert to anon
  with check (notification_type in ('membership_candidate_vote', 'info'));

create policy "meridian_notifications membership candidate anon update"
  on meridian_notifications for update to anon
  using (notification_type = 'membership_candidate_vote')
  with check (notification_type = 'membership_candidate_vote');
