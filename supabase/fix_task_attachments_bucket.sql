-- RidgePoint Remodel Clock: repair the Jobs > Notes file bucket.
-- Run once in Supabase Dashboard > SQL Editor if task photos or files will not upload.

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 20971520)
on conflict (id) do update
  set public = false,
      file_size_limit = 20971520;

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
