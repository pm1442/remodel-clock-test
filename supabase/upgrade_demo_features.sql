-- Run once in Supabase SQL Editor for the RidgePoint demo features.

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  color text not null default 'burgundy' check (color in ('burgundy', 'blue', 'green', 'orange', 'purple')),
  created_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.job_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  title text not null,
  crew_member_id uuid references public.crew_members(id) on delete set null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.job_tasks add column if not exists suggested_person text not null default '' check (suggested_person in ('', 'Philip', 'Jason', 'Russel'));
alter table public.job_tasks add column if not exists details text not null default '';

alter table public.crew_members enable row level security;
alter table public.job_tasks enable row level security;

grant select, insert, update on public.crew_members to authenticated;
grant select, insert, update on public.job_tasks to authenticated;

create policy "members can see company crew" on public.crew_members for select using (company_id = public.current_company_id());
create policy "members can add company crew" on public.crew_members for insert with check (company_id = public.current_company_id());
create policy "members can update company crew" on public.crew_members for update using (company_id = public.current_company_id());
create policy "members can see company tasks" on public.job_tasks for select using (company_id = public.current_company_id());
create policy "members can add company tasks" on public.job_tasks for insert with check (company_id = public.current_company_id());
create policy "members can update company tasks" on public.job_tasks for update using (company_id = public.current_company_id());

create index if not exists job_tasks_job_idx on public.job_tasks(job_id, completed, created_at);

-- Replace COMPANY-UUID with the id from public.companies.
-- insert into public.crew_members (company_id, name, color) values
-- ('COMPANY-UUID', 'Philip', 'burgundy'),
-- ('COMPANY-UUID', 'Jason', 'blue'),
-- ('COMPANY-UUID', 'Russel', 'green')
-- on conflict (company_id, name) do nothing;
