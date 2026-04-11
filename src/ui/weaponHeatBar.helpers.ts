/**
 * Pure helpers for `WeaponHeatBar.tsx` — R13 slice.
 *
 * The WeaponHeatBar is a centered HUD readout that visualizes the player's
 * weapon overheat value (`player.weapons.heat` in `[0, 1]`). Its fill is
 * INVERTED — the bar drains as heat builds — and its color bracket changes
 * at `0.5` and `0.75`. When heat crosses `0.9` the label flips from `HEAT`
 * to `OVERHEATED` and pulses in red.
 *
 * These helpers are kept in a separate module so that:
 * - The component file stays a single React export, keeping
 *   `react-refresh/only-export-components` happy for HMR.
 * - The heat-to-color mapping, the inverted fill math, and the style
 *   construction are all unit-testable in a headless node environment
 *   without touching React.
 * - All color / duration / typography inputs flow through `tokens.ts`,
 *   preventing magic numbers or hex literals from leaking into the
 *   component file.
 */

import type { CSSProperties } from 'react';

import {
  BG_DEEP,
  BORDER_SUB,
  DUR_NORMAL,
  EASE_OUT,
  FONT_UI,
  GOLD,
  GOLD_DARK,
  RADIUS_SM,
  RED,
  RED_DARK,
  TEAL,
  TEAL_DARK,
  TEXT_MUTED,
} from './tokens';

// ---------------------------------------------------------------------------
// Thresholds — qualifiers for the tokens, not tokens themselves.
// ---------------------------------------------------------------------------

/** At or below this heat ratio, the bar stays in the "cool" (teal) bracket. */
export const HEAT_COOL_MAX = 0.5;
/** At or below this heat ratio (but above cool), the bar is "warm" (gold). */
export const HEAT_WARM_MAX = 0.75;
/**
 * Above this heat ratio the HEAT label flips to `OVERHEATED` and begins its
 * red opacity pulse. Strict inequality: exactly 0.9 still shows `HEAT`.
 */
export const HEAT_OVERHEATED_THRESHOLD = 0.9;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

/** Color bracket buckets for the heat bar fill. */
export type HeatBracket = 'cool' | 'warm' | 'hot';

/** Full visual state derived from the current heat ratio. */
export interface HeatBarVisualState {
  /** Width of the drained fill, `0..100` (inverted — 100 at heat=0). */
  fillWidthPct: number;
  /** Linear-gradient CSS string applied as the fill background. */
  gradientCss: string;
  /** Active color bracket, exposed as a data-attribute for tests. */
  heatBracket: HeatBracket;
  /** Label text (`HEAT` normally, `OVERHEATED` when heat > 0.9). */
  labelText: 'HEAT' | 'OVERHEATED';
  /** True when the pulse animation should be running on the label. */
  isOverheated: boolean;
}

// ---------------------------------------------------------------------------
// Gradient recipes — built at module load so we never duplicate the string.
// ---------------------------------------------------------------------------

/** Cool (green) gradient — low heat, everything is fine. */
export const HEAT_COOL_GRADIENT = `linear-gradient(90deg, ${TEAL}, ${TEAL_DARK})`;
/** Warm (amber) gradient — mid heat, start managing your fire. */
export const HEAT_WARM_GRADIENT = `linear-gradient(90deg, ${GOLD}, ${GOLD_DARK})`;
/** Hot (red) gradient — danger zone, stop firing or lock out. */
export const HEAT_HOT_GRADIENT = `linear-gradient(90deg, ${RED}, ${RED_DARK})`;

// ---------------------------------------------------------------------------
// Core state derivation
// ---------------------------------------------------------------------------

/**
 * Clamps `heat` into `[0, 1]` and coerces non-finite inputs to `0`. Exported
 * so the component can treat a missing selector result identically to a
 * zero-heat state without duplicating the guard.
 */
export function normalizeHeat(heat: number): number {
  if (!Number.isFinite(heat)) return 0;
  if (heat < 0) return 0;
  if (heat > 1) return 1;
  return heat;
}

/**
 * Pure function that maps a heat ratio into the exact visual state the
 * WeaponHeatBar will render. Single source of truth for the mapping; the
 * component itself does nothing more than destructure this output.
 *
 * Bracket boundaries are inclusive on the UPPER side:
 * - `heat <= 0.5`              → cool (teal)
 * - `0.5 < heat <= 0.75`       → warm (gold)
 * - `heat >  0.75`             → hot  (red)
 *
 * Overheated label / pulse trigger at `heat > 0.9` strictly.
 */
export function computeHeatBarState(heat: number): HeatBarVisualState {
  const h = normalizeHeat(heat);

  let heatBracket: HeatBracket;
  let gradientCss: string;
  if (h <= HEAT_COOL_MAX) {
    heatBracket = 'cool';
    gradientCss = HEAT_COOL_GRADIENT;
  } else if (h <= HEAT_WARM_MAX) {
    heatBracket = 'warm';
    gradientCss = HEAT_WARM_GRADIENT;
  } else {
    heatBracket = 'hot';
    gradientCss = HEAT_HOT_GRADIENT;
  }

  // Inverted: the bar DRAINS as heat builds. At heat=0 the fill is 100%,
  // at heat=1 the fill is 0%. Round to 4 decimal places so IEEE-754 quirks
  // like `(1 - 0.85) * 100 === 15.000000000000002` don't leak into DOM
  // width strings or test assertions. 4dp is well below any visible step
  // at 240px width (0.0001% = 0.00024px).
  const fillWidthPct = Math.round((1 - h) * 10000) / 100;

  const isOverheated = h > HEAT_OVERHEATED_THRESHOLD;
  const labelText: 'HEAT' | 'OVERHEATED' = isOverheated ? 'OVERHEATED' : 'HEAT';

  return {
    fillWidthPct,
    gradientCss,
    heatBracket,
    labelText,
    isOverheated,
  };
}

