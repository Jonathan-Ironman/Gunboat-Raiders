import { describe, it, expect } from 'vitest';
import {
  computeBuoyancy,
  HULL_SAMPLE_POINTS,
  PLAYER_HULL_SAMPLE_POINTS,
} from '@/systems/BuoyancySystem';
import type { BuoyancyConfig, BuoyancyInput } from '@/systems/BuoyancySystem';
import {
  BUOYANCY_STRENGTH,
  BOAT_MASS,
  GRAVITY,
  BUOYANCY_VERTICAL_DAMPING,
  BUOYANCY_ANGULAR_DAMPING,
  BUOYANCY_MAX_SUBMERSION,
  BUOYANCY_TORQUE_SCALE,
} from '@/utils/constants';

const DEFAULT_CONFIG: BuoyancyConfig = {
  buoyancyStrength: BUOYANCY_STRENGTH,
  boatMass: BOAT_MASS,
  gravity: GRAVITY,
  verticalDamping: BUOYANCY_VERTICAL_DAMPING,
  angularDamping: BUOYANCY_ANGULAR_DAMPING,
  maxSubmersion: BUOYANCY_MAX_SUBMERSION,
  torqueScale: BUOYANCY_TORQUE_SCALE,
};

/** Zero velocity vectors for stationary tests */
const ZERO_VEL: [number, number, number] = [0, 0, 0];

/** Identity quaternion — no rotation. */
const IDENTITY_QUAT: [number, number, number, number] = [0, 0, 0, 1];

/** Simple wave height function: flat water at y=0. */
function flatWater(
  _x: number,
  _z: number,
  _time: number,
): { height: number; normal: [number, number, number] } {
  return { height: 0, normal: [0, 1, 0] };
}

/** Wave height function: constant height at given value. */
function constantWater(h: number) {
  return (
    _x: number,
    _z: number,
    _time: number,
  ): { height: number; normal: [number, number, number] } => ({
    height: h,
    normal: [0, 1, 0],
  });
}

function risingWater(rate: number, baseHeight = 0) {
  return (
    _x: number,
    _z: number,
    time: number,
  ): { height: number; normal: [number, number, number] } => ({
    height: baseHeight + rate * time,
    normal: [0, 1, 0],
  });
}

function makeInput(
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number, number] = IDENTITY_QUAT,
  linearVelocity: [number, number, number] = ZERO_VEL,
  angularVelocity: [number, number, number] = ZERO_VEL,
): BuoyancyInput {
  return {
    bodyPosition: position,
    bodyRotation: rotation,
    bodyLinearVelocity: linearVelocity,
    bodyAngularVelocity: angularVelocity,
    hullSamplePoints: HULL_SAMPLE_POINTS,
  };
}

