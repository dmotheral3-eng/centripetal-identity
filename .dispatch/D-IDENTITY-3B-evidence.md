# D-IDENTITY-3B — evidence: the spinner that never stops + harness honesty

**Branch:** `claude/fc8f2c34` → `main` · repo `dmotheral3-eng/centripetal-identity`.

Root cause was already diagnosed and is not re-litigated here: `LoginSplash`
set `{kind:'redirecting'}`, awaited the provider call, and treated "no error" as
"the browser is leaving". When the call succeeds with no destination
(`data.url === null`) nothing navigates and nothing errors, so the spinner runs
forever. Dave hit that on `identity.centripetal-ai.com`.

| File | Change |
| --- | --- |
| `src/LoginSplash.tsx` | **Fix 1** — a successful call with no destination now ends in an actionable error; 8s watchdog on both busy states; no `setState` after unmount |
| `sandbox/src/App.tsx` | **Fix 2** — banner: this is the package harness against a no-network stub, the buttons cannot complete a sign-in, the gate board is the live evidence |
| `sandbox/vite.config.ts` | **Fix 3** — build-time gate run now resolves react (external + bundle written where Node can resolve it); failure is LOUD, and the inlined JSON says why |
| `sandbox/src/GateHarness.tsx`, `sandbox/src/gateCases.ts` | **Fix 4** — the "never a relative path into the package source" claim was false; both now state plainly that the harness runs the **working tree** (also said on the page) |
| `README.md` | documents the no-endless-spinner contract and the working-tree caveat |

No new dependencies (`package.json` / `sandbox/package.json` untouched), no new
network calls, no analytics, no changes to `.github/` or `tsconfig.build.json`.

## Fix 1 — the state handling and the watchdog

```diff
   async function signInWithProvider(provider: OAuthProviderKey) {
     setStatus({ kind: 'redirecting', provider });
-    const { error } = await supabaseClient.auth.signInWithOAuth({
+    const { data, error } = await supabaseClient.auth.signInWithOAuth({
       provider,
       options: { redirectTo: resolvedRedirectTo },
     });
+    if (!mounted.current) return;
     if (error) {
       setStatus({ kind: 'error', message: error.message });
+      return;
+    }
+    // Success used to be assumed to mean "the browser is leaving". It does not:
+    // a client can resolve with no error AND no destination (provider not
+    // configured, no window to navigate, any client returning url: null), and
+    // then nothing ever happens. Holding 'redirecting' there is the spinner that
+    // never stops. Only a real destination earns the spinner.
+    const destination = (data as { url?: string | null } | null | undefined)?.url;
+    if (typeof destination === 'string' && destination.length > 0) {
+      // A navigation is under way — keep the spinner exactly as before and let
+      // the browser take the page. The watchdog stays armed in case a blocker
+      // eats the redirect.
+      return;
     }
-    // On success the browser is redirected away; no further UI needed.
+    setStatus({ kind: 'error', message: NO_DESTINATION_MESSAGE });
   }
```

The watchdog (new), plus the mount flag it reads:

```diff
+  // Set on setup, not just cleared on teardown, so a StrictMode remount does not
+  // leave the component permanently marked as gone.
+  useEffect(() => {
+    mounted.current = true;
+    return () => {
+      mounted.current = false;
+    };
+  }, []);
+
+  /**
+   * The watchdog. A busy state is a promise that something is about to happen;
+   * if nothing has, say so instead of spinning forever. Re-armed on every status
+   * change and cleared on unmount, so it can never fire into a dead component.
+   */
+  useEffect(() => {
+    if (status.kind !== 'redirecting' && status.kind !== 'sending-link') return;
+    if (typeof window === 'undefined' || typeof document === 'undefined') return;
+    const wasRedirecting = status.kind === 'redirecting';
+    const timer = window.setTimeout(() => {
+      // Still here after the wait: the document never went anywhere.
+      if (!mounted.current) return;
+      setStatus({
+        kind: 'error',
+        message: wasRedirecting ? REDIRECT_STALLED_MESSAGE : LINK_STALLED_MESSAGE,
+      });
+    }, BUSY_WATCHDOG_MS);
+    return () => window.clearTimeout(timer);
+  }, [status]);
```

The magic-link path gets the same treatment: it cannot return a `url`, but it can
hang (a call that never settles), so it is covered by the same watchdog, and its
post-await `setStatus` is now guarded by `if (!mounted.current) return;`.

Copy (no infrastructure vendor names, no invented provider name):

| Trigger | Rendered under "Couldn't sign in" |
| --- | --- |
| success, no destination | Sign-in couldn't start — this app got no sign-in address back. Use the email link below, or ask whoever set up this app to finish configuring sign-in. |
| 8s in `redirecting` | Sign-in didn't open. A pop-up or redirect blocker may be in the way — allow them for this site and try again, or use the email link below. |
| 8s in `sending-link` | Still waiting on the sign-in link. Check your connection and try again, or use a sign-in button above. |

## Fix 1 — runtime proof (jsdom, real component, real click)

Rendered `src/LoginSplash.tsx` in jsdom with react 18.3.1 and clicked
"Continue with Google". Verification script kept out of the repo (no test infra
here, and the task adds no dependencies); it is reproducible from this log.

