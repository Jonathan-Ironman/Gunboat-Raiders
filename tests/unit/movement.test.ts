import { describe, it, expect } from 'vitest';
import {
  clampForwardVelocity,
  dampHorizontalVelocity,
  computeMovement,
  getForwardSpeed,
  getForwardThrottleScale,
} from '@/systems/MovementSystem';
import type { MovementInput, MovementStats } from '@/systems/MovementSystem';

const DEFAULT_STATS: MovementStats = {
  thrustForce: 800,
  reverseForce: 300,
  turnTorque: 200,
};

const NO_INPUT: MovementInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  boatHeading: 0,
};

describe('MovementSystem — computeMovement', () => {
  it('forward=true produces positive force along boat heading direction', () => {
    const result = computeMovement({ ...NO_INPUT, forward: true }, DEFAULT_STATS);

    // Heading=0 means local +Z = world +Z, so force should be along +Z
    expect(result.force[0]).toBeCloseTo(0, 5);
    expect(result.force[1]).toBeCloseTo(0, 5);
    expect(result.force[2]).toBeCloseTo(DEFAULT_STATS.thrustForce, 5);
  });

  it('backward=true produces negative force along boat heading (weaker magnitude)', () => {
    const result = computeMovement({ ...NO_INPUT, backward: true }, DEFAULT_STATS);

    // Heading=0 means reverse is along -Z
    expect(result.force[0]).toBeCloseTo(0, 5);
    expect(result.force[1]).toBeCloseTo(0, 5);
    expect(result.force[2]).toBeCloseTo(-DEFAULT_STATS.reverseForce, 5);

    // Reverse should be weaker than forward
    expect(Math.abs(result.force[2])).toBeLessThan(DEFAULT_STATS.thrustForce);
  });

  it('left=true produces positive Y torque', () => {
    const result = computeMovement({ ...NO_INPUT, left: true }, DEFAULT_STATS);

    expect(result.torque[0]).toBeCloseTo(0, 5);
    expect(result.torque[1]).toBeCloseTo(DEFAULT_STATS.turnTorque, 5);
    expect(result.torque[2]).toBeCloseTo(0, 5);
  });

  it('right=true produces negative Y torque', () => {
    const result = computeMovement({ ...NO_INPUT, right: true }, DEFAULT_STATS);

    expect(result.torque[0]).toBeCloseTo(0, 5);
    expect(result.torque[1]).toBeCloseTo(-DEFAULT_STATS.turnTorque, 5);
    expect(result.torque[2]).toBeCloseTo(0, 5);
  });

  it('no input produces zero force and zero torque', () => {
    const result = computeMovement(NO_INPUT, DEFAULT_STATS);

    expect(result.force).toEqual([0, 0, 0]);
    expect(result.torque).toEqual([0, 0, 0]);
  });

  it('heading=PI/2 rotates thrust direction by 90 degrees', () => {
    const result = computeMovement(
      { ...NO_INPUT, forward: true, boatHeading: Math.PI / 2 },
      DEFAULT_STATS,
    );

    // Heading PI/2: local +Z becomes world +X
    // sin(PI/2) = 1, cos(PI/2) = 0
    // force = (sin(h) * thrust, 0, cos(h) * thrust) = (thrust, 0, 0)
    expect(result.force[0]).toBeCloseTo(DEFAULT_STATS.thrustForce, 3);
    expect(result.force[1]).toBeCloseTo(0, 5);
    expect(result.force[2]).toBeCloseTo(0, 3);
  });
});

describe('MovementSystem — forward speed limiting helpers', () => {
  it('projects world velocity onto the boat forward axis', () => {
    expect(getForwardSpeed([0, 0, 12], 0)).toBeCloseTo(12, 5);
    expect(getForwardSpeed([12, 0, 0], Math.PI / 2)).toBeCloseTo(12, 5);
  });

  it('clamps only the forward component, preserving lateral and vertical velocity', () => {
    const clamped = clampForwardVelocity([30, 4, 5], Math.PI / 2, 20);

    expect(getForwardSpeed(clamped, Math.PI / 2)).toBeCloseTo(20, 5);
    expect(clamped[1]).toBeCloseTo(4, 5);
    expect(clamped[2]).toBeCloseTo(5, 5);
  });

  it('leaves velocity untouched when already under max speed', () => {
    const velocity: [number, number, number] = [10, -2, 3];
    expect(clampForwardVelocity(velocity, Math.PI / 2, 20)).toEqual(velocity);
  });

  it('keeps full throttle until near the configured top speed', () => {
    expect(getForwardThrottleScale(20, 28)).toBeCloseTo(1, 5);
  });

  it('fades throttle to zero at or above the configured top speed', () => {
    expect(getForwardThrottleScale(28, 28)).toBe(0);
    expect(getForwardThrottleScale(35, 28)).toBe(0);
    expect(getForwardThrottleScale(26, 28)).toBeGreaterThan(0);
    expect(getForwardThrottleScale(26, 28)).toBeLessThan(1);
  });

  it('damps horizontal velocity without affecting vertical bobbing', () => {
    const damped = dampHorizontalVelocity([10, 3, -5], 0.4, 1);
    const decay = Math.exp(-0.4);

    expect(damped[0]).toBeCloseTo(10 * decay, 6);
    expect(damped[1]).toBeCloseTo(3, 6);
    expect(damped[2]).toBeCloseTo(-5 * decay, 6);
  });
});
