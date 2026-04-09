import { createSeededRandom } from './seededRandom';

export interface RockConfig {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
}

/** Maximum placement retries per rock before skipping. */
const MAX_RETRIES = 10;

/** Scale bounds: min [1.5, 2, 1.5], max [4, 6, 4]. */
const SCALE_MIN: [number, number, number] = [1.5, 2, 1.5];
const SCALE_MAX: [number, number, number] = [4, 6, 4];

/**
 * Generate deterministic rock positions for the arena.
 *
 * Uses a seeded PRNG so the same seed always produces the same layout.
 * Rocks are placed in an annular ring between safeZoneRadius and arenaRadius,
 * with a minimum spacing constraint to prevent overlaps.
 */
export function generateRockPositions(
  seed: number,
  count: number,
  arenaRadius: number,
  safeZoneRadius: number,
  minSpacing: number,
): RockConfig[] {
  if (count <= 0) return [];

  const rng = createSeededRandom(seed);
  const rocks: RockConfig[] = [];
  const TWO_PI = Math.PI * 2;

  for (let i = 0; i < count; i++) {
    let placed = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const angle = rng() * TWO_PI;
      const radius = safeZoneRadius + rng() * (arenaRadius - safeZoneRadius);

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Check minimum spacing against all previously placed rocks
      const tooClose = rocks.some((other) => {
        const dx = other.position[0] - x;
        const dz = other.position[2] - z;
        return dx * dx + dz * dz < minSpacing * minSpacing;
      });

      if (!tooClose) {
        const scaleX = SCALE_MIN[0] + rng() * (SCALE_MAX[0] - SCALE_MIN[0]);
        const scaleY = SCALE_MIN[1] + rng() * (SCALE_MAX[1] - SCALE_MIN[1]);
        const scaleZ = SCALE_MIN[2] + rng() * (SCALE_MAX[2] - SCALE_MIN[2]);

        const rotX = rng() * TWO_PI;
        const rotY = rng() * TWO_PI;
        const rotZ = rng() * TWO_PI;

        rocks.push({
          position: [x, 0, z],
          scale: [scaleX, scaleY, scaleZ],
          rotation: [rotX, rotY, rotZ],
        });
        placed = true;
        break;
      }
    }

    // If we couldn't place after MAX_RETRIES, skip this rock
    if (!placed) continue;
  }

  return rocks;
}
