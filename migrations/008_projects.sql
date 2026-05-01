-- =============================================================================
-- Meridian Projects — operating records created from approved deals/assets.
--
-- Uses `meridian_` table names to avoid touching unrelated/shared tables.
-- Idempotent: safe to re-run.
-- =============================================================================

create table if not exists meridian_projects (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid references meridian_deals(id) on delete set null,
  name                text not null,
  property_type       text not null default 'land',
  strategy            text not null default 'review',
  status              text not null default 'active'
                        check (status in ('planning','due-diligence','under-contract','closed','active','stabilized','sold','paused','passed')),
  address             text,
  parcel_id           text,
  acquisition_price   numeric,
  target_exit_value   numeric,
  repair_budget       numeric,
  site_budget         numeric,
  budget_total        numeric,
  actual_spend        numeric not null default 0,
  contingency         numeric,
  next_step           text,
  risk_summary        text,
  notes               text,
  source_snapshot     jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create index if not exists meridian_projects_status_idx
  on meridian_projects(status) where deleted_at is null;
create index if not exists meridian_projects_deal_idx
  on meridian_projects(deal_id) where deleted_at is null;
create index if not exists meridian_projects_created_idx
  on meridian_projects(created_at desc) where deleted_at is null;

create table if not exists meridian_project_timeline_events (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references meridian_projects(id) on delete cascade,
  event_date      date,
  title           text not null,
  detail          text,
  event_type      text not null default 'milestone',
  created_at      timestamptz not null default now(),
  created_by      text
);

create index if not exists meridian_project_timeline_project_idx
  on meridian_project_timeline_events(project_id, event_date);

comment on table meridian_projects is 'Meridian project/asset operating records created from deals or entered directly.';
comment on table meridian_project_timeline_events is 'Milestones and events for Meridian projects.';

