# @centripetal/identity

Universal identity for every Centripetal app: one-tap SSO (Google + Microsoft),
one identity across many memberships, and a magic-link fallback — all running
against **each app's own Supabase**. This is the versioned package that lets the
whole fleet upgrade its login by bumping one dependency and redeploying.

## The two invariants

These are load-bearing. Every consumer inherits them by using this package:

> **no hosted runtime auth service**

> **hub never in the auth path**

Auth and memberships live on each app's sovereign Supabase (federated runtime).
The optional hub is a launcher only — it reads memberships to draw tiles and
hands off to each app's own auth. If the hub is down, nothing about signing in
to any app breaks.

## What's in v0.1

| Export | Purpose |
| --- | --- |
| `LoginSplash` | Sign-in surface: Google + Microsoft SSO buttons + magic-link email fallback. Light-editorial styling. |
| `checkAccess(supabase, gate)` | The **post-sign-in authorization gate**. Two modes — SOLO (email allow-list) or MEMBERSHIP (tenant/role). |
| `isAllowedEmail(supabase, emails)` | SOLO convenience wrapper — is the signed-in user's email in the list? |
| `getMemberships(supabase, userId)` | All active memberships for a user, from the app-local DB. |
| `hasMembership(supabase, { tenant, role? })` | Membership/role read via the `is_tenant_member` pattern (MEMBERSHIP mode's primitive). |
| `Pill`, `tokens` | Status-pill component and the Token Set B design tokens, exported for reuse. |

## Authentication vs. authorization

Two separate jobs, two separate exports:

- **`LoginSplash` authenticates** — proves *who* the user is (Google / Microsoft / magic link).
- **`checkAccess` authorizes** — decides whether that verified person may *enter this
  app*. You call it after sign-in, in your auth-callback route or a route guard.

The login door always works; the gate is the vault side and **fails closed**.

### The two gate modes — the app picks one

**SOLO** — a fixed allow-list of specific emails. For single-operator internal tools
(e.g. MotherDesk) where "membership" is just "is it him." The allow-list is **your**
config; this package hardcodes no one's email.

```ts
import { checkAccess } from '@centripetal/identity';

const { allowed } = await checkAccess(supabase, {
  mode: 'solo',
  allowedEmails: [import.meta.env.VITE_ALLOWED_EMAIL], // supplied by the app
});
if (!allowed) redirectToSignedOut();
```

**MEMBERSHIP** — the `is_tenant_member` tenant/role pattern for multi-user apps.

```ts
const { allowed } = await checkAccess(supabase, {
  mode: 'membership',
  tenant: 'cw-mineral',
  role: 'admin', // optional
});
```

`checkAccess` returns `{ allowed, email, reason }` — `reason` is one of `ok`,
`not-signed-in`, `not-allowlisted`, `not-a-member`, `empty-allowlist`, useful for
logging and friendly denial screens.

## Constraints (by construction)

- **Zero runtime dependency on any central service.** The only network calls the
  package makes are to the `supabaseClient` you pass in — your app's own project.
- **Peer dependencies only:** `react` (>=18) and `@supabase/supabase-js` (>=2).
  Your app already has both.
- **No infrastructure vendor names in the UI (P#62).** The only provider names
  shown are the identity providers the user must choose between; they are
  overridable via `providerLabels`.

## Import in three steps

1. **Install** — `npm install github:dmotheral3-eng/centripetal-identity#v0.1.0`
   (builds itself on install; peer-deps `react` + `@supabase/supabase-js` you already have).
2. **Wrap your login route** — render `<LoginSplash supabaseClient={supabase} appName="…" />`
   (`redirectTo` defaults to the current origin).
3. **Gate the app** — after sign-in, call `checkAccess(supabase, gate)` with either
   `{ mode: 'solo', allowedEmails: [...] }` **or** `{ mode: 'membership', tenant, role? }`,
   and bounce anyone whose `allowed` is `false`.

The rest of this section expands each step.

## Per-app adoption

### 1. Install as a git dependency

```bash
npm install github:dmotheral3-eng/centripetal-identity
```

Pin a tag or commit for reproducible deploys, e.g.
`github:dmotheral3-eng/centripetal-identity#v0.1.0`. The package builds itself on
install (`prepare`), so no extra build step is required in your app.

### 2. Enable the providers on your Supabase project

In the app's own Supabase dashboard → **Authentication → Providers**, enable
**Google** and **Microsoft (Azure)**, and add your app's redirect URL to the
allow-list. No code in this package points at any project but yours.

### 3. Confirm the membership read pattern

The membership client expects an app-local `memberships` table
(`user_id, tenant, role, status`) and/or an `is_tenant_member(tenant text)` RPC
that reads it under RLS. This supersedes legacy per-app boolean flags on touch.

### 4. Drop in the component

```tsx
import { createClient } from '@supabase/supabase-js';
import { LoginSplash } from '@centripetal/identity';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export default function SignInPage() {
  return (
    <LoginSplash
      supabaseClient={supabase}
      appName="Mineral"
      redirectTo={`${window.location.origin}/auth/callback`}
    />
  );
}
```

Gate the app on entry — pick SOLO or MEMBERSHIP (see
[the two gate modes](#the-two-gate-modes--the-app-picks-one)):

```ts
import { checkAccess } from '@centripetal/identity';

// SOLO — Dave-only internal tool
const { allowed } = await checkAccess(supabase, {
  mode: 'solo',
  allowedEmails: [import.meta.env.VITE_ALLOWED_EMAIL],
});

// …or MEMBERSHIP — multi-user app
// const { allowed } = await checkAccess(supabase, { mode: 'membership', tenant: 'cw-mineral', role: 'admin' });
```

### 5. Migrate existing password users

See [link-by-email.md](./link-by-email.md) for the operator procedure that links
an existing email/password account to a Google/Microsoft identity without
account loss (the Wes/Chay case on the CWM cockpit).

## `LoginSplash` props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `supabaseClient` | `SupabaseClient` | — | The app's own client. All auth calls target this. |
| `redirectTo` | `string` | current origin | Absolute return URL after auth. Defaults to `window.location.origin`. |
| `appName` | `string` | — | Shown in the headline. |
| `providers` | `('google' \| 'azure')[]` | both | Which SSO buttons to show. |
| `tagline` | `string` | `"Sign in to continue."` | Line under the headline. |
| `providerLabels` | `Partial<Record<provider, string>>` | — | Override button labels. |
| `injectFonts` | `boolean` | `true` | Set `false` if the host app already loads Fraunces / IBM Plex. |

## Local sandbox

A bare Vite sandbox lives in [`sandbox/`](./sandbox) to render the component in
isolation:

```bash
cd sandbox
npm install
npm run dev
```

It renders `LoginSplash` against a stub Supabase client, so the surface works
with no real project configured.
