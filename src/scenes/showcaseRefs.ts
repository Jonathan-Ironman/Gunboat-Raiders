/**
 * Scene-local registry for the Showcase scene's rigid body.
 *
 * Kept out of `src/systems/physicsRefs.ts` on purpose: the showcase
 * scene only runs during `phase === 'mainMenu'` and has no business
 * living in the gameplay physics refs module. A component file cannot
 * export non-component bindings without tripping react-refresh, so
 * this module provides a tiny getter/setter pair that the scene
 * camera can read without importing the body component directly.
 */

import type { RapierRigidBody } from '@react-three/rapier';

let showcaseBoatBody: RapierRigidBody | null = null;

export function setShowcaseBoatBody(body: RapierRigidBody | null): void {
  showcaseBoatBody = body;
}

export function getShowcaseBoatBody(): RapierRigidBody | null {
  return showcaseBoatBody;
}
