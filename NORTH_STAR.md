# Meridian Portal North Star

## Purpose

Meridian is a private operating portal for a six-operator real estate partnership in Atlanta. Its job is to turn deal flow, calls, documents, capital, decisions, meetings, and member responsibilities into clean operating records that the group can trust.

The portal should not feel like a generic task app, a survey app, or a document dump. It should feel like Meridian's internal command room: measured, specific, candid, elevated, and warm.

## Product Promises

Meridian helps the collective move from opportunity to decision to execution without losing context.

When a VA finds a deal, when a member fronts an expense, when the group needs to vote, when a meeting creates follow-up work, or when a capital call is needed, the portal should answer four questions quickly:

1. What is happening?
2. What decision is needed?
3. Who owns the next step?
4. What record proves what we agreed to?

## Primary Users

### Founding Members

Members need to see the health of the company, review deals, vote on decisions, track responsibilities, understand capital obligations, and access documents without relying on scattered text threads.

### Managing/Admin Members

Admins need to approve records, maintain financial data, trigger capital calls, manage documents, assign work, and turn meetings into decisions and action items.

### Virtual Assistant

The VA needs a simple intake workflow for leads discovered through land portals, call tools, seller conversations, referrals, and research. The VA should be able to submit clean deal packets without needing to understand every governance detail.

### Future External Collaborators

Contractors, lenders, attorneys, agents, title companies, inspectors, and property managers may eventually need limited access to upload files, respond to requests, or view selected project details.

## North Star Experience

The ideal Meridian portal opens to an operator briefing, not a welcome screen.

Members should immediately see:

- deals needing review
- votes waiting on them
- overdue action items
- upcoming capital obligations
- upcoming meetings
- project risks and deadlines
- documents recently added or missing
- funding health

Every major record should connect back to its source:

- a deal came from a VA intake
- a decision came from a vote or meeting
- an action item came from a meeting, decision, project, or admin assignment
- an expense came from a member submission or project budget
- a capital call came from a funding need
- a document belongs to a project, governance matter, or company record

## Information Architecture

The portal should be organized around the way real estate operators think.

### Recommended Main Navigation

- Dashboard
- Deals
- Projects
- Capital
- Actions
- Meetings
- Decisions
- Documents
- Members

Surveys should remain available as onboarding or formation tools, but they should not be the main organizing frame once the company is operating.

## Core Modules

## 1. Dashboard

The dashboard is the daily operating brief.

It should show:

- deal alerts needing review
- active votes and deadlines
- overdue and upcoming action items
- project status summaries
- capital call status
- member balances
- upcoming meetings
- recently added documents
- risk alerts

Design principle: less greeting, more operating clarity.

## 2. Deal Desk

Deal Desk is the intake and rapid decision engine for new opportunities.

### VA Intake Fields

- source: land portal, call tool, referral, direct mail, agent, other
- address or parcel ID
- seller/contact name
- phone/email
- asking price
- seller motivation
- property type
- occupancy status
- condition notes
- photos
- county/tax record link
- Zillow/Redfin/PropStream/Land Portal link
- estimated ARV or rent
- estimated repair need
- urgency
- VA recommendation: pass, review, urgent review, make offer consideration
- notes from seller call

### Deal Brief

After intake, the portal should generate a concise deal brief:

- what this is
- why it may matter
- key numbers
- known risks
- missing information
- decision needed
- deadline
- recommended next action

### Deal Analyzer / Underwriting

The portal should analyze the deal before asking members to vote. It should make the math visible, identify missing inputs, and recommend the next level of review.

Analysis should support multiple strategies:

- flip
- rental hold
- BRRRR
- wholesale
- new construction
- land hold
- land resale
- infill lot build
- assemblage

Core analysis fields:

- asking price
- estimated market value or ARV
- repair or development estimate
- closing costs
- holding costs
- financing costs
- expected rent if applicable
- resale value
- cash needed
- projected profit
- ROI
- cash-on-cash return
- max allowable offer
- break-even price
- confidence score
- missing information
- risk flags

The output should be simple enough for quick group decisions:

- Strong Review
- Review With Caution
- Needs More Info
- Likely Pass

The system should explain its recommendation in plain language, not just show a score.

Example:

```text
Asking: $95,000
Estimated ARV: $240,000
Estimated repairs: $48,000
Rule-of-thumb MAO: $240,000 x 70% - $48,000 = $120,000
Spread to MAO: +$25,000
Recommendation: Strong Review
Reason: Asking price is meaningfully below MAO, but repair estimate needs validation.
```

