# Meridian CRM and Portal Rebuild Plan

Last updated: May 10, 2026

## Plain-English Goal

Meridian should feel like one operating system, not separate portals stitched together.

The VA should be able to import land lists, work sellers, send texts, log outcomes, build deal packets, and submit a daily brief. Members should be able to review those packets, see the communication history, vote, approve deal terms, track money, review documents, and move approved deals into projects without losing context.

The rebuild is about connecting the flow:

```text
Imported list -> seller outreach -> interested lead -> deal packet -> calculator -> member vote -> agreement -> disposition -> project -> money/documents/meetings/tasks
```

## Current Completion Snapshot

| Area | Status | Notes |
| --- | --- | --- |
| VA Workdesk | Mostly built | Imports, queues, SMS, dispositions, packet creation, time, and daily brief exist. Needs final polish and real-data testing. |
| CRM Command Center | In progress | Core CRM views exist. Conversation panel is now added. Needs stronger records/details screens and status consistency. |
| Member Dashboard | In progress | Better operating home exists. Needs unified status language and clearer task routing. |
| Deal Reviews | Mostly built | Guided packet, calculator, communications, vote, agreement, diligence, and project conversion flow exist. Needs final QA and edge cases. |
| Opportunity File | Mostly built | Shared file connects lead, deal, timeline, notes, calculator, review, buyer/disposition context. Needs richer action buttons and real-data QA. |
| Communications/SMS | In progress | Sakari inbound/outbound and shared conversation panel exist. Needs conversation ownership rules, unmatched routing, and bulk-safety polish. |
| Dispositions | Partial | Campaigns/offers exist, but disposition statuses need a clean operating map and better member connection. |
| Money/Tracker | Partial | Tracker pages exist and are linked. Needs deeper connection to approvals, projects, and deal agreements. |
| Documents/Meetings/Decisions | Partial | Pages were reorganized and connected. Needs final feature audit and removal of confusing legacy behavior. |
| Navigation/IA | In progress | CRM no longer fully takes over the member portal. Needs final sitemap and page retirement decisions. |

Estimated structural completion: **88%**

## What Has Been Built In This Rebuild

### 1. Role-Specific Navigation

The app now separates the main experiences better:

- VA users are directed to the VA Desk.
- Members can return to the member portal from CRM.
- CRM has links back to Member Portal, VA Desk, and Deal Reviews.
- The shared Opportunity File links to Member Home, VA Desk, Deal Reviews, and CRM.

Remaining:

- Finalize what belongs in the primary nav versus secondary tools.
- Decide which older pages should be legacy, hidden, or merged.
- Make the mobile nav match the final IA.

### 2. VA Workdesk

The VA Desk now functions more like a real daily work surface:

- Today queue
- Outreach queue
- Imported lists
- Deal packet builder
- Daily shift brief
- Clock-in/clock-out and time edits
- Lead dispositions
- Seller SMS composer
- Quick templates
- Unmatched SMS handling
- Deal packet submission
- Attachments/research links

Remaining:

- Real-data QA on imports, list filtering, lead search, packet conversion, and daily brief submission.
- Cleaner empty states for a new VA with no imported list.
- Stronger guardrails for DNC, bad numbers, duplicate leads, and already-contacted sellers.
- More guided seller outcomes/dispositions.
- Member-to-VA task assignment: members should be able to assign tasks to the VA from the member portal, the VA should see those tasks in the VA Desk Today queue, and completed tasks should count toward the VA daily brief.

### 3. Shared Conversation Panel

A reusable `ConversationPanel` has been added and wired into:

- VA Desk
- CRM
- Deal Reviews
- Opportunity File

It can show:

- inbound SMS
- outbound SMS
- Sakari status/system updates
- call notes
- activity notes
- outcome logs

Remaining:

- Confirm populated threads with production data.
- Decide if the panel should group by Sakari conversation ID, contact, lead, deal, or opportunity.
- Add filters for SMS/calls/notes/system updates.
- Add a clear unmatched-message triage flow in CRM.
- Add bulk message safeguards before sending list-wide texts.

### 4. CRM Command Center

CRM now has a stronger operating frame:

- Inbox
- Deals
- Buyers
- Disposition
- Records
- Selected packet rail
- Linked contacts
- Send SMS
- Conversation panel
- Buyer creation
- Contact linking
- Campaign creation
- Offer recording

Remaining:

- Build fuller record detail drawers/pages for contacts, buyers, properties, campaigns, and offers.
- Create one consistent disposition board.
- Add duplicate detection and merge tools.
- Make unmatched SMS actionable from CRM, not just VA.
- Improve bulk list import review UI and post-import workflow.

