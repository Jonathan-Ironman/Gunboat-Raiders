/**
 * Pure AI logic — state machine transitions, steering, and decision-making.
 * No R3F, no browser APIs, fully headless-testable.
 */

import type { AIState, FiringQuadrant } from '@/store/gameStore';

// ---- Interfaces ----

export interface AIContext {
  selfPosition: [number, number, number];
  selfHeading: number; // radians
  selfHealth: { armor: number; hull: number; hullMax: number };
  targetPosition: [number, number, number];
  distanceToTarget: number;
  preferredRange: number;
  detectionRange: number;
  currentState: AIState;
  stateTimer: number;
  weaponCooldownReady: boolean;
}

export interface AIDecision {
  newState: AIState;
  newStateTimer: number;
  thrust: number; // -1 to 1 (reverse to full forward)
  turn: number; // -1 to 1 (port to starboard)
  fire: boolean;
  fireQuadrant: FiringQuadrant | null;
}

// ---- Constants ----

const BROADSIDE_HOLD_DURATION = 1.5; // seconds to hold after firing
const BROADSIDE_ANGLE_THRESHOLD = Math.PI / 6; // 30 degrees

// ---- Steering Helper ----

/**
 * Compute turn direction to steer from selfHeading toward targetAngle.
 * Returns -1 (turn left/port) or 1 (turn right/starboard).
 */
export function steerToward(selfHeading: number, targetAngle: number): number {
  let diff = targetAngle - selfHeading;
  // Normalize to -PI..PI
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.sign(diff) || 1; // default to 1 if exactly 0
}

// ---- Internal Helpers ----

/**
 * Compute the angle from self to target in the XZ plane.
 */
function angleToTarget(
  selfPos: [number, number, number],
  targetPos: [number, number, number],
): number {
  const dx = targetPos[0] - selfPos[0];
  const dz = targetPos[2] - selfPos[2];
  return Math.atan2(dx, dz); // atan2(x, z) for Y-up heading convention
}

/**
 * Determine which broadside faces the target and compute the angle difference.
 * Returns the quadrant and the signed angle difference from ideal broadside.
 */
function computeBroadsideInfo(
  selfHeading: number,
  selfPos: [number, number, number],
  targetPos: [number, number, number],
): { quadrant: FiringQuadrant; angleDiff: number } {
  const toTarget = angleToTarget(selfPos, targetPos);
  let relativeAngle = toTarget - selfHeading;

  // Normalize to -PI..PI
  while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
  while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;

  // Determine which side the target is on
  if (relativeAngle >= 0) {
    // Target is to the right (starboard)
    // Ideal broadside: target at +PI/2 relative
    const diff = Math.abs(relativeAngle - Math.PI / 2);
    return { quadrant: 'starboard', angleDiff: diff };
  } else {
    // Target is to the left (port)
    // Ideal broadside: target at -PI/2 relative
    const diff = Math.abs(relativeAngle + Math.PI / 2);
    return { quadrant: 'port', angleDiff: diff };
  }
}

// ---- Neutral Decision ----

function neutralDecision(state: AIState, timer: number): AIDecision {
  return {
    newState: state,
    newStateTimer: timer,
    thrust: 0,
    turn: 0,
    fire: false,
    fireQuadrant: null,
  };
}

// ---- Main Decision Function ----

/**
 * Compute the AI decision for a single frame given current context.
 * Pure function: same inputs always produce the same outputs.
 */
