# Meridian Production QA Runbook

Use this runbook after the latest Vercel deployment is live and all SQL migrations have been run in Supabase.

## 1. Access And Identity

Pass criteria:

- Each member can log in with Supabase Auth or legacy fallback during cutover.
- The VA logs in and lands on `/va`.
- A member logs in and lands on `/dashboard`.
- Sign out clears both Meridian local identity and Supabase session.
- Supabase Auth users have `user_metadata.member_name` matching `meridian_members.member_name`.

Records to verify:

- `meridian_members.auth_email`
- `meridian_members.auth_user_id`
- `auth.users.raw_user_meta_data`

## 2. VA Import To Lead Work

Pass criteria:

- VA imports a Land Portal or Land Insights CSV.
- Import batch saves successfully.
- Imported leads appear in the VA work queue.
- Lead search finds imported owner, phone, parcel, county, and address.
- Updating disposition/status creates visible activity history.
- Bad numbers and DNC statuses remain visible and do not disappear.

Records to verify:

- `meridian_land_lead_import_batches`
- `meridian_imported_land_leads`
- `meridian_imported_land_lead_activities`

## 3. Sakari SMS

Pass criteria:

- Inbound SMS from a known imported lead matches the lead.
- Inbound SMS from an unknown number appears as unmatched.
- Outbound single SMS from VA/CRM sends through Sakari.
- Bulk SMS sends only to selected eligible leads.
- Opt-out events update SMS opt status and prevent future outreach.
- Conversation panel shows inbound, outbound, and status events.

Records to verify:

- `meridian_communication_events`
- `meridian_imported_land_leads.last_sms_at`
- `meridian_imported_land_leads.last_sms_direction`
- `meridian_imported_land_leads.sms_opt_status`

## 4. VA Daily Brief

Pass criteria:

- VA clocks in or starts shift from the VA desk.
- Completed VA tasks count into the daily brief.
- SMS/call/deal activity metrics are editable before submission.
- VA submits end-of-shift brief.
- Members see the brief on dashboard and Operations.
- Member review marks the brief reviewed.

Records to verify:

- `va_daily_briefs`
- `va_daily_brief_reviews`
- `action_items.completed_at`
- `action_items.task_type = 'va-work'`

## 5. Deal Packet And Member Vote

Pass criteria:

- VA converts an interested lead into a deal packet.
- Opportunity file opens from the lead/deal.
- Calculator values save and display in the packet.
- Member vote request appears in dashboard/actions.
- Member vote records correctly and updates packet state.
- Agreement and diligence gates behave as expected before project conversion.

Records to verify:

- `meridian_deals`
- `meridian_deal_votes`
- `meridian_deal_agreements`
- `meridian_due_diligence_items`
- `meridian_notifications`

## 6. CRM And Disposition

Pass criteria:

- CRM nav is reachable from member portal and mobile bottom nav.
- Contact, buyer, property, campaign, and offer detail panels open.
- Recording a buyer offer creates member notifications and action items.
- Accepting an offer completes related review tasks.
- Accepted offer creates/links a project and closing checklist tasks.
- Rejected or withdrawn offer creates a disposition follow-up task.
- Campaign touch history shows offer milestones and linked SMS.

Records to verify:

- `meridian_disposition_campaigns`
- `meridian_buyer_offers`
- `action_items`
- `action_item_events`
- `meridian_projects`
- `meridian_project_timeline_events`

## 7. Member Tasks And VA Assignment

Pass criteria:

- Member creates a task assigned to Sophie / VA.
- Task can be linked to lead, deal, project, meeting, or document.
- VA can start, complete, and block the task.
- Blocked task appears in Operations escalation.
- Member response reopens blocked task and notifies VA.
- Comments, reassignments, completions, and blockers appear in task history.

Records to verify:

- `action_items`
- `action_item_events`
- `meridian_notifications`

## 8. Money, Projects, Documents, Meetings

Pass criteria:

- Capital calls and reimbursements show on Dashboard and Operations.
- Project records show inherited deal context after conversion.
- Documents page remains the source of truth for canonical files.
- Meetings page creates usable agenda/minute/transcript records.
- Decision records are visible but do not duplicate active task/vote queues.

Records to verify:

- `tracker_capital_calls`
- `tracker_reimbursements`
- `meridian_projects`
- `project_documents`
- `meeting_notes`
- `hub_decisions`

## 9. RLS And Permissions

Pass criteria:

- VA cannot access member-only dashboard/actions beyond assigned VA work.
- Members cannot update unrelated private VA shift data unless policy allows review.
- Members can create tasks and see tasks assigned to them/all members.
- Authenticated users can use app flows without relying on anon prototype policies.
- Prototype anon policies are removed only after all Auth tests pass.

Use `Supabase_Auth_Cutover_Runbook.md` before removing prototype policies.

## 10. Launch Decision

Do not call the rebuild production-ready until these are true:

- No failed Vercel build.
- No SQL errors in the tested flows.
- No RLS errors for intended VA/member actions.
- No duplicate or orphaned task/vote/notification records in core workflows.
- VA and at least one member complete the whole path from lead import to member review.
- At least one disposition path is tested through offer accepted or offer rejected.
