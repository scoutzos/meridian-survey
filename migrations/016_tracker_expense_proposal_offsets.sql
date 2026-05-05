-- Add proposal offsets so approvals can cover add/reduce/remove packages.

create table if not exists tracker_expense_proposal_offsets (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references tracker_expense_proposals(id) on delete cascade,
  source_expense_id bigint references tracker_expenses(id) on delete set null,
  title             text not null,
  offset_kind       text not null default 'reduce'
                      check (offset_kind in ('reduce','remove')),
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

comment on table tracker_expense_proposal_offsets is
  'Reductions, removals, or tradeoffs bundled into an expense proposal for net-impact planning.';

alter table if exists tracker_expense_proposal_offsets enable row level security;

drop policy if exists "tracker_expense_proposal_offsets prototype anon read" on tracker_expense_proposal_offsets;
drop policy if exists "tracker_expense_proposal_offsets prototype anon write" on tracker_expense_proposal_offsets;
create policy "tracker_expense_proposal_offsets prototype anon read" on tracker_expense_proposal_offsets for select to anon using (true);
create policy "tracker_expense_proposal_offsets prototype anon write" on tracker_expense_proposal_offsets for all to anon using (true) with check (true);
