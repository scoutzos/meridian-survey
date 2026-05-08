-- =============================================================================
-- Membership candidate intake and member voting.
-- =============================================================================

create table if not exists membership_candidates (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null,
  contact_email         text,
  contact_phone         text,
  join_as               text not null,
  entity_name           text,
  entity_state          text,
  entity_title          text,
  participation         text not null,
  max_deal_contribution numeric,
  cash_available        numeric,
  credit_available      numeric,
  deal_readiness        text,
  credit_pull_comfort   text,
  table_contribution    text,
  relationships         text,
  first_90_days         text,
  support_requested     text,
  member_notes          text,
  status                text not null default 'under_review',
  submitted_at          timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists membership_candidate_votes (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references membership_candidates(id) on delete cascade,
  member_name   text not null references meridian_members(name) on delete cascade,
  decision      text not null check (decision in ('approve', 'discuss', 'hold', 'decline')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(candidate_id, member_name)
);

create index if not exists membership_candidates_status_idx
  on membership_candidates(status, submitted_at desc);

create index if not exists membership_candidate_votes_candidate_idx
  on membership_candidate_votes(candidate_id, member_name);

comment on table membership_candidates is 'Potential member applications submitted for existing member review.';
comment on table membership_candidate_votes is 'Existing member votes on potential membership candidates.';
