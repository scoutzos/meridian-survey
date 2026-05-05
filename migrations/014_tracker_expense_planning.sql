-- =============================================================================
-- Tracker expense planning — what-if proposals, OA approval rules, and sign-off.
-- =============================================================================

create table if not exists tracker_expense_proposals (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  category              text not null,
  expense_kind          text not null default 'fixed'
                          check (expense_kind in ('fixed','hourly')),
  cadence               text not null default 'monthly'
                          check (cadence in ('monthly','quarterly','one_time')),
  hourly_rate           numeric(12,2),
  hours_per_month       numeric(12,2),
  upfront_amount        numeric(12,2) not null default 0 check (upfront_amount >= 0),
  monthly_amount        numeric(12,2) not null default 0 check (monthly_amount >= 0),
  one_time_amount       numeric(12,2) not null default 0 check (one_time_amount >= 0),
  member_cap            numeric(12,2) not null default 250 check (member_cap >= 0),
  is_budgeted           boolean not null default false,
  start_month           date,
  duration_months       int not null default 1 check (duration_months >= 1),
  notes                 text,
  status                text not null default 'review'
                          check (status in ('draft','review','approved','rejected','converted')),
  approval_rule         text not null,
  minimum_oa_approvals  int not null default 4 check (minimum_oa_approvals >= 0),
  required_approvals    int not null default 6 check (required_approvals >= 0),
  converted_expense_id  bigint references tracker_expenses(id) on delete set null,
  created_at            timestamptz not null default now(),
  created_by            text,
  updated_at            timestamptz not null default now(),
  updated_by            text,
  deleted_at            timestamptz
);

create index if not exists tracker_expense_proposals_status_idx
  on tracker_expense_proposals(status) where deleted_at is null;
create index if not exists tracker_expense_proposals_created_idx
  on tracker_expense_proposals(created_at desc) where deleted_at is null;

create table if not exists tracker_expense_proposal_offsets (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references tracker_expense_proposals(id) on delete cascade,
  source_expense_id bigint references tracker_expenses(id) on delete set null,
  title             text not null,
  offset_kind       text not null default 'reduce'
                      check (offset_kind in ('increase','reduce','remove')),
  cadence           text not null default 'monthly'
                      check (cadence in ('monthly','quarterly','one_time')),
  amount            numeric(12,2) not null default 0 check (amount >= 0),
  notes             text,
  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz not null default now(),
  updated_by        text,
  deleted_at        timestamptz
);

create index if not exists tracker_expense_proposal_offsets_proposal_idx
  on tracker_expense_proposal_offsets(proposal_id) where deleted_at is null;

create table if not exists tracker_expense_proposal_votes (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references tracker_expense_proposals(id) on delete cascade,
  member_name   text not null references meridian_members(name) on delete cascade,
  decision      text not null check (decision in ('approve','reject','abstain')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(proposal_id, member_name)
);

create index if not exists tracker_expense_proposal_votes_proposal_idx
  on tracker_expense_proposal_votes(proposal_id);

comment on table tracker_expense_proposals is
  'What-if expense proposals with OA-informed approval requirements before conversion to actual tracker expenses.';
comment on table tracker_expense_proposal_votes is
  'Member sign-off records for tracker expense proposals.';
comment on table tracker_expense_proposal_offsets is
  'Reductions, removals, or tradeoffs bundled into an expense proposal for net-impact planning.';

alter table if exists tracker_expense_proposals enable row level security;
alter table if exists tracker_expense_proposal_offsets enable row level security;
alter table if exists tracker_expense_proposal_votes enable row level security;

drop policy if exists "tracker_expense_proposals prototype anon read" on tracker_expense_proposals;
drop policy if exists "tracker_expense_proposals prototype anon write" on tracker_expense_proposals;
create policy "tracker_expense_proposals prototype anon read" on tracker_expense_proposals for select to anon using (true);
create policy "tracker_expense_proposals prototype anon write" on tracker_expense_proposals for all to anon using (true) with check (true);

drop policy if exists "tracker_expense_proposal_offsets prototype anon read" on tracker_expense_proposal_offsets;
drop policy if exists "tracker_expense_proposal_offsets prototype anon write" on tracker_expense_proposal_offsets;
create policy "tracker_expense_proposal_offsets prototype anon read" on tracker_expense_proposal_offsets for select to anon using (true);
create policy "tracker_expense_proposal_offsets prototype anon write" on tracker_expense_proposal_offsets for all to anon using (true) with check (true);

drop policy if exists "tracker_expense_proposal_votes prototype anon read" on tracker_expense_proposal_votes;
drop policy if exists "tracker_expense_proposal_votes prototype anon write" on tracker_expense_proposal_votes;
create policy "tracker_expense_proposal_votes prototype anon read" on tracker_expense_proposal_votes for select to anon using (true);
create policy "tracker_expense_proposal_votes prototype anon write" on tracker_expense_proposal_votes for all to anon using (true) with check (true);
