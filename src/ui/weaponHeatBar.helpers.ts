/**
 * Pure helpers for `WeaponHeatBar.tsx` — post playtest 2026-04-11.
 *
 * The WeaponHeatBar is a SEGMENTED HUD readout that visualizes the
 * player's weapon overheat value (`player.weapons.heat` in `[0, 1]`) as a
 * row of discrete vertical blocks (the same visual language as the
 * Harbour Dawn ammo-slot pill in `docs/art-direction/index.html`, reused
 * for heat management). Blocks fill from left to right as heat builds.
 *
 * Color bracket still shifts between teal / gold / red at `0.5` and
 * `0.75`, and the label flips from `HEAT` to `OVERHEATED` (in red,
 * pulsing) when heat exceeds `0.9`.
 *
 * Layout (post playtest 2026-04-11): the bar is stacked at the top-left
 * of the viewport, above the armor + hull bars. HUD.tsx does not own the
 * stacking — each component self-positions at a predictable `top` offset.
 *
 * These helpers are kept in a separate module so that:
 * - The component file stays a single React export, keeping
 *   `react-refresh/only-export-components` happy for HMR.
 * - The heat-to-segment mapping, bracket logic, and style construction
 *   are all unit-testable in a headless node environment without touching
 *   React.
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

/**
 * Number of segmented blocks rendered in the heat bar. Matches the
 * ammo-pill density from the Harbour Dawn reference doc (6) scaled up to
 * give heat management finer granularity — 10 reads as a clean "tenths"
 * indicator while staying compact at the top-left of the HUD.
 */
export const HEAT_SEGMENT_COUNT = 10;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

/** Color bracket buckets for the heat bar fill. */
export type HeatBracket = 'cool' | 'warm' | 'hot';

/** Full visual state derived from the current heat ratio. */
export interface HeatBarVisualState {
  /**
   * Integer count of blocks that should render in the "filled" state,
   * `0..HEAT_SEGMENT_COUNT`. Monotonic in heat — higher heat fills more.
   */
  filledSegments: number;
  /** Active color bracket, used for styling filled segments and data-attrs. */
  heatBracket: HeatBracket;
  /**
   * Linear-gradient CSS string applied to each filled segment's
   * background. Matches the bracket color at the current heat.
   */
  gradientCss: string;
  /** Label text (`HEAT` normally, `OVERHEATED` when heat > 0.9). */
  labelText: 'HEAT' | 'OVERHEATED';
  /** True when the pulse animation should be running on the label. */
  isOverheated: boolean;
}

// ---------------------------------------------------------------------------
// Gradient recipes — built at module load so we never duplicate the string.
// ---------------------------------------------------------------------------

/** Cool (green) gradient — low heat, everything is fine. */
export const HEAT_COOL_GRADIENT = `linear-gradient(180deg, ${TEAL}, ${TEAL_DARK})`;
/** Warm (amber) gradient — mid heat, start managing your fire. */
export const HEAT_WARM_GRADIENT = `linear-gradient(180deg, ${GOLD}, ${GOLD_DARK})`;
/** Hot (red) gradient — danger zone, stop firing or lock out. */
export const HEAT_HOT_GRADIENT = `linear-gradient(180deg, ${RED}, ${RED_DARK})`;

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
 * WeaponHeatBar will render. Single source of truth for the mapping.
 *
 * Bracket boundaries are inclusive on the UPPER side:
 * - `heat <= 0.5`              → cool (teal)
 * - `0.5 < heat <= 0.75`       → warm (gold)
 * - `heat >  0.75`             → hot  (red)
 *
 * Overheated label / pulse trigger at `heat > 0.9` strictly.
 *
 * Segment fill rounds to the nearest whole block, so a heat value of
 * `0.55` with 10 segments fills 6 blocks, `0.05` fills 1. This keeps the
 * visual monotonic and never shows a half-lit block mid-value.
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

  // Round to the nearest block so the bar reads as integer "tenths".
  // Clamp to [0, HEAT_SEGMENT_COUNT] defensively even though normalizeHeat
  // already constrains the input.
  const rounded = Math.round(h * HEAT_SEGMENT_COUNT);
  const filledSegments = Math.max(0, Math.min(HEAT_SEGMENT_COUNT, rounded));

  const isOverheated = h > HEAT_OVERHEATED_THRESHOLD;
  const labelText: 'HEAT' | 'OVERHEATED' = isOverheated ? 'OVERHEATED' : 'HEAT';

  return {
    filledSegments,
    gradientCss,
    heatBracket,
    labelText,
    isOverheated,
  };
}

