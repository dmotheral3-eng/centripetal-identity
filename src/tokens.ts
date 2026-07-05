/**
 * Centripetal Visual Standard — Token Set B (Light Editorial v2, P#79).
 * The login surface is an operator surface rendered in light mode.
 * These tokens are the single source of truth for LoginSplash styling.
 */
export const tokens = {
  color: {
    bg: '#FAF6F0',        // warm cream background
    surface: '#FFFFFF',   // card / panel
    surfaceAlt: '#FDFBF7',
    ink: '#1a1a1a',       // primary text
    muted: '#57534e',     // secondary text
    dim: '#8a857d',       // tertiary / captions
    hairline: '#E7E0D6',  // warm hairline border
    accent: '#059669',    // green accent (the signature)
    accentInk: '#047857', // accent hover / pressed
    // status pill semantics
    good: '#059669',
    goodBg: '#ECFDF5',
    wait: '#B45309',
    waitBg: '#FEF3C7',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    neutral: '#57534e',
    neutralBg: '#F1EDE6',
  },
  font: {
    // Consuming apps load these families; graceful fallbacks below.
    display: '"Fraunces", "Georgia", serif',
    body: '"IBM Plex Sans", system-ui, -apple-system, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace',
  },
  radius: { sm: 8, md: 12, lg: 18 },
  shadow: {
    card: '0 1px 2px rgba(26,26,26,0.04), 0 12px 32px -12px rgba(26,26,26,0.12)',
  },
} as const;

export type Tokens = typeof tokens;
