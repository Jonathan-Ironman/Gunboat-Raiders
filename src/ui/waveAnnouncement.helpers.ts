/**
 * Pure helpers for the `WaveAnnouncement` overlay (Harbour Dawn — Slice R16).
 *
 * `WaveAnnouncement` is a full-screen overlay that announces the wave-clear
 * beat: "WAVE CLEARED" flashes in, then swaps to "WAVE {n+1} INCOMING", then
 * fades out. The visual logic is expressed as a tiny local state machine
 * driven by elapsed milliseconds so that it remains testable in the
 * headless node environment that `tests/unit/` runs under.
 *
 * ALL numeric constants (durations, offsets, sizes, colors) resolve through
 * `src/ui/tokens.ts` — this module MUST NOT introduce magic numbers or
 * hardcoded hex strings of its own.
 *
 * Consumed by:
 *   - `src/ui/WaveAnnouncement.tsx` (React component)
 *   - `tests/unit/waveAnnouncement.test.ts` (headless unit tests)
 */

import type { CSSProperties } from 'react';

import {
  BG_DEEP,
  DUR_MEDIUM,
  DUR_NORMAL,
  DUR_SLOW,
  EASE_OUT,
  EASE_SPRING,
  FONT_DISPLAY,
  GOLD,
  SHADOW_LG,
  TEXT_PRI,
  type HexColor,
} from './tokens';

// ---------------------------------------------------------------------------
// Timing constants (ms) — all derived from motion tokens
// ---------------------------------------------------------------------------

/**
 * Duration of the "WAVE CLEARED" headline beat before it swaps to
 * "WAVE {n+1} INCOMING". Composed as `3 * DUR_SLOW` (1500ms) which matches
 * the Slice 12 spec without introducing a new motion token.
 */
export const WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS = 3 * DUR_SLOW;

/**
 * Duration of the "WAVE {n+1} INCOMING" headline beat before the overlay
 * begins its exit animation. Also `3 * DUR_SLOW` (1500ms) so the total
 * overlay lifetime lines up with the ~3-second `wave-clear` store phase.
 */
export const WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS = 3 * DUR_SLOW;

/**
 * Duration of the exit fade (overlay opacity 1 -> 0). Uses `DUR_NORMAL`
 * (200ms) which is the standard UI panel hide timing.
 */
export const WAVE_ANNOUNCEMENT_EXIT_MS = DUR_NORMAL;

/**
 * Total lifetime of the overlay from mount to removal. Consumers use this
 * to schedule the final `set('done')` timer. Equals clear-hold + incoming-
 * hold + exit = 3200ms.
 */
export const WAVE_ANNOUNCEMENT_TOTAL_MS =
  WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS + WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS + WAVE_ANNOUNCEMENT_EXIT_MS;

// ---------------------------------------------------------------------------
// Sub-phase state machine
// ---------------------------------------------------------------------------

/**
 * Local visual sub-phase of the WaveAnnouncement overlay. Drives which
 * headline is visible and whether the overlay is playing its exit fade.
 *
 * - `clear`    — "WAVE CLEARED" headline is visible (0 .. 1500ms).
 * - `incoming` — "WAVE {n+1} INCOMING" headline is visible (1500 .. 3000ms).
 * - `exit`     — overlay fading out (3000 .. 3200ms).
 * - `done`     — component should return null (>= 3200ms).
 */
export type WaveAnnouncementSubPhase = 'clear' | 'incoming' | 'exit' | 'done';

/**
 * Pure, deterministic sub-phase resolver. Given the number of milliseconds
 * since the overlay mounted, returns which sub-phase should be visible.
 *
 * Non-finite / negative input clamps to the initial `clear` sub-phase so
 * the overlay always has a well-defined starting state.
 */
export function computeWaveAnnouncementSubPhase(elapsedMs: number): WaveAnnouncementSubPhase {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 'clear';
  if (elapsedMs < WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS) return 'clear';
  if (elapsedMs < WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS + WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS) {
    return 'incoming';
  }
  if (elapsedMs < WAVE_ANNOUNCEMENT_TOTAL_MS) return 'exit';
  return 'done';
}

// ---------------------------------------------------------------------------
// Phase gate
// ---------------------------------------------------------------------------

/**
 * The overlay is only visible while the store is in the `wave-clear` phase.
 * Kept as a separate helper so tests can assert the gate without importing
 * the store.
 */
export function shouldRenderWaveAnnouncement(phase: string): boolean {
  return phase === 'wave-clear';
}

