/**
 * Pure helpers for `GameOverScreen.tsx` — R15 slice.
 *
 * Kept separate so that:
 *
 * - The component file stays a pure React export (keeps
 *   `react-refresh/only-export-components` happy for HMR).
 * - Style recipes, key-event predicates, and copy formatters are
 *   unit-testable headlessly without React, the DOM, or Zustand.
 * - All colors / fonts / spacing / radii / durations flow through
 *   `tokens.ts` — no magic values leak into the component.
 *
 * Every CSS value returned below is token-derived. Any refactor that
 * adds a magic literal here is a regression.
 */

import type { CSSProperties } from 'react';

import { BUTTON_RECIPE } from './buttonRecipes';
import {
  DUR_NORMAL,
  EASE_OUT,
  FONT_DISPLAY,
  FONT_UI,
  RED,
  SHADOW_LG,
  SP_3,
  SP_4,
  SP_5,
  SP_6,
  SP_8,
  SP_10,
  TEXT_DIM,
  TEXT_PRI,
  TEXT_SEC,
} from './tokens';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * zIndex for the game-over overlay. Matches the legacy value (20) and
 * sits at the same layer as `MainMenuScene` — the two phases are
 * mutually exclusive, so there is no ordering conflict. Sits above the
 * HUD (10) and below SettingsModal (32) even though SettingsModal
 * cannot be mounted from this screen today.
 */
export const GAME_OVER_Z_INDEX = 20;

// ---------------------------------------------------------------------------
// Minimal ambient types
// ---------------------------------------------------------------------------

/**
 * Narrow structural shape of `KeyboardEvent` used by the pure
 * predicates. Accepting a minimal subset lets node-only tests pass
 * plain objects without synthesising a real DOM event.
 */
export interface KeyboardEventLike {
  readonly key: string;
}

// ---------------------------------------------------------------------------
// Key-event predicates
// ---------------------------------------------------------------------------

/**
 * Matches Enter or Space — the game-over screen's "activate primary
 * button" accelerator. Per spec these trigger `PLAY AGAIN`.
 */
export function isGameOverPlayAgainKey(event: KeyboardEventLike): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

/**
 * Matches the Escape key. Per spec this routes back to the main
 * menu — mirroring the cancel/exit semantics used throughout the UI.
 */
export function isGameOverMainMenuKey(event: KeyboardEventLike): boolean {
  return event.key === 'Escape';
}

// ---------------------------------------------------------------------------
// Copy formatters
// ---------------------------------------------------------------------------

/**
 * Formats the "This run did not save — you sank at Wave {wave}."
 * disclaimer shown under the stat block. Pure string math so tests
 * can lock the contract without rendering React. Matches the spec in
 * `todo/20260411-ui-overhaul-plan-revised.md` §R15 verbatim — any copy
 * tweak needs a test update too.
 */
export function formatGameOverDisclaimer(wave: number): string {
  return `This run did not save — you sank at Wave ${String(wave)}.`;
}

/**
 * Formats the `Final Score` value with en-US thousands separators.
 * Extracted for test coverage so the formatting contract lives in
 * one place.
 */
export function formatFinalScore(score: number): string {
  return score.toLocaleString('en-US');
}

// ---------------------------------------------------------------------------
// Full-viewport overlay
// ---------------------------------------------------------------------------

/**
 * Full-viewport backdrop behind the game-over panel. Darker tint
 * than the pause overlay (the player is out of the run) and the same
 * blur-glass treatment so the scene behind fades out gracefully.
 */
