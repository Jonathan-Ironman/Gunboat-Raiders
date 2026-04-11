/**
 * R3F projectile system — despawns expired projectiles each frame.
 *
 * Reads projectile lifetime data from the store, checks for expired ones,
 * and deactivates them via the pool manager.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import { getExpiredProjectiles } from './ProjectileSystem';
import {
  getProjectilePoolManager,
  getEnemyProjectilePoolManager,
  drainPendingProjectileDeactivations,
  drainPendingEnemyProjectileDeactivations,
} from './projectilePoolRefs';
import { getAllProjectileBodyStates } from './physicsRefs';
import { emitVfxEvent } from '@/effects/vfxEvents';

/** Tracks which pool slots have already triggered a splash to avoid duplicates. */
const splashedSlots = new Set<number>();

export function ProjectileSystemR3F() {
  /** Tracks previous Y positions for water-crossing detection. */
  const prevYRef = useRef(new Map<number, number>());

  useFrame(() => {
    const store = useGameStore.getState();
    // R4: don't tick lifetimes or emit splash VFX while paused. The
    // projectile pool's physics bodies are frozen by `<Physics paused>`
    // anyway, so there's nothing useful for this system to do.
    if (store.phase === 'paused') return;

    // Drain any collision-queued deactivations BEFORE any other work so that
    // freed pool slots are immediately reusable this frame. This is outside
    // the `projectiles.size === 0` early-exit because a frame with an empty
    // store map can still have pending deactivations when the last active
    // projectile hit something (the store entry is removed via deactivate).
    const poolManagerEarly = getProjectilePoolManager();
    if (poolManagerEarly) {
      const pending = drainPendingProjectileDeactivations();
      for (const i of pending) {
        poolManagerEarly.deactivate(i);
      }
    }

    // Drain enemy pool deactivations with the enemy pool manager
    const enemyPoolManagerEarly = getEnemyProjectilePoolManager();
    if (enemyPoolManagerEarly) {
      const enemyPending = drainPendingEnemyProjectileDeactivations();
      for (const i of enemyPending) {
        enemyPoolManagerEarly.deactivate(i);
      }
    }

    const { projectiles } = store;
    if (projectiles.size === 0) return;

    const currentTime = performance.now() / 1000;

    // Build lifetime map from store projectiles
    const lifetimeMap = new Map<string, { spawnTime: number; maxLifetime: number }>();
    for (const [id, proj] of projectiles) {
      lifetimeMap.set(id, { spawnTime: proj.spawnTime, maxLifetime: proj.maxLifetime });
    }

    const expired = getExpiredProjectiles(lifetimeMap, currentTime);
    const poolManager = getProjectilePoolManager();

    // --- Water splash detection ---
    // Read from cached projectile body states (safe during useFrame)
    const projectileStates = getAllProjectileBodyStates();
    const prevY = prevYRef.current;
    for (const [i, state] of projectileStates) {
      const pos = state.position;
      const py = prevY.get(i);
      if (py !== undefined && py > 0 && pos.y <= 0 && !splashedSlots.has(i)) {
        // Projectile just crossed water surface
        splashedSlots.add(i);
        emitVfxEvent({
          type: 'water-splash',
          position: [pos.x, 0, pos.z],
          time: performance.now() / 1000,
        });
      }
      prevY.set(i, pos.y);
    }

    // Clean up tracking for slots no longer in the cache
    for (const i of prevY.keys()) {
      if (!projectileStates.has(i)) {
        prevY.delete(i);
        splashedSlots.delete(i);
      }
    }

    if (expired.length === 0) return;

    for (const id of expired) {
      // Use the authoritative storeId→index map to find the pool slot; a
      // position-based heuristic would leak slots for airborne misses.
      const poolIndex = poolManager?.getIndexByStoreId(id) ?? -1;

      if (poolManager && poolIndex !== -1) {
        // deactivate() removes the store entry and frees the pool slot in one call.
        poolManager.deactivate(poolIndex);
        splashedSlots.delete(poolIndex);
      } else {
        // Pool slot already freed (e.g. by collision) — just drop the store entry.
        store.removeProjectile(id);
      }
    }
  });

  return null;
}
