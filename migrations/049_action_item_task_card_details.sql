-- =============================================================================
-- Action item task card details
--
-- Adds richer work-order fields for member-assigned and VA tasks:
-- deadline, expected outcome, and an inline checklist stored with the task card.
-- =============================================================================

alter table action_items
  add column if not exists deadline_at timestamptz,
  add column if not exists expected_outcome text,
  add column if not exists checklist_items jsonb not null default '[]'::jsonb;

create index if not exists action_items_deadline_idx
  on action_items(deadline_at)
  where deleted_at is null and deadline_at is not null;

alter table action_item_events
  drop constraint if exists action_item_events_event_type_check;

alter table action_item_events
  add constraint action_item_events_event_type_check
  check (event_type in ('created','status-changed','completed','blocked','reopened','deleted','comment','reassigned','checklist-updated'));

comment on column action_items.deadline_at is
  'Optional exact deadline for a task card. due_date remains available for date-only sorting and older task flows.';

comment on column action_items.expected_outcome is
  'Plain-language definition of done for the task.';

comment on column action_items.checklist_items is
  'JSON array of task checklist items: { id, text, done, completed_by, completed_at }.';

comment on constraint action_item_events_event_type_check on action_item_events is
  'Allowed task history event types, including assignment handoffs and checklist updates.';
