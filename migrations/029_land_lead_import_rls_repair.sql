-- =============================================================================
-- Meridian land lead import RLS repair.
--
-- If RLS is enabled before the prototype anon policies exist, CSV imports fail
-- with: new row violates row-level security policy. This repair explicitly
-- grants the current app client read/write access to the land lead import
-- tables. Replace with Supabase Auth role-aware policies before production.
-- =============================================================================

alter table if exists meridian_land_lead_import_batches enable row level security;
alter table if exists meridian_imported_land_leads enable row level security;
alter table if exists meridian_imported_land_lead_activities enable row level security;

drop policy if exists "meridian_land_lead_import_batches prototype anon read"
  on meridian_land_lead_import_batches;
drop policy if exists "meridian_land_lead_import_batches prototype anon write"
  on meridian_land_lead_import_batches;
drop policy if exists "meridian_land_lead_import_batches anon select"
  on meridian_land_lead_import_batches;
drop policy if exists "meridian_land_lead_import_batches anon insert"
  on meridian_land_lead_import_batches;
drop policy if exists "meridian_land_lead_import_batches anon update"
  on meridian_land_lead_import_batches;

create policy "meridian_land_lead_import_batches anon select"
  on meridian_land_lead_import_batches
  for select
  to anon
  using (true);

create policy "meridian_land_lead_import_batches anon insert"
  on meridian_land_lead_import_batches
  for insert
  to anon
  with check (true);

create policy "meridian_land_lead_import_batches anon update"
  on meridian_land_lead_import_batches
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "meridian_imported_land_leads prototype anon read"
  on meridian_imported_land_leads;
drop policy if exists "meridian_imported_land_leads prototype anon write"
  on meridian_imported_land_leads;
drop policy if exists "meridian_imported_land_leads anon select"
  on meridian_imported_land_leads;
drop policy if exists "meridian_imported_land_leads anon insert"
  on meridian_imported_land_leads;
drop policy if exists "meridian_imported_land_leads anon update"
  on meridian_imported_land_leads;

create policy "meridian_imported_land_leads anon select"
  on meridian_imported_land_leads
  for select
  to anon
  using (true);

create policy "meridian_imported_land_leads anon insert"
  on meridian_imported_land_leads
  for insert
  to anon
  with check (true);

create policy "meridian_imported_land_leads anon update"
  on meridian_imported_land_leads
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "meridian_imported_land_lead_activities prototype anon read"
  on meridian_imported_land_lead_activities;
drop policy if exists "meridian_imported_land_lead_activities prototype anon write"
  on meridian_imported_land_lead_activities;
drop policy if exists "meridian_imported_land_lead_activities anon select"
  on meridian_imported_land_lead_activities;
drop policy if exists "meridian_imported_land_lead_activities anon insert"
  on meridian_imported_land_lead_activities;

create policy "meridian_imported_land_lead_activities anon select"
  on meridian_imported_land_lead_activities
  for select
  to anon
  using (true);

create policy "meridian_imported_land_lead_activities anon insert"
  on meridian_imported_land_lead_activities
  for insert
  to anon
  with check (true);
