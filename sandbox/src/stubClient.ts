/**
 * A no-network stub that shapes just enough of the Supabase client surface for
 * the sandbox to exercise LoginSplash without a real project. It resolves the
 * same result shapes the component reads. Nothing here leaves the browser.
 */
export function makeStubClient() {
  return {
    auth: {
      async signInWithOAuth({ provider }: { provider: string }) {
        // A real client redirects the browser here; the stub just logs.
        console.log(`[stub] signInWithOAuth → ${provider} (no real redirect)`);
        return { data: { provider, url: null }, error: null };
      },
      async signInWithOtp({ email }: { email: string }) {
        console.log(`[stub] magic link requested for ${email}`);
        return { data: {}, error: null };
      },
      async getUser() {
        return { data: { user: null }, error: null };
      },
    },
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

/** The pieces of a session the gate actually reads: id (table path) + email. */
export interface StubUser {
  id?: string;
  email?: string | null;
}

/** What the stubbed `is_tenant_member` RPC resolves to. */
export interface StubRpcResult {
  data?: unknown;
  error?: { message: string } | null;
}

/** What a stubbed `memberships` read resolves to (head/count or rows). */
export interface StubTableResult {
  count?: number | null;
  data?: unknown[] | null;
  error?: { message: string } | null;
}

export interface GateStubOptions {
  /**
   * Required and explicit so a case can distinguish `null` from `undefined` —
   * both must fail closed, and only passing them separately proves it.
   */
  user: StubUser | null | undefined;
  /** Omitted → the RPC reports itself missing, forcing the table fallback. */
  rpc?: StubRpcResult;
  /** Omitted → the membership read returns zero rows. */
  table?: StubTableResult;
}

/**
 * The same no-network pattern as makeStubClient, widened to the surface
 * `checkAccess` / `hasMembership` touch: `auth.getUser`, `rpc`, and a thenable
 * `from().select().eq()...` chain. Still no project, no keys, no network.
 */
export function makeGateStubClient(opts: GateStubOptions) {
  const rpcResult: StubRpcResult = opts.rpc ?? {
    data: null,
    error: { message: 'stub: is_tenant_member RPC not exposed' },
  };
  const tableResult: StubTableResult = opts.table ?? { count: 0, data: [], error: null };

  const settle = () =>
    Promise.resolve({
      data: tableResult.data ?? null,
      count: tableResult.count ?? null,
      error: tableResult.error ?? null,
    });

  // PostgREST builders are thenable, not promises: select()/eq() keep returning
  // the builder and the await at the end is what performs the read.
  const makeBuilder = () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      then: (
        onFulfilled?: (value: Awaited<ReturnType<typeof settle>>) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => settle().then(onFulfilled, onRejected),
    };
    return builder;
  };

  return {
    auth: {
      async getUser() {
        return { data: { user: opts.user }, error: null };
      },
    },
    from: () => makeBuilder(),
    async rpc() {
      return { data: rpcResult.data ?? null, error: rpcResult.error ?? null };
    },
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}
