# VA QA Testing Instructions

## Purpose

Today is a controlled test of the Meridian VA workflow. Use only the test list and member phone numbers provided by the team. Do not upload or text a real seller list during this test.

## Test File

Use this CSV:

`VA_QA_5_Property_Bulk_SMS_Test.csv`

This file contains 5 test property records. The phone numbers are team member numbers so replies and calls can be tested safely.

## Exact Test Contacts

The uploaded QA list should contain these five member test numbers:

- Courtney Mosely: `9126753440`
- Aaliyah Thomas: `5138018036`
- Raquel Twine: `4046687764`
- Odessa Patterson: `7706097994`
- Tiffany Stallworth: `3106547985`

If the uploaded list shows different numbers, stop before sending texts.

## Exact Message Scripts

Use this as the bulk SMS message:

```text
QA TEST from Meridian: testing our VA bulk SMS workflow for {{primary_property_address}}. Please reply RECEIVED - your name.
```

Each member should reply with:

```text
RECEIVED - [their name]
```

Example replies:

```text
RECEIVED - Courtney
RECEIVED - Aaliyah
RECEIVED - Raquel
RECEIVED - Odessa
RECEIVED - Tiffany
```

Use this short call script:

```text
Hi, this is a Meridian QA test call. I am confirming that the VA call workflow connects, logs the call, and updates the lead activity. No real seller outreach is happening.
```

Use this call note after the call:

```text
QA call completed. Audio connected, member answered, and call outcome logged.
```

Use this internal lead note:

```text
QA note: verified lead record opens, property details display, and activity history saves.
```

Use this task comment:

```text
QA task update: I opened this assigned task, confirmed the record link/status controls work, and am updating it as part of the VA workflow test.
```

Use this daily brief summary:

```text
Completed QA workflow test: uploaded 5-record QA list, ran bulk SMS test, reviewed replies, updated one lead record, tested call workflow, and updated assigned tasks.
```

## Before You Start

1. Log in to the Meridian portal.
2. Open the VA desk.
3. Confirm you can see:
   - the VA work queue;
   - list upload area;
   - contact queue;
   - SMS tools;
   - call button;
   - time clock;
   - daily brief section.
4. Clock in before beginning the test.

If anything is missing or you see an error, stop and report the issue before continuing.

## Test 1: Upload The QA List

1. Go to the list/upload area in the VA desk.
2. Click **Upload List** or **Choose CSV**.
3. Upload `VA_QA_5_Property_Bulk_SMS_Test.csv`.
4. Set the source/list name to:

`QA VA Bulk SMS Test`

5. Review the preview screen.
6. Confirm the system detects:
   - 5 property rows;
   - owner names;
   - property addresses;
   - parcel/APN values;
   - phone numbers;
   - mobile phone type;
   - no DNC/state DNC/litigator blocks.
7. Save/import the list.

Pass check:

- The list saves successfully.
- The 5 records appear in the VA list/lead queue.
- Each record has a phone number.

If any record is excluded as duplicate, DNC, no phone, or blocked, write down which record and what reason the system gives.

## Test 2: Bulk Text The QA List

1. Open the bulk text/campaign send workflow.
2. Select the uploaded QA list as the audience.
3. Confirm exactly 5 records are considered.
4. Review the compliance screen.
5. Confirm the eligible count matches what the system allows.

Use this test message:

```text
QA TEST from Meridian: testing our VA bulk SMS workflow for {{primary_property_address}}. Please reply RECEIVED - your name.
```

6. Preview the message before sending.
7. Check that the preview includes the correct property address for each contact.
8. Send the bulk text only to the eligible QA contacts.

Pass check:

- The send completes without an error.
- The sent count matches the eligible count.
- Each sent record shows outbound SMS activity.
- The daily brief outreach count updates or can be updated manually.

Do not send multiple bulk tests unless an admin asks you to.

## Test 3: Confirm Replies

Ask each member who received a text to reply:

```text
RECEIVED - [their name]
```

Then check the contact queue.

Pass check:

