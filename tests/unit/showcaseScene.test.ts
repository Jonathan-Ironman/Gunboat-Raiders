/**
 * Unit tests for R8 — ShowcaseScene pure logic.
 *
 * These tests cover everything the showcase backdrop depends on that
 * can be exercised without a renderer or Rapier world:
 *
 * 1. `SHOWCASE_PRESETS` — shape, count, required fields.
 * 2. `pickShowcasePreset` — deterministic picker driven by an RNG
 *    parameter. Verifies round-robin coverage + out-of-range safety.
 * 3. `computeShowcaseBoatTarget` — the per-frame path driver used by
 *    `ShowcasePlayerBoat`. Checks stationary / straight / circle cases.
 * 4. `shortestAngleDelta` — yaw-tracking helper.
 */

import { describe, expect, it } from 'vitest';

import {
  SHOWCASE_PRESETS,
  pickShowcasePreset,
  type ShowcasePreset,
} from '@/scenes/showcasePresets';
import { computeShowcaseBoatTarget, shortestAngleDelta } from '@/scenes/showcaseBoatPath';

// ---------------------------------------------------------------------------
// SHOWCASE_PRESETS — static catalogue
// ---------------------------------------------------------------------------

describe('scenes/showcasePresets — SHOWCASE_PRESETS', () => {
  it('contains exactly three hand-tuned presets (R8 spec)', () => {
    expect(SHOWCASE_PRESETS.length).toBe(3);
  });

  it('exposes the three canonical preset names in order', () => {
    const names = SHOWCASE_PRESETS.map((p) => p.name);
    expect(names).toEqual(['Calm Heading Out', 'Lazy Circle', 'Anchored at Dawn']);
  });

  it('every preset has a valid boat + camera config', () => {
    for (const preset of SHOWCASE_PRESETS) {
      expect(preset.name.trim().length).toBeGreaterThan(0);
      expect(preset.boat.startPos).toHaveLength(3);
      expect(['straight', 'circle', 'stationary']).toContain(preset.boat.path);
      expect(preset.boat.speed).toBeGreaterThanOrEqual(0);
      expect(['cinematic-side', 'orbit-slow', 'pan-slow']).toContain(preset.camera.mode);
      expect(preset.camera.distance).toBeGreaterThan(0);
      expect(preset.camera.height).toBeGreaterThan(0);
    }
  });

  it('circle preset defines a positive radius', () => {
    const circle = SHOWCASE_PRESETS.find((p) => p.boat.path === 'circle');
    expect(circle).toBeDefined();
    if (circle === undefined) throw new Error('expected a circle preset');
    expect(circle.boat.radius).toBeDefined();
    expect(circle.boat.radius ?? 0).toBeGreaterThan(0);
  });

  it('stationary preset has zero speed', () => {
    const stationary = SHOWCASE_PRESETS.find((p) => p.boat.path === 'stationary');
    expect(stationary).toBeDefined();
    expect(stationary?.boat.speed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// pickShowcasePreset
// ---------------------------------------------------------------------------

describe('scenes/showcasePresets — pickShowcasePreset', () => {
  it('returns the first preset when rng yields 0', () => {
    const picked = pickShowcasePreset(() => 0);
    expect(picked.name).toBe(SHOWCASE_PRESETS[0]?.name);
  });

  it('returns the last preset when rng yields just under 1', () => {
    const picked = pickShowcasePreset(() => 0.9999999);
    expect(picked.name).toBe(SHOWCASE_PRESETS[SHOWCASE_PRESETS.length - 1]?.name);
  });

  it('returns the middle preset when rng yields 0.5', () => {
    const picked = pickShowcasePreset(() => 0.5);
    // With 3 presets, floor(0.5 * 3) === 1
    expect(picked.name).toBe(SHOWCASE_PRESETS[1]?.name);
  });

  it('clamps out-of-range rng results into a safe index', () => {
    const above = pickShowcasePreset(() => 2.5);
    const below = pickShowcasePreset(() => -1);
    expect(SHOWCASE_PRESETS).toContainEqual(above);
    expect(SHOWCASE_PRESETS).toContainEqual(below);
  });

  it('coerces NaN into the first preset', () => {
    const picked = pickShowcasePreset(() => Number.NaN);
    expect(picked.name).toBe(SHOWCASE_PRESETS[0]?.name);
  });

  it('defaults to Math.random when no rng is supplied', () => {
    // Call a few times — whichever preset is picked must be a member of
    // the canonical list. This exercises the default-parameter branch.
    for (let i = 0; i < 10; i++) {
      const picked: ShowcasePreset = pickShowcasePreset();
      expect(SHOWCASE_PRESETS).toContainEqual(picked);
    }
  });
});

// ---------------------------------------------------------------------------
// computeShowcaseBoatTarget
// ---------------------------------------------------------------------------

describe('scenes/ShowcasePlayerBoat — computeShowcaseBoatTarget', () => {
  it('stationary preset returns zero velocity + heading at any time', () => {
    const cfg = { startPos: [0, 0, 0] as const, path: 'stationary' as const, speed: 0 };
    for (const t of [0, 1, 5, 37.2, 1000]) {
      const { vx, vz, heading } = computeShowcaseBoatTarget(cfg, t);
      expect(vx).toBe(0);
      expect(vz).toBe(0);
      expect(heading).toBe(0);
    }
  });

  it('straight preset pushes forward along +Z with matching heading', () => {
    const cfg = { startPos: [0, 0, 0] as const, path: 'straight' as const, speed: 4 };
    const { vx, vz, heading } = computeShowcaseBoatTarget(cfg, 12.5);
    expect(vx).toBe(0);
    expect(vz).toBe(4);
    expect(heading).toBe(0);
  });

  it('circle preset produces a tangent velocity with the configured speed', () => {
    const cfg = {
      startPos: [0, 0, 0] as const,
      path: 'circle' as const,
      speed: 3,
      radius: 18,
    };
    // Speed of the tangent velocity must always equal `speed`.
    for (const t of [0, 1.5, 7, 13.37]) {
      const { vx, vz } = computeShowcaseBoatTarget(cfg, t);
      const speed = Math.sqrt(vx * vx + vz * vz);
      expect(speed).toBeCloseTo(3, 6);
    }
  });

  it('circle preset at t=0 faces along +Z with zero X velocity', () => {
    const cfg = {
      startPos: [0, 0, 0] as const,
      path: 'circle' as const,
      speed: 3,
      radius: 18,
    };
    const { vx, vz, heading } = computeShowcaseBoatTarget(cfg, 0);
    expect(vx).toBeCloseTo(0, 6);
    expect(vz).toBeCloseTo(3, 6);
    expect(heading).toBeCloseTo(0, 6);
  });

  it('circle preset with zero radius degenerates into a stationary yaw', () => {
    // `radius: 0` is not a legal preset, but the function should still
    // behave defensively instead of dividing by zero.
    const cfg = {
      startPos: [0, 0, 0] as const,
      path: 'circle' as const,
      speed: 3,
      radius: 0,
    };
    const { vx, vz } = computeShowcaseBoatTarget(cfg, 10);
    // Angular velocity is forced to zero inside the function, so the
    // tangent velocity evaluates to (0, speed * cos(0)) = (0, 3).
    expect(vx).toBeCloseTo(0, 6);
    expect(vz).toBeCloseTo(3, 6);
  });
});

// ---------------------------------------------------------------------------
// shortestAngleDelta
// ---------------------------------------------------------------------------

describe('scenes/ShowcasePlayerBoat — shortestAngleDelta', () => {
  it('returns zero for identical angles', () => {
    expect(shortestAngleDelta(0, 0)).toBeCloseTo(0);
    expect(shortestAngleDelta(1.2, 1.2)).toBeCloseTo(0);
  });

  it('returns the simple difference for small positive deltas', () => {
    expect(shortestAngleDelta(0, 0.5)).toBeCloseTo(0.5);
  });

  it('wraps through π the short way (-π + ε to π - ε)', () => {
    // A near-full-turn clockwise should resolve to a tiny
    // counter-clockwise delta.
    const current = -Math.PI + 0.05;
    const target = Math.PI - 0.05;
    const delta = shortestAngleDelta(current, target);
    // Going the short way is ~-0.1 (i.e. a small negative delta),
    // not ~2π - 0.1.
    expect(Math.abs(delta)).toBeLessThan(0.2);
    expect(delta).toBeLessThan(0);
  });

  it('wraps through -π the short way (π - ε to -π + ε)', () => {
    const current = Math.PI - 0.05;
    const target = -Math.PI + 0.05;
    const delta = shortestAngleDelta(current, target);
    expect(Math.abs(delta)).toBeLessThan(0.2);
    expect(delta).toBeGreaterThan(0);
  });
});
