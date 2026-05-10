-- =============================================================================
-- Meridian VA deal submission controls.
--
-- Adds review intent, submission summary, requested next step, uncertainty notes,
-- submit timestamps, review rounds, and notification tracking so VA submissions
-- can be gated and members receive cleaner deal packets.
-- =============================================================================

alter table meridian_deals
  add column if not exists review_intent text
    check (review_intent is null or review_intent in ('needs-info-review','ready-for-vote','blocked-decision')),
  add column if not exists submission_summary text,
  add column if not exists requested_next_step text,
  add column if not exists submit_uncertainties text,
  add column if not exists first_submitted_at timestamptz,
  add column if not exists last_submitted_at timestamptz,
  add column if not exists review_round integer not null default 0,
  add column if not exists last_review_notification_at timestamptz;

create index if not exists meridian_deals_submission_idx
  on meridian_deals(status, review_intent, last_submitted_at desc)
  where deleted_at is null;

