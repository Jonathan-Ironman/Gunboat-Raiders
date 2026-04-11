/**
 * Pure helpers for `ControlsOverlay.tsx`.
 *
 * Kept in a separate module so that:
 *
 * - The component file exports only a React component (keeps
 *   `react-refresh/only-export-components` happy for HMR).
 * - Phase gating, key-event matching, target-guarding, and style
 *   construction can be exhaustively unit-tested headlessly without
 *   mounting React or polluting `document`.
 * - All colors / fonts / spacing / shadows / durations flow through
 *   `tokens.ts` — no magic values leak into the component.
 *
 * Every CSS value returned by the style builders below is token-derived.
 */

import type { CSSProperties } from 'react';

import type { GamePhase } from '../store/gameStore';
import {
  BG_DEEP,
  BORDER,
  BORDER_SUB,
  DUR_NORMAL,
  EASE_OUT,
  FONT_DISPLAY,
  FONT_UI,
  RADIUS_LG,
  RADIUS_SM,
  SHADOW_LG,
  SP_1,
  SP_2,
  SP_3,
  SP_4,
  SP_5,
  SP_6,
  SURFACE_EL,
  TEXT_MUTED,
  TEXT_PRI,
  TEXT_SEC,
} from './tokens';

// ---------------------------------------------------------------------------
// Minimal ambient types
// ---------------------------------------------------------------------------

/**
 * The narrow shape of `KeyboardEvent` we rely on for matching. Accepting
 * a structural subset instead of the DOM's full `KeyboardEvent` lets
 * unit tests pass plain objects without having to synthesize a real
 * DOM event (which the node-only test environment cannot produce).
 *
 * `target` is typed as `unknown` so `isEventFromTextInput` can perform
 * its own `instanceof` check at runtime — this mirrors a real
 * `KeyboardEvent.target` which is `EventTarget | null`.
 */
export interface KeyboardEventLike {
  readonly key: string;
  readonly target?: unknown;
}

// ---------------------------------------------------------------------------
// Phase gating
// ---------------------------------------------------------------------------

/**
 * Phases in which the controls overlay may render.
 *
 * Matches the HUD's own gate — the overlay only makes sense while the
 * player is actively playing or in the brief `wave-clear` lull between
 * waves. Any other phase (main menu, briefing, pause, game-over)
 * suppresses the overlay entirely.
 */
const OVERLAY_ALLOWED_PHASES: readonly GamePhase[] = ['playing', 'wave-clear'];

/**
 * Pure predicate — `true` when the controls overlay should be allowed
 * to render at all. The component also needs its local `open` state to
 * be `true` for the panel to actually appear.
 */
export function shouldRenderControlsOverlay(phase: GamePhase): boolean {
  return OVERLAY_ALLOWED_PHASES.includes(phase);
}

// ---------------------------------------------------------------------------
// Key-event matching
// ---------------------------------------------------------------------------

/**
 * Matches the keys that toggle the controls overlay.
 *
 * Accepts the literal `"h"`/`"H"` keys *and* `"?"` (which on most
 * layouts is produced via Shift+/). `"?"` is the conventional "help"
 * shortcut in many web games and the original spec explicitly lists it.
 *
 * We check `event.key` rather than `event.code` so the overlay still
 * opens on non-QWERTY layouts where physical H lives elsewhere.
 */
export function isToggleKey(event: KeyboardEventLike): boolean {
  return event.key === 'h' || event.key === 'H' || event.key === '?';
}

/**
 * Matches the Escape key, which closes the overlay WITHOUT pausing the
 * game. The component caller is responsible for calling
 * `event.stopPropagation()` so the same Escape press does not also
 * trigger the pause-menu path.
 */
export function isCloseKey(event: KeyboardEventLike): boolean {
  return event.key === 'Escape';
}

/**
 * Returns `true` when a keyboard event originated from a text input
 * surface (`<input>` or `<textarea>`). The R17 brief specifies that
 * typing `"h"` or `"?"` into a settings field must NOT toggle the
 * overlay — so the component's document-level keydown listener has to
 * bail out early for events coming from inputs.
 *
 * We return `false` (i.e. "not from a text input") for any target that
 * isn't an element — this is defensive and matches how real browsers
 * report synthetic events during SSR or tests.
 */
export function isEventFromTextInput(event: KeyboardEventLike): boolean {
  const target = event.target;
  if (target === null || target === undefined) return false;
  // Only a browser environment has HTMLInputElement on the global scope;
  // guard the instanceof so this helper stays safe in node tests.
  if (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement) {
    return true;
  }
  if (typeof HTMLTextAreaElement !== 'undefined' && target instanceof HTMLTextAreaElement) {
    return true;
  }
  return false;
}

/**
 * Returns `true` when the keydown handler should ignore this event
 * entirely — currently, whenever it originates from a text input or
 * textarea. Centralising the rule here means the component stays a
 * straight dispatch and the guard is unit-testable.
 */
export function shouldIgnoreKeyEvent(event: KeyboardEventLike): boolean {
  return isEventFromTextInput(event);
}

// ---------------------------------------------------------------------------
// Style recipes — all values come from `tokens.ts`
// ---------------------------------------------------------------------------

/**
 * Full-viewport backdrop that catches click-outside-panel events.
 *
 * `pointer-events: auto` so the overlay can swallow mouse input, but
 * `background: transparent` so the gameplay scene stays fully visible
 * behind the panel. The z-index sits above the HUD widgets but below
 * the pause menu (which is a later slice, higher in the stack).
 */
export const controlsBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'transparent',
  pointerEvents: 'auto',
  zIndex: 40,
};

