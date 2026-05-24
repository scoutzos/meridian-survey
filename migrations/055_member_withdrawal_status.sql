-- =============================================================================
-- Member withdrawal status
--
-- Members who voluntarily decide not to move forward remain in historical
-- records, but can be excluded from future access, votes, notifications, and
-- money calculations from an effective date forward.
-- =============================================================================

alter table tracker_member_profiles
  add column if not exists member_status text not null default 'active'
    check (member_status in ('active','withdrawn')),
  add column if not exists withdrawn_effective_date date,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by text references meridian_members(name) on delete set null,
  add column if not exists withdrawal_note text;

update tracker_member_profiles
set member_status = 'active'
where member_status is null;

create index if not exists tracker_member_profiles_status_idx
  on tracker_member_profiles(member_status, withdrawn_effective_date);

comment on column tracker_member_profiles.member_status is
  'Active members participate in future votes, notifications, capital calls, and tracker allocations. Withdrawn members remain visible historically.';

comment on column tracker_member_profiles.withdrawn_effective_date is
  'Date the member stopped participating. Money before this date remains historical; money on/after this date excludes the member.';

comment on column tracker_member_profiles.withdrawal_note is
  'Admin note explaining voluntary withdrawal or related settlement context.';

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
      select count(*)::int as n
        from tracker_member_profiles
       where member_status = 'active'
          or (member_status = 'withdrawn' and withdrawn_effective_date > current_date)
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

create or replace function meridian_member_is_active(p_member_name text, p_as_of date default current_date)
returns boolean
language sql
stable
as $$
  select coalesce((
    select case
      when member_status = 'withdrawn'
        then withdrawn_effective_date is not null and p_as_of < withdrawn_effective_date
      else true
    end
    from tracker_member_profiles
    where member_name = p_member_name
    limit 1
  ), true);
$$;

create or replace function meridian_current_member_status()
returns text
language sql
stable
as $$
  select coalesce((
    select member_status
    from tracker_member_profiles
    where member_name = meridian_current_member_name()
    limit 1
  ), 'active');
$$;

create or replace function meridian_is_member()
returns boolean
language sql
stable
as $$
  select meridian_current_member_name() is not null
    and meridian_current_member_role() = 'member'
    and meridian_member_is_active(meridian_current_member_name());
$$;

create or replace function meridian_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((
    select is_admin
    from tracker_member_profiles
    where member_name = meridian_current_member_name()
      and member_status = 'active'
    limit 1
  ), false);
$$;
