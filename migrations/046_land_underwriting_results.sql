-- =============================================================================
-- Land underwriting results.
--
-- Stores automatic calculator outputs by imported property and exit type.
-- =============================================================================

create table if not exists meridian_land_underwriting_results (
  id                    uuid primary key default gen_random_uuid(),
  lead_id               uuid not null references meridian_imported_land_leads(id) on delete cascade,
  exit_type             text not null
                          check (exit_type in ('land-flip','retail-resale','neighbor-sale','assignment','subdivide','pass')),
  label                 text not null,
  status                text not null
                          check (status in ('strong','possible','weak','pass')),
  max_offer             numeric,
  required_ppa          numeric,
  required_resale_value numeric,
  projected_spread      numeric,
  land_insights_ppa     numeric,
  land_insights_value   numeric,
  key_assumption        text,
  blocker               text,
  next_step             text,
  rank                  integer not null default 0,
  assumptions           jsonb not null default '{}'::jsonb,
  input_snapshot        jsonb not null default '{}'::jsonb,
  calculated_at         timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (lead_id, exit_type)
);

create index if not exists meridian_land_underwriting_results_lead_idx
  on meridian_land_underwriting_results(lead_id, rank desc);

create index if not exists meridian_land_underwriting_results_status_idx
  on meridian_land_underwriting_results(status, exit_type, rank desc);

create index if not exists meridian_land_underwriting_results_offer_idx
  on meridian_land_underwriting_results(max_offer desc)
  where max_offer is not null;

alter table if exists meridian_land_underwriting_results enable row level security;

drop policy if exists "meridian_land_underwriting_results anon select"
  on meridian_land_underwriting_results;
drop policy if exists "meridian_land_underwriting_results anon insert"
  on meridian_land_underwriting_results;
drop policy if exists "meridian_land_underwriting_results anon update"
  on meridian_land_underwriting_results;
drop policy if exists "meridian_land_underwriting_results anon delete"
  on meridian_land_underwriting_results;

create policy "meridian_land_underwriting_results anon select"
  on meridian_land_underwriting_results
  for select
  to anon
  using (true);

create policy "meridian_land_underwriting_results anon insert"
  on meridian_land_underwriting_results
  for insert
  to anon
  with check (true);

create policy "meridian_land_underwriting_results anon update"
  on meridian_land_underwriting_results
  for update
  to anon
  using (true)
  with check (true);

create policy "meridian_land_underwriting_results anon delete"
  on meridian_land_underwriting_results
  for delete
  to anon
  using (true);

comment on table meridian_land_underwriting_results is
  'Automatic land calculator outputs for each imported property and modeled exit type.';
