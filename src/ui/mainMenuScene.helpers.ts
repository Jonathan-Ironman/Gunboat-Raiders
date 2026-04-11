/**
 * Pure helpers for `MainMenuScene.tsx` — R7 slice.
 *
 * Kept separate so that:
 *
 * - The component file stays a pure React export (keeps
 *   `react-refresh/only-export-components` happy for HMR).
 * - Style recipes and key-event matching are unit-testable headlessly
 *   without React, the DOM, or Zustand.
 * - All colors / fonts / spacing / radii / durations flow through
 *   `tokens.ts` — no magic values leak into the component.
 *
 * Every CSS value returned below is token-derived.
 */

import type { CSSProperties } from 'react';

import { BUTTON_RECIPE } from './buttonRecipes';
import {
  BG,
  BG_DEEP,
  DUR_MEDIUM,
  EASE_OUT,
  FONT_DISPLAY,
  FONT_UI,
  GOLD,
  SP_3,
  SP_5,
  SP_6,
  TEXT_DIM,
  TEXT_PRI,
} from './tokens';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * zIndex for the main menu overlay. Sits above the HUD (10) and the
 * briefing modal (28) would never mount at the same time, but below
 * SettingsModal (32) so the modal can stack on top when opened from
 * the main menu. Value chosen to match the legacy `TitleScreen` (20)
 * so any still-queried overlay ordering continues to work.
 */
export const MAIN_MENU_Z_INDEX = 20;

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
 * Matches Enter or Space — the main menu's "activate topmost button"
 * accelerators. Per spec, Enter / Space trigger whichever button is
 * currently the topmost enabled action (Continue when save present,
 * New Game otherwise).
 */
export function isMainMenuActivateKey(event: KeyboardEventLike): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

// ---------------------------------------------------------------------------
// Full-viewport overlay — gradient fade, NO backdrop blur
// ---------------------------------------------------------------------------

/**
 * Full-viewport backdrop covering the canvas. Unlike the PauseMenu
 * overlay, the main menu uses a linear gradient fade so the showcase
 * scene stays sharp at the top of the screen and darkens towards the
 * bottom where the menu buttons live. NO `backdropFilter` — the
 * showcase water must remain crisp.
 */
export const mainMenuBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: MAIN_MENU_Z_INDEX,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  // Leave vertical placement to the section-level styles so each
  // region (title / tagline / buttons / footer) sits at its own
  // percentage of the viewport.
  justifyContent: 'flex-start',
  background: `linear-gradient(150deg, transparent 0%, ${BG} 70%, ${BG_DEEP} 100%)`,
  fontFamily: FONT_UI,
  color: TEXT_PRI,
  pointerEvents: 'auto',
  userSelect: 'none',
  animation: `gbr-main-menu-fade-in ${String(DUR_MEDIUM)}ms ${EASE_OUT}`,
};

// ---------------------------------------------------------------------------
// Title block
// ---------------------------------------------------------------------------

/**
 * Vertical wrapper around the title + tagline. Placed near the top
 * third of the viewport to leave breathing room for the water behind.
 */
export const mainMenuTitleBlockStyle: CSSProperties = {
  position: 'absolute',
  top: '22vh',
  left: 0,
  right: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
};

/**
 * `GUNBOAT RAIDERS` display title — FONT_DISPLAY weight 800. Uses
 * `clamp(56px, 9vw, 92px)` per spec so the title scales from phone
 * landscape up to 4K without ever going off-screen. Double-layer
 * text shadow: a hard `0 4px 0` drop plus a soft `0 8px 32px` glow
 * for depth.
 */
export const mainMenuTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 800,
  fontSize: 'clamp(56px, 9vw, 92px)',
  letterSpacing: '0.03em',
  lineHeight: 0.9,
  color: TEXT_PRI,
  textShadow: '0 4px 0 #04101e, 0 8px 32px rgba(0, 0, 0, 0.6)',
  margin: 0,
  textAlign: 'center',
};

/**
 * Tagline beneath the title — "Survive the waves. Sink the rest." in
 * uppercase gold body font.
 */
