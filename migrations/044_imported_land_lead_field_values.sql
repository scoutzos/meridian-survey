-- Stores every CSV source column as a typed, queryable value for imported land leads.

create table if not exists meridian_imported_land_lead_field_values (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references meridian_imported_land_leads(id) on delete cascade,
  source_header text not null,
  field_key text not null,
  category text not null default 'source',
  data_type text not null default 'text'
    check (data_type in ('text','number','boolean','date','url')),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  value_json jsonb,
  searchable boolean not null default false,
  filterable boolean not null default false,
  calculator_ready boolean not null default false,
  source_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (lead_id, field_key, source_order)
);

create index if not exists meridian_imported_land_lead_field_values_lead_idx
  on meridian_imported_land_lead_field_values(lead_id, source_order);

create index if not exists meridian_imported_land_lead_field_values_key_idx
  on meridian_imported_land_lead_field_values(field_key);

create index if not exists meridian_imported_land_lead_field_values_number_idx
  on meridian_imported_land_lead_field_values(field_key, value_number)
  where value_number is not null;

create index if not exists meridian_imported_land_lead_field_values_boolean_idx
  on meridian_imported_land_lead_field_values(field_key, value_boolean)
  where value_boolean is not null;

alter table if exists meridian_imported_land_lead_field_values enable row level security;

drop policy if exists "meridian_imported_land_lead_field_values anon select"
  on meridian_imported_land_lead_field_values;
drop policy if exists "meridian_imported_land_lead_field_values anon insert"
  on meridian_imported_land_lead_field_values;
drop policy if exists "meridian_imported_land_lead_field_values anon update"
  on meridian_imported_land_lead_field_values;
drop policy if exists "meridian_imported_land_lead_field_values anon delete"
  on meridian_imported_land_lead_field_values;

create policy "meridian_imported_land_lead_field_values anon select"
  on meridian_imported_land_lead_field_values
  for select to anon using (true);

create policy "meridian_imported_land_lead_field_values anon insert"
  on meridian_imported_land_lead_field_values
  for insert to anon with check (true);

create policy "meridian_imported_land_lead_field_values anon update"
  on meridian_imported_land_lead_field_values
  for update to anon using (true) with check (true);

create policy "meridian_imported_land_lead_field_values anon delete"
  on meridian_imported_land_lead_field_values
  for delete to anon using (true);
