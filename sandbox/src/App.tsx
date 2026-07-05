import { LoginSplash } from '@centripetal/identity';
import { makeStubClient } from './stubClient';

const supabase = makeStubClient();

export default function App() {
  return (
    <LoginSplash
      supabaseClient={supabase}
      appName="Mineral"
      redirectTo={`${window.location.origin}/auth/callback`}
      tagline="Your minerals, one clear view."
    />
  );
}
