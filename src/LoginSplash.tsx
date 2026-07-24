/**
 * LoginSplash — the shared sign-in surface for every Centripetal app.
 *
 * One-tap SSO (Google + Microsoft) via the app's OWN Supabase Auth, plus a
 * magic-link email fallback. Styling per Token Set B (Light Editorial v2, P#79).
 *
 * INVARIANTS honoured here:
 *   - No hosted runtime auth service: every call targets the supabaseClient the
 *     app passes in. This component never reaches a central broker or hub.
 *   - No infrastructure vendor names in any rendered string (P#62). The only
 *     provider names shown are the identity providers the user must choose
 *     between (functionally unavoidable) and they are overridable via props.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tokens } from './tokens';

export type OAuthProviderKey = 'google' | 'azure';

export interface LoginSplashProps {
  /** The app's own Supabase client. Auth calls target this and nothing else. */
  supabaseClient: SupabaseClient;
  /** Absolute URL to return to after auth completes.
   *  Defaults to the current origin (`window.location.origin`). */
  redirectTo?: string;
  /** Human name of the app, shown in the headline. */
  appName: string;
  /** Which SSO providers to offer. Defaults to both. */
  providers?: OAuthProviderKey[];
  /** Short line under the headline. Defaults to a neutral welcome. */
  tagline?: string;
  /** Override the visible provider button labels if an app needs to. */
  providerLabels?: Partial<Record<OAuthProviderKey, string>>;
  /** Inject the Fraunces / IBM Plex webfonts. Default true; set false if the
   *  host app already loads them. */
  injectFonts?: boolean;
}

const DEFAULT_PROVIDER_LABELS: Record<OAuthProviderKey, string> = {
  google: 'Continue with Google',
  azure: 'Continue with Microsoft',
};

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap';

type Status =
  | { kind: 'idle' }
  | { kind: 'redirecting'; provider: OAuthProviderKey }
  | { kind: 'sending-link' }
  | { kind: 'link-sent'; email: string }
  | { kind: 'error'; message: string };

export function LoginSplash({
  supabaseClient,
  redirectTo,
  appName,
  providers = ['google', 'azure'],
  tagline = 'Sign in to continue.',
  providerLabels,
  injectFonts = true,
}: LoginSplashProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Default the post-auth return to the current origin. An app can still pass an
  // explicit path (e.g. `${origin}/auth/callback`) via the redirectTo prop.
  const resolvedRedirectTo =
    redirectTo ??
    (typeof window !== 'undefined' ? window.location.origin : undefined);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Keyframes can't live in inline styles — inject once.
    if (!document.getElementById('centripetal-identity-kf')) {
      const style = document.createElement('style');
      style.id = 'centripetal-identity-kf';
      style.textContent = '@keyframes ci-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
    if (!injectFonts || document.getElementById('centripetal-identity-fonts')) return;
    const link = document.createElement('link');
    link.id = 'centripetal-identity-fonts';
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, [injectFonts]);

  const labelFor = (p: OAuthProviderKey) =>
    providerLabels?.[p] ?? DEFAULT_PROVIDER_LABELS[p];

  async function signInWithProvider(provider: OAuthProviderKey) {
    setStatus({ kind: 'redirecting', provider });
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo: resolvedRedirectTo },
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
    }
    // On success the browser is redirected away; no further UI needed.
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus({ kind: 'error', message: 'Enter your email address first.' });
      return;
    }
    setStatus({ kind: 'sending-link' });
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: resolvedRedirectTo },
    });
    setStatus(
      error
        ? { kind: 'error', message: error.message }
        : { kind: 'link-sent', email: trimmed },
    );
  }

  const busy = status.kind === 'redirecting' || status.kind === 'sending-link';

  return (
    <div style={styles.page}>
      <main style={styles.card} role="main">
        <p style={styles.eyebrow}>Secure sign-in</p>
        <h1 style={styles.headline}>{appName}</h1>
        <p style={styles.tagline}>{tagline}</p>

        <div style={styles.providers}>
          {providers.map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => signInWithProvider(p)}
              style={{
                ...styles.providerBtn,
                ...(busy ? styles.btnDisabled : null),
              }}
            >
              <ProviderGlyph provider={p} />
              <span>{labelFor(p)}</span>
              {status.kind === 'redirecting' && status.provider === p ? (
                <span style={styles.btnSpinner} aria-hidden />
              ) : null}
            </button>
          ))}
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>or use email</span>
          <span style={styles.dividerLine} />
        </div>

        <form onSubmit={sendMagicLink} style={styles.form}>
          <label htmlFor="ci-email" style={styles.srOnly}>
            Email address
          </label>
          <input
            id="ci-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@work-email.com"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <button
            type="submit"
            disabled={busy}
            style={{ ...styles.magicBtn, ...(busy ? styles.btnDisabled : null) }}
          >
            {status.kind === 'sending-link' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>

        <StatusRow status={status} />

        <p style={styles.footer}>
          Trouble signing in with an account you already use?{' '}
          <span style={styles.footerEm}>Use the same email</span> — your access
          carries over.
        </p>
      </main>
    </div>
  );
}

