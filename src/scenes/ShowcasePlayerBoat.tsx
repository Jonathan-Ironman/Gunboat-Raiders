/**
 * ShowcasePlayerBoat — a non-interactive player boat used as the
 * main-menu backdrop.
 *
 * Design choices:
 *
 * - Dynamic rigid body registered with `BuoyancySystem` so the boat
 *   visibly bobs on the Gerstner wave surface (the whole point of
 *   the showcase).
 *
 * - XZ motion is driven each frame from the active `ShowcaseBoatConfig`
 *   via `setLinvel`, preserving the body's current Y velocity so
 *   buoyancy is free to bob it vertically. For the `stationary`
 *   preset we clamp XZ velocity to zero; for `straight` we push it
 *   forward along +Z; for `circle` we track a circular path around
 *   the preset's start position.
 *
 * - Yaw (heading) is driven the same way via `setAngvel` on Y, with
 *   pitch/roll left to buoyancy torque. This keeps the boat facing
 *   along its direction of travel without fighting the wave surface.
 *
 * - Ignores all keyboard / mouse input — input is handled only by
 *   `MovementSystemR3F`, which short-circuits when `store.player` is
 *   `null` (the case during `mainMenu`).
 *
 * - Does **not** call `setPlayerBody(...)`. The real gameplay camera
 *   follows the gameplay player body; the showcase camera follows
 *   this body via a scenes-local ref (`showcaseRefs.ts`).
 */

import { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, interactionGroups } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Euler } from 'three';
import { BOAT_STATS } from '@/utils/boatStats';
import { COLLISION_GROUPS } from '@/utils/collisionGroups';
import { BOAT_MASS } from '@/utils/constants';
import { registerBuoyancyBody, unregisterBuoyancyBody } from '@/systems/physicsRefs';
import type { Mesh } from 'three';
import type { ShowcaseBoatConfig } from './showcasePresets';
import { computeShowcaseBoatTarget, shortestAngleDelta } from './showcaseBoatPath';
import { setShowcaseBoatBody } from './showcaseRefs';

// Preload models so the main menu lights up without a pop.
useGLTF.preload('/models/player-boat.glb');
useGLTF.preload('/models/cannon.glb');

const SHOWCASE_ID = 'showcase-player';

/** Y-axis cannon rotation by quadrant — copied from PlayerBoat for visual parity. */
const CANNON_ROTATION_BY_QUADRANT: Record<string, number> = {
  fore: 0,
  port: -Math.PI / 2,
  starboard: Math.PI / 2,
  aft: Math.PI,
};

/**
 * Use the same collider size / density as the gameplay player boat so the
 * buoyancy numerics match — otherwise the showcase boat would either sink
 * or float absurdly high on the same wave surface.
 */
const BOAT_HALF_EXTENTS: [number, number, number] = [1.2, 0.75, 2.5];
const BOAT_COLLIDER_VOLUME =
  2 * BOAT_HALF_EXTENTS[0] * 2 * BOAT_HALF_EXTENTS[1] * 2 * BOAT_HALF_EXTENTS[2];
const BOAT_DENSITY = BOAT_MASS / BOAT_COLLIDER_VOLUME;

/**
 * The showcase boat never hits anything meaningful, but we still give it
 * a sensible collision group (`PLAYER`) and an empty filter so it
 * collides with nothing — guaranteeing no physics interactions with any
 * environment props that might slip into the showcase scene later.
 */
const SHOWCASE_COLLISION_GROUPS = interactionGroups(COLLISION_GROUPS.PLAYER, []);

/** How fast the boat tracks its desired yaw per second (rad/s). */
const YAW_TRACKING_RATE = 1.0;

interface ShowcasePlayerBoatProps {
  readonly config: ShowcaseBoatConfig;
}

export function ShowcasePlayerBoat({ config }: ShowcasePlayerBoatProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const elapsedRef = useRef(0);
  const quatRef = useRef(new Quaternion());
  const eulerRef = useRef(new Euler());

  const boatGltf = useGLTF('/models/player-boat.glb');
  const cannonGltf = useGLTF('/models/cannon.glb');

  // Register with buoyancy + showcase ref on mount; clean up on unmount.
  useEffect(() => {
    return () => {
      unregisterBuoyancyBody(SHOWCASE_ID);
      setShowcaseBoatBody(null);
    };
  }, []);

  // Effect-after-render: once the ref is populated, publish it.
  useEffect(() => {
    const body = rigidBodyRef.current;
    if (body !== null) {
      registerBuoyancyBody(SHOWCASE_ID, body);
      setShowcaseBoatBody(body);
    }
  });

  // Mesh bounding-box debug logging — parity with the gameplay PlayerBoat.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const scene = boatGltf.scene;
    scene.traverse((obj) => {
      if ('isMesh' in obj && obj.isMesh === true) {
        const mesh = obj as Mesh;
        mesh.geometry.computeBoundingBox();
      }
    });
  }, [boatGltf]);

  useFrame((_state, delta) => {
    const body = rigidBodyRef.current;
    if (body === null) return;

    elapsedRef.current += delta;
    const t = elapsedRef.current;

    const { vx, vz, heading } = computeShowcaseBoatTarget(config, t);

    try {
      const linvel = body.linvel();
      // Preserve Y velocity so buoyancy is free to bob the boat.
      body.setLinvel({ x: vx, y: linvel.y, z: vz }, true);

      // Yaw toward the desired heading. Read current yaw from rotation,
      // compute the shortest-angle delta, feed it as an angular velocity
      // on the Y axis so buoyancy torque can still dominate pitch/roll.
      const rot = body.rotation();
      quatRef.current.set(rot.x, rot.y, rot.z, rot.w);
      eulerRef.current.setFromQuaternion(quatRef.current, 'YXZ');
      const currentYaw = eulerRef.current.y;
      const yawDelta = shortestAngleDelta(currentYaw, heading);
      const angvel = body.angvel();
      body.setAngvel({ x: angvel.x, y: yawDelta * YAW_TRACKING_RATE, z: angvel.z }, true);
    } catch {
      // Rapier WASM may throw during body mutation under rare races.
      // Skip the frame — the next one will correct it.
    }
  });

  const weaponMounts = BOAT_STATS.player.weapons.mounts;
  const startPos: [number, number, number] = [
    config.startPos[0],
    Math.max(config.startPos[1], 1.0),
    config.startPos[2],
  ];

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      gravityScale={0}
      linearDamping={0.15}
      angularDamping={0.8}
      position={startPos}
      colliders={false}
    >
      <CuboidCollider
        args={BOAT_HALF_EXTENTS}
        collisionGroups={SHOWCASE_COLLISION_GROUPS}
        density={BOAT_DENSITY}
      />

      <primitive object={boatGltf.scene.clone()} scale={[1, 1, 1]} rotation={[0, 0, 0]} />

      {weaponMounts.map((mount, index) => (
        <primitive
          key={index}
          object={cannonGltf.scene.clone()}
          position={mount.localOffset}
          rotation={[0, CANNON_ROTATION_BY_QUADRANT[mount.quadrant] ?? 0, 0]}
          scale={[0.5, 0.5, 0.5]}
        />
      ))}
    </RigidBody>
  );
}