- Replies appear in the contact queue or conversation panel.
- Each reply is connected to the correct lead/phone number.
- The conversation history shows both outbound and inbound SMS.
- Unread replies can be opened and reviewed.

If a reply appears unmatched, do not delete it. Note the phone number and report it.

Expected reply tracking:

- Courtney should reply from `9126753440`.
- Aaliyah should reply from `5138018036`.
- Raquel should reply from `4046687764`.
- Odessa should reply from `7706097994`.
- Tiffany should reply from `3106547985`.

## Test 4: Single Lead Work

Pick one QA lead from the uploaded list.

1. Open the lead record.
2. Review the property details.
3. Add an internal note:

```text
QA note: verified lead record opens and activity history saves.
```

4. Set one follow-up date for tomorrow.
5. Change the disposition/status to **Follow Up** if available. If Follow Up is not available, use the closest test outcome and write down what option you selected.

Pass check:

- The note appears in the activity history.
- The status/disposition saves.
- The follow-up date saves.
- The record remains searchable by owner, phone, parcel, or address.

## Test 5: Call Workflow

Pick one QA lead whose phone belongs to a member who is ready to answer.

1. Use the call button from the lead/contact record.
2. Read this script:

```text
Hi, this is a Meridian QA test call. I am confirming that the VA call workflow connects, logs the call, and updates the lead activity. No real seller outreach is happening.
```

3. Complete the short test call.
4. Log the call outcome as **Called**, **Completed**, or the closest available successful call outcome.
5. Add this call note:

```text
QA call completed. Audio connected, member answered, and call outcome logged.
```

Pass check:

- The call connects.
- The lead/contact history shows the call or call note.
- The daily brief call count updates or can be updated manually.

If the call button is disabled, write down the disabled reason shown by the system.

Optional voicemail test:

1. Pick a member who will not answer.
2. Place a call.
3. Log the outcome as **Left Voicemail**.
4. Add this note:

```text
QA voicemail test. Call reached voicemail or no answer, and voicemail outcome was logged.
```

Pass check:

- The call attempt saves.
- The voicemail/no-answer outcome appears in the activity history.
- The call count updates or can be updated manually.

## Test 6: Admin-Assigned Tasks

Open the assigned task area.

For each test task assigned to you:

1. Open the task.
2. Mark one task as started/in progress.
3. Add this comment:

```text
QA task update: I opened this assigned task, confirmed the record link/status controls work, and am updating it as part of the VA workflow test.
```

4. Mark one task done.
5. Mark one task blocked only if there is a real blocker to report.

Pass check:

- Task status changes save.
- Comments save to task history.
- Completed tasks count toward the daily brief.
- Blocked tasks show the blocker reason.

## Test 7: Daily Brief

At the end of the test:

1. Open the daily brief section.
2. Confirm the system has captured or allows you to enter:
   - hours worked;
   - leads uploaded/updated;
   - outreach sent;
   - seller/member replies;
   - calls completed;
   - VA tasks completed;
   - blockers.
3. In activities completed, write a short summary:

```text
Completed QA workflow test: uploaded 5-record QA list, ran bulk SMS test, reviewed replies, updated one lead record, tested call workflow, and updated assigned tasks.
```

4. If there were no blockers, write:

```text
No blockers from my side. Waiting on admin review of QA results.
```

5. If anything failed, write the exact error or what was confusing.
6. Submit the daily brief.
7. Clock out.

Pass check:

- Daily brief submits successfully.
- Clock-out saves.
- Admin/member can see the brief for review.

## What To Report Back

Send the team a short report with:

- whether upload worked;
- how many records were eligible for bulk SMS;
- how many texts sent;
- which replies came in;
- whether calls worked;
- which tasks were completed or blocked;
- any error messages;
- screenshots of any failed or confusing screens.

## Stop Conditions

Stop and ask an admin before continuing if:

- the audience is larger than 5 records;
- the system shows real seller numbers instead of member numbers;
- the CSV imports with unexpected DNC/duplicate/compliance blocks;
- the send screen does not show the correct QA list;
- the system asks you to confirm a real campaign or real seller outreach.
