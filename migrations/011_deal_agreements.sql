-- =============================================================================
-- Meridian Deal Agreements — deal-level terms that supplement the OA.
--
-- Namespaced table: does not touch generic/shared project tables.
-- Idempotent: safe to re-run.
-- =============================================================================

create table if not exists meridian_deal_agreements (
  id                    uuid primary key default gen_random_uuid(),
  deal_id               uuid not null references meridian_deals(id) on delete cascade,
  status                text not null default 'draft'
                          check (status in ('draft','ready-for-review','approved','signed','superseded')),

  offer_authority       numeric,
  earnest_money         numeric,
  diligence_budget      numeric,
  capital_needed        numeric,
  capital_commitments   text,
  credit_guarantees     text,
  member_roles          text,
  economics             text,
  overrun_rule          text,
  exit_plan             text,
  approval_threshold    text,
  go_no_go_deadline     text,
  notes                 text,

  created_at            timestamptz not null default now(),
  created_by            text,
  updated_at            timestamptz not null default now(),
  updated_by            text,
  approved_at           timestamptz,
  approved_by           text
);

create index if not exists meridian_deal_agreements_deal_idx
  on meridian_deal_agreements(deal_id, updated_at desc);

create index if not exists meridian_deal_agreements_status_idx
  on meridian_deal_agreements(status);

comment on table meridian_deal_agreements is 'Deal-level approval memo terms that supplement the Meridian operating agreement.';
