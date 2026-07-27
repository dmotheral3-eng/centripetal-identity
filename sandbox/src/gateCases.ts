/**
 * gateCases.ts — the gate's fail-closed contract, as executable cases.
 *
 * Provenance: cases `2B-01`…`2B-16` mirror the 16 runtime cases proven in
 * `.dispatch/D-IDENTITY-2B-review.md` (gate (c) — "both modes fail closed",
 * 16/16 passed), so this harness and that record assert the same thing. Cases
 * `H-01`…`H-07` are the additions this harness needs to cover the whole matrix:
 * `undefined` (not just `null`) sessions in BOTH modes, malformed input, and a
 * malformed gate object.
 *
 * WHAT IS UNDER TEST: the import below is written against the published
 * specifier `@centripetal/identity`, but `sandbox/vite.config.ts` aliases that to
 * `../src/index.ts`. So these cases exercise the WORKING TREE — this branch's
 * gate source — not the published v0.1.0 tag that consumer apps install. A green
 * board is evidence about this branch. It becomes evidence about what the seven
 * apps run only once this source is the tag they have pinned.
 *
 * Every case runs against `makeGateStubClient` — no project, no keys, no
 * network. Emails and tenant slugs below are `example.com` test literals; the
 * package still hardcodes no one's address.
 *
 * A deny is a PASS. Most of this table exists to watch the gate refuse people.
 */
import { checkAccess, isAllowedEmail } from '@centripetal/identity';
import type { Gate, GateResult } from '@centripetal/identity';
import { makeGateStubClient } from './stubClient';

export type Outcome = 'allow' | 'deny' | 'throw';

export interface Verdict {
  outcome: Outcome;
  /** Gate `reason` for allow/deny; `Name: message` for a throw. */
  reason: string;
}

export interface GateCase {
  id: string;
  mode: 'SOLO' | 'MEMBERSHIP';
  /** One-line summary of the session + gate config fed in. */
  input: string;
  expected: Verdict;
  /** Why this case exists — shown as the row's note. */
  note?: string;
  run: () => Promise<Verdict>;
}

const OPERATOR = 'operator@example.com';
const STRANGER = 'stranger@example.com';
const TENANT = 'cw-mineral';
const USER = { id: '00000000-0000-4000-8000-000000000001', email: OPERATOR };

function fromResult(result: GateResult): Verdict {
  return { outcome: result.allowed ? 'allow' : 'deny', reason: result.reason };
}

function fromBoolean(allowed: boolean): Verdict {
  return { outcome: allowed ? 'allow' : 'deny', reason: String(allowed) };
}

const deny = (reason: string): Verdict => ({ outcome: 'deny', reason });
const allow = (reason: string): Verdict => ({ outcome: 'allow', reason });
const throws = (reason: string): Verdict => ({ outcome: 'throw', reason });

