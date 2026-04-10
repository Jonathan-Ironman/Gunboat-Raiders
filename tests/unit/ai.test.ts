import { describe, it, expect } from 'vitest';
import { computeAIDecision, steerToward } from '@/systems/AISystem';
import type { AIContext } from '@/systems/AISystem';

/** Helper to create a default AIContext with overrides. */
function makeContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    selfPosition: [0, 0, 0],
    selfHeading: 0,
    selfHealth: { armor: 30, hull: 40, hullMax: 40 },
    targetPosition: [20, 0, 0],
    distanceToTarget: 20,
    preferredRange: 15,
    detectionRange: 80,
    currentState: 'approaching',
    stateTimer: 0,
    weaponCooldownReady: true,
    ...overrides,
  };
}

describe('AISystem -- computeAIDecision', () => {
  it('SPAWNING state with timer > 0 stays in SPAWNING, no thrust/fire', () => {
    const ctx = makeContext({ currentState: 'spawning', stateTimer: 1.5 });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('spawning');
    expect(result.thrust).toBe(0);
    expect(result.turn).toBe(0);
    expect(result.fire).toBe(false);
    expect(result.newStateTimer).toBeCloseTo(1.5 - 0.016);
  });

  it('SPAWNING state with timer <= 0 transitions to APPROACHING', () => {
    const ctx = makeContext({ currentState: 'spawning', stateTimer: 0.01 });
    const result = computeAIDecision(ctx, 0.02);
    expect(result.newState).toBe('approaching');
  });

  it('APPROACHING moves toward target (thrust > 0)', () => {
    const ctx = makeContext({
      currentState: 'approaching',
      distanceToTarget: 50,
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('approaching');
    expect(result.thrust).toBeGreaterThan(0);
  });

  it('APPROACHING transitions to POSITIONING when within preferred range', () => {
    const ctx = makeContext({
      currentState: 'approaching',
      distanceToTarget: 10,
      preferredRange: 15,
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('positioning');
  });

  it('APPROACHING does NOT transition when beyond preferred range', () => {
    const ctx = makeContext({
      currentState: 'approaching',
      distanceToTarget: 30,
      preferredRange: 15,
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('approaching');
  });

  it('POSITIONING turns to present broadside (non-zero turn output)', () => {
    // Target is ahead (+Z direction) — not yet at broadside angle, so AI must turn
    const ctx = makeContext({
      currentState: 'positioning',
      selfHeading: 0,
      selfPosition: [0, 0, 0],
      targetPosition: [0, 0, 20], // target directly ahead, broadside angle ~90 degrees off
      distanceToTarget: 20,
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('positioning');
    expect(result.turn).not.toBe(0);
  });

  it('POSITIONING transitions to BROADSIDE when angle is within 30 degrees', () => {
    // Set up: target is exactly to the starboard (right)
    // Self heading = 0 (facing +Z), target at [20, 0, 0] (90 degrees to right)
    // Broadside angle for starboard: heading should be such that target is at +PI/2 relative
    // If heading=0, target at atan2(20,0)=PI/2, relative=PI/2 => ideal starboard broadside
    const ctx = makeContext({
      currentState: 'positioning',
      selfHeading: 0,
      selfPosition: [0, 0, 0],
      targetPosition: [20, 0, 0],
      distanceToTarget: 20,
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('broadside');
  });

  it('BROADSIDE sets fire=true with correct quadrant', () => {
    // Same setup as above: target to the right, should fire starboard
    const ctx = makeContext({
      currentState: 'positioning',
      selfHeading: 0,
      selfPosition: [0, 0, 0],
      targetPosition: [20, 0, 0],
      distanceToTarget: 20,
      weaponCooldownReady: true,
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('broadside');
    expect(result.fire).toBe(true);
    expect(result.fireQuadrant).toBe('starboard');
  });

  it('BROADSIDE transitions to APPROACHING after timer expires', () => {
    const ctx = makeContext({
      currentState: 'broadside',
      stateTimer: 0.01,
    });
    const result = computeAIDecision(ctx, 0.02);
    expect(result.newState).toBe('approaching');
  });

  it('SINKING returns zero thrust, zero turn, no fire', () => {
    const ctx = makeContext({
      currentState: 'sinking',
      selfHealth: { armor: 0, hull: 0, hullMax: 40 },
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('sinking');
    expect(result.thrust).toBe(0);
    expect(result.turn).toBe(0);
    expect(result.fire).toBe(false);
  });

  it('AI at detection range starts approaching (not ignoring)', () => {
    const ctx = makeContext({
      currentState: 'approaching',
      distanceToTarget: 80,
      detectionRange: 80,
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('approaching');
    expect(result.thrust).toBeGreaterThan(0);
  });

  it('APPROACHING pursues unconditionally even beyond detection range', () => {
    // Regression: enemies spawn at 80-120m; detection range used to gate the
    // approaching state and left them motionless at the spawn ring forever.
    // Once an enemy is in the approaching state, pursuit must be unconditional.
    const ctx = makeContext({
      currentState: 'approaching',
      distanceToTarget: 150,
      detectionRange: 80,
    });
    const result = computeAIDecision(ctx, 0.016);
    expect(result.newState).toBe('approaching');
    expect(result.thrust).toBeGreaterThan(0);
  });
});

describe('AISystem -- steerToward', () => {
  it('returns positive for target to the right', () => {
    // Heading 0 (north), target at PI/4 (northeast)
    const result = steerToward(0, Math.PI / 4);
    expect(result).toBe(1);
  });

  it('returns negative for target to the left', () => {
    // Heading 0 (north), target at -PI/4 (northwest)
    const result = steerToward(0, -Math.PI / 4);
    expect(result).toBe(-1);
  });

  it('handles wrapping around PI boundary', () => {
    // Heading just past PI, target just before -PI
    // Heading = 3.0, target = -3.0
    // The shortest path from 3.0 to -3.0 is to turn forward (positive)
    // diff = -3.0 - 3.0 = -6.0, normalize: -6.0 + 2*PI = 0.28... => positive
    const result = steerToward(3.0, -3.0);
    expect(result).toBe(1);
  });
});
