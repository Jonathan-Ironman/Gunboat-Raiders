/**
 * Global registries for physics rigid body references.
 *
 * Separated from R3F components to satisfy react-refresh
 * (component files must only export components).
 */

import type { RapierRigidBody } from '@react-three/rapier';

// ---- Buoyancy body registry ----

export type HullSamplePoint = readonly [number, number, number];

export interface BuoyancyBodyEntry {
  body: RapierRigidBody;
  hullSamplePoints?: readonly HullSamplePoint[];
}

/** Global registry for boat rigid bodies that need buoyancy. */
const buoyancyBodies = new Map<string, BuoyancyBodyEntry>();

/** Register a rigid body for buoyancy processing. */
export function registerBuoyancyBody(
  id: string,
  body: RapierRigidBody,
  hullSamplePoints?: readonly HullSamplePoint[],
): void {
  buoyancyBodies.set(id, hullSamplePoints ? { body, hullSamplePoints } : { body });
}

/** Unregister a rigid body from buoyancy processing. */
export function unregisterBuoyancyBody(id: string): void {
  buoyancyBodies.delete(id);
}

/** Get all registered buoyancy bodies. */
export function getBuoyancyBodies(): ReadonlyMap<string, BuoyancyBodyEntry> {
  return buoyancyBodies;
}

// ---- Enemy body registry ----

/** Global registry for enemy rigid bodies — set by EnemyBoat on mount. */
const enemyBodies = new Map<string, RapierRigidBody>();

/** Register an enemy rigid body. */
export function registerEnemyBody(id: string, body: RapierRigidBody): void {
  enemyBodies.set(id, body);
}

/** Unregister an enemy rigid body. */
export function unregisterEnemyBody(id: string): void {
  enemyBodies.delete(id);
}

/** Get all registered enemy rigid bodies. */
export function getEnemyBodies(): ReadonlyMap<string, RapierRigidBody> {
  return enemyBodies;
}

/** Get a specific enemy rigid body by id. */
export function getEnemyBody(id: string): RapierRigidBody | undefined {
  return enemyBodies.get(id);
}

/**
 * Reverse-lookup: find an enemy's store id from a Rapier rigid body.
 * Compares by Rapier handle (integer), which is stable for the body's lifetime.
 * Returns undefined if the body is not a registered enemy.
 */
export function findEnemyIdByBody(body: RapierRigidBody): string | undefined {
  const targetHandle = body.handle;
  for (const [id, registered] of enemyBodies) {
    if (registered.handle === targetHandle) return id;
  }
  return undefined;
}

// ---- Player body ref ----

/** Global ref for the player's rigid body — set by PlayerBoat on mount. */
let playerBodyRef: RapierRigidBody | null = null;

export function setPlayerBody(body: RapierRigidBody | null): void {
  playerBodyRef = body;
}

export function getPlayerBody(): RapierRigidBody | null {
  return playerBodyRef;
}

/** True if the given body is the currently registered player rigid body. */
export function isPlayerBody(body: RapierRigidBody): boolean {
  return playerBodyRef !== null && playerBodyRef.handle === body.handle;
}

// ---- Cached body state (populated after each physics step) ----

/**
 * Snapshot of a rigid body's position and rotation, safe to read during useFrame
 * without triggering Rapier WASM "recursive use of an object" errors.
 *
 * All useFrame-based systems MUST read from this cache rather than calling
 * body.translation() / body.rotation() directly, because the physics step may
 * be running concurrently within the same frame loop.
 */
export interface BodyStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

export interface BodyStatePatch {
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  linvel?: { x: number; y: number; z: number };
  angvel?: { x: number; y: number; z: number };
}

let playerBodyState: BodyStateSnapshot | null = null;
const enemyBodyStates = new Map<string, BodyStateSnapshot>();
const projectileBodyStates = new Map<number, BodyStateSnapshot>();

/** Update the cached player body state. Safe to call from useFrame. */
export function syncPlayerBodyState(): void {
  if (!playerBodyRef) {
    playerBodyState = null;
    return;
  }
  try {
    const pos = playerBodyRef.translation();
    const rot = playerBodyRef.rotation();
    const linvel = playerBodyRef.linvel();
    const angvel = playerBodyRef.angvel();
    playerBodyState = {
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
      linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
      angvel: { x: angvel.x, y: angvel.y, z: angvel.z },
    };
  } catch {
    // Rapier WASM may throw if the body is being accessed during internal
    // iteration. Keep the previous cached state for this frame.
  }
}

/** Get the cached player body state (safe to call in useFrame). */
export function getPlayerBodyState(): BodyStateSnapshot | null {
  return playerBodyState;
}

/**
 * Test-only helper: imperatively patch the player's rigid body state.
 * Returns false when the player body is not currently registered.
 */
export function patchPlayerBodyState(patch: BodyStatePatch): boolean {
  if (!playerBodyRef) return false;
  try {
    if (patch.position) {
      playerBodyRef.setTranslation(patch.position, true);
    }
    if (patch.rotation) {
      playerBodyRef.setRotation(patch.rotation, true);
    }
    if (patch.linvel) {
      playerBodyRef.setLinvel(patch.linvel, true);
    }
    if (patch.angvel) {
      playerBodyRef.setAngvel(patch.angvel, true);
    }
    return true;
  } catch {
    return false;
  }
}

/** Update cached enemy body states. Safe to call from useFrame. */
export function syncEnemyBodyStates(): void {
  // Remove stale entries
  for (const id of enemyBodyStates.keys()) {
    if (!enemyBodies.has(id)) {
      enemyBodyStates.delete(id);
    }
  }
  // Update all registered enemy bodies
  for (const [id, body] of enemyBodies) {
    try {
      const pos = body.translation();
      const rot = body.rotation();
      const linvel = body.linvel();
      const angvel = body.angvel();
      enemyBodyStates.set(id, {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
        linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
        angvel: { x: angvel.x, y: angvel.y, z: angvel.z },
      });
    } catch {
      // Keep previous cached state for this enemy this frame.
    }
  }
}

/** Get cached state for a specific enemy (safe to call in useFrame). */
export function getEnemyBodyState(id: string): BodyStateSnapshot | undefined {
  return enemyBodyStates.get(id);
}

/** Get all cached enemy body states (safe to call in useFrame). */
export function getAllEnemyBodyStates(): ReadonlyMap<string, BodyStateSnapshot> {
  return enemyBodyStates;
}

/**
 * Update cached projectile body states from pool bodies.
 * @param bodies Array of projectile rigid bodies from the pool.
 */
export function syncProjectileBodyStates(bodies: Array<RapierRigidBody | null>): void {
  projectileBodyStates.clear();
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (!body) continue;
    try {
      const pos = body.translation();
      // Skip deactivated bodies (far below world)
      if (pos.y < -100) continue;
      const rot = body.rotation();
      const linvel = body.linvel();
      const angvel = body.angvel();
      projectileBodyStates.set(i, {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
        linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
        angvel: { x: angvel.x, y: angvel.y, z: angvel.z },
      });
    } catch {
      // Keep previous cached state for this projectile this frame.
    }
  }
}

/** Get cached state for a projectile body by pool index (safe to call in useFrame). */
export function getProjectileBodyState(index: number): BodyStateSnapshot | undefined {
  return projectileBodyStates.get(index);
}

/** Get all cached projectile body states (safe to call in useFrame). */
export function getAllProjectileBodyStates(): ReadonlyMap<number, BodyStateSnapshot> {
  return projectileBodyStates;
}
