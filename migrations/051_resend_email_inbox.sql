-- =============================================================================
-- Meridian Resend email inbox.
--
-- Resend provides sending, receiving, and webhook events. The portal owns the
-- mailbox UX: threads, messages, attachments, assignments, and entity links.
-- =============================================================================

create table if not exists meridian_email_mailboxes (
  id              uuid primary key default gen_random_uuid(),
  address         text not null,
  display_name    text not null,
  kind            text not null default 'shared'
    check (kind in ('shared','personal','campaign','system')),
  description     text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (address)
);

create unique index if not exists meridian_email_mailboxes_address_lower_idx
  on meridian_email_mailboxes(lower(address));

create table if not exists meridian_email_threads (
  id                    uuid primary key default gen_random_uuid(),
  mailbox_id            uuid not null references meridian_email_mailboxes(id) on delete cascade,
  thread_key            text not null,
  subject               text,
  normalized_subject    text,
  participants          text[] not null default '{}',
  status                text not null default 'open'
    check (status in ('open','closed','archived')),
  assigned_to           text,
  linked_lead_id        uuid references meridian_imported_land_leads(id) on delete set null,
  linked_deal_id        uuid references meridian_deals(id) on delete set null,
  linked_crm_contact_id uuid references meridian_crm_contacts(id) on delete set null,
  unread_count          integer not null default 0,
  message_count         integer not null default 0,
  last_message_at       timestamptz,
  last_message_preview  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists meridian_email_threads_mailbox_idx
  on meridian_email_threads(mailbox_id, status, last_message_at desc nulls last);

create index if not exists meridian_email_threads_lead_idx
  on meridian_email_threads(linked_lead_id, last_message_at desc nulls last)
  where linked_lead_id is not null;

create index if not exists meridian_email_threads_deal_idx
  on meridian_email_threads(linked_deal_id, last_message_at desc nulls last)
  where linked_deal_id is not null;

create table if not exists meridian_email_messages (
  id                   uuid primary key default gen_random_uuid(),
  thread_id            uuid not null references meridian_email_threads(id) on delete cascade,
  mailbox_id           uuid not null references meridian_email_mailboxes(id) on delete cascade,
  provider             text not null default 'resend',
  provider_email_id    text,
  provider_message_id  text,
  direction            text not null check (direction in ('inbound','outbound','status','system')),
  from_email           text,
  from_name            text,
  to_emails            text[] not null default '{}',
  cc_emails            text[] not null default '{}',
  bcc_emails           text[] not null default '{}',
  reply_to_emails      text[] not null default '{}',
  subject              text,
  preview              text,
  body_text            text,
  body_html            text,
  headers              jsonb not null default '{}'::jsonb,
  raw_payload          jsonb not null default '{}'::jsonb,
  status               text,
  sent_by              text,
  created_at           timestamptz not null default now(),
  provider_created_at  timestamptz,
  unique (provider, provider_email_id)
);

create index if not exists meridian_email_messages_thread_idx
  on meridian_email_messages(thread_id, provider_created_at asc nulls last, created_at asc);

create index if not exists meridian_email_messages_provider_message_idx
  on meridian_email_messages(provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists meridian_email_messages_from_email_idx
  on meridian_email_messages(lower(from_email))
  where from_email is not null;

create table if not exists meridian_email_attachments (
  id                     uuid primary key default gen_random_uuid(),
  message_id             uuid not null references meridian_email_messages(id) on delete cascade,
  provider_attachment_id text,
  filename               text not null,
  content_type           text,
  content_disposition    text,
  content_id             text,
  size_bytes             integer,
  storage_bucket         text,
  storage_path           text,
  raw_payload            jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now()
);

create index if not exists meridian_email_attachments_message_idx
  on meridian_email_attachments(message_id);

create table if not exists meridian_email_webhook_events (
  svix_id          text primary key,
  event_type       text not null,
  event_created_at timestamptz,
  payload          jsonb not null,
  processed_at     timestamptz,
  error            text,
  created_at       timestamptz not null default now()
);

create table if not exists meridian_email_suppressions (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  reason      text not null
    check (reason in ('unsubscribed','bounced','complained','blocked')),
  source      text not null default 'resend',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (email, reason)
);

create unique index if not exists meridian_email_suppressions_email_reason_lower_idx
  on meridian_email_suppressions(lower(email), reason);

alter table meridian_email_mailboxes enable row level security;
alter table meridian_email_threads enable row level security;
alter table meridian_email_messages enable row level security;
alter table meridian_email_attachments enable row level security;
alter table meridian_email_webhook_events enable row level security;
alter table meridian_email_suppressions enable row level security;

drop policy if exists "meridian_email_mailboxes anon all" on meridian_email_mailboxes;
drop policy if exists "meridian_email_threads anon all" on meridian_email_threads;
drop policy if exists "meridian_email_messages anon all" on meridian_email_messages;
drop policy if exists "meridian_email_attachments anon all" on meridian_email_attachments;
drop policy if exists "meridian_email_webhook_events anon all" on meridian_email_webhook_events;
drop policy if exists "meridian_email_suppressions anon all" on meridian_email_suppressions;

create policy "meridian_email_mailboxes anon all"
  on meridian_email_mailboxes for all to anon using (true) with check (true);
create policy "meridian_email_threads anon all"
  on meridian_email_threads for all to anon using (true) with check (true);
create policy "meridian_email_messages anon all"
  on meridian_email_messages for all to anon using (true) with check (true);
create policy "meridian_email_attachments anon all"
  on meridian_email_attachments for all to anon using (true) with check (true);
create policy "meridian_email_webhook_events anon all"
  on meridian_email_webhook_events for all to anon using (true) with check (true);
create policy "meridian_email_suppressions anon all"
  on meridian_email_suppressions for all to anon using (true) with check (true);

comment on table meridian_email_mailboxes is
  'Portal-owned email addresses routed through Resend.';
comment on table meridian_email_threads is
  'Email conversation threads for the portal inbox.';
comment on table meridian_email_messages is
  'Inbound and outbound email messages stored from Resend.';
comment on table meridian_email_webhook_events is
  'Raw Resend webhook events keyed by svix-id for idempotency.';