AI and formulas should draft the analysis. Humans approve the offer strategy.

### Land Deal Analysis

Land deals need a separate analysis path because value depends on entitlement, access, utility availability, zoning, buildability, market demand, and exit strategy.

Land intake should capture:

- parcel ID
- acreage or lot dimensions
- zoning classification
- current land use
- future land use if available
- road frontage
- legal access
- physical access
- utilities nearby: water, sewer, power, gas, septic
- topography
- flood zone
- wetlands or streams
- soil/septic suitability
- setbacks
- minimum lot size
- subdivision potential
- buildable area
- nearby new construction comps
- nearby land sale comps
- tax assessed value
- annual taxes
- HOA or deed restrictions
- liens/code violations
- easements
- environmental concerns
- seller asking price
- target acquisition price
- intended strategy: hold, resale, subdivide, build, assemble, assign

Land-specific analysis should include:

- price per acre
- price per buildable lot
- comparable land sales
- estimated entitlement cost
- estimated clearing/grading cost
- estimated utility connection cost
- estimated holding period
- estimated resale value
- estimated builder value
- estimated end-buyer demand
- required approvals
- timeline risk
- buildability confidence

Land recommendation categories:

- Buildable Infill Candidate
- Potential Subdivision
- Hold / Speculative
- Assignment Candidate
- Needs Entitlement Review
- Likely Pass

Land risk flags:

- no legal access confirmed
- unclear zoning
- no sewer/septic path
- floodplain or wetlands risk
- insufficient road frontage
- irregular parcel shape
- steep slope/topography issue
- poor comp support
- long entitlement timeline
- taxes/liens/code issues
- nearby demand unclear

The land analysis should never treat acreage alone as value. It should separate raw size from usable, buildable, sellable land.

### Rapid Decision Options

Members should be able to vote quickly:

- Pass
- Needs more info
- Schedule call
- Make offer
- Counter
- Escalate to urgent vote

The page should show:

- who has voted
- vote count
- quorum status
- decision deadline
- final result
- notes from each member

### Urgency Levels

- Routine Review: appears in dashboard and digest.
- Time Sensitive: immediate notification.
- Hot Deal: immediate notification and voting deadline.

### Automatic Follow-Up

When a decision is reached, the portal should create the next record:

- action item for the VA or member
- decision record
- offer/counter details
- follow-up deadline
- project record if accepted

## 3. Projects / Assets

Projects are the spine of the portal.

Each project should include:

- property/address
- status
- owner/entity
- acquisition terms
- budget
- actual spend
- capital tied to the project
- documents
- photos
- decisions
- meetings
- action items
- vendors
- risks
- timeline

### Suggested Project Statuses

- Lead
- Under Review
- Offer Made
- Under Contract
- Due Diligence
- Closed
- Active Project
- Stabilized
- Sold
- Passed

## 4. Due Diligence

Each deal/project should have a due diligence checklist.

The checklist should be generated based on the deal type and strategy. A vacant land lead, an occupied house, a rental hold, and a new construction lot should not receive the same checklist.

### Base Checklist Items

- title review
- liens
- taxes
- zoning
- insurance
- inspection
- contractor walkthrough
- permit needs
- rent comps
- resale comps
- financing terms
- entity/title ownership
- utility status
- neighborhood risk
- environmental concerns if relevant

Each item should have:

- status
- owner
- due date
- supporting document
- notes

### Dynamic Checklist Generation

When a deal is submitted, the portal should generate a checklist from the available facts:

- property type
- strategy
- urgency
- occupancy
- zoning
- financing path
- capital required
- missing information
- known risks

Each checklist item should include:

- why it matters
- who should own it
- deadline
- source link
- required evidence
- pass/fail/needs review status

The checklist should update as facts change. For example, if the VA later marks the property as vacant land with no confirmed utilities, the system should add utility verification and septic/sewer feasibility items automatically.

### Land Due Diligence Checklist

For land deals, generate checklist items such as:

- confirm parcel ID and legal description
- confirm seller ownership
- review title and deed history
- check liens, delinquent taxes, and code violations
- verify zoning classification
- verify future land use plan
- confirm legal access
- confirm physical access
- measure road frontage
- confirm minimum lot size and setbacks
- determine buildable envelope
- check flood zone
- check wetlands, streams, buffers, and protected areas
- review topography/slope
- verify utility availability
- confirm water connection path
- confirm sewer availability or septic feasibility
- estimate utility tap/extension costs
- check soil or perc requirements if septic is needed
- review subdivision potential
- confirm whether rezoning, variance, platting, or permits are required
- pull nearby land sale comps
- pull nearby new construction or finished-lot comps
- estimate clearing, grading, and site prep costs
- estimate entitlement timeline
- check HOA, deed restrictions, covenants, or easements
- check environmental red flags
- confirm market demand for the intended exit
- calculate price per acre and price per buildable lot
- calculate max allowable land offer by strategy
- prepare member decision packet

