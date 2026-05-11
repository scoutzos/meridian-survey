# Meridian CRM and Portal Rebuild Plan

Last updated: May 11, 2026

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
| VA Workdesk | Mostly built | Imports, queues, SMS, dispositions, packet creation, time, VA tasks, and daily brief exist. Needs live import/SMS/brief QA. |
| CRM Command Center | Structurally built | Core CRM views, conversation panel, record detail panels, disposition board, offer decisions, and closing handoff exist. Needs live data/RLS QA and edit/cleanup tools. |
| Member Dashboard | Structurally built | Operating home, review queue, task preview, VA brief, communications, and deduped review signals exist. Needs real-user walkthrough. |
| Deal Reviews | Mostly built | Guided packet, calculator, communications, vote, agreement, diligence, and project conversion flow exist. Needs final QA and edge cases. |
| Opportunity File | Mostly built | Shared file connects lead, deal, timeline, notes, calculator, review, buyer/disposition context. Needs richer action buttons and real-data QA. |
| Communications/SMS | Mostly built | Sakari inbound/outbound, unmatched routing, bulk send, and shared conversation panel exist. Needs live Sakari test numbers and opt-out QA. |
| Dispositions | Structurally built | Campaigns, offers, member decisions, campaign touch history, project/closing handoff, and fall-through follow-up exist. Needs live accepted/rejected offer QA. |
| Money/Tracker | Partial | Tracker pages exist and are linked. Needs deeper connection to approvals, projects, and deal agreements. |
| Documents/Meetings/Decisions | Partial | Pages were reorganized and connected. Needs final feature audit and removal of confusing legacy behavior. |
| Navigation/IA | Structurally built | Member nav, mobile nav, CRM access, Hub/archive role, and secondary tools are organized. Needs real-user label walkthrough. |

Estimated structural completion: **94%**

## What Has Been Built In This Rebuild

### 1. Role-Specific Navigation

The app now separates the main experiences better:

- VA users are directed to the VA Desk.
- Members can return to the member portal from CRM.
- CRM has links back to Member Portal, VA Desk, and Deal Reviews.
- The shared Opportunity File links to Member Home, VA Desk, Deal Reviews, and CRM.

Remaining:

- Real-user walkthrough to confirm labels and page placement feel natural.
- Decide whether older survey/result pages remain visible after onboarding.

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
- Production QA on member-created VA tasks using real accounts and records.

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

## Full Platform Operating Model

This rebuild is not only a CRM redesign. It is the organization layer for the whole Meridian operating system. Every feature should fit into one connected flow instead of becoming a separate page, side tool, or duplicate record.

The platform should organize around these lanes:

| Lane | Purpose | Current Features That Belong Here | Rebuild Requirement |
| --- | --- | --- | --- |
| Intake | Capture lists, leads, seller replies, and first contact outcomes. | VA Desk, imported land lists, Sakari SMS, unmatched messages, lead dispositions, deal brief intake. | VA should be able to import, search, contact, disposition, and convert leads without re-entering data. |
| Deal | Turn an interested lead into a member-ready packet. | Deal brief, calculator, opportunity file, notes, attachments, communication timeline. | Every deal should have one shared file with seller info, property info, calculator, notes, communication, and next action. |
| Decision | Record member direction and approvals. | Deal votes, membership candidate votes, expense proposal votes, operating agreement decisions, decision records. | All votes and approvals should feel like one decision system with clear status, owner, deadline, quorum, and outcome. |
| Disposition | Market approved or review-ready opportunities to buyers. | CRM buyers, buyer campaigns, buyer offers, buyer outreach, disposition statuses. | Buyer demand, campaigns, offers, member decisions, and final deal outcome must connect back to the packet. |
| Execution | Manage approved deals as active projects. | Projects, vendors, risks, project documents, milestones, tasks. | Approved deals should convert into projects with packet, vote, agreement, budget, docs, tasks, vendors, and risks carried forward. |
| Money | Track capital, expenses, contributions, and deal economics. | Tracker, capital calls, contributions, expenses, planning, deal agreement economics. | Money should connect to approved deals/projects, member commitments, capital calls, project expenses, and reimbursement approvals. |
| Governance | Preserve the official company record. | Meetings, transcripts, decisions, documents, operating agreement inputs, member applications. | Meetings should create tasks, decisions, votes, and records. Documents and decisions should attach to the thing they govern. |
| Operations | Route daily work across VA, members, and admins. | VA shifts, daily brief, action items, notifications, member-to-VA tasks, work queues. | Work should have one routing system: assign, due date, owner, status, completion, blocker, and daily brief/notification rollup. |
| Platform | Make the app feel like one system. | Navigation, global search, permissions, audit trail, notifications, mobile shell. | Users should search, navigate, receive alerts, and access records based on role without portals feeling disconnected. |

