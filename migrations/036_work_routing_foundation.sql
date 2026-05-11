-- =============================================================================
-- Work routing foundation
-- Adds task metadata needed for member-to-VA work routing and daily brief counts.
-- Idempotent: safe to re-run.
-- =============================================================================

alter table action_items
  drop constraint if exists action_items_status_check;

alter table action_items
  add constraint action_items_status_check
  check (status in ('open','in-progress','blocked','done'));

alter table action_items
  add column if not exists task_type text not null default 'general'
    check (task_type in ('general','va-work','meeting-follow-up','deal-follow-up','project-task','document-review','money-approval')),
  add column if not exists priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  add column if not exists source_table text,
  add column if not exists source_id text,
  add column if not exists completion_note text,
  add column if not exists blocker_reason text,
  add column if not exists completed_by text;

create index if not exists action_items_task_type_idx
  on action_items(task_type) where deleted_at is null;

create index if not exists action_items_source_idx
  on action_items(source_table, source_id) where deleted_at is null;

alter table meridian_va_daily_briefs
  add column if not exists va_tasks_completed integer;

comment on column action_items.task_type is 'Work routing category such as VA work, meeting follow-up, project task, or document review.';
comment on column action_items.source_table is 'Optional linked record table/source for the task.';
comment on column action_items.source_id is 'Optional linked record id for the task.';
comment on column meridian_va_daily_briefs.va_tasks_completed is 'Member-assigned VA tasks completed during this daily brief period.';
