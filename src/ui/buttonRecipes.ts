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
  GOLD,
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
 * This is the structural 4px bottom line that gives the button its
 * "sitting on the page" 3D lift. Variant-specific so it reads as
 * a darker tone of the button face.
 */
const PRIMARY_EDGE = '#9a6808';

/**
 * Deep-blue hard-edge for the secondary button's bottom emboss.
 * Sits darker than the `SURFACE_EL` fill so the lift reads clearly
 * against both the Harbour Dawn panel surface and the backdrop blur.
 */
const SECONDARY_EDGE = '#0a1a2d';

/**
 * Dark red hard-edge for the destructive button's bottom emboss.
 * Uses a darker tone than `RED_DARK` so the 4px edge reads as "carved
 * into the button" rather than a second gradient stop.
 */
const DESTRUCTIVE_EDGE = '#7a1a1a';

/**
 * Shared drop-shadow used by ALL button variants.
 *
 * The per-variant colored glows (gold, red) were visually inconsistent:
 * the gold glow washed out the depth illusion while the neutral black
 * created clear depth. Unifying to a single dark drop-shadow ensures
 * every button has identical perceived depth — only the background
 * color differs between variants.
 */
const SHARED_DROP_SHADOW = 'rgba(7, 17, 32, 0.35)';

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
  boxShadow: embossShadow(SECONDARY_EDGE, SHARED_DROP_SHADOW),
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
  boxShadow: embossShadow(PRIMARY_EDGE, SHARED_DROP_SHADOW),
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
  boxShadow: embossShadow(SECONDARY_EDGE, SHARED_DROP_SHADOW),
};

/**
 * Destructive variant — rests in the same neutral state as secondary
 * so the button does not alarm the user before they interact with it.
 * Only the `:hover` state reveals the danger — the CSS stylesheet
 * below transitions to a red gradient when the user mouses over.
 *
 * Default state is visually identical to secondary: same background,
 * same emboss edge color, same text color. This satisfies Jonathan's
 * request: "in de normale staat mag deze gewoon grijs zijn, zoals de
 * andere buttons" (in the normal state it should just be grey, like
 * the other buttons).
 */
const destructive: CSSProperties = {
  background: SURFACE_EL,
  color: TEXT_PRI,
  boxShadow: embossShadow(SECONDARY_EDGE, SHARED_DROP_SHADOW),
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
  boxShadow: embossShadow(SECONDARY_EDGE, SHARED_DROP_SHADOW),
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

/**
 * Explicitly-red destructive style for contexts where the danger must
 * always be visible (e.g. the Confirm button inside `ConfirmDialog`).
 *
 * Unlike `BUTTON_RECIPE.destructive` (which rests grey and only turns
 * red on CSS `:hover`), this variant is always red — use it when the
 * surrounding UI already provides the "are you sure?" framing and the
 * button must communicate danger at a glance without any mouse
 * interaction.
 */
export const BUTTON_DESTRUCTIVE_RED: CSSProperties = {
  background: `linear-gradient(135deg, ${RED}, ${RED_DARK})`,
  color: TEXT_PRI,
  boxShadow: embossShadow(DESTRUCTIVE_EDGE, SHARED_DROP_SHADOW),
};

// ---------------------------------------------------------------------------
// Hover + active shadow stacks per variant
// ---------------------------------------------------------------------------

/**
 * Warm light overlay for the secondary button hover state. The fill
 * shifts to a slightly lighter deep-harbour blue so the button does
 * not feel dead — subtler than primary/destructive because secondary
 * actions should never compete with the gold CTA.
 */
const SECONDARY_HOVER_BG = '#254b72';

/**
 * Brightened secondary emboss edge for hover — one step lighter than
 * the resting edge so the lift reads a touch taller on mouse-over.
 */
const SECONDARY_HOVER_EDGE = '#0d2540';

/**
 * The CSS `box-shadow` for the active (pressed) state — bottom edge
 * collapses from 4px to 2px so the button looks like it sank into the
 * page. No transform movement; only the shadow shrinks slightly.
 */
function activeEmbossShadow(edgeColor: string): string {
  return `0 2px 0 ${edgeColor}, 0 3px 10px ${SHARED_DROP_SHADOW}`;
}

// ---------------------------------------------------------------------------
// Hover/active CSS stylesheet
// ---------------------------------------------------------------------------

/**
 * Scoped CSS stylesheet for button hover and active pseudo-states.
 * Injected once per `Button` component render (identical to the pattern
 * used by `Slider` with its `.gbr-settings-slider` rules). The `.gbr-btn`
 * class namespace guarantees these rules cannot leak to any other
 * element on the page.
 *
 * @returns A CSS string suitable for embedding in a `<style>` tag.
 */
export function buttonStylesheet(): string {
  return `
.gbr-btn {
  -webkit-tap-highlight-color: transparent;
}
.gbr-btn:focus-visible {
  outline: 2px solid ${GOLD};
  outline-offset: 2px;
}

/* Primary (gold) hover + active */
.gbr-btn--primary:not(:disabled):hover {
  background: linear-gradient(135deg, #f7c850, #e0a020);
  filter: brightness(1.1);
  box-shadow: ${embossShadow(PRIMARY_EDGE, SHARED_DROP_SHADOW)};
}
.gbr-btn--primary:not(:disabled):active {
  filter: brightness(0.95);
  box-shadow: ${activeEmbossShadow(PRIMARY_EDGE)};
}

/* Secondary (neutral) hover + active */
.gbr-btn--secondary:not(:disabled):hover {
  background: ${SECONDARY_HOVER_BG};
  box-shadow: ${embossShadow(SECONDARY_HOVER_EDGE, SHARED_DROP_SHADOW)};
}
.gbr-btn--secondary:not(:disabled):active {
  filter: brightness(0.9);
  box-shadow: ${activeEmbossShadow(SECONDARY_EDGE)};
}

/* Destructive (red) hover + active */
.gbr-btn--destructive:not(:disabled):hover {
  background: linear-gradient(135deg, #ff9090, #e03030);
  filter: brightness(1.1);
  box-shadow: ${embossShadow(DESTRUCTIVE_EDGE, SHARED_DROP_SHADOW)};
}
.gbr-btn--destructive:not(:disabled):active {
  filter: brightness(0.9);
  box-shadow: ${activeEmbossShadow(DESTRUCTIVE_EDGE)};
}

/* Disabled — no hover effects, pointer blocked at the button level */
.gbr-btn:disabled {
  pointer-events: none;
}
`;
}

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

/** Internal edge colors and shared drop-shadow, re-exported for tests. */
export const __test_edges = {
  primary: PRIMARY_EDGE,
  secondary: SECONDARY_EDGE,
  destructive: DESTRUCTIVE_EDGE,
  /** The single shared drop-shadow applied to all three variants. */
  sharedDropShadow: SHARED_DROP_SHADOW,
} as const;

// ---------------------------------------------------------------------------
// Unused-token guard — BORDER is re-exported so modals that still want
// to use the Harbour Dawn border color on non-button surfaces (panels,
// rows) have a single import surface for button-adjacent tokens.
// ---------------------------------------------------------------------------

/** Re-exported panel border color for consumers that import both. */
export const PANEL_BORDER = BORDER;
