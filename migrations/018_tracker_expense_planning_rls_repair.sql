-- Repair prototype RLS policies for expense planning tables.
--
-- The app still uses localStorage-based member identity with the Supabase anon
-- client. Until Supabase Auth replaces that model, these tables need permissive
-- anon/authenticated policies like the rest of the prototype tracker tables.

alter table if exists tracker_expense_proposals enable row level security;
alter table if exists tracker_expense_proposal_offsets enable row level security;
alter table if exists tracker_expense_proposal_votes enable row level security;

drop policy if exists "tracker_expense_proposals prototype read" on tracker_expense_proposals;
drop policy if exists "tracker_expense_proposals prototype write" on tracker_expense_proposals;
drop policy if exists "tracker_expense_proposals prototype anon read" on tracker_expense_proposals;
drop policy if exists "tracker_expense_proposals prototype anon write" on tracker_expense_proposals;
create policy "tracker_expense_proposals prototype read"
  on tracker_expense_proposals for select
  to anon, authenticated
  using (true);
create policy "tracker_expense_proposals prototype write"
  on tracker_expense_proposals for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "tracker_expense_proposal_offsets prototype read" on tracker_expense_proposal_offsets;
drop policy if exists "tracker_expense_proposal_offsets prototype write" on tracker_expense_proposal_offsets;
drop policy if exists "tracker_expense_proposal_offsets prototype anon read" on tracker_expense_proposal_offsets;
drop policy if exists "tracker_expense_proposal_offsets prototype anon write" on tracker_expense_proposal_offsets;
create policy "tracker_expense_proposal_offsets prototype read"
  on tracker_expense_proposal_offsets for select
  to anon, authenticated
  using (true);
create policy "tracker_expense_proposal_offsets prototype write"
  on tracker_expense_proposal_offsets for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "tracker_expense_proposal_votes prototype read" on tracker_expense_proposal_votes;
drop policy if exists "tracker_expense_proposal_votes prototype write" on tracker_expense_proposal_votes;
drop policy if exists "tracker_expense_proposal_votes prototype anon read" on tracker_expense_proposal_votes;
drop policy if exists "tracker_expense_proposal_votes prototype anon write" on tracker_expense_proposal_votes;
create policy "tracker_expense_proposal_votes prototype read"
  on tracker_expense_proposal_votes for select
  to anon, authenticated
  using (true);
create policy "tracker_expense_proposal_votes prototype write"
  on tracker_expense_proposal_votes for all
  to anon, authenticated
  using (true)
  with check (true);
