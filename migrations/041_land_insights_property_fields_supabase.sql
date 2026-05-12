alter table meridian_imported_land_leads
  add column if not exists phone_3 text;

alter table meridian_imported_land_leads
  add column if not exists phone_4 text;

alter table meridian_imported_land_leads
  add column if not exists phone_5 text;

alter table meridian_imported_land_leads
  add column if not exists phone_6 text;

alter table meridian_imported_land_leads
  add column if not exists phone_1_type text;

alter table meridian_imported_land_leads
  add column if not exists phone_2_type text;

alter table meridian_imported_land_leads
  add column if not exists phone_3_type text;

alter table meridian_imported_land_leads
  add column if not exists phone_4_type text;

alter table meridian_imported_land_leads
  add column if not exists phone_5_type text;

alter table meridian_imported_land_leads
  add column if not exists phone_6_type text;

alter table meridian_imported_land_leads
  add column if not exists calculated_acreage numeric;

alter table meridian_imported_land_leads
  add column if not exists parcel_sq_ft numeric;

alter table meridian_imported_land_leads
  add column if not exists fips text;

alter table meridian_imported_land_leads
  add column if not exists latitude numeric;

alter table meridian_imported_land_leads
  add column if not exists longitude numeric;

alter table meridian_imported_land_leads
  add column if not exists legal_description text;

alter table meridian_imported_land_leads
  add column if not exists parcel_alt_apn text;

alter table meridian_imported_land_leads
  add column if not exists mail_address text;

alter table meridian_imported_land_leads
  add column if not exists mail_city text;

alter table meridian_imported_land_leads
  add column if not exists mail_state text;

alter table meridian_imported_land_leads
  add column if not exists mail_zip text;

alter table meridian_imported_land_leads
  add column if not exists mail_county text;

alter table meridian_imported_land_leads
  add column if not exists structure_sq_ft numeric;

alter table meridian_imported_land_leads
  add column if not exists structure_count numeric;

alter table meridian_imported_land_leads
  add column if not exists structure_year_built numeric;

alter table meridian_imported_land_leads
  add column if not exists structure_stories numeric;

alter table meridian_imported_land_leads
  add column if not exists structure_units numeric;

alter table meridian_imported_land_leads
  add column if not exists structure_rooms numeric;

alter table meridian_imported_land_leads
  add column if not exists owner_first_names text;

alter table meridian_imported_land_leads
  add column if not exists owner_1_full_name text;

alter table meridian_imported_land_leads
  add column if not exists owner_1_first_name text;

alter table meridian_imported_land_leads
  add column if not exists owner_1_middle_name text;

alter table meridian_imported_land_leads
  add column if not exists owner_1_last_name text;

alter table meridian_imported_land_leads
  add column if not exists owner_1_suffix text;

alter table meridian_imported_land_leads
  add column if not exists owner_2_full_name text;

alter table meridian_imported_land_leads
  add column if not exists owner_2_first_name text;

alter table meridian_imported_land_leads
  add column if not exists owner_2_middle_name text;

alter table meridian_imported_land_leads
  add column if not exists owner_2_last_name text;

alter table meridian_imported_land_leads
  add column if not exists owner_2_suffix text;

alter table meridian_imported_land_leads
  add column if not exists improvement_value numeric;

alter table meridian_imported_land_leads
  add column if not exists improvement_percentage numeric;

alter table meridian_imported_land_leads
  add column if not exists land_value numeric;

alter table meridian_imported_land_leads
  add column if not exists total_parcel_value numeric;

alter table meridian_imported_land_leads
  add column if not exists market_land_value numeric;

alter table meridian_imported_land_leads
  add column if not exists market_improvement_value numeric;

alter table meridian_imported_land_leads
  add column if not exists tax_year numeric;

alter table meridian_imported_land_leads
  add column if not exists tax_delinquent_starting_year numeric;

alter table meridian_imported_land_leads
  add column if not exists last_sale_date text;

alter table meridian_imported_land_leads
  add column if not exists last_sale_price numeric;

alter table meridian_imported_land_leads
  add column if not exists previous_owners text;

alter table meridian_imported_land_leads
  add column if not exists previous_owner_1 text;

alter table meridian_imported_land_leads
  add column if not exists previous_owner_2 text;

alter table meridian_imported_land_leads
  add column if not exists deed_book text;

alter table meridian_imported_land_leads
  add column if not exists deed_page text;

alter table meridian_imported_land_leads
  add column if not exists deed_type text;

alter table meridian_imported_land_leads
  add column if not exists subdivision text;

alter table meridian_imported_land_leads
  add column if not exists lot text;

alter table meridian_imported_land_leads
  add column if not exists block text;

alter table meridian_imported_land_leads
  add column if not exists owner_type text;

alter table meridian_imported_land_leads
  add column if not exists owner_occupied boolean default false;

alter table meridian_imported_land_leads
  add column if not exists do_not_mail boolean default false;

alter table meridian_imported_land_leads
  add column if not exists in_hoa boolean default false;

alter table meridian_imported_land_leads
  add column if not exists family_transfer boolean default false;

alter table meridian_imported_land_leads
  add column if not exists google_map_url text;