```
── CASE A  signInWithOAuth → { data: { provider, url: null }, error: null }
   spinner elements   : 0
   button re-enabled  : true
   status shown       : Couldn’t sign in — Sign-in couldn’t start — this app got no sign-in
                        address back. Use the email link below, or ask whoever set up this
                        app to finish configuring sign-in.
   console errors     : 0

── CASE B  signInWithOAuth → real url (browser is leaving)
   spinner elements   : 1
   button disabled    : true
   error shown        : false          ← behaviour on a real redirect is unchanged

── CASE C  same page, 8.4s later, never navigated (blocked redirect)
   spinner elements   : 0
   status shown       : Couldn’t sign in — Sign-in didn’t open. A pop-up or redirect
                        blocker may be in the way …

── CASE D  unmounted while the provider call was in flight
   React warnings     : 0              ← no setState after unmount

── CASE E  signInWithOtp never resolves
   showed "Sending…"  : true
   after watchdog     : Couldn’t sign in — Still waiting on the sign-in link …
```

Case A is exactly the deployed sandbox stub's response
(`{data:{provider,url:null},error:null}`): **0 spinners, button re-enabled,
visible error text.** The infinite spinner is gone.

## Fix 3 — the build-time evidence block

Failure reproduced first (build with the package root's `node_modules` absent,
which is the deploy shape — only `sandbox/` deps are installed):

```
[gate-harness] build-time run skipped: Build failed with 2 errors:
../src/LoginSplash.tsx:17:44: ERROR: Could not resolve "react"
../src/LoginSplash.tsx:203:8: ERROR: Could not resolve "react/jsx-runtime"
dist/index.html   0.49 kB
→ inlined: { "source": "build-time (node)", "status": "unavailable" }
```

Two changes: `external: ['react', 'react-dom', 'react/jsx-runtime']` (the case
table renders no components — react only has to load, never run), and the
scratch bundle now lives in `sandbox/node_modules/.gate-harness/` instead of the
system temp dir, because an external `require('react')` resolves from the
bundle's own location and a temp dir can never walk up to a react install.

Same build, after the fix, still with no root `node_modules`:

```
[gate-harness] ✔ #gate-harness-static inlined — total 23 · passed 23 · failed 0
dist/index.html   8.31 kB │ gzip: 1.74 kB
✓ built in 606ms
```

The no-JavaScript probe now has something to read:

```
$ python3 - <<'EOF'   # equivalent of: curl <origin> | grep -A4 gate-harness-static
source : build-time (node)
total  : 23
passed : 23
failed : 0
bytes of static block: 7879
EOF
```

Loudness verified by deliberately breaking the case-table path:

```
[gate-harness] ============================================================
[gate-harness] ✖ BUILD-TIME GATE RUN FAILED — #gate-harness-static IS EMPTY
[gate-harness] The no-JavaScript probe (curl <origin> | grep) will find no
[gate-harness] verdicts in this deploy. The page ships; the evidence does not.
[gate-harness] ------------------------------------------------------------
[gate-harness] Error: Build failed with 1 error: … Could not resolve …
[gate-harness] ============================================================
```

and the inlined JSON now carries the reason instead of a bare "unavailable":

```json
{
  "source": "build-time (node)",
  "status": "unavailable",
  "error": "Build failed with 1 error: … Could not resolve \"…/gateCasesDOESNOTEXIST.ts\""
}
```

Still non-fatal by design — the login page deploys — but no log reader can now
mistake a missing evidence block for a successful build. A non-zero `failed`
count is equally loud (`✖ GATE DID NOT FAIL CLOSED`).

## Fix 4 — what the harness actually imports

Unchanged in form: `GateHarness.tsx` and `gateCases.ts` still import
`checkAccess`, `isAllowedEmail`, `Pill` and `tokens` from the specifier
`@centripetal/identity`. What changed is that the comments and the page no longer
claim that means the published package. `sandbox/vite.config.ts` aliases
`@centripetal/identity` → `../src/index.ts`, so:

- the harness exercises **the working tree** (this branch's `src/`),
- **not** the `v0.1.0` tag the seven consumer apps install,
- and the page says so, above the board: *"Under test: the working tree —
  `@centripetal/identity` is aliased to `../src/index.ts`, so this board reports
  on this branch's source, not on the published `v0.1.0` tag consumer apps
  install."*

The alias was kept (rather than installing the tag) so the board reports on the
code under review — including this fix. The distinction is now stated instead of
denied.

## Fix 2 — the sandbox no longer impersonates a working login

Banner above `LoginSplash`, first thing on the page:

> **This is the package harness, not a product sign-in.** The sign-in form below
> runs against a no-network stub client from this working tree, so the buttons
> cannot complete a sign-in — the gate board further down is the live evidence.

## Green checks

```
$ npx tsc -p tsconfig.json --noEmit          → PKG OK
$ npx tsc -p tsconfig.build.json             → PKG BUILD OK
$ cd sandbox && npx tsc -p tsconfig.json --noEmit → SANDBOX OK
$ cd sandbox && npx vite build
[gate-harness] ✔ #gate-harness-static inlined — total 23 · passed 23 · failed 0
✓ built in 613ms
```

Gate board unchanged at 23/23 — this task touched the door, not the vault.
