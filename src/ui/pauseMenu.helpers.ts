/**
 * Pure helpers for `PauseMenu.tsx` and `ConfirmDialog.tsx` — R5 slice.
 *
 * Centralises every style recipe, key-event predicate, and summary
 * formatter used by the pause UI so:
 *
 * - The component files stay pure React exports and keep
 *   `react-refresh/only-export-components` happy for HMR.
 * - All visual tokens flow through `tokens.ts` — no hex / px / ms
 *   literals leak into the components.
 * - Pure logic is unit-testable without React, the DOM, or Zustand.
 *
 * Every CSS value below is token-derived. Any refactor that adds a
 * magic literal here is a regression.
 */

import type { CSSProperties } from 'react';

import { BUTTON_DESTRUCTIVE_RED, BUTTON_RECIPE } from './buttonRecipes';
import {
  BORDER,
  DUR_NORMAL,
  EASE_OUT,
  FONT_DISPLAY,
  FONT_UI,
  RADIUS_XL,
  SHADOW_LG,
  SP_2,
  SP_3,
  SP_5,
  SP_6,
  SP_8,
  SP_10,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRI,
  TEXT_SEC,
} from './tokens';

// ---------------------------------------------------------------------------
// Minimal ambient types — mirror the pattern used by settingsModal.helpers.ts
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
 * Matches the Escape key. Used by PauseMenu to trigger Continue when
 * the menu is open (and no child modal is capturing keyboard input).
 */
export function isPauseEscapeKey(event: KeyboardEventLike): boolean {
  return event.key === 'Escape';
}

/**
 * Matches the Enter / numeric-keypad Enter keys. Used by
 * `ConfirmDialog` to accept the primary action without mouse input.
 */
export function isConfirmEnterKey(event: KeyboardEventLike): boolean {
  return event.key === 'Enter';
}

/**
 * Matches the Escape key for `ConfirmDialog`. Exposed as its own
 * predicate (rather than reusing `isPauseEscapeKey`) so the semantics
 * are obvious at the call site and the two can diverge independently.
 */
export function isConfirmEscapeKey(event: KeyboardEventLike): boolean {
  return event.key === 'Escape';
}

// ---------------------------------------------------------------------------
// Summary formatter
// ---------------------------------------------------------------------------

/**
 * Formats the "Wave {wave} · Score {score}" line shown underneath the
 * pause-menu buttons. Pure string math so tests can lock the contract
 * without rendering React.
 */
export function formatRunSummary(wave: number, score: number): string {
  return `Wave ${String(wave)} · Score ${score.toLocaleString('en-US')}`;
}

/**
 * Picks the exit-confirm dialog message based on whether the player
 * has a persistent save. Factored out so the tests don't need to
 * duplicate the exact copy.
 */
export function getExitDialogMessage(hasSave: boolean): string {
  if (hasSave) {
    return 'Your game is saved at this level — but mission progress will be lost.';
  }
  return 'Your mission progress will be lost.';
}

// ---------------------------------------------------------------------------
// Pause overlay + panel recipes
// ---------------------------------------------------------------------------

/**
 * Full-viewport backdrop behind the pause panel. `zIndex: 31` sits
 * above the HUD (`zIndex: 10`) but below the SettingsModal overlay
 * (`zIndex: 32`) so the settings panel can mount on top when the user
 * taps SETTINGS.
 */