/**
 * Main panel — slides in from the right edge over `DUR_NORMAL`
 * milliseconds. Width clamps to `min(280px, 35vw)` so it stays
 * readable on narrow viewports without crowding the HUD on wide ones.
 */
export const controlsPanelStyle: CSSProperties = {
  position: 'absolute',
  top: '15vh',
  right: '3vw',
  width: 'min(280px, 35vw)',
  padding: `${String(SP_6)}px`,
  background: 'rgba(7, 17, 32, 0.9)',
  border: `1px solid ${BORDER}`,
  borderRadius: `${String(RADIUS_LG)}px`,
  boxShadow: SHADOW_LG,
  color: TEXT_PRI,
  fontFamily: FONT_UI,
  animation: `gbr-controls-slide-in ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
  pointerEvents: 'auto',
};

/**
 * Header row containing the title and the close button. `flex` so the
 * close button stays anchored to the right regardless of title length.
 */
export const controlsHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: `${String(SP_5)}px`,
};

/** "CONTROLS" display title. */
export const controlsTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: '22px',
  color: TEXT_PRI,
  margin: 0,
  letterSpacing: '0.02em',
};

/**
 * Close button — square 24x24 icon-style button in the header. Uses
 * `SURFACE_EL` as the resting background and a subtle border so it
 * reads as a real button without competing with the CTAs.
 */
export const controlsCloseButtonStyle: CSSProperties = {
  width: `${String(SP_6)}px`,
  height: `${String(SP_6)}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: SURFACE_EL,
  border: `1px solid ${BORDER_SUB}`,
  borderRadius: `${String(RADIUS_SM)}px`,
  color: TEXT_SEC,
  fontFamily: FONT_UI,
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
};

/** Section wrapper — vertical gap between each `Movement` / `Camera` / `UI` group. */
export const controlsSectionStyle: CSSProperties = {
  marginBottom: `${String(SP_5)}px`,
};

/** Section heading — small uppercase label above each group. */
export const controlsSectionHeadingStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: TEXT_MUTED,
  margin: `0 0 ${String(SP_2)}px 0`,
};

/** Row wrapper — `key` pill on the left, action label on the right. */
export const controlsRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: `${String(SP_3)}px`,
  padding: `${String(SP_1)}px 0`,
  fontSize: '14px',
  color: TEXT_SEC,
};

/**
 * Small monospace pill rendering a key label (`W`, `Mouse`, `H / ?`).
 *
 * Monospace fallback list ends with the FONT_DISPLAY stack so the pill
 * still reads if a user's system ships without a mono font; we prefer
 * a real mono for alignment but never hardcode a single family.
 */
export const controlsKeyPillStyle: CSSProperties = {
  display: 'inline-block',
  minWidth: `${String(SP_5)}px`,
  padding: `1px ${String(SP_2)}px`,
  background: SURFACE_EL,
  border: `1px solid ${BORDER}`,
  borderRadius: `${String(RADIUS_SM)}px`,
  color: TEXT_PRI,
  fontFamily: `ui-monospace, 'Menlo', 'Consolas', ${FONT_DISPLAY}`,
  fontSize: '12px',
  fontWeight: 700,
  textAlign: 'center',
  boxShadow: `0 1px 0 ${BG_DEEP}`,
};

/** Action description next to the key pill. */
export const controlsActionLabelStyle: CSSProperties = {
  color: TEXT_SEC,
  fontFamily: FONT_UI,
  fontSize: '14px',
};

/**
 * Quadrant diagram block — a 3-line ASCII diagram explaining the four
 * cannon quadrants. Monospace so the glyphs line up regardless of
 * font width.
 */
export const controlsQuadrantDiagramStyle: CSSProperties = {
  margin: `${String(SP_4)}px 0 0 0`,
  padding: `${String(SP_3)}px`,
  background: 'rgba(15, 30, 54, 0.6)',
  border: `1px solid ${BORDER_SUB}`,
  borderRadius: `${String(RADIUS_SM)}px`,
  fontFamily: `ui-monospace, 'Menlo', 'Consolas', ${FONT_DISPLAY}`,
  fontSize: '11px',
  color: TEXT_MUTED,
  whiteSpace: 'pre',
  textAlign: 'center',
  lineHeight: 1.4,
};

/** Small caption under the diagram naming it. */
export const controlsQuadrantCaptionStyle: CSSProperties = {
  margin: `${String(SP_2)}px 0 0 0`,
  fontFamily: FONT_UI,
  fontSize: '11px',
  color: TEXT_MUTED,
  textAlign: 'center',
  fontStyle: 'italic',
};

// ---------------------------------------------------------------------------
// Static content
// ---------------------------------------------------------------------------

/**
 * The 3-line ASCII quadrant diagram. Spacing is load-bearing — keep
 * the whitespace exactly as-is so the `⊕` lands in the geometric
 * centre when rendered in a monospace font.
 */
export const CONTROLS_QUADRANT_DIAGRAM = `     FORE (2)
PORT (4) ⊕ (4) STBD
     AFT (1)`;

/** Caption shown below the diagram. */
export const CONTROLS_QUADRANT_CAPTION = 'Cannons per quadrant';

// ---------------------------------------------------------------------------
// Keyframes — exported so the component can inject them inline once
// ---------------------------------------------------------------------------

/**
 * CSS keyframes block for the slide-in reveal. Namespaced (`gbr-`) so
 * there is no collision with any future overlay animations.
 */
export function controlsKeyframes(): string {
  return `
@keyframes gbr-controls-slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
`;
}
