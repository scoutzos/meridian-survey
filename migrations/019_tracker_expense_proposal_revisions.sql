-- Add revision workflow for expense proposals.
-- Members can request changes; admins/proposers revise the proposal and re-open voting.

alter table if exists tracker_expense_proposals
  drop constraint if exists tracker_expense_proposals_status_check;

alter table if exists tracker_expense_proposals
  add constraint tracker_expense_proposals_status_check
  check (status in ('draft','review','revision_needed','approved','rejected','converted'));

alter table if exists tracker_expense_proposals
  add column if not exists revision_number int not null default 1 check (revision_number >= 1);

alter table if exists tracker_expense_proposals
  add column if not exists revision_note text;

alter table if exists tracker_expense_proposal_votes
  drop constraint if exists tracker_expense_proposal_votes_decision_check;

alter table if exists tracker_expense_proposal_votes
  add constraint tracker_expense_proposal_votes_decision_check
  check (decision in ('approve','reject','abstain','request_changes'));

alter table if exists tracker_expense_proposal_votes
  add column if not exists proposal_version int not null default 1 check (proposal_version >= 1);

alter table if exists tracker_expense_proposal_votes
  drop constraint if exists tracker_expense_proposal_votes_proposal_id_member_name_key;

alter table if exists tracker_expense_proposal_votes
  add constraint tracker_expense_proposal_votes_proposal_member_version_key
  unique(proposal_id, member_name, proposal_version);

create index if not exists tracker_expense_proposal_votes_version_idx
  on tracker_expense_proposal_votes(proposal_id, proposal_version);
