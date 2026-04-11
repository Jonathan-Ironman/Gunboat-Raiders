import { describe, it, expect } from 'vitest';
import {
  tickCooldowns,
  canFire,
  computeFireData,
  applyShotHeat,
  decayHeat,
  heatBracketCooldownMultiplier,
  isFireAllowedByHeat,
  nextLockout,
  type HeatState,
} from '@/systems/WeaponSystem';
import type { WeaponState } from '@/systems/WeaponSystem';
import type { WeaponMount } from '@/store/gameStore';
import { BOAT_STATS } from '@/utils/boatStats';
import {
  HEAT_COOLDOWN_MULT_GREEN,
  HEAT_COOLDOWN_MULT_RED,
  HEAT_COOLDOWN_MULT_YELLOW,
  HEAT_DECAY_PER_SECOND,
  HEAT_LOCKOUT_RECOVERY_THRESHOLD,
  HEAT_MAX_SHOTS_PER_SECOND,
  HEAT_MAX_SUSTAINED_SECONDS,
  HEAT_PER_SHOT,
} from '@/utils/overheatConstants';

function makeWeaponState(overrides?: Partial<Record<string, number>>): WeaponState {
  return {
    cooldown: 2.0,
    cooldownRemaining: {
      fore: overrides?.fore ?? 0,
      aft: overrides?.aft ?? 0,
      port: overrides?.port ?? 0,
      starboard: overrides?.starboard ?? 0,
    },
  };
}

describe('WeaponSystem — tickCooldowns', () => {
  it('reduces remaining time by delta', () => {
    const state = makeWeaponState({ fore: 1.5, port: 0.8 });
    const result = tickCooldowns(state, 0.5);

    expect(result.cooldownRemaining.fore).toBeCloseTo(1.0);
    expect(result.cooldownRemaining.port).toBeCloseTo(0.3);
  });

  it('does not go below zero', () => {
    const state = makeWeaponState({ fore: 0.2 });
    const result = tickCooldowns(state, 1.0);

    expect(result.cooldownRemaining.fore).toBe(0);
  });
});

describe('WeaponSystem — canFire', () => {
  it('returns true when cooldownRemaining is 0 (ready to fire)', () => {
    const state = makeWeaponState({ fore: 0 });
    expect(canFire(state, 'fore')).toBe(true);
  });

  it('returns false when cooldownRemaining > 0 (cooldown active)', () => {
    const state = makeWeaponState({ fore: 0.14 });
    expect(canFire(state, 'fore')).toBe(false);
  });

  it('returns true once cooldown ticks to 0 (gate clears correctly)', () => {
    // Simulate 150ms cooldown expiry step by step
    let state = makeWeaponState({ port: 0.15 });
    state = tickCooldowns(state, 0.14);
    expect(canFire(state, 'port')).toBe(false); // 0.01s remaining
    state = tickCooldowns(state, 0.02);
    expect(canFire(state, 'port')).toBe(true); // now at 0
  });

  it('only gates the fired quadrant; other quadrants remain independently ready', () => {
    const state = makeWeaponState({ port: 0.15, starboard: 0, fore: 0, aft: 0 });
    expect(canFire(state, 'port')).toBe(false);
    expect(canFire(state, 'starboard')).toBe(true);
    expect(canFire(state, 'fore')).toBe(true);
    expect(canFire(state, 'aft')).toBe(true);
  });
});

