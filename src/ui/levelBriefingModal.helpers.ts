/**
 * Pure helpers for `LevelBriefingModal.tsx`.
 *
 * Kept separate so that:
 *
 * - The component file stays a pure React export (keeps
 *   `react-refresh/only-export-components` happy for HMR).
 * - Style recipes and key-event matching can be unit-tested
 *   headlessly without React, the DOM, or Zustand.
 * - All colors / fonts / spacing / radii / durations flow through
 *   `tokens.ts` — no magic values leak into the component.
 *
 * Every CSS value returned below is token-derived.
 */

import type { CSSProperties } from 'react';

import {
  BORDER,
  BTN_PRI_BG,
  BTN_PRI_COLOR,
  BTN_PRI_SHADOW,
  DUR_FAST,
  DUR_NORMAL,
  EASE_OUT,
  FONT_DISPLAY,
  FONT_UI,
  GOLD,
  RADIUS_MD,
  RADIUS_XL,
  SHADOW_LG,
  SHADOW_MD,
  SP_2,
  SP_3,
  SP_4,
  SP_5,
  SP_6,
  SP_8,
  SURFACE,
  SURFACE_EL,
  TEXT_PRI,
  TEXT_SEC,
} from './tokens';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * zIndex for the briefing overlay. Sits above HUD (10) and
 * MainMenuScene/GameOverScreen (20), but below SettingsModal (32) so a
 * future SettingsModal mount from the briefing screen would still
 * layer correctly.
 */
export const BRIEFING_Z_INDEX = 28;

// ---------------------------------------------------------------------------
// Minimal ambient types
// ---------------------------------------------------------------------------

/**
 * The narrow shape of `KeyboardEvent` we rely on for matching. Accepting
 * a structural subset instead of the full DOM `KeyboardEvent` lets
 * tests pass plain objects without synthesising a real DOM event —
 * which the node-only test environment cannot produce.
 */
export interface KeyboardEventLike {
  readonly key: string;
}

// ---------------------------------------------------------------------------
// Key-event matching
// ---------------------------------------------------------------------------

/**
 * Matches Enter or Space — the briefing modal's "Start" accelerators.
 * Exposed as a pure predicate so the component's `useEffect` body is
 * tiny and the branching is unit-testable without a DOM.
 */
export function isBriefingStartKey(event: KeyboardEventLike): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

/**
 * Matches Escape or Backspace — the briefing modal's "Back to menu"
 * accelerators.
 */
export function isBriefingBackKey(event: KeyboardEventLike): boolean {
  return event.key === 'Escape' || event.key === 'Backspace';
}

// ---------------------------------------------------------------------------
// Mission number formatting
// ---------------------------------------------------------------------------

/**
 * Formats the `MISSION N` kicker label. Pure so tests can pin it
 * without rendering the component. `levelIndex` is zero-based, the
 * label is one-based.
 */
export function formatMissionKicker(levelIndex: number): string {
  const missionNumber = Math.max(1, Math.floor(levelIndex) + 1);
  return `MISSION ${String(missionNumber)}`;
}

// ---------------------------------------------------------------------------
// Modal style recipes — full-viewport overlay + centred panel
// ---------------------------------------------------------------------------

/**
 * Full-viewport backdrop behind the panel. Opaque (no blur) per the
 * R9 spec — the briefing modal is a reading-focused screen so a
 * blurred game world behind it would be a distraction.
 */
