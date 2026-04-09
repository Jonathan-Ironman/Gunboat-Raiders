/**
 * Pure buoyancy computation — no R3F, no Rapier, fully headless-testable.
 *
 * Computes buoyancy forces and torques for a rigid body floating on Gerstner waves.
 * The rigid body uses gravityScale=0; this system applies gravity manually so that
 * buoyancy is the ONLY vertical force system.
 */

export interface BuoyancyInput {
  bodyPosition: [number, number, number];
  bodyRotation: [number, number, number, number]; // quaternion [x, y, z, w]
  bodyLinearVelocity: [number, number, number];
  bodyAngularVelocity: [number, number, number];
  hullSamplePoints: readonly [number, number, number][]; // local space
}

export interface BuoyancyConfig {
  buoyancyStrength: number;
  boatMass: number;
  gravity: number;
  /** Velocity-proportional damping factor to prevent oscillation (0.3-0.8 typical) */
  verticalDamping: number;
  /** Angular damping multiplier for torque damping */
  angularDamping: number;
  /** Maximum submersion depth (meters) to clamp force spikes */
  maxSubmersion: number;
  /** Scale factor for self-righting torque (0-1, reduces torque from buoyancy) */
  torqueScale: number;
}

export interface BuoyancyOutput {
  force: [number, number, number];
  torque: [number, number, number];
}

/** The 8 hull sample points for a standard boat. */
export const HULL_SAMPLE_POINTS: readonly [number, number, number][] = [
  [0, -0.5, 2.5], // Bow
  [0, -0.5, -2.5], // Stern
  [-1.2, -0.5, 0], // Port
  [1.2, -0.5, 0], // Starboard
  [-0.8, -0.5, 1.5], // PortBow
  [0.8, -0.5, 1.5], // StbdBow
  [-0.8, -0.5, -1.5], // PortStern
  [0.8, -0.5, -1.5], // StbdStern
];

/**
 * Rotate a local-space point by a quaternion [x, y, z, w].
 * Returns the rotated vector (does NOT add position — that's done separately).
 */
function rotateByQuaternion(
  point: [number, number, number],
  q: [number, number, number, number],
): [number, number, number] {
  const [px, py, pz] = point;
  const [qx, qy, qz, qw] = q;

  // t = 2 * cross(q.xyz, p)
  const tx = 2 * (qy * pz - qz * py);
  const ty = 2 * (qz * px - qx * pz);
  const tz = 2 * (qx * py - qy * px);

  // result = p + qw * t + cross(q.xyz, t)
  return [
    px + qw * tx + (qy * tz - qz * ty),
    py + qw * ty + (qz * tx - qx * tz),
    pz + qw * tz + (qx * ty - qy * tx),
  ];
}

/**
 * Compute buoyancy forces and torques for a boat on Gerstner waves.
 *
 * @param input - Body position, rotation, and hull sample points
 * @param getWaveHeight - Wave height sampler (x, z, time) => { height, normal }
 * @param time - Current simulation time in seconds
 * @param config - Buoyancy tuning parameters
 * @returns Force and torque to apply to the rigid body
 */
export function computeBuoyancy(
  input: BuoyancyInput,
  getWaveHeight: (
    x: number,
    z: number,
    time: number,
  ) => { height: number; normal: [number, number, number] },
  time: number,
  config: BuoyancyConfig,
): BuoyancyOutput {
  const { bodyPosition, bodyRotation, bodyLinearVelocity, bodyAngularVelocity, hullSamplePoints } =
    input;
  const {
    buoyancyStrength,
    boatMass,
    gravity,
    verticalDamping,
    angularDamping,
    maxSubmersion,
    torqueScale,
  } = config;
  const numPoints = hullSamplePoints.length;

  // Accumulate total force and torque
  const forceX = 0;
  let forceY = 0;
  const forceZ = 0;
  let torqueX = 0;
  const torqueY = 0;
  let torqueZ = 0;

  // Apply gravity: constant downward force
  forceY -= boatMass * gravity;

  // Per-point buoyancy
  const forcePerPoint = buoyancyStrength / numPoints;

  for (const localPoint of hullSamplePoints) {
    // Transform local point to world space
    const rotated = rotateByQuaternion(localPoint, bodyRotation);
    const worldX = bodyPosition[0] + rotated[0];
    const worldY = bodyPosition[1] + rotated[1];
    const worldZ = bodyPosition[2] + rotated[2];

    // Sample wave height at this world XZ
    const wave = getWaveHeight(worldX, worldZ, time);

    // Submersion depth: how far the point is below the wave surface
    // Clamp to maxSubmersion to prevent explosive forces from deep wave troughs
    const rawSubmersion = wave.height - worldY;
    const submersion = Math.min(Math.max(rawSubmersion, 0), maxSubmersion);

    if (submersion > 0) {
      // Upward buoyancy force proportional to submersion
      const pointForce = submersion * forcePerPoint;
      forceY += pointForce;

      // Torque = r x F (standard physics: position offset cross force)
      // offset is the rotated local point (world-relative to body center)
      // force is purely upward (0, pointForce, 0)
      torqueX += -rotated[2] * pointForce;
      torqueZ += rotated[0] * pointForce;
    }
  }

  // Scale torque to prevent excessive self-righting forces from long lever arms.
  // Without this, the 5m bow-to-stern lever arm creates torques that flip the boat.
  torqueX *= torqueScale;
  torqueZ *= torqueScale;

  // Velocity-proportional damping to prevent oscillation.
  // This acts like water resistance: the faster the boat moves vertically,
  // the more the water resists it. Critical for stable floating.
  forceY -= bodyLinearVelocity[1] * verticalDamping * boatMass;

  // Angular velocity damping for rotational stability (water resists rolling/pitching)
  torqueX -= bodyAngularVelocity[0] * angularDamping * boatMass;
  torqueZ -= bodyAngularVelocity[2] * angularDamping * boatMass;

  return {
    force: [forceX, forceY, forceZ],
    torque: [torqueX, torqueY, torqueZ],
  };
}
