/**
 * The sandbox renders both halves of the package, not just the friendly one:
 * LoginSplash (the door, which always works) and the checkAccess harness
 * (the vault side, which must fail closed). Everything imports the package by
 * its published specifier — the same `@centripetal/identity` a consumer app
 * writes — never a relative path into the package source.
 */
import { LoginSplash } from '@centripetal/identity';
import { makeStubClient } from './stubClient';
import { GateHarness } from './GateHarness';

const supabase = makeStubClient();

export default function App() {
  return (
    <>
      <LoginSplash
        supabaseClient={supabase}
        appName="Mineral"
        redirectTo={`${window.location.origin}/auth/callback`}
        tagline="Your minerals, one clear view."
      />
      <GateHarness />
    </>
  );
}