// ---------------------------------------------------------------------------
// Layout constants — qualifiers for the Harbour Dawn spec
// ---------------------------------------------------------------------------

/** Width of a single heat segment block, in px. Matches ammo-slot spec. */
export const SEGMENT_WIDTH_PX = 14;
/** Height of a single heat segment block, in px. Matches ammo-slot spec. */
export const SEGMENT_HEIGHT_PX = 18;
/** Gap between adjacent heat segment blocks, in px. */
export const SEGMENT_GAP_PX = 4;
/** Corner radius for each segment, in px (matches ammo-slot look). */
export const SEGMENT_RADIUS_PX = 2;

/**
 * Full track width in px, computed from the segment geometry. Used by the
 * container so the outer box sits flush against the segment row.
 */
export const TRACK_WIDTH_PX =
  HEAT_SEGMENT_COUNT * SEGMENT_WIDTH_PX + (HEAT_SEGMENT_COUNT - 1) * SEGMENT_GAP_PX;

/** Font size for the `HEAT` / `OVERHEATED` label. */
export const LABEL_FONT_SIZE_PX = 10;
/** Letter spacing for the uppercase label, in `em`. */
export const LABEL_LETTER_SPACING_EM = 0.08;
/** Gap between the label and the segment row, in px. */
export const LABEL_GAP_PX = 4;

/** Distance from the top of the viewport to the container, per spec. */
export const BAR_TOP_REM = 2;
/** Distance from the left of the viewport to the container, per spec. */
export const BAR_LEFT_REM = 2;

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
 * `top: 2rem / left: 2rem` — the top-left slot of the HUD stack, above
 * the armor + hull bars.
 */
export function buildContainerStyle(): CSSProperties {
  return {
    position: 'absolute',
    top: `${String(BAR_TOP_REM)}rem`,
    left: `${String(BAR_LEFT_REM)}rem`,
    width: `${String(TRACK_WIDTH_PX)}px`,
    fontFamily: FONT_UI,
    userSelect: 'none',
    pointerEvents: 'none',
    // Column stack so the label sits above the segment row.
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
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
    // Color transition matches the segment transition so a heat spike
    // that crosses 0.9 reads as a single coordinated change.
    transition: `color ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
  };
}

/**
 * Returns the track (segment row) style. This is the horizontal flex
 * container that holds the N discrete segment blocks. Uses no background
 * or border of its own — the segments themselves carry all the visual
 * weight, matching the ammo-pill reference in the design doc.
 */
export function buildTrackStyle(): CSSProperties {
  return {
    position: 'relative',
    width: `${String(TRACK_WIDTH_PX)}px`,
    height: `${String(SEGMENT_HEIGHT_PX)}px`,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: `${String(SEGMENT_GAP_PX)}px`,
    padding: 0,
  };
}

/**
 * Returns the style for an individual segment block. Filled segments get
 * the bracket-coloured gradient; empty segments are drawn in BG_DEEP with
 * a subtle BORDER_SUB outline (identical to `.ammo-spent`).
 */
export function buildSegmentStyle(args: { filled: boolean; gradient: string }): CSSProperties {
  const { filled, gradient } = args;
  return {
    width: `${String(SEGMENT_WIDTH_PX)}px`,
    height: `${String(SEGMENT_HEIGHT_PX)}px`,
    borderRadius: `${String(SEGMENT_RADIUS_PX)}px`,
    background: filled ? gradient : BG_DEEP,
    border: filled ? 'none' : `1px solid ${BORDER_SUB}`,
    // Small box-sizing pin so the border doesn't grow the segment past
    // the flex track width and kick the row to two lines.
    boxSizing: 'border-box',
    transition: `background ${String(DUR_NORMAL)}ms ${EASE_OUT}, border ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
  };
}

/**
 * Hands the RADIUS_SM token back for tests that want to assert the
 * container still references the tokens module at module load. Kept
 * because the old API exported RADIUS_SM indirectly via fill/track
 * styles — consumers that imported it through this file should still
 * have a stable path.
 */
export const HEAT_BAR_RADIUS = RADIUS_SM;
