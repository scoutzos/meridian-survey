-- =============================================================================
-- Contribution Tracker — schema, seed data, and computed views.
--
-- Run this whole file once in the Supabase SQL editor (or via setup-tracker-db.mjs).
-- Idempotent: safe to re-run; tables/views/policies use IF [NOT] EXISTS / DROP-CREATE.
--
-- Tables added:
--   tracker_member_profiles  — sidecar to meridian_members; maps person → LLC name
--   tracker_settings         — single row keyed by 'tracker'
--   tracker_expenses
--   tracker_contributions
--   tracker_capital_calls
--   tracker_audit_log
--
-- Member identity: meridian_members.name (text) is the canonical key in this app.
-- All FKs to "members" reference that text column.
-- =============================================================================

-- ---------- tracker_settings ------------------------------------------------
create table if not exists tracker_settings (
  key              text primary key,
  llc_start_date   date,
  months_tracked   int  not null default 3,
  updated_at       timestamptz not null default now(),
  updated_by       text
);

insert into tracker_settings (key, llc_start_date, months_tracked, updated_by)
values ('tracker', date '2026-06-01', 3, 'system')
on conflict (key) do nothing;

-- ---------- tracker_member_profiles -----------------------------------------
-- Sidecar mapping person-name → LLC entity name. Best-guess seed values; the
-- Settings page lets admins edit them. Mosely is the only confirmed mapping.
create table if not exists tracker_member_profiles (
  member_name  text primary key references meridian_members(name) on delete cascade,
  llc_name     text not null,
  is_admin     boolean not null default false,
  updated_at   timestamptz not null default now()
);

insert into tracker_member_profiles (member_name, llc_name, is_admin) values
  ('Courtney Mosely',     'Mosely Legacy Partners LLC',   true),
  ('Aaliyah Thomas',      'ALT Management LLC',           true),
  ('Raquel Twine',        'Hybrid Haven Group LLC',       true),
  ('Odessa Patterson',    'Olmdrsv LLC',                  false),
  ('Tiffany Stallworth',  'Wincrest LLC',                 false),
  ('Peggee',              'Liberus King Enterprise LLC',  false)
on conflict (member_name) do nothing;

