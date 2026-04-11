/**
 * R3F wrapper for MovementSystem — reads keyboard input and applies
 * thrust/turn forces to the player boat each render frame.
 *
 * POWERBOAT FEEL
 * --------------
 * Forward thrust is applied at a point BELOW and FORWARD of the centre of
 * mass via `addForceAtPoint`. The lever arm between the application point
 * and the centre of mass naturally generates a nose-up pitching torque as
 * the boat accelerates — the same mechanism that causes real planing hulls
 * to lift their bow out of the water when throttled.
 *
 * Reverse thrust and yaw torque are applied at the centre of mass with the
 * standard `addForce` / `addTorque` calls; reverse has no planing effect.
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
import { Euler, Quaternion, Vector3 } from 'three';

/** Keyboard control names matching the KeyboardControls map in App.tsx. */
type Controls = 'forward' | 'backward' | 'left' | 'right' | 'fire';

/**
 * Local-space offset (relative to the boat's centre of mass) at which the
 * forward thrust force is applied. A negative Y puts the application point
 * below the CoM and a positive Z puts it ahead of the CoM. The resulting
 * lever arm creates a nose-up pitching torque of (|offset.y| * thrust) N·m
 * while the player throttles — this is the "planing" effect that makes the
 * boat feel like a powerboat instead of a cargo ship.
 *
 * Tuned so that at maximum thrust (8000 N) the planing torque is ~4000 N·m,
 * strong enough to lift the bow visibly but comfortably below the buoyancy
 * self-righting torque at ~10° pitch so the boat finds a stable planing
 * angle instead of flipping over backwards.
 */
const THRUST_APPLICATION_OFFSET = new Vector3(0, -0.5, 1.2);

// Reusable Three.js objects to avoid per-frame allocations
const _quat = new Quaternion();
const _euler = new Euler();
const _worldOffset = new Vector3();

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
    // R4: skip input→force translation while paused. Otherwise a held WASD
    // key would queue forces all through the pause, and they'd snap the
    // boat forward the moment we resume.
    if (useGameStore.getState().phase === 'paused') return;

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

      // Split the combined thrust into forward and reverse components so we
      // can apply them at different points. computeMovement returned a
      // signed world-space force along the heading; its sign encodes whether
      // the dominant input was forward or reverse.
      const sinH = Math.sin(boatHeading);
      const cosH = Math.cos(boatHeading);

      // The scalar thrust magnitude along the boat's local +Z axis. Positive
      // when moving forward, negative when reversing. Recovered from the
      // world-space force by projecting onto the heading unit vector.
      const localThrust = result.force[0] * sinH + result.force[2] * cosH;

      if (localThrust > 0) {
        // Forward throttle: apply the world-space thrust at an offset below
        // and ahead of the CoM so Rapier generates the nose-up planing
        // torque automatically. The offset must be rotated into world
        // space because addForceAtPoint takes world coordinates.
        _worldOffset.copy(THRUST_APPLICATION_OFFSET).applyQuaternion(_quat);
        body.addForceAtPoint(
          { x: result.force[0], y: result.force[1], z: result.force[2] },
          {
            x: pos.x + _worldOffset.x,
            y: pos.y + _worldOffset.y,
            z: pos.z + _worldOffset.z,
          },
          true,
        );
      } else if (localThrust < 0) {
        // Reverse: apply at centre of mass — no planing effect when backing
        // up. Real powerboats squat at the stern in reverse anyway.
        body.addForce({ x: result.force[0], y: result.force[1], z: result.force[2] }, true);
      }

      body.addTorque({ x: result.torque[0], y: result.torque[1], z: result.torque[2] }, true);
    } catch {
      // Rapier WASM may throw during body access if the body was removed.
      // Skip this frame silently.
    }
  });

  return null;
}