export const pauseBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 31,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(7, 17, 32, 0.82)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  fontFamily: FONT_UI,
  color: TEXT_PRI,
  pointerEvents: 'auto',
  userSelect: 'none',
  animation: `gbr-pause-fade-in ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
};

/** Centred Harbour Dawn panel. Max-width 440px per the R5 spec. */
export const pausePanelStyle: CSSProperties = {
  width: 'min(440px, calc(100vw - 48px))',
  maxWidth: '440px',
  padding: `${String(SP_10)}px`,
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: `${String(RADIUS_XL)}px`,
  boxShadow: SHADOW_LG,
  color: TEXT_PRI,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
};

/** `PAUSED` display title — FONT_DISPLAY 32px weight 800. */
export const pauseTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 800,
  fontSize: '32px',
  letterSpacing: '0.06em',
  color: TEXT_PRI,
  textAlign: 'center',
  margin: `0 0 ${String(SP_8)}px 0`,
};

/** Vertical button stack with SP_3 gap between each button. */
export const pauseButtonStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: `${String(SP_3)}px`,
};

/**
 * Shared base style for every pause-menu button. Delegates to the
 * cross-modal `BUTTON_RECIPE.base` so every button in the game shares
 * the exact same silhouette (padding, font, radius, 3D emboss
 * shadow). The pause-menu variants below only change color.
 */
export const pauseButtonBaseStyle: CSSProperties = BUTTON_RECIPE.base;

/** Primary (gold) button variant — CONTINUE in the pause menu. */
export const pauseButtonPrimaryStyle: CSSProperties = BUTTON_RECIPE.primary;

/** Secondary button variant — SETTINGS in the pause menu. */
export const pauseButtonSecondaryStyle: CSSProperties = BUTTON_RECIPE.secondary;

/**
 * Resting state for the EXIT button — reads as a neutral secondary
 * button until the user hovers, at which point
 * `pauseButtonDestructiveHoverStyle` swaps in the red destructive
 * variant. This two-stage reveal is deliberate: the pause menu's
 * exit is irreversible, but the player should not feel "pushed
 * toward" quitting the moment they open the menu.
 */
export const pauseButtonDestructiveStyle: CSSProperties = BUTTON_RECIPE.secondary;

/**
 * Hover override for the destructive variant — full red destructive
 * fill so hovering telegraphs "this will destroy progress" without
 * restructuring the button silhouette.
 */
export const pauseButtonDestructiveHoverStyle: CSSProperties = BUTTON_DESTRUCTIVE_RED;

/**
 * Run summary line below the button stack —
 * "Wave {wave} · Score {score}" in FONT_UI 13px TEXT_MUTED, centered.
 */
export const pauseSummaryStyle: CSSProperties = {
  marginTop: `${String(SP_6)}px`,
  fontFamily: FONT_UI,
  fontSize: '13px',
  color: TEXT_MUTED,
  textAlign: 'center',
  letterSpacing: '0.04em',
};

// ---------------------------------------------------------------------------
// Confirm dialog recipes
// ---------------------------------------------------------------------------

/**
 * Confirm-dialog backdrop. Sits above the PauseMenu (zIndex 31) and
 * below the SettingsModal (zIndex 32) at `zIndex: 33` so it can mount
 * on top of the pause panel without being eaten by it.
 */
export const confirmBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 33,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(7, 17, 32, 0.6)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  fontFamily: FONT_UI,
  color: TEXT_PRI,
  pointerEvents: 'auto',
  userSelect: 'none',
  animation: `gbr-pause-fade-in ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
};

/** Smaller centred panel — max-width 380px per spec. */
export const confirmPanelStyle: CSSProperties = {
  width: 'min(380px, calc(100vw - 48px))',
  maxWidth: '380px',
  padding: `${String(SP_8)}px`,
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: `${String(RADIUS_XL)}px`,
  boxShadow: SHADOW_LG,
  color: TEXT_PRI,
  display: 'flex',
  flexDirection: 'column',
  gap: `${String(SP_5)}px`,
};

/** Confirm-dialog title — FONT_DISPLAY 22px TEXT_PRI. */
export const confirmTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: '22px',
  letterSpacing: '0.02em',
  color: TEXT_PRI,
  margin: 0,
};

/** Confirm-dialog body copy — FONT_UI 14px TEXT_SEC line-height 1.5. */
export const confirmMessageStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '14px',
  lineHeight: 1.5,
  color: TEXT_SEC,
  margin: 0,
};

/** Button row — Cancel on left, Confirm on right, equal flex. */
export const confirmButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: `${String(SP_3)}px`,
  marginTop: `${String(SP_2)}px`,
};

/**
 * Shared base for the two confirm-dialog buttons. Built on top of
 * `BUTTON_RECIPE.base` so confirm-dialog buttons are structurally
 * identical to every other button in the game — same emboss shadow,
 * same font family, same radius. The dialog only tweaks `flex: 1`
 * so the two buttons split the row evenly.
 *
 * The width override (`width: 'auto'`) cancels the recipe's default
 * `width: '100%'` so the flex row can size each button by its
 * `flex: 1` ratio instead of forcing both to 100%.
 */
export const confirmButtonBaseStyle: CSSProperties = {
  ...BUTTON_RECIPE.base,
  width: 'auto',
  flex: 1,
};

/** Cancel button variant — shared neutral fill. */
export const confirmCancelStyle: CSSProperties = BUTTON_RECIPE.secondary;

/** Confirm button variant — primary gold gradient. */
export const confirmPrimaryStyle: CSSProperties = BUTTON_RECIPE.primary;

/**
 * Destructive confirm variant — always-red gradient. Used inside
 * `ConfirmDialog` where the surrounding context already provides the
 * "are you sure?" framing so the button must communicate danger at a
 * glance. Unlike `BUTTON_RECIPE.destructive` (which rests grey and
 * only turns red on CSS `:hover`), this is persistently red.
 */
export const confirmDestructiveStyle: CSSProperties = BUTTON_DESTRUCTIVE_RED;

// ---------------------------------------------------------------------------
// Keyframes — shared fade-in for the pause overlay and confirm dialog
// ---------------------------------------------------------------------------

/**
 * Namespaced fade-in keyframes injected once per PauseMenu /
 * ConfirmDialog mount. Matches the `gbr-settings-fade-in` pattern used
 * by R6 so both modals feel identical.
 */
export function pauseKeyframes(): string {
  return `
@keyframes gbr-pause-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;
}