## Meridian Operating Blueprint

This is the practical workflow blueprint for the rebuild. Every future build pass should improve one of these workflows, reduce duplicate entry, clarify ownership, or make automation safer.

### Role Home Screens

| Role | First Screen | Primary Question It Should Answer | Main Actions |
| --- | --- | --- | --- |
| VA | VA Desk | What do I need to work today? | Start shift, work lead queues, send/log SMS and calls, update dispositions, build deal briefs, complete member-assigned tasks, submit daily brief. |
| Member | Member Dashboard | What needs my attention? | Vote, review deal packets, read VA brief, assign tasks, review documents, respond to capital calls, check project status. |
| Admin | Command Center / Operations | Where is the business stuck? | Review queues, assign work, manage users/roles, monitor imports/SMS, review daily briefs, resolve blockers, manage templates/settings. |
| CRM/Acquisitions Lead | CRM Command Center | What is happening across leads, buyers, deals, and disposition? | Triage replies, manage records, send messages, review campaigns, track offers, clean duplicates. |

### 1. Lead Intake Workflow

Purpose: turn raw land lists and seller replies into organized leads without re-entering data.

Flow:

```text
Imported list -> lead record -> VA queue -> contact attempt -> disposition -> interested lead or closed lead
```

System of record:

- Imported list batch records the source.
- Lead record owns source-list fields and outreach status.
- CRM contact owns durable person/contact information.
- CRM property owns durable parcel/property information.

Owner:

- VA works the queue.
- Admin reviews import quality and stuck queues.

Automation:

- Import creates lead records.
- Duplicate phone/parcel should flag before outreach.
- Seller reply should update last-touch and create/reopen work.
- DNC/bad number should stop future bulk/manual outreach.

Success metrics:

- Lists imported.
- Leads contacted.
- Response rate.
- Interested sellers.
- Bad/DNC numbers.
- Leads converted to deal packet.

### 2. Seller Communication Workflow

Purpose: make every seller text/call visible from the lead, CRM contact, deal packet, and opportunity file.

Flow:

```text
Inbound/outbound SMS or call -> communication event -> matched lead/contact/deal -> timeline -> next action
```

System of record:

- Communication event owns the actual message/call log.
- Contact owns the person.
- Lead/deal owns the business context.

Owner:

- VA handles normal seller communication.
- Member/admin may review but should not casually bypass the VA workflow unless permission allows it.

Automation:

- Unmatched inbound SMS goes to inbox triage.
- Matched inbound SMS creates a follow-up task if no open task exists.
- Opt-out updates contact and lead communication status.
- Sent SMS logs to daily activity and timeline.

Success metrics:

- Texts sent.
- Replies received.
- Unmatched messages.
- Time to respond.
- Follow-ups due.

### 3. Deal Packet Workflow

Purpose: convert an interested seller into a member-ready decision packet.

Flow:

```text
Interested lead -> deal brief -> calculator -> VA notes -> member packet -> member review
```

System of record:

- Deal packet owns the acquisition opportunity.
- Opportunity File displays the shared record.
- Calculator owns acquisition/disposition assumptions.
- Notes/timeline own context and audit history.

Owner:

- VA drafts/submits packet.
- Member/admin reviews and requests more info or votes.

Automation:

- Packet submission creates member review notifications/tasks.
- Missing required fields block or warn before submission.
- Member “needs more info” creates task back to VA/admin.

Success metrics:

- Deal briefs submitted.
- Packets ready for review.
- Packets returned for more info.
- Time from interested seller to member review.

### 4. Member Vote And Approval Workflow

Purpose: make decisions clear, official, and connected to the record.

Flow:

```text
Packet submitted -> member vote task -> votes collected -> outcome -> agreement/offer/project/disposition/pass
```

System of record:

- Decision/vote record owns approval status and outcome.
- Deal packet owns deal details.
- Agreement record owns final terms and authority.

Owner:

- Members vote.
- Admin closes/ratifies outcome if needed.

Automation:

- Vote request creates tasks for required members.
- Quorum reached updates decision status.
- Approval creates agreement/project/disposition next action.
- Rejection/pass updates deal status and timeline.

Success metrics:

- Votes pending.
- Time to quorum.
- Approval rate.
- Deals needing more info.
- Decisions finalized.

### 5. Disposition Workflow

Purpose: connect buyer demand, campaigns, outreach, offers, and member decisions.

Flow:

```text
Approved/review-ready packet -> buyer match -> campaign -> buyer outreach -> offer -> member decision -> close/pass/fallback
```

System of record:

