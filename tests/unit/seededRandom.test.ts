import { describe, it, expect } from 'vitest';
import { createSeededRandom } from '@/utils/seededRandom';

describe('createSeededRandom', () => {
  it('same seed produces same sequence', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);

    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);

    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());

    // They should differ at at least one point
    expect(seq1).not.toEqual(seq2);
  });

  it('output is in range [0, 1)', () => {
    const rng = createSeededRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('seed 0 works without infinite loop', () => {
    const rng = createSeededRandom(0);
    // Should produce values, not hang
    const val = rng();
    expect(typeof val).toBe('number');
  });
});