-- ---------- tracker_capital_calls -------------------------------------------
create table if not exists tracker_capital_calls (
  id                  bigserial primary key,
  date_called         date not null,
  reason              text not null,
  total_amount        numeric(12,2) not null check (total_amount >= 0),
  per_member_amount   numeric(12,2) not null check (per_member_amount >= 0),
  status              text not null default 'suggested'
                        check (status in ('suggested','open','closed','cancelled')),
  auto_suggested      boolean not null default false,
  approved_by         text,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create index if not exists tracker_capital_calls_status_idx on tracker_capital_calls(status) where deleted_at is null;

-- ---------- tracker_expenses ------------------------------------------------
create table if not exists tracker_expenses (
  id                  bigserial primary key,
  expense_date        date,                            -- null = "Unclassified"
  category            text not null,
  description         text not null,
  amount              numeric(12,2) not null check (amount >= 0),
  paid_by_member_name text references meridian_members(name) on delete set null,
  paid_by_label       text,                            -- e.g. "TBD", "LLC Bank"
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create index if not exists tracker_expenses_date_idx on tracker_expenses(expense_date) where deleted_at is null;
create index if not exists tracker_expenses_paid_by_idx on tracker_expenses(paid_by_member_name) where deleted_at is null;

-- ---------- tracker_contributions -------------------------------------------
create table if not exists tracker_contributions (
  id                       bigserial primary key,
  contribution_date        date not null,
  member_name              text not null references meridian_members(name) on delete cascade,
  type                     text not null
                              check (type in ('initial_contribution','monthly_dues','capital_call')),
  amount                   numeric(12,2) not null check (amount >= 0),
  reference                text,
  notes                    text,
  related_capital_call_id  bigint references tracker_capital_calls(id) on delete set null,
  created_at               timestamptz not null default now(),
  created_by               text,
  updated_at               timestamptz not null default now(),
  updated_by               text,
  deleted_at               timestamptz
);

create index if not exists tracker_contributions_member_idx on tracker_contributions(member_name) where deleted_at is null;
create index if not exists tracker_contributions_type_idx on tracker_contributions(type) where deleted_at is null;

-- ---------- tracker_audit_log -----------------------------------------------
create table if not exists tracker_audit_log (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor       text,                                     -- meridian_members.name
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('create','update','delete')),
  diff        jsonb                                    -- {before, after} or {fields}
);

create index if not exists tracker_audit_log_table_row_idx on tracker_audit_log(table_name, row_id);
create index if not exists tracker_audit_log_occurred_at_idx on tracker_audit_log(occurred_at desc);

-- ---------- helper: month_bucket function -----------------------------------
-- Returns 'Unclassified' | 'Pre-formation' | 'M1' | 'M2' | ...
-- p_start may be null (settings not yet configured): everything dated = M1.
create or replace function tracker_month_bucket(p_date date, p_start date)
returns text
language sql
immutable
as $$
  select case
    when p_date is null                       then 'Unclassified'
    when p_start is null                      then 'M1'
    when p_date < p_start                     then 'Pre-formation'
    else 'M' || (
      ((extract(year from p_date)::int - extract(year from p_start)::int) * 12
       + (extract(month from p_date)::int - extract(month from p_start)::int)) + 1
    )::text
  end;
$$;

-- ---------- view: tracker_expense_buckets -----------------------------------
-- Convenience: each non-deleted expense plus its computed month_bucket.
create or replace view tracker_expense_buckets as
  select e.*,
         tracker_month_bucket(
           e.expense_date,
           (select llc_start_date from tracker_settings where key = 'tracker')
         ) as month_bucket
    from tracker_expenses e
   where e.deleted_at is null;

-- ---------- view: tracker_funding_status ------------------------------------
-- Drives the dashboard's shortfall banner.
create or replace view tracker_funding_status as
  with
    expenses_total as (
      select coalesce(sum(amount), 0)::numeric(12,2) as total
        from tracker_expenses
       where deleted_at is null
    ),
    open_calls_total as (
      select coalesce(sum(total_amount), 0)::numeric(12,2) as total
        from tracker_capital_calls
       where deleted_at is null and status = 'open'
    ),
    contributions_total as (
      select coalesce(sum(amount), 0)::numeric(12,2) as total
        from tracker_contributions
       where deleted_at is null
    ),
    member_count as (
      select count(*)::int as n from meridian_members
    )
  select
    e.total                                         as total_expenses,
    o.total                                         as open_capital_calls,
    c.total                                         as total_deposits,
    (e.total + o.total)                             as total_funding_need,
    greatest((e.total + o.total) - c.total, 0)      as shortfall,
    m.n                                             as member_count,
    case when m.n > 0
         then round(greatest((e.total + o.total) - c.total, 0) / m.n, 2)
         else 0
    end                                             as shortfall_per_member
    from expenses_total e, open_calls_total o, contributions_total c, member_count m;

-- =============================================================================
-- Seed expenses (per spec). Idempotent on (description, expense_date).
-- =============================================================================
do $$
declare
  v_mosely text := (select member_name from tracker_member_profiles where llc_name = 'Mosely Legacy Partners LLC');
  v_olmdrsv text := (select member_name from tracker_member_profiles where llc_name = 'Olmdrsv LLC');
begin
  if not exists (select 1 from tracker_expenses where description = 'GA LLC filing fee (Secretary of State)') then
    insert into tracker_expenses (expense_date, category, description, amount, paid_by_member_name, paid_by_label, created_by) values
      (date '2026-04-15', 'Startup',    'GA LLC filing fee (Secretary of State)',    110, v_olmdrsv,  null,  'system'),
      (date '2026-04-15', 'Startup',    'iPostal1 mailbox setup',                     40, v_olmdrsv,  null,  'system'),
      (date '2026-04-15', 'Startup',    'Domain registration (Year 1)',               10, v_mosely,   null,  'system'),
      (date '2026-06-01', 'VA',         'Sophia (VA) — M1 @ $4.50/hr',               585, null,       'TBD', 'system'),
      (date '2026-06-01', 'Lead-gen',   'Land Portal Pro subscription — M1',         299, null,       'TBD', 'system'),
      (date '2026-06-01', 'Lead-gen',   'Skip trace — M1 (10K @ $0.04)',             400, null,       'TBD', 'system'),
      (date '2026-06-01', 'Lead-gen',   'Call Tools dialer — M1',                     99, null,       'TBD', 'system'),
      (date '2026-06-01', 'Operations', 'iPostal1 mailbox — M1',                      15, null,       'TBD', 'system'),
      (date '2026-07-01', 'VA',         'Sophia (VA) — M2',                          585, null,       'TBD', 'system'),
      (date '2026-07-01', 'Lead-gen',   'Land Portal Pro subscription — M2',         299, null,       'TBD', 'system'),
      (date '2026-07-01', 'Lead-gen',   'Skip trace — M2',                           400, null,       'TBD', 'system'),
      (date '2026-07-01', 'Lead-gen',   'Call Tools dialer — M2',                     99, null,       'TBD', 'system'),
      (date '2026-07-01', 'Operations', 'iPostal1 mailbox — M2',                      15, null,       'TBD', 'system'),
      (date '2026-08-01', 'VA',         'Sophia (VA) — M3',                          585, null,       'TBD', 'system'),
      (date '2026-08-01', 'Lead-gen',   'Land Portal Pro subscription — M3',         299, null,       'TBD', 'system'),
      (date '2026-08-01', 'Lead-gen',   'Skip trace — M3',                           400, null,       'TBD', 'system'),
      (date '2026-08-01', 'Lead-gen',   'Call Tools dialer — M3',                     99, null,       'TBD', 'system'),
      (date '2026-08-01', 'Operations', 'iPostal1 mailbox — M3',                      15, null,       'TBD', 'system');
  end if;
end$$;
