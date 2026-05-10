-- =============================================================================
-- Meridian VA operator access.
--
-- Adds a non-member operator login for the VA workspace. This does not add the
-- VA to MEMBERS, voting, capital tracking, or ownership/member profiles.
-- =============================================================================

insert into meridian_members (name, password, password_changed)
values ('Sophie / VA', 'meridian2026', false)
on conflict (name) do nothing;

