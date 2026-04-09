import { describe, it, expect } from 'vitest';
import { generateRockPositions } from '@/utils/rockPlacement';

describe('generateRockPositions', () => {
  const SEED = 42;
  const COUNT = 20;
  const ARENA_RADIUS = 200;
  const SAFE_ZONE_RADIUS = 30;
  const MIN_SPACING = 15;

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
    expect(rocks1.length).toBe(rocks2.length);
    let hasDifference = false;
    for (let i = 0; i < rocks1.length; i++) {
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
      expect(rock.scale[0]).toBeGreaterThanOrEqual(1.5);
      expect(rock.scale[0]).toBeLessThanOrEqual(4);
      expect(rock.scale[1]).toBeGreaterThanOrEqual(2);
      expect(rock.scale[1]).toBeLessThanOrEqual(6);
      expect(rock.scale[2]).toBeGreaterThanOrEqual(1.5);
      expect(rock.scale[2]).toBeLessThanOrEqual(4);
    }
  });

  it('rock Y positions are all 0 (water level)', () => {
    const rocks = generateRockPositions(SEED, COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING);
    for (const rock of rocks) {
      expect(rock.position[1]).toBe(0);
    }
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
    }
  });
});
