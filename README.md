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
| `getMemberships(supabase, userId)` | All active memberships for a user, from the app-local DB. |
| `hasMembership(supabase, { tenant, role? })` | Membership/role gate via the `is_tenant_member` read pattern. |
| `Pill`, `tokens` | Status-pill component and the Token Set B design tokens, exported for reuse. |

## Constraints (by construction)

- **Zero runtime dependency on any central service.** The only network calls the
  package makes are to the `supabaseClient` you pass in — your app's own project.
- **Peer dependencies only:** `react` (>=18) and `@supabase/supabase-js` (>=2).
  Your app already has both.
- **No infrastructure vendor names in the UI (P#62).** The only provider names
  shown are the identity providers the user must choose between; they are
  overridable via `providerLabels`.

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

Gate a route on membership:

```ts
import { hasMembership } from '@centripetal/identity';

const ok = await hasMembership(supabase, { tenant: 'cw-mineral', role: 'admin' });
```

### 5. Migrate existing password users

See [link-by-email.md](./link-by-email.md) for the operator procedure that links
an existing email/password account to a Google/Microsoft identity without
account loss (the Wes/Chay case on the CWM cockpit).

## `LoginSplash` props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `supabaseClient` | `SupabaseClient` | — | The app's own client. All auth calls target this. |
| `redirectTo` | `string` | — | Absolute return URL after auth. |
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
