/**
 * membership.ts — app-local membership client.
 *
 * INVARIANT: every read here goes to the app's OWN Supabase instance passed in
 * by the caller. This module makes NO network call to any central service,
 * broker, or hub. One identity, many memberships — but the memberships table
 * lives on each sovereign app's database (federated runtime).
 *
 * Expected app-local schema (superseding legacy per-app boolean flags on touch):
 *
 *   table memberships (
 *     user_id  uuid  references auth.users,
 *     tenant   text,               -- tenant / workspace slug
 *     role     text default 'member',
 *     status   text default 'active',
 *     ...
 *   )
 *
 * and/or an RPC `is_tenant_member(tenant text) returns boolean` whose body reads
 * the same table under RLS. hasMembership() prefers the RPC when present and
 * falls back to a direct table read.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Membership {
  userId: string;
  tenant: string;
  role: string;
  status: string;
}

export interface HasMembershipQuery {
  tenant: string;
  /** Optional role gate — when set, the membership must match this role. */
  role?: string;
}

const MEMBERSHIPS_TABLE = 'memberships';
const IS_TENANT_MEMBER_RPC = 'is_tenant_member';

interface MembershipRow {
  user_id: string;
  tenant: string;
  role: string | null;
  status: string | null;
}

function toMembership(row: MembershipRow): Membership {
  return {
    userId: row.user_id,
    tenant: row.tenant,
    role: row.role ?? 'member',
    status: row.status ?? 'active',
  };
}

/**
 * Read every active membership for a user from the app-local database.
 * Returns [] on absence; throws only on a genuine transport/query error so
 * callers can distinguish "no memberships" from "read failed".
 */
export async function getMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<Membership[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from(MEMBERSHIPS_TABLE)
    .select('user_id, tenant, role, status')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`getMemberships failed: ${error.message}`);
  }
  return (data ?? []).map(toMembership);
}

/**
 * Test whether the currently-authenticated user belongs to `tenant`
 * (optionally with a specific `role`). Reads the app-local database only.
 *
 * Strategy:
 *   1. When no role gate is required, prefer the `is_tenant_member` RPC — it is
 *      the canonical read pattern and runs under RLS on the app's own DB.
 *   2. Otherwise (or if the RPC is absent) fall back to a direct membership read
 *      scoped to the current user via RLS.
 */
export async function hasMembership(
  supabase: SupabaseClient,
  query: HasMembershipQuery,
): Promise<boolean> {
  const { tenant, role } = query;
  if (!tenant) return false;

  if (!role) {
    const { data, error } = await supabase.rpc(IS_TENANT_MEMBER_RPC, { tenant });
    if (!error) return data === true;
    // RPC missing/not-exposed → fall through to a direct read rather than fail.
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  let q = supabase
    .from(MEMBERSHIPS_TABLE)
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('tenant', tenant)
    .eq('status', 'active');

  if (role) q = q.eq('role', role);

  const { count, error } = await q;
  if (error) {
    throw new Error(`hasMembership failed: ${error.message}`);
  }
  return (count ?? 0) > 0;
}
