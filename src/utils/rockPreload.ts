/**
 * Preload all rock GLB variants so they are cached before first render.
 *
 * Kept in a separate module from Rock.tsx to satisfy the react-refresh rule
 * (component files must only export components).
 */

import { useGLTF } from '@react-three/drei';

/** Ordered list of rock GLB paths — index matches the `variant` field. */
export const ROCK_MODEL_PATHS = [
  '/models/rocks-a.glb',
  '/models/rocks-b.glb',
  '/models/rocks-c.glb',
  '/models/rocks-sand-a.glb',
  '/models/rocks-sand-b.glb',
  '/models/rocks-sand-c.glb',
] as const;

/** Call once at startup to preload all rock model variants. */
export function preloadRockModels(): void {
  for (const path of ROCK_MODEL_PATHS) {
    useGLTF.preload(path);
  }
}
