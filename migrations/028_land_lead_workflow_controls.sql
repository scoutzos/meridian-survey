-- =============================================================================
-- Meridian land lead workflow controls.
--
-- Adds production workflow support for imported land lists: import preview
-- metadata, duplicate flags, lead scoring, batch assignment/status, outreach
-- activity logging, and tighter conversion tracking back to deal packets.
-- =============================================================================

alter table meridian_land_lead_import_batches
  add column if not exists status text not null default 'not-started'
    check (status in ('not-started','in-progress','completed')),
  add column if not exists assigned_to text references meridian_members(name) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists import_summary jsonb not null default '{}'::jsonb,
  add column if not exists notes text;

create index if not exists meridian_land_lead_import_batches_status_idx
  on meridian_land_lead_import_batches(status, created_at desc);

alter table meridian_imported_land_leads
  add column if not exists duplicate_status text not null default 'new'
    check (duplicate_status in ('new','possible-duplicate','already-converted')),
  add column if not exists duplicate_of uuid references meridian_imported_land_leads(id) on delete set null,
  add column if not exists lead_score integer not null default 0 check (lead_score >= 0 and lead_score <= 100),
  add column if not exists score_reasons text[] not null default '{}'::text[],
  add column if not exists assigned_to text references meridian_members(name) on delete set null,
  add column if not exists next_follow_up_date date,
  add column if not exists outreach_count integer not null default 0,
  add column if not exists last_activity_at timestamptz,
  add column if not exists last_activity_type text;

create index if not exists meridian_imported_land_leads_duplicate_idx
  on meridian_imported_land_leads(duplicate_status, created_at desc);

create index if not exists meridian_imported_land_leads_score_idx
  on meridian_imported_land_leads(lead_score desc, created_at desc);

create index if not exists meridian_imported_land_leads_followup_idx
  on meridian_imported_land_leads(next_follow_up_date, status)
  where next_follow_up_date is not null;

create table if not exists meridian_imported_land_lead_activities (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references meridian_imported_land_leads(id) on delete cascade,
  actor           text references meridian_members(name) on delete set null,
  activity_type   text not null
                    check (activity_type in ('called','texted','emailed','left-voicemail','wrong-number','interested','not-interested','follow-up-set','note','converted')),
  summary         text not null,
  next_follow_up_date date,
  created_at      timestamptz not null default now()
);

create index if not exists meridian_imported_land_lead_activities_lead_idx
  on meridian_imported_land_lead_activities(lead_id, created_at desc);

create or replace function meridian_touch_imported_land_lead_from_activity()
returns trigger as $$
begin
  update meridian_imported_land_leads
    set outreach_count = outreach_count + case
          when new.activity_type in ('called','texted','emailed','left-voicemail') then 1
          else 0
        end,
        last_activity_at = new.created_at,
        last_activity_type = new.activity_type,
        next_follow_up_date = coalesce(new.next_follow_up_date, next_follow_up_date),
        status = case
          when new.activity_type = 'interested' then 'interested'
          when new.activity_type = 'not-interested' then 'passed'
          when new.activity_type in ('called','texted','emailed','left-voicemail','wrong-number','follow-up-set') and status = 'new' then 'contacted'
          else status
        end,
        updated_at = now()
    where id = new.lead_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists meridian_imported_land_lead_activity_touch
  on meridian_imported_land_lead_activities;

create trigger meridian_imported_land_lead_activity_touch
after insert on meridian_imported_land_lead_activities
for each row execute function meridian_touch_imported_land_lead_from_activity();

comment on table meridian_imported_land_lead_activities is
  'Call, text, email, follow-up, and conversion activity against imported land leads.';

alter table meridian_members
  add column if not exists role text not null default 'member'
    check (role in ('member','va')),
  add column if not exists access_scope text not null default 'member-portal'
    check (access_scope in ('member-portal','va-portal'));

update meridian_members
  set role = 'va',
      access_scope = 'va-portal'
  where name = 'Sophie / VA';

update meridian_members
  set role = 'member',
      access_scope = 'member-portal'
  where name <> 'Sophie / VA'
    and (role is null or role <> 'member');

alter table if exists meridian_land_lead_import_batches enable row level security;
alter table if exists meridian_imported_land_leads enable row level security;
alter table if exists meridian_imported_land_lead_activities enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'meridian_land_lead_import_batches',
    'meridian_imported_land_leads',
    'meridian_imported_land_lead_activities'
  ];
begin
  foreach t in array tables loop
    if to_regclass(t) is not null then
      execute format('drop policy if exists "%s prototype anon read" on %I', t, t);
      execute format('drop policy if exists "%s prototype anon write" on %I', t, t);
      execute format('create policy "%s prototype anon read" on %I for select to anon using (true)', t, t);
      execute format('create policy "%s prototype anon write" on %I for all to anon using (true) with check (true)', t, t);
    end if;
  end loop;
end $$;

comment on column meridian_members.role is
  'Prototype role marker. Sophie / VA is a non-member operator and should receive limited Supabase Auth/RLS access before production.';
