-- =============================================================================
-- Integrity and prototype RLS policies.
--
-- This keeps the current localStorage-based member identity model working while
-- adding database guardrails. Replace these permissive prototype policies with
-- Supabase Auth-based policies before production use.
-- =============================================================================

do $$
begin
  -- One current deal agreement per deal. Only apply after migration 011 exists.
  if to_regclass('meridian_deal_agreements') is not null then
    create unique index if not exists meridian_deal_agreements_one_per_deal_idx
      on meridian_deal_agreements(deal_id);
  end if;

  -- One active project per source deal. Only apply after migration 008 exists.
  if to_regclass('meridian_projects') is not null then
    alter table meridian_projects
      add column if not exists source_key text;

    create unique index if not exists meridian_projects_one_active_per_deal_idx
      on meridian_projects(deal_id)
      where deal_id is not null and deleted_at is null;

    create unique index if not exists meridian_projects_one_active_per_source_key_idx
      on meridian_projects(source_key)
      where source_key is not null and deleted_at is null;
  end if;
end $$;

-- Enable RLS on Meridian-owned tables. Prototype policies intentionally allow
-- the anon app client while the login system is still custom/client-side.
alter table if exists meridian_members enable row level security;
alter table if exists meridian_responses enable row level security;
alter table if exists tracker_settings enable row level security;
alter table if exists tracker_member_profiles enable row level security;
alter table if exists tracker_expenses enable row level security;
alter table if exists tracker_contributions enable row level security;
alter table if exists tracker_capital_calls enable row level security;
alter table if exists tracker_audit_log enable row level security;
alter table if exists tracker_expense_proposals enable row level security;
alter table if exists tracker_expense_proposal_votes enable row level security;
alter table if exists action_items enable row level security;
alter table if exists meeting_notes enable row level security;
alter table if exists next_meeting enable row level security;
alter table if exists transcripts enable row level security;
alter table if exists meridian_deals enable row level security;
alter table if exists meridian_deal_due_diligence_items enable row level security;
alter table if exists meridian_deal_votes enable row level security;
alter table if exists meridian_projects enable row level security;
alter table if exists meridian_project_timeline_events enable row level security;
alter table if exists meridian_notifications enable row level security;
alter table if exists meridian_project_risks enable row level security;
alter table if exists meridian_vendors enable row level security;
alter table if exists meridian_project_documents enable row level security;
alter table if exists meridian_calendar_events enable row level security;
alter table if exists meridian_reimbursements enable row level security;
alter table if exists meridian_distributions enable row level security;
alter table if exists meridian_deal_scenarios enable row level security;
alter table if exists meridian_generated_memos enable row level security;
alter table if exists meridian_deal_agreements enable row level security;
alter table if exists meridian_hub_announcements enable row level security;
alter table if exists meridian_hub_decisions enable row level security;
alter table if exists meridian_hub_links enable row level security;
alter table if exists meridian_hub_documents enable row level security;
alter table if exists meridian_hub_profiles enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'meridian_members','meridian_responses',
    'tracker_settings','tracker_member_profiles','tracker_expenses','tracker_contributions','tracker_capital_calls','tracker_audit_log','tracker_expense_proposals','tracker_expense_proposal_votes',
    'action_items','meeting_notes','next_meeting','transcripts',
    'meridian_deals','meridian_deal_due_diligence_items','meridian_deal_votes','meridian_projects','meridian_project_timeline_events',
    'meridian_notifications','meridian_project_risks','meridian_vendors','meridian_project_documents',
    'meridian_calendar_events','meridian_reimbursements','meridian_distributions','meridian_deal_scenarios','meridian_generated_memos','meridian_deal_agreements',
    'meridian_hub_announcements','meridian_hub_decisions','meridian_hub_links','meridian_hub_documents','meridian_hub_profiles'
  ];
begin
  foreach t in array tables loop
    if to_regclass(t) is not null then
      execute format('drop policy if exists "%s prototype anon read" on %I', t, t);
      execute format('drop policy if exists "%s prototype anon write" on %I', t, t);
      execute format('create policy "%s prototype anon read" on %I for select to anon using (true)', t, t);
      execute format('create policy "%s prototype anon write" on %I for all to anon using (true) with check (true)', t, t);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('meridian_members') is not null then
    comment on policy "meridian_members prototype anon read" on meridian_members is
      'Temporary prototype policy. Replace with Supabase Auth/RLS before production.';
  end if;
end $$;
