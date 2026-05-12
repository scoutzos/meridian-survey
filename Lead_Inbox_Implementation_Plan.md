# Lead Inbox & Multi-Property Lead Implementation Plan

**Status:** Design locked · Engineering plan ready to execute
**Owners:** Courtney (product), Sophie (primary VA user), engineering
**Created:** 2026-05-12
**Branch context:** Builds on `codex/va-ia-improvements` ([PR #1](https://github.com/scoutzos/meridian-survey/pull/1)) which already added the clock-in banner, briefing surface, auto-fill brief, and review-intent help on top of main.

---

## 1. Goal

Replace the property-centric VA workspace with a **lead-first** model that mirrors how modern conversational CRMs (HubSpot Conversations, Close, Front, Intercom) and SMS-first wholesaler tools (Smarter Contact, Lead Sherpa, REI Reply) actually work.

### The design rule (everything follows from this)

> **Lists are sources. Campaigns are sends. The Inbox is where replies get worked. The Lead Page is for deep context.**

Every screen we build answers one of those four roles — and only one.

### The data hierarchy

```
Lead (the person)
├─ contact info + status + tags + owner + communication history
└─ Properties[]
    ├─ opportunity/deal stage
    ├─ buy-box match
    ├─ diligence checklist (Investment Criteria sections 1–4)
    ├─ files / comps
    └─ property-specific notes
```

**One lead. Many properties. One conversation history.** Conversation lives on the lead. Messages may optionally be tagged to a property.

---

## 2. Three entities, three roles

Today the platform conflates these. The new model separates them cleanly.

| Entity | Role | Lifecycle |
|---|---|---|
| **List** (source batch) | Static record of what was uploaded. `Greene County Tax Delinquent — May 2026, 842 rows, imported 5/12`. | Never changes after import. |
| **Audience** (filter) | A query: *"leads from List X + has mobile + 2+ properties + no reply in 14 days."* Reusable. Re-evaluates on each reference. | Mutable; a lead can fall in or out as their state changes. |
| **Campaign** (send) | One message + one audience + one schedule + one set of send results. | Immutable after send; full audit trail kept. |

Schema additions land in PR 4 (see below).

---

## 3. Wireframes

ASCII wireframes for the five main surfaces. These are dimensionally accurate and should be the visual reference during implementation.

### 3.1 Lead Inbox (the central workspace)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  OperatingHeader · Acquisitions Desk · VA Workdesk                                   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  ⚠ You're not clocked in                                            [ Clock In ]    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  VA Home   [ LEAD INBOX ]   Lists   Deal Packet   Daily Brief                       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  [All 47] [Unread 6] [Replies 3] [Follow-ups 4] [Interested 9] [Mine 12] [DNC]      │
│  🔍 Search leads…                              [☐ Select mode]    [Bulk Text → ]    │
├────────────────────────┬─────────────────────────────────┬─────────────────────────┤
│ QUEUE                  │ ACTIVE CONVERSATION             │ LEAD CARD (unified)     │
│                        │                                 │                         │
│ ● Joe Stillwell    3m  │ Joe Stillwell · 3 properties   │ JOE STILLWELL          │
│   "yeah, 80k for the…" │ +1 (404) 555-0199              │ +1 (404) 555-0199      │
│   [Interested]  🏷3    │ Status: Interested  [Open Card]│ joe@example.com         │
│ ─────────────────────  │                                 │ Source: Greene May '26  │
│ ○ Mary Kane       14m  │  17m  Joe: still selling?      │ Status: Interested      │
│   "yes I'd consider"   │  14m  You: timeline?           │ Tags: portfolio seller  │
│   [Interested]  🏷1    │   3m  Joe: yeah 80k…           │                         │
│ ─────────────────────  │                                 │ PROPERTIES (3)   +Add  │
│ ● Bob Lee          1h  │ ─────────────────────────────  │ ▼ 1842 Oakview Dr SW   │
│   "no thanks"          │ ┌─────────────────────────────┐│   5.2 ac · Researching │
│   [DNC]   🏷1          │ │ Hi Joe,                     ││   BB 92% match          │
│ ─────────────────────  │ │                             ││   [Open Packet] [Pass] │
│ Mary Bain          2h  │ └─────────────────────────────┘│ ▶ 240 Brooks Ln        │
│ "still selling?"       │ Templates▾  142ch · 1 seg      │   1.1 ac · Passed       │
│ [Interested]   🏷3     │ [No Answer][VM][Interested]    │ ▶ Parcel 14-B          │
│                        │                       [Send →] │   3.7 ac · New          │
│ … 43 more              │                                 │                         │
│                        │                                 │ ACTIVITY               │
│                        │                                 │  3m  Inbound SMS       │
│                        │                                 │ 14m  Outbound          │
│                        │                                 │  2d  → Interested      │
│                        │                                 │                         │
│                        │                                 │ NOTES                  │
│                        │                                 │ Joe mentioned…         │
└────────────────────────┴─────────────────────────────────┴─────────────────────────┘
```

**Anatomy:**

- **Filter tabs (top):** the queues. Counts re-render live. "Mine" = leads where `assigned_to === user`.
- **Search:** fuzzy across name, phone, message body.
- **Select mode:** toggles checkboxes per row for multi-select bulk SMS.
- **Bulk Text button:** opens the eligibility drawer (see 3.2). Operates on the *currently filtered* queue or selected leads.
- **Queue row:** one row per **lead** (person), not per property. Property count badge (🏷N) signals multi-property owners.
- **Conversation pane:** newest message at the bottom. Sticky composer. Quick-disposition chips above the textarea.
- **Lead Card pane:** ONE unified card. Property rows expandable in-place. No second card opens elsewhere.

---

### 3.2 Bulk SMS — eligibility drawer

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║  SEND BULK TEXT                                                            [×]   ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║  AUDIENCE                                                                        ║
║  ─────────────────────────────────────────────────────────────────────────────  ║
║  List: Greene County May 2026                                                    ║
║  Filter: status=new + has mobile + buy_box=yes                                   ║
║                                                                                  ║
║      516  total leads matching                                                   ║
║   ━━ 392  ELIGIBLE TO TEXT                                                       ║
║      124  excluded — show breakdown ▾                                            ║
║              ● 42 no valid mobile number                                         ║
║              ● 27 texted within last 7 days                                      ║
║              ● 24 opted out (STOP received)                                      ║
║              ● 18 missing phone                                                  ║
║              ● 13 duplicate phone (kept first only)                              ║
║                                                                                  ║
║  MESSAGE                                                                         ║
║  ─────────────────────────────────────────────────────────────────────────────  ║
║  Template: [Initial Outreach ▾]                                                  ║
║  ┌────────────────────────────────────────────────────────────────────────────┐ ║
║  │ Hi {{first_name}}, this is Courtney. I was reaching out about              │ ║
║  │ land you own in {{county}}. Would you consider selling?                    │ ║
║  └────────────────────────────────────────────────────────────────────────────┘ ║
║  Merge: {{first_name}} {{county}} {{property_count}}                            ║
║  142 chars · 1 SMS segment · "Reply STOP to opt out" appended automatically     ║
║                                                                                  ║
║  PREVIEW (3 random recipients)                                                  ║
║  ─────────────────────────────────────────────────────────────────────────────  ║
║   Joe (Greene)    → "Hi Joe, this is Courtney. I was reaching out about land   ║
║                      you own in Greene County. Would you consider selling?     ║
║                      Reply STOP to opt out."                                    ║
║   Mary (Greene)   → "Hi Mary, this is Courtney…"                                ║
║   Robert (Greene) → "Hi Robert, this is Courtney…"                              ║
║                                                                                  ║
║  SEND OPTIONS                                                                   ║
║  ─────────────────────────────────────────────────────────────────────────────  ║
║  When:     ● Send now      ◯ Schedule for [date/time]                          ║
║  Window:   Only between [10:00 AM] – [6:00 PM]  America/New_York                ║
║  Throttle: [60 messages / minute ▾]                                              ║
║                                                                                  ║
║                  [Cancel]   [Save as Campaign template]   [Send to 392 →]       ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

**Key design choices:**

- **Eligible / excluded** is the headline math, not "send to 392." Operators need to see what *isn't* going out and why.
- **Exclusion reasons** are coaching, not strict — "27 texted within last 7 days" tells the VA *why* not to retry.
- **Compliance footer** auto-appended, non-editable in the composer.
- **Send window** defaults to local business hours. Sakari will queue messages outside the window if scheduled.
- **Throttle** prevents Sakari rate-limit errors on large blasts.

---

### 3.3 Lead Page — Overview tab

The Overview is **a synthesis screen, not a stub.** It answers "who is this, what do they own, what happened last, what do I do next" without making the VA click into a tab.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  JOE STILLWELL                                      [Text] [Call] [Note] [⋯]      │
│  📞 +1 (404) 555-0199    ✉ joe@example.com                                         │
│  Source: Greene County Tax Delinquent May 2026 · Owns 3 properties                 │
│  Status: Interested  · Next follow-up: 5/14  · Owner: Sophie                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  [ OVERVIEW ]   Conversation   Properties   Activity   Notes   Files               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  NEXT ACTION                                                                       │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  "Reply to Joe — asked about price on Brooks Ln"                                  │
│                                                                                     │
│            [ Reply via SMS → ]      [ Open Conversation ]                          │
│                                                                                     │
│  RECENT CONVERSATION                                              3 most recent  │
│  ─────────────────────────────────────────────────────────────────────────────── │
│     1m   Joe:  "yeah, I'd consider 80k for the back lot"                          │
│    14m   You:  "what's your timeline?"                                            │
│    17m   Joe:  "yes still selling. you have a number?"                            │
│                                                       [Open Full Conversation →]   │
│                                                                                     │
│  PROPERTIES                                                                  3    │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  ▼ 1842 Oakview Dr SW         5.2 ac · Greene Co · Researching · BB ✓ 92%         │
│      Last on this property: SMS 3m ago (tagged to this property)                  │
│      Diligence: 10 of 17 cleared                                                  │
│      [Open Packet]  [Build Offer]  [Pass]                                         │
│                                                                                     │
│  ▶ 240 Brooks Ln              1.1 ac · Greene Co · Passed · BB ✗                  │
│  ▶ Parcel 14-B                3.7 ac · Greene Co · New · BB ?                     │
│                                                                                     │
│  ACTIVITY                                                              top 5     │
│  ─────────────────────────────────────────────────────────────────────────────── │
│    3m   Inbound SMS                                                                │
│   14m   Outbound SMS                                                               │
│    2d   Status changed: New → Interested                                          │
│    5d   First SMS sent  (Campaign: Greene Initial Outreach)                       │
│    6d   Imported from Greene County Tax Delinquent May 2026                       │
│                                                          [Full activity →]         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

The other tabs (Conversation · Properties · Activity · Notes · Files) are for **deep work on one dimension**, not triage. The Overview is the home screen for one lead.

---

### 3.4 Lead Page — Properties tab with diligence panel

This is where the **Investment Criteria** sections live. Each property has its own diligence checklist organized into the 4 sections.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  JOE STILLWELL                                                                     │
│  Overview  Conversation  [ PROPERTIES ]  Activity  Notes  Files                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  PROPERTIES (3)                                                  [ + Add Property] │
│                                                                                     │
│  ▼ 1842 Oakview Dr SW                       5.2 ac · Greene Co · Researching      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ FACTS    APN 14-A · 5.2 ac · Zoned A-1 · Market $48k                        │ │
│  │ [photo] [parcel record] [google map] [comps]                                │ │
│  │                                                                              │ │
│  │ DILIGENCE                                                10 of 17 cleared   │ │
│  │ ─────────────────────────────────────────────────────────────────────────  │ │
│  │ ▼ 1. Ownership & Legal Standing                                3/5 cleared  │ │
│  │   ✓ Vested Owner verified                Joe Stillwell · deed linked       │ │
│  │   ✓ Chain of Title clean                 [note]                             │ │
│  │   ◯ Liens / judgments                    Open — need title search           │ │
│  │   ✓ Back taxes current                   auto · Land Insights              │ │
│  │   ◯ Mineral rights included              Open — ask seller                  │ │
│  │                                                                              │ │
│  │ ▼ 2. Access & Infrastructure                                  2/4 cleared   │ │
│  │   ◯ Legal access                         Open — verify easement             │ │
│  │   ✓ Physical access (sedan OK)           from photos                        │ │
│  │   ◯ Electricity at street                Open — verify poles                │ │
│  │   ✓ Septic perc-tested                   [link perc report]                 │ │
│  │                                                                              │ │
│  │ ▶ 3. Environmental & Topography                               3/4 cleared   │ │
│  │ ▶ 4. Development Potential                                    2/4 cleared   │ │
│  │                                                                              │ │
│  │ [Open Packet]  [Build Offer]  [Submit For Member Review]  [Pass]            │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  ▶ 240 Brooks Ln                            1.1 ac · Passed · BB ✗               │
│  ▶ Parcel 14-B                              3.7 ac · New · BB ?                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Each diligence row:**

- Status pill: Open / In Review / Cleared / Blocked / N/A
- Evidence: URL, attached file, note, or auto-derived from import
- Source tag: `auto` (Land Insights), `va-research`, `member`
- Updated_by + updated_at trail

Auto-cleared on import where Land Insights answers:
- Back taxes current ← `tax_delinquent === false`
- FEMA flood zone ← `flood_zone_percent === 0`
- Wetlands ← `wetlands_percent === 0`
- Land locked → blocks Legal Access if `is_land_locked === true`
- Zoning → cleared with the value Land Insights gave (VA confirms intended-use match later)

The other ~10 items stay Open for the VA to research.

---

### 3.5 List Detail page

When the VA clicks a list from the Lists tab, they land here:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Home  Inbox  [ LISTS ]  Deal Packet  Daily Brief                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Lists ▸ Greene County Tax Delinquent — May 2026                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  GREENE COUNTY TAX DELINQUENT — MAY 2026                                          │
│  Imported 5/12 · Source: Land Insights · Uploaded by Sophie                       │
│                                                                                     │
│  FUNNEL                                                                            │
│  ─────────────────────────────────────────────────────────────────────────────── │
│   842   Property rows imported                                                    │
│   516   Unique leads (after collapsing multi-parcel owners)                       │
│   392   Have valid mobile                                                         │
│    31   Duplicate owners merged                                                   │
│    24   Opted out                                                                  │
│    18   Missing phone                                                              │
│                                                                                     │
│  FILTERS                                                                           │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  [All 516] [Has mobile 392] [In buy box 178] [Multi-property 84]                 │
│  [No prior contact 392] [Previously contacted 0] [Interested 0] [Opted out 24]   │
│                                                                                     │
│                                                          ┌──────────────────────┐ │
│  PRIMARY ACTION                                          │  [SEND BULK TEXT →]  │ │
│                                                          └──────────────────────┘ │
│                                                                                     │
│  LEADS                                                                             │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  ☐ Joe Stillwell      (404) 555-0199  3 props  Greene  BB ✓                      │
│  ☐ Mary Kane          (404) 555-0188  1 prop   Greene  BB ✓                      │
│  ☐ Robert Lee         (404) 555-0177  2 props  Greene  BB ✗                      │
│  …                                                                                 │
│                                                                                     │
│  Selected: 0   [Bulk Text Selected]   [Save Audience…]   [Export CSV]             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

The list detail page is the bridge between **upload** and **send**. The big call-to-action is `Send Bulk Text` — and it opens the same drawer from 3.2.

---

### 3.6 Campaign builder (for targeted follow-ups later)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Campaigns ▸ New Campaign                                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  NEW CAMPAIGN                                                                      │
│                                                                                     │
│  1. AUDIENCE                                                                       │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  ◯ Use a saved audience    [▾ select…]                                            │
│  ● Build a new audience                                                            │
│                                                                                     │
│      Source list:    [▾ Greene County May 2026]                                   │
│  AND Status:         [▾ No response]                                               │
│  AND Has mobile                                                                    │
│  AND Last text:      [more than ▾] [14] days ago                                  │
│  AND County:         [Greene]                                                      │
│  AND Buy box match:  [Yes ▾]                                                       │
│  AND Not opted out                                                                 │
│  [ + Add filter ]                                                                  │
│                                                                                     │
│  → 247 leads match this audience                                                  │
│  [Save audience as…  "Greene No-Response 14d+"]                                   │
│                                                                                     │
│  2. MESSAGE                                                                        │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  Template: [▾ Follow-up to no response]                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ Hi {{first_name}}, just following up on the land you own in {{county}}.    │ │
│  │ Are you open to an offer, or should I close your file?                     │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│  Compliance footer (auto): "Reply STOP to opt out"                                │
│  Merge: {{first_name}} {{county}} {{property_count}}                              │
│                                                                                     │
│  3. SCHEDULE                                                                       │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  ● Send now                                                                        │
│  ◯ Schedule for…   [date]  [time]                                                  │
│  Window: 10:00 AM – 6:00 PM   America/New_York                                    │
│  Throttle: 60/min                                                                  │
│                                                                                     │
│  4. REVIEW & SEND                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  247 leads will receive this message                                              │
│  ━ 213 eligible (will send)                                                        │
│  ━  34 excluded:                                                                   │
│        • 21 opted out                                                              │
│        •  9 texted in last 7 days                                                 │
│        •  4 duplicate phone                                                        │
│                                                                                     │
│             [Save Draft]   [Send Test To Me]   [Send Campaign →]                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

A campaign saves the audience snapshot, message template, send schedule, and a per-recipient send record. Replies flow into the Inbox, attributed to this campaign — so the next campaign can target "people who *didn't* reply to Greene Initial Outreach."

---

## 4. End-to-end workflow

The complete VA loop the new system enables:

```
UPLOAD LIST                                                          (Lists tab)
  ↓
WIZARD: choose CSV → map columns → preview → dedupe → import
  ↓
LIST DETAIL: 842 → 516 → 392 funnel, filters, primary CTA = Send Bulk Text
  ↓
BULK SMS DRAWER: eligibility breakdown → message → preview → schedule → send
  ↓
SAKARI: outbound SMS to 392 recipients (throttled, window-respected)
  ↓
COMMUNICATION_EVENTS: per-recipient row, tagged with campaign_id
  ↓
SAKARI WEBHOOK: inbound replies arrive
  ↓
LEAD INBOX: replies appear, filter view "Replies from Greene May 2026"
  ↓
VA WORKS REPLIES: clicks a lead, conversation in middle pane, lead card on right
  ↓
VA TAKES ACTION:
  • Reply via SMS (templates, dispositions)
  • Open Lead Page for deep context
  • Open Property packet to add diligence
  • Mark interested / pass / build offer
  ↓
LATER: build a follow-up campaign
  Audience: "No response after 14 days from Greene May 2026"
  Message: "Just following up…"
  → goes back through Bulk SMS drawer → Sakari → Inbox
```

---

## 5. Phased PR plan

Five PRs, sequenced so each is shippable on its own.

### PR 1 — Bulk SMS in the Inbox + eligibility drawer (current branch can be extended)

**Goal:** Move bulk SMS from the Lists tab to the Lead Inbox top toolbar. Add the eligibility breakdown.

**Scope:**
- Move `bulkSmsDraft`, `sendBulkSms`, `bulkEligibleLeads` from Lists tab to Lead Inbox toolbar
- New `BulkSmsDrawer` component
- Eligibility breakdown: opt-outs, no-phone, recently-messaged, duplicate phone, missing valid mobile
- Compliance footer auto-appended (non-editable)
- Default throttle: 60/min (configurable in drawer)
- Send window default: 10am–6pm local
- Preview: 3 random recipients with rendered message

**Schema changes:** none

**Branch:** off `main` (after PR #1 merges, or rebased on it)
**Estimated effort:** 1–2 days

---

### PR 2 — Lead-first schema migration

**Goal:** One person = one lead, regardless of how many properties they own.

**Scope (path A recommended — clean two-table model):**

```sql
-- New: the canonical person/entity
create table meridian_leads (
  id uuid primary key default gen_random_uuid(),
  owner_name text,
  phone text,
  phone_2 text,
  email text,
  mailing_address text,
  source_system text,
  campaign_source text,           -- list name
  batch_id uuid references meridian_land_lead_batches(id),
  status text default 'new',      -- new | contacted | interested | converted | passed | dnc
  tags text[] default '{}',
  assigned_to text,
  sms_opt_status text default 'unknown',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Rename old table conceptually: each row is now a property tied to a lead
alter table meridian_imported_land_leads
  rename to meridian_properties;

alter table meridian_properties
  add column lead_id uuid references meridian_leads(id) on delete cascade,
  drop column phone,              -- moves to lead
  drop column phone_2,
  drop column email,
  drop column mailing_address,
  drop column owner_name,
  drop column status,             -- property has its own stage; lead has status
  add column stage text default 'new';   -- new | researching | offer-made | passed | converted

-- Optional: tag SMS to a property
alter table meridian_communication_events
  add column property_id uuid references meridian_properties(id);
```

**Migration script:**
1. For each unique `(phone, owner_name)` combo in `meridian_imported_land_leads`, create one `meridian_leads` row.
2. Update every old row to point at the new lead via `lead_id`.
3. Migrate the lead-level columns (phone, email, owner_name, status, sms_opt_status) off the property row into the lead.
4. Verify counts: `count(distinct phone) on old == count(*) on new leads`.

**CSV importer update:**
- On import, look up existing lead by phone+owner before creating a new one.
- If found, attach the new property to the existing lead. Increment `property_count`.
- If not, create lead + property in one transaction.

**Schema changes:** see above. Forward + rollback scripts required.
**Estimated effort:** 3–4 days (with thorough testing)

---

### PR 3 — List Detail page + Lead Page with Overview tab

**Goal:** Make every list its own page with the funnel rollup. Stand up the unified Lead Page (`/lead/{id}`) replacing the property-centric `/opportunity` pattern.

**Scope:**
- New route `/lists/{batch_id}` showing the funnel + filters + lead list + Send Bulk Text CTA
- New route `/lead/{id}` with tabs: Overview · Conversation · Properties · Activity · Notes · Files
- `/opportunity?deal=…` and `/opportunity?lead=…` redirect to `/lead/{id}` with the matching property auto-expanded
- Properties tab renders the expandable property rows (diligence panel comes in PR 5)
- Activity tab shows the unified timeline (SMS, calls, status changes, packet submissions, member assignments)
- Notes and Files tabs: free-form, tagged optionally to a property

**Schema changes:** depends on PR 2 landing first
**Estimated effort:** 4–5 days

---

### PR 4 — Campaigns + Audiences + merge fields

**Goal:** Stand up the full targeted-campaign system.

**Scope:**

```sql
create table meridian_audiences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filter_json jsonb not null,
  is_saved boolean default false,
  created_by text,
  created_at timestamptz default now()
);

create table meridian_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience_id uuid references meridian_audiences(id),
  audience_snapshot_json jsonb,            -- frozen at send-time
  message_template text not null,
  scheduled_at timestamptz,
  send_window_start time,
  send_window_end time,
  send_window_tz text default 'America/New_York',
  throttle_per_minute int default 60,
  status text not null default 'draft',
  recipients_total int default 0,
  recipients_sent int default 0,
  recipients_failed int default 0,
  recipients_excluded_json jsonb,
  created_by text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

alter table meridian_communication_events
  add column campaign_id uuid references meridian_campaigns(id);
```

- Campaign builder UI (wireframe 3.6)
- Audience builder with composable filters (status, list, county, acres range, buy-box match, last-text-age, multi-property)
- Merge field engine: `{{first_name}}`, `{{county}}`, `{{property_count}}`, `{{primary_property_address}}`, `{{property_list}}`
- Preview rendering for 3 random recipients
- Scheduled send via a small worker (cron or Vercel cron)
- Throttling at send time
- Saved audience library
- Inbox filter: "Replied to Campaign X"

**Schema changes:** new audiences + campaigns tables, campaign_id on events
**Estimated effort:** 6–8 days

---

### PR 5 — Property Diligence panel (Investment Criteria)

**Goal:** Build the 4-section diligence checklist on each property, pre-seeded from CSV imports.

**Scope:**

```sql
-- Promote scoring-only flags to first-class columns
alter table meridian_properties
  add column road_frontage_ft numeric,
  add column is_land_locked boolean default false,
  add column flood_zone_percent numeric,
  add column flood_zone_type text,
  add column wetlands_percent numeric,
  add column topography text,
  add column bad_topography boolean default false,
  add column tax_delinquent boolean default false,
  add column tax_delinquent_years numeric,
  add column mineral_rights_status text,
  add column hoa_status text,
  add column min_lot_size_acres numeric;

create table meridian_property_diligence (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references meridian_properties(id) on delete cascade,
  section int not null,                  -- 1, 2, 3, 4
  criterion text not null,               -- "Vested Owner", "FEMA Flood Zone", etc.
  status text not null default 'open',   -- open | in-review | cleared | blocked | not-applicable
  source text,                            -- "auto-land-insights" | "va-research" | "member"
  evidence_url text,
  evidence_note text,
  cleared_at timestamptz,
  cleared_by text,
  updated_at timestamptz default now()
);
```

- CSV importer pulls flood/wetlands/landlocked/road-frontage/tax-delinquent/HOA out of `raw_data` into real columns
- After insert, seed 17 diligence items per property; auto-clear the ones the CSV answered
- UI panel (wireframe 3.4) with section headers, status pills, evidence attachment, notes
- Diligence completion feeds the Buy Box match score and the "Ready to submit?" gate

**Schema changes:** see above
**Estimated effort:** 5–6 days

---

## 6. Schema migrations summary

Run in order:

1. `041_campaigns_audiences.sql` (PR 4) — can run independently
2. `042_leads_table_split.sql` (PR 2) — biggest migration, requires data backfill
3. `043_property_first_class_fields.sql` (PR 5) — depends on 042
4. `044_property_diligence.sql` (PR 5) — depends on 042, 043

Every migration must include:
- Forward `up()` script
- Rollback `down()` script
- Data backfill verification (row counts before/after)
- Index strategy for the new query patterns

---

## 7. Compliance & operational requirements

These apply across all PRs that touch SMS:

### Twilio / Sakari policy

- **Opt-out keyword handling**: STOP, UNSUBSCRIBE, CANCEL, END, QUIT, OPT OUT. Sakari handles at the provider level; we surface the status in the lead card.
- **Auto-appended footer**: every outbound (one-on-one and bulk) must end with `"Reply STOP to opt out"`. Non-editable in the composer.
- **Consent before message**: leads imported from public records (county tax rolls, deed transfers) are *not* opt-in. The first SMS must be plainly identifiable and easy to opt out of. We don't send marketing-style messaging.
- **Sender identification**: every first message includes "this is [name]" and a clear reason for outreach.
- **Send window**: enforced server-side, not just UI. Messages scheduled outside the window get queued.
- **No marketing-day blasts**: rate limit defaults to 60/min, max 600/hour. Adjustable per campaign with explicit override.

### Audit trail

- Every campaign send records: who sent it, when, audience snapshot, message text, throttle, window
- Every excluded recipient records: which exclusion reason
- Every disposition + status change has a timestamp and actor
- Communication events keep the Sakari provider event payload in `raw_data`

### Privacy

- VA does not see `cost_amount` or `hourly_rate` on time entries (already done in PR #1)
- Future: RLS policy or scoped endpoint to strip those fields from the API response, not just the UI
- VA does not see member voting records or unread member notifications about other members

### Data integrity

- Lead phone numbers normalized to E.164 on import (`+14045550199`)
- Duplicate detection by E.164 phone + (owner_name fuzzy match)
- Property → Lead foreign key is `on delete cascade` (deleting a lead deletes their properties)
- Communication events keep `lead_id` even if `property_id` is null

---

## 8. Testing requirements per PR

Each PR ships with:

| Test type | What |
|---|---|
| **Unit** | Pure functions: CSV header mapping, dedupe key generation, merge-field rendering, eligibility filter |
| **Integration** | API endpoints (`/api/import-land-leads`, `/api/sakari/send`, `/api/sakari/bulk-send`, `/api/webhooks/sakari`) tested against a local Supabase |
| **Migration** | Forward + rollback executed against a copy of prod with row-count assertions |
| **Manual QA** | Click-through checklist on `/va`, `/lead/{id}`, `/lists/{id}`, `/campaigns/{id}` |
| **Compliance** | Verify STOP keyword arrives → updates `sms_opt_status` → subsequent campaigns exclude |

A **production QA runbook** (extending the existing `Production_QA_Runbook.md`) gets new sections per PR.

---

## 9. Definition of "production ready" per PR

Each PR is mergeable to `main` only when:

- [ ] All tests pass (CI green)
- [ ] Typecheck clean (`npx tsc --noEmit`)
- [ ] Lint clean (`npx next lint`)
- [ ] Migration tested against staging Supabase with row-count assertions
- [ ] At least one full end-to-end manual run by Courtney (and Sophie if VA-facing)
- [ ] Sakari send tested with a 5-recipient test audience pointing to internal phones
- [ ] Compliance check: STOP keyword from test recipient → opt-out recorded → next campaign excludes
- [ ] Mobile responsive verified on iPhone Safari + Chrome Android
- [ ] Audit trail visible in `/operations` for member review
- [ ] Rollback plan documented in the PR description

---

## 10. Rollout plan

### Order of merges

1. **PR 1** (Bulk SMS in Inbox + eligibility drawer) — *days*. No schema change. Low risk. Ships first.
2. **PR 2** (Schema split into leads + properties) — *weeks of soak time*. Run migration in a staging environment first; backfill production over a weekend; verify counts; deploy code.
3. **PR 3** (List Detail + Lead Page Overview) — depends on PR 2 data shape.
4. **PR 4** (Campaigns + Audiences) — depends on PR 2 + PR 3.
5. **PR 5** (Diligence panel) — can run in parallel with PR 4 if engineering capacity allows.

### Feature flags

Each user-visible PR gets a flag:

- `va_inbox_bulk_sms_v2` — PR 1
- `lead_first_routing` — PR 2 + 3 (off until both are deployed)
- `campaigns_v1` — PR 4
- `diligence_panel_v1` — PR 5

Flags let us roll back instantly without redeploying.

### Soft rollout

For each PR:
1. Deploy with flag off
2. Enable for Courtney's account only — verify
3. Enable for Sophie — verify she can complete her full daily workflow
4. Enable for all members
5. Remove flag in a follow-up cleanup PR

---

## 11. Open decisions before kickoff

These need resolution before PR 1 starts:

1. **Schema path for PR 2**: Path A (new `leads` table, rename old to `properties`) or Path B (`parent_lead_id` on existing table, no rename)? *Recommendation: Path A. Cleaner long-term, one-time migration risk.*
2. **Sample Land Insights CSV** — needed for PR 1 and PR 5 to validate column header variations.
3. **Min-lot-size lookup**: per-county zoning table or free-field VA entry? *Recommendation: free-field initially, graduate to a lookup table after 50+ deals through it.*
4. **Eligibility-drawer copy tone**: strict ("13 leads excluded for compliance") or coaching ("13 leads not sent — 11 opt-outs, 2 missing valid mobile")? *Recommendation: coaching.*
5. **Compliance footer**: configurable per campaign or hard-coded `"Reply STOP to opt out"`? *Recommendation: hard-coded for now.*
6. **Send rate limit default**: 60/min or send as fast as Sakari accepts? *Recommendation: 60/min default, configurable up to 600/hour per campaign.*

---

## 12. Out of scope (for this plan)

The following are explicitly *not* part of these 5 PRs but are reasonable follow-ups:

- **Backend privacy hardening** (RLS or scoped endpoint to strip `cost_amount`/`hourly_rate` from VA API responses) — UI hides them today; backend close-out is a separate ticket.
- **Skip-tracing integration with shared quota tracking** — referenced in the original transcript review, no platform support today.
- **Retail-listing handoff to member agents** — also from the transcript review. Needs legal/OA framing before UI.
- **A/B message variations within a campaign** — nice to have, not in scope.
- **Inbound call recording / transcription** — VA is SMS-only per Tiffany; calls are member work.
- **Splitting `va/page.tsx` into subcomponents** — internal refactor, not user-facing; can ride along with PR 3.

---

## 13. Card visual system — Lead Cards & Property Cards in every state

A single source of truth for what a card looks like in each context it renders. These specs apply across PRs 1, 3, and 5.

### 13.1 Lead Card — three rendering states

A Lead is rendered three different ways depending on where it's seen. They must feel like the same card at different zoom levels so the VA recognizes "this is Joe" instantly.

**State A: Queue row (Inbox left pane)** — 56–72px tall

```
● Joe Stillwell                                                    3m
   "yeah, 80k for the back lot…"                  [Interested]  🏷3
```

- Unread dot (filled brass) or ring (empty fog) on far left
- Name in obsidian, 14px, semibold
- Last message snippet, 1 line truncated, muted
- Time-ago, right-aligned, small
- Status pill (Interested / New / DNC / etc.) + property count badge (🏷N) on the right
- Hover reveals checkbox for multi-select bulk SMS
- Active row gets a brass left-border + tinted background

**State B: Right pane Lead Card (Inbox)** — ~480px wide, scrollable

```
┌────────────────────────────────────────────────┐
│ JOE STILLWELL                                  │
│ +1 (404) 555-0199  ·  joe@example.com         │
│ Source: Greene Co Tax Delinquent May 2026     │
│ Status: Interested · Tags: portfolio seller    │
│ Owner: Sophie · Last touch: 3m ago             │
│                                                │
│ [Open Lead Page →]   [Text]   [Note]   [⋯]    │
├────────────────────────────────────────────────┤
│ PROPERTIES (3)                          + Add  │
│                                                │
│ ▼ 1842 Oakview Dr SW                          │
│    5.2 ac · Researching · BB ✓ 92%            │
│    Diligence 10/17 · SMS 3m ago               │
│    [Open Packet]  [Pass]                      │
│                                                │
│ ▶ 240 Brooks Ln       Passed     BB ✗         │
│ ▶ Parcel 14-B         New        BB ?         │
├────────────────────────────────────────────────┤
│ RECENT ACTIVITY                       top 5    │
│   3m   Inbound SMS                            │
│  14m   Outbound                                │
│   2d   → Interested                            │
│   5d   First SMS (Campaign: Greene Initial)   │
├────────────────────────────────────────────────┤
│ NOTES                                          │
│   Joe owns several lots near…                  │
└────────────────────────────────────────────────┘
```

- Hero block (name + contact + meta) is fixed at top of pane
- Most-recently-touched property auto-expanded; others collapsed
- Activity preview shows last 5 with "view all" link
- Notes are inline-editable (auto-save on blur)

**State C: Lead Page header (full-width on `/lead/{id}`)** — large display

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ JOE STILLWELL                                       [Text] [Call] [Note] [⋯]  │
│ 📞 +1 (404) 555-0199  ✉ joe@example.com                                        │
│ Source: Greene County Tax Delinquent May 2026 · 3 properties                  │
│ Status: Interested · Follow-up: 5/14 · Owner: Sophie                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Name in display font (`Cormorant Garamond`), 32–46px (responsive)
- One-tap actions: **Text** (opens conversation pane / FloatingSmsWindow), **Call** (`tel:` link), **Note** (inline composer), **⋯** menu (Set follow-up · Mark interested · Reassign · DNC · Archive)
- Header is sticky on scroll for the Conversation, Properties, Activity tabs

### 13.2 Property Card — three rendering states

**State A: Collapsed row** (1 line, inside Lead Card or Properties tab)

```
▶ 1842 Oakview Dr SW      5.2 ac · Greene · Researching · BB ✓ 92%
```

- Disclosure caret toggles expansion in place (no navigation)
- Stage pill: New / Researching / Offer Made / Under Contract / Passed / Converted
- Buy Box badge (see 13.3)

**State B: Expanded row** (in Properties tab)

```
▼ 1842 Oakview Dr SW                          5.2 ac · Greene · Researching
┌───────────────────────────────────────────────────────────────────────────┐
│ FACTS    APN 14-A · 5.2 ac · Zoned A-1 · Market $48k                       │
│ [photo] [parcel record] [google map] [comps]                               │
│                                                                            │
│ DILIGENCE                                              10 of 17 cleared    │
│   ▼ 1. Ownership & Legal Standing                          3/5             │
│      ✓ Vested Owner · ✓ Chain of Title · ◯ Liens · ✓ Taxes · ◯ Minerals    │
│   ▶ 2. Access & Infrastructure                             2/4             │
│   ▶ 3. Environmental & Topography                          3/4             │
│   ▶ 4. Development Potential                               2/4             │
│                                                                            │
│ [Open Packet]  [Build Offer]  [Submit For Member Review]  [Pass]           │
└───────────────────────────────────────────────────────────────────────────┘
```

- Expanding does *not* navigate away — stays on the Lead Page
- Action row at the bottom is always visible
- Each diligence section is independently collapsible

**State C: Full Deal Packet** (`/lead/{id}/property/{property_id}` or modal route)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Joe Stillwell                                                         │
│ 1842 OAKVIEW DR SW                                                              │
│ APN 14-A · Greene Co GA · 5.2 ac · Zoned A-1 · BB ✓ 92% · Diligence 10/17     │
│                                                          Stage: Researching     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐ ┌──────────────────────────────┐ │
│ │ REQUIRED FIELDS (sticky top)              │ │ LIVE ANALYSIS  (sticky right)│ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│ │ Title · Property type · Address           │ │ Recommendation: REVIEW       │ │
│ │ Parcel · Seller name · Seller phone       │ │   Recommended offer: $58k    │ │
│ │ Asking · Exit value · Strategy            │ │   Max offer:        $66k    │ │
│ │ Review intent · Summary · Next step       │ │   Spread @ ask:     $14k    │ │
│ │                                            │ │                              │ │
│ │ READINESS                       10/17     │ │ DILIGENCE  10 of 17 cleared │ │
│ │ Missing for vote: Liens, Mineral rights,  │ │   ▶ Section 1   3/5         │ │
│ │   Electricity, Legal access, Scrub clear, │ │   ▶ Section 2   2/4         │ │
│ │   Subdividable, Setbacks, HOA             │ │   ▶ Section 3   3/4         │ │
│ │                                            │ │   ▶ Section 4   2/4         │ │
│ │ ADVANCED (accordions, collapsed)          │ │                              │ │
│ │   ▶ Acquisition math                      │ │ ACTIONS                      │ │
│ │   ▶ Disposition + buyer demand            │ │   [Save Draft]               │ │
│ │   ▶ Diligence (full 17-item editor)       │ │   [Save Updates]             │ │
│ │   ▶ Land-specific                          │ │   [Submit For Member Review]│ │
│ │   ▶ Links + attachments                    │ │                              │ │
│ │   ▶ Seller / research notes               │ │                              │ │
│ └───────────────────────────────────────────┘ └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Required fields fit on first screen — VA can save a draft without scrolling
- Advanced sections are accordions, collapsed by default
- Right rail is sticky; readiness checklist is always visible
- "Submit For Member Review" disabled until readiness checks pass, with inline reason

### 13.3 Buy Box Match badge — scoring & visual states

Five visual states, one underlying score.

| State | Badge | Score | Meaning |
|---|---|---|---|
| Unknown | `BB ?` (gray dot) | n/a | No buy-box defined yet OR insufficient property data |
| No match | `BB ✗` (gray bar) | 0–30% | Fails primary criteria (wrong county / out of acreage range / above max price) |
| Possible | `BB ~ 50%` (light brass) | 31–65% | Some criteria match; needs VA judgment |
| Match | `BB ✓ 80%` (brass) | 66–89% | Primary criteria met; diligence has gaps |
| Strong | `BB ✓✓ 95%` (gold) | 90–100% | Primary criteria met AND diligence fully cleared |

**Scoring algorithm (the 100 points)**

| Component | Weight | Rule |
|---|---|---|
| Primary buy-box match | 40 | County in member's BB list (15) + acreage in range (15) + asking ≤ max price (10) |
| Diligence cleared ratio | 30 | `30 × (cleared / total_non_na_items)` |
| Environmental clear | 20 | No flood (10) + no wetlands (5) + not landlocked (5) |
| Value alignment | 10 | Asking ≤ ARV × 0.75 (10) |

If multiple members have buy-boxes, the badge shows the **best** match across all of them, with a tooltip listing each member's score. This surfaces the retail-handoff case from your transcript review: a property might be a 30% match for member A but 85% for member B because B works that county.

### 13.4 SellerCommandCenter — migration map

Today's `SellerCommandCenter` ([va/page.tsx:2937](src/app/va/page.tsx:2937)) is a Frankenstein component doing eight jobs. After PRs 3 + 5, it disappears and its pieces move to their proper homes:

| Sub-component today | New home |
|---|---|
| Next-action banner | Lead Page Overview tab — "Next Action" card |
| Property facts (acreage/parcel/zoning) | Property collapsed row + expanded card |
| Conversation timeline | Inbox middle pane + Lead Page Conversation tab |
| SMS composer + templates | Inbox middle pane sticky composer + global `FloatingSmsWindow` |
| Quick-disposition chips (No Answer / VM / Interested) | Inbox conversation pane (above composer) + Property expanded card |
| Full disposition form | Per-property action panel inside expanded Property card |
| Activity logger | Lead Page Activity tab |
| Action row (Open File · Build Packet · Pass) | Per-property action row inside expanded Property card |

There is no replacement "MegaCard." The migration removes the conflation between *lead-level* and *property-level* actions, which is the root of today's UI confusion.

### 13.5 Member-side property card (voting view)

When a member opens a deal-review notification, they're routed to `/lead/{lead_id}?property={property_id}` (lead page with the relevant property auto-expanded). The expanded property card on the member side looks different than the VA side:

```
JOE STILLWELL
Overview  Conversation  [ PROPERTIES ]  Activity  Notes  Files

PROPERTIES (3)
─────────────────────────────────────────────────────────────────────

▼ 1842 Oakview Dr SW                            5.2 ac · Submitted
┌───────────────────────────────────────────────────────────────────┐
│ ⚡ MEMBER VOTE NEEDED                                              │
│ Sophie submitted this packet 14m ago for "Ready for Vote"          │
│                                                                    │
│ Your vote:   ◯ Approve   ◯ Pass   ◯ Need more info                │
│ Comment:     ┌──────────────────────────────────────────────────┐ │
│              │                                                  │ │
│              └──────────────────────────────────────────────────┘ │
│                                                  [Submit Vote →] │
│                                                                    │
│ TALLY                                                              │
│   Approve     ●●●        (3 of 5)                                 │
│   Need info   ●          (1 of 5)                                 │
│   Pass        ·          (0 of 5)                                 │
│   Pending     ·          (1 of 5)  Aaliyah                        │
│                                                                    │
├───────────────────────────────────────────────────────────────────┤
│ VA SUBMISSION SUMMARY                                              │
│ "Joe responded interested at $80k asking. Acreage matches BB.     │
│  Land Insights shows clean tax + no flood. Need title check       │
│  before vote-to-buy. Recommend approving subject to clean         │
│  title."                                                           │
│ Requested next step: Vote on $58k offer authorization              │
│                                                                    │
│ FACTS                                                              │
│   APN 14-A · 5.2 ac · Zoned A-1 · Greene Co GA                    │
│   Market value $48k · Asking $80k                                  │
│                                                                    │
│ DECISION MATH                                                      │
│   Recommended offer: $58k                                          │
│   Max offer:         $66k                                          │
│   Spread at ask:     $14k                                          │
│   Diligence:         10 of 17 cleared                              │
│                                                                    │
│ [view full diligence ▾]   [view conversation thread ▾]   [history]│
└───────────────────────────────────────────────────────────────────┘
```

**Differences from VA view of the same card:**

| Element | VA view | Member view |
|---|---|---|
| Top of expanded card | Facts + diligence | **Vote UI + tally** (hero) |
| Form fields | Editable | **Read-only** (members don't edit VA submissions) |
| Comments | Free notes | **Threaded vote comments** visible to all members |
| Diligence detail | Always expanded | Collapsed under "view full diligence" toggle |
| Actions | Open Packet / Build Offer / Pass | **Submit Vote** is primary; no edit/build buttons |
| Conversation | Inbox center pane access | Hidden behind "view conversation thread" toggle |
| Cost data | Hidden (per privacy rule) | Visible (member is payer) |

**Vote tally:**
- Real-time as members vote
- "Pending" shows by name who hasn't voted yet (creates social accountability)
- Decision threshold from your OA (majority? unanimous? per OA majority-aligned vs. deal-structure draft)
- When threshold met, status flips to "Approved" or "Passed" automatically and triggers next-step notifications

### 13.6 How the badges render in the Inbox

The bulk SMS recipient preview from wireframe 3.2 uses these card primitives too. Each preview row is a State A queue row (compact) + a tooltip showing the lead's State B card on hover. Same component, different rendering size.



| Current location | New location after PRs |
|---|---|
| `src/app/va/page.tsx` (the monolith) | `src/app/va/page.tsx` + `src/app/va/_components/Inbox.tsx`, `Home.tsx`, `Lists.tsx`, `DealPacket.tsx`, `DailyBrief.tsx` (PR 3 cleanup) |
| `src/app/opportunity/page.tsx` | Redirect to `/lead/{id}` (PR 3) |
| `src/lib/land-leads.ts` | Renamed to `src/lib/properties.ts`; new `src/lib/leads.ts` (PR 2) |
| Bulk SMS in Lists tab | Moves to Inbox toolbar + List Detail page (PR 1, PR 3) |
| `SellerCommandCenter` component | Becomes the right pane of the Inbox + the Conversation tab of Lead Page (PR 3) |
| Today's `/operations` VA cost view | Untouched (member-facing payroll review stays) |

---

## Appendix B — Glossary

- **Lead** — one person (or entity, like an LLC) who may own one or many properties. Conversations are with leads.
- **Property** — one parcel/asset. Has its own stage, buy-box match, and diligence checklist. Owned by a lead.
- **List** — a source batch upload. Immutable. The static record of "what came in on this CSV."
- **Audience** — a filter / query that returns leads. Reusable. Re-evaluates on each use.
- **Campaign** — one message + one audience + one schedule + send results. Immutable after send.
- **Buy Box** — a member's investment criteria (county, price, acreage). A property either matches or doesn't.
- **Diligence** — the 4-section Investment Criteria checklist per property.
- **Sakari** — the SMS provider. Handles STOP keyword and opt-out tracking.
- **Communication event** — one inbound or outbound SMS, attached to a lead and (optionally) a property and (optionally) a campaign.

---

*End of plan.*
