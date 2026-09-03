-- RidgePoint Remodel Clock: allow safe time-entry deletion.
-- Run once in Supabase SQL Editor before deploying this version.

grant delete on public.time_entries to authenticated;

drop policy if exists "owners or current period time deletion" on public.time_entries;
create policy "owners or current period time deletion" on public.time_entries
  for delete to authenticated
  using (
    company_id = public.current_company_id()
    and (public.current_user_is_owner() or clock_in::date >= public.current_pay_period_start())
  );
