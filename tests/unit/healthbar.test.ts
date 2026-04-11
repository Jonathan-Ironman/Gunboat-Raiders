/**
 * HealthBar unit tests.
 *
 * Vitest is configured with `environment: 'node'` and only picks up
 * `tests/unit/** /*.test.ts`, so we cannot mount React components here.
 * Instead we exhaustively test the pure state-derivation function
 * (`computeHealthBarState`) which is the single source of truth for the
 * HealthBar's visual state machine. The actual DOM render is verified by
 * the Playwright smoke test `tests/smoke/healthbar-visual.spec.ts`.
 */

import { describe, it, expect } from 'vitest';
import {
  computeHealthBarState,
  ARMOR_DAMAGED_THRESHOLD,
  ARMOR_SHIMMER_CLASS,
  HULL_HEALTHY_THRESHOLD,
  HULL_PULSE_CLASS,
} from '@/ui/HealthBar';
import {
  HEALTH_CRITICAL_GRADIENT,
  HEALTH_DAMAGED_GRADIENT,
  HEALTH_FULL_GRADIENT,
  HULL_CRITICAL_THRESHOLD,
} from '@/ui/tokens';

// Readable fixture builder — defaults to "max HP, no damage, alive".
function snap(
  overrides: Partial<{
    armor: number;
    armorMax: number;
    hull: number;
    hullMax: number;
    isSinking: boolean;
  }> = {},
) {
  return computeHealthBarState({
    armor: 100,
    armorMax: 100,
    hull: 100,
    hullMax: 100,
    isSinking: false,
    ...overrides,
  });
}

describe('HealthBar — computeHealthBarState — armor state', () => {
  it('reports teal (full) gradient at max armor', () => {
    const s = snap({ armor: 100, armorMax: 100 });
    expect(s.armorState).toBe('full');
    expect(s.armorFillGradient).toBe(HEALTH_FULL_GRADIENT);
    expect(s.armorPct).toBe(100);
  });

  it('stays teal exactly at the damaged threshold', () => {
    const s = snap({ armor: 50, armorMax: 100 }); // 50% === threshold
    expect(s.armorState).toBe('full');
    expect(s.armorFillGradient).toBe(HEALTH_FULL_GRADIENT);
  });

  it('switches to amber (damaged) below the threshold', () => {
    const s = snap({ armor: 49, armorMax: 100 });
    expect(s.armorState).toBe('damaged');
    expect(s.armorFillGradient).toBe(HEALTH_DAMAGED_GRADIENT);
  });

  it('clamps armorPct into [0, 100]', () => {
    expect(snap({ armor: -10, armorMax: 100 }).armorPct).toBe(0);
    expect(snap({ armor: 200, armorMax: 100 }).armorPct).toBe(100);
  });

  it('handles armorMax === 0 without dividing by zero', () => {
    const s = snap({ armor: 0, armorMax: 0 });
    expect(s.armorPct).toBe(0);
    expect(s.armorState).toBe('damaged');
  });
});

describe('HealthBar — computeHealthBarState — armor shimmer gating', () => {
  it('turns shimmer ON when armor is below max and boat is alive', () => {
    const s = snap({ armor: 50, armorMax: 100, isSinking: false });
    expect(s.armorShimmerActive).toBe(true);
  });

  it('turns shimmer OFF when armor is full', () => {
    const s = snap({ armor: 100, armorMax: 100 });
    expect(s.armorShimmerActive).toBe(false);
  });

  it('turns shimmer OFF when the boat is sinking, even mid-repair', () => {
    const s = snap({ armor: 30, armorMax: 100, isSinking: true });
    expect(s.armorShimmerActive).toBe(false);
  });

  it('shimmer OFF when armor is above max (defensive clamp)', () => {
    const s = snap({ armor: 150, armorMax: 100 });
    expect(s.armorShimmerActive).toBe(false);
  });
});

