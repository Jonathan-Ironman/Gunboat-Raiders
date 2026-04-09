/**
 * Rock entity -- static rigid body with faceted icosahedron visual.
 *
 * Placed as a fixed obstacle in the arena. Does not move or bob with waves.
 */

import { RigidBody, CuboidCollider, interactionGroups } from '@react-three/rapier';
import { Icosahedron } from '@react-three/drei';
import { COLLISION_GROUPS } from '../utils/collisionGroups';
import type { RockConfig } from '../utils/rockPlacement';

/** Environment collides with Player, Enemy, PlayerProjectile, EnemyProjectile */
const ENVIRONMENT_COLLISION_GROUPS = interactionGroups(COLLISION_GROUPS.ENVIRONMENT, [
  COLLISION_GROUPS.PLAYER,
  COLLISION_GROUPS.ENEMY,
  COLLISION_GROUPS.PLAYER_PROJECTILE,
  COLLISION_GROUPS.ENEMY_PROJECTILE,
]);

interface RockProps {
  config: RockConfig;
}

export function Rock({ config }: RockProps) {
  const { position, scale, rotation } = config;

  // Collider half-extents: approximate the icosahedron at the given scale.
  // Icosahedron with args=[1] has radius 1, so half-extents ~ scale * 0.7
  const colliderHalfExtents: [number, number, number] = [
    scale[0] * 0.7,
    scale[1] * 0.7,
    scale[2] * 0.7,
  ];

  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <CuboidCollider args={colliderHalfExtents} collisionGroups={ENVIRONMENT_COLLISION_GROUPS} />
      <Icosahedron args={[1, 1]} scale={scale} rotation={rotation}>
        <meshStandardMaterial color="#3a3a3a" roughness={0.9} metalness={0.1} />
      </Icosahedron>
    </RigidBody>
  );
}
