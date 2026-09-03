-- RidgePoint Remodel Clock: mark a workday as Off.
-- Run upgrade_past_pay_period_admin.sql first if you have not already,
-- then run this file once in Supabase SQL Editor.

create table if not exists public.time_off_days (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  status text not null default 'off' check (status = 'off'),
  created_at timestamptz not null default now(),
  unique (employee_id, day)
);

alter table public.time_off_days enable row level security;
grant select, insert, update, delete on public.time_off_days to authenticated;

drop policy if exists "users can see their off days" on public.time_off_days;
drop policy if exists "users can add current off days" on public.time_off_days;
drop policy if exists "users can update current off days" on public.time_off_days;
drop policy if exists "users can delete current off days" on public.time_off_days;

create policy "users can see their off days" on public.time_off_days
  for select to authenticated
  using (company_id = public.current_company_id() and employee_id = auth.uid());

create policy "users can add current off days" on public.time_off_days
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and employee_id = auth.uid()
    and (public.current_user_is_owner() or day >= public.current_pay_period_start())
  );

create policy "users can update current off days" on public.time_off_days
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and employee_id = auth.uid()
    and (public.current_user_is_owner() or day >= public.current_pay_period_start())
  )
  with check (
    company_id = public.current_company_id()
    and employee_id = auth.uid()
    and (public.current_user_is_owner() or day >= public.current_pay_period_start())
  );

create policy "users can delete current off days" on public.time_off_days
  for delete to authenticated
  using (
    company_id = public.current_company_id()
    and employee_id = auth.uid()
    and (public.current_user_is_owner() or day >= public.current_pay_period_start())
  );
