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
