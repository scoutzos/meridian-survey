-- =============================================================================
-- Land research workflow.
--
-- Stores property-level due diligence checks and comp records for imported land
-- leads before they become full opportunity packets.
-- =============================================================================

create table if not exists meridian_land_due_diligence_items (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references meridian_imported_land_leads(id) on delete cascade,
  category        text not null
                    check (category in ('access','flood','wetlands','zoning','tax','gis','comps','ownership','utilities','notes')),
  title           text not null,
  status          text not null default 'todo'
                    check (status in ('todo','in-progress','verified','blocked','not-applicable')),
  result_summary  text,
  source_name     text,
  source_url      text,
  evidence_value  text,
  verified_by     text,
  verified_at     timestamptz,
  notes           text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists meridian_land_due_diligence_items_lead_idx
  on meridian_land_due_diligence_items(lead_id, sort_order, created_at);

create index if not exists meridian_land_due_diligence_items_status_idx
  on meridian_land_due_diligence_items(status, category);

create table if not exists meridian_land_comp_records (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid not null references meridian_imported_land_leads(id) on delete cascade,
  comp_type          text not null default 'sold'
                       check (comp_type in ('sold','active','pending','expired','manual-note')),
  address            text,
  parcel_id          text,
  county             text,
  state              text,
  price              numeric,
  acreage            numeric,
  price_per_acre     numeric,
  sale_or_list_date  date,
  distance_miles     numeric,
  source_system      text,
  source_url         text,
  similarity_notes   text,
  adjustment_notes   text,
  include_in_valuation boolean not null default true,
  confidence         text not null default 'needs-review'
                       check (confidence in ('high','medium','low','needs-review')),
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists meridian_land_comp_records_lead_idx
  on meridian_land_comp_records(lead_id, include_in_valuation, comp_type);

create index if not exists meridian_land_comp_records_ppa_idx
  on meridian_land_comp_records(lead_id, price_per_acre)
  where price_per_acre is not null;

alter table if exists meridian_land_due_diligence_items enable row level security;
alter table if exists meridian_land_comp_records enable row level security;

drop policy if exists "meridian_land_due_diligence_items anon select" on meridian_land_due_diligence_items;
drop policy if exists "meridian_land_due_diligence_items anon insert" on meridian_land_due_diligence_items;
drop policy if exists "meridian_land_due_diligence_items anon update" on meridian_land_due_diligence_items;
drop policy if exists "meridian_land_due_diligence_items anon delete" on meridian_land_due_diligence_items;

create policy "meridian_land_due_diligence_items anon select"
  on meridian_land_due_diligence_items for select to anon using (true);
create policy "meridian_land_due_diligence_items anon insert"
  on meridian_land_due_diligence_items for insert to anon with check (true);
create policy "meridian_land_due_diligence_items anon update"
  on meridian_land_due_diligence_items for update to anon using (true) with check (true);
create policy "meridian_land_due_diligence_items anon delete"
  on meridian_land_due_diligence_items for delete to anon using (true);

drop policy if exists "meridian_land_comp_records anon select" on meridian_land_comp_records;
drop policy if exists "meridian_land_comp_records anon insert" on meridian_land_comp_records;
drop policy if exists "meridian_land_comp_records anon update" on meridian_land_comp_records;
drop policy if exists "meridian_land_comp_records anon delete" on meridian_land_comp_records;

create policy "meridian_land_comp_records anon select"
  on meridian_land_comp_records for select to anon using (true);
create policy "meridian_land_comp_records anon insert"
  on meridian_land_comp_records for insert to anon with check (true);
create policy "meridian_land_comp_records anon update"
  on meridian_land_comp_records for update to anon using (true) with check (true);
create policy "meridian_land_comp_records anon delete"
  on meridian_land_comp_records for delete to anon using (true);

comment on table meridian_land_due_diligence_items is
  'Property-level due diligence checklist items attached to imported land leads.';

comment on table meridian_land_comp_records is
  'Sold, active, and manual comp records attached to imported land leads.';
