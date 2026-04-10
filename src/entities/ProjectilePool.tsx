/**
 * Projectile pool — pre-allocated cannonball rigid bodies.
 *
 * Uses InstancedRigidBodies for efficient rendering and physics. Each instance
 * shares a single BallCollider declared through the `colliderNodes` prop so
 * that per-instance colliders are created (r3r only reparents `colliderNodes`
 * into each RigidBody; a collider placed in plain `children` would stay as a
 * single orphan at the wrapper level and never collide).
 *
 * Inactive projectiles are placed far below the world and put to sleep.
 *
 * Collision pipeline:
 * - A single `onCollisionEnter` is attached at the InstancedRigidBodies
 *   wrapper level and dispatched to every instance. The hit pool index is
 *   recovered by matching `target.rigidBody.handle` (a plain JS integer
 *   field, safe to read) against the pool array.
 * - Metadata for the slot (owner, damage, store id) is looked up in the
 *   pool refs module; the target entity is identified via the enemy/player
 *   body registries.
 * - Damage is applied through the store, an explosion VFX is emitted at the
 *   last cached projectile position, and the slot is queued for deactivation
 *   on the next frame.
 * - Collision callbacks run INSIDE Rapier's physics step, so they must
 *   never read or write rigid body state via WASM calls (translation(),
 *   linvel(), setLinvel(), etc.). Doing so re-enters the WASM world and
 *   triggers "recursive use of an object detected" errors that eventually
 *   corrupt physics state and crash the game. The callback here only:
 *     - reads plain JS fields (body.handle)
 *     - mutates Zustand store state
 *     - emits VFX events
 *     - queues deferred cleanup
 *   ProjectileSystemR3F drains the pending queue each frame, OUTSIDE the
 *   physics step, where WASM calls are safe.
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
import { useGameStore } from '@/store/gameStore';
import { COLLISION_GROUPS } from '@/utils/collisionGroups';
import {
  setProjectilePoolManager,
  setProjectileSlotMetadata,
  getProjectileSlotMetadata,
  clearProjectileSlotMetadata,
  clearAllProjectileSlotMetadata,
  queueProjectileDeactivation,
  isProjectileDeactivationPending,
  clearAllPendingProjectileDeactivations,
} from '@/systems/projectilePoolRefs';
import { findEnemyIdByBody, isPlayerBody, getProjectileBodyState } from '@/systems/physicsRefs';
import { emitVfxEvent } from '@/effects/vfxEvents';

const POOL_SIZE = 50;
const SLEEP_POSITION_Y = -1000;

/**
 * Radius used for both the cannonball visual mesh and its BallCollider.
 * A value around 0.35 m is large enough to be clearly visible at 60 m/s
 * muzzle velocity while staying small relative to boat hulls, giving
 * reliable hit detection without looking comically oversized.
 */
const PROJECTILE_VISUAL_RADIUS = 0.35;

/** Collision groups for player projectiles: collide with enemy + environment */
const PLAYER_PROJECTILE_GROUPS = interactionGroups(COLLISION_GROUPS.PLAYER_PROJECTILE, [
  COLLISION_GROUPS.ENEMY,
  COLLISION_GROUPS.ENVIRONMENT,
]);

/** Max lifetime for a projectile in seconds */
const PROJECTILE_MAX_LIFETIME = 8;