### Improved Property Due Diligence Checklist

For houses, rentals, or rehab candidates, generate checklist items such as:

- confirm ownership
- review title
- verify liens and taxes
- confirm occupancy status
- inspect exterior and interior condition
- estimate repair scope
- validate contractor estimate
- pull resale comps
- pull rent comps if hold strategy
- confirm insurance assumptions
- check utility status
- check permit history
- check neighborhood demand
- estimate holding costs
- estimate closing costs
- calculate MAO
- prepare offer recommendation

### Decision Packet Output

Before members vote, the portal should present:

- summary
- recommendation
- key numbers
- checklist completion status
- unresolved risks
- missing data
- photos/links
- proposed decision
- voting deadline

## 5. Budget vs Actual

Real estate operations need project-level financial clarity.

Track:

- purchase price
- closing costs
- holding costs
- rehab budget
- actual rehab spend
- lender fees
- insurance
- taxes
- utilities
- contingency
- remaining budget
- variance

The portal should flag:

- budget overrun
- missing receipts
- unclassified expenses
- reimbursement pending
- capital shortfall

## 6. Capital

Capital should cover contributions, capital calls, reimbursements, member balances, and distributions.

### Capital Calls

Each capital call should include:

- reason
- linked project or company need
- total amount
- per-member amount
- due date
- approval status
- payment instructions
- member payment status
- supporting documents

### Reimbursements

Members should be able to submit reimbursable expenses:

- amount
- vendor
- date
- category
- project
- receipt
- notes

Admins should approve, reject, or mark reimbursed.

### Partner Ledger

Each member should have a ledger:

- cash contributed
- unpaid calls
- reimbursable expenses
- reimbursements paid
- distributions received
- ownership or voting status
- member LLC name

## 7. Decisions / Voting

Decision-making should be formal enough to protect the group but fast enough to support deals.

Each decision should include:

- proposal
- category
- linked deal/project/document/meeting
- eligible voters
- voting threshold
- deadline
- member votes
- comments
- final result
- recorded resolution
- source record

Decision types:

- acquisition
- offer amount
- counteroffer
- capital call
- contractor approval
- budget overrun
- reimbursement approval
- operating agreement change
- sale/refinance
- distribution

## 8. Meetings

Meetings should become operating records, not just notes.

Meeting records should include:

- agenda
- attendees
- transcript
- summary
- decisions
- action items
- linked projects
- linked documents
- next meeting

AI transcript extraction is useful, but action items should require human confirmation before creation.

## 9. Actions

Actions should be linked to real work.

Each action item should include:

- title
- owner
- due date
- status
- priority
- linked project/deal/meeting/decision/document
- source
- comments
- completion record

Action states:

- Open
- In Progress
- Blocked
- Done
- Archived

## 10. Documents

Documents should be organized by context.

Top-level libraries:

- Company
- Operating Agreement
- Deals
- Projects
- Capital
- Legal
- Tax
- Insurance
- Vendors
- Brand

Project document categories:

- closing docs
- contractor bids
- invoices
- permits
- photos
- insurance
- leases
- lender docs
- seller communications
- inspection reports

Documents should support:

- version history
- upload owner
- date added
- linked decision
- linked project
- visibility rules

## 11. Vendors / Contacts

The portal should eventually track:

- contractors
- lenders
- attorneys
- agents
- inspectors
- insurance contacts
- title companies
- property managers
- municipal contacts

Fields:

- name
- company
- role
- phone/email
- projects used on
- reliability notes
- pricing notes
- documents/contracts

## 12. Calendar / Timeline

The operating calendar should combine:

- deal review deadlines
- voting deadlines
- closing dates
- inspection periods
- meeting dates
- capital call due dates
- task due dates
- permit deadlines
- contractor milestones
- lease/sale dates

## 13. Risk Register

Each project should track risks:

- risk
- likelihood
- financial impact
- owner
- mitigation
- status
- next review date

This fits the brand voice: candid, measured, specific.

## Notifications

The portal should notify members only when action is needed.

Notification channels:

- in-app alerts
- email
- SMS for urgent deal/vote items
- later: Slack, GroupMe, WhatsApp, or Teams if the group adopts one

Notification types:

