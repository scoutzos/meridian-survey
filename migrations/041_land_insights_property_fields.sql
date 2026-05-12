-- =============================================================================
-- Land Insights property fields.
--
-- Promotes diligence and targeting fields that were previously left in raw_data
-- so uploads can power list rollups, SMS audiences, and property-card diligence.
-- =============================================================================

alter table meridian_imported_land_leads
  add column if not exists road_frontage_ft numeric,
  add column if not exists is_land_locked boolean default false,
  add column if not exists flood_zone_percent numeric,
  add column if not exists flood_zone_type text,
  add column if not exists wetlands_percent numeric,
  add column if not exists topography text,
  add column if not exists bad_topography boolean default false,
  add column if not exists tax_delinquent boolean default false,
  add column if not exists tax_delinquent_years numeric,
  add column if not exists mineral_rights_status text,
  add column if not exists hoa_status text,
  add column if not exists min_lot_size_acres numeric;

create index if not exists meridian_imported_land_leads_property_flags_idx
  on meridian_imported_land_leads(is_land_locked, tax_delinquent, bad_topography);

create index if not exists meridian_imported_land_leads_environment_idx
  on meridian_imported_land_leads(flood_zone_percent, wetlands_percent);
