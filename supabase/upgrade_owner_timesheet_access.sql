-- RidgePoint Remodel Clock: owner timesheet access
-- Run once in Supabase Dashboard > SQL Editor after the other time-sheet upgrades.
-- This lets an owner view, add, edit, and remove time for any person in their company.

-- The normal employee policy still applies. This is an additional policy only for owners.
drop policy if exists "owners can add company time for crew" on public.time_entries;
create policy "owners can add company time for crew" on public.time_entries
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_is_owner()
  );

-- time_off_days is created by upgrade_off_days.sql.
drop policy if exists "owners can see company off days" on public.time_off_days;
drop policy if exists "owners can add company off days" on public.time_off_days;
drop policy if exists "owners can update company off days" on public.time_off_days;
drop policy if exists "owners can delete company off days" on public.time_off_days;

create policy "owners can see company off days" on public.time_off_days
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_is_owner()
  );

create policy "owners can add company off days" on public.time_off_days
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_is_owner()
  );

create policy "owners can update company off days" on public.time_off_days
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_is_owner()
  )
  with check (
    company_id = public.current_company_id()
    and public.current_user_is_owner()
  );

create policy "owners can delete company off days" on public.time_off_days
  for delete to authenticated
  using (
    company_id = public.current_company_id()
    and public.current_user_is_owner()
  );
