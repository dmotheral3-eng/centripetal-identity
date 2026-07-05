# Linking existing password users to SSO — operator guide

**Problem this solves.** Some users already have an email/password account on an
app's Supabase (e.g. Wes and Chay on the CWM cockpit). When we turn on
Google/Microsoft SSO, we want those people to tap the SSO button and land in
their *existing* account — same user id, same memberships, same data — not a
brand-new duplicate account.

The rule that makes this work: **identity is keyed by verified email.** As long
as the SSO identity's email matches the existing account's email, they resolve
to one user. The whole procedure below is about guaranteeing that match.

---

## The short version

1. Confirm the existing account's email is **verified**.
2. Enable Google + Microsoft providers with **"Link identities with the same
   email" ON** (Supabase Auth setting: *Confirm email* / account-linking).
3. Tell the user to sign in with the SSO button **using the same email address**
   as their password account.
4. Supabase attaches the new OAuth identity to the existing user row. Password
   still works as a fallback; nothing is deleted.

If email verification or linking is off, step 3 creates a **duplicate** instead
of linking. Do steps 1–2 first.

---

## Step 1 — Inventory the accounts to migrate

In the app's own Supabase → **Authentication → Users**, or via SQL:

```sql
-- who has a password identity and what email is on file
select u.id, u.email, u.email_confirmed_at,
       i.provider
from auth.users u
join auth.identities i on i.user_id = u.id
where i.provider = 'email'
order by u.email;
```

Note anyone whose `email_confirmed_at` is null — they must verify before linking,
or the link will silently fork into a second account.

## Step 2 — Turn on same-email account linking

In **Authentication → Providers**, enable **Google** and **Microsoft (Azure)**.
In **Authentication → Settings**, ensure:

- **Confirm email** is ON (identities only link when the email is verified).
- Automatic linking of identities that share a confirmed email is enabled.

This is a per-project setting. It lives on the app's own Supabase — there is no
central switch, consistent with the package invariants.

## Step 3 — Have the user sign in with SSO, same email

Send the user this, verbatim:

> Use the same email you already sign in with. Tap **Continue with Google** (or
> **Microsoft**) and pick the account on that address. You'll land in your
> existing workspace — nothing is reset.

The critical instruction is *same email*. If their Google login is on a personal
address different from their work account, they'll create a duplicate. Have them
use the matching address, or update their account email first (Step 5).

## Step 4 — Verify the link, not a fork

After they sign in, confirm the OAuth identity attached to the **same user id**:

```sql
select u.email, i.provider, i.created_at
from auth.users u
join auth.identities i on i.user_id = u.id
where u.email = 'person@work-email.com'
order by i.created_at;
```

You want **one** `user.id` with **two** identity rows (`email` + `google`/`azure`).
Two different user ids for the same person = a fork; fix with Step 5.

## Step 5 — Recovering from a mismatch / accidental duplicate

If a duplicate was created (different email on the SSO identity, or linking was
off at the time):

1. **Do not delete the original.** It holds the memberships and history.
2. If the SSO account is empty (just created), delete the *duplicate*, correct
   the setting/email, and have the user retry the link against the original.
3. If both accounts accrued data, re-point the newer account's
   `memberships`/owned rows to the original `user_id` before removing the
   duplicate. Take a backup first; this is a data move, not a UI action.

## Keep magic-link as the always-on fallback

Regardless of SSO state, `LoginSplash` keeps the magic-link email path. A user
who can't get SSO to cooperate can always request an email sign-in link to the
same address and reach the same account. Never remove that path during a
migration — it's the safety net.
