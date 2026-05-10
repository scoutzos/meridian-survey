-- =============================================================================
-- Meridian VA daily briefs.
--
-- End-of-shift activity logs submitted by VA/operator users and reviewed by
-- Meridian members in Operations.
-- =============================================================================

create table if not exists meridian_va_daily_briefs (
  id                        uuid primary key default gen_random_uuid(),
  work_date                 date not null default current_date,
  submitted_by              text references meridian_members(name) on delete set null,
  hours_worked              numeric(5,2),
  leads_added               integer,
  leads_updated             integer,
  outreach_sent             integer,
  seller_replies            integer,
  calls_completed           integer,
  deals_submitted           integer,
  checklist_items_cleared   integer,
  activities_completed      text not null,
  follow_ups_needed         text,
  blockers                  text,
  tomorrow_plan             text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

create index if not exists meridian_va_daily_briefs_work_date_idx
  on meridian_va_daily_briefs(work_date desc, created_at desc)
  where deleted_at is null;

comment on table meridian_va_daily_briefs is 'End-of-shift VA activity summaries for member review.';

alter table meridian_va_daily_briefs enable row level security;

drop policy if exists "meridian_va_daily_briefs prototype anon read" on meridian_va_daily_briefs;
drop policy if exists "meridian_va_daily_briefs prototype anon write" on meridian_va_daily_briefs;
create policy "meridian_va_daily_briefs prototype anon read"
  on meridian_va_daily_briefs for select to anon using (true);
create policy "meridian_va_daily_briefs prototype anon write"
  on meridian_va_daily_briefs for all to anon using (true) with check (true);
