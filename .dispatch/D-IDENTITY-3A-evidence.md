# D-IDENTITY-3A — evidence: gate harness on identity.centripetal-ai.com

**Branch:** `claude/2c63acad` → `main` · sandbox only, package `src/` untouched.

## What changed and why

`identity.centripetal-ai.com` served only `LoginSplash` — the half of the package
that *lets people in*. `checkAccess`, the half that *refuses* people, had never
been observed running in production, on a package seven consumer apps depend on.
The sandbox now runs the gate live and publishes the verdicts.

| File | Change |
| --- | --- |
| `sandbox/src/App.tsx` | keeps the LoginSplash demo, adds the `<GateHarness />` panel |
| `sandbox/src/GateHarness.tsx` | new — runs the table on mount, renders the board, publishes results |
| `sandbox/src/gateCases.ts` | new — the 23-case table (executable fail-closed contract) |
| `sandbox/src/stubClient.ts` | `makeGateStubClient()` added — `auth.getUser`, `rpc`, thenable `from().select().eq()` chain. Existing `makeStubClient()` unchanged |
| `sandbox/vite.config.ts` | best-effort plugin: runs the same table in Node at build time and inlines the verdicts into `index.html` |
| `sandbox/package.json` | `@types/node` added to **devDependencies** (types only, zero deps) so `vite.config.ts` typechecks |
| `README.md` | documents the harness and the three probe surfaces |

## Case list — expected vs actual (every row, from the real runs)

Expected column is the case declaration; Actual/Reason are what the gate returned
in headless Chrome 150 against the built bundle. Build-time Node run agrees with
the browser run **per case** (verified by comparing the two JSON blocks).

| Case | Mode | Input | Expected | Actual | Reason | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `2B-01` | SOLO | user: null · allowedEmails: [operator@example.com] | `deny · not-signed-in` | `deny · not-signed-in` | `not-signed-in` | **PASS — denied** |
| `2B-02` | SOLO | user: operator@example.com · allowedEmails: [] | `deny · empty-allowlist` | `deny · empty-allowlist` | `empty-allowlist` | **PASS — denied** |
| `2B-03` | SOLO | user: operator@example.com · allowedEmails: ['   '] | `deny · empty-allowlist` | `deny · empty-allowlist` | `empty-allowlist` | **PASS — denied** |
| `2B-04` | SOLO | user: stranger@example.com · allowedEmails: [operator@example.com] | `deny · not-allowlisted` | `deny · not-allowlisted` | `not-allowlisted` | **PASS — denied** |
| `2B-05` | SOLO | user: { id } with no email · allowedEmails: [operator@example.com] | `deny · not-allowlisted` | `deny · not-allowlisted` | `not-allowlisted` | **PASS — denied** |
| `2B-06` | SOLO | isAllowedEmail(user: operator@example.com, []) | `deny · false` | `deny · false` | `false` | **PASS — denied** |
| `2B-07` | SOLO | user: operator@example.com · allowedEmails: ['  OPERATOR@Example.COM  '] | `allow · ok` | `allow · ok` | `ok` | **PASS — allowed** |
| `2B-16` | SOLO | isAllowedEmail(user: operator@example.com, [operator@example.com]) | `allow · true` | `allow · true` | `true` | **PASS — allowed** |
| `2B-08` | MEMBERSHIP | user: null · tenant: cw-mineral | `deny · not-signed-in` | `deny · not-signed-in` | `not-signed-in` | **PASS — denied** |
| `2B-09` | MEMBERSHIP | is_tenant_member → false · tenant: cw-mineral | `deny · not-a-member` | `deny · not-a-member` | `not-a-member` | **PASS — denied** |
| `2B-10` | MEMBERSHIP | is_tenant_member → null · tenant: cw-mineral | `deny · not-a-member` | `deny · not-a-member` | `not-a-member` | **PASS — denied** |
| `2B-11` | MEMBERSHIP | user: operator@example.com · tenant: '' (no config) | `deny · not-a-member` | `deny · not-a-member` | `not-a-member` | **PASS — denied** |
| `2B-12` | MEMBERSHIP | tenant: cw-mineral · role: admin · matching rows: 0 | `deny · not-a-member` | `deny · not-a-member` | `not-a-member` | **PASS — denied** |
| `2B-13` | MEMBERSHIP | RPC errors → table fallback · rows: 0 · tenant: cw-mineral | `deny · not-a-member` | `deny · not-a-member` | `not-a-member` | **PASS — denied** |
| `2B-14` | MEMBERSHIP | is_tenant_member → true · tenant: cw-mineral | `allow · ok` | `allow · ok` | `ok` | **PASS — allowed** |
| `2B-15` | MEMBERSHIP | tenant: cw-mineral · role: admin · matching rows: 1 | `allow · ok` | `allow · ok` | `ok` | **PASS — allowed** |
| `H-01` | SOLO | user: undefined · allowedEmails: [operator@example.com] | `deny · not-signed-in` | `deny · not-signed-in` | `not-signed-in` | **PASS — denied** |
| `H-02` | MEMBERSHIP | user: undefined · tenant: cw-mineral · is_tenant_member → true | `deny · not-signed-in` | `deny · not-signed-in` | `not-signed-in` | **PASS — denied** |
| `H-03` | SOLO | allowedEmails: [null, undefined] (malformed config) | `deny · empty-allowlist` | `deny · empty-allowlist` | `empty-allowlist` | **PASS — denied** |
| `H-04` | SOLO | user email: '   ' (malformed session) · allowedEmails: [operator@example.com] | `deny · not-allowlisted` | `deny · not-allowlisted` | `not-allowlisted` | **PASS — denied** |
| `H-05` | MEMBERSHIP | gate: { mode: 'not-a-mode' } (malformed gate object) | `deny · not-a-member` | `deny · not-a-member` | `not-a-member` | **PASS — denied** |
| `H-06` | MEMBERSHIP | RPC errors AND table read errors · tenant: cw-mineral | `throw · Error: hasMembership failed` | `throw · Error: hasMembership failed: network unreachable` | `Error: hasMembership failed: network unreachable` | **PASS — raised, no admit** |
| `H-07` | SOLO | allowedEmails: [42] (non-string entry) | `throw · TypeError` | `throw · TypeError: (e ?? "").trim is not a function` | `TypeError: (e ?? "").trim is not a function` | **PASS — raised, no admit** |

