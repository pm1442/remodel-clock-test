-- RidgePoint Remodel Clock: allow deletion of receipt and job-note attachments.
-- Run once in Supabase Dashboard > SQL Editor.

grant delete on public.receipts to authenticated;
grant delete on public.job_task_attachments to authenticated;

drop policy if exists "members can delete company receipts" on public.receipts;
create policy "members can delete company receipts" on public.receipts
  for delete to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "members can delete company task attachments" on public.job_task_attachments;
create policy "members can delete company task attachments" on public.job_task_attachments
  for delete to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "members can delete receipt files" on storage.objects;
create policy "members can delete receipt files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists "members can delete task attachment files" on storage.objects;
create policy "members can delete task attachment files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