export const mainMenuTaglineStyle: CSSProperties = {
  marginTop: `${String(SP_5)}px`,
  fontFamily: FONT_UI,
  fontWeight: 700,
  fontSize: '16px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: GOLD,
  textAlign: 'center',
};

// ---------------------------------------------------------------------------
// Button stack
// ---------------------------------------------------------------------------

/**
 * Vertical button stack positioned centrally at `top: 55vh`. The
 * absolute positioning lets the footer sit at its own anchor at the
 * bottom of the viewport without having to thread a flex layout
 * through the whole overlay.
 */
export const mainMenuButtonStackStyle: CSSProperties = {
  position: 'absolute',
  top: '55vh',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: `${String(SP_3)}px`,
  // Constrain the button stack to a sensible width so buttons stay
  // comfortable on ultra-wide monitors. 260px matches the Firefly
  // main menu silhouette.
  width: 'min(260px, calc(100vw - 64px))',
};

/**
 * Shared base style for every main-menu button. Delegates to the
 * cross-modal `BUTTON_RECIPE.base` so every button in the game —
 * across main menu, pause, briefing, game-over, settings, confirm —
 * renders with the exact same silhouette.
 */
export const mainMenuButtonBaseStyle: CSSProperties = BUTTON_RECIPE.base;

/** Primary (gold) button variant — the topmost enabled action. */
export const mainMenuButtonPrimaryStyle: CSSProperties = BUTTON_RECIPE.primary;

/**
 * Secondary button variant — shared neutral fill. Intentionally uses
 * the same 3D emboss silhouette as the primary variant so the only
 * visual difference is the fill color, never the button structure.
 */
export const mainMenuButtonSecondaryStyle: CSSProperties = BUTTON_RECIPE.secondary;

/**
 * Disabled Continue button — greyed out, no hover effect, no
 * pointer cursor. Spec: `opacity: 0.4`, `cursor: not-allowed`,
 * `aria-disabled="true"`. Uses the shared disabled variant so its
 * silhouette matches every other button in the game.
 */
export const mainMenuButtonDisabledStyle: CSSProperties = BUTTON_RECIPE.disabled;

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

/**
 * Footer row — pinned to the bottom of the viewport with the
 * submission credit on the left and the version number on the right.
 */
export const mainMenuFooterStyle: CSSProperties = {
  position: 'absolute',
  bottom: `${String(SP_5)}px`,
  left: `${String(SP_6)}px`,
  right: `${String(SP_6)}px`,
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontFamily: FONT_UI,
  fontSize: '11px',
  color: TEXT_DIM,
  letterSpacing: '0.04em',
};

/** Footer text — uniform styling for both left and right labels. */
export const mainMenuFooterTextStyle: CSSProperties = {
  margin: 0,
  color: TEXT_DIM,
  fontFamily: FONT_UI,
  fontSize: '11px',
  letterSpacing: '0.04em',
};

// ---------------------------------------------------------------------------
// Static footer copy
// ---------------------------------------------------------------------------

/** Bottom-left submission credit line. */
export const MAIN_MENU_FOOTER_CREDIT = 'Three.js Water Pro Giveaway 2026';
/** Bottom-right version number placeholder. */
export const MAIN_MENU_VERSION = 'v0.1.0';

// ---------------------------------------------------------------------------
// Exit dialog copy (reused by the New Game confirm when a save exists)
// ---------------------------------------------------------------------------

/** Title for the "overwrite existing save" confirmation dialog. */
export const MAIN_MENU_NEW_GAME_CONFIRM_TITLE = 'Start a new game?';
/** Body copy for the "overwrite existing save" confirmation dialog. */
export const MAIN_MENU_NEW_GAME_CONFIRM_MESSAGE = 'Your existing save will be overwritten.';

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

/**
 * Fade-in keyframes for the main menu reveal. Namespaced to avoid
 * collisions with pause / settings / briefing keyframes so inlining
 * each modal's `<style>` block never triggers a CSS clash.
 */
export function mainMenuKeyframes(): string {
  return `
@keyframes gbr-main-menu-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;
}
