-- =============================================================================
-- Action item reassignment events
--
-- Extends durable task history so task owner changes are preserved.
-- =============================================================================

alter table action_item_events
  drop constraint if exists action_item_events_event_type_check;

alter table action_item_events
  add constraint action_item_events_event_type_check
  check (event_type in ('created','status-changed','completed','blocked','reopened','deleted','comment','reassigned'));

comment on constraint action_item_events_event_type_check on action_item_events is
  'Allowed task history event types, including assignment handoffs.';
