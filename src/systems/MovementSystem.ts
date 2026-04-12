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

const MAX_SPEED_TAPER_START = 0.75;

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

/**
 * Project a world-space linear velocity onto the boat's local forward axis.
 * Positive values mean motion along local +Z; negative values mean reversing.
 */
export function getForwardSpeed(velocity: [number, number, number], boatHeading: number): number {
  const sinH = Math.sin(boatHeading);
  const cosH = Math.cos(boatHeading);
  return velocity[0] * sinH + velocity[2] * cosH;
}

/**
 * Clamp only the forward component of the body's velocity, preserving
 * lateral slip and vertical bobbing from buoyancy.
 */
export function clampForwardVelocity(
  velocity: [number, number, number],
  boatHeading: number,
  maxSpeed: number,
): [number, number, number] {
  if (!isFinite(maxSpeed) || maxSpeed <= 0) return velocity;

  const sinH = Math.sin(boatHeading);
  const cosH = Math.cos(boatHeading);
  const forwardSpeed = getForwardSpeed(velocity, boatHeading);

  if (forwardSpeed <= maxSpeed) {
    return velocity;
  }

  const lateralX = velocity[0] - sinH * forwardSpeed;
  const lateralZ = velocity[2] - cosH * forwardSpeed;

  return [lateralX + sinH * maxSpeed, velocity[1], lateralZ + cosH * maxSpeed];
}

/**
 * Ease forward thrust out as the boat approaches its configured top speed so
 * we do not keep hammering the hull into an overspeed state every frame.
 */
export function getForwardThrottleScale(forwardSpeed: number, maxSpeed: number): number {
  if (!isFinite(maxSpeed) || maxSpeed <= 0) return 1;
  if (forwardSpeed <= 0) return 1;

  const taperStart = maxSpeed * MAX_SPEED_TAPER_START;
  if (forwardSpeed <= taperStart) return 1;
  if (forwardSpeed >= maxSpeed) return 0;

  return (maxSpeed - forwardSpeed) / (maxSpeed - taperStart);
}

/**
 * Exponential horizontal damping for the coast phase. Preserves Y velocity so
 * buoyancy can keep driving the vertical motion independently.
 */
export function dampHorizontalVelocity(
  velocity: [number, number, number],
  damping: number,
  deltaSeconds: number,
): [number, number, number] {
  if (!isFinite(damping) || damping <= 0) return velocity;
  if (!isFinite(deltaSeconds) || deltaSeconds <= 0) return velocity;

  const decay = Math.exp(-damping * deltaSeconds);
  return [velocity[0] * decay, velocity[1], velocity[2] * decay];
}