export function computeAIDecision(ctx: AIContext, delta: number): AIDecision {
  // SINKING: no decisions
  if (ctx.currentState === 'sinking' || ctx.selfHealth.hull <= 0) {
    return neutralDecision('sinking', 0);
  }

  switch (ctx.currentState) {
    case 'spawning': {
      // Spawning is a brief initial delay regardless of distance -- once it
      // elapses the enemy transitions to approaching and always pursues.
      const newTimer = ctx.stateTimer - delta;
      if (newTimer <= 0) {
        return neutralDecision('approaching', 0);
      }
      return neutralDecision('spawning', newTimer);
    }

    case 'approaching': {
      // Enemies in the approaching state ALWAYS pursue the player at full
      // thrust, regardless of detectionRange. A spawned enemy is, by
      // definition, already aware of the player; gating pursuit on distance
      // would leave enemies motionless at their spawn ring forever.
      //
      // Within preferred range: transition to positioning
      if (ctx.distanceToTarget <= ctx.preferredRange) {
        // Start positioning immediately
        const broadsideInfo = computeBroadsideInfo(
          ctx.selfHeading,
          ctx.selfPosition,
          ctx.targetPosition,
        );
        const targetAngle = angleToTarget(ctx.selfPosition, ctx.targetPosition);
        // Turn to present broadside
        const broadsideTargetAngle =
          broadsideInfo.quadrant === 'starboard'
            ? targetAngle - Math.PI / 2
            : targetAngle + Math.PI / 2;
        const turnDir = steerToward(ctx.selfHeading, broadsideTargetAngle);

        return {
          newState: 'positioning',
          newStateTimer: 0,
          thrust: 0.3,
          turn: turnDir,
          fire: false,
          fireQuadrant: null,
        };
      }

      // Move toward target
      const targetAngle = angleToTarget(ctx.selfPosition, ctx.targetPosition);
      const turnDir = steerToward(ctx.selfHeading, targetAngle);

      return {
        newState: 'approaching',
        newStateTimer: 0,
        thrust: 1,
        turn: turnDir,
        fire: false,
        fireQuadrant: null,
      };
    }

    case 'positioning': {
      const broadsideInfo = computeBroadsideInfo(
        ctx.selfHeading,
        ctx.selfPosition,
        ctx.targetPosition,
      );

      // Check if broadside angle is within threshold
      if (broadsideInfo.angleDiff <= BROADSIDE_ANGLE_THRESHOLD) {
        // Transition to broadside: fire!
        return {
          newState: 'broadside',
          newStateTimer: BROADSIDE_HOLD_DURATION,
          thrust: 0.2,
          turn: 0,
          fire: ctx.weaponCooldownReady,
          fireQuadrant: broadsideInfo.quadrant,
        };
      }

      // Keep turning to present broadside
      const targetAngle = angleToTarget(ctx.selfPosition, ctx.targetPosition);
      const broadsideTargetAngle =
        broadsideInfo.quadrant === 'starboard'
          ? targetAngle - Math.PI / 2
          : targetAngle + Math.PI / 2;
      const turnDir = steerToward(ctx.selfHeading, broadsideTargetAngle);

      return {
        newState: 'positioning',
        newStateTimer: 0,
        thrust: 0.3,
        turn: turnDir,
        fire: false,
        fireQuadrant: null,
      };
    }

    case 'broadside': {
      const newTimer = ctx.stateTimer - delta;
      if (newTimer <= 0) {
        // Go back to approaching
        return {
          newState: 'approaching',
          newStateTimer: 0,
          thrust: 1,
          turn: 0,
          fire: false,
          fireQuadrant: null,
        };
      }

      // Hold position, don't fire again (already fired on entry)
      return {
        newState: 'broadside',
        newStateTimer: newTimer,
        thrust: 0.2,
        turn: 0,
        fire: false,
        fireQuadrant: null,
      };
    }

    case 'fleeing': {
      // Not implemented for MVP — treat as approaching
      const targetAngle = angleToTarget(ctx.selfPosition, ctx.targetPosition);
      const awayAngle = targetAngle + Math.PI;
      const turnDir = steerToward(ctx.selfHeading, awayAngle);
      return {
        newState: 'fleeing',
        newStateTimer: 0,
        thrust: 1,
        turn: turnDir,
        fire: false,
        fireQuadrant: null,
      };
    }

    default:
      return neutralDecision('approaching', 0);
  }
}
