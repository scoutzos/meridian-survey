-- Track VA/admin read state for communication inbox threads.
alter table meridian_communication_events
  add column if not exists read_at timestamptz,
  add column if not exists read_by text;

create index if not exists meridian_communication_events_unread_idx
  on meridian_communication_events(direction, read_at, created_at desc)
  where read_at is null;
