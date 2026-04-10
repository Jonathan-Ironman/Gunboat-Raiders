/**
 * Enemy boat entity -- RigidBody with loaded 3D model and cannon mounts.
 *
 * Registers itself in the Zustand store on mount and with the buoyancy/enemy
 * body registries. Handles sinking animation and cleanup.
 */

import { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, interactionGroups } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import type { EnemyType } from '../store/gameStore';
import { BOAT_STATS } from '../utils/boatStats';
import { EnemyHealthBar } from '../ui/EnemyHealthBar';
import { COLLISION_GROUPS } from '../utils/collisionGroups';
import {
  registerBuoyancyBody,
  unregisterBuoyancyBody,
  registerEnemyBody,
  unregisterEnemyBody,
} from '../systems/physicsRefs';
import { BOAT_MASS } from '../utils/constants';

// Preload models
useGLTF.preload('/models/enemy-skiff.glb');
useGLTF.preload('/models/cannon.glb');

/** Y-axis rotation for each weapon mount quadrant so cannons face outward. */
const CANNON_ROTATION_BY_QUADRANT: Record<string, number> = {
  fore: 0,
  port: -Math.PI / 2,
  starboard: Math.PI / 2,
  aft: Math.PI,
};

/**
 * Enemy collider half-extents. Used to compute density so Rapier body mass
 * matches BOAT_MASS from constants (required for correct buoyancy forces).
 */
const ENEMY_HALF_EXTENTS: [number, number, number] = [0.8, 0.5, 1.8];
const ENEMY_COLLIDER_VOLUME =
  2 * ENEMY_HALF_EXTENTS[0] * 2 * ENEMY_HALF_EXTENTS[1] * 2 * ENEMY_HALF_EXTENTS[2];
const ENEMY_DENSITY = BOAT_MASS / ENEMY_COLLIDER_VOLUME;

/** Collision groups: enemy collides with player, player projectile, environment, other enemies */
const ENEMY_COLLISION_GROUPS = interactionGroups(COLLISION_GROUPS.ENEMY, [
  COLLISION_GROUPS.PLAYER,
  COLLISION_GROUPS.PLAYER_PROJECTILE,
  COLLISION_GROUPS.ENVIRONMENT,
  COLLISION_GROUPS.ENEMY,
]);

const SINK_DURATION = 3.0; // seconds before removal
const SINK_SPEED = 2.0; // units/sec downward
const SINK_ROLL_SPEED = 0.5; // radians/sec

interface EnemyBoatProps {
  id: string;
  enemyType: EnemyType;
  position: [number, number, number];
}

export function EnemyBoat({ id, enemyType, position }: EnemyBoatProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const sinkTimerRef = useRef(0);
  const isSinkingRef = useRef(false);

  // Reactive health for the health bar UI
  const enemyHealth = useGameStore((s) => s.enemies.get(id)?.health ?? null);

  const boatGltf = useGLTF('/models/enemy-skiff.glb');
  const cannonGltf = useGLTF('/models/cannon.glb');

  // Register with store and physics systems on mount
  useEffect(() => {
    return () => {
      unregisterBuoyancyBody(id);
      unregisterEnemyBody(id);
    };
  }, [id]);

  // Register rigid body once available
  useEffect(() => {
    if (rigidBodyRef.current) {
      registerBuoyancyBody(id, rigidBodyRef.current);
      registerEnemyBody(id, rigidBodyRef.current);
    }
  });

  // Get weapon mounts from enemy stats
  const weaponMounts = BOAT_STATS[enemyType].weapons.mounts;

  // Handle sinking animation
  useFrame((_state, delta) => {
    const store = useGameStore.getState();
    const enemy = store.enemies.get(id);
    if (!enemy) return;

    if (enemy.isSinking && !isSinkingRef.current) {
      isSinkingRef.current = true;
      sinkTimerRef.current = 0;
      // Disable buoyancy for sinking enemy
      unregisterBuoyancyBody(id);
    }

    if (isSinkingRef.current) {
      sinkTimerRef.current += delta;
      const body = rigidBodyRef.current;
      if (body) {
        // Move downward
        const pos = body.translation();
        body.setTranslation({ x: pos.x, y: pos.y - SINK_SPEED * delta, z: pos.z }, true);

        // Apply roll via angular velocity
        body.setAngvel({ x: SINK_ROLL_SPEED, y: 0, z: 0 }, true);
      }

      // Remove after sink duration
      if (sinkTimerRef.current >= SINK_DURATION) {
        store.removeEnemy(id);
      }
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      gravityScale={0}
      linearDamping={0.8}
      // Low angular damping so the boat can freely pitch and roll with the
      // Gerstner wave surface. Buoyancy torque handles its own damping.
      angularDamping={0.8}
      position={position}
      colliders={false}
    >
      <CuboidCollider
        args={ENEMY_HALF_EXTENTS}
        collisionGroups={ENEMY_COLLISION_GROUPS}
        density={ENEMY_DENSITY}
      />

      {/* Enemy boat model */}
      <primitive object={boatGltf.scene.clone()} scale={[1, 1, 1]} rotation={[0, 0, 0]} />

      {/* Cannon models at each weapon mount position */}
      {weaponMounts.map((mount, index) => (
        <primitive
          key={index}
          object={cannonGltf.scene.clone()}
          position={mount.localOffset}
          rotation={[0, CANNON_ROTATION_BY_QUADRANT[mount.quadrant] ?? 0, 0]}
          scale={[0.5, 0.5, 0.5]}
        />
      ))}

      {/* Health bar above enemy (only visible when damaged) */}
      {enemyHealth && <EnemyHealthBar health={enemyHealth} />}
    </RigidBody>
  );
}
