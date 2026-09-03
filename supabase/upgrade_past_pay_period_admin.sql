-- RidgePoint Remodel Clock: protect past pay periods
-- Run once in Supabase SQL Editor. Owners may edit any period;
-- employees may only add or adjust hours in the current pay period.

create or replace function public.current_user_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
$$;

create or replace function public.current_pay_period_start()
returns date language sql stable as $$
  with current_thursday as (
    select (current_date - ((extract(dow from current_date)::integer + 3) % 7))::date as value
  )
  select case
    when mod(floor((value - date '2026-08-20') / 7.0)::integer, 2) = 0 then value
    else value - 7
  end
  from current_thursday
$$;

drop policy if exists "members can add their own time" on public.time_entries;
create policy "members can add current time or owner any time" on public.time_entries
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and employee_id = auth.uid()
    and (public.current_user_is_owner() or clock_in::date >= public.current_pay_period_start())
  );

drop policy if exists "members can update company time" on public.time_entries;
create policy "owners or current period time updates" on public.time_entries
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and (public.current_user_is_owner() or clock_in::date >= public.current_pay_period_start())
  )
  with check (
    company_id = public.current_company_id()
    and (public.current_user_is_owner() or clock_in::date >= public.current_pay_period_start())
  );
