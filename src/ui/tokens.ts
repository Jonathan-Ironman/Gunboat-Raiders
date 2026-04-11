/**
 * Harbour Dawn design tokens.
 *
 * Single source of truth for every value used by the Gunboat Raiders UI layer:
 * colors, spacing, radii, shadows, motion, typography, and a handful of
 * higher-level recipes (health bar gradients, button gradients, thresholds).
 *
 * Downstream UI slices (HUD, MainMenuScene, PauseMenu, HealthBar, etc.) MUST
 * import from this module rather than hardcoding hex values or magic numbers.
 * The numeric tokens are raw numbers (px / ms) so components can compose them
 * into `${n}px` / `${n}ms` strings as needed.
 *
 * Source of truth: `docs/art-direction/index.html` (:root custom properties
 * and the #motion section).
 */

/**
 * Branded hex color string. Ensures token consumers get compile-time safety
 * when a function explicitly expects a Harbour Dawn color literal, without
 * any runtime overhead.
 */
export type HexColor = `#${string}`;

// ---------------------------------------------------------------------------
// Colors — Backgrounds & Surfaces
// ---------------------------------------------------------------------------

/** Primary background — deep harbour dusk, used for full-screen panels. */
export const BG: HexColor = '#0f1e36';
/** Deepest background — used for hard contrast text on primary buttons. */
export const BG_DEEP: HexColor = '#071120';
/** Elevated surface (cards, HUD panels). */
export const SURFACE: HexColor = '#152844';
/** Further elevated surface (inner cards, modal bodies). */
export const SURFACE_EL: HexColor = '#1c3556';

// ---------------------------------------------------------------------------
// Colors — Borders
// ---------------------------------------------------------------------------

/** Primary border color for panels and cards. */
export const BORDER: HexColor = '#234870';
/** Subtle border for internal dividers. */
export const BORDER_SUB: HexColor = '#1a3454';

// ---------------------------------------------------------------------------
// Colors — Accents
// ---------------------------------------------------------------------------

/** Brand gold — primary button, score, headings accent. */
export const GOLD: HexColor = '#f2b640';
/** Dark gold — gradient stop, pressed state, shadow tint. */
export const GOLD_DARK: HexColor = '#c8921a';
/** Light gold — hover gradient start for the primary button. */
export const GOLD_LIGHT: HexColor = '#f7c850';
/** Mid gold — hover gradient end for the primary button. */
export const GOLD_MID: HexColor = '#e0a020';
/** Teal — armor, heal, positive status. */
export const TEAL: HexColor = '#2dd4aa';
/** Dark teal — gradient stop. */
export const TEAL_DARK: HexColor = '#1aaa84';
/** Red — damage, critical state, danger. */
export const RED: HexColor = '#ff8080';
/** Dark red — gradient stop, pressed destructive state. */
export const RED_DARK: HexColor = '#cc3333';
/** Light red — hover gradient start for destructive / secondary buttons. */
export const RED_LIGHT: HexColor = '#ff9090';
/** Mid red — hover gradient end for destructive / secondary buttons. */
export const RED_MID: HexColor = '#e03030';
/** Ocean blue — wave/water accents, informational highlights. Armor base hue. */
export const OCEAN: HexColor = '#4a8ac4';
/** Deep ocean — darker blue stop for ocean gradients. */
export const OCEAN_DARK: HexColor = '#2a5a94';
/** Twilight — blue→purple midtone, used for the armor "damaged" ramp. */
export const TWILIGHT: HexColor = '#8a5ac4';
/** Twilight dark — darker purple stop paired with {@link TWILIGHT}. */
export const TWILIGHT_DARK: HexColor = '#6a3a9a';

// ---------------------------------------------------------------------------
// Colors — Text
// ---------------------------------------------------------------------------

/** Primary text — headings, key numbers, high-emphasis labels. */
export const TEXT_PRI: HexColor = '#ffffff';
/** Secondary text — body copy, standard labels. */
export const TEXT_SEC: HexColor = '#c8dff0';
/** Muted text — captions, hints, inactive labels. */
export const TEXT_MUTED: HexColor = '#7aaac8';
/** Dim text — placeholder, disabled. */
export const TEXT_DIM: HexColor = '#4a7090';

// ---------------------------------------------------------------------------
// Spacing — raw pixel values (compose with `${n}px` at use site)
// ---------------------------------------------------------------------------

/** 4px — tightest gap between inline siblings. */
export const SP_1 = 4;
/** 8px — tight gap. */
export const SP_2 = 8;
/** 12px — small gap. */
export const SP_3 = 12;
/** 16px — default gap / card padding. */
export const SP_4 = 16;
/** 20px — medium gap. */
export const SP_5 = 20;
/** 24px — card padding / section gap. */
export const SP_6 = 24;
/** 32px — large gap. */
export const SP_8 = 32;
/** 40px — very large gap. */
export const SP_10 = 40;
/** 48px — section padding. */
export const SP_12 = 48;
/** 64px — hero padding. */
export const SP_16 = 64;
/** 80px — hero vertical padding. */
export const SP_20 = 80;

// ---------------------------------------------------------------------------
// Border radii — raw pixel values
// ---------------------------------------------------------------------------

