/**
 * gate.ts — post-sign-in authorization gate.
 *
 * LoginSplash authenticates (who you are). This module authorizes (may you in).
 * The app runs a gate check after auth completes — in the auth-callback route or
 * a route guard — and redirects out anyone who fails.
 *
 * Two modes; the APP picks one:
 *
 *   SOLO       — a fixed allow-list of specific emails. For Dave-only internal
 *                tools (e.g. MotherDesk) where "membership" is just "is it him".
 *                The allow-list is ALWAYS supplied by the app as config; this
 *                package hardcodes no one's email.
 *
 *   MEMBERSHIP — the is_tenant_member tenant/role pattern for multi-user apps.
 *                Delegates to membership.ts against the app's own database.
 *
 * INVARIANT (shared with the rest of the package): every read targets the app's
 * OWN Supabase — the injected client and its session — and never a central
 * broker or hub. Authorization, like authentication, is federated.
 *
 * Note on posture: the LOGIN door (LoginSplash) always works. This gate is the
 * VAULT side — it fails CLOSED. A SOLO app with an empty allow-list admits no
 * one, by design.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasMembership } from './membership';

/** SOLO: fixed allow-list of emails. For Dave-only / single-operator tools. */
export interface SoloGate {
  mode: 'solo';
  /**
   * Emails permitted to enter. Compared case-insensitively after trimming.
   * Supplied by the consuming app — never baked into this package.
   */
  allowedEmails: string[];
}

/** MEMBERSHIP: multi-user apps gated by tenant (and optionally role). */
export interface MembershipGate {
  mode: 'membership';
  tenant: string;
  /** Optional role gate — when set, the membership must match this role. */
  role?: string;
}

export type Gate = SoloGate | MembershipGate;

export type GateReason =
  | 'ok'
  | 'not-signed-in'
  | 'not-allowlisted'
  | 'not-a-member'
  | 'empty-allowlist';

export interface GateResult {
  /** The single question a route guard asks. */
  allowed: boolean;
  /** The signed-in user's email, when known — for logging / friendly denials. */
  email: string | null;
  /** Machine-readable outcome, useful for redirects and audit lines. */
  reason: GateReason;
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * SOLO primitive: is the currently-authenticated user's email in `allowedEmails`?
 * Convenience wrapper over checkAccess for the common single-check call site.
 */
export async function isAllowedEmail(
  supabase: SupabaseClient,
  allowedEmails: string[],
): Promise<boolean> {
  const result = await checkAccess(supabase, { mode: 'solo', allowedEmails });
  return result.allowed;
}

/**
 * Unified authorization gate. The app selects the mode:
 *   - { mode: 'solo', allowedEmails }        → email allow-list
 *   - { mode: 'membership', tenant, role? }  → is_tenant_member pattern
 *
 * Reads only the app's own Supabase session/database. Fails closed.
 */
export async function checkAccess(
  supabase: SupabaseClient,
  gate: Gate,
): Promise<GateResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  if (!user) return { allowed: false, email, reason: 'not-signed-in' };

  if (gate.mode === 'solo') {
    const allow = gate.allowedEmails.map(normalizeEmail).filter(Boolean);
    if (allow.length === 0) {
      return { allowed: false, email, reason: 'empty-allowlist' };
    }
    const ok = allow.includes(normalizeEmail(email));
    return { allowed: ok, email, reason: ok ? 'ok' : 'not-allowlisted' };
  }

  // membership mode
  const ok = await hasMembership(supabase, {
    tenant: gate.tenant,
    role: gate.role,
  });
  return { allowed: ok, email, reason: ok ? 'ok' : 'not-a-member' };
}