// ---------------------------------------------------------------------------
// Text formatting
// ---------------------------------------------------------------------------

/** "WAVE CLEARED" — fixed copy for sub-phase 1. */
export const WAVE_CLEARED_HEADLINE = 'WAVE CLEARED';

/**
 * "WAVE {n+1} INCOMING" — copy for sub-phase 2. Takes the current wave
 * number and returns the label for the *next* wave. Defends against
 * non-finite / negative inputs by falling back to wave 1.
 */
export function formatIncomingHeadline(currentWave: number): string {
  const safe = Number.isFinite(currentWave) && currentWave >= 0 ? Math.floor(currentWave) : 0;
  return `WAVE ${String(safe + 1)} INCOMING`;
}

// ---------------------------------------------------------------------------
// Style builders — overlay root
// ---------------------------------------------------------------------------

/**
 * Height of each letterbox bar as a CSS length. 8vh matches the Slice 12
 * spec and is expressed in viewport units so it scales across resolutions.
 */
export const LETTERBOX_HEIGHT = '8vh';

/**
 * Full-viewport overlay root. Pointer-events none so the overlay never
 * blocks underlying HUD interactions, and positioned as a sibling of the
 * HUD to guarantee it paints above other HUD elements.
 */
export function waveAnnouncementRootStyle(opacity: number): CSSProperties {
  const safeOpacity = Math.min(1, Math.max(0, opacity));
  return {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 20,
    opacity: safeOpacity,
    transition: `opacity ${String(WAVE_ANNOUNCEMENT_EXIT_MS)}ms ${EASE_OUT}`,
    fontFamily: FONT_DISPLAY,
  };
}

// ---------------------------------------------------------------------------
// Style builders — letterbox bars
// ---------------------------------------------------------------------------

/**
 * Top letterbox bar. Animates from `top: -8vh` (off-screen) to `top: 0`
 * (visible) using a `DUR_MEDIUM` ease-out transition. `visible === true`
 * yields the in-place state; `visible === false` yields the off-screen
 * state used for the mount and exit frames.
 */
export function letterboxTopStyle(visible: boolean): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    top: visible ? 0 : `-${LETTERBOX_HEIGHT}`,
    height: LETTERBOX_HEIGHT,
    background: BG_DEEP,
    boxShadow: SHADOW_LG,
    transition: `top ${String(DUR_MEDIUM)}ms ${EASE_OUT}`,
  };
}

/**
 * Bottom letterbox bar — mirror of `letterboxTopStyle`. Animates from
 * `bottom: -8vh` to `bottom: 0`.
 */
export function letterboxBottomStyle(visible: boolean): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: visible ? 0 : `-${LETTERBOX_HEIGHT}`,
    height: LETTERBOX_HEIGHT,
    background: BG_DEEP,
    boxShadow: SHADOW_LG,
    transition: `bottom ${String(DUR_MEDIUM)}ms ${EASE_OUT}`,
  };
}

// ---------------------------------------------------------------------------
// Style builders — headlines
// ---------------------------------------------------------------------------

/**
 * Headline color. The `incoming` headline uses the brand `GOLD` accent to
 * telegraph urgency; the `cleared` headline is primary text white.
 */
export function headlineColor(subPhase: WaveAnnouncementSubPhase): HexColor {
  return subPhase === 'incoming' ? GOLD : TEXT_PRI;
}

/**
 * Base headline style — centered vertically and horizontally relative to
 * the overlay root. `visible === true` yields the settled state; when
 * false the headline is scaled up and fully transparent so the scale-in
 * entrance animation has somewhere to start from.
 */
export function headlineStyle(subPhase: WaveAnnouncementSubPhase, visible: boolean): CSSProperties {
  return {
    position: 'absolute',
    top: '40vh',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
    fontWeight: 800,
    fontSize: 'clamp(48px, 8vw, 80px)',
    letterSpacing: '0.02em',
    color: headlineColor(subPhase),
    textShadow: `0 3px 0 ${BG_DEEP}`,
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(1.3)',
    transition:
      `opacity ${String(DUR_MEDIUM)}ms ${EASE_OUT}, ` +
      `transform ${String(DUR_MEDIUM)}ms ${EASE_SPRING}`,
  };
}

/**
 * CSS class name applied to the currently-visible headline. Exposed as a
 * constant so tests can assert the animation hook without matching inline
 * styles character-for-character.
 */
export const HEADLINE_ACTIVE_CLASS = 'gbr-wave-announcement-headline-active';
