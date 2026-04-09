/**
 * Pure movement computation — no R3F, no Rapier, fully headless-testable.
 *
 * Converts WASD input into thrust forces and turn torques in world space,
 * based on the boat's current heading (Y rotation).
 */

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boatHeading: number; // radians, current boat Y rotation
}

export interface MovementStats {
  thrustForce: number;
  reverseForce: number;
  turnTorque: number;
}

export interface MovementOutput {
  force: [number, number, number]; // world-space thrust force
  torque: [number, number, number]; // world-space turn torque
}

/**
 * Compute thrust force and turn torque from keyboard input.
 *
 * - Forward thrust is along the boat's local +Z axis (transformed by heading)
 * - Reverse thrust is along -Z (weaker magnitude)
 * - Left (A) = positive Y torque (turn port/left)
 * - Right (D) = negative Y torque (turn starboard/right)
 *
 * @param input - Current keyboard state and boat heading
 * @param stats - Boat movement parameters (thrust, reverse, turn strengths)
 * @returns Force and torque to apply to the rigid body
 */
export function computeMovement(input: MovementInput, stats: MovementStats): MovementOutput {
  const { forward, backward, left, right, boatHeading } = input;

  // Compute thrust magnitude along local Z axis
  let thrustMagnitude = 0;
  if (forward) {
    thrustMagnitude += stats.thrustForce;
  }
  if (backward) {
    thrustMagnitude -= stats.reverseForce;
  }

  // Transform thrust from local +Z to world space using heading
  // Local +Z in world space when heading = 0 is (0, 0, 1)
  // Rotated by heading around Y: (sin(heading), 0, cos(heading))
  const sinH = Math.sin(boatHeading);
  const cosH = Math.cos(boatHeading);

  const forceX = sinH * thrustMagnitude;
  const forceZ = cosH * thrustMagnitude;

  // Compute turn torque around Y axis
  let turnY = 0;
  if (left) {
    turnY += stats.turnTorque;
  }
  if (right) {
    turnY -= stats.turnTorque;
  }

  return {
    force: [forceX, 0, forceZ],
    torque: [0, turnY, 0],
  };
}
