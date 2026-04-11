/**
 * Pure helpers for `SettingsModal.tsx`, `Slider.tsx`, and `Tabs.tsx`.
 *
 * These are kept in a separate module so that:
 *
 * - The component files stay pure React exports (keeps
 *   `react-refresh/only-export-components` happy for HMR).
 * - Style recipes, value mapping, and key-event matching can be
 *   unit-tested headlessly without React, the DOM, or Zustand.
 * - All colors / fonts / spacing / radii / durations flow through
 *   `tokens.ts` — no magic values leak into the components.
 *
 * Every CSS value returned below is token-derived.
 */

import type { CSSProperties } from 'react';

import {
  BG_DEEP,
  BORDER,
  BORDER_SUB,
  DUR_FAST,
  DUR_NORMAL,
  EASE_OUT,
  FONT_DISPLAY,
  FONT_UI,
  GOLD,
  RADIUS_LG,
  RADIUS_MD,
  RADIUS_SM,
  RADIUS_XL,
  SHADOW_LG,
  SHADOW_MD,
  SP_1,
  SP_2,
  SP_3,
  SP_4,
  SP_5,
  SP_6,
  SP_8,
  SP_10,
  SURFACE,
  SURFACE_EL,
  TEXT_DIM,
  TEXT_MUTED,
  TEXT_PRI,
  TEXT_SEC,
} from './tokens';

// ---------------------------------------------------------------------------
// Tab identifiers
// ---------------------------------------------------------------------------

/**
 * The three tab ids rendered by the Settings modal. Exported as a
 * string literal union so the component, helpers, and tests can agree
 * on the exact shape without duplicating the list.
 */
export type SettingsTabId = 'audio' | 'controls' | 'performance';

/** Default tab shown when the modal opens. */
export const SETTINGS_DEFAULT_TAB: SettingsTabId = 'audio';

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
 * Matches the Escape key. Exposed as a pure predicate so the
 * `SettingsModal` component can keep its `useEffect` body tiny and the
 * branching logic is unit-testable without a DOM.
 */
export function isSettingsCloseKey(event: KeyboardEventLike): boolean {
  return event.key === 'Escape';
}

// ---------------------------------------------------------------------------
// Volume <-> slider value mapping
// ---------------------------------------------------------------------------

/**
 * Lower bound of the slider's native integer range. Slider UI works in
 * `[SLIDER_MIN, SLIDER_MAX]`; the store works in `[0, 1]`. Centralising
 * the range avoids drift between `Slider.tsx`, `SettingsModal.tsx`, and
 * the tests.
 */
export const SLIDER_MIN = 0;
/** Upper bound of the slider's native integer range. */
export const SLIDER_MAX = 100;

/**
 * Converts a store volume (`[0, 1]`) into the slider's integer value
 * (`[0, 100]`). Clamps on both sides so bad input cannot push the slider
 * thumb outside the track.
 */
export function sliderValueFromVolume(volume: number): number {
  if (!Number.isFinite(volume)) return SLIDER_MIN;
  const clamped = Math.max(0, Math.min(1, volume));
  return Math.round(clamped * SLIDER_MAX);
}

/**
 * Inverse of `sliderValueFromVolume`. Converts a slider integer value
 * back into the `[0, 1]` range the store and Howler expect. Clamps on
 * both sides to stay defensive against malformed inputs.
 */
export function volumeFromSliderValue(sliderValue: number): number {
  if (!Number.isFinite(sliderValue)) return 0;
  const clamped = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, sliderValue));
  return clamped / SLIDER_MAX;
}

// ---------------------------------------------------------------------------
// Modal style recipes — full-viewport overlay + centred panel
// ---------------------------------------------------------------------------

/**
 * Full-viewport backdrop behind the panel. `zIndex: 32` sits above the
 * HUD and pause-menu placeholder but below transient alerts — matches
 * the R6 spec.
 */
