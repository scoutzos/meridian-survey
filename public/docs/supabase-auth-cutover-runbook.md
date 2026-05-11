# Supabase Auth Cutover Runbook

This is the safe cutover path from the current Meridian prototype login to Supabase Auth.

## Current State

- The app now supports Supabase Auth for any `meridian_members` row with `auth_email`.
- Users without `auth_email` still use the legacy password flow.
- The app still stores `meridian_user` locally after login because the existing pages use that value as the active Meridian identity.
- RLS-ready policies are staged in `migrations/037_work_routing_rls_readiness.sql`.

## Cutover Steps

1. Run the latest migrations through `040_supabase_auth_identity_bridge.sql`.
2. In Supabase Auth, create one Auth user per member and VA.
3. For each Auth user, set user metadata:

```json
{
  "member_name": "Courtney Mosely"
}
```

4. Populate `auth_email` in `meridian_members`.

```sql
update meridian_members
set auth_email = 'courtney@example.com'
where name = 'Courtney Mosely';

update meridian_members
set auth_email = 'sophie@example.com'
where name = 'Sophie / VA';
```

5. Test login for one member and Sophie before migrating everyone.
6. Verify member-to-VA task flows:

- Member creates task for Sophie / VA.
- Sophie sees task in VA Desk.
- Sophie marks blocked.
- Members see Operations Escalations.
- Member replies and task reopens.
- Sophie marks done.
- Daily brief counts completed task.

7. After every user is migrated, remove prototype anon policies.

Do this only after the authenticated policies have been verified.

```sql
drop policy if exists "action_items prototype anon read" on action_items;
drop policy if exists "action_items prototype anon write" on action_items;
drop policy if exists "meridian_notifications prototype anon read" on meridian_notifications;
drop policy if exists "meridian_notifications prototype anon write" on meridian_notifications;
drop policy if exists "action_item_events prototype anon read" on action_item_events;
drop policy if exists "action_item_events prototype anon write" on action_item_events;
```

8. Repeat prototype policy removal for other tables only after their Auth-aware policies exist and are tested.

## Do Not Do Yet

- Do not remove all prototype anon policies at once.
- Do not expose Supabase service-role keys in Vercel public environment variables.
- Do not create Auth users from client-side code.

## Completion Definition

This cutover is complete when every member and the VA can sign in through Supabase Auth, task routing still works, and prototype anon policies are removed from the work-routing tables.
