-- =============================================================================
-- Reusable land comp records.
--
-- A comp now has two layers:
-- 1. meridian_land_comp_properties stores the reusable comp/listing itself.
-- 2. meridian_land_comp_links stores how that comp relates to a subject lead.
-- =============================================================================

create table if not exists meridian_land_comp_properties (
  id                 uuid primary key default gen_random_uuid(),
  comp_key           text not null unique,
  comp_type          text not null default 'sold'
                       check (comp_type in ('sold','active','pending','expired','manual-note')),
  address            text,
  parcel_id          text,
  county             text,
  city               text,
  state              text,
  zip                text,
  latitude           numeric,
  longitude          numeric,
  price              numeric,
  acreage            numeric,
  price_per_acre     numeric,
  sale_or_list_date  date,
  source_system      text,
  source_url         text,
  listing_text       text,
  listing_details    jsonb not null default '{}'::jsonb,
  raw_data           jsonb not null default '{}'::jsonb,
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists meridian_land_comp_links (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null references meridian_imported_land_leads(id) on delete cascade,
  comp_property_id    uuid not null references meridian_land_comp_properties(id) on delete cascade,
  relationship_status text not null default 'accepted'
                        check (relationship_status in ('potential','accepted','rejected')),
  distance_miles      numeric,
  similarity_score    numeric,
  match_reason        text,
  similarity_notes    text,
  adjustment_notes    text,
  include_in_valuation boolean not null default true,
  confidence          text not null default 'needs-review'
                        check (confidence in ('high','medium','low','needs-review')),
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (lead_id, comp_property_id)
);

create index if not exists meridian_land_comp_properties_location_idx
  on meridian_land_comp_properties(state, county, zip);

create index if not exists meridian_land_comp_properties_value_idx
  on meridian_land_comp_properties(comp_type, sale_or_list_date, price_per_acre)
  where price_per_acre is not null;

create index if not exists meridian_land_comp_properties_parcel_idx
  on meridian_land_comp_properties(state, county, parcel_id)
  where parcel_id is not null;

create index if not exists meridian_land_comp_links_lead_idx
  on meridian_land_comp_links(lead_id, relationship_status, include_in_valuation);

create index if not exists meridian_land_comp_links_property_idx
  on meridian_land_comp_links(comp_property_id);

alter table if exists meridian_land_comp_properties enable row level security;
alter table if exists meridian_land_comp_links enable row level security;

drop policy if exists "meridian_land_comp_properties anon select" on meridian_land_comp_properties;
drop policy if exists "meridian_land_comp_properties anon insert" on meridian_land_comp_properties;
drop policy if exists "meridian_land_comp_properties anon update" on meridian_land_comp_properties;
drop policy if exists "meridian_land_comp_properties anon delete" on meridian_land_comp_properties;

create policy "meridian_land_comp_properties anon select"
  on meridian_land_comp_properties for select to anon using (true);
create policy "meridian_land_comp_properties anon insert"
  on meridian_land_comp_properties for insert to anon with check (true);
create policy "meridian_land_comp_properties anon update"
  on meridian_land_comp_properties for update to anon using (true) with check (true);
create policy "meridian_land_comp_properties anon delete"
  on meridian_land_comp_properties for delete to anon using (true);

drop policy if exists "meridian_land_comp_links anon select" on meridian_land_comp_links;
drop policy if exists "meridian_land_comp_links anon insert" on meridian_land_comp_links;
drop policy if exists "meridian_land_comp_links anon update" on meridian_land_comp_links;
drop policy if exists "meridian_land_comp_links anon delete" on meridian_land_comp_links;

create policy "meridian_land_comp_links anon select"
  on meridian_land_comp_links for select to anon using (true);
create policy "meridian_land_comp_links anon insert"
  on meridian_land_comp_links for insert to anon with check (true);
create policy "meridian_land_comp_links anon update"
  on meridian_land_comp_links for update to anon using (true) with check (true);
create policy "meridian_land_comp_links anon delete"
  on meridian_land_comp_links for delete to anon using (true);

with legacy_comp_properties as (
  select
    c.*,
    coalesce(
      nullif('url:' || lower(trim(c.source_url)), 'url:'),
      nullif('parcel:' || lower(trim(coalesce(c.state, ''))) || ':' || lower(trim(coalesce(c.county, ''))) || ':' || lower(trim(c.parcel_id)), 'parcel:::'),
      nullif('addr:' || md5(lower(trim(coalesce(c.address, ''))) || ':' || coalesce(c.price::text, '') || ':' || coalesce(c.acreage::text, '')), 'addr:' || md5('::')),
      'legacy:' || c.id::text
    ) as comp_key_value
  from meridian_land_comp_records c
)
insert into meridian_land_comp_properties (
  comp_key,
  comp_type,
  address,
  parcel_id,
  county,
  state,
  price,
  acreage,
  price_per_acre,
  sale_or_list_date,
  source_system,
  source_url,
  raw_data,
  created_by,
  created_at,
  updated_at
)
select distinct on (comp_key_value)
  comp_key_value,
  comp_type,
  address,
  parcel_id,
  county,
  state,
  price,
  acreage,
  price_per_acre,
  sale_or_list_date,
  source_system,
  source_url,
  '{}'::jsonb,
  created_by,
  created_at,
  updated_at
from legacy_comp_properties
order by comp_key_value, updated_at desc
on conflict (comp_key) do nothing;

with legacy_comp_properties as (
  select
    c.*,
    coalesce(
      nullif('url:' || lower(trim(c.source_url)), 'url:'),
      nullif('parcel:' || lower(trim(coalesce(c.state, ''))) || ':' || lower(trim(coalesce(c.county, ''))) || ':' || lower(trim(c.parcel_id)), 'parcel:::'),
      nullif('addr:' || md5(lower(trim(coalesce(c.address, ''))) || ':' || coalesce(c.price::text, '') || ':' || coalesce(c.acreage::text, '')), 'addr:' || md5('::')),
      'legacy:' || c.id::text
    ) as comp_key_value
  from meridian_land_comp_records c
)
insert into meridian_land_comp_links (
  lead_id,
  comp_property_id,
  relationship_status,
  distance_miles,
  similarity_notes,
  adjustment_notes,
  include_in_valuation,
  confidence,
  created_by,
  created_at,
  updated_at
)
select
  legacy.lead_id,
  prop.id,
  'accepted',
  legacy.distance_miles,
  legacy.similarity_notes,
  legacy.adjustment_notes,
  legacy.include_in_valuation,
  legacy.confidence,
  legacy.created_by,
  legacy.created_at,
  legacy.updated_at
from legacy_comp_properties legacy
join meridian_land_comp_properties prop on prop.comp_key = legacy.comp_key_value
on conflict (lead_id, comp_property_id) do nothing;

comment on table meridian_land_comp_properties is
  'Reusable land comp/listing records with parsed source details and listing text.';

comment on table meridian_land_comp_links is
  'Links reusable comp records to subject land leads with relationship-specific confidence, inclusion, and adjustment notes.';
