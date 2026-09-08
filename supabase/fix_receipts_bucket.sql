-- RidgePoint Remodel Clock: repair the Receipts storage bucket.
-- Run this once in Supabase Dashboard > SQL Editor if the app says "Bucket not found".

insert into storage.buckets (id, name, public, file_size_limit)
values ('receipts', 'receipts', false, 20971520)
on conflict (id) do update
  set public = false,
      file_size_limit = 20971520;

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