### 5. Deal Reviews

Deal Reviews now works more like a member decision workspace:

- Packet tab
- Communications tab
- Agreement tab
- Vote tab
- Diligence tab
- Guided decision path
- Dynamic member next action strip
- Calculator outputs
- VA handoff context
- Member vote controls
- Deal agreement fields
- Diligence checklist
- Convert-to-project gate

Remaining:

- Make member votes easier to understand at a glance.
- Confirm project conversion with real approved deals.
- Add better member comments/questions on each deal.
- Add final status map so "under review," "ready for vote," "approved," and "convertible" do not conflict.
- Decide if members should be able to send seller SMS or only VA/admin should.

### 6. Opportunity File

The Opportunity File now acts as the one shared record:

- Summary strip
- Handoff/calculator/review/agreement/disposition path
- Overview
- Notes
- Calculator
- Timeline/conversation panel
- Review packet
- Buyer matches
- Campaigns
- Offers
- Member votes

Remaining:

- Add richer action buttons for next stage.
- Add clear ownership of who can edit what.
- Make notes and timeline feel like the official audit trail.
- Confirm behavior when a record starts as lead-only and later becomes a deal.

### 7. Member Portal

The member side is being reorganized into an operating portal:

- Dashboard
- Actions
- Deal Reviews
- Operations
- Documents
- Meetings
- Decisions
- Projects
- Tracker/Money
- Candidates/Applications
- Hub

Remaining:

- Final IA sitemap.
- Decide whether Hub is a true landing directory or a legacy admin area.
- Normalize tasks/notifications/action items so members do not see duplicate prompts.
- Connect money approvals to deal/project/agreement context more clearly.
- Add a clean member workflow for assigning tasks to the VA, then reviewing completion through the VA daily brief or Operations page.

## Final IA Recommendation

### Member Portal Primary Navigation

Recommended final member nav:

1. Dashboard
2. Actions
3. Deals
4. Projects
5. Money
6. Documents
7. Meetings
8. Decisions
9. Members

### CRM Primary Navigation

Recommended final CRM nav:

1. Command Center
2. Lead Inbox
3. Deal Pipeline
4. Buyers
5. Disposition
6. Records
7. Tasks
8. Reports
9. Settings

### VA Primary Navigation

Recommended final VA nav:

1. Today
2. Outreach
3. Lists
4. Deal Packet
5. Brief

## Status And Disposition Map

This is the biggest remaining IA risk.

### Lead Status

Recommended:

- New
- Contacted
- Replied
- Interested
- Follow Up
- Bad Number
- DNC
- Passed
- Converted

### Seller Disposition

Recommended:

- No Answer
- Left Voicemail
- Wrong Number
- Not Interested
- Wants Too Much
- Interested
- Needs Follow Up
- Send Offer
- Do Not Contact

### SMS Status

Recommended:

- Unknown
- Opted In
- Opted Out
- Failed
- Delivered
- Replied

### Deal Status

Recommended:

- Draft
- Submitted For Review
- Needs More Info
- Voting
- Approved To Offer
- Offer Made
- Under Contract
- Due Diligence
- Passed
- Converted To Project

### Calculator Status

Recommended:

- Not Started
- Needs Inputs
- Needs Review
- Strong Review
- Review With Caution
- Likely Pass

### Member Vote Status

Recommended:

- Not Requested
- Waiting On Votes
- Quorum Reached
- Approved
- Split Decision
- Rejected
- More Info Requested

### Agreement Status

Recommended:

- Not Started
- Draft
- Ready For Review
- Approved
- Signed
- Superseded

### Diligence Status

Recommended:

- Open
- In Review
- Cleared
- Blocked
- Not Applicable

### Disposition Status

Recommended:

- Not Started
- Exit Strategy Set
- Buyer List Built
- Marketed
- Buyer Interest
- Offer Received
- Buyer Under Contract
- Closing Scheduled
- Closed
- Fell Through

### Project Status

Recommended:

- Created
- Active
- At Risk
- Blocked
- Closing
- Complete
- Archived

## Feature Audit