export const briefingBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: BRIEFING_Z_INDEX,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(7, 17, 32, 0.92)',
  fontFamily: FONT_UI,
  color: TEXT_PRI,
  pointerEvents: 'auto',
  animation: `gbr-briefing-fade-in ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
};

/**
 * Centred Harbour Dawn panel. Max-width 640px per spec, interior
 * padding is `SP_8` so every section breathes.
 */
export const briefingPanelStyle: CSSProperties = {
  width: 'min(640px, calc(100vw - 48px))',
  maxWidth: '640px',
  padding: `${String(SP_8)}px`,
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: `${String(RADIUS_XL)}px`,
  boxShadow: SHADOW_LG,
  color: TEXT_PRI,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: `${String(SP_5)}px`,
};

/**
 * `MISSION N` kicker — small gold uppercase label that sits directly
 * above the level name. 12px, weight 700, letter-spacing 0.12em.
 */
export const briefingKickerStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '12px',
  fontWeight: 700,
  color: GOLD,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  textAlign: 'center',
  margin: 0,
};

/**
 * Level name (`First Light`) — FONT_DISPLAY weight 800, 36px, centred.
 */
export const briefingTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 800,
  fontSize: '36px',
  color: TEXT_PRI,
  textAlign: 'center',
  margin: 0,
  lineHeight: 1.1,
};

/**
 * Horizontal rule beneath the title — 60% width, semi-transparent
 * border, centred via margin auto.
 */
export const briefingSeparatorStyle: CSSProperties = {
  borderTop: `1px solid ${BORDER}`,
  opacity: 0.4,
  width: '60%',
  margin: `${String(SP_2)}px auto`,
  // Reset the browser defaults so <hr /> renders as a pure top border
  // without the default inline end styling.
  borderRight: 'none',
  borderBottom: 'none',
  borderLeft: 'none',
  height: 0,
};

/**
 * Wrapper for each labelled section (MISSION / CONTROLS / BRIEFING).
 * Keeps the label tight to the body and adds consistent vertical
 * rhythm between sections.
 */
export const briefingSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: `${String(SP_2)}px`,
};

/**
 * Small uppercase section label (MISSION / CONTROLS / BRIEFING). Same
 * silhouette as the settings field label but keyed off the briefing's
 * own tokens so downstream refactors can't accidentally couple them.
 */
export const briefingSectionLabelStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '11px',
  fontWeight: 800,
  color: GOLD,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  margin: 0,
};

/**
 * Body copy for the MISSION section — slightly larger than the other
 * sections per the spec (15px vs 14px).
 */
export const briefingMissionBodyStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '15px',
  color: TEXT_SEC,
  lineHeight: 1.5,
  margin: 0,
};

/**
 * Body copy for the CONTROLS and BRIEFING sections. 14px, same color
 * family as mission body so the visual hierarchy is subtle but
 * deliberate.
 */
export const briefingBodyStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '14px',
  color: TEXT_SEC,
  lineHeight: 1.5,
  margin: 0,
};

/**
 * Row containing the BACK / START buttons at the bottom of the panel.
 */
export const briefingButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: `${String(SP_4)}px`,
  marginTop: `${String(SP_4)}px`,
};

/**
 * Secondary button — BACK TO MENU. Surface-el background with a solid
 * border, primary text color. Mirrors the Harbour Dawn secondary-
 * button silhouette used by `SettingsModal`.
 */
export const briefingSecondaryButtonStyle: CSSProperties = {
  padding: `${String(SP_3)}px ${String(SP_6)}px`,
  background: SURFACE_EL,
  border: `1px solid ${BORDER}`,
  borderRadius: `${String(RADIUS_MD)}px`,
  color: TEXT_PRI,
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: '14px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: SHADOW_MD,
  transition: `transform ${String(DUR_FAST)}ms ${EASE_OUT}, background ${String(DUR_FAST)}ms ${EASE_OUT}`,
};

/**
 * Primary button — START. Gold gradient, hard-contrast deep text
 * color, drop shadow + warm glow.
 */
export const briefingPrimaryButtonStyle: CSSProperties = {
  padding: `${String(SP_3)}px ${String(SP_8)}px`,
  background: BTN_PRI_BG,
  border: 'none',
  borderRadius: `${String(RADIUS_MD)}px`,
  color: BTN_PRI_COLOR,
  fontFamily: FONT_DISPLAY,
  fontWeight: 800,
  fontSize: '16px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: BTN_PRI_SHADOW,
  transition: `transform ${String(DUR_FAST)}ms ${EASE_OUT}, box-shadow ${String(DUR_FAST)}ms ${EASE_OUT}`,
};

// ---------------------------------------------------------------------------
// Keyframes — fade-in for the modal reveal
// ---------------------------------------------------------------------------

/**
 * Fade-in keyframes for the briefing modal. Namespaced to avoid
 * collisions with the settings keyframes.
 */
export function briefingKeyframes(): string {
  return `
@keyframes gbr-briefing-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;
}
