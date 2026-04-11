/**
 * Global ref for the projectile pool manager.
 *
 * Separated from R3F component to satisfy react-refresh
 * (component files must only export components).
 */

import type { RapierRigidBody } from '@react-three/rapier';
import type { InstancedMesh } from 'three';

export interface ProjectilePoolManager {
  activate(
    position: [number, number, number],
    impulse: [number, number, number],
    ownerId: string,
    ownerType: 'player' | 'enemy',
    damage: number,
    splashDamage: number,
    splashRadius: number,
  ): number;
  deactivate(index: number): void;
  getBodies(): (RapierRigidBody | null)[];
  /**
   * Look up the pool slot index by the Zustand store id registered at activation.
   * Returns -1 if the storeId is not currently active in this pool.
   */
  getIndexByStoreId(storeId: string): number;
}

/**
 * Per-pool-slot metadata for active projectiles.
 *
 * Populated by the pool's activate() and cleared by deactivate().
 * Collision callbacks read this to know who owns a projectile and
 * how much damage to deal on impact.
 */
export interface ProjectileSlotMetadata {
  ownerId: string;
  ownerType: 'player' | 'enemy';
  damage: number;
  splashDamage: number;
  splashRadius: number;
  /** Zustand store id returned by spawnProjectile(); used for cleanup. */
  storeId: string;
}

let poolManagerRef: ProjectilePoolManager | null = null;

export function setProjectilePoolManager(manager: ProjectilePoolManager | null): void {
  poolManagerRef = manager;
}

export function getProjectilePoolManager(): ProjectilePoolManager | null {
  return poolManagerRef;
}

/** Separate pool manager for enemy-fired projectiles. */
let enemyPoolManagerRef: ProjectilePoolManager | null = null;

export function setEnemyProjectilePoolManager(manager: ProjectilePoolManager | null): void {
  enemyPoolManagerRef = manager;
}

export function getEnemyProjectilePoolManager(): ProjectilePoolManager | null {
  return enemyPoolManagerRef;
}

/** Pool-slot metadata keyed by pool index. */
const slotMetadata = new Map<number, ProjectileSlotMetadata>();

export function setProjectileSlotMetadata(index: number, metadata: ProjectileSlotMetadata): void {
  slotMetadata.set(index, metadata);
}

export function getProjectileSlotMetadata(index: number): ProjectileSlotMetadata | undefined {
  return slotMetadata.get(index);
}

export function clearProjectileSlotMetadata(index: number): void {
  slotMetadata.delete(index);
}

export function clearAllProjectileSlotMetadata(): void {
  slotMetadata.clear();
}

/**
 * Queue of pool indices pending deactivation — drained by ProjectileSystemR3F
 * at the start of each frame. Rapier collision callbacks cannot mutate rigid
 * body state, so impacts push onto this set and cleanup is deferred.
 */
const pendingDeactivations = new Set<number>();

export function queueProjectileDeactivation(index: number): void {
  pendingDeactivations.add(index);
}

export function isProjectileDeactivationPending(index: number): boolean {
  return pendingDeactivations.has(index);
}

export function drainPendingProjectileDeactivations(): number[] {
  if (pendingDeactivations.size === 0) return [];
  const indices = Array.from(pendingDeactivations);
  pendingDeactivations.clear();
  return indices;
}

export function clearAllPendingProjectileDeactivations(): void {
  pendingDeactivations.clear();
}

/**
 * Separate deactivation queue for the enemy projectile pool.
 * Kept distinct so ProjectileSystemR3F can drain each pool's queue with
 * the correct pool manager without index aliasing.
 */
const pendingEnemyDeactivations = new Set<number>();

export function queueEnemyProjectileDeactivation(index: number): void {
  pendingEnemyDeactivations.add(index);
}

export function isEnemyProjectileDeactivationPending(index: number): boolean {
  return pendingEnemyDeactivations.has(index);
}

export function drainPendingEnemyProjectileDeactivations(): number[] {
  if (pendingEnemyDeactivations.size === 0) return [];
  const indices = Array.from(pendingEnemyDeactivations);
  pendingEnemyDeactivations.clear();
  return indices;
}

export function clearAllPendingEnemyProjectileDeactivations(): void {
  pendingEnemyDeactivations.clear();
}

// ---------------------------------------------------------------------------
// Instanced-mesh refs — used by dev/test code to read the VISIBLE transforms
// written to each projectile's instance matrix, independent of the physics
// body state. These let deterministic tests prove the despawn is actually
// reflected on the GPU-facing mesh (not just on the rigid body), which
// guards against the InstancedRigidBodies sleep-skip bug fixed in 2026-04-11.
// ---------------------------------------------------------------------------

let playerProjectileInstancedMeshRef: InstancedMesh | null = null;
let enemyProjectileInstancedMeshRef: InstancedMesh | null = null;

export function setPlayerProjectileInstancedMesh(mesh: InstancedMesh | null): void {
  playerProjectileInstancedMeshRef = mesh;
}

export function getPlayerProjectileInstancedMesh(): InstancedMesh | null {
  return playerProjectileInstancedMeshRef;
}

export function setEnemyProjectileInstancedMesh(mesh: InstancedMesh | null): void {
  enemyProjectileInstancedMeshRef = mesh;
}

export function getEnemyProjectileInstancedMesh(): InstancedMesh | null {
  return enemyProjectileInstancedMeshRef;
}

/**
 * Return the translation component of a pool slot's current instance matrix.
 * Used by tests to verify that the visible cannonball has actually moved
 * off-screen after deactivation (body at y = -1000 but mesh stuck at impact
 * means the instance matrix Y is still near the impact Y — the failing case).
 */
export function getProjectileInstanceTranslation(
  pool: 'player' | 'enemy',
  index: number,
): { x: number; y: number; z: number } | null {
  const mesh =
    pool === 'player' ? playerProjectileInstancedMeshRef : enemyProjectileInstancedMeshRef;
  if (!mesh) return null;
  if (index < 0 || index >= mesh.count) return null;
  // InstancedMesh stores matrices as row-major Float32Array of 16-component
  // blocks; Three.js Matrix4 is column-major. The translation is at indices
  // 12, 13, 14 of the 16-wide block (column-major layout).
  const base = index * 16;
  const arr = mesh.instanceMatrix.array;
  return {
    x: arr[base + 12] ?? 0,
    y: arr[base + 13] ?? 0,
    z: arr[base + 14] ?? 0,
  };
}