- Buyer record owns demand/buy box.
- Disposition campaign owns outreach plan and stage.
- Buyer offer owns offer terms.
- Decision record owns member direction on offer acceptance/counter/pass.

Owner:

- CRM/acquisitions lead or admin manages buyer campaigns.
- Members approve major offer decisions.
- VA may support outreach if assigned.

Automation:

- Campaign stage changes should log timeline events.
- Offer received creates decision task.
- Accepted offer creates project/closing next actions.

Success metrics:

- Campaigns active.
- Buyers contacted.
- Offers received.
- Offer spread to target.
- Deals under contract/closed.

### 6. Project Conversion Workflow

Purpose: carry deal context into execution after approval.

Flow:

```text
Approved deal -> agreement ready -> convert to project -> budget/tasks/vendors/docs/risks -> execution updates
```

System of record:

- Project owns execution.
- Deal remains historical acquisition source.
- Agreement owns approved terms.
- Tracker owns money movements.
- Documents attach to project and underlying deal.

Owner:

- Admin/project owner manages conversion and execution.
- Members review money/risk/status.

Automation:

- Conversion carries deal packet, votes, agreement, docs, diligence, and timeline.
- Project creation creates initial tasks and milestone checklist.
- Project risk/blocker creates notification.

Success metrics:

- Approved deals converted.
- Active projects.
- Open risks.
- Milestones due.
- Budget status.

### 7. VA Daily Shift Workflow

Purpose: make the VA’s day measurable, reviewable, and tied to real completed work.

Flow:

```text
Start shift -> work queues/tasks -> log activity automatically -> add blockers/notes -> end shift brief -> member review
```

System of record:

- Shift record owns clock-in/out and break status.
- Daily brief owns summary, notes, blockers, and submitted report.
- Activity/task records provide counts and detail.

Owner:

- VA starts/ends shift and submits brief.
- Members/admin review the brief and assign follow-ups.

Automation:

- Starting shift opens active shift.
- Texts/calls/lead updates/tasks completed count toward shift.
- Ending shift drafts daily brief from activity.
- Submitted brief notifies members/admin.

Success metrics:

- Calls made.
- Texts sent.
- Replies handled.
- Leads updated.
- Deal briefs submitted.
- Member tasks completed.
- Blockers reported.

### 8. Meeting-To-Task Workflow

Purpose: make meetings create real operating output.

Flow:

```text
Agenda -> meeting/transcript -> summary -> decisions -> tasks -> follow-up review
```

System of record:

- Meeting record owns agenda, transcript, and summary.
- Decision record owns official outcomes.
- Task record owns follow-up work.

Owner:

- Admin/member creates meeting record.
- Members own decisions.
- Assigned users own follow-up tasks.

Automation:

- Transcript extraction suggests summary and action items.
- Approved action items become tasks.
- Decisions link back to meeting and related record.

Success metrics:

- Meetings held.
- Tasks created.
- Tasks completed.
- Decisions recorded.
- Follow-ups overdue.

### 9. Money Approval Workflow

Purpose: connect money decisions to deals, projects, capital, and approvals.

Flow:

```text
Expense/capital need -> proposal -> member approval -> capital call/payment/reimbursement -> project/deal ledger
```

System of record:

- Tracker owns money records.
- Decision/vote record owns approval.
- Project/deal owns business context.

Owner:

- Admin creates proposals/capital calls.
- Members approve and contribute.

Automation:

- Proposal creates approval tasks.
- Approval creates expense/capital call next action.
- Payment/contribution updates member/project status.

Success metrics:

- Capital calls open.
- Contributions received.
- Expenses approved.
- Expenses paid.
- Project budget variance.

### 10. Document Review Workflow

Purpose: make documents attached, reviewable, and tied to the record they support.

Flow:

```text
Upload/attach document -> classify -> link record -> review/approve if needed -> preserve version/history
```

System of record:

- Document record owns file metadata, permissions, version, and linked record.
- Linked deal/project/meeting/decision shows relevant documents.

Owner:

- Admin/member uploads.
- Required reviewer approves/acknowledges if needed.

Automation:

- Upload can create review task.
- Approved agreement can unlock project conversion.
- Missing diligence document can block next stage.

Success metrics:

- Documents uploaded.
- Documents awaiting review.
- Missing required documents.
- Approved agreements.
- Diligence completion.

### Missing Or Under-Specified Cross-Platform Work

These items need to be tracked explicitly so the rebuild enhances and organizes all existing features instead of only improving the CRM screens.

#### 1. Time And Shift Operations

The VA shift system should include:

- Start shift / clock in.
- Lunch or break tracking.
- End shift.
- Shift history.
- Daily brief tied to the active shift.
- Activity counts tied to the shift, including calls, texts, replies handled, leads updated, deal briefs submitted, and member-assigned tasks completed.
- Member/admin review of submitted shift briefs.

#### 2. Notes And Audit Trail

Notes should not live randomly across pages. The platform needs one clear rule: every important note attaches to a record and appears in that record timeline.

Notes should support:

- Seller notes.
- VA notes to members.
- Member review notes.
- Call notes.
- Deal notes.
- Project notes.
- Vendor notes.
- Decision notes.
- System-generated activity notes.

The official timeline should show who did what, when, and why it mattered.

#### 3. Documents

Documents should belong to records, not just the Documents page.

Documents should attach to:

- Deals.
- Projects.
- Members.
- Meetings.
- Decisions.
- Vendors.
- Agreements.
- Due diligence items.
- Expense approvals.

The Documents page should become a library/index, while each record should show its own relevant documents.

#### 4. Meetings

Meetings need to create operating output, not just store notes.

Meeting records should connect to:

- Agenda.
- Transcript.
- Summary.
- Decisions made.
- Tasks assigned.
- Deal packets discussed.
- Votes triggered.
- Follow-ups assigned to members or VA.
- Documents reviewed.

#### 5. Unified Decisions And Votes

The app currently has multiple approval concepts. They need a unified decision pattern.

Decision types include:

- Deal votes.
- Membership candidate votes.
- Expense proposal votes.
- Operating agreement decisions.
- Project approvals.
- Capital call approvals.
- Vendor approvals.

Every decision should have:

- Type.
- Status.
- Owner.
- Deadline.
- Required voters or approvers.
- Votes/responses.
- Outcome.
- Linked record.
- Final notes.

#### 6. Money And Tracker Integration

Money should not feel separate from deals and projects.

Tracker should connect to:

- Deal agreement economics.
- Approved deals.
- Active projects.
- Capital calls.
- Member commitments.
- Contributions received.
- Project expenses.
- Expense proposal votes.
- Reimbursement/payment status.

#### 7. Project Handoff

When a deal is approved and converted, the project should inherit context.

The project should carry forward:

- Original deal packet.
- Seller/property information.
- Calculator.
- Member vote result.
- Agreement terms.
- Due diligence checklist.
- Documents.
- Tasks.
- Vendors.
- Budget.
- Risks.
- Milestones.

#### 8. Vendors

Vendor management should connect into execution.

Vendors should attach to:

- Projects.
- Tasks.
- Documents.
- Insurance/contracts.
- Payments.
- Performance notes.
- Risks/blockers.

#### 9. Permissions

Permissions need to be explicit before launch.

Roles to account for:

- Admin.
- Member.
- VA.
- Future vendor/partner.
- Future attorney/title/broker/buyer guest access.

Permission questions:

- Who can edit deals?
- Who can send seller SMS?
- Who can assign VA tasks?
- Who can approve money?
- Who can see sensitive documents?
- Who can view member financial commitments?
- What can the VA see after a deal moves beyond her work?

#### 10. Global Search

Global search should make the platform feel connected.

Search should find:

- Seller.
- Phone number.
- Parcel ID.
- County.
- Buyer.
- Deal.
- Project.
- Document.
- Meeting.
- Decision.
- Task.
- Vendor.

#### 11. Notifications And Work Inbox

The app needs one consistent work inbox.

Notifications/work items should include:

- Member vote needed.
- VA task assigned.
- Seller replied.
- Deal packet submitted.
- Buyer offer received.
- Document needs review.
- Capital call open.
- Meeting follow-up due.
- Expense proposal needs approval.
- Project task blocked.

#### 12. Legacy Page Decisions

The rebuild needs final decisions on older pages so the app does not feel like several products at once.

Pages to review:

- Hub.
- Decisions.
- Tracker and tracker subpages.
- Survey/results pages.
- Documents.
- Meetings.
- Projects.
- Operations.

Each should be either:

- Primary workspace.
- Secondary record/library.
- Admin-only page.
- Legacy/hidden page.
- Merged into a stronger workflow.

## Operating Rules Still Needed Behind The UI

The UI can look connected before the system is truly reliable. Meridian also needs clear operating rules that define ownership, permissions, lifecycle movement, automation, reporting, and cleanup. These rules should be decided and implemented alongside the remaining rebuild passes.

### 1. Source Of Truth Rules

The app needs explicit rules for which record owns each piece of data.

Examples:

- Seller phone may appear on an imported lead, CRM contact, deal packet, and communication event.
- Parcel data may appear on an imported list, CRM property, deal packet, and project.
- Buyer name may appear on a CRM buyer, buyer contact, disposition campaign, and buyer offer.

Questions to answer:

