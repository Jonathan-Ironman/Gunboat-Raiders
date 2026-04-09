import { describe, it, expect } from 'vitest';
import { getQuadrant, normalizeAngle } from '@/utils/math';

describe('getQuadrant', () => {
  it('returns "fore" when camera faces same direction as boat', () => {
    expect(getQuadrant(0, 0)).toBe('fore');
  });

  it('returns "fore" at exactly PI/4 boundary (exclusive)', () => {
    // Just inside fore range
    expect(getQuadrant(Math.PI / 4 - 0.001, 0)).toBe('fore');
  });

  it('returns "starboard" when camera is right of boat heading', () => {
    expect(getQuadrant(Math.PI / 2, 0)).toBe('starboard');
  });

  it('returns "port" when camera is left of boat heading', () => {
    expect(getQuadrant(-Math.PI / 2, 0)).toBe('port');
  });

  it('returns "aft" when camera faces opposite to boat', () => {
    expect(getQuadrant(Math.PI, 0)).toBe('aft');
    expect(getQuadrant(-Math.PI, 0)).toBe('aft');
  });

  it('handles angle wrapping around PI/-PI correctly', () => {
    // Camera at PI + 0.1 (just past PI, equivalent to -PI + 0.1), boat heading at 0.
    // relative = PI + 0.1, normalized → -(PI - 0.1) ≈ -3.04 → "aft"
    expect(getQuadrant(Math.PI + 0.1, 0)).toBe('aft');
    // Camera and boat both at ~PI — camera is ahead of boat → "fore"
    expect(getQuadrant(Math.PI - 0.1, Math.PI - 0.1)).toBe('fore');
  });

  it('works with non-zero boat heading', () => {
    // Camera and boat both at PI/2 — camera is directly ahead = "fore"
    expect(getQuadrant(Math.PI / 2, Math.PI / 2)).toBe('fore');
  });
});

describe('normalizeAngle', () => {
  it('keeps values in [-PI, PI] range', () => {
    // 3*PI normalizes to -PI (which is valid — the boundary)
    const result = normalizeAngle(3 * Math.PI);
    expect(Math.abs(result)).toBeCloseTo(Math.PI);

    // 2.5*PI should land in the first quadrant
    const result2 = normalizeAngle(2.5 * Math.PI);
    expect(result2).toBeGreaterThanOrEqual(-Math.PI);
    expect(result2).toBeLessThanOrEqual(Math.PI);
  });

  it('handles zero', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
  });
});
