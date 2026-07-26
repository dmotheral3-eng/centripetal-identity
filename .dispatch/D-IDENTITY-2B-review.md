# D-IDENTITY-2B — review record: PR #2 (gate modes)

**PR:** #2 — *Finish v0.1: SOLO gate mode + unified checkAccess + origin-default redirect*
`finish-v0.1-gate-modes` → `main` · 4 files, +200/−9
**Merge:** squash, `6de6890847b7f49e0e150e9992347936e3d4a571`, 2026-07-26T16:50:41Z
**Head branch:** deleted
**Authority:** Tier-2 auth diff. Merge authority delegated by ruling `9d14963a`, conditional
on the three gates below. All three passed; merge executed under that delegation.

## Look-back — `git log --merges -8 origin/main`

```
01a4b8a Merge COS-336 — Dispatch Run Observer
64b26ca Merge COS-336 — checkout@v5 (node24) fleet-wide
96391da Merge COS-336 — exec output path from the action schema, not a search
83097af Merge revert of show_full_output (secret exposure in Actions logs)
1d29bad Merge COS-336 — enable show_full_output fleet-wide
157f3ad Merge COS-336 callback v2 — fleet-wide failure-detail reporting
76ee5ab Merge pull request #1 from dmotheral3-eng/phase-a-scaffold
```

Seven merges exist, not eight — repo history is short. Prior identity work is #1
(phase-a-scaffold: `LoginSplash` + membership client); everything since has been
dispatch-rail plumbing, not package code. No auth-surface merge between #1 and #2,
so this PR lands on the scaffold it was written against — no drift.

## Gate (a) — scope · **PASS**

Permitted surface: `src/gate.ts`, `checkAccess`/`isAllowedEmail` exports,
`LoginSplash.redirectTo` default, README/docs, sandbox.

| File | Change | In scope |
| --- | --- | --- |
| `src/gate.ts` | new, 114 lines — the two gate modes | yes |
| `src/index.ts` | +8 — re-exports `checkAccess`, `isAllowedEmail` + 5 types | yes |
| `src/LoginSplash.tsx` | +15/−9 — `redirectTo` optional, defaults to `window.location.origin` | yes |
| `README.md` | +72/−9 — auth-vs-authorization, both modes, 3-step import | yes |

- **No new dependencies.** `package.json` and `package-lock.json` untouched.
  The only non-doc imports added are `@supabase/supabase-js` (type-only, already a
  peer dep) and the local `./membership`.
- **No send paths.** No added `fetch`/`XMLHttpRequest`/`axios`/`sendBeacon`. The
  one send in the package is the pre-existing magic-link `signInWithOtp`; this PR
  only reroutes its `emailRedirectTo` to the resolved origin.
- **No telemetry.** No analytics/tracking/Sentry/PostHog/Segment primitives, no
  hardcoded URLs. Gate outcomes are returned to the caller as a `reason` string;
  nothing is emitted anywhere.

## Gate (b) — no hardcoded email addresses · **PASS**

Grep of added lines for email literals: **none found.** The SOLO allow-list is
app-supplied config — `SoloGate.allowedEmails: string[]`, passed in at the call
site. Both README snippets source it from the app's own env
(`import.meta.env.VITE_ALLOWED_EMAIL`), and the module states the invariant
twice ("this package hardcodes no one's email"). "Dave" and "MotherDesk" appear
only as prose examples of *when* to pick SOLO, never as a value.

## Gate (c) — both modes fail closed · **PASS**

Verified empirically, not just by reading: 16 runtime cases against the built
`dist/gate.js` with a stub Supabase client. **16/16 passed.**

Signed-out is rejected before mode dispatch, so it fails closed in both modes.

| Case | Mode | Result |
| --- | --- | --- |
| signed out, populated allow-list | SOLO | denied `not-signed-in` |
| signed in, **empty** allow-list (no config) | SOLO | denied `empty-allowlist` |
| signed in, whitespace-only allow-list | SOLO | denied `empty-allowlist` |
| signed in, email not on list | SOLO | denied `not-allowlisted` |
| user object carries no email | SOLO | denied `not-allowlisted` |
| `isAllowedEmail` with `[]` | SOLO | `false` |
| on list, differing case + padding | SOLO | allowed `ok` (normalization works) |
| signed out | MEMBERSHIP | denied `not-signed-in` |
| `is_tenant_member` → `false` | MEMBERSHIP | denied `not-a-member` |
| `is_tenant_member` → `null` | MEMBERSHIP | denied `not-a-member` |
| empty `tenant` (no config) | MEMBERSHIP | denied `not-a-member` |
| role gate, 0 matching rows | MEMBERSHIP | denied `not-a-member` |
| RPC errors → table-read fallback, 0 rows | MEMBERSHIP | denied `not-a-member` |
| `is_tenant_member` → `true` | MEMBERSHIP | allowed `ok` |
| role gate, 1 matching row | MEMBERSHIP | allowed `ok` |

The RPC path admits only on the strict identity `data === true`, so a missing,
null, or non-boolean RPC response denies. On a genuine transport error the
membership table read *throws* rather than returning `allowed: true` — no silent
admit, though callers should let that reject rather than catch-and-default.

## Build verification

Node v22.23.1 / npm 10.9.8.

- **PR branch** — `npm ci` (0 vulnerabilities, prepare-on-install builds) ·
  `npm run typecheck` exit 0 · `npm run build` exit 0 · `dist/gate.js` +
  `dist/gate.d.ts` emitted as claimed.
- **`main` after merge** (`6de6890`, clean `node_modules`/`dist`) —
  `npm ci` · `typecheck` · `build` all pass; all five modules emit JS + `.d.ts`.

## Observations (non-blocking, no gate affected)

1. **The PR's claimed "8/8 gate smoke-tests" are not in the repo.** The tests
   were real but ran outside version control, so nothing re-checks fail-closed
   behaviour on future edits. On the highest-consequence module in the package,
   that is worth committing. The 16 cases above were written fresh for this
   review and are likewise not committed — scope was review + merge, not adding
   a test suite. Say the word and they land under `sandbox/`.
2. **Extensionless relative imports in `dist`** (TS `Bundler` resolution) —
   already flagged by the author. Fine under Vite/Next; raw Node ESM cannot
   import `dist/` directly. Confirmed during this review: the smoke harness
   needed `./membership` rewritten to `./membership.js` to run under plain Node.
   No consumer impact today; it would bite a Node-side consumer.
3. **`redirectTo` resolves to `undefined` during SSR** — the default is guarded by
   `typeof window !== 'undefined'`, so on a server render it passes `undefined`
   to Supabase, which then falls back to the project's configured Site URL. Sane,
   and the sign-in handlers only run from a click, but an app that server-renders
   and expects a specific return path should still pass `redirectTo` explicitly.
