-- RidgePoint Remodel Clock: pause / resume support
-- Run once in Supabase SQL Editor before deploying this version.

alter table public.time_entries
  add column if not exists paused_at timestamptz;

alter table public.time_entries
  add column if not exists paused_seconds integer not null default 0;

alter table public.time_entries
  drop constraint if exists time_entries_paused_seconds_nonnegative;

alter table public.time_entries
  add constraint time_entries_paused_seconds_nonnegative
  check (paused_seconds >= 0);