describe('HealthBar — computeHealthBarState — hull state', () => {
  it('reports teal at full hull', () => {
    const s = snap({ hull: 100, hullMax: 100 });
    expect(s.hullState).toBe('full');
    expect(s.hullFillGradient).toBe(HEALTH_FULL_GRADIENT);
  });

  it('reports amber when hull drops into the damaged band', () => {
    const s = snap({ hull: 50, hullMax: 100 });
    expect(s.hullState).toBe('damaged');
    expect(s.hullFillGradient).toBe(HEALTH_DAMAGED_GRADIENT);
  });

  it('reports critical at or below the critical threshold', () => {
    const pct = HULL_CRITICAL_THRESHOLD; // 0.3
    const s = snap({ hull: Math.round(pct * 100), hullMax: 100 });
    expect(s.hullState).toBe('critical');
    expect(s.hullFillGradient).toBe(HEALTH_CRITICAL_GRADIENT);
  });

  it('switches to damaged just above the critical threshold', () => {
    const s = snap({ hull: 31, hullMax: 100 });
    expect(s.hullState).toBe('damaged');
  });

  it('stays damaged exactly at the healthy threshold', () => {
    const hullAtBoundary = Math.round(HULL_HEALTHY_THRESHOLD * 100);
    const s = snap({ hull: hullAtBoundary, hullMax: 100 });
    expect(s.hullState).toBe('damaged');
  });

  it('is full just above the healthy threshold', () => {
    const s = snap({ hull: 61, hullMax: 100 });
    expect(s.hullState).toBe('full');
  });
});

describe('HealthBar — computeHealthBarState — hull critical effects', () => {
  it('activates pulse and outline when hull is critical', () => {
    const s = snap({ hull: 25, hullMax: 100 });
    expect(s.hullPulseActive).toBe(true);
    expect(s.hullOutlineActive).toBe(true);
  });

  it('leaves pulse and outline off when hull is merely damaged', () => {
    const s = snap({ hull: 50, hullMax: 100 });
    expect(s.hullPulseActive).toBe(false);
    expect(s.hullOutlineActive).toBe(false);
  });

  it('leaves pulse and outline off at full hull', () => {
    const s = snap({ hull: 100, hullMax: 100 });
    expect(s.hullPulseActive).toBe(false);
    expect(s.hullOutlineActive).toBe(false);
  });

  it('hull pulse is independent of armor shimmer', () => {
    // Scenario: max armor (no shimmer), critical hull (pulse on).
    const s = snap({ armor: 100, armorMax: 100, hull: 20, hullMax: 100 });
    expect(s.armorShimmerActive).toBe(false);
    expect(s.hullPulseActive).toBe(true);
  });
});

describe('HealthBar — exports are usable by consumers', () => {
  it('pins the armor damaged threshold at 50%', () => {
    expect(ARMOR_DAMAGED_THRESHOLD).toBe(0.5);
  });

  it('pins the hull healthy threshold at 60%', () => {
    expect(HULL_HEALTHY_THRESHOLD).toBe(0.6);
  });

  it('exposes non-empty CSS class names for the animations', () => {
    expect(ARMOR_SHIMMER_CLASS.length).toBeGreaterThan(0);
    expect(HULL_PULSE_CLASS.length).toBeGreaterThan(0);
    expect(ARMOR_SHIMMER_CLASS).not.toBe(HULL_PULSE_CLASS);
  });
});

describe('HealthBar — spec scenarios from R11 brief', () => {
  it('armor=50 / hull=100 shows armor shimmer, no hull pulse', () => {
    const s = snap({ armor: 50, hull: 100 });
    expect(s.armorShimmerActive).toBe(true);
    expect(s.hullPulseActive).toBe(false);
    expect(s.hullOutlineActive).toBe(false);
  });

  it('armor=100 / hull=30 shows hull critical pulse, no armor shimmer', () => {
    const s = snap({ armor: 100, hull: 30 });
    expect(s.armorShimmerActive).toBe(false);
    expect(s.hullPulseActive).toBe(true);
    expect(s.hullOutlineActive).toBe(true);
    expect(s.hullFillGradient).toBe(HEALTH_CRITICAL_GRADIENT);
  });
});
