-- =============================================================================
-- Meridian Deal Desk — deal intake, analysis, generated diligence, and votes.
--
-- This migration intentionally uses `meridian_` table names so it does not
-- alter any generic/shared tables such as an existing `deals` table.
--
-- Idempotent: safe to re-run.
-- =============================================================================

create table if not exists meridian_deals (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  source          text,
  property_type   text not null default 'land'
                    check (property_type in ('land','house','rental','commercial','other')),
  strategy        text not null default 'review',
  status          text not null default 'under-review'
                    check (status in ('lead','under-review','offer-made','under-contract','due-diligence','closed','active-project','stabilized','sold','passed')),
  urgency         text not null default 'routine'
                    check (urgency in ('routine','time-sensitive','hot')),

  address         text,
  parcel_id       text,
  seller_name     text,
  seller_phone    text,
  asking_price    numeric,
  arv             numeric,
  repair_estimate numeric,
  acreage         numeric,
  zoning          text,
  road_frontage   text,
  utilities       text,
  notes           text,
  links           jsonb not null default '[]'::jsonb,
  analysis        jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  deleted_at      timestamptz
);

create index if not exists meridian_deals_status_idx
  on meridian_deals(status) where deleted_at is null;
create index if not exists meridian_deals_urgency_idx
  on meridian_deals(urgency) where deleted_at is null;
create index if not exists meridian_deals_created_idx
  on meridian_deals(created_at desc) where deleted_at is null;

create table if not exists meridian_deal_due_diligence_items (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references meridian_deals(id) on delete cascade,
  title               text not null,
  why_it_matters      text,
  required_evidence   text,
  status              text not null default 'open'
                        check (status in ('open','in-review','cleared','blocked','not-applicable')),
  owner               text,
  due_date            date,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          text
);

create index if not exists meridian_deal_due_diligence_deal_idx
  on meridian_deal_due_diligence_items(deal_id, sort_order);

create table if not exists meridian_deal_votes (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references meridian_deals(id) on delete cascade,
  member_name   text not null,
  vote          text not null
                  check (vote in ('pass','needs-more-info','schedule-call','make-offer','counter','urgent-review')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(deal_id, member_name)
);

create index if not exists meridian_deal_votes_deal_idx
  on meridian_deal_votes(deal_id);

comment on table meridian_deals is 'Meridian Deal Desk intake records with computed deal analysis.';
comment on table meridian_deal_due_diligence_items is 'Generated checklist items for each Meridian deal.';
comment on table meridian_deal_votes is 'Member rapid-decision votes on Meridian deal records.';

