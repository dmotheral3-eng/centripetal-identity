/**
 * Usage instrumentation for this surface.
 *
 * The instrumentation is unconditional; the SENDING is not. If the key is
 * absent at build time this module initialises nothing and every call is a
 * no-op — no network request, no console noise, no half-configured client
 * sitting in the page pretending to work. `analyticsState` exists so the two
 * states can be told apart from the artifact rather than from the source —
 * check the artifact, not the intention.
 *
 * This is an auth surface (sign-in + gate), not a marketing page: autocapture
 * and session recording are both off. Only a default pageview is captured —
 * nothing that records field input.
 */

import posthog from 'posthog-js';

const KEY = (import.meta.env.VITE_POSTHOG_KEY ?? '').trim();
const HOST = (import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com').trim();

export type AnalyticsState = 'sending' | 'no-key';

export const analyticsState: AnalyticsState = KEY ? 'sending' : 'no-key';

let started = false;

export function startAnalytics(): void {
  if (started || !KEY) return;
  started = true;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    autocapture: false,
    disable_session_recording: true,
    persistence: 'memory',
  });
}