- Which table is the master for seller/contact information?
- Which table is the master for property/parcel information?
- When a lead becomes a deal, what data is copied and what stays linked?
- When a deal becomes a project, what data is inherited and what remains read-only?
- How should duplicate or conflicting data be resolved?
- What fields should be updated everywhere versus only on the owning record?

### 2. Real Login And Roles

The app needs a proper role model, not just user-name based routing.

Roles to support:

- Admin.
- Member.
- VA.
- Future vendor/partner guest.
- Future attorney/title/broker/buyer guest.

Each role needs rules for:

- Which pages they can access.
- Which records they can view.
- Which records they can create.
- Which records they can edit.
- Whether they can send SMS.
- Whether they can approve deals or money.
- Whether they can view sensitive documents.
- Whether they can assign work to others.

### 3. Record Edit, Archive, And Delete Rules

The current rebuild adds many create/view surfaces. The full system needs update and cleanup behavior.

Needed actions:

- Edit contact.
- Edit buyer.
- Edit property.
- Edit campaign.
- Edit offer.
- Edit deal packet fields.
- Archive duplicate or bad records.
- Mark bad numbers and DNC.
- Restore archived records if needed.
- Track who changed what and when.

Delete should usually be soft-delete/archive, not permanent removal.

### 4. Task System As The Backbone

Tasks should become the operating backbone, not just a standalone page.

Tasks should support:

- VA work.
- Member follow-ups.
- Meeting action items.
- Project tasks.
- Document review.
- Seller follow-up.
- Buyer follow-up.
- Money approval follow-up.
- Blockers.

Every task should have:

- Title.
- Linked record.
- Assignee.
- Creator.
- Due date.
- Priority.
- Status.
- Completion notes.
- Blocker reason if blocked.
- Whether completion should count toward VA daily brief.

### 5. File Storage And Document Rules

Documents need real storage and ownership rules.

Needed decisions:

- Where files are stored.
- Which records can own files.
- Who can upload.
- Who can view.
- Who can delete/archive.
- Whether sensitive docs are private.
- Whether documents need version history.
- Whether documents need member acknowledgement or approval.

Documents should not only live on the Documents page. The Documents page should be the index, while each deal/project/meeting/decision/vendor/member record shows its own files.

### 6. Reporting Layer

The app needs reporting beyond dashboard cards.

Reports likely needed:

- Leads imported.
- Texts sent.
- Replies received.
- Response rate.
- Interested sellers.
- Leads converted to deal packets.
- Deal packets submitted.
- Member votes pending.
- Member votes completed.
- Buyer offers received.
- Disposition conversion rate.
- VA productivity.
- Tasks completed by type.
- Money committed.
- Money spent.
- Capital calls open/paid.
- Project status and risk.

Reports should be filterable by date, market, county, VA/member, source list, status, and project/deal.

### 7. Automation Rules

The platform should create work automatically when important events happen.

Automation examples:

- Seller replies -> create/reopen follow-up task.
- Unmatched SMS -> create inbox triage item.
- Deal packet submitted -> notify members and create vote tasks.
- Member asks for more information -> create VA/member follow-up task.
- Offer received -> create member decision task.
- Meeting transcript uploaded -> extract action items.
- VA ends shift -> notify members that daily brief is ready.
- Capital call opens -> create member payment task.
- Project task blocked -> notify owner/admin.

Automation should be transparent, editable, and visible in the record timeline.

### 8. Data Migration And Cleanup

Existing scattered data needs a cleanup/migration strategy.

Data to review:

- Existing leads.
- Imported CSV leads.
- Existing deal packets.
- Existing notes.
- Existing decisions.
- Existing documents.
- Existing meetings/transcripts.
- Existing tracker records.
- Existing localStorage fallback data.
- Existing Supabase production data.

Cleanup questions:

- What old records should be migrated?
- What should be archived?
- What should be deduplicated?
- What should remain read-only for history?
- What localStorage data should be moved into Supabase?

### 9. Error Handling And Recovery

Every important workflow needs clear failure handling.

Failure cases:

- Supabase unavailable.
- Sakari send failure.
- Sakari webhook failure.
- Import failure.
- Duplicate phone found.
- Duplicate parcel found.
- Permission denied.
- Record save failed.
- File upload failed.
- Vote submission failed.
- Project conversion failed.

Each error should tell the user what happened, whether anything was saved, and what to do next.

### 10. Mobile And Tablet Reality

The desktop workflow is primary, but members and VA may use mobile for quick work.

Mobile must support:

- Member vote.
- Daily brief review.
- Task review and completion.
- Seller/lead lookup.
- Deal packet reading.
- SMS history review.
- Meeting/decision review.
- Quick notes.

