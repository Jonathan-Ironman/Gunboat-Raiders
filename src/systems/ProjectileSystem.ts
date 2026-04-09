/**
 * Pure projectile logic — lifetime management.
 * No R3F, no browser APIs, fully headless-testable.
 */

export interface ProjectileLifetimeData {
  spawnTime: number;
  maxLifetime: number;
}

/**
 * Check which projectiles have exceeded their lifetime.
 *
 * @param projectiles - Map of projectile id to lifetime data
 * @param currentTime - Current elapsed time in seconds
 * @returns Array of projectile ids that have expired
 */
export function getExpiredProjectiles(
  projectiles: Map<string, ProjectileLifetimeData>,
  currentTime: number,
): string[] {
  const expired: string[] = [];
  for (const [id, data] of projectiles) {
    if (currentTime - data.spawnTime >= data.maxLifetime) {
      expired.push(id);
    }
  }
  return expired;
}
