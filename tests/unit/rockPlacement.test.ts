import { describe, it, expect } from 'vitest';
import { generateRockPositions, ROCK_VARIANT_COUNT } from '@/utils/rockPlacement';

describe('generateRockPositions', () => {
  const SEED = 42;
  const COUNT = 20;
  const ARENA_RADIUS = 200;
  const SAFE_ZONE_RADIUS = 30;
  const MIN_SPACING = 12;

  it('returns correct count of rocks', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    // May be fewer than COUNT if spacing constraints prevent placement,
    // but with reasonable params we expect all to be placed
    expect(rocks.length).toBeLessThanOrEqual(COUNT);
    expect(rocks.length).toBeGreaterThan(0);
  });

  it('same seed produces identical positions (deterministic)', () => {
    const rocks1 = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    const rocks2 = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    expect(rocks1).toEqual(rocks2);
  });

  it('different seed produces different positions', () => {
    const rocks1 = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    const rocks2 = generateRockPositions(99, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    // At least some positions should differ
    let hasDifference = false;
    for (let i = 0; i < Math.min(rocks1.length, rocks2.length); i++) {
      const r1 = rocks1[i];
      const r2 = rocks2[i];
      if (r1 && r2 && (r1.position[0] !== r2.position[0] || r1.position[2] !== r2.position[2])) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);
  });

  it('all rocks are within arena radius', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    for (const rock of rocks) {
      const dist = Math.sqrt(rock.position[0] ** 2 + rock.position[2] ** 2);
      expect(dist).toBeLessThanOrEqual(ARENA_RADIUS);
    }
  });

  it('no rocks are within safe zone radius', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    for (const rock of rocks) {
      const dist = Math.sqrt(rock.position[0] ** 2 + rock.position[2] ** 2);
      expect(dist).toBeGreaterThanOrEqual(SAFE_ZONE_RADIUS);
    }
  });

  it('minimum spacing between any two rocks is >= minSpacing', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    for (let i = 0; i < rocks.length; i++) {
      for (let j = i + 1; j < rocks.length; j++) {
        const ri = rocks[i];
        const rj = rocks[j];
        if (ri && rj) {
          const dx = ri.position[0] - rj.position[0];
          const dz = ri.position[2] - rj.position[2];
          const dist = Math.sqrt(dx * dx + dz * dz);
          expect(dist).toBeGreaterThanOrEqual(MIN_SPACING);
        }
      }
    }
  });

  it('rock scales are within expected bounds', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    for (const rock of rocks) {
      expect(rock.scale[0]).toBeGreaterThanOrEqual(1.0);
      expect(rock.scale[0]).toBeLessThanOrEqual(3.5);
      expect(rock.scale[1]).toBeGreaterThanOrEqual(0.8);
      expect(rock.scale[1]).toBeLessThanOrEqual(2.5);
      expect(rock.scale[2]).toBeGreaterThanOrEqual(1.0);
      expect(rock.scale[2]).toBeLessThanOrEqual(3.5);
    }
  });

  it('rock Y positions are all 0 (water level)', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    for (const rock of rocks) {
      expect(rock.position[1]).toBe(0);
    }
  });

  it('each rock has a valid variant index (0 to ROCK_VARIANT_COUNT-1)', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    for (const rock of rocks) {
      expect(rock.variant).toBeGreaterThanOrEqual(0);
      expect(rock.variant).toBeLessThan(ROCK_VARIANT_COUNT);
      expect(Number.isInteger(rock.variant)).toBe(true);
    }
  });

  it('multiple variant values are used across rocks (variety check)', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    const usedVariants = new Set(rocks.map((r) => r.variant));
    // With 20 rocks across 6 variants, expect at least 3 distinct variants
    expect(usedVariants.size).toBeGreaterThanOrEqual(3);
  });

  it('handles count=0 (returns empty array)', () => {
    const rocks = generateRockPositions(SEED, 0, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    expect(rocks).toEqual([]);
  });

  it('handles count=1 (single rock, no spacing constraint)', () => {
    const rocks = generateRockPositions(SEED, 1, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    expect(rocks.length).toBe(1);
    const rock = rocks[0];
    expect(rock).toBeDefined();
    if (rock) {
      const dist = Math.sqrt(rock.position[0] ** 2 + rock.position[2] ** 2);
      expect(dist).toBeGreaterThanOrEqual(SAFE_ZONE_RADIUS);
      expect(dist).toBeLessThanOrEqual(ARENA_RADIUS);
      expect(rock.variant).toBeGreaterThanOrEqual(0);
      expect(rock.variant).toBeLessThan(ROCK_VARIANT_COUNT);
    }
  });

  it('rocks are distributed across at least 2 of the 3 radial zones', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    const innerEnd = SAFE_ZONE_RADIUS + (ARENA_RADIUS - SAFE_ZONE_RADIUS) * 0.35;
    const midEnd = SAFE_ZONE_RADIUS + (ARENA_RADIUS - SAFE_ZONE_RADIUS) * 0.7;

    let innerCount = 0;
    let midCount = 0;
    let outerCount = 0;

    for (const rock of rocks) {
      const dist = Math.sqrt(rock.position[0] ** 2 + rock.position[2] ** 2);
      if (dist <= innerEnd) innerCount++;
      else if (dist <= midEnd) midCount++;
      else outerCount++;
    }

    const zonesUsed = [innerCount > 0, midCount > 0, outerCount > 0].filter(Boolean).length;
    expect(zonesUsed).toBeGreaterThanOrEqual(2);
  });
});
