/**
 * Pure weapon logic — cooldown management, overheat mechanic, and fire
 * data computation. No R3F, no browser APIs, fully headless-testable.
 */

import type { FiringQuadrant, WeaponMount } from '@/store/gameStore';
import {
  HEAT_COOLDOWN_MULT_GREEN,
  HEAT_COOLDOWN_MULT_RED,
  HEAT_COOLDOWN_MULT_YELLOW,
  HEAT_DECAY_PER_SECOND,
  HEAT_GREEN_MAX,
  HEAT_LOCKOUT_RECOVERY_THRESHOLD,
  HEAT_LOCKOUT_THRESHOLD,
  HEAT_PER_SHOT,
  HEAT_YELLOW_MAX,
} from '@/utils/overheatConstants';

export interface WeaponState {
  cooldownRemaining: Record<FiringQuadrant, number>;
  cooldown: number;
}

/** Tick all quadrant cooldowns by delta time, clamping to zero. */
export function tickCooldowns(state: WeaponState, delta: number): WeaponState {
  return {
    ...state,
    cooldownRemaining: {
      fore: Math.max(0, state.cooldownRemaining.fore - delta),
      aft: Math.max(0, state.cooldownRemaining.aft - delta),
      port: Math.max(0, state.cooldownRemaining.port - delta),
      starboard: Math.max(0, state.cooldownRemaining.starboard - delta),
    },
  };
}

/**
 * Check if a quadrant can fire.
 *
 * Returns true only when the quadrant's cooldown has fully elapsed (≤ 0).
 * Per-quadrant cooldown of 150 ms (× heat bracket multiplier) gives the
 * player a consistent, spammable fire rate that gets progressively
 * penalised as heat climbs.
 */
export function canFire(state: WeaponState, quadrant: FiringQuadrant): boolean {
  return state.cooldownRemaining[quadrant] <= 0;
}

// ---------------------------------------------------------------------------
// Overheat (shared across all quadrants)
// ---------------------------------------------------------------------------

/**
 * Immutable heat sub-state. Kept separate from `WeaponState` so the
 * cooldown helpers above stay pure and the heat model can be ticked
 * independently (the R3F wrapper ticks both each frame).
 */
export interface HeatState {
  /** Current heat in [0, 1]. */
  heat: number;
  /**
   * Sticky lockout flag. Set to true when heat hits
   * `HEAT_LOCKOUT_THRESHOLD`; cleared when heat drops back below
   * `HEAT_LOCKOUT_RECOVERY_THRESHOLD`. Prevents single-frame chatter at
   * the cap.
   */
  lockedOut: boolean;
}

/**
 * Returns the cooldown multiplier that applies at a given heat value.
 * The multiplier is applied to the base per-quadrant cooldown on the
 * FRAME A SHOT IS FIRED — so the next shot's wait is governed by the
 * heat bracket at fire time.
 */
export function heatBracketCooldownMultiplier(heat: number): number {
  if (heat < HEAT_GREEN_MAX) return HEAT_COOLDOWN_MULT_GREEN;
  if (heat < HEAT_YELLOW_MAX) return HEAT_COOLDOWN_MULT_YELLOW;
  return HEAT_COOLDOWN_MULT_RED;
}

/**
 * Compute the next-frame lockout flag given current heat and the
 * previous-frame flag. Lockout is sticky: once engaged, it clears only
 * when heat has cooled past `HEAT_LOCKOUT_RECOVERY_THRESHOLD`.
 */
export function nextLockout(heat: number, previouslyLocked: boolean): boolean {
  if (heat >= HEAT_LOCKOUT_THRESHOLD) return true;
  if (previouslyLocked) return heat > HEAT_LOCKOUT_RECOVERY_THRESHOLD;
  return false;
}

/**
 * Whether firing is permitted at this heat + lockout state.
 * Firing is blocked whenever the sticky lockout flag is set.
 */
export function isFireAllowedByHeat(state: HeatState): boolean {
  return !state.lockedOut;
}

