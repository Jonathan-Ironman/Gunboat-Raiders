import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAimOffset,
  setAimOffset,
  resetAimOffset,
  MAX_YAW_OFFSET,
  MAX_PITCH_OFFSET_UP,
  MAX_PITCH_OFFSET_DOWN,
} from '@/systems/aimOffsetRefs';
import { BOAT_STATS } from '@/utils/boatStats';

describe('aimOffsetRefs', () => {
  beforeEach(() => {
    resetAimOffset();
  });

  it('defaults to zero after reset', () => {
    const a = getAimOffset();
    expect(a.yaw).toBe(0);
    expect(a.pitch).toBe(0);
  });

  it('set within range is stored as-is', () => {
    setAimOffset(0.1, -0.05);
    const a = getAimOffset();
    expect(a.yaw).toBeCloseTo(0.1, 6);
    expect(a.pitch).toBeCloseTo(-0.05, 6);
  });

  it('clamps yaw to ±MAX_YAW_OFFSET', () => {
    setAimOffset(MAX_YAW_OFFSET + 1, 0);
    expect(getAimOffset().yaw).toBeCloseTo(MAX_YAW_OFFSET, 6);

    setAimOffset(-MAX_YAW_OFFSET - 1, 0);
    expect(getAimOffset().yaw).toBeCloseTo(-MAX_YAW_OFFSET, 6);
  });

  it('clamps pitch up to MAX_PITCH_OFFSET_UP', () => {
    setAimOffset(0, MAX_PITCH_OFFSET_UP + 1);
    expect(getAimOffset().pitch).toBeCloseTo(MAX_PITCH_OFFSET_UP, 6);
  });

  it('clamps pitch down to -MAX_PITCH_OFFSET_DOWN', () => {
    setAimOffset(0, -MAX_PITCH_OFFSET_DOWN - 1);
    expect(getAimOffset().pitch).toBeCloseTo(-MAX_PITCH_OFFSET_DOWN, 6);
  });

  it('asymmetric clamp: upward reach is wider than downward reach', () => {
    // Upward pitch allows more travel than downward to keep the cannon from
    // dipping into the water while still giving ample high-arc range.
    expect(MAX_PITCH_OFFSET_UP).toBeGreaterThan(MAX_PITCH_OFFSET_DOWN);
  });

  it('reset returns both axes to zero even after extreme values', () => {
    setAimOffset(999, 999);
    resetAimOffset();
    const a = getAimOffset();
    expect(a.yaw).toBe(0);
    expect(a.pitch).toBe(0);
  });

  it('getAimOffset returns the same singleton (read-only contract)', () => {
    const a = getAimOffset();
    setAimOffset(0.05, 0.05);
    const b = getAimOffset();
    // Same object reference — production-hot-path avoids allocations.
    expect(a).toBe(b);
    expect(b.yaw).toBeCloseTo(0.05, 6);
  });

  it('MAX_YAW_OFFSET is a sub-90° cone that stays inside the quadrant arc', () => {
    // The yaw offset cone must leave a safety margin on each side so a
    // fine-aim shot can never leak into the adjacent quadrant's 90° slice.
    // Concretely: 0 < MAX_YAW_OFFSET < π/4 (half-width of a quadrant).
    expect(MAX_YAW_OFFSET).toBeGreaterThan(0);
    expect(MAX_YAW_OFFSET).toBeLessThan(Math.PI / 4);
  });

  it('MAX_YAW_OFFSET is ≤12° (tight lateral window from tuning pass 2)', () => {
    expect(MAX_YAW_OFFSET).toBeLessThanOrEqual((12 * Math.PI) / 180 + 1e-9);
  });

  it('MAX_PITCH_OFFSET_UP stays within a physically reasonable cannon arc', () => {
    expect(MAX_PITCH_OFFSET_UP).toBeGreaterThan(0);
    expect(MAX_PITCH_OFFSET_UP).toBeLessThan(Math.PI / 4);
  });

  it('MAX_PITCH_OFFSET_DOWN stays within a physically reasonable cannon arc', () => {
    expect(MAX_PITCH_OFFSET_DOWN).toBeGreaterThan(0);
    expect(MAX_PITCH_OFFSET_DOWN).toBeLessThan(Math.PI / 4);
  });

  it('player minimum total elevation stays just above horizontal for close-range shots', () => {
    const minTotalElevation = BOAT_STATS.player.weapons.elevationAngle - MAX_PITCH_OFFSET_DOWN;
    expect(minTotalElevation).toBeGreaterThan(0);
    expect(minTotalElevation).toBeLessThan((2 * Math.PI) / 180);
  });
});
