alter table meridian_deal_activity
  drop constraint if exists meridian_deal_activity_activity_type_check;

alter table meridian_deal_activity
  add constraint meridian_deal_activity_activity_type_check
  check (activity_type in ('created','updated','status-change','checklist-update','submitted-review','attachment-added','note'));