// ---------------------------------------------------------------------------
// Layout constants — qualifiers for the Harbour Dawn spec
// ---------------------------------------------------------------------------

/** Container width in px, locked by the R13 spec. */
export const BAR_WIDTH_PX = 240;
/** Container height in px, locked by the R13 spec. */
export const BAR_HEIGHT_PX = 12;
/** Font size for the `HEAT` / `OVERHEATED` label. */
export const LABEL_FONT_SIZE_PX = 10;
/** Letter spacing for the uppercase label, in `em`. */
export const LABEL_LETTER_SPACING_EM = 0.08;
/** Gap between the label and the bar track, in px. */
export const LABEL_GAP_PX = 4;
/** Distance from the bottom of the viewport, per spec. */
export const BAR_BOTTOM_REM = 6.5;

// ---------------------------------------------------------------------------
// Pulse animation (scoped to this component)
// ---------------------------------------------------------------------------

/** CSS class applied to the label while the weapon is overheated. */
export const OVERHEAT_PULSE_CLASS = 'gbr-heat-label-pulse';
/** Keyframes animation name, prefixed to avoid collisions with other overlays. */
export const OVERHEAT_PULSE_ANIMATION_NAME = 'gbr-heat-label-pulse-kf';
/**
 * Pulse period for the `OVERHEATED` label. Spec says 0.6s alternate infinite —
 * this is the only place in the module where a duration is not a token: the
 * spec fixes it at 600ms regardless of the global `DUR_*` scale.
 */
export const OVERHEAT_PULSE_DURATION_MS = 600;

/**
 * Returns the `<style>` contents for the overheat label pulse. Fades opacity
 * from `0.5` to `1.0` and back on an alternate-infinite cycle.
 */
export function weaponHeatBarKeyframes(): string {
  return `
@keyframes ${OVERHEAT_PULSE_ANIMATION_NAME} {
  from { opacity: 0.5; }
  to   { opacity: 1; }
}
.${OVERHEAT_PULSE_CLASS} {
  animation: ${OVERHEAT_PULSE_ANIMATION_NAME} ${String(OVERHEAT_PULSE_DURATION_MS)}ms ${EASE_OUT} infinite alternate;
}
`;
}

// ---------------------------------------------------------------------------
// Style builders
// ---------------------------------------------------------------------------

/**
 * Returns the outer container style. Absolutely positioned at
 * `bottom: 6.5rem` and horizontally centered via `left: 50% + translateX(-50%)`.
 * The container is 240×12 px with a column-flex layout so the label sits
 * above the bar track.
 */
export function buildContainerStyle(): CSSProperties {
  return {
    position: 'absolute',
    bottom: `${String(BAR_BOTTOM_REM)}rem`,
    left: '50%',
    transform: 'translateX(-50%)',
    width: `${String(BAR_WIDTH_PX)}px`,
    fontFamily: FONT_UI,
    userSelect: 'none',
    pointerEvents: 'none',
    // Column stack so the label sits above the bar track.
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };
}

/**
 * Returns the label style. Colors swap between `TEXT_MUTED` (normal) and
 * `RED` (overheated). The overheated variant additionally receives the
 * `OVERHEAT_PULSE_CLASS` via the component's className assignment.
 */
export function buildLabelStyle(isOverheated: boolean): CSSProperties {
  return {
    color: isOverheated ? RED : TEXT_MUTED,
    fontFamily: FONT_UI,
    fontSize: `${String(LABEL_FONT_SIZE_PX)}px`,
    fontWeight: 800,
    letterSpacing: `${String(LABEL_LETTER_SPACING_EM)}em`,
    textTransform: 'uppercase',
    marginBottom: `${String(LABEL_GAP_PX)}px`,
    // Color transition matches the bar width transition so a heat spike
    // that crosses 0.9 reads as a single coordinated change.
    transition: `color ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
  };
}

/**
 * Returns the track (outer shell) style. This is the 240×12 px "empty" bar
 * shape — solid deep background, subtle 1px border, small radius. Padding
 * is zero so the fill div reads as a flush progress bar.
 */
export function buildTrackStyle(): CSSProperties {
  return {
    position: 'relative',
    width: `${String(BAR_WIDTH_PX)}px`,
    height: `${String(BAR_HEIGHT_PX)}px`,
    background: BG_DEEP,
    border: `1px solid ${BORDER_SUB}`,
    borderRadius: `${String(RADIUS_SM)}px`,
    padding: 0,
    overflow: 'hidden',
  };
}

/**
 * Returns the fill style for a given visual state. The fill width AND the
 * background gradient both transition over `DUR_NORMAL` ease-out so heat
 * changes produce a smooth, coordinated animation across bracket crossings.
 */
export function buildFillStyle(state: HeatBarVisualState): CSSProperties {
  return {
    width: `${String(state.fillWidthPct)}%`,
    height: '100%',
    background: state.gradientCss,
    borderRadius: `${String(RADIUS_SM)}px`,
    transition: `width ${String(DUR_NORMAL)}ms ${EASE_OUT}, background ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
    willChange: 'width',
  };
}
