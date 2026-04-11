/**
 * Global ref for the projectile pool manager.
 *
 * Separated from R3F component to satisfy react-refresh
 * (component files must only export components).
 */

import type { RapierRigidBody } from '@react-three/rapier';

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