| Feature | Current State | Risk | Next Action |
| --- | --- | --- | --- |
| Lead CSV import | Built | Medium | Test with real files and RLS. |
| Lead search/autofill | Partial | Medium | Confirm imported lead lookup from interested seller flow. |
| VA outbound SMS | Built | Medium | Confirm Sakari env vars and production send. |
| Inbound SMS webhook | Built | Medium | Confirm unmatched and matched messages in production. |
| Bulk SMS | Built/partial | High | Add compliance guardrails, preview, and send limits. |
| Conversation panel | Built | Medium | Test with populated real threads. |
| Daily VA brief | Built | Medium | Confirm members can review/mark reviewed. |
| Member-to-VA task assignment | Missing/partial | High | Add VA as task assignee, expose member assignment UI, show assigned tasks on VA Desk, count completed tasks in the VA daily brief, and include completion in Operations. |
| Deal packet creation | Built | Medium | QA from VA lead -> deal review -> opportunity file. |
| Calculator | Built/partial | Medium | Improve land-specific formulas and assumptions. |
| Member voting | Built | Medium | QA notifications/action completion. |
| Deal agreement | Built | Medium | Confirm terms are saved and appear in member file. |
| Diligence checklist | Built | Medium | QA status updates and blockers. |
| Disposition campaigns | Partial | High | Build better board and member decision tie-in. |
| Buyer offers | Partial | High | Tie offers to member decisions and project outcomes. |
| Project conversion | Built/partial | High | Test with approved deal and agreement. |
| Money tracker | Partial | Medium | Connect project/deal context. |
| Documents | Partial | Medium | Add upload/storage ownership and record links. |
| Meetings | Partial | Low/Medium | Connect meeting outputs to decisions/tasks. |
| Decisions | Partial | Medium | Connect decisions to votes, records, and audit trail. |
| Actions/tasks | Partial | Medium | Deduplicate notifications and action items. |

## Role-Based Experience

### VA

The VA should see:

- today's queue
- imported lead lists
- seller replies
- follow-ups due
- bad numbers/DNC
- tasks assigned by members
- daily count of assigned tasks completed
- deal packet drafts
- text/call/action panel
- daily shift brief
- time tracking

The VA should not need full member/admin permissions to work leads.

### Member

Members should see:

- what needs their vote
- deal packets waiting for review
- a way to assign work to the VA
- VA task completion status
- capital/money approvals
- project risks
- documents needing review
- meeting follow-ups
- their own tasks
- recent VA daily brief

### Admin/Managing Member

Admins should see:

- VA output
- lead operations
- time approvals
- reimbursements
- capital calls
- member action completion
- CRM data hygiene
- all project/deal records

### Future Limited Roles

Possible future roles:

- contractor
- lender
- attorney
- agent/broker
- title company
- buyer

These should only access selected records, files, and tasks.

## Data Model Gaps

Remaining structural gaps:

- Unified contact ownership across CRM, leads, deals, buyers, and communications.
- Conversation threading by contact/deal/lead/conversation ID.
- Disposition history table for every status change and seller outcome.
- Stage transition log for lead -> deal -> project.
- Approval packet record tying together vote, calculator, memo, agreement, and diligence.
- Task automation rules for status changes.
- Task assignment role support for VA work, including member-created VA tasks and VA completion tracking.
- Stronger audit trail for member/admin/VA edits.
- Document attachment ownership and permissions.
- Buyer demand and buyer offer history.

## Launch Readiness Checklist

Before treating this as production-ready:

- [ ] All SQL migrations run in Supabase.
- [ ] RLS policies tested for VA and member users.
- [ ] Vercel env vars confirmed.
- [ ] Sakari webhook destination confirmed.
- [ ] Sakari outbound SMS tested.
- [ ] Import tested with a real Land Portal/Land Insights CSV.
- [ ] Unmatched inbound SMS tested.
- [ ] VA lead -> deal packet tested.
- [ ] Deal packet -> member vote tested.
- [ ] Vote -> agreement -> project conversion tested.
- [ ] Daily VA brief submitted and reviewed.
- [ ] Bulk SMS tested with safe internal numbers first.
- [ ] Member dashboard reviewed with real data.
- [ ] Mobile views checked.
- [ ] Old/legacy pages reviewed for removal or hiding.

## Remaining Phases

### Phase 1: Status And IA Unification

Status: Complete structurally

Work:

- Created shared status/disposition map in `src/lib/status-map.ts`.
- Created shared lead/deal next-action engine in `src/lib/workflow-actions.ts`.
- Normalized status labels across VA, CRM, Deal Reviews, Opportunity File, Dashboard, and Actions.
- Wired shared lead next actions into the VA seller workflow.
- Wired shared deal next actions into Deal Reviews, CRM, and Opportunity File.
- Remaining QA: confirm labels and next actions against real production data.

Risk: Lower now. Remaining risk is mostly data quality and edge-case QA, not IA drift.

