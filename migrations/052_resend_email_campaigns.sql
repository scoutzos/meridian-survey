-- =============================================================================
-- Meridian Resend email campaigns.
--
-- Campaigns reuse the portal-owned Resend mailboxes from migration 051. The
-- portal stores templates, recipients, suppression decisions, and delivery
-- outcomes while Resend handles the actual delivery and event webhooks.
-- =============================================================================

create table if not exists meridian_email_templates (
  id            uuid primary key default gen_random_uuid(),
  mailbox_id    uuid references meridian_email_mailboxes(id) on delete set null,
  name          text not null,
  description   text,
  subject       text not null,
  body_text     text not null,
  body_html     text,
  variables     text[] not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    text,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create index if not exists meridian_email_templates_active_idx
  on meridian_email_templates(is_active, updated_at desc);

create table if not exists meridian_email_campaigns (
  id                uuid primary key default gen_random_uuid(),
  mailbox_id        uuid not null references meridian_email_mailboxes(id) on delete restrict,
  template_id       uuid references meridian_email_templates(id) on delete set null,
  name              text not null,
  subject           text not null,
  body_text         text not null,
  body_html         text,
  status            text not null default 'draft'
    check (status in ('draft','sending','sent','failed','canceled')),
  audience_source   text not null default 'manual',
  audience_label    text,
  recipient_count   integer not null default 0,
  suppressed_count  integer not null default 0,
  sent_count        integer not null default 0,
  failed_count      integer not null default 0,
  opened_count      integer not null default 0,
  clicked_count     integer not null default 0,
  bounced_count     integer not null default 0,
  complained_count  integer not null default 0,
  error             text,
  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz not null default now(),
  sent_at           timestamptz
);

create index if not exists meridian_email_campaigns_status_idx
  on meridian_email_campaigns(status, created_at desc);

create table if not exists meridian_email_campaign_recipients (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references meridian_email_campaigns(id) on delete cascade,
  crm_contact_id     uuid references meridian_crm_contacts(id) on delete set null,
  email              text not null,
  display_name       text,
  status             text not null default 'pending'
    check (status in ('pending','suppressed','sent','delivered','opened','clicked','bounced','complained','failed')),
  provider_email_id  text,
  unsubscribe_token  text not null default replace(gen_random_uuid()::text, '-', ''),
  error              text,
  sent_at            timestamptz,
  event_at           timestamptz,
  raw_payload        jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  unique (campaign_id, email)
);

create unique index if not exists meridian_email_campaign_recipients_provider_idx
  on meridian_email_campaign_recipients(provider_email_id)
  where provider_email_id is not null;

create unique index if not exists meridian_email_campaign_recipients_unsubscribe_idx
  on meridian_email_campaign_recipients(unsubscribe_token);

create index if not exists meridian_email_campaign_recipients_campaign_status_idx
  on meridian_email_campaign_recipients(campaign_id, status);

alter table meridian_email_templates enable row level security;
alter table meridian_email_campaigns enable row level security;
alter table meridian_email_campaign_recipients enable row level security;

drop policy if exists "meridian_email_templates anon all" on meridian_email_templates;
drop policy if exists "meridian_email_campaigns anon all" on meridian_email_campaigns;
drop policy if exists "meridian_email_campaign_recipients anon all" on meridian_email_campaign_recipients;

create policy "meridian_email_templates anon all"
  on meridian_email_templates for all to anon using (true) with check (true);
create policy "meridian_email_campaigns anon all"
  on meridian_email_campaigns for all to anon using (true) with check (true);
create policy "meridian_email_campaign_recipients anon all"
  on meridian_email_campaign_recipients for all to anon using (true) with check (true);

comment on table meridian_email_templates is
  'Reusable email templates for one-off and campaign sends.';
comment on table meridian_email_campaigns is
  'Portal-managed Resend email campaigns.';
comment on table meridian_email_campaign_recipients is
  'Per-recipient campaign delivery and engagement outcomes.';
