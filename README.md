# RidgePoint Remodel Clock - web test

A small browser-based test for shared pending jobs and job-specific hourly time clock entries.

## Stack

- GitHub stores the code.
- Vercel hosts the website.
- Supabase holds users, jobs, and time data.

## Vercel environment variables

Add both variables in the Vercel project, for Production, Preview, and Development:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-Supabase-publishable-key
```

These are public browser configuration values. Do not add the Supabase service-role/secret key.

## Run locally, optional

```powershell
npm install
npm run dev
```
