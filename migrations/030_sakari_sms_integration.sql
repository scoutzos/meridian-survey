-- =============================================================================
-- Meridian Sakari SMS integration.
--
-- Stores Sakari webhook events, matches inbound/outbound texts to imported land
-- leads or deal records, and gives the VA portal a communication history.
-- =============================================================================

alter table meridian_imported_land_leads
  add column if not exists sms_opt_status text not null default 'unknown'
    check (sms_opt_status in ('unknown','opted-in','opted-out')),
  add column if not exists last_sms_at timestamptz,
  add column if not exists last_sms_direction text
    check (last_sms_direction is null or last_sms_direction in ('inbound','outbound')),
  add column if not exists last_sms_body text,
  add column if not exists sakari_contact_id text,
  add column if not exists sakari_conversation_id text;

create table if not exists meridian_communication_events (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null default 'sakari',
  provider_event_type text not null,
  provider_message_id text,
  provider_contact_id text,
  provider_conversation_id text,
  direction           text not null check (direction in ('inbound','outbound','status','system')),
  channel             text not null default 'sms',
  from_number         text,
  to_number           text,
  contact_number      text,
  contact_name        text,
  body                text,
  status              text,
  media               jsonb not null default '[]'::jsonb,
  raw_payload         jsonb not null default '{}'::jsonb,
  matched_lead_id     uuid references meridian_imported_land_leads(id) on delete set null,
  matched_deal_id     uuid references meridian_deals(id) on delete set null,
  created_at          timestamptz not null default now(),
  provider_created_at timestamptz,
  unique(provider, provider_message_id, provider_event_type)
);

create index if not exists meridian_communication_events_lead_idx
  on meridian_communication_events(matched_lead_id, created_at desc);

create index if not exists meridian_communication_events_deal_idx
  on meridian_communication_events(matched_deal_id, created_at desc);

create index if not exists meridian_communication_events_contact_idx
  on meridian_communication_events(contact_number, created_at desc);

alter table meridian_communication_events enable row level security;

drop policy if exists "meridian_communication_events prototype anon read"
  on meridian_communication_events;
drop policy if exists "meridian_communication_events prototype anon write"
  on meridian_communication_events;
drop policy if exists "meridian_communication_events anon select"
  on meridian_communication_events;
drop policy if exists "meridian_communication_events anon insert"
  on meridian_communication_events;
drop policy if exists "meridian_communication_events anon update"
  on meridian_communication_events;

create policy "meridian_communication_events anon select"
  on meridian_communication_events
  for select
  to anon
  using (true);

create policy "meridian_communication_events anon insert"
  on meridian_communication_events
  for insert
  to anon
  with check (true);

create policy "meridian_communication_events anon update"
  on meridian_communication_events
  for update
  to anon
  using (true)
  with check (true);

comment on table meridian_communication_events is
  'Provider-neutral communication history. Initially populated by Sakari SMS webhooks.';
