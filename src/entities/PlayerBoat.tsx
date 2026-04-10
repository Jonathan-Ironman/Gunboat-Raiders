/**
 * Player boat entity — RigidBody with loaded 3D model and cannon mounts.
 *
 * Registers itself with the buoyancy/movement systems via their global registries
 * on mount. The player entity is pre-created in the store by startGame() before
 * this component renders.
 */

import { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody, CuboidCollider, interactionGroups } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { BOAT_STATS } from '../utils/boatStats';
import { COLLISION_GROUPS } from '../utils/collisionGroups';
import {
  registerBuoyancyBody,
  unregisterBuoyancyBody,
  setPlayerBody,
} from '../systems/physicsRefs';
import { BOAT_MASS } from '../utils/constants';
import type { Mesh } from 'three';

// Preload models for better loading performance
useGLTF.preload('/models/player-boat.glb');
useGLTF.preload('/models/cannon.glb');

const PLAYER_ID = 'player';

/** Y-axis rotation (radians) for each weapon mount quadrant so cannons face outward. */
const CANNON_ROTATION_BY_QUADRANT: Record<string, number> = {
  fore: 0, // faces +Z (forward)
  port: -Math.PI / 2, // faces -X (left)
  starboard: Math.PI / 2, // faces +X (right)
  aft: Math.PI, // faces -Z (backward)
};

/**
 * Player collider half-extents. Used to compute density so Rapier body mass
 * matches BOAT_MASS from constants (required for correct buoyancy forces).
 */
const PLAYER_HALF_EXTENTS: [number, number, number] = [1.2, 0.75, 2.5];
const PLAYER_COLLIDER_VOLUME =
  2 * PLAYER_HALF_EXTENTS[0] * 2 * PLAYER_HALF_EXTENTS[1] * 2 * PLAYER_HALF_EXTENTS[2];
const PLAYER_DENSITY = BOAT_MASS / PLAYER_COLLIDER_VOLUME;

/** Collision groups: player collides with enemy, enemy projectile, environment */
const PLAYER_COLLISION_GROUPS = interactionGroups(COLLISION_GROUPS.PLAYER, [
  COLLISION_GROUPS.ENEMY,
  COLLISION_GROUPS.ENEMY_PROJECTILE,
  COLLISION_GROUPS.ENVIRONMENT,
]);

export function PlayerBoat() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const boatGltf = useGLTF('/models/player-boat.glb');
  const cannonGltf = useGLTF('/models/cannon.glb');

  // Register with physics systems on mount; clean up on unmount.
  // The player entity is created in the store by startGame() before GameEntities
  // renders, so we do not call spawnPlayer() here.
  useEffect(() => {
    return () => {
      unregisterBuoyancyBody(PLAYER_ID);
      setPlayerBody(null);
    };
  }, []);

  // Register rigid body once it's available (after first render with ref set)
  const onRigidBodyReady = (body: RapierRigidBody) => {
    // RigidBody ref callback isn't available, so we use a ref + effect approach
    registerBuoyancyBody(PLAYER_ID, body);
    setPlayerBody(body);
  };

  // Use effect to register the rigid body after mount
  useEffect(() => {
    if (rigidBodyRef.current) {
      onRigidBodyReady(rigidBodyRef.current);
    }
  });

  // Debug: log model bounding box on mount
  useEffect(() => {
    if (import.meta.env.DEV) {
      const scene = boatGltf.scene;
      scene.traverse((obj) => {
        if ('isMesh' in obj && obj.isMesh === true) {
          const mesh = obj as Mesh;
          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          if (bb) {
            console.log(
              '[PlayerBoat] Mesh bbox:',
              JSON.stringify({
                name: mesh.name,
                min: [bb.min.x, bb.min.y, bb.min.z],
                max: [bb.max.x, bb.max.y, bb.max.z],
              }),
            );
          }
        }
      });
    }
  }, [boatGltf]);

  // Get weapon mounts from player stats for cannon placement
  const weaponMounts = BOAT_STATS.player.weapons.mounts;

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      gravityScale={0}
      // Low linear damping so the powerboat accelerates crisply and coasts
      // when the throttle is released (water drag on an actual planing hull
      // at speed is low). Combined with thrustForce=8000 this gives a
      // terminal speed of ~53 m/s in open water, but wave resistance and
      // planing pitch bleed off energy well before that.
      linearDamping={0.15}
      // Low angular damping so the boat can freely pitch and roll with the
      // Gerstner wave surface. Buoyancy torque supplies its own velocity
      // damping; this value just tames the residual yaw spin from turns.
      angularDamping={0.8}
      position={[0, 1.0, 0]}
      colliders={false}
    >
      <CuboidCollider
        args={PLAYER_HALF_EXTENTS}
        collisionGroups={PLAYER_COLLISION_GROUPS}
        density={PLAYER_DENSITY}
      />

      {/* Player boat model */}
      <primitive object={boatGltf.scene.clone()} scale={[1, 1, 1]} rotation={[0, 0, 0]} />

      {/* Cannon models at each weapon mount position, rotated to face outward */}
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
