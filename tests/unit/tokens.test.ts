import { describe, it, expect } from 'vitest';
import {
  // Colors
  BG,
  BG_DEEP,
  SURFACE,
  SURFACE_EL,
  BORDER,
  BORDER_SUB,
  GOLD,
  GOLD_DARK,
  TEAL,
  TEAL_DARK,
  RED,
  RED_DARK,
  OCEAN,
  TEXT_PRI,
  TEXT_SEC,
  TEXT_MUTED,
  TEXT_DIM,
  // Spacing
  SP_1,
  SP_2,
  SP_3,
  SP_4,
  SP_5,
  SP_6,
  SP_8,
  SP_10,
  SP_12,
  SP_16,
  SP_20,
  // Radii
  RADIUS_SM,
  RADIUS_MD,
  RADIUS_LG,
  RADIUS_XL,
  // Shadows
  SHADOW_SM,
  SHADOW_MD,
  SHADOW_LG,
  SHADOW_GOLD,
  // Motion
  DUR_INSTANT,
  DUR_FAST,
  DUR_NORMAL,
  DUR_MEDIUM,
  DUR_SLOW,
  DUR_DAMAGE_FLOAT,
  EASE_OUT,
  EASE_IN,
  EASE_SPRING,
  EASE_LINEAR,
  // Typography
  FONT_DISPLAY,
  FONT_UI,
  // Health (legacy + new per-bar recipes)
  HEALTH_FULL_GRADIENT,
  HEALTH_DAMAGED_GRADIENT,
  HEALTH_CRITICAL_GRADIENT,
  HULL_FULL_GRADIENT,
  HULL_DAMAGED_GRADIENT,
  HULL_CRITICAL_GRADIENT,
  ARMOR_FULL_GRADIENT,
  ARMOR_DAMAGED_GRADIENT,
  ARMOR_CRITICAL_GRADIENT,
  HULL_CRITICAL_THRESHOLD,
  OCEAN_DARK,
  TWILIGHT,
  TWILIGHT_DARK,
  // Button
  BTN_PRI_BG,
  BTN_PRI_SHADOW,
  BTN_PRI_COLOR,
} from '@/ui/tokens';

// Matches `#rgb`, `#rgba`, `#rrggbb`, or `#rrggbbaa`.
const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

describe('tokens — colors', () => {
  it('pins the critical Harbour Dawn brand values', () => {
    expect(GOLD).toBe('#f2b640');
    expect(TEAL).toBe('#2dd4aa');
    expect(RED).toBe('#ff8080');
    expect(BG).toBe('#0f1e36');
    expect(BG_DEEP).toBe('#071120');
  });

  it('exports every color as a valid hex literal', () => {
    const colors = [
      BG,
      BG_DEEP,
      SURFACE,
      SURFACE_EL,
      BORDER,
      BORDER_SUB,
      GOLD,
      GOLD_DARK,
      TEAL,
      TEAL_DARK,
      RED,
      RED_DARK,
      OCEAN,
      TEXT_PRI,
      TEXT_SEC,
      TEXT_MUTED,
      TEXT_DIM,
      BTN_PRI_COLOR,
    ];
    for (const c of colors) {
      expect(c).toMatch(HEX_RE);
    }
  });
});

describe('tokens — spacing & radii', () => {
  it('exports spacing as ascending positive numbers', () => {
    const spacing = [SP_1, SP_2, SP_3, SP_4, SP_5, SP_6, SP_8, SP_10, SP_12, SP_16, SP_20];
    expect(spacing).toEqual([4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80]);
    for (const v of spacing) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThan(0);
    }
  });

  it('exports radii as ascending positive numbers', () => {
    expect(RADIUS_SM).toBe(4);
    expect(RADIUS_MD).toBe(8);
    expect(RADIUS_LG).toBe(12);
    expect(RADIUS_XL).toBe(16);
  });
});

describe('tokens — shadows', () => {
  it('exports every shadow as a non-empty CSS box-shadow string', () => {
    const shadows = [SHADOW_SM, SHADOW_MD, SHADOW_LG, SHADOW_GOLD];
    for (const s of shadows) {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
      // Every Harbour Dawn shadow uses an rgba color — sanity check.
      expect(s).toContain('rgba(');
    }
  });

  it('pins the gold shadow recipe (used by primary CTA)', () => {
    expect(SHADOW_GOLD).toBe('0 4px 20px rgba(242, 182, 64, 0.25)');
  });
});

