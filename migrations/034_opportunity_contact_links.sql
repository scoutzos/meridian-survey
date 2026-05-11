-- Meridian opportunity/contact links.
--
-- Contacts are people/companies. Deals are the opportunity file. This bridge
-- lets one contact participate in many opportunities, and one opportunity have
-- many contacts with clear roles.

create table if not exists meridian_opportunity_contacts (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references meridian_deals(id) on delete cascade,
  contact_id          uuid not null references meridian_crm_contacts(id) on delete cascade,
  role                text not null default 'seller'
    check (role in ('seller','owner','co-owner','buyer','agent','broker','builder','neighbor','title','lender','vendor','member','attorney','other')),
  is_primary          boolean not null default false,
  relationship_notes  text,
  source_system       text,
  source_table        text,
  source_id           uuid,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create unique index if not exists meridian_opportunity_contacts_active_unique_idx
  on meridian_opportunity_contacts(deal_id, contact_id, role)
  where deleted_at is null;

create index if not exists meridian_opportunity_contacts_deal_idx
  on meridian_opportunity_contacts(deal_id, role)
  where deleted_at is null;

create index if not exists meridian_opportunity_contacts_contact_idx
  on meridian_opportunity_contacts(contact_id, role)
  where deleted_at is null;

alter table meridian_opportunity_contacts enable row level security;

drop policy if exists "meridian_opportunity_contacts prototype anon read" on meridian_opportunity_contacts;
drop policy if exists "meridian_opportunity_contacts prototype anon write" on meridian_opportunity_contacts;
create policy "meridian_opportunity_contacts prototype anon read"
  on meridian_opportunity_contacts for select to anon using (true);
create policy "meridian_opportunity_contacts prototype anon write"
  on meridian_opportunity_contacts for all to anon using (true) with check (true);

with deal_sellers as (
  select
    id as deal_id,
    nullif(trim(seller_name), '') as seller_name,
    nullif(trim(seller_phone), '') as seller_phone,
    created_by,
    updated_by
  from meridian_deals
  where deleted_at is null
    and (nullif(trim(seller_name), '') is not null or nullif(trim(seller_phone), '') is not null)
),
contacts_to_create as (
  select distinct on (
    coalesce(regexp_replace(seller_phone, '\D', '', 'g'), ''),
    lower(coalesce(seller_name, seller_phone, 'Unknown seller'))
  )
    seller_name,
    seller_phone,
    coalesce(updated_by, created_by) as actor
  from deal_sellers ds
  where not exists (
    select 1
    from meridian_crm_contacts c
    where c.deleted_at is null
      and (
        (ds.seller_phone is not null and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(ds.seller_phone, '\D', '', 'g'))
        or (ds.seller_phone is null and ds.seller_name is not null and lower(c.display_name) = lower(ds.seller_name))
      )
  )
)
insert into meridian_crm_contacts (
  contact_type,
  display_name,
  phone,
  tags,
  source_system,
  created_by,
  updated_by
)
select
  'seller',
  coalesce(seller_name, seller_phone, 'Unknown seller'),
  seller_phone,
  array['auto-linked','deal-seller'],
  'deal-backfill',
  actor,
  actor
from contacts_to_create;

with deal_sellers as (
  select
    id as deal_id,
    nullif(trim(seller_name), '') as seller_name,
    nullif(trim(seller_phone), '') as seller_phone,
    coalesce(updated_by, created_by) as actor
  from meridian_deals
  where deleted_at is null
    and (nullif(trim(seller_name), '') is not null or nullif(trim(seller_phone), '') is not null)
),
matched as (
  select distinct on (ds.deal_id)
    ds.deal_id,
    c.id as contact_id,
    ds.actor
  from deal_sellers ds
  join meridian_crm_contacts c
    on c.deleted_at is null
   and (
      (ds.seller_phone is not null and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(ds.seller_phone, '\D', '', 'g'))
      or (ds.seller_phone is null and ds.seller_name is not null and lower(c.display_name) = lower(ds.seller_name))
   )
  order by ds.deal_id, c.updated_at desc
)
insert into meridian_opportunity_contacts (
  deal_id,
  contact_id,
  role,
  is_primary,
  source_system,
  source_table,
  source_id,
  created_by,
  updated_by
)
select
  deal_id,
  contact_id,
  'seller',
  true,
  'deal-backfill',
  'meridian_deals',
  deal_id,
  actor,
  actor
from matched
on conflict do nothing;

comment on table meridian_opportunity_contacts is 'Role-based bridge between CRM contacts and opportunity/deal files.';
