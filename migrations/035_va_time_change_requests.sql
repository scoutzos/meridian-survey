-- =============================================================================
-- Meridian VA time corrections and brief revisions.
--
-- VAs can request time-card corrections. Members/admins review requests before
-- shift records change because approved time syncs into member expenses.
-- =============================================================================

create table if not exists meridian_va_time_change_requests (
  id                      uuid primary key default gen_random_uuid(),
  entry_id                uuid references meridian_va_time_entries(id) on delete set null,
  operator_name           text not null references meridian_members(name) on delete cascade,
  request_type            text not null
                            check (request_type in ('add-shift','edit-shift','void-shift')),
  requested_clock_in_at   timestamptz,
  requested_clock_out_at  timestamptz,
  requested_notes         text,
  reason                  text not null,
  status                  text not null default 'pending'
                            check (status in ('pending','approved','rejected')),
  reviewed_by             text references meridian_members(name) on delete set null,
  reviewed_at             timestamptz,
  review_note             text,
  applied_entry_id        uuid references meridian_va_time_entries(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  check (
    request_type = 'void-shift'
    or (requested_clock_in_at is not null and requested_clock_out_at is not null and requested_clock_out_at >= requested_clock_in_at)
  )
);

create index if not exists meridian_va_time_change_requests_status_idx
  on meridian_va_time_change_requests(status, created_at desc)
  where deleted_at is null;

create index if not exists meridian_va_time_change_requests_operator_idx
  on meridian_va_time_change_requests(operator_name, created_at desc)
  where deleted_at is null;

alter table meridian_va_time_change_requests enable row level security;

drop policy if exists "meridian_va_time_change_requests prototype anon read" on meridian_va_time_change_requests;
drop policy if exists "meridian_va_time_change_requests prototype anon write" on meridian_va_time_change_requests;
create policy "meridian_va_time_change_requests prototype anon read"
  on meridian_va_time_change_requests for select to anon using (true);
create policy "meridian_va_time_change_requests prototype anon write"
  on meridian_va_time_change_requests for all to anon using (true) with check (true);

alter table meridian_va_daily_briefs
  add column if not exists revised_at timestamptz,
  add column if not exists revised_by text references meridian_members(name) on delete set null,
  add column if not exists revision_note text;