**total 23 · passed 23 · failed 0.**

### Provenance of the case list

`2B-01`…`2B-15` are the cases tabulated under gate (c) of
`.dispatch/D-IDENTITY-2B-review.md`, reused verbatim so the harness and that
record assert the same thing. That review reports **16/16** but prints 15 rows;
`2B-16` here is the missing counterpart reconstructed as the allow-side twin of
`2B-06` (`isAllowedEmail` with a populated list). Flagged rather than presented
as recovered — the original 16th case is not in the repo.

`H-01`…`H-07` are this task's additions: `undefined` (not just `null`) sessions
in **both** modes, malformed allow-list config, a malformed session email, a
malformed gate object, and the two raise-paths.

## Deny cases fail closed

19 of 23 cases are refusals, and all 19 refused:

- **Signed out fails closed in both modes**, as `null` *and* as `undefined`
  (`2B-01`, `2B-08`, `H-01`, `H-02`). `H-02` is the sharp one: the stub's
  `is_tenant_member` returns `true`, and the gate still denies `not-signed-in`
  because it rejects before mode dispatch. It never reaches the membership read.
- **No config admits no one.** Empty, whitespace-only, and nullish-entry
  allow-lists all deny `empty-allowlist` (`2B-02`, `2B-03`, `H-03`); an empty
  tenant denies `not-a-member` (`2B-11`) even with the RPC returning `true`.
- **MEMBERSHIP admits only on `data === true`.** `false` and `null` both deny
  (`2B-09`, `2B-10`); a missing RPC falls back to a table read that denies on 0
  rows (`2B-13`), it does not fall open.
- **A malformed gate object denies** (`H-05`): an unknown `mode` is not `'solo'`,
  so it falls to the membership branch with no tenant → `not-a-member`.
- **Raises never admit** (`H-06`, `H-07`). A transport failure on the membership
  read rejects rather than returning `allowed: true`; a non-string allow-list
  entry raises inside normalization. Both are scored PASS because neither admits
  anyone — but they are raises, not clean denials. **Consequence for callers: a
  route guard must let these reject, not `catch` and default.** This confirms the
  same caution the 2B review recorded, now observable in the browser.

The board renders raises as `PASS — raised, no admit` rather than
`PASS — denied`, so the distinction is visible and not smoothed over.

## The import resolves to the published package

- Every import in `sandbox/src/` uses the bare specifier `@centripetal/identity`
  — the exact form the README documents (`import { checkAccess } from
  '@centripetal/identity'`). `grep -rn '\.\./src' sandbox/src/` → **no matches**;
  no file reaches into the package source by relative path.
- Resolution: the sandbox's single pre-existing package alias in
  `sandbox/vite.config.ts` maps that one specifier to the package entrypoint
  (`../src/index.ts`) — the same mechanism that already puts `LoginSplash` in the
  deployed bundle, unchanged by this PR. **Stated precisely:** the harness
  consumes the package through its published entrypoint and public API surface,
  identical to a consumer app; it does not resolve to a private module path. It
  is the same source the `dist/` build compiles, not a separate copy. Turning the
  alias into an installed git dependency would change how the live site resolves
  the package and was out of scope here.
