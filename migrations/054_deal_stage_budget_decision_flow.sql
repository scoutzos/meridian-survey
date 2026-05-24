-- =============================================================================
-- Meridian Deal Stage, Budget, Decision, Exit, and Closeout Flow.
--
-- Adds the structured records needed to enforce the Operating Agreement deal
-- stages, budget versioning, required decision notices, affected-member consent,
-- exit memos, and deal closeout packets.
-- =============================================================================

alter table meridian_deals
  add column if not exists deal_stage text not null default 'intake'
    check (deal_stage in (
      'intake',
      'initial-screen',
      'offer-approval',
      'due-diligence-go-no-go',
      'active-project-change',
      'exit-execution',
      'closeout'
    )),
  add column if not exists stage_updated_at timestamptz,
  add column if not exists stage_updated_by text;

create index if not exists meridian_deals_stage_idx
  on meridian_deals(deal_stage, updated_at desc)
  where deleted_at is null;

create table if not exists meridian_deal_budget_versions (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references meridian_deals(id) on delete cascade,
  version_number      integer not null,
  stage               text not null default 'initial-screen'
                        check (stage in (
                          'intake',
                          'initial-screen',
                          'offer-approval',
                          'due-diligence-go-no-go',
                          'active-project-change',
                          'exit-execution',
                          'closeout'
                        )),
  label               text not null,
  status              text not null default 'draft'
                        check (status in ('draft','review','approved','superseded','final-actuals')),
  change_summary      text,
  source_of_funds     text,
  total_budget        numeric(12,2) not null default 0,
  total_actual        numeric(12,2) not null default 0,
  variance_amount     numeric(12,2) not null default 0,
  variance_percent    numeric(8,4),
  material_variance_threshold_amount numeric(12,2),
  material_variance_threshold_percent numeric(8,4),
  vote_required       boolean not null default false,
  approved_at         timestamptz,
  approved_by         text,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz,
  unique(deal_id, version_number)
);

create index if not exists meridian_deal_budget_versions_deal_idx
  on meridian_deal_budget_versions(deal_id, version_number desc)
  where deleted_at is null;

