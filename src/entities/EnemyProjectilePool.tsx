/**
 * Enemy projectile pool — pre-allocated cannonball rigid bodies for enemy-fired shots.
 *
 * Structurally identical to ProjectilePool but uses ENEMY_PROJECTILE collision groups
 * so that enemy-fired projectiles:
 *   1. Do NOT self-collide with the firing enemy's own collider (ENEMY group is absent
 *      from the filter, so enemy bodies cannot receive collision events from these balls).
 *   2. DO collide with the player and the environment — the correct targets.
 *
 * Without this split, all projectiles were assigned PLAYER_PROJECTILE groups, which
 * caused enemy shots to immediately collide with the enemy body that fired them and die
 * within 1–2 frames before physics could move them.
 *
 * Registers via setEnemyProjectilePoolManager / getEnemyProjectilePoolManager so that
 * AISystemR3F can call the enemy-specific pool without touching the player pool.
 *
 * Uses a separate enemy metadata key space (index + ENEMY_SLOT_OFFSET) and a separate
 * deactivation queue (queueEnemyProjectileDeactivation) to avoid aliasing with the
 * player pool's indices.
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  InstancedRigidBodies,
  BallCollider,
  interactionGroups,
  type InstancedRigidBodyProps,
  type CollisionEnterPayload,
} from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { SphereGeometry, MeshStandardMaterial, Color } from 'three';
import type { InstancedMesh } from 'three';
import { useGameStore } from '@/store/gameStore';
import { COLLISION_GROUPS } from '@/utils/collisionGroups';
import {
  setEnemyProjectilePoolManager,
  setProjectileSlotMetadata,
  getProjectileSlotMetadata,
  clearProjectileSlotMetadata,
  queueEnemyProjectileDeactivation,
  isEnemyProjectileDeactivationPending,
  clearAllPendingEnemyProjectileDeactivations,
  setEnemyProjectileInstancedMesh,
} from '@/systems/projectilePoolRefs';
import { findEnemyIdByBody, isPlayerBody, getProjectileBodyState } from '@/systems/physicsRefs';
import { emitVfxEvent } from '@/effects/vfxEvents';

const POOL_SIZE = 30;
const SLEEP_POSITION_Y = -1000;
const PROJECTILE_VISUAL_RADIUS = 0.35;
const PROJECTILE_MAX_LIFETIME = 8;

/**
 * Metadata key offset so enemy pool slot indices (0–29) do not collide with
 * player pool slot indices (0–49) in the shared slotMetadata map.
 */
const ENEMY_SLOT_OFFSET = 1000;

/**
 * Collision groups for enemy projectiles:
 * - Membership: ENEMY_PROJECTILE (group 3)
 * - Filter: PLAYER + ENVIRONMENT only.
 *   ENEMY is intentionally absent — this prevents the firing enemy's own
 *   collider (in the ENEMY group) from triggering a collision with the
 *   newly-spawned projectile, which would kill it in 1–2 frames.
 */
const ENEMY_PROJECTILE_GROUPS = interactionGroups(COLLISION_GROUPS.ENEMY_PROJECTILE, [
  COLLISION_GROUPS.PLAYER,
  COLLISION_GROUPS.ENVIRONMENT,
]);