export const GATE_CASES: GateCase[] = [
  // ── SOLO ────────────────────────────────────────────────────────────────
  {
    id: '2B-01',
    mode: 'SOLO',
    input: 'user: null · allowedEmails: [operator@example.com]',
    expected: deny('not-signed-in'),
    note: 'signed out is rejected before mode dispatch',
    run: () =>
      checkAccess(makeGateStubClient({ user: null }), {
        mode: 'solo',
        allowedEmails: [OPERATOR],
      }).then(fromResult),
  },
  {
    id: '2B-02',
    mode: 'SOLO',
    input: 'user: operator@example.com · allowedEmails: []',
    expected: deny('empty-allowlist'),
    note: 'no config admits no one — the fail-closed default',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER }), {
        mode: 'solo',
        allowedEmails: [],
      }).then(fromResult),
  },
  {
    id: '2B-03',
    mode: 'SOLO',
    input: "user: operator@example.com · allowedEmails: ['   ']",
    expected: deny('empty-allowlist'),
    note: 'whitespace-only config is empty config',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER }), {
        mode: 'solo',
        allowedEmails: ['   '],
      }).then(fromResult),
  },
  {
    id: '2B-04',
    mode: 'SOLO',
    input: 'user: stranger@example.com · allowedEmails: [operator@example.com]',
    expected: deny('not-allowlisted'),
    note: 'the wrong verified person is still the wrong person',
    run: () =>
      checkAccess(
        makeGateStubClient({ user: { ...USER, email: STRANGER } }),
        { mode: 'solo', allowedEmails: [OPERATOR] },
      ).then(fromResult),
  },
  {
    id: '2B-05',
    mode: 'SOLO',
    input: 'user: { id } with no email · allowedEmails: [operator@example.com]',
    expected: deny('not-allowlisted'),
    note: 'a session with no email matches nothing',
    run: () =>
      checkAccess(makeGateStubClient({ user: { id: USER.id } }), {
        mode: 'solo',
        allowedEmails: [OPERATOR],
      }).then(fromResult),
  },
  {
    id: '2B-06',
    mode: 'SOLO',
    input: 'isAllowedEmail(user: operator@example.com, [])',
    expected: deny('false'),
    note: 'the convenience wrapper fails closed too',
    run: () =>
      isAllowedEmail(makeGateStubClient({ user: USER }), []).then(fromBoolean),
  },
  {
    id: '2B-07',
    mode: 'SOLO',
    input: "user: operator@example.com · allowedEmails: ['  OPERATOR@Example.COM  ']",
    expected: allow('ok'),
    note: 'normalization: trim + case-fold, so the real operator gets in',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER }), {
        mode: 'solo',
        allowedEmails: ['  OPERATOR@Example.COM  '],
      }).then(fromResult),
  },
  {
    id: '2B-16',
    mode: 'SOLO',
    input: 'isAllowedEmail(user: operator@example.com, [operator@example.com])',
    expected: allow('true'),
    note: 'allow-side twin of 2B-06 — the wrapper still admits the operator',
    run: () =>
      isAllowedEmail(makeGateStubClient({ user: USER }), [OPERATOR]).then(
        fromBoolean,
      ),
  },

  // ── MEMBERSHIP ──────────────────────────────────────────────────────────
  {
    id: '2B-08',
    mode: 'MEMBERSHIP',
    input: `user: null · tenant: ${TENANT}`,
    expected: deny('not-signed-in'),
    note: 'same pre-dispatch rejection as 2B-01',
    run: () =>
      checkAccess(makeGateStubClient({ user: null }), {
        mode: 'membership',
        tenant: TENANT,
      }).then(fromResult),
  },
  {
    id: '2B-09',
    mode: 'MEMBERSHIP',
    input: `is_tenant_member → false · tenant: ${TENANT}`,
    expected: deny('not-a-member'),
    note: 'the ordinary non-member denial',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER, rpc: { data: false } }), {
        mode: 'membership',
        tenant: TENANT,
      }).then(fromResult),
  },
  {
    id: '2B-10',
    mode: 'MEMBERSHIP',
    input: `is_tenant_member → null · tenant: ${TENANT}`,
    expected: deny('not-a-member'),
    note: 'admits only on the strict identity data === true',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER, rpc: { data: null } }), {
        mode: 'membership',
        tenant: TENANT,
      }).then(fromResult),
  },
  {
    id: '2B-11',
    mode: 'MEMBERSHIP',
    input: "user: operator@example.com · tenant: '' (no config)",
    expected: deny('not-a-member'),
    note: 'unconfigured tenant admits no one',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER, rpc: { data: true } }), {
        mode: 'membership',
        tenant: '',
      }).then(fromResult),
  },
  {
    id: '2B-12',
    mode: 'MEMBERSHIP',
    input: `tenant: ${TENANT} · role: admin · matching rows: 0`,
    expected: deny('not-a-member'),
    note: 'role gate bypasses the RPC and reads the table — 0 rows denies',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER, table: { count: 0 } }), {
        mode: 'membership',
        tenant: TENANT,
        role: 'admin',
      }).then(fromResult),
  },
  {
    id: '2B-13',
    mode: 'MEMBERSHIP',
    input: `RPC errors → table fallback · rows: 0 · tenant: ${TENANT}`,
    expected: deny('not-a-member'),
    note: 'a missing RPC falls back to a read, it does not fall open',
    run: () =>
      checkAccess(
        makeGateStubClient({
          user: USER,
          rpc: { error: { message: 'function is_tenant_member does not exist' } },
          table: { count: 0 },
        }),
        { mode: 'membership', tenant: TENANT },
      ).then(fromResult),
  },
  {
    id: '2B-14',
    mode: 'MEMBERSHIP',
    input: `is_tenant_member → true · tenant: ${TENANT}`,
    expected: allow('ok'),
    note: 'a real member of the tenant gets in',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER, rpc: { data: true } }), {
        mode: 'membership',
        tenant: TENANT,
      }).then(fromResult),
  },
  {
    id: '2B-15',
    mode: 'MEMBERSHIP',
    input: `tenant: ${TENANT} · role: admin · matching rows: 1`,
    expected: allow('ok'),
    note: 'role gate satisfied by one active row',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER, table: { count: 1 } }), {
        mode: 'membership',
        tenant: TENANT,
        role: 'admin',
      }).then(fromResult),
  },

  // ── Harness additions: undefined sessions, malformed input ──────────────
  {
    id: 'H-01',
    mode: 'SOLO',
    input: 'user: undefined · allowedEmails: [operator@example.com]',
    expected: deny('not-signed-in'),
    note: 'undefined, not null — the other shape of signed out',
    run: () =>
      checkAccess(makeGateStubClient({ user: undefined }), {
        mode: 'solo',
        allowedEmails: [OPERATOR],
      }).then(fromResult),
  },
  {
    id: 'H-02',
    mode: 'MEMBERSHIP',
    input: `user: undefined · tenant: ${TENANT} · is_tenant_member → true`,
    expected: deny('not-signed-in'),
    note: 'denied before the membership read runs, even though it would say yes',
    run: () =>
      checkAccess(makeGateStubClient({ user: undefined, rpc: { data: true } }), {
        mode: 'membership',
        tenant: TENANT,
      }).then(fromResult),
  },
  {
    id: 'H-03',
    mode: 'SOLO',
    input: 'allowedEmails: [null, undefined] (malformed config)',
    expected: deny('empty-allowlist'),
    note: 'nullish entries normalize away — malformed config is empty config',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER }), {
        mode: 'solo',
        allowedEmails: [null, undefined] as unknown as string[],
      }).then(fromResult),
  },
  {
    id: 'H-04',
    mode: 'SOLO',
    input: "user email: '   ' (malformed session) · allowedEmails: [operator@example.com]",
    expected: deny('not-allowlisted'),
    note: 'an empty normalized email never matches a populated list',
    run: () =>
      checkAccess(makeGateStubClient({ user: { ...USER, email: '   ' } }), {
        mode: 'solo',
        allowedEmails: [OPERATOR],
      }).then(fromResult),
  },
  {
    id: 'H-05',
    mode: 'MEMBERSHIP',
    input: "gate: { mode: 'not-a-mode' } (malformed gate object)",
    expected: deny('not-a-member'),
    note: 'an unknown mode is not SOLO, so it falls to membership with no tenant — deny',
    run: () =>
      checkAccess(
        makeGateStubClient({ user: USER, rpc: { data: true } }),
        { mode: 'not-a-mode' } as unknown as Gate,
      ).then(fromResult),
  },
  {
    id: 'H-06',
    mode: 'MEMBERSHIP',
    input: `RPC errors AND table read errors · tenant: ${TENANT}`,
    expected: throws('Error: hasMembership failed'),
    note: 'a transport failure raises — it never returns allowed: true. Callers must let it reject, not catch-and-default',
    run: () =>
      checkAccess(
        makeGateStubClient({
          user: USER,
          rpc: { error: { message: 'network unreachable' } },
          table: { error: { message: 'network unreachable' } },
        }),
        { mode: 'membership', tenant: TENANT },
      ).then(fromResult),
  },
  {
    id: 'H-07',
    mode: 'SOLO',
    input: 'allowedEmails: [42] (non-string entry)',
    expected: throws('TypeError'),
    note: 'a non-string entry raises inside normalization — no admit, but it is a raise, not a clean deny',
    run: () =>
      checkAccess(makeGateStubClient({ user: USER }), {
        mode: 'solo',
        allowedEmails: [42] as unknown as string[],
      }).then(fromResult),
  },
];