function StatusRow({ status }: { status: Status }) {
  if (status.kind === 'idle' || status.kind === 'redirecting') return null;
  if (status.kind === 'sending-link') {
    return <Pill tone="wait">Sending your link…</Pill>;
  }
  if (status.kind === 'link-sent') {
    return (
      <div style={styles.statusRow}>
        <Pill tone="good">Link sent</Pill>
        <span style={styles.statusText}>
          Check {status.email} and open the link to finish.
        </span>
      </div>
    );
  }
  return (
    <div style={styles.statusRow}>
      <Pill tone="danger">Couldn’t sign in</Pill>
      <span style={styles.statusText}>{status.message}</span>
    </div>
  );
}

type PillTone = 'good' | 'wait' | 'danger' | 'neutral';

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const map: Record<PillTone, { fg: string; bg: string }> = {
    good: { fg: tokens.color.good, bg: tokens.color.goodBg },
    wait: { fg: tokens.color.wait, bg: tokens.color.waitBg },
    danger: { fg: tokens.color.danger, bg: tokens.color.dangerBg },
    neutral: { fg: tokens.color.neutral, bg: tokens.color.neutralBg },
  };
  const c = map[tone];
  return (
    <span style={{ ...styles.pill, color: c.fg, background: c.bg }}>
      <span style={{ ...styles.pillDot, background: c.fg }} aria-hidden />
      {children}
    </span>
  );
}

function ProviderGlyph({ provider }: { provider: OAuthProviderKey }) {
  if (provider === 'google') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
    );
  }
  // Microsoft
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path fill="#F25022" d="M1 1h7.6v7.6H1z" />
      <path fill="#7FBA00" d="M9.4 1H17v7.6H9.4z" />
      <path fill="#00A4EF" d="M1 9.4h7.6V17H1z" />
      <path fill="#FFB900" d="M9.4 9.4H17V17H9.4z" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    boxSizing: 'border-box',
    background: tokens.color.bg,
    color: tokens.color.ink,
    fontFamily: tokens.font.body,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: tokens.color.surface,
    border: `1px solid ${tokens.color.hairline}`,
    borderRadius: tokens.radius.lg,
    boxShadow: tokens.shadow.card,
    padding: '40px 36px',
    boxSizing: 'border-box',
  },
  eyebrow: {
    margin: 0,
    fontFamily: tokens.font.mono,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: tokens.color.accent,
  },
  headline: {
    margin: '10px 0 6px',
    fontFamily: tokens.font.display,
    fontWeight: 600,
    fontSize: 30,
    lineHeight: 1.1,
    color: tokens.color.ink,
  },
  tagline: {
    margin: '0 0 28px',
    fontSize: 15,
    color: tokens.color.muted,
  },
  providers: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  providerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 16px',
    fontFamily: tokens.font.body,
    fontSize: 15,
    fontWeight: 500,
    color: tokens.color.ink,
    background: tokens.color.surface,
    border: `1px solid ${tokens.color.hairline}`,
    borderRadius: tokens.radius.md,
    cursor: 'pointer',
  },
  magicBtn: {
    width: '100%',
    padding: '12px 16px',
    fontFamily: tokens.font.body,
    fontSize: 15,
    fontWeight: 600,
    color: '#FFFFFF',
    background: tokens.color.accent,
    border: `1px solid ${tokens.color.accent}`,
    borderRadius: tokens.radius.md,
    cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.55, cursor: 'default' },
  btnSpinner: {
    marginLeft: 'auto',
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: `2px solid ${tokens.color.hairline}`,
    borderTopColor: tokens.color.accent,
    animation: 'ci-spin 0.7s linear infinite',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '22px 0',
  },
  dividerLine: { flex: 1, height: 1, background: tokens.color.hairline },
  dividerText: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: tokens.color.dim,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontFamily: tokens.font.body,
    fontSize: 15,
    color: tokens.color.ink,
    background: tokens.color.surfaceAlt,
    border: `1px solid ${tokens.color.hairline}`,
    borderRadius: tokens.radius.md,
    boxSizing: 'border-box',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  statusText: { fontSize: 13.5, color: tokens.color.muted },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    fontFamily: tokens.font.mono,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  pillDot: { width: 6, height: 6, borderRadius: '50%' },
  footer: {
    margin: '26px 0 0',
    paddingTop: 18,
    borderTop: `1px solid ${tokens.color.hairline}`,
    fontSize: 13,
    lineHeight: 1.5,
    color: tokens.color.dim,
  },
  footerEm: { color: tokens.color.muted, fontWeight: 600 },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
};

export default LoginSplash;
