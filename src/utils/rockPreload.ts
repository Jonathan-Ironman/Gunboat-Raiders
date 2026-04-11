/**
 * Preload all rock GLB variants so they are cached before first render.
 *
 * Kept in a separate module from Rock.tsx to satisfy the react-refresh rule
 * (component files must only export components).
 */

import { useGLTF } from '@react-three/drei';

/**
 * Ordered list of rock GLB paths — index matches the `variant` field.
 *
 * Only the `rocks-sand-*` variants are used. Playtest 2026-04-11 confirmed
 * the plain `rocks-a/b/c` models sample a near-black swatch from the Kenney
 * colormap (rgb ~60/60/66) which looks wrong in the Harbour Dawn palette.
 * The `rocks-sand-*` variants sample a light-grey-to-warm-brown gradient
 * (top ~rgb(220+,220+,230+), base ~rgb(180,120,90)) which reads as the
 * "light grey + brown" rocks Jonathan wants to keep. The dark variants
 * remain on disk but are no longer part of the selection pool.
 */
export const ROCK_MODEL_PATHS = [
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