describe('BuoyancySystem — computeBuoyancy', () => {
  it('boat at wave height experiences near-zero net vertical force (equilibrium)', () => {
    // At equilibrium, buoyancy = gravity.
    // gravity = boatMass * g = 1000 * 9.81 = 9810
    // Each hull point at local y=-0.5, so world y = bodyY - 0.5
    // submersion per point = 0 - (bodyY - 0.5) = 0.5 - bodyY
    // total buoyancy = (0.5 - bodyY) * buoyancyStrength (when all submerged and below clamp)
    // At equilibrium: (0.5 - bodyY) * buoyancyStrength = boatMass * gravity
    // bodyY = 0.5 - (boatMass * gravity) / buoyancyStrength
    const equilibriumSubmersion =
      (DEFAULT_CONFIG.boatMass * DEFAULT_CONFIG.gravity) / DEFAULT_CONFIG.buoyancyStrength;
    const equilibriumY = 0.5 - equilibriumSubmersion;

    // Only test equilibrium if submersion is within the clamp range
    expect(equilibriumSubmersion).toBeLessThan(DEFAULT_CONFIG.maxSubmersion);

    const result = computeBuoyancy(makeInput([0, equilibriumY, 0]), flatWater, 0, DEFAULT_CONFIG);

    expect(result.force[1]).toBeCloseTo(0, 1);
  });

  it('boat above wave surface experiences net downward force (gravity > buoyancy)', () => {
    // Boat high above water — all sample points above surface
    const result = computeBuoyancy(makeInput([0, 10, 0]), flatWater, 0, DEFAULT_CONFIG);

    // Only gravity, no buoyancy
    expect(result.force[1]).toBeLessThan(0);
    expect(result.force[1]).toBeCloseTo(-DEFAULT_CONFIG.boatMass * DEFAULT_CONFIG.gravity, 1);
  });

  it('boat below wave surface experiences net upward force (buoyancy > gravity)', () => {
    // Boat deep below water — all sample points deeply submerged
    const result = computeBuoyancy(makeInput([0, -100, 0]), flatWater, 0, DEFAULT_CONFIG);

    // Buoyancy should vastly exceed gravity at this depth
    expect(result.force[1]).toBeGreaterThan(0);
  });

  it('tilted wave surface produces non-zero torque', () => {
    // Create a wave that slopes: higher on +x side, lower on -x side
    // This creates asymmetric submersion across port/starboard points
    const slopedWater = (
      x: number,
      _z: number,
      _time: number,
    ): { height: number; normal: [number, number, number] } => ({
      height: x * 0.5, // height increases with x
      normal: [0, 1, 0],
    });

    // Position boat so it's partially submerged and the slope matters
    const result = computeBuoyancy(makeInput([0, -1, 0]), slopedWater, 0, DEFAULT_CONFIG);

    // The starboard side (positive x) has more submersion than port (negative x)
    // This should produce a non-zero torque around the Z axis
    expect(result.torque[2]).not.toBeCloseTo(0, 2);
  });

  it('all 8 sample points below water produces clamped maximum buoyancy', () => {
    // Boat very deep, constant high water — submersion is clamped to maxSubmersion
    const result = computeBuoyancy(makeInput([0, -50, 0]), constantWater(0), 0, DEFAULT_CONFIG);

    // All 8 points are deeply submerged, but each is clamped to maxSubmersion
    const clampedBuoyancy = DEFAULT_CONFIG.maxSubmersion * DEFAULT_CONFIG.buoyancyStrength;
    const expectedNet = clampedBuoyancy - DEFAULT_CONFIG.boatMass * DEFAULT_CONFIG.gravity;

    expect(result.force[1]).toBeCloseTo(expectedNet, 1);
  });

  it('computeBuoyancy is deterministic (same inputs = same output)', () => {
    const input = makeInput([0, -1, 0]);

    const result1 = computeBuoyancy(input, flatWater, 1.5, DEFAULT_CONFIG);
    const result2 = computeBuoyancy(input, flatWater, 1.5, DEFAULT_CONFIG);

    expect(result1.force).toEqual(result2.force);
    expect(result1.torque).toEqual(result2.torque);
  });

  it('upward velocity reduces net upward force (velocity damping)', () => {
    // Stationary boat submerged — should have net upward force
    const stationaryResult = computeBuoyancy(
      makeInput([0, -1, 0], IDENTITY_QUAT, ZERO_VEL, ZERO_VEL),
      flatWater,
      0,
      DEFAULT_CONFIG,
    );

    // Same boat with upward velocity — damping should reduce upward force
    const movingUpResult = computeBuoyancy(
      makeInput([0, -1, 0], IDENTITY_QUAT, [0, 5, 0], ZERO_VEL),
      flatWater,
      0,
      DEFAULT_CONFIG,
    );

    expect(stationaryResult.force[1]).toBeGreaterThan(0);
    expect(movingUpResult.force[1]).toBeLessThan(stationaryResult.force[1]);
  });

  it('vertical damping tracks motion relative to a rising wave surface', () => {
    const flatStationary = computeBuoyancy(
      makeInput([0, -1, 0], IDENTITY_QUAT, ZERO_VEL, ZERO_VEL),
      flatWater,
      0,
      DEFAULT_CONFIG,
    );

    const riseRate = 2;
    const movingWithWave = computeBuoyancy(
      makeInput([0, -1, 0], IDENTITY_QUAT, [0, riseRate, 0], ZERO_VEL),
      risingWater(riseRate),
      0,
      DEFAULT_CONFIG,
    );

    const stationaryUnderRisingWave = computeBuoyancy(
      makeInput([0, -1, 0], IDENTITY_QUAT, ZERO_VEL, ZERO_VEL),
      risingWater(riseRate),
      0,
      DEFAULT_CONFIG,
    );

    expect(movingWithWave.force[1]).toBeCloseTo(flatStationary.force[1], 1);
    expect(stationaryUnderRisingWave.force[1]).toBeGreaterThan(flatStationary.force[1]);
  });

  it('submersion is clamped to maxSubmersion', () => {
    // Boat deep enough that every sample point exceeds the clamp.
    // At body Y = -(maxSubmersion + 0.5) sample points sit exactly at
    // -(maxSubmersion + 1.0), producing rawSubmersion > maxSubmersion.
    const justPastClampY = -(DEFAULT_CONFIG.maxSubmersion + 1.0);
    const moderateResult = computeBuoyancy(
      makeInput([0, justPastClampY, 0]),
      flatWater,
      0,
      DEFAULT_CONFIG,
    );

    // Boat at extreme depth — force should not grow indefinitely.
    const deepResult = computeBuoyancy(makeInput([0, -100, 0]), flatWater, 0, DEFAULT_CONFIG);

    // Both should produce the same buoyancy because submersion is clamped
    // to maxSubmersion in both cases.
    expect(deepResult.force[1]).toBeCloseTo(moderateResult.force[1], 1);
  });

  it('deeper player hull sample points float the same body higher on flat water', () => {
    const generic = computeBuoyancy(
      { ...makeInput([0, 0, 0]), hullSamplePoints: HULL_SAMPLE_POINTS },
      flatWater,
      0,
      DEFAULT_CONFIG,
    );
    const playerHull = computeBuoyancy(
      { ...makeInput([0, 0, 0]), hullSamplePoints: PLAYER_HULL_SAMPLE_POINTS },
      flatWater,
      0,
      DEFAULT_CONFIG,
    );

    expect(playerHull.force[1]).toBeGreaterThan(generic.force[1]);
  });
});
