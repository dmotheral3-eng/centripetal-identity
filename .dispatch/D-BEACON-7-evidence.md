# D-BEACON-7 — evidence: identity.centripetal-ai.com beacon (dispatch re-run, attempt 4)

**Dispatch:** `818e5252-047b-4d2f-afca-281d79694481`
**Branch:** `claude/818e5252`
**Autopsy:** d4d3ea22-fbf2-43df-aa8f-7f441b18bbce, attempt 3 mechanism (walk-one, env-missing-is-a-report, verifier-closes)
**Date of this run:** 2026-09-07

## This is a re-dispatch of an already-closed mission (again)

This exact dispatch id has now run four times. History, confirmed against
`main` and GitHub before touching anything this run:

- **Attempt 1** shipped the beacon: `sandbox/src/analytics.ts` (posthog-js,
  pageview-only — `autocapture: false`, `disable_session_recording: true`,
  `persistence: 'memory'` — no-op when `VITE_POSTHOG_KEY` is absent), wired
  up in `sandbox/src/main.tsx`, same shape as the D-BEACON-2 walk on
  law-dog-ai.com. Merged as **PR #10**, commit `4f94b33`, on `main`.
- **Attempt 2** re-ran against the same dispatch id, found the code already
  merged, verified the env var was still missing at build time, and opened
  a QUESTION PR (**#11**) asking a human to confirm the re-dispatch and
  hand-carry the key.
- **Attempt 3** re-ran again, treated the missing key as the expected report
  content rather than a blocking question (per the updated family mechanism),
  and pushed a closure report to the same branch (`claude/818e5252`,
  commit `e4961c5`) replacing the stale question with this evidence file.
  That commit was merged as **PR #11**, `a9edfdd`, on `main` — so, unlike
  what attempt 3 expected, PR #11 is no longer open; it has since been
  merged by a human.
- **This run (attempt 4)** confirms both PR #10 and PR #11 are merged, no
  PR is open, `git diff main...` for source is empty, and the fact being
  reported — `VITE_POSTHOG_KEY` missing at build time — is unchanged since
  attempt 3. There is nothing left to build or ship in this repo; this run
  exists to re-confirm that and hand the still-missing key back to a human
  once more, since the underlying fact (no env var on Vercel) hasn't moved.

## Verification performed this run (fresh, not reused from attempt 3)

```
curl -sSL -o /dev/null -w '%{http_code}' 'https://identity.centripetal-ai.com/?cb=<ts>'
  → 200
curl -sSL 'https://identity.centripetal-ai.com/assets/index-CTS3GNAy.js?cb=<ts>'
  → HTTP 200, 448389 bytes
```

Same bundle filename hash (`index-CTS3GNAy.js`) and same byte size
(448389) as attempt 3 recorded — confirms no rebuild has happened on
Vercel between attempt 3 and this run; the production bundle is
byte-identical.

```
grep -aoE 'phc_[A-Za-z0-9]{10,}' index-CTS3GNAy.js   →  0 matches
```

`phc_...` is the only place a real PostHog project key would surface in
the built artifact. Zero matches means `VITE_POSTHOG_KEY` is still not set
at build time on the Vercel project for `identity.centripetal-ai.com`, so
`analyticsState === 'no-key'` and `startAnalytics()` remains a no-op in
production. The expected-host probe will keep reading 0 events until the
key is added and the project rebuilds.

**ENV MISSING on Vercel project identity: `VITE_POSTHOG_KEY` — Dave
hand-carry** (optionally `VITE_POSTHOG_HOST` too, if not defaulting to
`https://us.i.posthog.com`).

## No code changes in this run

`git diff origin/main...HEAD -- . ':!.dispatch'` is empty at the point this
commit is authored — this commit only replaces this evidence file's content.
The mission's code deliverable already exists on `main` (PR #10, confirmed
still present at `sandbox/src/analytics.ts` and `sandbox/src/main.tsx`) and
matches the D-BEACON-2 shape; re-shipping it would be a no-op diff.

## For a human, once seen

1. Add `VITE_POSTHOG_KEY` (env var name only, no value here) to the Vercel
   project backing `identity.centripetal-ai.com`, then trigger a rebuild so
   the key bakes into the client bundle at build time.
2. Once that lands, no further PR is needed for this dispatch — the OS
   verifier picks up the first real event and closes the probe-table row on
   its next tick.
3. If this dispatch id fires again before the key is added, expect another
   copy of this same report — the fact isn't going to change without the
   Vercel env var being set.

## Noticed, not touched

Same as attempt 3: the shipped bundle contains the string `posthog` many
times over (the vendor library's own internals — class names, its own
default host constant). Unavoidable when bundling that SDK; matches what
the D-BEACON-2 walk on law-dog-ai.com already shipped. Not a no-reveal
violation in any string this repo authored, since none of this repo's own
source, file names, or comments name the vendor — flagging only for
completeness.
