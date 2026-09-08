-- RidgePoint Remodel Clock: allow deletion of a job note.
-- Run once in Supabase Dashboard > SQL Editor.

grant delete on public.job_tasks to authenticated;

drop policy if exists "members can delete company tasks" on public.job_tasks;
create policy "members can delete company tasks" on public.job_tasks
  for delete to authenticated
  using (company_id = public.current_company_id());
