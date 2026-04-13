import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAimOffset,
  setAimOffset,
  resetAimOffset,
  requestTestAimOffset,
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

  it('clamps yaw to +-MAX_YAW_OFFSET', () => {
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
    expect(MAX_PITCH_OFFSET_UP).toBeGreaterThan(MAX_PITCH_OFFSET_DOWN);
  });

  it('reset returns both axes to zero even after extreme values', () => {
    setAimOffset(999, 999);
    resetAimOffset();
    const a = getAimOffset();
    expect(a.yaw).toBe(0);
    expect(a.pitch).toBe(0);
  });

  it('getAimOffset returns the same live singleton when no test override is active', () => {
    const a = getAimOffset();
    setAimOffset(0.05, 0.05);
    const b = getAimOffset();
    expect(a).toBe(b);
    expect(b.yaw).toBeCloseTo(0.05, 6);
  });

  it('test aim override stays sticky until explicitly cleared', () => {
    const liveRef = getAimOffset();
    requestTestAimOffset({ yaw: 999, pitch: -999 });
    const forcedRef = getAimOffset();

    expect(forcedRef).not.toBe(liveRef);
    expect(forcedRef.yaw).toBeCloseTo(MAX_YAW_OFFSET, 6);
    expect(forcedRef.pitch).toBeCloseTo(-MAX_PITCH_OFFSET_DOWN, 6);

    setAimOffset(0.03, 0.02);
    expect(getAimOffset()).toBe(forcedRef);
    expect(getAimOffset().yaw).toBeCloseTo(MAX_YAW_OFFSET, 6);

    requestTestAimOffset(null);
    expect(getAimOffset()).toBe(liveRef);
    expect(getAimOffset().yaw).toBeCloseTo(0.03, 6);
    expect(getAimOffset().pitch).toBeCloseTo(0.02, 6);
  });

  it('MAX_YAW_OFFSET stays inside the quadrant arc', () => {
    expect(MAX_YAW_OFFSET).toBeGreaterThan(0);
    expect(MAX_YAW_OFFSET).toBeLessThan(Math.PI / 4);
  });

  it('MAX_YAW_OFFSET is <= 12 degrees', () => {
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

  it('player minimum total elevation dips only slightly below horizontal for close-range shots', () => {
    const minTotalElevation = BOAT_STATS.player.weapons.elevationAngle - MAX_PITCH_OFFSET_DOWN;
    expect(minTotalElevation).toBeLessThan(0);
    expect(minTotalElevation).toBeGreaterThan((-1 * Math.PI) / 180);
  });
});
