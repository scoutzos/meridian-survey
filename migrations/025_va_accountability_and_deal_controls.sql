-- =============================================================================
-- Meridian VA accountability and deal controls.
--
-- Adds assignment/follow-up fields, deal activity audit records, lightweight
-- attachment records, and member review receipts for VA daily briefs.
-- =============================================================================

alter table meridian_deals
  add column if not exists submitted_by text references meridian_members(name) on delete set null,
  add column if not exists assigned_to text references meridian_members(name) on delete set null,
  add column if not exists next_follow_up_date date,
  add column if not exists lead_temperature text
    check (lead_temperature is null or lead_temperature in ('cold','warm','hot','dead')),
  add column if not exists campaign_source text;

create index if not exists meridian_deals_va_scope_idx
  on meridian_deals(submitted_by, assigned_to, updated_at desc)
  where deleted_at is null;

create table if not exists meridian_deal_activity (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references meridian_deals(id) on delete cascade,
  actor         text references meridian_members(name) on delete set null,
  activity_type text not null
                  check (activity_type in ('created','updated','status-change','checklist-update','submitted-review','attachment-added')),
  summary       text not null,
  field_changes jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists meridian_deal_activity_deal_idx
  on meridian_deal_activity(deal_id, created_at desc);

create table if not exists meridian_deal_attachments (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid references meridian_deals(id) on delete cascade,
  title           text not null,
  attachment_type text not null default 'link'
                    check (attachment_type in ('link','photo','document','map','county-record','comp','other')),
  url             text not null,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      text references meridian_members(name) on delete set null,
  deleted_at      timestamptz
);

create index if not exists meridian_deal_attachments_deal_idx
  on meridian_deal_attachments(deal_id, created_at desc)
  where deleted_at is null;

alter table meridian_va_daily_briefs
  add column if not exists reviewed_status text not null default 'new'
    check (reviewed_status in ('new','in-review','reviewed')),
  add column if not exists reviewed_by text references meridian_members(name) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create table if not exists meridian_va_daily_brief_reviews (
  id          uuid primary key default gen_random_uuid(),
  brief_id    uuid not null references meridian_va_daily_briefs(id) on delete cascade,
  member_name text not null references meridian_members(name) on delete cascade,
  note        text,
  reviewed_at timestamptz not null default now(),
  unique(brief_id, member_name)
);

create index if not exists meridian_va_daily_brief_reviews_brief_idx
  on meridian_va_daily_brief_reviews(brief_id, reviewed_at desc);

alter table meridian_deal_activity enable row level security;
alter table meridian_deal_attachments enable row level security;
alter table meridian_va_daily_brief_reviews enable row level security;

drop policy if exists "meridian_deal_activity prototype anon read" on meridian_deal_activity;
drop policy if exists "meridian_deal_activity prototype anon write" on meridian_deal_activity;
create policy "meridian_deal_activity prototype anon read"
  on meridian_deal_activity for select to anon using (true);
create policy "meridian_deal_activity prototype anon write"
  on meridian_deal_activity for all to anon using (true) with check (true);

drop policy if exists "meridian_deal_attachments prototype anon read" on meridian_deal_attachments;
drop policy if exists "meridian_deal_attachments prototype anon write" on meridian_deal_attachments;
create policy "meridian_deal_attachments prototype anon read"
  on meridian_deal_attachments for select to anon using (true);
create policy "meridian_deal_attachments prototype anon write"
  on meridian_deal_attachments for all to anon using (true) with check (true);

drop policy if exists "meridian_va_daily_brief_reviews prototype anon read" on meridian_va_daily_brief_reviews;
drop policy if exists "meridian_va_daily_brief_reviews prototype anon write" on meridian_va_daily_brief_reviews;
create policy "meridian_va_daily_brief_reviews prototype anon read"
  on meridian_va_daily_brief_reviews for select to anon using (true);
create policy "meridian_va_daily_brief_reviews prototype anon write"
  on meridian_va_daily_brief_reviews for all to anon using (true) with check (true);

