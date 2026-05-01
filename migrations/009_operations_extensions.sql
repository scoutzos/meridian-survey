-- =============================================================================
-- Meridian Operations Extensions — notifications, risk register, vendors,
-- and contextual documents.
--
-- Uses `meridian_` table names to avoid touching unrelated/shared tables.
-- Idempotent: safe to re-run.
-- =============================================================================

create table if not exists meridian_notifications (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text,
  notification_type text not null default 'info',
  priority        text not null default 'normal'
                    check (priority in ('normal','high','urgent')),
  assigned_to     text,
  href            text,
  source_table    text,
  source_id       text,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  created_by      text
);

create index if not exists meridian_notifications_assigned_idx
  on meridian_notifications(assigned_to, created_at desc) where read_at is null;

create table if not exists meridian_project_risks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references meridian_projects(id) on delete cascade,
  deal_id         uuid references meridian_deals(id) on delete set null,
  title           text not null,
  likelihood      text not null default 'medium'
                    check (likelihood in ('low','medium','high')),
  impact          text not null default 'medium'
                    check (impact in ('low','medium','high')),
  mitigation      text,
  owner           text,
  status          text not null default 'open'
                    check (status in ('open','monitoring','mitigated','closed')),
  next_review_date date,
  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  deleted_at      timestamptz
);

create index if not exists meridian_project_risks_project_idx
  on meridian_project_risks(project_id, status) where deleted_at is null;

create table if not exists meridian_vendors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  company         text,
  role            text not null default 'Contractor',
  phone           text,
  email           text,
  reliability     text,
  pricing_notes   text,
  general_notes   text,
  created_at      timestamptz not null default now(),
  created_by      text,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  deleted_at      timestamptz
);

create index if not exists meridian_vendors_role_idx
  on meridian_vendors(role) where deleted_at is null;

create table if not exists meridian_project_vendors (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references meridian_projects(id) on delete cascade,
  vendor_id       uuid not null references meridian_vendors(id) on delete cascade,
  scope           text,
  status          text not null default 'active'
                    check (status in ('active','quoted','completed','inactive')),
  created_at      timestamptz not null default now(),
  created_by      text,
  unique(project_id, vendor_id)
);

create index if not exists meridian_project_vendors_project_idx
  on meridian_project_vendors(project_id);

create table if not exists meridian_project_documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references meridian_projects(id) on delete cascade,
  deal_id         uuid references meridian_deals(id) on delete set null,
  title           text not null,
  category        text not null default 'Other',
  url             text,
  notes           text,
  uploaded_by     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists meridian_project_documents_project_idx
  on meridian_project_documents(project_id, category) where deleted_at is null;

comment on table meridian_notifications is 'In-app notifications and alerts for Meridian operations.';
comment on table meridian_project_risks is 'Project/deal risk register items.';
comment on table meridian_vendors is 'Vendor and partner contact directory.';
comment on table meridian_project_vendors is 'Project-to-vendor assignments.';
comment on table meridian_project_documents is 'Project/deal document references.';

