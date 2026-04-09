/**
 * R3F wrapper for MovementSystem — reads keyboard input and applies
 * thrust/turn forces to the player boat each render frame.
 *
 * NOTE: We intentionally use useFrame instead of useBeforePhysicsStep to avoid
 * Rapier WASM "recursive use of an object" errors that occur when reading
 * rigid body state inside the physics step callback.
 */

import { useKeyboardControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { computeMovement } from './MovementSystem';
import { getPlayerBody } from './physicsRefs';
import { useGameStore } from '../store/gameStore';
import { Euler, Quaternion } from 'three';

/** Keyboard control names matching the KeyboardControls map in App.tsx. */
type Controls = 'forward' | 'backward' | 'left' | 'right' | 'fire';

// Reusable Three.js objects to avoid per-frame allocations
const _quat = new Quaternion();
const _euler = new Euler();

/**
 * Component that reads keyboard state and applies movement forces
 * to the player boat. Runs at default useFrame priority (0), which is
 * after BuoyancySystemR3F (priority -10) so forces are additive.
 * Must be placed inside both <Physics> and <KeyboardControls>.
 */
export function MovementSystemR3F() {
  // Get the transient keyboard accessor (non-reactive polling)
  const [, getKeys] = useKeyboardControls<Controls>();

  useFrame(() => {
    const body = getPlayerBody();
    if (!body) return;

    try {
      // Guard against NaN state — skip if physics body state is corrupted
      const pos = body.translation();
      if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) return;

      const keys = getKeys();
      const { player } = useGameStore.getState();
      if (!player) return;

      // Extract Y heading from the rigid body's current rotation
      const rot = body.rotation();
      _quat.set(rot.x, rot.y, rot.z, rot.w);
      _euler.setFromQuaternion(_quat, 'YXZ');
      const boatHeading = _euler.y;

      const result = computeMovement(
        {
          forward: keys.forward,
          backward: keys.backward,
          left: keys.left,
          right: keys.right,
          boatHeading,
        },
        {
          thrustForce: player.movement.thrustForce,
          reverseForce: player.movement.reverseForce,
          turnTorque: player.movement.turnTorque,
        },
      );

      // Add movement forces on top of buoyancy forces (don't reset)
      body.addForce({ x: result.force[0], y: result.force[1], z: result.force[2] }, true);
      body.addTorque({ x: result.torque[0], y: result.torque[1], z: result.torque[2] }, true);
    } catch {
      // Rapier WASM may throw during body access if the body was removed.
      // Skip this frame silently.
    }
  });

  return null;
}