- new deal submitted
- urgent vote requested
- vote deadline approaching
- capital call issued
- payment overdue
- action item assigned
- action item overdue
- document requiring review
- meeting summary ready

## VA Deal Communication Workflow

This is a critical workflow.

1. VA finds lead in land portal or call tool.
2. VA creates Deal Intake record.
3. Portal generates Deal Brief.
4. VA marks urgency.
5. Members receive notification.
6. Members review and vote.
7. Portal calculates quorum/outcome.
8. Final decision is recorded.
9. Next action is created automatically.
10. If approved, deal moves into Project pipeline.

The VA should enter the opportunity once. Meridian should handle the packet, notification, vote, and next action.

## Brand Direction

Brand summary attributes:

- measured not hyped
- specific not vague
- candid not guarded
- elevated not corporate
- warm not folksy

### Visual System

Use the official brand system:

- Obsidian: `#0C0F0D`
- Brass: `#B08954`
- Bone: `#F4EFE6`
- Fog: `#D6D1C4`
- Ink: `#1A1A1A`
- Display: Fraunces
- Body/UI: Geist
- Mark: M degree monogram

### Product UI Guidance

The portal should feel quiet, precise, and durable.

Do:

- use brass sparingly for active states and important accents
- use dense but readable tables for operational data
- use clear status labels
- use restrained surfaces
- use precise language
- show audit trails and source links
- make empty states useful and specific

Avoid:

- generic SaaS copy
- oversized decorative cards
- too much brass
- survey-first framing
- vague labels like "hub" when the user needs a specific operating area
- marketing-style pages inside the authenticated portal

## AI Use

AI should help create structured records from messy inputs.

High-value AI uses:

- transcript to meeting notes
- transcript to action items
- deal intake to deal brief
- seller call notes to motivation summary
- document summary
- investment memo draft
- risk extraction
- weekly operating brief

AI should not silently make final decisions. It should draft, suggest, extract, and summarize. Humans approve.

## Branded Exports

Important records should export as Meridian-branded PDFs:

- deal brief
- investment memo
- meeting minutes
- decision record
- capital call notice
- project status report
- member ledger
- reimbursement packet

These documents should use the M degree mark, official palette, Fraunces/Geist typography, and measured brand voice.

## Data Model Direction

Core entities:

- members
- member_profiles
- deals
- deal_analysis
- deal_due_diligence_items
- projects
- deal_votes
- decisions
- action_items
- meetings
- meeting_transcripts
- documents
- capital_calls
- contributions
- expenses
- reimbursements
- vendors
- project_budgets
- project_timeline_events
- risk_register_items
- notifications
- audit_logs

Important relationship principle:

Most records should support optional links to:

- deal_id
- project_id
- meeting_id
- decision_id
- document_id
- action_item_id

This lets Meridian preserve context across the whole operation.

## Security And Governance

The portal should treat company information as sensitive.

Required direction:

- real authentication, not only localStorage user selection
- role-based permissions
- admin-only controls for money/governance records
- audit logs for financial and decision changes
- server-side authorization for API routes
- careful handling of transcripts and uploaded documents
- deletion/archival policies

## Product Phases

### Phase 1: Clarify The Operating Portal

- update brand tokens to official palette and fonts
- rename/reframe navigation
- make dashboard an operating brief
- reduce survey-first emphasis
- harden auth-sensitive API routes
- make meeting action creation opt-in

### Phase 2: Deal Desk

- create deal intake
- create deal brief
- add deal analyzer for improved property and land
- generate due diligence checklist from deal type and strategy
- add urgency levels
- add member voting
- add notifications
- create automatic action/decision records

### Phase 3: Projects

- add project records
- link actions, documents, meetings, expenses, and decisions to projects
- add project status timeline
- add due diligence checklist
- add photos/field notes

### Phase 4: Capital And Governance

- project-level budget vs actual
- reimbursement workflow
- capital call packets
- member ledger
- formal vote thresholds and decision records

### Phase 5: Reporting And Exports

- branded PDFs
- investment memo generator
- weekly operating brief
- project status reports
- member capital reports

## Success Metrics

The portal is working if:

- members can understand the state of the company in under two minutes
- urgent deal decisions happen without scattered text threads
- every approved deal has a clean decision record
- every meeting creates confirmed actions and decisions
- every dollar has a source, category, and owner
- every project has current status, risks, budget, and next steps
- the VA can submit deals without needing to chase members manually
- the portal feels unmistakably Meridian

## North Star Statement

Meridian is the private operating ledger for the collective: every opportunity, property, dollar, decision, document, and assignment connected in one calm, trustworthy system.
