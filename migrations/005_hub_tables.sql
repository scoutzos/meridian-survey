-- =============================================================================
-- Hub tables — action items + meeting notes for the operating-hub experience.
--
-- action_items   — task tracker (assigned, due dates, status flow)
-- meeting_notes  — past meeting record (date, agenda, notes, attendees)
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------- action_items ----------------------------------------------------
create table if not exists action_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  assigned_to   text,                                  -- member name OR "All Members"
  due_date      date,
  status        text not null default 'open'
                  check (status in ('open','in-progress','done')),

  created_at    timestamptz not null default now(),
  created_by    text,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  completed_at  timestamptz,
  deleted_at    timestamptz
);

create index if not exists action_items_status_idx
  on action_items(status) where deleted_at is null;
create index if not exists action_items_assigned_idx
  on action_items(assigned_to) where deleted_at is null;
create index if not exists action_items_due_idx
  on action_items(due_date) where deleted_at is null;

-- ---------- meeting_notes ---------------------------------------------------
create table if not exists meeting_notes (
  id            uuid primary key default gen_random_uuid(),
  meeting_date  date not null,
  agenda        text,
  notes         text,
  attendees     jsonb not null default '[]'::jsonb,    -- array of member names

  created_at    timestamptz not null default now(),
  created_by    text,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  deleted_at    timestamptz
);

create index if not exists meeting_notes_date_idx
  on meeting_notes(meeting_date desc) where deleted_at is null;

-- ---------- next_meeting (single-row config for upcoming meeting metadata) --
create table if not exists next_meeting (
  key            text primary key,
  meeting_date   date,
  meeting_time   text,                                 -- e.g. "7:15 PM ET"
  agenda         text,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

insert into next_meeting (key, meeting_date, meeting_time, agenda, updated_by)
values (
  'next',
  null,
  '7:15 PM ET',
  E'Standing Monday meeting.\n\n• Review tiebreaker results\n• LLC formation status\n• Capital contributions update',
  'system'
)
on conflict (key) do nothing;

comment on table action_items  is 'Task tracker for the Meridian operating hub.';
comment on table meeting_notes is 'Past meeting agenda + notes archive.';
comment on table next_meeting  is 'Single-row config for the upcoming meeting card.';
