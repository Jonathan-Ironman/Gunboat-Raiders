/**
 * R3F projectile system — despawns expired projectiles each frame.
 *
 * Reads projectile lifetime data from the store, checks for expired ones,
 * and deactivates them via the pool manager.
 */

import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import { getExpiredProjectiles } from './ProjectileSystem';
import { getProjectilePoolManager } from './projectilePoolRefs';

export function ProjectileSystemR3F() {
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
    if (expired.length === 0) return;

    const poolManager = getProjectilePoolManager();

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
            }
          }
        }
      }
    }
  });

  return null;
}
