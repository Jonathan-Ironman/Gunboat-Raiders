import { describe, it, expect } from 'vitest';
import { tickCooldowns, canFire, computeFireData } from '@/systems/WeaponSystem';
import type { WeaponState } from '@/systems/WeaponSystem';
import type { WeaponMount } from '@/store/gameStore';
import { BOAT_STATS } from '@/utils/boatStats';

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
  it('returns true when cooldownRemaining is 0', () => {
    const state = makeWeaponState({ fore: 0 });
    expect(canFire(state, 'fore')).toBe(true);
  });

  it('returns false when cooldownRemaining > 0', () => {
    const state = makeWeaponState({ fore: 0.5 });
    expect(canFire(state, 'fore')).toBe(false);
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
