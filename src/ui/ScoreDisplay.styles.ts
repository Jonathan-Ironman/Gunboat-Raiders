/**
 * ScoreDisplay presentation layer — style recipes and pure helpers.
 *
 * Extracted from `ScoreDisplay.tsx` so the component file exports only a
 * React component (satisfying `react-refresh/only-export-components`) and
 * so unit tests can import these values without pulling in React.
 *
 * All colors / fonts flow from `tokens.ts` — never hardcode.
 */

import { FONT_DISPLAY, FONT_UI, GOLD, TEXT_MUTED } from './tokens';

/** Top-right container — label-above-value layout. */
export const scoreDisplayContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1.5rem',
  right: '2rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  userSelect: 'none',
};

/** Small muted "SCORE" caption. */
export const scoreDisplayLabelStyle: React.CSSProperties = {
  fontFamily: FONT_UI,
  fontWeight: 700,
  fontSize: '10px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: TEXT_MUTED,
  margin: 0,
  lineHeight: 1,
};

/** Main numeric display — Baloo 2, bold, brand gold. */
export const scoreDisplayValueStyle: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 800,
  fontSize: 'clamp(1.1rem, 2.8vw, 1.8rem)',
  color: GOLD,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
  margin: 0,
};

/**
 * Formats the score for display with locale thousands separators.
 *
 * @example
 *   formatScore(12450) // "12,450"
 *   formatScore(0)     // "0"
 */
export function formatScore(value: number): string {
  return value.toLocaleString('en-US');
}
