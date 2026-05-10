-- Meridian CRM spine: contacts, properties, buyers, disposition campaigns/offers, and reusable templates.

create table if not exists meridian_crm_contacts (
  id                  uuid primary key default gen_random_uuid(),
  contact_type        text not null default 'seller'
    check (contact_type in ('seller','buyer','agent','broker','builder','neighbor','title','lender','vendor','member','other')),
  display_name        text not null,
  company_name        text,
  phone               text,
  phone_2             text,
  email               text,
  mailing_address     text,
  county              text,
  state               text,
  tags                text[] not null default '{}',
  relationship_status text default 'new'
    check (relationship_status is null or relationship_status in ('new','active','warm','nurture','do-not-contact','inactive')),
  sms_opt_status      text not null default 'unknown'
    check (sms_opt_status in ('unknown','opted-in','opted-out')),
  last_contacted_at   timestamptz,
  last_contacted_by   text,
  notes               text,
  source_system       text,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create table if not exists meridian_crm_properties (
  id                  uuid primary key default gen_random_uuid(),
  property_type       text not null default 'land',
  parcel_id           text,
  address             text,
  county              text,
  city                text,
  state               text,
  zip                 text,
  acreage             numeric,
  zoning              text,
  land_use            text,
  road_frontage       text,
  utilities           text,
  flood_notes         text,
  wetlands_notes      text,
  property_url        text,
  map_url             text,
  assessed_value      numeric,
  market_value        numeric,
  raw_data            jsonb not null default '{}'::jsonb,
  notes               text,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create table if not exists meridian_crm_buyers (
  id                      uuid primary key default gen_random_uuid(),
  contact_id              uuid references meridian_crm_contacts(id) on delete set null,
  buyer_name              text not null,
  buyer_type              text,
  markets                 text[] not null default '{}',
  property_types          text[] not null default '{}',
  min_price               numeric,
  max_price               numeric,
  min_acreage             numeric,
  max_acreage             numeric,
  proof_of_funds_status   text default 'unknown'
    check (proof_of_funds_status in ('unknown','requested','received','verified','expired')),
  relationship_strength   text default 'new'
    check (relationship_strength in ('new','warm','active','preferred','inactive')),
  buy_box                 text,
  notes                   text,
  last_contacted_at       timestamptz,
  created_at              timestamptz not null default now(),
  created_by              text,
  updated_at              timestamptz not null default now(),
  updated_by              text,
  deleted_at              timestamptz
);

create table if not exists meridian_disposition_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid references meridian_deals(id) on delete cascade,
  property_id         uuid references meridian_crm_properties(id) on delete set null,
  campaign_name       text not null,
  status              text not null default 'not-started'
    check (status in ('not-started','buyer-list-built','marketed','buyer-interest','offer-received','buyer-under-contract','closing-scheduled','closed','fell-through')),
  exit_strategy       text,
  target_buyer_type   text,
  target_price        numeric,
  minimum_price       numeric,
  owner               text,
  marketed_at         timestamptz,
  channels            text[] not null default '{}',
  buyer_list_count    integer not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create table if not exists meridian_buyer_offers (
  id                  uuid primary key default gen_random_uuid(),
  disposition_campaign_id uuid references meridian_disposition_campaigns(id) on delete cascade,
  deal_id             uuid references meridian_deals(id) on delete cascade,
  buyer_id            uuid references meridian_crm_buyers(id) on delete set null,
  contact_id          uuid references meridian_crm_contacts(id) on delete set null,
  buyer_name          text not null,
  offer_amount        numeric not null,
  earnest_money       numeric,
  close_date          date,
  contingencies       text,
  proof_of_funds_status text,
  status              text not null default 'received'
    check (status in ('received','countered','accepted','rejected','withdrawn','expired')),
  notes               text,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create table if not exists meridian_crm_activity (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid references meridian_crm_contacts(id) on delete set null,
  property_id     uuid references meridian_crm_properties(id) on delete set null,
  deal_id         uuid references meridian_deals(id) on delete set null,
  buyer_id        uuid references meridian_crm_buyers(id) on delete set null,
  activity_type   text not null,
  summary         text not null,
  actor           text,
  source_table    text,
  source_id       uuid,
  field_changes   jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists meridian_crm_templates (
  id              uuid primary key default gen_random_uuid(),
  template_type   text not null
    check (template_type in ('seller-sms','buyer-sms','seller-call','buyer-call','email','task','brief')),
  name            text not null,
  body            text not null,
  tags            text[] not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text
);

create index if not exists meridian_crm_contacts_phone_idx
  on meridian_crm_contacts(phone)
  where deleted_at is null;
create index if not exists meridian_crm_contacts_type_idx
  on meridian_crm_contacts(contact_type, updated_at desc)
  where deleted_at is null;
create index if not exists meridian_crm_properties_parcel_idx
  on meridian_crm_properties(parcel_id)
  where deleted_at is null;
create index if not exists meridian_crm_buyers_market_idx
  on meridian_crm_buyers using gin(markets);
create index if not exists meridian_disposition_campaigns_status_idx
  on meridian_disposition_campaigns(status, updated_at desc)
  where deleted_at is null;
create index if not exists meridian_buyer_offers_deal_idx
  on meridian_buyer_offers(deal_id, offer_amount desc)
  where deleted_at is null;
create index if not exists meridian_crm_activity_deal_idx
  on meridian_crm_activity(deal_id, created_at desc);

alter table meridian_crm_contacts enable row level security;
alter table meridian_crm_properties enable row level security;
alter table meridian_crm_buyers enable row level security;
alter table meridian_disposition_campaigns enable row level security;
alter table meridian_buyer_offers enable row level security;
alter table meridian_crm_activity enable row level security;
alter table meridian_crm_templates enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'meridian_crm_contacts',
    'meridian_crm_properties',
    'meridian_crm_buyers',
    'meridian_disposition_campaigns',
    'meridian_buyer_offers',
    'meridian_crm_activity',
    'meridian_crm_templates'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%s prototype anon read" on %I', t, t);
    execute format('drop policy if exists "%s prototype anon write" on %I', t, t);
    execute format('create policy "%s prototype anon read" on %I for select to anon using (true)', t, t);
    execute format('create policy "%s prototype anon write" on %I for all to anon using (true) with check (true)', t, t);
  end loop;
end $$;

comment on table meridian_crm_contacts is 'Unified CRM contacts for sellers, buyers, vendors, neighbors, agents, and deal participants.';
comment on table meridian_crm_properties is 'Property/parcel records separated from lead and deal lifecycle records.';
comment on table meridian_disposition_campaigns is 'Buyer-side marketing and disposition workflow tied to deals and properties.';
