/**
 * Shared button recipes for the Gunboat Raiders UI layer.
 *
 * Single source of truth for every button silhouette in the game.
 * Before this module existed, each modal shipped its own local
 * `*ButtonBaseStyle` + `*ButtonPrimaryStyle` / `*ButtonSecondaryStyle`
 * pair — structurally divergent (one used a 3D emboss shadow, the
 * other used a flat drop shadow) so modals looked inconsistent next
 * to each other.
 *
 * ### Structure
 *
 * Every recipe below is built by spreading:
 *
 *     { ...BUTTON_RECIPE.base, ...BUTTON_RECIPE.primary }
 *     { ...BUTTON_RECIPE.base, ...BUTTON_RECIPE.secondary }
 *     { ...BUTTON_RECIPE.base, ...BUTTON_RECIPE.destructive }
 *     { ...BUTTON_RECIPE.base, ...BUTTON_RECIPE.disabled }
 *
 * `base` owns the shared structural rules: padding, font, radius,
 * border, cursor, transition, and — most importantly — the 3D emboss
 * `box-shadow` stack that gives every button its hard bottom-edge
 * lift. Variants only override `background`, `color`, and the two
 * emboss-edge colors inside the shadow stack.
 *
 * Because the emboss shadow is variant-specific (the "sunken edge"
 * color depends on the button fill), each variant redeclares
 * `boxShadow` with the same stack shape but a different darker edge
 * color + outer-glow tint. The base still exposes a default
 * `boxShadow` so consumers can't accidentally render a button with
 * no shadow if they forget to spread a variant.
 *
 * ### Why not extend `tokens.ts`?
 *
 * `tokens.ts` is the raw design-token layer (colors, fonts, spacing,
 * etc.) — it intentionally does NOT contain composite recipes. Button
 * recipes are a higher-level composition of those tokens, so they
 * live in their own module. Callers import primitives from
 * `tokens.ts` and composites from this file.
 */

import type { CSSProperties } from 'react';

import {
  BORDER,
  BTN_PRI_BG,
  BTN_PRI_COLOR,
  DUR_FAST,
  EASE_OUT,
  FONT_DISPLAY,
  RADIUS_MD,
  RED,
  RED_DARK,
  SP_3,
  SP_6,
  SURFACE_EL,
  TEXT_PRI,
} from './tokens';

// ---------------------------------------------------------------------------
// Internal emboss-shadow helper
// ---------------------------------------------------------------------------

/**
 * Builds the canonical two-layer emboss shadow:
 *
 *   1. `0 4px 0 <edgeColor>` — hard 4px bottom edge that gives the
 *      button its 3D "sitting on the page" lift. This is the part
 *      that was missing from every secondary/destructive button
 *      before this refactor.
 *   2. `0 6px 18px <glowColor>` — soft outer halo that warms the
 *      button against the panel background. Primary uses a gold
 *      glow, secondary uses a neutral drop, destructive uses a red
 *      glow.
 *
 * Extracted so the three variants cannot drift apart structurally —
 * they share the exact same shadow shape, only the two colors
 * change.
 */
function embossShadow(edgeColor: string, glowColor: string): string {
  return `0 4px 0 ${edgeColor}, 0 6px 18px ${glowColor}`;
}

// ---------------------------------------------------------------------------
// Shadow edge + glow colors per variant
// ---------------------------------------------------------------------------

/**
 * Dark gold hard-edge color for the primary button's bottom emboss.
 * Matches the historical `BTN_PRI_SHADOW` value so the visual
 * silhouette of the primary button is preserved byte-for-byte by this
 * refactor.
 */
const PRIMARY_EDGE = '#9a6808';

/**
 * Warm gold glow tint used behind the primary button. Also lifted
 * verbatim from the historical `BTN_PRI_SHADOW` so the gold CTA keeps
 * its exact appearance.
 */
const PRIMARY_GLOW = 'rgba(210, 140, 20, 0.3)';

/**
 * Deep-blue hard-edge for the secondary button's bottom emboss.
 * Sits darker than the `SURFACE_EL` fill so the lift reads clearly
 * against both the Harbour Dawn panel surface and the backdrop blur.
 */
const SECONDARY_EDGE = '#0a1a2d';

/**
 * Neutral drop shadow for the secondary button's outer halo. Less
 * saturated than the primary glow because secondary buttons should
 * never out-shout the gold primary CTA.
 */
const SECONDARY_GLOW = 'rgba(0, 0, 0, 0.45)';

/**
 * Dark red hard-edge for the destructive button's bottom emboss.
 * Uses a darker tone than `RED_DARK` so the 4px edge reads as "carved
 * into the button" rather than a second gradient stop.
 */
const DESTRUCTIVE_EDGE = '#7a1a1a';

/**
 * Red glow tint for the destructive button's outer halo. Same alpha
 * as the primary glow so the two CTA variants have equivalent
 * perceived weight.
 */
const DESTRUCTIVE_GLOW = 'rgba(204, 51, 51, 0.35)';

// ---------------------------------------------------------------------------
// Recipe shape
// ---------------------------------------------------------------------------

/**
 * Shape of the shared button recipe. Every variant is a
 * `CSSProperties` partial that — when spread after `base` — yields a
 * complete inline-style object ready to hand to a `<button>` element.
 */
export interface ButtonRecipe {
  /** Shared structural rules — padding, font, radius, transition, default emboss shadow. */
  readonly base: CSSProperties;
  /** Primary gold CTA. */
  readonly primary: CSSProperties;
  /** Secondary neutral button. */
  readonly secondary: CSSProperties;
  /** Destructive red button for irreversible actions. */
  readonly destructive: CSSProperties;
  /** Disabled state — greys out any variant, still structurally consistent. */
  readonly disabled: CSSProperties;
}

