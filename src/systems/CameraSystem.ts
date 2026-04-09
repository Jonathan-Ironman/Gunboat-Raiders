/**
 * Pure camera logic — quadrant detection based on camera vs boat heading.
 * No R3F, no browser APIs, fully headless-testable.
 */

import type { FiringQuadrant } from '@/store/gameStore';

/**
 * Compute which firing quadrant is active based on camera direction
 * relative to boat heading.
 *
 * @param cameraAzimuth - camera orbit angle in radians (world space)
 * @param boatHeading - boat forward direction angle in radians (world space)
 * @returns the active firing quadrant
 */
export function computeQuadrant(cameraAzimuth: number, boatHeading: number): FiringQuadrant {
  let relative = cameraAzimuth - boatHeading;
  // Normalize to -PI..PI
  while (relative > Math.PI) relative -= 2 * Math.PI;
  while (relative < -Math.PI) relative += 2 * Math.PI;

  if (relative > -Math.PI / 4 && relative <= Math.PI / 4) return 'fore';
  if (relative > Math.PI / 4 && relative <= (3 * Math.PI) / 4) return 'starboard';
  if (relative > (-3 * Math.PI) / 4 && relative <= -Math.PI / 4) return 'port';
  return 'aft';
}
