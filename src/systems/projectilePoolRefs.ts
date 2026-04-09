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
}

let poolManagerRef: ProjectilePoolManager | null = null;

export function setProjectilePoolManager(manager: ProjectilePoolManager | null): void {
  poolManagerRef = manager;
}

export function getProjectilePoolManager(): ProjectilePoolManager | null {
  return poolManagerRef;
}