Complex work like bulk import, disposition boards, and project setup can remain desktop-first.

### 11. Operating Agreement And Governance Connection

The survey/results/operating agreement features need a clear long-term home.

They should connect to:

- Governance records.
- Decisions.
- Member obligations.
- Voting thresholds.
- Capital rules.
- Role rules.
- Document records.
- Membership applications.

The operating agreement workflow should not feel like a separate legacy app once the member portal is reorganized.

### 12. Lifecycle Definitions

Every major object needs a defined lifecycle.

Needed lifecycles:

- Lead lifecycle.
- Deal lifecycle.
- Buyer lifecycle.
- Disposition campaign lifecycle.
- Offer lifecycle.
- Project lifecycle.
- Task lifecycle.
- Decision lifecycle.
- Document lifecycle.
- Vendor lifecycle.
- Member/application lifecycle.

For each lifecycle, define:

- Statuses.
- Allowed transitions.
- Who can move it.
- What automation happens on transition.
- What record history is created.
- What notifications are sent.

### 13. Admin Console

The platform needs an admin/settings area for system management.

Admin should manage:

- Users.
- Roles.
- Permissions.
- SMS templates.
- Deal brief templates.
- Status values.
- Disposition outcomes.
- Buyer tags.
- Source lists.
- Integrations.
- Webhook health.
- Data cleanup.
- Feature flags or page visibility.

This should prevent hard-coded settings from becoming a long-term bottleneck.

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

Status: In Progress

Work:

- Add VA users, such as `Sophie / VA`, to the task assignee dropdown. Started.
- Decide whether all members or only admins can assign VA tasks.
- Add a task type/category for VA work. Started with `va-work` task type.
- Show VA-assigned tasks in the VA Desk Today queue. Started.
- Let the VA mark assigned tasks Open, In Progress, Done, and Blocked. Started.
- Count tasks marked Done during the VA shift/day in the daily brief metrics. Started.
- Include completed VA tasks in the daily brief detail and Operations review. Started.
- Notify members when a VA task is completed or blocked. Started for task creator.

Completed in this pass:

- Extended `action_items` into the first version of the shared work-routing backbone.
- Added task metadata for task type, priority, source record, completion note, blocker reason, and completed by.
- Added blocked status to action items.
- Let members assign tasks to `Sophie / VA` from the member task page.
- Added VA-assigned task queue to the VA Desk Today view.
- Added Start, Done, and Blocked actions for VA tasks.
- Added completed VA task count into daily brief draft, VA brief submission, Operations review, and member dashboard brief metrics.
- Added migration `036_work_routing_foundation.sql`.
- Verified production build after implementation.
- Continued with linked task context:
  - Members can link assigned tasks to a lead, deal/opportunity, project, or meeting.
  - Member task cards show record type context.
  - VA Desk task cards show the linked record type and include an Open Record action.
  - Operations now surfaces blocked VA tasks with blocker reason and a link back to the related record.
  - Member task page includes VA task and assigned-by-me filters.
- Continued with member task visibility:
  - Added a task detail panel to the member action page.
  - Members can click assigned tasks to see status, assignee, creator, linked record, priority, due date, updated by, completed by, blocker reason, and completion note.
  - Members can start, block, complete, reopen, delete, or open the linked record directly from the task detail panel.
  - Task detail now shows a lightweight history based on created, updated, blocked, and completed fields.
- Continued with VA task notifications:
  - Completed VA tasks notify the member who requested the work, or create a shared notice if no creator exists.
  - Blocked VA tasks now send high-priority notifications to the full member group so blockers do not sit with only the original requester.
- Continued with operational escalation:
  - Added an Operations Escalations tab for blocked VA work.
  - Blocked VA tasks now have a focused member review surface with blocker reason, requester, due date, task link, record link, and the expected next member action.
- Continued with permissions hardening:
  - Added migration `037_work_routing_rls_readiness.sql` with Supabase Auth-ready helper functions and authenticated policies for `action_items` and `meridian_notifications`.
  - Documented the cutover requirement: Supabase Auth must provide a `member_name` claim or `user_metadata.member_name` before prototype anon policies are removed.
  - Staged policy rules so members can create/own/review member work, the VA can update assigned VA work, and admins can delete action items after Auth cutover.
- Continued with durable task history:
  - Added migration `038_action_item_events.sql` for a persistent task event stream.
  - Status changes, completions, blockers, reopen events, creates, and deletes are now logged as task events when the migration is present.
  - The member task detail panel now reads the task event stream and falls back to legacy created/updated/completed fields if no events exist yet.