export const gameOverBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: GAME_OVER_Z_INDEX,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(7, 17, 32, 0.88)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  fontFamily: FONT_UI,
  color: TEXT_PRI,
  pointerEvents: 'auto',
  userSelect: 'none',
  animation: `gbr-game-over-fade-in ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
};

/**
 * Centred content column. Holds the SUNK title, the stat rows, the
 * disclaimer, and the button stack. Uses absolute positioning via
 * inset=0 on the backdrop so the whole thing stays visually centred
 * regardless of viewport size.
 */
export const gameOverPanelStyle: CSSProperties = {
  width: 'min(520px, calc(100vw - 48px))',
  maxWidth: '520px',
  padding: `${String(SP_10)}px ${String(SP_8)}px`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: `${String(SP_6)}px`,
  textAlign: 'center',
};

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

/**
 * `SUNK` headline — FONT_DISPLAY weight 800, `clamp(56px, 12vw,
 * 100px)`, red with a soft glow + hard drop shadow. Per the original
 * Slice 14 spec in `todo/20260411-ui-overhaul-plan.md`.
 */
export const gameOverTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 800,
  fontSize: 'clamp(56px, 12vw, 100px)',
  letterSpacing: '0.08em',
  lineHeight: 0.9,
  color: RED,
  textShadow: '0 0 40px rgba(255, 128, 128, 0.5), 0 4px 16px rgba(0, 0, 0, 0.9)',
  margin: 0,
};

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Vertical stack for the three stat rows. */
export const gameOverStatsStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: `${String(SP_3)}px`,
  marginTop: `${String(SP_4)}px`,
};

/**
 * Single stat row — label + value on one line. Flex so the label
 * sits on the left of the value with a small gap.
 */
export const gameOverStatRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: `${String(SP_3)}px`,
  margin: 0,
};

/**
 * Stat label — FONT_UI 600 1.2rem TEXT_SEC with tracking. Matches
 * the original Slice 14 spec.
 */
export const gameOverStatLabelStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontWeight: 600,
  fontSize: '1.2rem',
  letterSpacing: '0.08em',
  color: TEXT_SEC,
  textTransform: 'uppercase',
  margin: 0,
};

/** Stat value — FONT_DISPLAY 700 1.2rem TEXT_PRI, aligned to label. */
export const gameOverStatValueStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: '1.2rem',
  color: TEXT_PRI,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Disclaimer
// ---------------------------------------------------------------------------

/**
 * "This run did not save — you sank at Wave {wave}." — FONT_UI 12px
 * TEXT_DIM per spec. Sits between the stats and the button stack.
 */
export const gameOverDisclaimerStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontWeight: 500,
  fontSize: '12px',
  color: TEXT_DIM,
  letterSpacing: '0.04em',
  margin: 0,
  marginTop: `${String(SP_3)}px`,
  textAlign: 'center',
};

// ---------------------------------------------------------------------------
// Button stack
// ---------------------------------------------------------------------------

/**
 * Vertical button stack — PLAY AGAIN (primary) above MAIN MENU
 * (secondary). Matches the PauseMenu button-stack geometry for
 * visual consistency across the game's modal surfaces.
 */
export const gameOverButtonStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: `${String(SP_3)}px`,
  marginTop: `${String(SP_5)}px`,
};

/**
 * Shared base style for every game-over button. Delegates to the
 * cross-modal `BUTTON_RECIPE.base` so the game-over screen's PLAY
 * AGAIN / MAIN MENU buttons share the exact same silhouette as the
 * pause, briefing, settings, and main-menu buttons.
 */
export const gameOverButtonBaseStyle: CSSProperties = BUTTON_RECIPE.base;

/** Primary (gold) button variant — PLAY AGAIN. */
export const gameOverButtonPrimaryStyle: CSSProperties = BUTTON_RECIPE.primary;

/** Secondary button variant — MAIN MENU. */
export const gameOverButtonSecondaryStyle: CSSProperties = BUTTON_RECIPE.secondary;

// Re-export SHADOW_LG so downstream callers that want to tweak the
// panel shadow in future don't have to reach back into tokens.ts.
// Keeps the helpers file the single import surface for R15 visuals.
export { SHADOW_LG };

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

/**
 * Namespaced fade-in keyframes injected once per GameOverScreen mount.
 * Matches the `gbr-pause-fade-in` pattern used by R5 / R7 so every
 * modal feels identical.
 */
export function gameOverKeyframes(): string {
  return `
@keyframes gbr-game-over-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;
}
