import type { FiringQuadrant } from '../store/gameStore';

/**
 * Normalizes an angle to the range [-PI, PI].
 */
export function normalizeAngle(angle: number): number {
  return ((angle + Math.PI) % (2 * Math.PI)) - Math.PI;
}

/**
 * Determines which firing quadrant is active based on the camera angle
 * relative to the boat heading.
 *
 * @param cameraAngle - World-space camera yaw in radians
 * @param boatHeading - World-space boat heading in radians
 * @returns The active firing quadrant
 */
export function getQuadrant(cameraAngle: number, boatHeading: number): FiringQuadrant {
  const relative = normalizeAngle(cameraAngle - boatHeading);

  if (relative > -Math.PI / 4 && relative <= Math.PI / 4) return 'fore';
  if (relative > Math.PI / 4 && relative <= (3 * Math.PI) / 4) return 'starboard';
  if (relative > (-3 * Math.PI) / 4 && relative <= -Math.PI / 4) return 'port';
  return 'aft';
}

/**
 * Linearly interpolates between a and b by t.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamps a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts degrees to radians.
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees.
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Returns the 2D distance between two points (ignoring Y).
 */
export function distance2D(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}