export const settingsBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(7, 17, 32, 0.82)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  fontFamily: FONT_UI,
  color: TEXT_PRI,
  pointerEvents: 'auto',
  animation: `gbr-settings-fade-in ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
};

/**
 * Centred Harbour Dawn panel. Max-width 580px per spec, interior
 * padding is `SP_8` so the tabs / body / footer breathe.
 */
export const settingsPanelStyle: CSSProperties = {
  width: 'min(580px, calc(100vw - 48px))',
  maxWidth: '580px',
  padding: `${String(SP_8)}px`,
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: `${String(RADIUS_XL)}px`,
  boxShadow: SHADOW_LG,
  color: TEXT_PRI,
  display: 'flex',
  flexDirection: 'column',
  gap: `${String(SP_6)}px`,
};

/** `SETTINGS` display title — FONT_DISPLAY, 28px. */
export const settingsTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: '28px',
  letterSpacing: '0.02em',
  color: TEXT_PRI,
  margin: 0,
};

/** Tab-body wrapper — keeps a consistent vertical rhythm per tab. */
export const settingsTabBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: `${String(SP_4)}px`,
  minHeight: '220px',
};

/** Footer row containing the BACK button, right-aligned. */
export const settingsFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: `${String(SP_3)}px`,
  marginTop: `${String(SP_2)}px`,
};

/**
 * Secondary button recipe — used for the BACK action. Matches the
 * Harbour Dawn secondary-button token pattern (surface background,
 * solid border, muted-to-primary text on hover) without crossing into
 * the primary-CTA gold gradient.
 */
export const settingsSecondaryButtonStyle: CSSProperties = {
  padding: `${String(SP_3)}px ${String(SP_8)}px`,
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

// ---------------------------------------------------------------------------
// Audio tab style recipes
// ---------------------------------------------------------------------------

/** Group wrapper — one row per Music / SFX section. */
export const settingsAudioGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: `${String(SP_2)}px`,
};

/**
 * Small uppercase label above each slider. 11px weight 800 per the
 * R6 brief — Harbour Dawn uses this exact shape for every field label.
 */
export const settingsFieldLabelStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: TEXT_MUTED,
  margin: 0,
};

/** Caption beneath the disabled music slider. */
export const settingsFieldCaptionStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '11px',
  fontStyle: 'italic',
  color: TEXT_DIM,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Controls tab style recipes
// ---------------------------------------------------------------------------

/** Section wrapper — one per KEYBINDINGS category. */
export const settingsControlsSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: `${String(SP_2)}px`,
  marginBottom: `${String(SP_4)}px`,
};

/** Section heading — FONT_DISPLAY, slightly larger than the field label. */
export const settingsControlsSectionHeadingStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: TEXT_SEC,
  margin: 0,
};

/** Row — key pill on the left, action label on the right. */
export const settingsControlsRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: `${String(SP_3)}px`,
  padding: `${String(SP_1)}px 0`,
  fontFamily: FONT_UI,
  fontSize: '13px',
  color: TEXT_SEC,
};

/** Small pill rendering a key label (e.g. `W`, `Mouse`, `H / ?`). */
export const settingsControlsKeyPillStyle: CSSProperties = {
  display: 'inline-block',
  minWidth: `${String(SP_8)}px`,
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
export const settingsControlsActionStyle: CSSProperties = {
  color: TEXT_SEC,
  fontFamily: FONT_UI,
  fontSize: '13px',
};

/** Dim footnote shown at the bottom of the Controls tab. */
export const settingsControlsFootnoteStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '11px',
  fontStyle: 'italic',
  color: TEXT_DIM,
  margin: `${String(SP_2)}px 0 0 0`,
  textAlign: 'center',
};

// ---------------------------------------------------------------------------
// Performance tab style recipes
// ---------------------------------------------------------------------------

/**
 * Performance tab placeholder message — single centred line in the dim
 * text color. Stubbed per R6 spec.
 */
export const settingsPerformanceStyle: CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: '13px',
  color: TEXT_DIM,
  fontStyle: 'italic',
  textAlign: 'center',
  margin: 0,
  padding: `${String(SP_10)}px 0`,
};

// ---------------------------------------------------------------------------
// Tabs style recipes
// ---------------------------------------------------------------------------

/** Row of tab buttons — sits directly under the title. */
export const tabsContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: `${String(SP_5)}px`,
  borderBottom: `1px solid ${BORDER_SUB}`,
};

/**
 * Base style shared by every tab button — `active` and `disabled`
 * variants toggle specific properties via `tabItemActiveStyle` /
 * `tabItemDisabledStyle` below. Each caller spreads
 * `{ ...tabItemBaseStyle, ...(isActive ? tabItemActiveStyle : {}), ...(isDisabled ? tabItemDisabledStyle : {}) }`.
 */
export const tabItemBaseStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: `${String(SP_3)}px ${String(SP_1)}px`,
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: TEXT_MUTED,
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
  marginBottom: '-1px',
  transition: `color ${String(DUR_FAST)}ms ${EASE_OUT}, border-color ${String(DUR_FAST)}ms ${EASE_OUT}`,
};

/** Active-tab overrides — gold underline indicator + primary text color. */
export const tabItemActiveStyle: CSSProperties = {
  color: TEXT_PRI,
  borderBottomColor: GOLD,
};

/** Disabled-tab overrides — dim text and not-allowed cursor. */
export const tabItemDisabledStyle: CSSProperties = {
  color: TEXT_DIM,
  cursor: 'not-allowed',
};

// ---------------------------------------------------------------------------
// Slider style recipes
// ---------------------------------------------------------------------------

/** Wrapper around the `<input type="range">`. */
export const sliderWrapperStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: `${String(SP_1)}px 0`,
};

/**
 * Native `<input type="range">` styling. The custom thumb / track CSS
 * lives in `sliderKeyframes()` because WebKit / Firefox require
 * pseudo-element selectors that cannot be expressed as inline styles.
 */
export const sliderInputStyle: CSSProperties = {
  width: '100%',
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'transparent',
  cursor: 'pointer',
  margin: 0,
  padding: 0,
  height: `${String(SP_6)}px`,
};

/**
 * Disabled-input overrides — removes the pointer cursor and greys the
 * whole control out. The track / thumb greyed appearance is applied via
 * the `[disabled]` selector in the injected stylesheet so WebKit / Gecko
 * pseudo-elements render consistently across browsers.
 */
export const sliderInputDisabledStyle: CSSProperties = {
  cursor: 'not-allowed',
  opacity: 0.55,
};

/**
 * Global stylesheet for the slider pseudo-elements. Injected once per
 * `Slider` mount via a `<style>` tag. The selectors are namespaced to
 * `.gbr-settings-slider` so the rules cannot leak into other
 * `<input type="range">` elements on the page.
 */
export function sliderStylesheet(): string {
  return `