export function EnemyProjectilePool() {
  const rigidBodiesRef = useRef<RapierRigidBody[]>(null);
  const instancedMeshRef = useRef<InstancedMesh>(null);
  const activeIndicesRef = useRef(new Set<number>());
  /** Maps Zustand storeId → pool slot index for O(1) lifetime-expiry lookup. */
  const storeIdToIndexRef = useRef(new Map<string, number>());

  /**
   * Core deactivation — moves body to sleep position and zeroes
   * velocity/gravity. Must be called outside the physics step.
   *
   * CRITICAL: we deliberately do NOT call `body.sleep()` here. See the
   * identical block comment in `ProjectilePool.tsx` for the full rationale.
   * Short version: react-three-rapier's mesh-update loop (esm.js ~line 936)
   * treats each InstancedRigidBodies child's `state.object` as the wrapping
   * <object3D>, not the InstancedMesh, so sleeping an instance skips the
   * instanceMatrix sync and the cannonball visually sticks at the impact
   * point. Leaving the body awake lets r3r copy the new translation onto
   * the instance matrix on the next frame; Rapier's auto-sleep then parks
   * the body once linvel/angvel/gravity are all zero.
   */
  const deactivateSlot = useCallback((index: number): void => {
    const bodies = rigidBodiesRef.current;
    if (!bodies) return;

    const body = bodies[index];
    if (!body) return;

    const metaKey = index + ENEMY_SLOT_OFFSET;

    if (!activeIndicesRef.current.has(index)) {
      clearProjectileSlotMetadata(metaKey);
      return;
    }
    activeIndicesRef.current.delete(index);
    // Remove from storeId→index map using the metadata that's still present.
    const meta = getProjectileSlotMetadata(metaKey);
    if (meta) {
      storeIdToIndexRef.current.delete(meta.storeId);
    }
    clearProjectileSlotMetadata(metaKey);

    try {
      // wakeUp=true so sleeping bodies (from the mount-time initial sleep)
      // re-enter the mesh-update loop for at least one frame.
      body.wakeUp();
      body.setTranslation({ x: 0, y: SLEEP_POSITION_Y, z: 0 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setGravityScale(0, true);
      // No body.sleep() here — see the block comment above.
    } catch {
      // Rapier may be mid-step on edge cases; slot is already marked inactive.
    }
  }, []);

  /**
   * Shared collision handler for all enemy pool instances.
   * Must not mutate any rigid body state (runs inside Rapier physics step).
   */
  const handleCollisionEnter = useCallback((payload: CollisionEnterPayload): void => {
    const bodies = rigidBodiesRef.current;
    if (!bodies) return;

    const targetBody = payload.target.rigidBody;
    if (!targetBody) return;

    // Find which enemy pool slot this projectile belongs to
    let index = -1;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b && b.handle === targetBody.handle) {
        index = i;
        break;
      }
    }
    if (index === -1) return;
    if (!activeIndicesRef.current.has(index)) return;
    if (isEnemyProjectileDeactivationPending(index)) return;

    const metadata = getProjectileSlotMetadata(index + ENEMY_SLOT_OFFSET);
    if (!metadata) return;

    const otherBody = payload.other.rigidBody;
    let targetId: string | undefined;
    if (otherBody) {
      if (isPlayerBody(otherBody)) {
        targetId = 'player';
      } else {
        targetId = findEnemyIdByBody(otherBody);
      }
    }

    // Prevent self-damage (should not be possible with correct collision groups,
    // but guard defensively against edge cases like splash damage routes)
    if (targetId && targetId !== metadata.ownerId) {
      useGameStore.getState().applyDamage(targetId, metadata.damage);
    }

    // Emit explosion VFX at cached position (do NOT call body WASM APIs here)
    const cachedState = getProjectileBodyState(index + ENEMY_SLOT_OFFSET);
    if (cachedState) {
      const p = cachedState.position;
      emitVfxEvent({
        type: 'explosion',
        position: [p.x, p.y, p.z],
        time: performance.now() / 1000,
      });
    }

    queueEnemyProjectileDeactivation(index);
  }, []);

  const instances = useMemo<InstancedRigidBodyProps[]>(() => {
    const result: InstancedRigidBodyProps[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      result.push({
        key: `enemy_projectile_${String(i)}`,
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
      if (index === -1) return -1;

      const body = bodies[index];
      if (!body) return -1;

      activeIndicesRef.current.add(index);

      body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setGravityScale(1, true);
      body.wakeUp();
      body.setLinvel({ x: impulse[0], y: impulse[1], z: impulse[2] }, true);

      const currentTime = performance.now() / 1000;
      const storeId = useGameStore.getState().spawnProjectile({
        ownerId,
        ownerType,
        damage,
        splashDamage,
        splashRadius,
        spawnTime: currentTime,
        maxLifetime: PROJECTILE_MAX_LIFETIME,
      });

      setProjectileSlotMetadata(index + ENEMY_SLOT_OFFSET, {
        ownerId,
        ownerType,
        damage,
        splashDamage,
        splashRadius,
        storeId,
      });
      storeIdToIndexRef.current.set(storeId, index);

      return index;
    },
    [],
  );

  const deactivate = useCallback(
    (index: number): void => {
      const meta = getProjectileSlotMetadata(index + ENEMY_SLOT_OFFSET);
      if (meta) {
        useGameStore.getState().removeProjectile(meta.storeId);
      }
      deactivateSlot(index);
    },
    [deactivateSlot],
  );

  const getIndexByStoreId = useCallback((storeId: string): number => {
    return storeIdToIndexRef.current.get(storeId) ?? -1;
  }, []);

  const getBodies = useCallback((): (RapierRigidBody | null)[] => {
    return rigidBodiesRef.current ?? [];
  }, []);

  useEffect(() => {
    setEnemyProjectilePoolManager({ activate, deactivate, getBodies, getIndexByStoreId });
    const storeIdToIndex = storeIdToIndexRef.current;
    return () => {
      setEnemyProjectilePoolManager(null);
      // Clear metadata entries for our slot range
      for (let i = 0; i < POOL_SIZE; i++) {
        clearProjectileSlotMetadata(i + ENEMY_SLOT_OFFSET);
      }
      clearAllPendingEnemyProjectileDeactivations();
      storeIdToIndex.clear();
    };
  }, [activate, deactivate, getBodies, getIndexByStoreId]);

  // Register the InstancedMesh ref for dev/test inspection of GPU-facing
  // instance matrices. See the equivalent hook in ProjectilePool.tsx.
  useEffect(() => {
    setEnemyProjectileInstancedMesh(instancedMeshRef.current);
    const mesh = instancedMeshRef.current;
    if (mesh) {
      // Same issue as the player projectile pool: instance matrices move every
      // shot, but Three.js keeps stale bounds for the instanced mesh.
      mesh.frustumCulled = false;
    }
    return () => {
      setEnemyProjectileInstancedMesh(null);
    };
  }, []);

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

  const { geometry, material } = useMemo(() => {
    const geo = new SphereGeometry(PROJECTILE_VISUAL_RADIUS, 16, 12);
    const mat = new MeshStandardMaterial({
      color: new Color('#1a1a1a'),
      emissive: new Color(4, 2, 0.4),
      emissiveIntensity: 1,
      roughness: 0.4,
      metalness: 0.6,
      toneMapped: false,
    });
    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <InstancedRigidBodies
      ref={rigidBodiesRef}
      instances={instances}
      type="dynamic"
      ccd
      colliders={false}
      onCollisionEnter={handleCollisionEnter}
      colliderNodes={[
        <BallCollider
          key="enemy-projectile-collider"
          args={[PROJECTILE_VISUAL_RADIUS]}
          collisionGroups={ENEMY_PROJECTILE_GROUPS}
        />,
      ]}
    >
      <instancedMesh
        ref={instancedMeshRef}
        args={[geometry, material, POOL_SIZE]}
        count={POOL_SIZE}
      />
    </InstancedRigidBodies>
  );
}
