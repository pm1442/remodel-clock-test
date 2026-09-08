# Account recovery links

The Account button sends Supabase's normal secure, single-use reset link to the user's existing email. Opening that link returns the user to the app and unlocks their email, password, and display-name updates.

## One-time Supabase SQL

Run `supabase/upgrade_account_settings.sql` in Supabase Dashboard > SQL Editor.

## URL Configuration

1. In Supabase, open **Authentication > URL Configuration**.
2. Set **Site URL** to your production Vercel app address, such as `https://remodel-clock.vercel.app`.
3. Add that exact address under **Redirect URLs** too.
4. Save.

No custom SMTP or email-template editing is needed. Supabase's default Reset Password email is used.

When a user changes their sign-in email, Supabase may send a separate confirmation email to the new address before the new email can be used for sign-in.
