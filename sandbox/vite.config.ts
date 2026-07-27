import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// The sandbox consumes the package straight from THIS WORKING TREE (../src), not
// from an installed copy of the published tag. Every `@centripetal/identity`
// import in sandbox/src resolves through the alias below, so the harness proves
// what this branch does — a consumer app pinned to v0.1.0 may differ until the
// tag moves. Real apps install the package as a git dependency.
const pkgSrc = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const caseTable = fileURLToPath(new URL('./src/gateCases.ts', import.meta.url));

// Scratch space for the build-time run. Deliberately inside the sandbox's own
// node_modules: the bundle leaves react external (see below), so it must sit
// somewhere Node's require can walk up to a real react install. A system temp
// dir cannot, which is exactly how this evidence block went silently missing.
const scratchDir = fileURLToPath(
  new URL('./node_modules/.gate-harness/', import.meta.url),
);

/**
 * Run the SAME gate case table (src/gateCases.ts) in Node at build time and
 * inline the verdicts into index.html as
 * `<script type="application/json" id="gate-harness-static">`.
 *
 * Why: the browser harness writes `#gate-harness-results` after it runs, which
 * a probe can only read by executing the page. This block ships in the static
 * HTML, so `curl <origin> | grep` verifies the gate refused what it must with
 * no JavaScript at all. One table feeds both, so the two cannot drift.
 *
 * The login page still deploys if this run fails — but it does NOT deploy
 * quietly. A failure here means the no-JavaScript probe has nothing to read, so
 * it is logged as a loud, unmistakable failure and the inlined block says so.
 */
function gateHarnessStaticResults() {
  return {
    name: 'gate-harness-static-results',
    async transformIndexHtml() {
      let json: string;
      try {
        // Imported dynamically, inside the try: esbuild ships with Vite, and if
        // it ever does not resolve this degrades instead of failing the build.
        const { build: esbuildBuild } = await import('esbuild');
        mkdirSync(scratchDir, { recursive: true });
        const entry = join(scratchDir, 'entry.mjs');
        const bundle = join(scratchDir, 'bundle.cjs');
        writeFileSync(
          entry,
          [
            `import { runGateHarness } from ${JSON.stringify(caseTable)};`,
            'runGateHarness().then((r) => {',
            '  process.stdout.write(JSON.stringify(r));',
            '});',
          ].join('\n'),
        );
        await esbuildBuild({
          entryPoints: [entry],
          outfile: bundle,
          bundle: true,
          platform: 'node',
          format: 'cjs',
          target: 'node18',
          jsx: 'automatic',
          logLevel: 'silent',
          alias: { '@centripetal/identity': pkgSrc },
          // The package index pulls in LoginSplash, which imports react. The case
          // table renders no components, so react is never called here — it only
          // has to load. Leaving it external keeps the bundle honest about that
          // and stops the whole run dying on a react resolution that only the
          // browser build needs.
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        });
        const summary = JSON.parse(
          execFileSync(process.execPath, [bundle], { encoding: 'utf8' }),
        );
        json = JSON.stringify({ source: 'build-time (node)', ...summary }, null, 2);
        const counts = `total ${summary.total} · passed ${summary.passed} · failed ${summary.failed}`;
        if (summary.failed > 0) {
          console.error(
            `\n[gate-harness] ✖ GATE DID NOT FAIL CLOSED — ${counts}\n` +
              '[gate-harness] #gate-harness-static inlined with failures. Do not ship this.\n',
          );
        } else {
          console.log(`[gate-harness] ✔ #gate-harness-static inlined — ${counts}`);
        }
      } catch (err) {
        // Loud, not fatal: the login page must still deploy, but nobody gets to
        // read this log and think the evidence block shipped.
        const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
        console.error(
          '\n' +
            '[gate-harness] ============================================================\n' +
            '[gate-harness] ✖ BUILD-TIME GATE RUN FAILED — #gate-harness-static IS EMPTY\n' +
            '[gate-harness] The no-JavaScript probe (curl <origin> | grep) will find no\n' +
            '[gate-harness] verdicts in this deploy. The page ships; the evidence does not.\n' +
            '[gate-harness] ------------------------------------------------------------\n' +
            detail
              .split('\n')
              .map((line) => `[gate-harness] ${line}`)
              .join('\n') +
            '\n[gate-harness] ============================================================\n',
        );
        json = JSON.stringify(
          {
            source: 'build-time (node)',
            status: 'unavailable',
            // Say why, in the artifact itself. "unavailable" alone read like a
            // choice; it was a failure.
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2,
        );
      }
      return [
        {
          tag: 'script',
          attrs: { type: 'application/json', id: 'gate-harness-static' },
          children: json,
          injectTo: 'body' as const,
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [react(), gateHarnessStaticResults()],
  resolve: {
    alias: { '@centripetal/identity': pkgSrc },
  },
  server: {
    port: 5188,
    fs: { allow: ['..'] },
  },
});