### Phase 2: CRM Record Depth

Status: In Progress

Work:

- Better contact detail panel. Started: CRM now has a selected contact detail panel with relationship status, SMS status, contact info, linked opportunities, notes/tags, and recent communication history.
- Better buyer detail panel. Started: CRM now has a selected buyer detail panel with markets, buy box, POF status, relationship strength, price/acreage range, and offer history.
- Better property record panel. Started: CRM now has a selected property detail panel with parcel, acreage, zoning, land use, values, utilities, road frontage, and connected deal packets.
- Better campaign/offer detail panels. Started: CRM now has selected disposition campaign and buyer offer panels with target/minimum price, stage, channels, buyer list count, offer history, and links back to the deal packet.
- Duplicate/cleanup tools.
- Member-to-VA task assignment if treated as part of CRM/Operations work routing.

Completed in this pass:

- Converted CRM buyers, contacts, properties, campaigns, and offers into clickable master-detail records.
- Added right-rail detail surfaces so a user can inspect the selected CRM record without leaving the workspace.
- Added field-level record hygiene prompts for selected contacts, properties, buyers, campaigns, and offers.
- Preserved links back to the shared Opportunity File / deal packet so CRM records do not become a disconnected side database.
- Verified production build after implementation.

Remaining:

- Add duplicate detection and cleanup prompts.
- Add edit/update actions on existing CRM records, not just create actions.
- Make the new field-level completeness indicators actionable with edit/cleanup flows.
- Decide whether Member-to-VA task assignment belongs in this CRM phase or the next Operations phase.

Risk: Medium. CRM record depth is now visibly stronger, but the system still needs cleanup/editing tools before it feels like a durable source of truth.

### Phase 2A: Member-To-VA Task Assignment

Status: Needed

Work:

- Add VA users, such as `Sophie / VA`, to the task assignee dropdown.
- Decide whether all members or only admins can assign VA tasks.
- Add a task type/category for VA work.
- Show VA-assigned tasks in the VA Desk Today queue.
- Let the VA mark assigned tasks Open, In Progress, and Done.
- Count tasks marked Done during the VA shift/day in the daily brief metrics.
- Include completed VA tasks in the daily brief detail and Operations review.
- Notify members when a VA task is completed or blocked.

Risk: High if skipped. Members will keep assigning VA work through texts or side conversations, which defeats the purpose of the portal.

### Phase 3: Disposition Workspace

Status: Next

Work:

- Build disposition board.
- Tie buyer campaigns/offers to deal packets.
- Make member offer decisions visible.
- Track buyer outreach and offer history.

Risk: High. Disposition is a core part of land/deal monetization.

### Phase 4: Member Portal Final IA

Status: Upcoming

Work:

- Finalize nav.
- Clean dashboard.
- Deduplicate actions/notifications.
- Decide what Hub becomes.
- Move legacy survey pages to secondary role.

Risk: Medium.

### Phase 5: Data Integrity And QA

Status: Upcoming

Work:

- Test all flows with real records.
- Confirm RLS.
- Confirm Vercel/Supabase/Sakari.
- Confirm production permissions.
- Fix edge cases.

Risk: High until complete.

### Phase 6: Polish And Launch

Status: Upcoming

Work:

- Mobile polish.
- Empty states.
- Loading states.
- Error messages.
- Member/VA onboarding instructions.
- Final documentation.

Risk: Medium.

## Page Retirement / Merge Candidates

Needs decision:

- Hub: keep as platform directory or merge into Dashboard/Admin.
- Decisions: keep as official record or merge decision creation into meetings/votes.
- Surveys: keep as onboarding/formation only.
- Tracker subpages: keep but relabel as Money.
- Documents: keep as standalone but connect every document to records.
- Meetings: keep if it creates decisions/actions cleanly.

## Next Recommended Work

Continue **Phase 2: CRM Record Depth**, then move into **Phase 2A: Member-To-VA Task Assignment**.

Reason:

The UI now has a shared conversation panel, shared status language, shared next-action logic, and first-pass CRM record detail panels. The next weak spot is CRM durability: users can inspect records, but they still need better edit flows, cleanup prompts, duplicate handling, and member-created VA work routing.

The next implementation should:

1. Add record edit/update actions for contacts, buyers, properties, campaigns, and offers.
2. Add duplicate detection and merge/cleanup workflows.
3. Add the member-to-VA task assignment path and count completed VA tasks in the daily brief.
4. Confirm the CRM detail panels against real Supabase production data and adjust labels/empty states.
