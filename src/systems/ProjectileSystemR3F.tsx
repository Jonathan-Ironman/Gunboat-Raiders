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
import { getProjectilePoolManager } from './projectilePoolRefs';
import { emitVfxEvent } from '@/effects/vfxEvents';

/** Tracks which pool slots have already triggered a splash to avoid duplicates. */
const splashedSlots = new Set<number>();

export function ProjectileSystemR3F() {
  /** Tracks previous Y positions for water-crossing detection. */
  const prevYRef = useRef(new Map<number, number>());

  useFrame(() => {
    const store = useGameStore.getState();
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
    // Check active projectile bodies crossing Y=0 (water surface)
    if (poolManager) {
      const bodies = poolManager.getBodies();
      const prevY = prevYRef.current;
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (!body) continue;
        const pos = body.translation();
        // Skip sleeping/deactivated bodies (far below world)
        if (pos.y < -100) {
          prevY.delete(i);
          splashedSlots.delete(i);
          continue;
        }
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
    }

    if (expired.length === 0) return;

    for (const id of expired) {
      store.removeProjectile(id);

      // Deactivate pool slot — find by index
      // Note: since we use nanoid for projectile IDs and numeric pool indices,
      // the pool deactivation is handled separately.
      // For a simple MVP, deactivate all active slots for expired projectiles.
      if (poolManager) {
        const bodies = poolManager.getBodies();
        for (let i = 0; i < bodies.length; i++) {
          const body = bodies[i];
          if (body) {
            const pos = body.translation();
            // Deactivate bodies that have fallen below sea level significantly
            // (they've hit something or expired)
            if (pos.y < -50) {
              poolManager.deactivate(i);
              splashedSlots.delete(i);
            }
          }
        }
      }
    }
  });

  return null;
}
