import { createSeededRandom } from './seededRandom';

export interface RockConfig {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  /** Index in [0, ROCK_VARIANT_COUNT) — selects which GLB model to render. */
  variant: number;
}

/**
 * Total number of distinct rock GLB models available.
 *
 * Matches the length of ROCK_MODEL_PATHS in src/utils/rockPreload.ts.
 * Currently 3 (the light-grey `rocks-sand-*` variants); the dark-grey
 * `rocks-a/b/c` variants were removed from the pool during the 2026-04-11
 * playtest because their colormap sampling reads as near-black.
 */
export const ROCK_VARIANT_COUNT = 3;

/** Maximum placement retries per rock before skipping. */
const MAX_RETRIES = 20;

/** Scale bounds per ring zone (inner rocks are smaller, outer rocks larger). */
const SCALE_MIN: [number, number, number] = [1.0, 0.8, 1.0];
const SCALE_MAX: [number, number, number] = [3.5, 2.5, 3.5];

/**
 * Generate deterministic rock positions for the arena.
 *
 * Uses a seeded PRNG so the same seed always produces the same layout.
 * Rocks are spread across three radial zones for even world coverage:
 *   - Inner ring:  safeZoneRadius → 40 % of arenaRadius
 *   - Mid ring:    40 % → 70 % of arenaRadius
 *   - Outer ring:  70 % → 100 % of arenaRadius
 *
 * Each zone gets roughly a third of the requested count, which breaks up
 * the single-cluster appearance from a pure random annular distribution.
 *
 * Each rock is assigned a `variant` (0–ROCK_VARIANT_COUNT-1) so the caller
 * can render a different GLB model per rock.
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

  // Divide rocks evenly across three concentric rings.
  const innerEnd = safeZoneRadius + (arenaRadius - safeZoneRadius) * 0.35;
  const midEnd = safeZoneRadius + (arenaRadius - safeZoneRadius) * 0.7;
  const outerEnd = arenaRadius;

  const rings: [number, number][] = [
    [safeZoneRadius, innerEnd],
    [innerEnd, midEnd],
    [midEnd, outerEnd],
  ];

  // Distribute count across rings (last ring gets the remainder).
  const perRing = Math.floor(count / rings.length);
  const ringCounts = rings.map((_, i) =>
    i < rings.length - 1 ? perRing : count - perRing * (rings.length - 1),
  );

  for (let ringIdx = 0; ringIdx < rings.length; ringIdx++) {
    const ring = rings[ringIdx];
    const ringCount = ringCounts[ringIdx];
    if (!ring || ringCount === undefined) continue;
    const [ringMin, ringMax] = ring;

    for (let i = 0; i < ringCount; i++) {
      let placed = false;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const angle = rng() * TWO_PI;
        const radius = ringMin + rng() * (ringMax - ringMin);

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Enforce minimum spacing against all already-placed rocks.
        const tooClose = rocks.some((other) => {
          const dx = other.position[0] - x;
          const dz = other.position[2] - z;
          return dx * dx + dz * dz < minSpacing * minSpacing;
        });

        if (!tooClose) {
          // Scale: outer rings get larger rocks on average.
          const ringFraction = (ringIdx + 1) / rings.length;
          const maxScaleX =
            SCALE_MIN[0] + (SCALE_MAX[0] - SCALE_MIN[0]) * (0.4 + ringFraction * 0.6);
          const maxScaleY =
            SCALE_MIN[1] + (SCALE_MAX[1] - SCALE_MIN[1]) * (0.4 + ringFraction * 0.6);
          const maxScaleZ =
            SCALE_MIN[2] + (SCALE_MAX[2] - SCALE_MIN[2]) * (0.4 + ringFraction * 0.6);

          const scaleX = SCALE_MIN[0] + rng() * (maxScaleX - SCALE_MIN[0]);
          const scaleY = SCALE_MIN[1] + rng() * (maxScaleY - SCALE_MIN[1]);
          const scaleZ = SCALE_MIN[2] + rng() * (maxScaleZ - SCALE_MIN[2]);

          // Rocks are grounded on the seabed -- only yaw (Y-axis) varies.
          // Roll (X) and pitch (Z) must stay at 0 so rocks sit level; the
          // Kenney models are modelled upright and look wrong when tilted.
          const rotY = rng() * TWO_PI;

          const variant = Math.floor(rng() * ROCK_VARIANT_COUNT);

          rocks.push({
            position: [x, 0, z],
            scale: [scaleX, scaleY, scaleZ],
            rotation: [0, rotY, 0],
            variant,
          });
          placed = true;
          break;
        }
      }

      // If placement failed after MAX_RETRIES, skip this rock.
      if (!placed) continue;
    }
  }

  return rocks;
}