/**
 * Apply a single shot's worth of heat to the shared heat pool. Clamps
 * the result to [0, 1] and recomputes the sticky lockout flag.
 */
export function applyShotHeat(state: HeatState): HeatState {
  const raw = state.heat + HEAT_PER_SHOT;
  const heat = raw > 1 ? 1 : raw;
  return { heat, lockedOut: nextLockout(heat, state.lockedOut) };
}

/**
 * Decay heat by `HEAT_DECAY_PER_SECOND * delta`. Clamps to zero and
 * recomputes the sticky lockout flag (which may clear once heat crosses
 * `HEAT_LOCKOUT_RECOVERY_THRESHOLD` from above).
 */
export function decayHeat(state: HeatState, delta: number): HeatState {
  const raw = state.heat - HEAT_DECAY_PER_SECOND * delta;
  const heat = raw < 0 ? 0 : raw;
  return { heat, lockedOut: nextLockout(heat, state.lockedOut) };
}

/** Data for spawning a single projectile. */
export interface ProjectileSpawn {
  position: [number, number, number];
  impulse: [number, number, number];
}

/**
 * Compute projectile spawn positions and impulses for all mounts in the
 * given quadrant. Transforms each mount's local offset and direction to
 * world space using the boat's quaternion.
 *
 * @param mounts - All weapon mounts on the boat
 * @param quadrant - Which quadrant is firing
 * @param boatPosition - Boat world position [x, y, z]
 * @param boatRotation - Boat world rotation as quaternion [x, y, z, w]
 * @param muzzleVelocity - Speed of the projectile
 * @param elevationAngle - Upward angle in radians added to the fire direction
 * @returns Array of spawn data for each mount in the quadrant
 */
export function computeFireData(
  mounts: readonly WeaponMount[],
  quadrant: FiringQuadrant,
  boatPosition: [number, number, number],
  boatRotation: [number, number, number, number],
  muzzleVelocity: number,
  elevationAngle: number,
): ProjectileSpawn[] {
  const quadrantMounts = mounts.filter((m) => m.quadrant === quadrant);
  const [qx, qy, qz, qw] = boatRotation;

  return quadrantMounts.map((mount) => {
    // Transform local offset to world space using quaternion rotation
    const worldOffset = rotateByQuaternion(mount.localOffset, qx, qy, qz, qw);
    const position: [number, number, number] = [
      boatPosition[0] + worldOffset[0],
      boatPosition[1] + worldOffset[1],
      boatPosition[2] + worldOffset[2],
    ];

    // Transform local direction to world space
    const worldDir = rotateByQuaternion(mount.localDirection, qx, qy, qz, qw);

    // Normalize the horizontal component and add elevation
    const hLen = Math.sqrt(worldDir[0] * worldDir[0] + worldDir[2] * worldDir[2]);
    let dirX: number;
    let dirY: number;
    let dirZ: number;

    if (hLen > 0.0001) {
      const cosElev = Math.cos(elevationAngle);
      const sinElev = Math.sin(elevationAngle);
      dirX = (worldDir[0] / hLen) * cosElev;
      dirY = sinElev;
      dirZ = (worldDir[2] / hLen) * cosElev;
    } else {
      // Degenerate case: direction is purely vertical
      dirX = 0;
      dirY = 1;
      dirZ = 0;
    }

    const impulse: [number, number, number] = [
      dirX * muzzleVelocity,
      dirY * muzzleVelocity,
      dirZ * muzzleVelocity,
    ];

    return { position, impulse };
  });
}

/**
 * Rotate a vector by a quaternion: v' = q * v * q^-1
 * Optimized formula without constructing full quaternion multiplication.
 */
function rotateByQuaternion(
  v: readonly [number, number, number],
  qx: number,
  qy: number,
  qz: number,
  qw: number,
): [number, number, number] {
  const [vx, vy, vz] = v;

  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);

  // result = v + w * t + cross(q.xyz, t)
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}
