-- =============================================================================
-- Meridian VA biweekly time tracking.
--
-- Shift-level clock records for the VA desk. Approved biweekly periods sync into
-- tracker_expenses so member balances and funding needs stay automatic.
-- =============================================================================

alter table tracker_expenses
  add column if not exists source_table text,
  add column if not exists source_id text;

create unique index if not exists tracker_expenses_source_idx
  on tracker_expenses(source_table, source_id)
  where source_table is not null and source_id is not null and deleted_at is null;

create table if not exists meridian_va_time_entries (
  id                  uuid primary key default gen_random_uuid(),
  operator_name       text not null references meridian_members(name) on delete cascade,
  clock_in_at         timestamptz not null default now(),
  clock_out_at        timestamptz,
  duration_minutes    integer check (duration_minutes is null or duration_minutes >= 0),
  hourly_rate         numeric(8,2) not null default 4.50 check (hourly_rate >= 0),
  cost_amount         numeric(12,2) check (cost_amount is null or cost_amount >= 0),
  pay_period_start    date not null,
  pay_period_end      date not null,
  status              text not null default 'open'
                        check (status in ('open','submitted','approved','void')),
  notes               text,
  tracker_expense_id  bigint references tracker_expenses(id) on delete set null,
  reviewed_by         text references meridian_members(name) on delete set null,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (pay_period_end >= pay_period_start),
  check (
    (clock_out_at is null and duration_minutes is null and cost_amount is null)
    or (clock_out_at is not null and duration_minutes is not null and cost_amount is not null)
  )
);

create index if not exists meridian_va_time_entries_operator_idx
  on meridian_va_time_entries(operator_name, clock_in_at desc)
  where deleted_at is null;

create index if not exists meridian_va_time_entries_period_idx
  on meridian_va_time_entries(pay_period_start desc, pay_period_end desc, operator_name)
  where deleted_at is null;

create unique index if not exists meridian_va_time_entries_one_open_shift_idx
  on meridian_va_time_entries(operator_name)
  where deleted_at is null and status = 'open' and clock_out_at is null;

alter table meridian_va_time_entries enable row level security;

drop policy if exists "meridian_va_time_entries prototype anon read" on meridian_va_time_entries;
drop policy if exists "meridian_va_time_entries prototype anon write" on meridian_va_time_entries;
create policy "meridian_va_time_entries prototype anon read"
  on meridian_va_time_entries for select to anon using (true);
create policy "meridian_va_time_entries prototype anon write"
  on meridian_va_time_entries for all to anon using (true) with check (true);
