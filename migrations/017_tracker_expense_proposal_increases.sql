-- Allow proposal budget changes to model increases to existing expenses.

alter table if exists tracker_expense_proposal_offsets
  drop constraint if exists tracker_expense_proposal_offsets_offset_kind_check;

alter table if exists tracker_expense_proposal_offsets
  add constraint tracker_expense_proposal_offsets_offset_kind_check
  check (offset_kind in ('increase','reduce','remove'));