export interface CaseResult {
  id: string;
  mode: GateCase['mode'];
  input: string;
  note: string;
  expected: string;
  actual: string;
  /** True when the gate did exactly what the case says it must. */
  pass: boolean;
  /** The reason string the gate returned (or the raised message). */
  reason: string;
}

export interface HarnessSummary {
  total: number;
  passed: number;
  failed: number;
  cases: CaseResult[];
}

function label(verdict: Verdict): string {
  return `${verdict.outcome} · ${verdict.reason}`;
}

function matches(expected: Verdict, actual: Verdict): boolean {
  if (expected.outcome !== actual.outcome) return false;
  // Raised messages carry engine-specific tails; compare the stable prefix.
  if (expected.outcome === 'throw') return actual.reason.startsWith(expected.reason);
  return expected.reason === actual.reason;
}

async function runCase(gateCase: GateCase): Promise<CaseResult> {
  let actual: Verdict;
  try {
    actual = await gateCase.run();
  } catch (err) {
    const error = err as { name?: string; message?: string };
    actual = {
      outcome: 'throw',
      reason: `${error?.name ?? 'Error'}: ${error?.message ?? String(err)}`,
    };
  }
  return {
    id: gateCase.id,
    mode: gateCase.mode,
    input: gateCase.input,
    note: gateCase.note ?? '',
    expected: label(gateCase.expected),
    actual: label(actual),
    pass: matches(gateCase.expected, actual),
    reason: actual.reason,
  };
}

/** Run the whole table in order and summarize. Sequential: order is evidence. */
export async function runGateHarness(): Promise<HarnessSummary> {
  const cases: CaseResult[] = [];
  for (const gateCase of GATE_CASES) {
    cases.push(await runCase(gateCase));
  }
  const passed = cases.filter((c) => c.pass).length;
  return { total: cases.length, passed, failed: cases.length - passed, cases };
}
