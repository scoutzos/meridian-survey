-- =============================================================================
-- Meridian Governance + Finance Extensions — reimbursements, distributions,
-- scenarios, operating calendar, and generated memos.
--
-- Uses `meridian_` table names to avoid touching unrelated/shared tables.
-- Idempotent: safe to re-run.
-- =============================================================================

create table if not exists meridian_calendar_events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  event_date      date not null,
  event_time      text,
  event_type      text not null default 'deadline',
  project_id      uuid references meridian_projects(id) on delete set null,
  deal_id         uuid references meridian_deals(id) on delete set null,
  assigned_to     text,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  deleted_at      timestamptz
);

create index if not exists meridian_calendar_events_date_idx
  on meridian_calendar_events(event_date, event_type) where deleted_at is null;

create table if not exists meridian_reimbursements (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references meridian_projects(id) on delete set null,
  member_name     text not null,
  amount          numeric not null,
  vendor          text,
  category        text not null default 'Other',
  expense_date    date,
  receipt_url     text,
  notes           text,
  status          text not null default 'submitted'
                    check (status in ('submitted','approved','rejected','paid')),
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  deleted_at      timestamptz
);

create index if not exists meridian_reimbursements_status_idx
  on meridian_reimbursements(status, created_at desc) where deleted_at is null;

create table if not exists meridian_distributions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references meridian_projects(id) on delete set null,
  distribution_date date not null,
  total_amount    numeric not null,
  reason          text,
  status          text not null default 'proposed'
                    check (status in ('proposed','approved','paid','cancelled')),
  per_member_amount numeric,
  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  deleted_at      timestamptz
);

create index if not exists meridian_distributions_date_idx
  on meridian_distributions(distribution_date desc) where deleted_at is null;

create table if not exists meridian_deal_scenarios (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid references meridian_deals(id) on delete set null,
  project_id      uuid references meridian_projects(id) on delete set null,
  name            text not null,
  strategy        text not null default 'flip',
  purchase_price  numeric,
  rehab_or_site_cost numeric,
  closing_costs   numeric,
  holding_costs   numeric,
  financing_costs numeric,
  exit_value      numeric,
  expected_rent   numeric,
  projected_profit numeric,
  roi_percent     numeric,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  deleted_at      timestamptz
);

create index if not exists meridian_deal_scenarios_deal_idx
  on meridian_deal_scenarios(deal_id) where deleted_at is null;

create table if not exists meridian_generated_memos (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid references meridian_deals(id) on delete set null,
  project_id      uuid references meridian_projects(id) on delete set null,
  title           text not null,
  memo_type       text not null default 'deal-brief',
  body            text not null,
  created_at      timestamptz not null default now(),
  created_by      text,
  deleted_at      timestamptz
);

create index if not exists meridian_generated_memos_created_idx
  on meridian_generated_memos(created_at desc) where deleted_at is null;

comment on table meridian_calendar_events is 'Operating calendar items across deals, projects, votes, meetings, and capital events.';
comment on table meridian_reimbursements is 'Member reimbursement submissions and approval workflow.';
comment on table meridian_distributions is 'Member distribution records.';
comment on table meridian_deal_scenarios is 'Scenario models for deals and projects.';
comment on table meridian_generated_memos is 'Generated Meridian memo bodies for deal briefs, status reports, and decision packets.';

