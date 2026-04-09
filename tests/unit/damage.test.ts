import { describe, it, expect } from 'vitest';
import { calculateDamage, calculateSplashDamage, regenArmor } from '@/systems/DamageSystem';

describe('DamageSystem -- calculateDamage', () => {
  it('full armor absorbs all damage, hull unchanged', () => {
    const result = calculateDamage({ currentArmor: 50, currentHull: 100, incomingDamage: 30 });
    expect(result.newArmor).toBe(20);
    expect(result.newHull).toBe(100);
    expect(result.armorDamageDealt).toBe(30);
    expect(result.hullDamageDealt).toBe(0);
    expect(result.isSunk).toBe(false);
  });

  it('damage exceeds armor, overflow hits hull', () => {
    const result = calculateDamage({ currentArmor: 20, currentHull: 100, incomingDamage: 50 });
    expect(result.newArmor).toBe(0);
    expect(result.newHull).toBe(70);
    expect(result.armorDamageDealt).toBe(20);
    expect(result.hullDamageDealt).toBe(30);
    expect(result.isSunk).toBe(false);
  });

  it('zero armor means all damage goes to hull', () => {
    const result = calculateDamage({ currentArmor: 0, currentHull: 50, incomingDamage: 30 });
    expect(result.newArmor).toBe(0);
    expect(result.newHull).toBe(20);
    expect(result.armorDamageDealt).toBe(0);
    expect(result.hullDamageDealt).toBe(30);
    expect(result.isSunk).toBe(false);
  });

  it('damage exactly kills hull', () => {
    const result = calculateDamage({ currentArmor: 0, currentHull: 30, incomingDamage: 30 });
    expect(result.newArmor).toBe(0);
    expect(result.newHull).toBe(0);
    expect(result.isSunk).toBe(true);
  });

  it('overkill damage does not make hull negative', () => {
    const result = calculateDamage({ currentArmor: 0, currentHull: 10, incomingDamage: 50 });
    expect(result.newArmor).toBe(0);
    expect(result.newHull).toBe(0);
    expect(result.hullDamageDealt).toBe(10);
    expect(result.isSunk).toBe(true);
  });

  it('massive damage through armor and hull in one hit', () => {
    const result = calculateDamage({ currentArmor: 10, currentHull: 20, incomingDamage: 100 });
    expect(result.newArmor).toBe(0);
    expect(result.newHull).toBe(0);
    expect(result.armorDamageDealt).toBe(10);
    expect(result.hullDamageDealt).toBe(20);
    expect(result.isSunk).toBe(true);
  });

  it('zero damage changes nothing', () => {
    const result = calculateDamage({ currentArmor: 50, currentHull: 100, incomingDamage: 0 });
    expect(result.newArmor).toBe(50);
    expect(result.newHull).toBe(100);
    expect(result.armorDamageDealt).toBe(0);
    expect(result.hullDamageDealt).toBe(0);
    expect(result.isSunk).toBe(false);
  });
});

describe('DamageSystem -- calculateSplashDamage', () => {
  it('returns empty array when no targets in radius', () => {
    const result = calculateSplashDamage(
      [0, 0, 0],
      [{ id: 'far', position: [100, 0, 100] }],
      10,
      5,
      'owner',
    );
    expect(result).toEqual([]);
  });

  it('returns correct attenuated damage for target at half radius', () => {
    const result = calculateSplashDamage(
      [0, 0, 0],
      [{ id: 'target', position: [5, 0, 0] }],
      20,
      10,
      'owner',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('target');
    expect(result[0]?.damage).toBeCloseTo(10); // 50% attenuation at half radius
  });

  it('excludes owner from targets', () => {
    const result = calculateSplashDamage(
      [0, 0, 0],
      [
        { id: 'owner', position: [1, 0, 0] },
        { id: 'other', position: [1, 0, 0] },
      ],
      20,
      10,
      'owner',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('other');
  });

  it('target at edge of radius returns near-zero damage', () => {
    // Place target at 9.9 out of radius 10
    const result = calculateSplashDamage(
      [0, 0, 0],
      [{ id: 'edge', position: [9.9, 0, 0] }],
      100,
      10,
      'owner',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.damage).toBeCloseTo(1, 0); // ~1% of 100
  });

  it('target at center returns full splashDamage', () => {
    const result = calculateSplashDamage(
      [5, 0, 5],
      [{ id: 'center', position: [5, 0, 5] }],
      30,
      10,
      'owner',
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.damage).toBe(30);
  });
});

describe('DamageSystem -- regenArmor', () => {
  it('increases armor by regenRate * delta', () => {
    const result = regenArmor(50, 100, 5, 0.016);
    expect(result).toBeCloseTo(50.08);
  });

  it('does not exceed armorMax', () => {
    const result = regenArmor(99, 100, 10, 1.0);
    expect(result).toBe(100);
  });

  it('armor already at max returns max', () => {
    const result = regenArmor(100, 100, 5, 0.016);
    expect(result).toBe(100);
  });
});
