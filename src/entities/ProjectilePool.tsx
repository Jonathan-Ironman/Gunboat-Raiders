/**
 * Projectile pool — pre-allocated cannonball rigid bodies.
 *
 * Uses InstancedRigidBodies for efficient rendering and physics.
 * Inactive projectiles are placed far below the world and put to sleep.
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  InstancedRigidBodies,
  BallCollider,
  interactionGroups,
  type InstancedRigidBodyProps,
} from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useGLTF } from '@react-three/drei';
import type { BufferGeometry, Material, Mesh } from 'three';
import { useGameStore } from '@/store/gameStore';
import { COLLISION_GROUPS } from '@/utils/collisionGroups';
import { setProjectilePoolManager } from '@/systems/projectilePoolRefs';

useGLTF.preload('/models/cannon-ball.glb');

const POOL_SIZE = 50;
const SLEEP_POSITION_Y = -1000;

/** Collision groups for player projectiles: collide with enemy + environment */
const PLAYER_PROJECTILE_GROUPS = interactionGroups(COLLISION_GROUPS.PLAYER_PROJECTILE, [
  COLLISION_GROUPS.ENEMY,
  COLLISION_GROUPS.ENVIRONMENT,
]);

/** Max lifetime for a projectile in seconds */
const PROJECTILE_MAX_LIFETIME = 8;

export function ProjectilePool() {
  const rigidBodiesRef = useRef<RapierRigidBody[]>(null);
  const cannonBallGltf = useGLTF('/models/cannon-ball.glb');
  const activeIndicesRef = useRef(new Set<number>());

  // Initial instances: all at sleep position
  const instances = useMemo<InstancedRigidBodyProps[]>(() => {
    const result: InstancedRigidBodyProps[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      result.push({
        key: `projectile_${String(i)}`,
        position: [0, SLEEP_POSITION_Y, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      });
    }
    return result;
  }, []);

  const activate = useCallback(
    (
      position: [number, number, number],
      impulse: [number, number, number],
      ownerId: string,
      ownerType: 'player' | 'enemy',
      damage: number,
      splashDamage: number,
      splashRadius: number,
    ): number => {
      const bodies = rigidBodiesRef.current;
      if (!bodies) return -1;

      // Find first inactive slot
      let index = -1;
      for (let i = 0; i < POOL_SIZE; i++) {
        if (!activeIndicesRef.current.has(i)) {
          index = i;
          break;
        }
      }
      if (index === -1) return -1; // Pool exhausted

      const body = bodies[index];
      if (!body) return -1;

      activeIndicesRef.current.add(index);

      // Wake and position the body
      body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setGravityScale(1, true);
      body.wakeUp();
      body.applyImpulse({ x: impulse[0], y: impulse[1], z: impulse[2] }, true);

      // Register in store
      const currentTime = performance.now() / 1000;
      useGameStore.getState().spawnProjectile({
        ownerId,
        ownerType,
        damage,
        splashDamage,
        splashRadius,
        spawnTime: currentTime,
        maxLifetime: PROJECTILE_MAX_LIFETIME,
      });

      return index;
    },
    [],
  );

  const deactivate = useCallback((index: number): void => {
    const bodies = rigidBodiesRef.current;
    if (!bodies) return;

    const body = bodies[index];
    if (!body) return;

    activeIndicesRef.current.delete(index);

    // Move to sleep position and put to sleep
    body.setTranslation({ x: 0, y: SLEEP_POSITION_Y, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setGravityScale(0, true);
    body.sleep();
  }, []);

  const getBodies = useCallback((): (RapierRigidBody | null)[] => {
    return rigidBodiesRef.current ?? [];
  }, []);

  // Register pool manager globally
  useEffect(() => {
    setProjectilePoolManager({ activate, deactivate, getBodies });
    return () => {
      setProjectilePoolManager(null);
    };
  }, [activate, deactivate, getBodies]);

  // Put all bodies to sleep on mount
  useEffect(() => {
    const bodies = rigidBodiesRef.current;
    if (!bodies) return;

    for (let i = 0; i < POOL_SIZE; i++) {
      const body = bodies[i];
      if (body) {
        body.setGravityScale(0, true);
        body.sleep();
      }
    }
  }, []);

  // Get geometry and material from the loaded model
  const { geometry, material } = useMemo(() => {
    let foundGeometry: BufferGeometry | undefined;
    let foundMaterial: Material | undefined;
    cannonBallGltf.scene.traverse((child) => {
      if ('isMesh' in child && !foundGeometry) {
        const mesh = child as Mesh;
        foundGeometry = mesh.geometry;
        foundMaterial = mesh.material as Material;
      }
    });
    return { geometry: foundGeometry, material: foundMaterial };
  }, [cannonBallGltf.scene]);

  if (!geometry || !material) return null;

  return (
    <InstancedRigidBodies
      ref={rigidBodiesRef}
      instances={instances}
      type="dynamic"
      ccd
      gravityScale={0}
      colliders={false}
    >
      <instancedMesh args={[geometry, material, POOL_SIZE]} count={POOL_SIZE}>
        <BallCollider args={[0.15]} collisionGroups={PLAYER_PROJECTILE_GROUPS} />
      </instancedMesh>
    </InstancedRigidBodies>
  );
}
