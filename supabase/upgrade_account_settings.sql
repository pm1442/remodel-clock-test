-- RidgePoint Remodel Clock: allow each signed-in person to update only their own display name.
-- Run once in Supabase Dashboard > SQL Editor.

grant update on public.profiles to authenticated;

drop policy if exists "members can update their own profile" on public.profiles;
create policy "members can update their own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and company_id = public.current_company_id());