export function ProjectilePool() {
  const rigidBodiesRef = useRef<RapierRigidBody[]>(null);
  const activeIndicesRef = useRef(new Set<number>());

  /**
   * Core deactivation logic — moves the body to the sleep position, zeroes
   * velocity, sleeps it, and clears slot metadata. Safe to call from useFrame
   * (which runs outside the physics step) but NOT from a collision callback.
   */
  const deactivateSlot = useCallback((index: number): void => {
    const bodies = rigidBodiesRef.current;
    if (!bodies) return;

    const body = bodies[index];
    if (!body) return;

    if (!activeIndicesRef.current.has(index)) {
      // Still clear metadata in case it lingered.
      clearProjectileSlotMetadata(index);
      return;
    }
    activeIndicesRef.current.delete(index);
    clearProjectileSlotMetadata(index);

    try {
      body.setTranslation({ x: 0, y: SLEEP_POSITION_Y, z: 0 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setGravityScale(0, true);
      body.sleep();
    } catch {
      // Rapier may still be mid-step on some edge cases. The slot is already
      // marked inactive, so subsequent activations will reclaim it.
    }
  }, []);

  /**
   * Shared collision handler for all pool instances.
   *
   * Called synchronously from inside the physics step, so we MUST NOT mutate
   * any rigid body state here — we only apply store damage, emit a VFX
   * event, and queue deferred cleanup. The pool index for the hit projectile
   * is recovered by matching the target rigid body's Rapier handle against
   * the pool body array.
   */
  const handleCollisionEnter = useCallback((payload: CollisionEnterPayload): void => {
    const bodies = rigidBodiesRef.current;
    if (!bodies) return;

    const targetBody = payload.target.rigidBody;
    if (!targetBody) return;

    // Find which pool slot this projectile belongs to by handle match.
    let index = -1;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b && b.handle === targetBody.handle) {
        index = i;
        break;
      }
    }
    if (index === -1) return;

    // Ignore if this slot is already inactive or already queued.
    if (!activeIndicesRef.current.has(index)) return;
    if (isProjectileDeactivationPending(index)) return;

    const metadata = getProjectileSlotMetadata(index);
    if (!metadata) return;

    const otherBody = payload.other.rigidBody;

    // Identify the target entity via registered body lookups.
    let targetId: string | undefined;
    if (otherBody) {
      if (isPlayerBody(otherBody)) {
        targetId = 'player';
      } else {
        targetId = findEnemyIdByBody(otherBody);
      }
    }

    // Prevent self-damage: a projectile fired by an entity must never damage
    // its own owner. Rare but possible at point-blank muzzle exit.
    if (targetId && targetId !== metadata.ownerId) {
      useGameStore.getState().applyDamage(targetId, metadata.damage);
    }

    // Emit explosion VFX at the projectile's last cached position.
    //
    // CRITICAL: We MUST NOT call targetBody.translation() here. Collision
    // callbacks run synchronously inside Rapier's WASM physics step, so any
    // read of a rigid body's world state re-enters the WASM world and
    // triggers "recursive use of an object detected" errors. Over time this
    // corrupts the physics state and crashes the game with an `unreachable`
    // runtime error. The cached projectile state (populated by
    // PhysicsSyncSystem at the top of each render frame) is one frame behind
    // the contact point, which is imperceptible for a cosmetic explosion.
    const cachedState = getProjectileBodyState(index);
    if (cachedState) {
      const p = cachedState.position;
      emitVfxEvent({
        type: 'explosion',
        position: [p.x, p.y, p.z],
        time: performance.now() / 1000,
      });
    }

    // Queue deactivation — the next frame drains the queue and recycles the
    // slot.
    queueProjectileDeactivation(index);
  }, []);

  // Initial instances: all at sleep position. The shared collision handler
  // is attached at the wrapper level (see the InstancedRigidBodies props
  // below) so we do not need to set it per-instance.
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

      // Wake and position the body, then set velocity directly.
      // setLinvel is used instead of applyImpulse to guarantee the desired
      // muzzle velocity regardless of the projectile's collider mass.
      body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setGravityScale(1, true);
      body.wakeUp();
      body.setLinvel({ x: impulse[0], y: impulse[1], z: impulse[2] }, true);

      // Register in store and capture the store id for collision cleanup.
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

      setProjectileSlotMetadata(index, {
        ownerId,
        ownerType,
        damage,
        splashDamage,
        splashRadius,
        storeId,
      });

      return index;
    },
    [],
  );

  const deactivate = useCallback(
    (index: number): void => {
      // Look up the store id BEFORE clearing metadata, so the store entry can
      // also be removed for callers (e.g. the lifetime expiry path).
      const meta = getProjectileSlotMetadata(index);
      if (meta) {
        useGameStore.getState().removeProjectile(meta.storeId);
      }
      deactivateSlot(index);
    },
    [deactivateSlot],
  );

  const getBodies = useCallback((): (RapierRigidBody | null)[] => {
    return rigidBodiesRef.current ?? [];
  }, []);

  // Register pool manager globally
  useEffect(() => {
    setProjectilePoolManager({ activate, deactivate, getBodies });
    return () => {
      setProjectilePoolManager(null);
      clearAllProjectileSlotMetadata();
      clearAllPendingProjectileDeactivations();
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

  /**
   * Bright emissive sphere for the cannonball. Using a custom standard
   * material (rather than the GLB model's baked material) guarantees the
   * ball is clearly visible against water and sky and that emissive HDR
   * values above 1 trigger the scene bloom pass.
   */
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

  // Dispose on unmount to avoid GPU resource leaks.
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
          key="projectile-collider"
          args={[PROJECTILE_VISUAL_RADIUS]}
          collisionGroups={PLAYER_PROJECTILE_GROUPS}
        />,
      ]}
    >
      <instancedMesh args={[geometry, material, POOL_SIZE]} count={POOL_SIZE} />
    </InstancedRigidBodies>
  );
}
