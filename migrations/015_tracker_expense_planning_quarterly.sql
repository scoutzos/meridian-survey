-- Add quarterly cadence support for existing planning tables.

alter table if exists tracker_expense_proposals
  drop constraint if exists tracker_expense_proposals_cadence_check;

alter table if exists tracker_expense_proposals
  add constraint tracker_expense_proposals_cadence_check
  check (cadence in ('monthly','quarterly','one_time'));