// ---------------------------------------------------------------------------
// The recipe
// ---------------------------------------------------------------------------

/**
 * Shared base style used by every variant.
 *
 * The `boxShadow` here defaults to the secondary stack so a caller
 * that forgets to spread a variant still renders a visually coherent
 * button. Every variant below redeclares `boxShadow` with the same
 * stack shape, so the final merged object always ends with the
 * intended variant shadow.
 */
const base: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: `${String(SP_3)}px ${String(SP_6)}px`,
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: '16px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  // `border: 'none'` — the lift comes from the emboss shadow stack, NOT
  // a border. A visible border would fight the hard 4px bottom edge
  // and flatten the silhouette.
  border: 'none',
  borderRadius: `${String(RADIUS_MD)}px`,
  cursor: 'pointer',
  // Transition every animatable property a hover / active state could
  // touch so consumers can layer pseudo-style handlers without worrying
  // about flashing property swaps.
  transition: `transform ${String(DUR_FAST)}ms ${EASE_OUT}, background ${String(DUR_FAST)}ms ${EASE_OUT}, box-shadow ${String(DUR_FAST)}ms ${EASE_OUT}, opacity ${String(DUR_FAST)}ms ${EASE_OUT}`,
  // Default shadow — secondary shape. Variants override this; this
  // entry exists so a variant-less spread still has a valid shadow.
  boxShadow: embossShadow(SECONDARY_EDGE, SECONDARY_GLOW),
};

/**
 * Primary (gold) variant — the topmost enabled CTA on every screen.
 * Preserves the historical gold gradient + deep-harbour text color
 * pairing from `tokens.ts` so the existing "Continue" / "New Game" /
 * "Play Again" / "Start" buttons are visually unchanged.
 */
const primary: CSSProperties = {
  background: BTN_PRI_BG,
  color: BTN_PRI_COLOR,
  boxShadow: embossShadow(PRIMARY_EDGE, PRIMARY_GLOW),
};

/**
 * Secondary (neutral) variant — used for every non-primary action:
 * Settings, Cancel, Back, Back-to-Menu, Main Menu, etc.
 *
 * Structurally identical to primary — same padding, radius, emboss
 * shadow stack, font, everything. Only the background + text color
 * + shadow colors change.
 *
 * Note: unlike the legacy secondary style this does NOT carry a
 * 1px `BORDER` border. The emboss edge provides the lift, and
 * layering a solid border on top would flatten it.
 */
const secondary: CSSProperties = {
  background: SURFACE_EL,
  color: TEXT_PRI,
  boxShadow: embossShadow(SECONDARY_EDGE, SECONDARY_GLOW),
};

/**
 * Destructive (red) variant — used for irreversible actions such as
 * "Exit to main menu" (when pressed from a live run) or the
 * destructive `Confirm` button inside `ConfirmDialog`.
 *
 * Red gradient fill with the same emboss stack as primary / secondary
 * so the silhouette matches — only the colors read as "danger".
 */
const destructive: CSSProperties = {
  background: `linear-gradient(135deg, ${RED}, ${RED_DARK})`,
  color: TEXT_PRI,
  boxShadow: embossShadow(DESTRUCTIVE_EDGE, DESTRUCTIVE_GLOW),
};

/**
 * Disabled state — stacked on top of any variant. Opacity + dimmed
 * surface, not-allowed cursor, pointer events still on so the
 * browser surfaces the disabled state to assistive tech. The 4px
 * emboss edge stays visible but dimmed, which reads correctly as
 * "this button exists but you can't press it right now".
 */
const disabled: CSSProperties = {
  background: SURFACE_EL,
  color: TEXT_PRI,
  boxShadow: embossShadow(SECONDARY_EDGE, SECONDARY_GLOW),
  opacity: 0.4,
  cursor: 'not-allowed',
};

/**
 * The complete shared button recipe. Imported by every modal and
 * overlay in `src/ui/` so every button in the game renders with the
 * same silhouette. Any visual tweak to the button family happens
 * here — never in individual modal helpers.
 */
export const BUTTON_RECIPE: ButtonRecipe = {
  base,
  primary,
  secondary,
  destructive,
  disabled,
};

// ---------------------------------------------------------------------------
// Test-only internals (exported so `buttonRecipes.test.ts` can assert
// the exact shadow stack without duplicating the token lookups).
// ---------------------------------------------------------------------------

/**
 * Internal emboss-shadow helper, re-exported for tests so the exact
 * `0 4px 0 <edge>, 0 6px 18px <glow>` shape is locked in a single
 * spot. Not intended for production use — consumers should spread
 * the full recipe variants instead.
 */
export const __test_embossShadow = embossShadow;

/** Internal edge colors re-exported for tests. */
export const __test_edges = {
  primary: PRIMARY_EDGE,
  primaryGlow: PRIMARY_GLOW,
  secondary: SECONDARY_EDGE,
  secondaryGlow: SECONDARY_GLOW,
  destructive: DESTRUCTIVE_EDGE,
  destructiveGlow: DESTRUCTIVE_GLOW,
} as const;

// ---------------------------------------------------------------------------
// Unused-token guard — BORDER is re-exported so modals that still want
// to use the Harbour Dawn border color on non-button surfaces (panels,
// rows) have a single import surface for button-adjacent tokens.
// ---------------------------------------------------------------------------

/** Re-exported panel border color for consumers that import both. */
export const PANEL_BORDER = BORDER;
