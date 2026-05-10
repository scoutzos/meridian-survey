-- =============================================================================
-- Meridian land lead imports.
--
-- Stores CSV list uploads from Land Portal, Land Insights, and similar lead
-- sources so the VA can search imported records and convert interested sellers
-- into deal packets with pre-filled fields.
-- =============================================================================

create table if not exists meridian_land_lead_import_batches (
  id              uuid primary key default gen_random_uuid(),
  source_system   text not null default 'land-list',
  original_filename text,
  campaign_source text,
  row_count       integer not null default 0,
  uploaded_by     text references meridian_members(name) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists meridian_land_lead_import_batches_created_idx
  on meridian_land_lead_import_batches(created_at desc);

create table if not exists meridian_imported_land_leads (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid references meridian_land_lead_import_batches(id) on delete cascade,
  source_system   text not null default 'land-list',
  campaign_source text,
  owner_name      text,
  phone           text,
  phone_2         text,
  email           text,
  property_address text,
  parcel_id       text,
  county          text,
  city            text,
  state           text,
  zip             text,
  mailing_address text,
  acreage         numeric,
  asking_price    numeric,
  assessed_value  numeric,
  market_value    numeric,
  zoning          text,
  land_use        text,
  property_url    text,
  status          text not null default 'new'
                    check (status in ('new','contacted','interested','converted','passed')),
  deal_id         uuid references meridian_deals(id) on delete set null,
  notes           text,
  raw_data        jsonb not null default '{}'::jsonb,
  uploaded_by     text references meridian_members(name) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists meridian_imported_land_leads_search_idx
  on meridian_imported_land_leads(owner_name, parcel_id, property_address);

create index if not exists meridian_imported_land_leads_status_idx
  on meridian_imported_land_leads(status, created_at desc);