create table if not exists meridian_deal_budget_lines (
  id                  uuid primary key default gen_random_uuid(),
  budget_version_id   uuid not null references meridian_deal_budget_versions(id) on delete cascade,
  category            text not null,
  description         text not null,
  estimated_amount    numeric(12,2) not null default 0,
  approved_amount     numeric(12,2) not null default 0,
  actual_amount       numeric(12,2) not null default 0,
  source_of_funds     text,
  vendor              text,
  notes               text,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create index if not exists meridian_deal_budget_lines_version_idx
  on meridian_deal_budget_lines(budget_version_id, sort_order)
  where deleted_at is null;

create table if not exists meridian_deal_decisions (
  id                          uuid primary key default gen_random_uuid(),
  deal_id                     uuid not null references meridian_deals(id) on delete cascade,
  decision_type               text not null default 'general'
                                check (decision_type in (
                                  'general',
                                  'offer-approval',
                                  'due-diligence-go-no-go',
                                  'budget-change',
                                  'capital-call',
                                  'active-project-change',
                                  'exit-decision',
                                  'closeout-approval'
                                )),
  stage                       text not null default 'initial-screen'
                                check (stage in (
                                  'intake',
                                  'initial-screen',
                                  'offer-approval',
                                  'due-diligence-go-no-go',
                                  'active-project-change',
                                  'exit-execution',
                                  'closeout'
                                )),
  status                      text not null default 'draft'
                                check (status in ('draft','open','approved','rejected','revision-needed','closed','cancelled')),
  decision_requested          text not null,
  affected_matter             text not null,
  dollar_impact               numeric(12,2),
  source_of_funds             text,
  approval_threshold          text not null default 'Tier 3 Majority approval',
  required_approvals          integer not null default 3,
  response_deadline           timestamptz,
  non_response_consequence    text not null default 'Non-response counts as abstention, not approval.',
  personal_risk_summary       text,
  related_budget_version_id   uuid references meridian_deal_budget_versions(id) on delete set null,
  supporting_documents        jsonb not null default '[]'::jsonb,
  opened_at                   timestamptz,
  decided_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  created_by                  text,
  updated_at                  timestamptz not null default now(),
  updated_by                  text,
  deleted_at                  timestamptz
);

create index if not exists meridian_deal_decisions_deal_idx
  on meridian_deal_decisions(deal_id, created_at desc)
  where deleted_at is null;
create index if not exists meridian_deal_decisions_status_idx
  on meridian_deal_decisions(status, response_deadline)
  where deleted_at is null;

create table if not exists meridian_deal_decision_votes (
  id            uuid primary key default gen_random_uuid(),
  decision_id   uuid not null references meridian_deal_decisions(id) on delete cascade,
  member_name   text not null references meridian_members(name) on delete cascade,
  vote          text not null check (vote in ('approve','request_changes','abstain','reject')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(decision_id, member_name)
);

create index if not exists meridian_deal_decision_votes_decision_idx
  on meridian_deal_decision_votes(decision_id, updated_at desc);

create table if not exists meridian_deal_member_commitments (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references meridian_deals(id) on delete cascade,
  member_name         text not null references meridian_members(name) on delete cascade,
  commitment_type     text not null
                        check (commitment_type in ('cash','credit','guarantee','member-loan','collateral','deal-specific-capital','other')),
  amount              numeric(12,2),
  description         text,
  source_of_funds     text,
  decision_id         uuid references meridian_deal_decisions(id) on delete set null,
  budget_version_id   uuid references meridian_deal_budget_versions(id) on delete set null,
  consent_status      text not null default 'pending'
                        check (consent_status in ('pending','approved','rejected','withdrawn')),
  consent_note        text,
  consented_at        timestamptz,
  created_at          timestamptz not null default now(),
  created_by          text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  deleted_at          timestamptz
);

create index if not exists meridian_deal_member_commitments_deal_idx
  on meridian_deal_member_commitments(deal_id, member_name, consent_status)
  where deleted_at is null;

create table if not exists meridian_deal_exit_memos (
  id                                  uuid primary key default gen_random_uuid(),
  deal_id                             uuid not null references meridian_deals(id) on delete cascade,
  decision_id                         uuid references meridian_deal_decisions(id) on delete set null,
  status                              text not null default 'draft'
                                        check (status in ('draft','ready-for-review','approved','superseded')),
  recommended_exit                    text not null,
  current_budget_to_actual            text,
  debt_payoff                         numeric(12,2),
  closing_costs                       numeric(12,2),
  expected_net_proceeds               numeric(12,2),
  return_of_capital                   numeric(12,2),
  preferred_return_or_guarantee_premium numeric(12,2),
  reserves_to_hold_back               numeric(12,2),
  estimated_member_distributions      text,
  risks                               text,
  alternatives_considered             text,
  supporting_documents                jsonb not null default '[]'::jsonb,
  created_at                          timestamptz not null default now(),
  created_by                          text,
  updated_at                          timestamptz not null default now(),
  updated_by                          text,
  deleted_at                          timestamptz
);

create index if not exists meridian_deal_exit_memos_deal_idx
  on meridian_deal_exit_memos(deal_id, updated_at desc)
  where deleted_at is null;

create table if not exists meridian_deal_closeout_packets (
  id                          uuid primary key default gen_random_uuid(),
  deal_id                     uuid not null references meridian_deals(id) on delete cascade,
  exit_memo_id                uuid references meridian_deal_exit_memos(id) on delete set null,
  status                      text not null default 'draft'
                                check (status in ('draft','ready-for-review','final')),
  settlement_statement_url    text,
  refinance_statement_url     text,
  final_budget_variance       text,
  final_profit_loss           numeric(12,2),
  capital_return              text,
  distribution_calculation    text,
  lessons_learned             text,
  tax_followups               text,
  created_at                  timestamptz not null default now(),
  created_by                  text,
  updated_at                  timestamptz not null default now(),
  updated_by                  text,
  deleted_at                  timestamptz
);

create index if not exists meridian_deal_closeout_packets_deal_idx
  on meridian_deal_closeout_packets(deal_id, updated_at desc)
  where deleted_at is null;

alter table meridian_deal_budget_versions enable row level security;
alter table meridian_deal_budget_lines enable row level security;
alter table meridian_deal_decisions enable row level security;
alter table meridian_deal_decision_votes enable row level security;
alter table meridian_deal_member_commitments enable row level security;
alter table meridian_deal_exit_memos enable row level security;
alter table meridian_deal_closeout_packets enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'meridian_deal_budget_versions',
    'meridian_deal_budget_lines',
    'meridian_deal_decisions',
    'meridian_deal_decision_votes',
    'meridian_deal_member_commitments',
    'meridian_deal_exit_memos',
    'meridian_deal_closeout_packets'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%s prototype anon read" on %I', t, t);
    execute format('drop policy if exists "%s prototype anon write" on %I', t, t);
    execute format('create policy "%s prototype anon read" on %I for select to anon using (true)', t, t);
    execute format('create policy "%s prototype anon write" on %I for all to anon using (true) with check (true)', t, t);
  end loop;
end$$;

comment on table meridian_deal_budget_versions is 'Versioned deal budgets used for screening, approval, changes, exit, and closeout.';
comment on table meridian_deal_decisions is 'Formal decision notices with OA-required notice contents, deadlines, thresholds, and supporting documents.';
comment on table meridian_deal_member_commitments is 'Affected-member cash, credit, guarantee, loan, collateral, or deal-specific capital consents.';
comment on table meridian_deal_exit_memos is 'Exit Decision Memos required before sale, refinance, hold, assignment, abandonment, or other exit.';
comment on table meridian_deal_closeout_packets is 'Final deal closeout records for actuals, distributions, lessons learned, and tax follow-ups.';
