/**
 * Pure path-driving helpers for the Showcase boat.
 *
 * Extracted out of `ShowcasePlayerBoat.tsx` so the logic can be unit-
 * tested in Node without importing Three.js, Rapier or React — all of
 * which the showcase component consumes at module scope and would fail
 * to evaluate under the Vitest `node` environment.
 *
 * The helpers here are deliberately dependency-free:
 *
 * - `computeShowcaseBoatTarget` converts a `ShowcaseBoatConfig` +
 *   elapsed time into a target XZ velocity + desired yaw heading.
 *   The component's `useFrame` then maps those onto Rapier via
 *   `setLinvel` / `setAngvel`.
 *
 * - `shortestAngleDelta` returns the signed shortest angular distance
 *   between two angles (radians) so the boat always turns the short
 *   way around when the heading wraps through ±π.
 */

import type { ShowcaseBoatConfig } from './showcasePresets';

/**
 * Compute the target XZ velocity and desired yaw heading for a given
 * preset path at elapsed time `t` (seconds).
 *
 * @param config The active showcase boat config.
 * @param t Elapsed time in seconds since the scene mounted.
 * @returns `{ vx, vz, heading }` — linear velocity components on the
 *          XZ plane and the desired Y-axis heading (radians, same
 *          convention as Rapier + Three's `YXZ` Euler).
 */
export function computeShowcaseBoatTarget(
  config: ShowcaseBoatConfig,
  t: number,
): { vx: number; vz: number; heading: number } {
  switch (config.path) {
    case 'stationary':
      return { vx: 0, vz: 0, heading: 0 };

    case 'straight': {
      // Cruise along +Z at the configured speed. Heading is 0 (facing +Z).
      return { vx: 0, vz: config.speed, heading: 0 };
    }

    case 'circle': {
      // Circle around the preset's start position. Angular velocity is
      // `speed / radius`. The boat faces along its tangent direction.
      // A zero radius degrades gracefully to zero angular velocity so
      // we never divide by zero.
      const radius = config.radius ?? 10;
      const omega = radius > 0 ? config.speed / radius : 0;
      const angle = omega * t;
      // Tangent of (r*cosθ, r*sinθ) evaluated on the XZ plane.
      const vx = -config.speed * Math.sin(angle);
      const vz = config.speed * Math.cos(angle);
      // Three/Rapier Y-up, +Z forward: atan2(vx, vz) is the yaw.
      const heading = Math.atan2(vx, vz);
      return { vx, vz, heading };
    }
  }
}

/**
 * Return the signed shortest delta between `current` and `target`
 * angles in radians. Output is always in `(-π, π]`.
 */
export function shortestAngleDelta(current: number, target: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}
