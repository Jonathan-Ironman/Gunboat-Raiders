/**
 * Pure damage logic -- armor/hull model, splash damage, armor regeneration.
 * No R3F, no browser APIs, fully headless-testable.
 */

export interface DamageInput {
  currentArmor: number;
  currentHull: number;
  incomingDamage: number;
}

export interface DamageResult {
  newArmor: number;
  newHull: number;
  armorDamageDealt: number;
  hullDamageDealt: number;
  isSunk: boolean;
}

/**
 * Apply damage: armor absorbs first, overflow goes to hull.
 * Returns new health values and whether the target is sunk.
 */
export function calculateDamage(input: DamageInput): DamageResult {
  const armorDamageDealt = Math.min(input.currentArmor, input.incomingDamage);
  const overflow = input.incomingDamage - armorDamageDealt;
  const hullDamageDealt = Math.min(input.currentHull, overflow);
  const newArmor = input.currentArmor - armorDamageDealt;
  const newHull = input.currentHull - hullDamageDealt;
  return {
    newArmor,
    newHull,
    armorDamageDealt,
    hullDamageDealt,
    isSunk: newHull <= 0,
  };
}

/**
 * Compute splash damage for entities within radius of impact point.
 * Damage attenuates linearly with distance. Excludes the projectile owner.
 */
export function calculateSplashDamage(
  impactPosition: [number, number, number],
  targets: Array<{ id: string; position: [number, number, number] }>,
  splashDamage: number,
  splashRadius: number,
  ownerId: string,
): Array<{ id: string; damage: number }> {
  const results: Array<{ id: string; damage: number }> = [];

  for (const target of targets) {
    // Skip the projectile owner
    if (target.id === ownerId) continue;

    const dx = target.position[0] - impactPosition[0];
    const dy = target.position[1] - impactPosition[1];
    const dz = target.position[2] - impactPosition[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance >= splashRadius) continue;

    // Linear attenuation: full damage at center, zero at edge
    const attenuation = 1 - distance / splashRadius;
    const damage = splashDamage * attenuation;

    if (damage > 0) {
      results.push({ id: target.id, damage });
    }
  }

  return results;
}

/**
 * Compute armor regeneration for one frame.
 * Returns the new armor value, clamped to armorMax.
 */
export function regenArmor(
  currentArmor: number,
  armorMax: number,
  regenRate: number,
  delta: number,
): number {
  return Math.min(armorMax, currentArmor + regenRate * delta);
}
