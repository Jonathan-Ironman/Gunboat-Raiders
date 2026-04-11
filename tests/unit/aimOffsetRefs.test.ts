import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAimOffset,
  setAimOffset,
  resetAimOffset,
  MAX_YAW_OFFSET,
  MAX_PITCH_OFFSET,
} from '@/systems/aimOffsetRefs';

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

  it('clamps pitch to ±MAX_PITCH_OFFSET', () => {
    setAimOffset(0, MAX_PITCH_OFFSET + 1);
    expect(getAimOffset().pitch).toBeCloseTo(MAX_PITCH_OFFSET, 6);

    setAimOffset(0, -MAX_PITCH_OFFSET - 1);
    expect(getAimOffset().pitch).toBeCloseTo(-MAX_PITCH_OFFSET, 6);
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

  it('MAX_PITCH_OFFSET stays within a physically reasonable cannon arc', () => {
    // The pitch offset must stay well below 45° so combining it with the
    // base elevation (~3.4°) never puts the shot on a near-vertical
    // trajectory — and must be positive so there's any aim-high range at all.
    expect(MAX_PITCH_OFFSET).toBeGreaterThan(0);
    expect(MAX_PITCH_OFFSET).toBeLessThan(Math.PI / 4);
  });
});
