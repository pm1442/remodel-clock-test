-- RidgePoint Remodel Clock: preserve custom lunch ranges on time entries.
-- Run once in Supabase SQL Editor before deploying this version.

alter table public.time_entries
  add column if not exists break_start time,
  add column if not exists break_end time;

alter table public.time_entries
  drop constraint if exists time_entries_break_range_valid;

alter table public.time_entries
  add constraint time_entries_break_range_valid
  check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null and break_end > break_start)
  );