describe('tokens — motion', () => {
  it('exports durations as positive numbers in ms', () => {
    expect(DUR_INSTANT).toBe(80);
    expect(DUR_FAST).toBe(150);
    expect(DUR_NORMAL).toBe(200);
    expect(DUR_MEDIUM).toBe(300);
    expect(DUR_SLOW).toBe(500);
    expect(DUR_DAMAGE_FLOAT).toBe(1200);

    const durations = [DUR_INSTANT, DUR_FAST, DUR_NORMAL, DUR_MEDIUM, DUR_SLOW, DUR_DAMAGE_FLOAT];
    for (const d of durations) {
      expect(typeof d).toBe('number');
      expect(d).toBeGreaterThan(0);
      expect(Number.isFinite(d)).toBe(true);
    }
  });

  it('durations are strictly ascending (instant < fast < normal < medium < slow)', () => {
    expect(DUR_INSTANT).toBeLessThan(DUR_FAST);
    expect(DUR_FAST).toBeLessThan(DUR_NORMAL);
    expect(DUR_NORMAL).toBeLessThan(DUR_MEDIUM);
    expect(DUR_MEDIUM).toBeLessThan(DUR_SLOW);
    expect(DUR_SLOW).toBeLessThan(DUR_DAMAGE_FLOAT);
  });

  it('exports easing as CSS timing-function strings', () => {
    expect(EASE_OUT).toBe('ease-out');
    expect(EASE_IN).toBe('ease-in');
    expect(EASE_LINEAR).toBe('linear');
    expect(EASE_SPRING).toBe('cubic-bezier(.34,1.56,.64,1)');
  });
});

describe('tokens — typography', () => {
  it('display font stack references Baloo 2', () => {
    expect(FONT_DISPLAY).toContain('Baloo 2');
    expect(FONT_DISPLAY).toContain('sans-serif');
  });

  it('UI font stack references Nunito', () => {
    expect(FONT_UI).toContain('Nunito');
    expect(FONT_UI).toContain('sans-serif');
  });
});

describe('tokens — health bar recipes', () => {
  it('exports linear-gradient strings for each legacy health state', () => {
    for (const g of [HEALTH_FULL_GRADIENT, HEALTH_DAMAGED_GRADIENT, HEALTH_CRITICAL_GRADIENT]) {
      expect(g).toContain('linear-gradient');
      expect(g).toContain('90deg');
    }
  });

  it('exports linear-gradient strings for the hull family (teal→gold→red)', () => {
    for (const g of [HULL_FULL_GRADIENT, HULL_DAMAGED_GRADIENT, HULL_CRITICAL_GRADIENT]) {
      expect(g).toContain('linear-gradient');
      expect(g).toContain('90deg');
    }
    // Hull full stays on the teal brand hue.
    expect(HULL_FULL_GRADIENT).toContain('#2dd4aa');
    // Hull critical is red.
    expect(HULL_CRITICAL_GRADIENT).toContain('#ff6060');
  });

  it('exports linear-gradient strings for the armor family (blue→purple→red)', () => {
    for (const g of [ARMOR_FULL_GRADIENT, ARMOR_DAMAGED_GRADIENT, ARMOR_CRITICAL_GRADIENT]) {
      expect(g).toContain('linear-gradient');
      expect(g).toContain('90deg');
    }
    // Armor full is built from the ocean-blue stops.
    expect(ARMOR_FULL_GRADIENT).toContain(OCEAN);
    expect(ARMOR_FULL_GRADIENT).toContain(OCEAN_DARK);
    // Armor damaged is built from the twilight (purple) stops.
    expect(ARMOR_DAMAGED_GRADIENT).toContain(TWILIGHT);
    expect(ARMOR_DAMAGED_GRADIENT).toContain(TWILIGHT_DARK);
    // Armor critical matches hull critical (shared danger red).
    expect(ARMOR_CRITICAL_GRADIENT).toBe(HULL_CRITICAL_GRADIENT);
  });

  it('ocean + twilight accent stops are valid hex literals', () => {
    const HEX_RE_LOCAL = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
    for (const c of [OCEAN, OCEAN_DARK, TWILIGHT, TWILIGHT_DARK]) {
      expect(c).toMatch(HEX_RE_LOCAL);
    }
  });

  it('pins HULL_CRITICAL_THRESHOLD at 0.3', () => {
    expect(HULL_CRITICAL_THRESHOLD).toBe(0.3);
    expect(HULL_CRITICAL_THRESHOLD).toBeGreaterThan(0);
    expect(HULL_CRITICAL_THRESHOLD).toBeLessThan(1);
  });
});

describe('tokens — primary button recipe', () => {
  it('exports a 135deg gold gradient background', () => {
    expect(BTN_PRI_BG).toContain('linear-gradient');
    expect(BTN_PRI_BG).toContain('135deg');
    expect(BTN_PRI_BG).toContain('#f2b640');
  });

  it('exports a non-empty drop-shadow string', () => {
    expect(BTN_PRI_SHADOW).toContain('rgba(');
    expect(BTN_PRI_SHADOW.length).toBeGreaterThan(0);
  });

  it('uses deepest background as high-contrast text color', () => {
    expect(BTN_PRI_COLOR).toBe('#071120');
  });
});
