/**
 * PhysicsSyncSystem — caches rigid body positions/rotations each render frame.
 *
 * All useFrame-based systems (Camera, AI, Weapons, Projectiles) MUST read from
 * the cached state (getPlayerBodyState, getEnemyBodyState, etc.) instead of
 * calling body.translation() / body.rotation() directly.
 *
 * NOTE: We intentionally use useFrame (priority -20) instead of
 * useAfterPhysicsStep to avoid Rapier WASM "recursive use of an object" errors
 * that occur when accessing rigid body state inside physics step callbacks.
 * Reading body state from useFrame is safe because the physics step has already
 * completed by the time the render loop runs.
 *
 * Must be placed inside <Physics>.
 */

import { useFrame } from '@react-three/fiber';
import { syncPlayerBodyState, syncEnemyBodyStates, syncProjectileBodyStates } from './physicsRefs';
import { getProjectilePoolManager } from './projectilePoolRefs';

export function PhysicsSyncSystem() {
  // Priority -20: runs before all other useFrame callbacks to ensure cached
  // state is fresh for buoyancy (-10), camera (0), AI (0), weapons (0), etc.
  useFrame(() => {
    try {
      // Snapshot all body states — safe to read from useFrame
      syncPlayerBodyState();
      syncEnemyBodyStates();

      // Sync projectile pool bodies
      const poolManager = getProjectilePoolManager();
      if (poolManager) {
        syncProjectileBodyStates(poolManager.getBodies());
      }
    } catch {
      // Rapier WASM may throw if bodies are being modified concurrently.
      // Skip this frame — stale cached state is acceptable for one frame.
    }
  }, -20);

  return null;
}
