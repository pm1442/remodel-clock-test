-- RidgePoint Remodeling: initial shared workspace schema
-- Run once in Supabase Dashboard > SQL Editor.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  role text not null default 'employee' check (role in ('owner', 'employee')),
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  client_name text not null,
  address text,
  color text not null default 'green' check (color in ('green', 'blue', 'orange', 'red')),
  status text not null default 'Ready to start',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  clock_in timestamptz not null,
  clock_out timestamptz,
  note text,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint clock_out_after_clock_in check (clock_out is null or clock_out >= clock_in)
);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.time_entries enable row level security;

create function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create policy "members can see their company" on public.companies
  for select using (id = public.current_company_id());
create policy "members can see company profiles" on public.profiles
  for select using (company_id = public.current_company_id());
create policy "members can see company jobs" on public.jobs
  for select using (company_id = public.current_company_id());
create policy "members can add company jobs" on public.jobs
  for insert with check (company_id = public.current_company_id());
create policy "members can update company jobs" on public.jobs
  for update using (company_id = public.current_company_id());
create policy "members can see company time" on public.time_entries
  for select using (company_id = public.current_company_id());
create policy "members can add their own time" on public.time_entries
  for insert with check (company_id = public.current_company_id() and employee_id = auth.uid());
create policy "members can update company time" on public.time_entries
  for update using (company_id = public.current_company_id());

create index jobs_company_active_idx on public.jobs(company_id, archived, created_at desc);
create index time_entries_company_clock_in_idx on public.time_entries(company_id, clock_in desc);