- The harness only touches exported API: `checkAccess`, `isAllowedEmail`, `Pill`,
  `tokens`, and the types `Gate` / `GateResult` — all listed in `src/index.ts`.

## Bundle

Build: `vite build` from `sandbox/`, Node v22, vite 5.4.21 — exit 0.

```
dist/index.html                  8.31 kB │ gzip:  1.74 kB
dist/assets/index-fd61pcjU.js  164.11 kB │ gzip: 52.62 kB
```

**`checkAccess` is now in the bundle.** Minification renames the identifier, so
the proof is the compiled function body, lifted verbatim from
`dist/assets/index-fd61pcjU.js` (`checkAccess` → `Q`, `hasMembership` → `np`,
`isAllowedEmail` → `rs`, `normalizeEmail` → `ns`):

```js
async function Q(e,t){const{data:{user:n}}=await e.auth.getUser(),r=(n==null?void 0:n.email)??null;
if(!n)return{allowed:!1,email:r,reason:"not-signed-in"};
if(t.mode==="solo"){const o=t.allowedEmails.map(ns).filter(Boolean);
if(o.length===0)return{allowed:!1,email:r,reason:"empty-allowlist"};
const i=o.includes(ns(r));return{allowed:i,email:r,reason:i?"ok":"not-allowlisted"}}
const l=await np(e,{tenant:t.tenant,role:t.role});
return{allowed:l,email:r,reason:l?"ok":"not-a-member"}}
```

Literal fingerprints in the same bundle (occurrences): `not-signed-in` 5,
`empty-allowlist` 4, `not-allowlisted` 4, `not-a-member` 7, `is_tenant_member` 7,
`memberships` 1, `allowedEmails` 22, `__GATE_HARNESS__` 2,
`gate-harness-results` 1. Before this PR the bundle contained none of the gate's
reason strings.

The string `checkAccess` also appears once un-minified, as the panel heading.

## How a probe reads the outcome

| Surface | Written by | Verified |
| --- | --- | --- |
| `window.__GATE_HARNESS__` | browser run | WebDriver `execute/sync` → `{"total":23,"passed":23,"failed":0}` and all 23 ids `PASS` |
| `<script type="application/json" id="gate-harness-results">` | browser run, appended to `<body>` when it finishes | `--dump-dom` → `SCRIPT｜application/json｜7838 bytes`, parses to 23/23/0 |
| `<script type="application/json" id="gate-harness-static">` | the same table run in Node at build time, inlined into `index.html` | `curl <origin> \| grep -A4 gate-harness-static` → 23/23/0, **zero JavaScript executed** |

Both runtime surfaces carry exactly `{ total, passed, failed, cases: [...] }`.
The static block adds one key, `"source": "build-time (node)"`, so a probe can
tell the two apart.

**On the no-JavaScript requirement.** A client-rendered SPA cannot put *runtime*
results into static HTML — the block written after the browser run is only
readable by a probe that executes the page. So the build-time run was added:
`sandbox/vite.config.ts` bundles `src/gateCases.ts` with esbuild (already a Vite
dependency — no new package), runs it in Node, and inlines the verdicts. A
server-side probe with no JS now gets real verdicts from a plain `curl` of the
origin. The plugin is best-effort by construction: `esbuild` is imported
dynamically inside the `try`, and any failure logs a warning and inlines
`{"status":"unavailable"}` rather than breaking the deploy of the login page.
One case table feeds both runs, so the static and runtime blocks cannot drift —
confirmed here by comparing them per case, which agreed on all 23.

## Constraints honoured

- **`src/` untouched** — `git diff --stat` shows no file under `src/`.
- **No new runtime dependencies.** Only `@types/node` added, to
  `sandbox/devDependencies`; it is types-only with zero transitive deps. Root
  `package.json`, `tsconfig.build.json`, and both workflow files are untouched.
- **No network from the harness.** `performance.getEntriesByType('resource')` on
  the rendered page lists exactly three requests: the JS bundle, `favicon.ico`,
  and the Google Fonts stylesheet — the last being `LoginSplash`'s pre-existing
  `injectFonts` behaviour, not the harness. No `fetch`/`axios`/`sendBeacon`, no
  analytics, no tracking. Every case runs against the local stub client.
- **No real emails or domains.** Cases use `operator@example.com` /
  `stranger@example.com` and the tenant slug `cw-mineral` from the README's own
  example. The package still hardcodes no one's address.
- **`vite build` from `sandbox/` still works** — exit 0, output above.
  `tsc --noEmit -p sandbox/tsconfig.json` is now **exit 0**; it was exit 2 before
  this PR (`vite.config.ts` could not resolve `node:url`), fixed by `@types/node`.
- `npm audit` in `sandbox/` reports 3 pre-existing advisories in
  `vite`/`esbuild`/`postcss`. Not introduced here and not fixable without a Vite
  major bump, which is out of scope.
