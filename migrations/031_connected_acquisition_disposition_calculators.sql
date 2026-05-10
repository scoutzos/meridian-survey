-- Connect acquisition, disposition, and calculator assumptions directly to deal packets.

alter table meridian_deals
  add column if not exists disposition_status text
    check (disposition_status is null or disposition_status in (
      'not-started',
      'exit-strategy-set',
      'buyer-list-built',
      'marketed',
      'buyer-interest',
      'offer-received',
      'buyer-under-contract',
      'closing-scheduled',
      'closed',
      'fell-through'
    )),
  add column if not exists exit_strategy text,
  add column if not exists target_buyer_type text,
  add column if not exists target_resale_price numeric,
  add column if not exists minimum_acceptable_price numeric,
  add column if not exists best_buyer_offer numeric,
  add column if not exists buyer_demand_evidence text,
  add column if not exists disposition_owner text,
  add column if not exists disposition_next_step text,
  add column if not exists closing_costs_estimate numeric,
  add column if not exists holding_costs_estimate numeric,
  add column if not exists marketing_costs_estimate numeric,
  add column if not exists desired_minimum_spread numeric,
  add column if not exists risk_buffer numeric,
  add column if not exists calculator_notes text;

create index if not exists meridian_deals_disposition_status_idx
  on meridian_deals(disposition_status, updated_at desc)
  where deleted_at is null;

comment on column meridian_deals.exit_strategy is
  'Disposition thesis used in member packets and calculators.';
comment on column meridian_deals.target_resale_price is
  'Expected buyer/resale price used for acquisition and disposition math.';
comment on column meridian_deals.minimum_acceptable_price is
  'Lowest buyer/resale price Meridian would accept before changing exit strategy.';
