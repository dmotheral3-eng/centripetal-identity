import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The sandbox consumes the package straight from source so the component can be
// rendered without a build step. Real apps install it as a git dependency.
const pkgSrc = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const caseTable = fileURLToPath(new URL('./src/gateCases.ts', import.meta.url));

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
 * Best-effort by construction: any failure here logs and inlines nothing rather
 * than breaking the deploy of the login page.
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
        const dir = mkdtempSync(join(tmpdir(), 'gate-harness-'));
        const entry = join(dir, 'entry.mjs');
        const bundle = join(dir, 'bundle.cjs');
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
        });
        const summary = JSON.parse(
          execFileSync(process.execPath, [bundle], { encoding: 'utf8' }),
        );
        json = JSON.stringify({ source: 'build-time (node)', ...summary }, null, 2);
      } catch (err) {
        // Never fail the build over evidence collection.
        console.warn(`[gate-harness] build-time run skipped: ${(err as Error).message}`);
        json = JSON.stringify(
          { source: 'build-time (node)', status: 'unavailable' },
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
