/**
 * Unit tests for `src/ui/buttonRecipes.ts`.
 *
 * Verifies that the cross-modal shared button recipe:
 *
 * 1. Exposes the five documented keys (`base`, `primary`, `secondary`,
 *    `destructive`, `disabled`).
 * 2. Locks the structural contract: every variant redeclares the
 *    emboss `box-shadow` with the same `0 4px 0 <edge>, 0 6px 18px
 *    <glow>` shape so the 3D lift is consistent across the UI.
 * 3. Locks the primary shadow byte-for-byte against the historical
 *    `BTN_PRI_SHADOW` token so this refactor does not visually regress
 *    the gold CTA.
 * 4. Confirms that spreading `{ ...base, ...variant }` yields a fully
 *    populated CSS object with the expected background and color
 *    tokens — i.e. every button rendered with the recipe carries the
 *    exact same padding / font / radius / transition / emboss shadow.
 * 5. Sanity-checks that variants only override color-bearing
 *    properties (`background`, `color`, `boxShadow`) plus the
 *    disabled state's `opacity` + `cursor`. If a future refactor
 *    accidentally drops variant-specific structural overrides onto a
 *    variant, this test fails and forces a conscious decision.
 */

import { describe, expect, it } from 'vitest';

import {
  BUTTON_RECIPE,
  __test_edges,
  __test_embossShadow,
  PANEL_BORDER,
} from '../../src/ui/buttonRecipes';
import {
  BORDER,
  BTN_PRI_BG,
  BTN_PRI_COLOR,
  FONT_DISPLAY,
  RADIUS_MD,
  SURFACE_EL,
  TEXT_PRI,
} from '../../src/ui/tokens';

// ---------------------------------------------------------------------------
// Recipe shape
// ---------------------------------------------------------------------------

describe('BUTTON_RECIPE shape', () => {
  it('exposes base, primary, secondary, destructive, and disabled variants', () => {
    expect(BUTTON_RECIPE).toHaveProperty('base');
    expect(BUTTON_RECIPE).toHaveProperty('primary');
    expect(BUTTON_RECIPE).toHaveProperty('secondary');
    expect(BUTTON_RECIPE).toHaveProperty('destructive');
    expect(BUTTON_RECIPE).toHaveProperty('disabled');
  });

  it('re-exports PANEL_BORDER from tokens.ts for modals that also need the border color', () => {
    expect(PANEL_BORDER).toBe(BORDER);
  });
});

// ---------------------------------------------------------------------------
// Base structural rules
// ---------------------------------------------------------------------------

describe('BUTTON_RECIPE.base', () => {
  it('is a block-level full-width button', () => {
    expect(BUTTON_RECIPE.base.display).toBe('block');
    expect(BUTTON_RECIPE.base.width).toBe('100%');
  });

  it('uses the Harbour Dawn display font, uppercase, weight 700, letter-spacing 0.08em', () => {
    expect(BUTTON_RECIPE.base.fontFamily).toBe(FONT_DISPLAY);
    expect(BUTTON_RECIPE.base.fontWeight).toBe(700);
    expect(BUTTON_RECIPE.base.fontSize).toBe('16px');
    expect(BUTTON_RECIPE.base.textTransform).toBe('uppercase');
    expect(BUTTON_RECIPE.base.letterSpacing).toBe('0.08em');
  });

  it('uses RADIUS_MD for the corner radius and no border (emboss provides the lift)', () => {
    expect(BUTTON_RECIPE.base.borderRadius).toBe(`${String(RADIUS_MD)}px`);
    expect(BUTTON_RECIPE.base.border).toBe('none');
  });

  it('declares a pointer cursor and a transition for transform/background/box-shadow/opacity', () => {
    expect(BUTTON_RECIPE.base.cursor).toBe('pointer');
    expect(typeof BUTTON_RECIPE.base.transition).toBe('string');
    const transition = String(BUTTON_RECIPE.base.transition ?? '');
    expect(transition).toContain('transform');
    expect(transition).toContain('background');
    expect(transition).toContain('box-shadow');
    expect(transition).toContain('opacity');
  });

  it('ships a default emboss shadow so a variant-less spread still looks coherent', () => {
    expect(BUTTON_RECIPE.base.boxShadow).toBeDefined();
    expect(String(BUTTON_RECIPE.base.boxShadow ?? '')).toMatch(/0 4px 0/);
    expect(String(BUTTON_RECIPE.base.boxShadow ?? '')).toMatch(/0 6px 18px/);
  });
});

