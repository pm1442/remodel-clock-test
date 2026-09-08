-- RidgePoint Remodel Clock: job receipts
-- Run once in Supabase Dashboard > SQL Editor before using the Receipts tab.

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete restrict,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  file_size bigint not null check (file_size >= 0 and file_size <= 20971520),
  created_at timestamptz not null default now()
);

alter table public.receipts enable row level security;
grant select, insert on public.receipts to authenticated;

drop policy if exists "members can see company receipts" on public.receipts;
drop policy if exists "members can add company receipts" on public.receipts;
create policy "members can see company receipts" on public.receipts
  for select to authenticated using (company_id = public.current_company_id());
create policy "members can add company receipts" on public.receipts
  for insert to authenticated with check (
    company_id = public.current_company_id()
    and employee_id = auth.uid()
  );

create index if not exists receipts_company_created_idx
  on public.receipts(company_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit)
values ('receipts', 'receipts', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "members can view receipt files" on storage.objects;
drop policy if exists "members can upload receipt files" on storage.objects;
create policy "members can view receipt files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
create policy "members can upload receipt files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
