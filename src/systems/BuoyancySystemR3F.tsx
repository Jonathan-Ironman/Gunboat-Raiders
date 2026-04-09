/**
 * R3F wrapper for BuoyancySystem — applies buoyancy forces each physics step.
 *
 * Uses useBeforePhysicsStep to call computeBuoyancy and apply the resulting
 * force and torque to all boat rigid bodies.
 */

import { useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBeforePhysicsStep } from '@react-three/rapier';
import { computeBuoyancy, HULL_SAMPLE_POINTS } from './BuoyancySystem';
import { getBuoyancyBodies } from './physicsRefs';
import { WaterCtx } from '../environment/waterTypes';
import {
  BUOYANCY_STRENGTH,
  BOAT_MASS,
  GRAVITY,
  BUOYANCY_VERTICAL_DAMPING,
  BUOYANCY_ANGULAR_DAMPING,
  BUOYANCY_MAX_SUBMERSION,
  BUOYANCY_TORQUE_SCALE,
} from '../utils/constants';

const BUOYANCY_CONFIG = {
  buoyancyStrength: BUOYANCY_STRENGTH,
  boatMass: BOAT_MASS,
  gravity: GRAVITY,
  verticalDamping: BUOYANCY_VERTICAL_DAMPING,
  angularDamping: BUOYANCY_ANGULAR_DAMPING,
  maxSubmersion: BUOYANCY_MAX_SUBMERSION,
  torqueScale: BUOYANCY_TORQUE_SCALE,
} as const;

/**
 * Component that applies buoyancy forces to all registered boat rigid bodies
 * before each physics step. Must be placed inside <Physics>.
 */
export function BuoyancySystemR3F() {
  const waterCtx = useContext(WaterCtx);
  const timeRef = useRef(0);

  // Track elapsed time via useFrame (runs on render loop)
  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  useBeforePhysicsStep(() => {
    if (!waterCtx) return;

    const time = timeRef.current;
    const bodies = getBuoyancyBodies();

    for (const [, body] of bodies) {
      const pos = body.translation();
      const rot = body.rotation();
      const linvel = body.linvel();
      const angvel = body.angvel();

      // Guard against corrupted physics state — NaN propagation would
      // permanently break the rigid body if applied as a force
      if (
        !isFinite(pos.x) ||
        !isFinite(pos.y) ||
        !isFinite(pos.z) ||
        !isFinite(linvel.x) ||
        !isFinite(linvel.y) ||
        !isFinite(linvel.z)
      ) {
        continue;
      }

      const result = computeBuoyancy(
        {
          bodyPosition: [pos.x, pos.y, pos.z],
          bodyRotation: [rot.x, rot.y, rot.z, rot.w],
          bodyLinearVelocity: [linvel.x, linvel.y, linvel.z],
          bodyAngularVelocity: [angvel.x, angvel.y, angvel.z],
          hullSamplePoints: HULL_SAMPLE_POINTS,
        },
        (x, z, t) => waterCtx.getWaveHeightAtTime(x, z, t),
        time,
        BUOYANCY_CONFIG,
      );

      // Safety: never apply NaN forces to the rigid body
      if (
        !isFinite(result.force[1]) ||
        !isFinite(result.torque[0]) ||
        !isFinite(result.torque[2])
      ) {
        continue;
      }

      body.resetForces(true);
      body.resetTorques(true);
      body.addForce({ x: result.force[0], y: result.force[1], z: result.force[2] }, true);
      body.addTorque({ x: result.torque[0], y: result.torque[1], z: result.torque[2] }, true);
    }
  });

  return null;
}
