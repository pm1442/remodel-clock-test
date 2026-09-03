-- RidgePoint Remodel Clock: task photos and files
-- Run once in Supabase SQL Editor before deploying this version.

create table if not exists public.job_task_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.job_tasks(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  file_size bigint not null check (file_size >= 0 and file_size <= 20971520),
  created_at timestamptz not null default now()
);

alter table public.job_task_attachments enable row level security;
grant select, insert on public.job_task_attachments to authenticated;

drop policy if exists "members can see company task attachments" on public.job_task_attachments;
drop policy if exists "members can add company task attachments" on public.job_task_attachments;
create policy "members can see company task attachments" on public.job_task_attachments
  for select to authenticated using (company_id = public.current_company_id());
create policy "members can add company task attachments" on public.job_task_attachments
  for insert to authenticated with check (company_id = public.current_company_id());

create index if not exists job_task_attachments_task_idx
  on public.job_task_attachments(task_id, created_at);

-- Private bucket: the app creates short-lived links only when a signed-in user opens a file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "members can view task attachment files" on storage.objects;
drop policy if exists "members can upload task attachment files" on storage.objects;
create policy "members can view task attachment files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
create policy "members can upload task attachment files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
