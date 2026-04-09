import { describe, it, expect } from 'vitest';
import { computeMovement } from '@/systems/MovementSystem';
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