- Continued with blocked-task responses:
  - Members can now reply directly from Operations Escalations when a VA task is blocked.
  - Escalation responses are stored as `comment` events in task history.
  - The VA receives a high-priority notification when a member replies to a blocked task.
  - Operations shows the latest member responses under each blocked VA task.
- Continued with general task comments:
  - Member task detail now includes a comment box for any action item or VA task.
  - Comments are stored as `comment` events in the durable task history.
  - Task comments notify the other owner/requester when a clear recipient exists.
- Continued with reassignment history:
  - Added migration `039_action_item_reassignment_events.sql`.
  - Member task detail now supports reassignment from the task record.
  - Reassignments are stored as `reassigned` events in task history.
  - New task assignees receive a notification when a task is reassigned to them.
- Continued with blocker resolution:
  - Member escalation responses now reopen blocked VA tasks automatically.
  - The reopen is logged as a task history event after the member response.
  - The VA notification now states that the blocker was answered and the task is ready to continue.
- Continued with notification cleanup:
  - Added opt-in notification deduplication to the shared notification helper.
  - Blocked VA task alerts, blocked-task responses, task reassignment alerts, and blocked-task comment alerts now update the existing unread notice instead of stacking duplicates.
- Continued with document-linked work:
  - Member task creation can now link tasks to records in the Document Library.
  - Document-linked task detail shows `Document` as the source context and opens back to `/documents`.
  - This uses the current library records until the larger document ownership/indexing system is upgraded.
- Continued with Supabase Auth cutover:
  - Added migration `040_supabase_auth_identity_bridge.sql` with `auth_email`, `auth_user_id`, `auth_provider`, and `auth_migrated_at` fields on `meridian_members`.
  - Login now uses Supabase Auth automatically for users with `auth_email` populated, while legacy table passwords continue to work for unmigrated users.
  - Supabase Auth password reset emails are used for migrated users; legacy default-password reset remains for unmigrated users.
  - Sign out now clears the Meridian local identity and signs out of Supabase Auth when a Supabase session exists.
  - Existing Supabase Auth sessions now hydrate the Meridian local identity automatically and route users to the right workspace.
  - Added `Supabase_Auth_Cutover_Runbook.md` with the exact account creation, metadata, `auth_email`, test, and prototype policy removal steps.

Remaining:

- Operational Supabase setup: create Auth users for each member/VA, set their `user_metadata.member_name`, populate `meridian_members.auth_email`, then remove prototype anon policies after the runbook tests pass.

Risk: High if skipped. Members will keep assigning VA work through texts or side conversations, which defeats the purpose of the portal.

### Phase 3: Disposition Workspace

Status: Complete structurally

Work:

- Build disposition board. Started.
- Tie buyer campaigns/offers to deal packets. Started.
- Make member offer decisions visible. Started.
- Track buyer outreach and offer history. Started.

Completed in this pass:

- Disposition board now groups campaigns by operating stage.
- Campaign detail now supports moving the campaign stage from CRM.
- Campaign stage changes update the linked deal packet disposition status when connected to a deal.
- Buyer offers now have visible member decision controls: accept, counter, reject, withdrawn.
- Offer decision changes update the linked deal with best buyer offer and disposition status where appropriate.
- Disposition view now includes a member offer decision queue for received/countered offers.
- Recording a buyer offer now creates high-priority member notifications and action items tied to the offer record.
- Buyer-offer action items now open back to CRM Dispo so members can review the connected campaign, offer, and deal context.
- Disposition campaign detail now includes campaign touch history combining offer milestones and linked SMS activity.
- Offer decision tasks now auto-complete when an offer is accepted, countered, rejected, or withdrawn, with task event history preserved.
- Accepted buyer offers now create a project/closing handoff with high-priority closing checklist tasks.
- Rejected or withdrawn buyer offers now create a disposition follow-up task and can move the campaign to fell-through.

Remaining:

- QA the accepted-offer handoff with real Supabase data to confirm project creation, task ownership, and RLS behavior.

Risk: High. Disposition is a core part of land/deal monetization.

### Phase 4: Member Portal Final IA

Status: Complete structurally

Work:

- Finalize nav.
- Clean dashboard.
- Deduplicate actions/notifications.
- Decide what Hub becomes.
- Move legacy survey pages to secondary role.

Completed in this pass:

- Member top navigation now separates daily operating pages from secondary/reference pages.
- Home, Tasks, Deal Reviews, CRM, Money, Operations, and Projects remain first-level member destinations.
- Docs, Meetings, Applications, Decisions, Surveys, and Hub moved under a More menu instead of competing with daily work.
- CRM is now a normal member navigation destination, while the header CTA focuses on creating a new deal brief.
- Member dashboard now suppresses duplicate vote notifications from general alerts/activity once they are already represented in the review queue.
- Hot deal signals no longer double-count deals that are already waiting for the member's vote.
- Mobile bottom navigation now keeps CRM in the primary bar so the member portal and CRM do not feel like separate products.
- Hub role clarified as the Platform Archive: announcements, profiles, resources, transcript history, and legacy uploads, not the daily operating home.

