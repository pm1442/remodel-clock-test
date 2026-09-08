-- Run this AFTER creating the Jason auth user in Supabase Dashboard > Authentication > Users.
-- It finds Jason by email and adds or repairs his RidgePoint employee profile.
-- This assumes RidgePoint's owner profile is the only owner profile in this Supabase project.

insert into public.profiles (id, company_id, full_name, role)
select
  auth_user.id,
  owner_profile.company_id,
  'Jason',
  'employee'
from auth.users as auth_user
cross join (
  select company_id
  from public.profiles
  where role = 'owner'
  order by created_at
  limit 1
) as owner_profile
where lower(auth_user.email) = 'jason@ridgepointremodeling.com'
on conflict (id) do update
set company_id = excluded.company_id,
    full_name = excluded.full_name,
    role = excluded.role;

-- Check the result. You should see Jason with the role employee.
select auth_user.email, profile.full_name, profile.role, profile.company_id
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where lower(auth_user.email) = 'jason@ridgepointremodeling.com';
