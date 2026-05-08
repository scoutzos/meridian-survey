-- Add monthly operating dues comfort to membership applications.

alter table if exists membership_candidates
  add column if not exists monthly_dues_comfort text;

alter table if exists membership_candidates
  add column if not exists monthly_dues_max numeric;
