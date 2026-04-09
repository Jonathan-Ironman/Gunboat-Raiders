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

  // Get weapon mounts from player stats for cannon placement
  const weaponMounts = BOAT_STATS.player.weapons.mounts;

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      gravityScale={0}
      linearDamping={0.8}
      angularDamping={3.0}
      position={[0, 5.0, 0]}
      colliders={false}
    >
      <CuboidCollider args={[1.2, 0.75, 2.5]} collisionGroups={PLAYER_COLLISION_GROUPS} />

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
