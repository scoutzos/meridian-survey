-- Stores detailed build/new-construction underwriting assumptions on the existing deal packet.

alter table if exists meridian_deals
  add column if not exists build_analysis jsonb not null default '{}'::jsonb;

comment on column meridian_deals.build_analysis is
  'Detailed teardown, construction budget, financing, new-build comps, and exit strategy assumptions for build deals.';
