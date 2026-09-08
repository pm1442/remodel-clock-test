# Remodel Clock for RidgePoint Remodeling

A simple mobile-first job board and job-specific time clock.

## Included in the first app shell

- Color-coded pending jobs
- Add a job with customer and address
- Clock in and out against a selected job
- Adjust a submitted time entry
- Two-week Thursday-Wednesday timesheet view
- Owner timesheet switcher so Jason can review Philip's and Russel's hours from his own account
- RidgePoint colors: burgundy `#802931`, remodeling gray `#848484`, and white `#FFFFFF`

## Next production layer

Connect the app to Supabase for employee accounts and shared live data. Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) when you are ready.

## Owner setup

After Jason has an Auth user and a profile, run `supabase/make_jason_owner.sql` in the Supabase SQL Editor. Then run `supabase/upgrade_owner_timesheet_access.sql` once. Jason will see an **Owner view** selector at the top of the Timesheet tab.
