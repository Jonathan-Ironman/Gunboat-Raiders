/**
 * WaveCounter presentation layer — style recipes and pure helpers.
 *
 * Extracted from `WaveCounter.tsx` so the component file exports only a
 * React component (satisfying `react-refresh/only-export-components`) and
 * so unit tests can import these values without pulling in React.
 *
 * All colors / fonts / shadows flow from `tokens.ts` — never hardcode.
 */

import { BG_DEEP, FONT_DISPLAY, GOLD } from './tokens';

/** Container style — centred top anchor, no text selection. */
export const waveCounterContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1.5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  textAlign: 'center',
  userSelect: 'none',
};

/**
 * Wave label style — Harbour Dawn display typography in brand gold.
 *
 * The label text is a single concatenated string (`"WAVE {n}"`), so the
 * gold accent applies to the full element. This matches the art direction's
 * top-anchored wave indicator treatment.
 */
export const waveCounterTextStyle: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 800,
  fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
  color: GOLD,
  textShadow: `0 2px 0 ${BG_DEEP}`,
  letterSpacing: '0.02em',
  margin: 0,
};

/**
 * Pure visibility predicate.
 *
 * @param wave current wave number from the game store
 * @returns true when the counter should render, false when it should return null
 */
export function shouldRenderWaveCounter(wave: number): boolean {
  return wave > 0;
}

/** Formats the wave counter text. */
export function formatWaveLabel(wave: number): string {
  return `WAVE ${String(wave)}`;
}
