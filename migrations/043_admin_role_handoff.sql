-- Admin role handoff: Raquel is no longer an admin; Odessa is now an admin.
update tracker_member_profiles
set is_admin = false,
    updated_at = now()
where member_name = 'Raquel Twine';

update tracker_member_profiles
set is_admin = true,
    updated_at = now()
where member_name = 'Odessa Patterson';
