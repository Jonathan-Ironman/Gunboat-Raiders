/**
 * Global registries for physics rigid body references.
 *
 * Separated from R3F components to satisfy react-refresh
 * (component files must only export components).
 */

import type { RapierRigidBody } from '@react-three/rapier';

// ---- Buoyancy body registry ----

/** Global registry for boat rigid bodies that need buoyancy. */
const buoyancyBodies = new Map<string, RapierRigidBody>();

/** Register a rigid body for buoyancy processing. */
export function registerBuoyancyBody(id: string, body: RapierRigidBody): void {
  buoyancyBodies.set(id, body);
}

/** Unregister a rigid body from buoyancy processing. */
export function unregisterBuoyancyBody(id: string): void {
  buoyancyBodies.delete(id);
}

/** Get all registered buoyancy bodies. */
export function getBuoyancyBodies(): ReadonlyMap<string, RapierRigidBody> {
  return buoyancyBodies;
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
