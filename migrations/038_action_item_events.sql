-- =============================================================================
-- Action item events
--
-- Adds a durable event stream for work routing so task history is not limited
-- to the latest updated/completed fields on action_items.
-- =============================================================================

create table if not exists action_item_events (
  id              uuid primary key default gen_random_uuid(),
  action_item_id  uuid not null references action_items(id) on delete cascade,
  event_type      text not null
    check (event_type in ('created','status-changed','completed','blocked','reopened','deleted','comment')),
  previous_status text,
  next_status     text,
  note            text,
  created_by      text,
  created_at      timestamptz not null default now()
);

create index if not exists action_item_events_item_idx
  on action_item_events(action_item_id, created_at desc);

alter table action_item_events enable row level security;

drop policy if exists "action_item_events prototype anon read" on action_item_events;
drop policy if exists "action_item_events prototype anon write" on action_item_events;
create policy "action_item_events prototype anon read"
  on action_item_events for select to anon using (true);
create policy "action_item_events prototype anon write"
  on action_item_events for all to anon using (true) with check (true);

drop policy if exists "action_item_events authenticated read" on action_item_events;
drop policy if exists "action_item_events authenticated insert" on action_item_events;

create policy "action_item_events authenticated read"
  on action_item_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from action_items ai
      where ai.id = action_item_events.action_item_id
        and ai.deleted_at is null
        and (
          meridian_is_admin()
          or ai.assigned_to is null
          or ai.assigned_to = 'All Members'
          or ai.assigned_to = meridian_current_member_name()
          or ai.created_by = meridian_current_member_name()
          or ai.task_type = 'va-work'
        )
    )
  );

create policy "action_item_events authenticated insert"
  on action_item_events
  for insert
  to authenticated
  with check (
    meridian_current_member_name() is not null
    and created_by = meridian_current_member_name()
    and exists (
      select 1
      from action_items ai
      where ai.id = action_item_events.action_item_id
        and ai.deleted_at is null
        and (
          meridian_is_admin()
          or ai.assigned_to = meridian_current_member_name()
          or ai.created_by = meridian_current_member_name()
          or (meridian_is_va() and (ai.assigned_to = 'Sophie / VA' or ai.task_type = 'va-work'))
        )
    )
  );

comment on table action_item_events is
  'Durable task history for member-to-VA work routing, status changes, blockers, completion notes, and future comments.';
