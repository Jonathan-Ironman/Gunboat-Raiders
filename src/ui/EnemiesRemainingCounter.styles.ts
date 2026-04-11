/**
 * EnemiesRemainingCounter presentation layer — style recipes and pure helpers.
 *
 * Extracted from `EnemiesRemainingCounter.tsx` so the component file exports
 * only a React component (satisfying `react-refresh/only-export-components`)
 * and so unit tests can import these values without pulling in React.
 *
 * All colors / fonts / durations flow from `tokens.ts` — never hardcode.
 */

import { DUR_NORMAL, EASE_OUT, FONT_UI, TEXT_MUTED } from './tokens';

/**
 * Fixed position directly below the WaveCounter. The top offset is the
 * wave counter's top (`1.5rem`) plus approximately its rendered line
 * height so this line sits as a vertical pair beneath it.
 */
export const enemiesRemainingContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(1.5rem + 2.8rem)',
  left: '50%',
  transform: 'translateX(-50%)',
  textAlign: 'center',
  userSelect: 'none',
  transition: `opacity ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
};

/** Small uppercase muted caption — Harbour Dawn secondary-text style. */
export const enemiesRemainingTextStyle: React.CSSProperties = {
  fontFamily: FONT_UI,
  fontWeight: 700,
  fontSize: '0.85rem',
  color: TEXT_MUTED,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  margin: 0,
};

/**
 * Pure text formatter for the remaining count.
 *
 * @example
 *   formatEnemiesRemaining(4) // "4 REMAINING"
 *   formatEnemiesRemaining(0) // "0 REMAINING"
 */
export function formatEnemiesRemaining(remaining: number): string {
  return `${String(remaining)} REMAINING`;
}

/**
 * Pure opacity resolver — 1 while enemies are alive, 0 on wave-clear.
 * The component stays mounted at all times to avoid layout shift; the
 * CSS transition in the container style animates this change.
 */
export function getEnemiesRemainingOpacity(remaining: number): 0 | 1 {
  return remaining > 0 ? 1 : 0;
}
