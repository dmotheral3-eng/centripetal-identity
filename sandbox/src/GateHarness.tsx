/**
 * GateHarness.tsx — runs the gate in the browser, on mount, and shows the board.
 *
 * The half of this package that REFUSES people had never been observed running
 * in production; the login door had. This panel closes that gap: every case in
 * gateCases.ts executes on page load against a no-network stub client, and the
 * verdicts are rendered AND published machine-readably:
 *
 *   window.__GATE_HARNESS__                              (in-page probe)
 *   <script type="application/json" id="gate-harness-results">  (DOM probe)
 *
 * Read the board as: a green row on a deny case means the gate refused someone
 * it had to refuse. A green board means it refused everything it should have.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Pill, tokens } from '@centripetal/identity';
import { runGateHarness } from './gateCases';
import type { CaseResult, HarnessSummary } from './gateCases';

const RESULTS_ELEMENT_ID = 'gate-harness-results';

/**
 * Publish the run so anything that can read the DOM — a headless probe, a
 * console one-liner — gets the outcome without re-deriving it from the table.
 */
function publish(summary: HarnessSummary) {
  (window as unknown as { __GATE_HARNESS__?: HarnessSummary }).__GATE_HARNESS__ = summary;

  const existing = document.getElementById(RESULTS_ELEMENT_ID);
  const block = existing ?? document.createElement('script');
  block.id = RESULTS_ELEMENT_ID;
  block.setAttribute('type', 'application/json');
  block.textContent = JSON.stringify(summary, null, 2);
  if (!existing) document.body.appendChild(block);
}

const cell: CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${tokens.color.hairline}`,
  verticalAlign: 'top',
  textAlign: 'left',
};

const headCell: CSSProperties = {
  ...cell,
  fontFamily: tokens.font.body,
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: tokens.color.dim,
  whiteSpace: 'nowrap',
};

function verdictTone(text: string) {
  if (text.startsWith('allow')) return tokens.color.accentInk;
  if (text.startsWith('throw')) return tokens.color.wait;
  return tokens.color.muted;
}

/** A deny is a pass; so is a raise, because a raise never admits anyone. */
function passLabel(actual: string): string {
  if (actual.startsWith('allow')) return 'PASS — allowed';
  if (actual.startsWith('throw')) return 'PASS — raised, no admit';
  return 'PASS — denied';
}

function Row({ result }: { result: CaseResult }) {
  return (
    <tr style={{ background: result.pass ? 'transparent' : tokens.color.dangerBg }}>
      <td style={{ ...cell, fontFamily: tokens.font.mono, fontSize: 12 }}>{result.id}</td>
      <td style={{ ...cell, fontFamily: tokens.font.mono, fontSize: 12, whiteSpace: 'nowrap' }}>
        {result.mode}
      </td>
      <td style={{ ...cell, fontSize: 13, color: tokens.color.ink, maxWidth: 340 }}>
        {result.input}
        {result.note ? (
          <div style={{ marginTop: 4, fontSize: 12, color: tokens.color.dim }}>{result.note}</div>
        ) : null}
      </td>
      <td style={{ ...cell, fontFamily: tokens.font.mono, fontSize: 12, color: verdictTone(result.expected) }}>
        {result.expected}
      </td>
      <td style={{ ...cell, fontFamily: tokens.font.mono, fontSize: 12, color: verdictTone(result.actual) }}>
        {result.actual}
      </td>
      <td style={{ ...cell, fontFamily: tokens.font.mono, fontSize: 12, color: tokens.color.muted }}>
        {result.reason}
      </td>
      <td style={cell}>
        {result.pass ? (
          <Pill tone="good">{passLabel(result.actual)}</Pill>
        ) : (
          <Pill tone="danger">FAIL</Pill>
        )}
      </td>
    </tr>
  );
}

export function GateHarness() {
  const [summary, setSummary] = useState<HarnessSummary | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in dev; one run is enough.
    if (started.current) return;
    started.current = true;
    let live = true;
    runGateHarness().then((result) => {
      publish(result);
      if (live) setSummary(result);
    });
    return () => {
      live = false;
    };
  }, []);

  const green = summary !== null && summary.failed === 0;

  return (
    <section
      style={{
        background: tokens.color.bg,
        padding: '48px 24px 64px',
        fontFamily: tokens.font.body,
        color: tokens.color.ink,
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: tokens.font.display,
            fontSize: 28,
            fontWeight: 600,
            margin: '0 0 8px',
          }}
        >
          Gate harness — checkAccess
        </h2>
        <p style={{ margin: '0 0 4px', color: tokens.color.muted, fontSize: 14, maxWidth: 780 }}>
          Both gate modes, run live in this browser on mount against a no-network stub client.
          Deny cases <strong>pass when they deny</strong> — a green board means the gate refused
          everything it should have refused.
        </p>
        <p style={{ margin: '0 0 20px', color: tokens.color.dim, fontSize: 13, maxWidth: 780 }}>
          Cases <code style={{ fontFamily: tokens.font.mono }}>2B-*</code> mirror the 16 proven in{' '}
          <code style={{ fontFamily: tokens.font.mono }}>.dispatch/D-IDENTITY-2B-review.md</code>;{' '}
          <code style={{ fontFamily: tokens.font.mono }}>H-*</code> add undefined sessions in both
          modes and malformed input. Machine-readable copies:{' '}
          <code style={{ fontFamily: tokens.font.mono }}>window.__GATE_HARNESS__</code> and{' '}
          <code style={{ fontFamily: tokens.font.mono }}>#{RESULTS_ELEMENT_ID}</code>.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            padding: '14px 16px',
            background: summary === null
              ? tokens.color.surfaceAlt
              : green
                ? tokens.color.goodBg
                : tokens.color.dangerBg,
            border: `1px solid ${tokens.color.hairline}`,
            borderRadius: tokens.radius.md,
          }}
        >
          {summary === null ? (
            <Pill tone="wait">Running…</Pill>
          ) : (
            <Pill tone={green ? 'good' : 'danger'}>
              {green ? 'Gate fails closed' : 'Gate did NOT fail closed'}
            </Pill>
          )}
          <span style={{ fontFamily: tokens.font.mono, fontSize: 13, color: tokens.color.muted }}>
            {summary === null
              ? 'executing cases…'
              : `total ${summary.total} · passed ${summary.passed} · failed ${summary.failed}`}
          </span>
        </div>

        <div
          style={{
            background: tokens.color.surface,
            border: `1px solid ${tokens.color.hairline}`,
            borderRadius: tokens.radius.md,
            boxShadow: tokens.shadow.card,
            overflowX: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headCell}>Case</th>
                <th style={headCell}>Mode</th>
                <th style={headCell}>Input</th>
                <th style={headCell}>Expected</th>
                <th style={headCell}>Actual</th>
                <th style={headCell}>Reason</th>
                <th style={headCell}>Result</th>
              </tr>
            </thead>
            <tbody>
              {summary === null ? (
                <tr>
                  <td style={{ ...cell, color: tokens.color.dim }} colSpan={7}>
                    Running the case table…
                  </td>
                </tr>
              ) : (
                summary.cases.map((result) => <Row key={result.id} result={result} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
