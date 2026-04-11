/**
 * Pure helpers for `LowHullWarning.tsx`.
 *
 * These are kept in a separate module so that:
 * - The component file stays a single React export (keeps
 *   `react-refresh/only-export-components` happy for HMR).
 * - Thresholding, intensity, and style construction can be unit-tested
 *   in a pure headless node environment without touching React.
 * - All color / duration / threshold inputs flow through `tokens.ts`,
 *   preventing magic numbers from leaking into the component.
 */

import type { CSSProperties } from 'react';

import { DUR_SLOW, EASE_OUT, HULL_CRITICAL_THRESHOLD, RED_DARK } from './tokens';

// ---------------------------------------------------------------------------
// Local constants — numbers that qualify the tokens but are not tokens
// themselves. They live here so `tokens.ts` stays lean.
// ---------------------------------------------------------------------------

/** Radial gradient inner stop (%): fully transparent inside this radius. */
const VIGNETTE_INNER_STOP_PCT = 40;
/** Peak vignette alpha at the viewport edge when intensity = 1.0. */
const VIGNETTE_PEAK_ALPHA = 0.35;
/** Lower bound of the opacity pulse as a multiplier on intensity. */
const PULSE_MIN_MULTIPLIER = 0.5;
/** Upper bound of the opacity pulse as a multiplier on intensity. */
const PULSE_MAX_MULTIPLIER = 1.0;
/**
 * Full pulse period. Uses `DUR_SLOW` (500ms) twice — one half-cycle fade
 * in, one half-cycle fade out — for an approximately 1-second heartbeat.
 */
const PULSE_DURATION_MS = DUR_SLOW * 2;
/** CSS animation name — prefixed to avoid collisions with other overlays. */
export const PULSE_ANIMATION_NAME = 'gbr-low-hull-pulse';
/** CSS custom property name used to parameterize the pulse per-render. */
export const INTENSITY_CSS_VAR = '--gbr-low-hull-intensity' as const;

// ---------------------------------------------------------------------------
// Extended style type — models the single custom property this module owns
// ---------------------------------------------------------------------------

/**
 * `CSSProperties` extended with the single CSS custom property consumed
 * by the low-hull pulse keyframes. Declaring it at the type level means
 * consumers stay type-safe without any runtime assertions.
 */
export type LowHullOverlayStyle = CSSProperties & {
  '--gbr-low-hull-intensity': string;
};

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the current hull ratio is STRICTLY below the
 * Harbour Dawn critical threshold. Equal-to-threshold does NOT trigger
 * the warning, matching the spec's acceptance criteria and keeping the
 * transition crisp.
 *
 * Degenerate inputs (non-finite numbers, non-positive `hullMax`) return
 * `false` — the vignette is a gameplay accent and must never render for
 * malformed state.
 */
export function shouldShowLowHullWarning(hull: number, hullMax: number): boolean {
  if (!Number.isFinite(hull) || !Number.isFinite(hullMax)) return false;
  if (hullMax <= 0) return false;
  if (hull <= 0) return true;
  return hull / hullMax < HULL_CRITICAL_THRESHOLD;
}

/**
 * Maps hull into a `[0, 1]` intensity value, used both for the inline
 * color alpha and for the CSS custom property consumed by the pulse
 * keyframes.
 *
 * - Hull at or above the critical threshold → `0` (no warning).
 * - Hull at or below zero → `1` (maximum warning).
 * - Linear ramp in between, so a barely-critical hull barely pulses and
 *   a near-death hull pulses hard.
 */
export function computeLowHullIntensity(hull: number, hullMax: number): number {
  if (!Number.isFinite(hull) || !Number.isFinite(hullMax)) return 0;
  if (hullMax <= 0) return 0;
  const ratio = Math.max(0, hull) / hullMax;
  if (ratio >= HULL_CRITICAL_THRESHOLD) return 0;
  const remapped = 1 - ratio / HULL_CRITICAL_THRESHOLD;
  return Math.min(1, Math.max(0, remapped));
}

// ---------------------------------------------------------------------------
// Color helper
// ---------------------------------------------------------------------------

/**
 * Converts a `#rrggbb` hex literal and a unit-interval alpha into an
 * `rgba(...)` CSS color. Exists so color stops remain token-driven: the
 * caller passes `RED_DARK`, never a raw `(204, 51, 51)` tuple.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(a)})`;
}

// ---------------------------------------------------------------------------
// Style builders
// ---------------------------------------------------------------------------

/**
 * Builds the inline style for the vignette overlay. Intensity controls
 * both the peak vignette alpha AND the CSS custom property that drives
 * the opacity pulse keyframes, so the warning gets visibly worse as hull
 * drops toward zero.
 */
export function lowHullOverlayStyle(intensity: number): LowHullOverlayStyle {
  const clamped = Math.min(1, Math.max(0, intensity));
  const peak = hexToRgba(RED_DARK, VIGNETTE_PEAK_ALPHA * clamped);
  return {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 5,
    background: `radial-gradient(ellipse at center, transparent ${String(VIGNETTE_INNER_STOP_PCT)}%, ${peak} 100%)`,
    animation: `${PULSE_ANIMATION_NAME} ${String(PULSE_DURATION_MS)}ms ${EASE_OUT} infinite alternate`,
    [INTENSITY_CSS_VAR]: String(clamped),
    willChange: 'opacity',
  };
}

/**
 * Returns the `@keyframes` CSS block for the low-hull pulse animation.
 * The keyframes read the `--gbr-low-hull-intensity` custom property so
 * a single static definition works for every intensity level — one set
 * of keyframes per page, not per render.
 */
export function lowHullKeyframes(): string {
  return `
@keyframes ${PULSE_ANIMATION_NAME} {
  0%   { opacity: calc(var(${INTENSITY_CSS_VAR}, 0) * ${String(PULSE_MIN_MULTIPLIER)}); }
  100% { opacity: calc(var(${INTENSITY_CSS_VAR}, 0) * ${String(PULSE_MAX_MULTIPLIER)}); }
}
`;
}