describe('WeaponSystem — computeFireData', () => {
  const playerMounts = BOAT_STATS.player.weapons.mounts as unknown as WeaponMount[];
  const identityQuat: [number, number, number, number] = [0, 0, 0, 1];
  const origin: [number, number, number] = [0, 0, 0];
  const muzzleVelocity = 30;
  const elevationAngle = 0.35;

  it('returns correct number of spawns for port (4 mounts)', () => {
    const spawns = computeFireData(
      playerMounts,
      'port',
      origin,
      identityQuat,
      muzzleVelocity,
      elevationAngle,
    );
    expect(spawns).toHaveLength(4);
  });

  it('returns correct number of spawns for fore (2 mounts)', () => {
    const spawns = computeFireData(
      playerMounts,
      'fore',
      origin,
      identityQuat,
      muzzleVelocity,
      elevationAngle,
    );
    expect(spawns).toHaveLength(2);
  });

  it('returns correct number of spawns for aft (1 mount)', () => {
    const spawns = computeFireData(
      playerMounts,
      'aft',
      origin,
      identityQuat,
      muzzleVelocity,
      elevationAngle,
    );
    expect(spawns).toHaveLength(1);
  });

  it('impulse has non-zero Y component (elevation angle)', () => {
    const spawns = computeFireData(
      playerMounts,
      'fore',
      origin,
      identityQuat,
      muzzleVelocity,
      elevationAngle,
    );

    for (const spawn of spawns) {
      expect(spawn.impulse[1]).toBeGreaterThan(0);
    }
  });

  it('with boat rotated 90deg produces rotated impulse directions', () => {
    // Quaternion for 90 degrees around Y axis: (0, sin(45deg), 0, cos(45deg))
    const sin45 = Math.sin(Math.PI / 4);
    const cos45 = Math.cos(Math.PI / 4);
    const rotatedQuat: [number, number, number, number] = [0, sin45, 0, cos45];

    // With identity quaternion, fore mounts fire along +Z
    const spawnsIdentity = computeFireData(
      playerMounts,
      'fore',
      origin,
      identityQuat,
      muzzleVelocity,
      elevationAngle,
    );

    // With 90deg Y rotation, fore mounts should fire along +X instead of +Z
    const spawnsRotated = computeFireData(
      playerMounts,
      'fore',
      origin,
      rotatedQuat,
      muzzleVelocity,
      elevationAngle,
    );

    // Identity: impulse Z should be large, X near zero
    expect(spawnsIdentity).toHaveLength(2);
    const identityImpulse = spawnsIdentity[0]?.impulse ?? [0, 0, 0];
    expect(Math.abs(identityImpulse[0])).toBeLessThan(1);
    expect(identityImpulse[2]).toBeGreaterThan(10);

    // Rotated 90deg: impulse X should be large, Z near zero
    expect(spawnsRotated).toHaveLength(2);
    const rotatedImpulse = spawnsRotated[0]?.impulse ?? [0, 0, 0];
    expect(rotatedImpulse[0]).toBeGreaterThan(10);
    expect(Math.abs(rotatedImpulse[2])).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Required regression tests (4 new, per task brief)
// ---------------------------------------------------------------------------

describe('WeaponSystem — cooldown gate (Test: cooldown gate)', () => {
  it('canFire() returns false inside the 150ms cooldown window', () => {
    // Simulates: fire port → cooldownRemaining.port = 0.15. Immediately call canFire.
    const state = makeWeaponState({ port: 0.15 });
    expect(canFire(state, 'port')).toBe(false);
  });

  it('canFire() returns true once past the 150ms cooldown window', () => {
    // Advance past cooldown
    let state = makeWeaponState({ port: 0.15 });
    state = tickCooldowns(state, 0.16); // 0.16 > 0.15 → elapsed
    expect(canFire(state, 'port')).toBe(true);
  });
});

describe('WeaponSystem — consistent fire rate (Test: consistent fire rate)', () => {
  /**
   * Simulate 100 fire attempts at 10 clicks/second over 10 seconds.
   * At 150ms cooldown, a fire attempt every 100ms means every other click
   * (at 100ms intervals) should succeed — but the point is zero silent drops
   * at >= 150ms intervals.
   *
   * This test uses 200ms between clicks (safely above 150ms) and asserts
   * EVERY click produces a successful fire after cooldown resets.
   */
  it('every click at >=150ms interval succeeds, no silent drops', () => {
    const CLICK_INTERVAL = 0.2; // 200ms between clicks — above 150ms cooldown
    const CLICK_COUNT = 50;
    let state: WeaponState = {
      cooldown: 0.15,
      cooldownRemaining: { fore: 0, aft: 0, port: 0, starboard: 0 },
    };

    let successCount = 0;
    for (let i = 0; i < CLICK_COUNT; i++) {
      // Advance time by click interval (simulates next click arriving)
      state = tickCooldowns(state, CLICK_INTERVAL);

      if (canFire(state, 'port')) {
        successCount++;
        // Reset cooldown for port as WeaponSystemR3F would
        state = {
          ...state,
          cooldownRemaining: { ...state.cooldownRemaining, port: state.cooldown },
        };
      }
    }

    // Every click at 200ms interval (> 150ms cooldown) must succeed
    expect(successCount).toBe(CLICK_COUNT);
  });
});

// ---------------------------------------------------------------------------
// Overheat mechanic tests
// ---------------------------------------------------------------------------

/**
 * Pure-logic tests for the shared overheat model. These are deterministic
 * and do not touch R3F — they exercise only the helpers in WeaponSystem.ts
 * and the constants in overheatConstants.ts. The R3F wrapper's integration
 * (per-frame tick, cooldown bracket application, pending-fire gating) is
 * verified end-to-end by the Playwright smoke spec.
 */
describe('WeaponSystem — overheat model', () => {
  const FRESH: HeatState = { heat: 0, lockedOut: false };
  /**
   * Simulated frame rate for deterministic loop tests. Chosen at
   * 1000 Hz rather than 60 Hz because 60 Hz under-samples the 150 ms
   * cooldown (the floating-point tick undershoots 0.15 by ~10⁻¹⁵ so the
   * cooldown gate actually fires every 10 frames = 6 Hz, not every 9
   * frames = 6.67 Hz). At 1000 Hz the cadence is 150 frames per fire
   * and the observed rate matches the continuous-time target.
   *
   * This is only about TEST-loop resolution — the real WeaponSystemR3F
   * runs at display fps and its cooldown tick is delta-weighted, so the
   * production behaviour is frame-rate independent.
   */
  const FPS = 1000;
  const FRAME_DELTA = 1 / FPS;

  it('20 s of simulated max-rate broadside sustained fire reaches heat ≈ 1.0', () => {
    // Net per-second math sanity check (independent of the loop):
    //   shots/s × HEAT_PER_SHOT − HEAT_DECAY_PER_SECOND == 1 / 20
    const netPerSecond = HEAT_MAX_SHOTS_PER_SECOND * HEAT_PER_SHOT - HEAT_DECAY_PER_SECOND;
    expect(netPerSecond).toBeCloseTo(1 / HEAT_MAX_SUSTAINED_SECONDS, 4);

    // Simulate the real R3F main loop at 60 fps over 20 s:
    //   - Each frame: decay heat (always-on model)
    //   - If cooldown elapsed: fire 4 projectiles (full broadside), reset
    //     cooldown to the BASE cooldown (no bracket scaling — this is the
    //     calibration point).
    //
    // Iterating by integer frame count (not float t += delta) prevents
    // floating-point drift from truncating the loop early.
    let state: HeatState = FRESH;
    let cooldown = 0;
    const BASE_COOLDOWN = 0.15;
    const MOUNTS_PER_BROADSIDE = 4;
    const TOTAL_FRAMES = Math.round(HEAT_MAX_SUSTAINED_SECONDS * FPS);

    for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
      state = decayHeat(state, FRAME_DELTA);
      cooldown = Math.max(0, cooldown - FRAME_DELTA);
      if (cooldown <= 0 && !state.lockedOut) {
        for (let m = 0; m < MOUNTS_PER_BROADSIDE; m++) {
          state = applyShotHeat(state);
        }
        cooldown = BASE_COOLDOWN;
      }
    }

    // At 60 fps / 150 ms cooldown the discrete loop fires ~1 click per
    // 9 frames (6.67 fires/s instead of the continuous target of 6.67 —
    // identical in the continuous limit) so total heat at 20 s is
    // closely bounded around 1.0. Allow a small tolerance for the
    // integer-frame discretisation and the clamp at 1.0.
    expect(state.heat).toBeGreaterThanOrEqual(0.85);
    expect(state.heat).toBeLessThanOrEqual(1.0);

    // The same loop run for half the window should reach ~50%.
    let halfState: HeatState = FRESH;
    let halfCooldown = 0;
    for (let frame = 0; frame < TOTAL_FRAMES / 2; frame++) {
      halfState = decayHeat(halfState, FRAME_DELTA);
      halfCooldown = Math.max(0, halfCooldown - FRAME_DELTA);
      if (halfCooldown <= 0 && !halfState.lockedOut) {
        for (let m = 0; m < MOUNTS_PER_BROADSIDE; m++) {
          halfState = applyShotHeat(halfState);
        }
        halfCooldown = BASE_COOLDOWN;
      }
    }
    expect(halfState.heat).toBeGreaterThanOrEqual(0.4);
    expect(halfState.heat).toBeLessThanOrEqual(0.6);
  });

  it('fully overheated weapon recovers to 0 within 10–15 seconds of idle decay', () => {
    // Start at max heat + locked out, then tick decayHeat at 60 fps.
    let state: HeatState = { heat: 1, lockedOut: true };
    const FPS = 60;
    const FRAME_DELTA = 1 / FPS;
    const MAX_SECONDS = 20; // safety ceiling on the loop

    let secondsToZero = MAX_SECONDS;
    for (let frame = 0; frame < MAX_SECONDS * FPS; frame++) {
      state = decayHeat(state, FRAME_DELTA);
      if (state.heat <= 0) {
        secondsToZero = (frame + 1) * FRAME_DELTA;
        break;
      }
    }

    // Within the design window of 10–15 seconds of full recovery.
    expect(secondsToZero).toBeGreaterThanOrEqual(10);
    expect(secondsToZero).toBeLessThanOrEqual(15);
    // Analytic cross-check: 1 / HEAT_DECAY_PER_SECOND seconds exactly
    // (allowing one-frame rounding).
    expect(secondsToZero).toBeCloseTo(1 / HEAT_DECAY_PER_SECOND, 1);
  });

  it('bracket multipliers step from green → yellow → red at the documented thresholds', () => {
    // Green bracket
    expect(heatBracketCooldownMultiplier(0)).toBe(HEAT_COOLDOWN_MULT_GREEN);
    expect(heatBracketCooldownMultiplier(0.25)).toBe(HEAT_COOLDOWN_MULT_GREEN);
    expect(heatBracketCooldownMultiplier(0.4999)).toBe(HEAT_COOLDOWN_MULT_GREEN);
    // Yellow bracket
    expect(heatBracketCooldownMultiplier(0.5)).toBe(HEAT_COOLDOWN_MULT_YELLOW);
    expect(heatBracketCooldownMultiplier(0.75)).toBe(HEAT_COOLDOWN_MULT_YELLOW);
    expect(heatBracketCooldownMultiplier(0.8999)).toBe(HEAT_COOLDOWN_MULT_YELLOW);
    // Red bracket
    expect(heatBracketCooldownMultiplier(0.9)).toBe(HEAT_COOLDOWN_MULT_RED);
    expect(heatBracketCooldownMultiplier(0.95)).toBe(HEAT_COOLDOWN_MULT_RED);
    expect(heatBracketCooldownMultiplier(1.0)).toBe(HEAT_COOLDOWN_MULT_RED);
    // Green < yellow < red sanity check
    expect(HEAT_COOLDOWN_MULT_GREEN).toBeLessThan(HEAT_COOLDOWN_MULT_YELLOW);
    expect(HEAT_COOLDOWN_MULT_YELLOW).toBeLessThan(HEAT_COOLDOWN_MULT_RED);
  });

  it('lockout at 100% heat blocks firing and stays sticky until heat drops below recovery threshold', () => {
    // Drive heat to 1.0 and confirm lockout engages + fire is blocked.
    let state: HeatState = { heat: 0.999, lockedOut: false };
    state = applyShotHeat(state);
    expect(state.heat).toBe(1);
    expect(state.lockedOut).toBe(true);
    expect(isFireAllowedByHeat(state)).toBe(false);

    // Lockout is sticky: decaying heat from 1.0 down to 0.86 should still
    // leave the weapon locked (above the recovery threshold of 0.85).
    state = { heat: 0.86, lockedOut: true };
    state = { ...state, lockedOut: nextLockout(state.heat, state.lockedOut) };
    expect(state.lockedOut).toBe(true);
    expect(isFireAllowedByHeat(state)).toBe(false);

    // Once heat crosses below HEAT_LOCKOUT_RECOVERY_THRESHOLD the lockout
    // clears and firing is permitted again.
    state = { heat: HEAT_LOCKOUT_RECOVERY_THRESHOLD - 0.001, lockedOut: true };
    state = { ...state, lockedOut: nextLockout(state.heat, state.lockedOut) };
    expect(state.lockedOut).toBe(false);
    expect(isFireAllowedByHeat(state)).toBe(true);

    // Sanity: applying a shot at 0 does not engage lockout.
    const fresh = applyShotHeat({ heat: 0, lockedOut: false });
    expect(fresh.heat).toBeCloseTo(HEAT_PER_SHOT);
    expect(fresh.lockedOut).toBe(false);
  });
});
