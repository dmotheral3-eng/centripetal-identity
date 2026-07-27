/**
 * The sandbox renders both halves of the package, not just the friendly one:
 * LoginSplash (the door) and the checkAccess harness (the vault side, which must
 * fail closed).
 *
 * WHAT THIS PAGE IS: the package harness, running the WORKING TREE. Imports are
 * written against the published specifier `@centripetal/identity`, but
 * sandbox/vite.config.ts aliases that to `../src/index.ts` — so what runs here is
 * this branch's source, NOT the published v0.1.0 tag a consumer app installs.
 *
 * The sign-in buttons are wired to a no-network stub client, so they cannot
 * complete a sign-in. The banner below says that out loud: a login form that
 * looks live but cannot work is worse than no login form at all.
 */
import { LoginSplash, tokens } from '@centripetal/identity';
import { makeStubClient } from './stubClient';
import { GateHarness } from './GateHarness';

const supabase = makeStubClient();

/**
 * One line, above everything, for whoever just landed on this domain expecting a
 * product and found a component harness.
 */
function HarnessBanner() {
  return (
    <div
      role="note"
      style={{
        padding: '12px 20px',
        background: tokens.color.waitBg,
        borderBottom: `1px solid ${tokens.color.hairline}`,
        fontFamily: tokens.font.body,
        fontSize: 14,
        lineHeight: 1.5,
        color: tokens.color.ink,
        textAlign: 'center',
      }}
    >
      <strong>This is the package harness, not a product sign-in.</strong> The
      sign-in form below runs against a no-network stub client from this working
      tree, so the buttons cannot complete a sign-in — the gate board further down
      is the live evidence.
    </div>
  );
}

export default function App() {
  return (
    <>
      <HarnessBanner />
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