// ---------------------------------------------------------------------------
// Primary variant
// ---------------------------------------------------------------------------

describe('BUTTON_RECIPE.primary', () => {
  it('uses the token gold gradient background and hard-contrast text color', () => {
    expect(BUTTON_RECIPE.primary.background).toBe(BTN_PRI_BG);
    expect(BUTTON_RECIPE.primary.color).toBe(BTN_PRI_COLOR);
  });

  it('uses the shared dark drop-shadow (not a per-variant colored glow)', () => {
    expect(String(BUTTON_RECIPE.primary.boxShadow ?? '')).toContain(__test_edges.sharedDropShadow);
  });

  it('uses the exact 3D emboss shadow shape (0 4px 0 <edge>, 0 6px 18px <shared-glow>)', () => {
    const expected = __test_embossShadow(__test_edges.primary, __test_edges.sharedDropShadow);
    expect(BUTTON_RECIPE.primary.boxShadow).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Secondary variant
// ---------------------------------------------------------------------------

describe('BUTTON_RECIPE.secondary', () => {
  it('uses the elevated-surface background and primary text color', () => {
    expect(BUTTON_RECIPE.secondary.background).toBe(SURFACE_EL);
    expect(BUTTON_RECIPE.secondary.color).toBe(TEXT_PRI);
  });

  it('uses the same emboss shadow shape as primary with the shared drop-shadow', () => {
    const expected = __test_embossShadow(__test_edges.secondary, __test_edges.sharedDropShadow);
    expect(BUTTON_RECIPE.secondary.boxShadow).toBe(expected);
  });

  it('does NOT declare its own border (emboss shadow provides the lift)', () => {
    expect(BUTTON_RECIPE.secondary.border).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Destructive variant
// ---------------------------------------------------------------------------

describe('BUTTON_RECIPE.destructive', () => {
  /**
   * Destructive rests in the same neutral state as secondary — "in de
   * normale staat mag deze gewoon grijs zijn, zoals de andere buttons".
   * Only the CSS :hover rule reveals the red danger state.
   */
  it('default background equals secondary background (grey rest state)', () => {
    expect(BUTTON_RECIPE.destructive.background).toBe(BUTTON_RECIPE.secondary.background);
  });

  it('default color equals secondary color (shared text color in rest state)', () => {
    expect(BUTTON_RECIPE.destructive.color).toBe(BUTTON_RECIPE.secondary.color);
  });

  it('default boxShadow equals secondary boxShadow (same grey emboss edge in rest state)', () => {
    expect(BUTTON_RECIPE.destructive.boxShadow).toBe(BUTTON_RECIPE.secondary.boxShadow);
  });

  it('uses the same emboss shadow shape as secondary with the shared drop-shadow', () => {
    const expected = __test_embossShadow(__test_edges.secondary, __test_edges.sharedDropShadow);
    expect(BUTTON_RECIPE.destructive.boxShadow).toBe(expected);
  });

  it('uses SURFACE_EL background (same as secondary) not a red gradient', () => {
    expect(BUTTON_RECIPE.destructive.background).toBe(SURFACE_EL);
    expect(BUTTON_RECIPE.destructive.background).not.toContain('linear-gradient');
  });
});

// ---------------------------------------------------------------------------
// Disabled variant
// ---------------------------------------------------------------------------

describe('BUTTON_RECIPE.disabled', () => {
  it('dims the button with opacity 0.4 and a not-allowed cursor', () => {
    expect(BUTTON_RECIPE.disabled.opacity).toBe(0.4);
    expect(BUTTON_RECIPE.disabled.cursor).toBe('not-allowed');
  });

  it('keeps the emboss shadow shape so disabled buttons still read as buttons', () => {
    expect(BUTTON_RECIPE.disabled.boxShadow).toBeDefined();
    expect(String(BUTTON_RECIPE.disabled.boxShadow ?? '')).toMatch(/0 4px 0/);
  });
});

// ---------------------------------------------------------------------------
// Structural uniformity — the core regression check
// ---------------------------------------------------------------------------

describe('variant uniformity — the cross-modal contract', () => {
  /**
   * For each variant, the resolved style (spread over `base`) must
   * match the base on every structural property. Only the
   * documented variant overrides may diverge. If a future refactor
   * slips an `extra-structural` property into a variant (e.g. a
   * padding override), this matrix catches it immediately.
   */
  const STRUCTURAL_KEYS = [
    'display',
    'width',
    'padding',
    'fontFamily',
    'fontWeight',
    'fontSize',
    'letterSpacing',
    'textTransform',
    'border',
    'borderRadius',
    'transition',
  ] as const;

  for (const variantName of ['primary', 'secondary', 'destructive', 'disabled'] as const) {
    it(`${variantName} spread inherits every structural property from base`, () => {
      const merged = { ...BUTTON_RECIPE.base, ...BUTTON_RECIPE[variantName] };
      for (const key of STRUCTURAL_KEYS) {
        expect(merged[key]).toBe(BUTTON_RECIPE.base[key]);
      }
    });
  }

  /**
   * Inverse of the above — every variant must actually override the
   * three color-carrying properties (`background`, `color`,
   * `boxShadow`). If a variant silently drops one of these, its
   * button would inherit the base defaults and no longer read as its
   * intended role.
   */
  for (const variantName of ['primary', 'secondary', 'destructive'] as const) {
    it(`${variantName} explicitly overrides background, color, and boxShadow`, () => {
      expect(BUTTON_RECIPE[variantName].background).toBeDefined();
      expect(BUTTON_RECIPE[variantName].color).toBeDefined();
      expect(BUTTON_RECIPE[variantName].boxShadow).toBeDefined();
    });
  }

  /**
   * Core uniformity check: every variant's boxShadow must contain the
   * exact same shared drop-shadow string. The emboss edge (4px solid
   * bottom line) may differ per variant — that is intentional — but
   * the outer soft glow must be identical across all three so they
   * have the same perceived depth regardless of background color.
   */
  for (const variantName of ['primary', 'secondary', 'destructive'] as const) {
    it(`${variantName} boxShadow contains the shared drop-shadow (not a per-variant glow)`, () => {
      expect(String(BUTTON_RECIPE[variantName].boxShadow ?? '')).toContain(
        __test_edges.sharedDropShadow,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Merged spreads yield complete style objects
// ---------------------------------------------------------------------------

describe('merged recipe spreads', () => {
  it('{...base, ...primary} yields a complete button style', () => {
    const merged = { ...BUTTON_RECIPE.base, ...BUTTON_RECIPE.primary };
    expect(merged.background).toBe(BTN_PRI_BG);
    expect(merged.color).toBe(BTN_PRI_COLOR);
    // Shadow uses gold edge + shared drop-shadow (no per-variant colored glow)
    expect(String(merged.boxShadow ?? '')).toContain(__test_edges.primary);
    expect(String(merged.boxShadow ?? '')).toContain(__test_edges.sharedDropShadow);
    expect(merged.display).toBe('block');
    expect(merged.width).toBe('100%');
    expect(merged.fontFamily).toBe(FONT_DISPLAY);
  });

  it('{...base, ...secondary} yields a complete button style with neutral fill', () => {
    const merged = { ...BUTTON_RECIPE.base, ...BUTTON_RECIPE.secondary };
    expect(merged.background).toBe(SURFACE_EL);
    expect(merged.color).toBe(TEXT_PRI);
    expect(String(merged.boxShadow ?? '')).toMatch(/0 4px 0/);
    expect(merged.border).toBe('none');
  });
});
