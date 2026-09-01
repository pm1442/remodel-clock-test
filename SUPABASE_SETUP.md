# Put Remodel Clock live with Supabase

This guide connects the app to one shared RidgePoint Remodeling workspace. It uses Supabase for employee sign-in and live shared jobs and time entries.

## 1. Create the project

1. Go to [Supabase](https://supabase.com/dashboard) and create a new project.
2. Name it `ridgepoint-remodeling` and choose the region nearest your crew.
3. Save the database password somewhere safe. Do not put it in the app.

## 2. Add the database tables and security

1. In the new project, open **SQL Editor** then choose **New query**.
2. Open [schema.sql](supabase/schema.sql) in this project, copy all of it, paste it into the editor, and click **Run**.
3. Check **Table Editor**. You should see `companies`, `profiles`, `jobs`, and `time_entries`.

## 3. Create the RidgePoint workspace

1. In Supabase, open **Authentication > Users** and click **Add user**.
2. Create your owner account with email and password.
3. Back in **SQL Editor**, run the statement below, replacing values with your company name and the new user's UUID from Authentication > Users.

```sql
insert into public.companies (name) values ('RidgePoint Remodeling') returning id;
-- Copy the returned id, then run:
insert into public.profiles (id, company_id, full_name, role)
values ('OWNER-USER-UUID', 'COMPANY-UUID', 'Your Name', 'owner');
```

4. Add each employee in **Authentication > Users**, then run an `insert into public.profiles` statement for each, using the same company UUID and `employee` for the role.

## 4. Give the app its safe public credentials

1. In Supabase, go to **Project Settings > API Keys**.
2. Copy the project URL and the **publishable/anon** key. Never use a `service_role` key in the mobile app.
3. In the app folder, copy `.env.example` to a new file named `.env`.
4. Paste the URL and publishable key into `.env`.
5. Keep `.env` out of Git. It is already intended to stay local.

## 5. Install and run

```powershell
npm install
npx expo start
```

Use Expo Go on a phone to test. Later, create an App Store build with EAS Build.

## 6. Turn the app logic live

The next implementation pass replaces the sample data in `App.tsx` with calls to `src/lib/supabase.ts`, adds email/password sign-in, and enables realtime job updates. Do this only after steps 1-5 work, so credentials and access rules can be tested safely.

## Pay-period rule

The app’s pay period starts at 12:00 AM Thursday and ends at 11:59 PM Wednesday, every two weeks. Store all clock times as timestamps and calculate pay periods on the server with the company timezone set to your local timezone.
