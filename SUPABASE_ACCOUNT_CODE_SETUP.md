# One-time email code for account changes

The Account button in the app verifies the user's existing email before it lets them change their sign-in email or password.

## One-time Supabase SQL

Run `supabase/upgrade_account_settings.sql` in Supabase Dashboard > SQL Editor.

## Make the recovery email send a code

1. In Supabase, open **Authentication > Email Templates**.
2. Choose **Reset Password**.
3. Replace the email body with this:

```html
<h2>Your RidgePoint verification code</h2>
<p>Enter this one-time code in Jobs &amp; Clock to update your account:</p>
<h1 style="letter-spacing: 4px;">{{ .Token }}</h1>
<p>If you did not request this code, you can safely ignore this email.</p>
```

4. Save the template.

Use `{{ .Token }}` exactly as shown. It tells Supabase to send a one-time code instead of its usual reset-password link.

When a user changes their sign-in email, Supabase may send a separate confirmation email to the new address before the new email can be used for sign-in.