alter table meridian_imported_land_leads
  add column if not exists google_earth_url text;

alter table meridian_imported_land_leads
  add column if not exists property_tax numeric;

alter table meridian_imported_land_leads
  add column if not exists taxed_delinquent_since text;

alter table meridian_imported_land_leads
  add column if not exists owner_out_of_state boolean default false;

alter table meridian_imported_land_leads
  add column if not exists owner_out_of_county boolean default false;

alter table meridian_imported_land_leads
  add column if not exists owner_out_of_zip boolean default false;

alter table meridian_imported_land_leads
  add column if not exists mortgage_amount numeric;

alter table meridian_imported_land_leads
  add column if not exists mortgage_length numeric;

alter table meridian_imported_land_leads
  add column if not exists mortgage_lender text;

alter table meridian_imported_land_leads
  add column if not exists mortgage_type text;

alter table meridian_imported_land_leads
  add column if not exists mortgage_loan_type text;

alter table meridian_imported_land_leads
  add column if not exists mortgage_interest numeric;

alter table meridian_imported_land_leads
  add column if not exists school_district text;

alter table meridian_imported_land_leads
  add column if not exists parcel_link text;

alter table meridian_imported_land_leads
  add column if not exists comping_link text;

alter table meridian_imported_land_leads
  add column if not exists min_elevation numeric;

alter table meridian_imported_land_leads
  add column if not exists max_elevation numeric;

alter table meridian_imported_land_leads
  add column if not exists avg_elevation numeric;

alter table meridian_imported_land_leads
  add column if not exists min_slope numeric;

alter table meridian_imported_land_leads
  add column if not exists max_slope numeric;

alter table meridian_imported_land_leads
  add column if not exists avg_slope numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_0_0_5_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_0_5_2_5_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_2_5_5_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_5_7_5_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_7_5_10_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_10_15_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_15_20_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_20_25_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_25_30_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_30_40_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_40_50_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists slope_over_50_pct numeric;

alter table meridian_imported_land_leads
  add column if not exists road_frontage_ft numeric;

alter table meridian_imported_land_leads
  add column if not exists is_land_locked boolean default false;

alter table meridian_imported_land_leads
  add column if not exists flood_zone_percent numeric;

alter table meridian_imported_land_leads
  add column if not exists flood_zone_type text;

alter table meridian_imported_land_leads
  add column if not exists wetlands_percent numeric;

alter table meridian_imported_land_leads
  add column if not exists topography text;

alter table meridian_imported_land_leads
  add column if not exists bad_topography boolean default false;

alter table meridian_imported_land_leads
  add column if not exists tax_delinquent boolean default false;

alter table meridian_imported_land_leads
  add column if not exists tax_delinquent_years numeric;

alter table meridian_imported_land_leads
  add column if not exists mineral_rights_status text;

alter table meridian_imported_land_leads
  add column if not exists hoa_status text;

alter table meridian_imported_land_leads
  add column if not exists min_lot_size_acres numeric;

alter table meridian_imported_land_leads
  add column if not exists market_value_estimate_ppa numeric;

alter table meridian_imported_land_leads
  add column if not exists market_value_estimate_comp_count numeric;

alter table meridian_imported_land_leads
  add column if not exists market_value_estimate_confidence text;

alter table meridian_imported_land_leads
  add column if not exists market_value_estimate_gini_index numeric;

alter table meridian_imported_land_leads
  add column if not exists tag_odd_shape boolean default false;

alter table meridian_imported_land_leads
  add column if not exists tag_structure boolean default false;

alter table meridian_imported_land_leads
  add column if not exists tag_farmland boolean default false;

alter table meridian_imported_land_leads
  add column if not exists tag_subdivide boolean default false;

alter table meridian_imported_land_leads
  add column if not exists tag_entitlement boolean default false;

alter table meridian_imported_land_leads
  add column if not exists seller_iq text;

alter table meridian_imported_land_leads
  add column if not exists dnc boolean default false;

alter table meridian_imported_land_leads
  add column if not exists state_dnc boolean default false;

alter table meridian_imported_land_leads
  add column if not exists litigator boolean default false;

alter table meridian_imported_land_leads
  add column if not exists age numeric;

alter table meridian_imported_land_leads
  add column if not exists gender text;

alter table meridian_imported_land_leads
  add column if not exists ethnic_group text;

alter table meridian_imported_land_leads
  add column if not exists religion text;

alter table meridian_imported_land_leads
  add column if not exists education_level text;

alter table meridian_imported_land_leads
  add column if not exists occupation text;

alter table meridian_imported_land_leads
  add column if not exists language text;

alter table meridian_imported_land_leads
  add column if not exists marital_status text;

create index if not exists meridian_imported_land_leads_property_flags_idx
  on meridian_imported_land_leads(is_land_locked, tax_delinquent, bad_topography);

create index if not exists meridian_imported_land_leads_environment_idx
  on meridian_imported_land_leads(flood_zone_percent, wetlands_percent);

create index if not exists meridian_imported_land_leads_sms_suppression_idx
  on meridian_imported_land_leads(dnc, state_dnc, litigator);

create index if not exists meridian_imported_land_leads_location_idx
  on meridian_imported_land_leads(county, latitude, longitude);
