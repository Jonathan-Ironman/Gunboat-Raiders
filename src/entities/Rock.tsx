/**
 * Rock entity -- static rigid body with a Kenney pirate-kit rock GLB model.
 *
 * Three light-grey GLB variants (rocks-sand-a/b/c) are selected via the
 * `variant` field on RockConfig so the world has visual variety. The plain
 * `rocks-a/b/c` dark-grey variants were removed from the pool after the
 * 2026-04-11 playtest (see src/utils/rockPreload.ts for details).
 */

import { useGLTF } from '@react-three/drei';
import { RigidBody, CuboidCollider, interactionGroups } from '@react-three/rapier';
import { COLLISION_GROUPS } from '../utils/collisionGroups';
import type { RockConfig } from '../utils/rockPlacement';
import { ROCK_MODEL_PATHS } from '../utils/rockPreload';

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

function RockModel({ variant }: { variant: number }) {
  const index = variant % ROCK_MODEL_PATHS.length;
  // ROCK_MODEL_PATHS is a const tuple; modulo guarantees index is in range.
  // Cast to string to satisfy useGLTF's overloaded string signature.
  const path = ROCK_MODEL_PATHS[index] as string;
  const { scene } = useGLTF(path);
  return <primitive object={scene.clone(true)} />;
}

export function Rock({ config }: RockProps) {
  const { position, scale, rotation, variant } = config;

  // Collider half-extents approximate the rock cluster footprint.
  // The Kenney rock models fit roughly within a [1, 0.6, 1] unit box.
  const colliderHalfExtents: [number, number, number] = [
    scale[0] * 0.55,
    scale[1] * 0.45,
    scale[2] * 0.55,
  ];

  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <CuboidCollider args={colliderHalfExtents} collisionGroups={ENVIRONMENT_COLLISION_GROUPS} />
      <group scale={scale} rotation={rotation}>
        <RockModel variant={variant} />
      </group>
    </RigidBody>
  );
}