Remaining:

- Real-user walkthrough to confirm labels feel natural to members and VA.
- Decide whether to hide or retain older survey/result routes after onboarding is complete.

Risk: Medium.

### Phase 5: Data Integrity And QA

Status: In Progress

Work:

- Test all flows with real records.
- Confirm RLS.
- Confirm Vercel/Supabase/Sakari.
- Confirm production permissions.
- Fix edge cases.

Completed in this pass:

- Added `Production_QA_Runbook.md` with exact production QA flows for identity, imports, Sakari SMS, VA daily brief, deal packet/member vote, CRM disposition, member-to-VA tasks, money/projects/documents/meetings, RLS, and launch decision criteria.
- Converted Phase 5 from a vague checklist into executable pass/fail tests tied to the expected Supabase records.

Remaining:

- Run the production QA runbook against the live Vercel deployment with real Supabase data and Sakari test numbers.
- Fix any RLS, data integrity, or workflow bugs found during the run.

Risk: High until complete.

### Phase 6: Polish And Launch

Status: In Progress

Work:

- Mobile polish.
- Empty states.
- Loading states.
- Error messages.
- Member/VA onboarding instructions.
- Final documentation.

Completed in this pass:

- Added `Meridian_Member_VA_Onboarding_Guide.md`.
- Added a served copy at `/docs/meridian-member-va-onboarding-guide.md`.
- Added the onboarding guide to the Document Library under Platform.
- Refreshed the current completion snapshot so the plan reflects the CRM, disposition, navigation, and dashboard work already completed.
- Added a richer first-list empty state to the VA Lists tab so a new VA sees the import -> confirm -> work sellers path before any data exists.
- Added the Production QA Runbook and Supabase Auth Cutover Runbook to `public/docs` and the Document Library so launch/testing docs are accessible from the portal.
- Replaced Operations browser alerts with an in-page status banner for approvals, time edits, reimbursements, distributions, scenarios, VA brief reviews, and blocked-task responses.
- Added member dashboard in-page feedback for clearing notifications and marking tasks done.
- Replaced Projects browser alerts with an in-page status banner for risks, documents, vendors, and risk status changes.
- Replaced Tasks browser alerts with in-page feedback for status changes, comments, reassignment, deletion, and task creation.
- Replaced Deal Reviews browser alerts with in-page feedback for packet saves, review notifications, checklist updates, seller SMS, votes, agreement saves, project conversion gates, and generated memos.
- Replaced Decisions and Meetings browser alerts with in-page feedback for decision updates, agenda updates, meeting notes, transcript file reading, and transcript extraction.
- Replaced Platform Archive browser alerts with in-page feedback for announcements, legacy decisions, resource links, legacy uploads, transcripts, downloads, and member profile saves.
- Replaced Money Center and Capital Calls browser alerts with in-page feedback for suggested calls, manual calls, approvals, status changes, and deletes.
- Replaced Contributions and Expenses browser alerts with in-page feedback for permission limits, deposit logs, expense logs, edits, deletes, and save errors.
- Replaced Expense Planning browser alerts with in-page feedback for proposal saves, revisions, offset failures, votes, expense conversion, and generated capital-call suggestions.
- Verified the member-to-VA task path is already wired: members can assign VA tasks from My Tasks, link them to records, the VA sees them in the VA Desk Today queue, and completed VA tasks count into the daily brief.
- Added a direct Member Home "Assign VA Task" entry point that opens My Tasks with the task form already set to Sophie / VA.
- Added CRM edit/update flows for existing contacts, property records, buyers, disposition campaigns, and buyer offers from the CRM right rail.

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

Continue **Phase 4: Member Portal Final IA**, starting with member navigation, dashboard/action deduplication, and clear placement for Hub, Decisions, Surveys, Money, Documents, and Meetings.

Reason:

The UI now has a shared conversation panel, shared status language, shared next-action logic, and first-pass CRM record detail panels. The next weak spot is CRM durability: users can inspect records, but they still need better edit flows, cleanup prompts, duplicate handling, and member-created VA work routing.

The next implementation should:

1. Add duplicate detection and merge/cleanup workflows.
2. Confirm the member-to-VA task flow against real Supabase production users and permissions.
3. Confirm the CRM edit panels and detail panels against real Supabase production data and adjust labels/empty states.
4. Run the production QA runbook end-to-end with real imports, Sakari SMS, votes, briefs, and RLS.