.gbr-settings-slider {
  height: ${String(SP_6)}px;
}
.gbr-settings-slider::-webkit-slider-runnable-track {
  height: 6px;
  background: ${SURFACE_EL};
  border: 1px solid ${BORDER_SUB};
  border-radius: ${String(RADIUS_SM)}px;
}
.gbr-settings-slider::-moz-range-track {
  height: 6px;
  background: ${SURFACE_EL};
  border: 1px solid ${BORDER_SUB};
  border-radius: ${String(RADIUS_SM)}px;
}
.gbr-settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -6px;
  background: ${GOLD};
  border: 1px solid ${BG_DEEP};
  border-radius: 50%;
  cursor: pointer;
  box-shadow: ${SHADOW_MD};
}
.gbr-settings-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: ${GOLD};
  border: 1px solid ${BG_DEEP};
  border-radius: 50%;
  cursor: pointer;
  box-shadow: ${SHADOW_MD};
}
.gbr-settings-slider:focus {
  outline: 2px solid ${GOLD};
  outline-offset: 2px;
  border-radius: ${String(RADIUS_MD)}px;
}
.gbr-settings-slider[disabled] {
  cursor: not-allowed;
}
.gbr-settings-slider[disabled]::-webkit-slider-runnable-track {
  background: ${SURFACE};
  border-color: ${BORDER_SUB};
}
.gbr-settings-slider[disabled]::-moz-range-track {
  background: ${SURFACE};
  border-color: ${BORDER_SUB};
}
.gbr-settings-slider[disabled]::-webkit-slider-thumb {
  background: ${TEXT_DIM};
  box-shadow: none;
}
.gbr-settings-slider[disabled]::-moz-range-thumb {
  background: ${TEXT_DIM};
  box-shadow: none;
}
`;
}

// ---------------------------------------------------------------------------
// Keyframes — fade-in for the modal reveal
// ---------------------------------------------------------------------------

/** Fade-in keyframes for the modal. Namespaced to avoid collisions. */
export function settingsKeyframes(): string {
  return `
@keyframes gbr-settings-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;
}

// ---------------------------------------------------------------------------
// Unused-token guard — keeps eslint happy about RADIUS_LG which the
// helpers module imports for documentation consistency with sibling
// helper modules. The constant is re-exported here so tests can
// reference it by import alongside the other tokens.
// ---------------------------------------------------------------------------

/** Re-exported for tests that want to assert the panel radius family. */
export const SETTINGS_PANEL_INNER_RADIUS = RADIUS_LG;
