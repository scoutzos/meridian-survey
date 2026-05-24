alter table if exists tracker_contributions
  drop constraint if exists tracker_contributions_type_check;

alter table if exists tracker_contributions
  add constraint tracker_contributions_type_check
  check (type in ('initial_contribution','monthly_dues','capital_call','expense'));