/** 4px — small radius (chips, tiny buttons). */
export const RADIUS_SM = 4;
/** 8px — default radius (buttons, inputs). */
export const RADIUS_MD = 8;
/** 12px — card / panel radius. */
export const RADIUS_LG = 12;
/** 16px — hero card / modal radius. */
export const RADIUS_XL = 16;

// ---------------------------------------------------------------------------
// Shadows — ready-to-use CSS `box-shadow` strings
// ---------------------------------------------------------------------------

/** Subtle lift — chips, small interactive elements. */
export const SHADOW_SM = '0 1px 4px rgba(0, 0, 0, 0.4)';
/** Default lift — cards, buttons, HUD panels. */
export const SHADOW_MD = '0 4px 16px rgba(0, 0, 0, 0.5)';
/** Heavy lift — modals, screens above the canvas. */
export const SHADOW_LG = '0 8px 32px rgba(0, 0, 0, 0.6)';
/** Gold glow — primary CTA hover, focus ring. */
export const SHADOW_GOLD = '0 4px 20px rgba(242, 182, 64, 0.25)';

// ---------------------------------------------------------------------------
// Motion — Durations (ms) and Easing (CSS timing functions)
// ---------------------------------------------------------------------------

/** 80ms — instant micro-interaction (hover color shift). */
export const DUR_INSTANT = 80;
/** 150ms — fast interaction (button press). */
export const DUR_FAST = 150;
/** 200ms — default UI transition (panel show/hide). */
export const DUR_NORMAL = 200;
/** 300ms — medium transition (screen swap). */
export const DUR_MEDIUM = 300;
/** 500ms — slow transition (scene change, large reveal). */
export const DUR_SLOW = 500;
/** 1200ms — damage number float lifetime. */
export const DUR_DAMAGE_FLOAT = 1200;

/** Standard UI ease-out for exits and property transitions. */
export const EASE_OUT = 'ease-out';
/** Ease-in for entrances moving into the viewport. */
export const EASE_IN = 'ease-in';
/** Spring-ish overshoot for playful reveals (CTA, score pop). */
export const EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)';
/** Linear for progress bars / indeterminate motion. */
export const EASE_LINEAR = 'linear';

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * Display font stack — used for headings, numeric displays (score, health
 * numbers, wave counter). Baloo 2 is loaded via the global `<link>` in
 * `index.html`; consumers only need this constant for inline `fontFamily`.
 */
export const FONT_DISPLAY = "'Baloo 2', sans-serif";

/**
 * UI font stack — used for body copy, labels, captions, buttons, tooltips.
 */
export const FONT_UI = "'Nunito', sans-serif";

// ---------------------------------------------------------------------------
// Health bar gradient recipes
// ---------------------------------------------------------------------------

/**
 * Legacy health gradient recipes. Still referenced by the Harbour Dawn
 * showcase / docs references and by the historical tests. New code should
 * prefer the explicit `HULL_*` and `ARMOR_*` recipes below — the intent
 * (which bar the color belongs to) is then encoded in the name.
 */
/** Full state — teal gradient. */
export const HEALTH_FULL_GRADIENT = 'linear-gradient(90deg, #2dd4aa, #22c4a0)';
/** Damaged state — amber gradient. */
export const HEALTH_DAMAGED_GRADIENT = 'linear-gradient(90deg, #e8b020, #c8920a)';
/** Critical state — red gradient. */
export const HEALTH_CRITICAL_GRADIENT = 'linear-gradient(90deg, #ff6060, #cc2828)';

// --- Hull (green/teal family → gold → red) ---------------------------------

/** Hull full — teal gradient (green family base). */
export const HULL_FULL_GRADIENT = 'linear-gradient(90deg, #2dd4aa, #22c4a0)';
/** Hull damaged — amber warning gradient. */
export const HULL_DAMAGED_GRADIENT = 'linear-gradient(90deg, #e8b020, #c8920a)';
/** Hull critical — red danger gradient. */
export const HULL_CRITICAL_GRADIENT = 'linear-gradient(90deg, #ff6060, #cc2828)';

// --- Armor (blue → purple → red) -------------------------------------------

/** Armor full — ocean-blue gradient (blue family base). */
export const ARMOR_FULL_GRADIENT = 'linear-gradient(90deg, #4a8ac4, #2a5a94)';
/** Armor damaged — twilight (blue→purple) gradient. */
export const ARMOR_DAMAGED_GRADIENT = 'linear-gradient(90deg, #8a5ac4, #6a3a9a)';
/** Armor critical — red danger gradient (matches hull critical). */
export const ARMOR_CRITICAL_GRADIENT = 'linear-gradient(90deg, #ff6060, #cc2828)';

/**
 * Hull/hullMax ratio below which the HUD transitions to the critical
 * (red) visual state. Consumed by `HealthBar` and future damage-vignette.
 */
export const HULL_CRITICAL_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// Button recipes — Primary
// ---------------------------------------------------------------------------

/** Primary button background — gold gradient. */
export const BTN_PRI_BG = 'linear-gradient(135deg, #f2b640, #d4920e)';
/** Primary button shadow (resting state) — drop + warm glow. */
export const BTN_PRI_SHADOW = '0 4px 0 #9a6808, 0 6px 18px rgba(210, 140, 20, 0.3)';
/** Primary button text color — deepest background for hard contrast. */
export const BTN_PRI_COLOR: HexColor = '#071120';
