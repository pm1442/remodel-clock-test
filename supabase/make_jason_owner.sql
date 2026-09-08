-- Run once in Supabase Dashboard > SQL Editor.
-- Gives Jason owner access so he can review and update every crew member's timesheet.

update public.profiles as profile
set role = 'owner'
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = 'jason@ridgepointremodeling.com';

select auth_user.email, profile.full_name, profile.role
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where lower(auth_user.email) = 'jason@ridgepointremodeling.com';
