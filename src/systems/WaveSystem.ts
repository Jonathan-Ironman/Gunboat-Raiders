/**
 * Pure wave logic — wave config generation, spawn positions, scoring.
 * No R3F, no browser APIs, fully headless-testable.
 */

import type { EnemyType } from '@/store/gameStore';
import { createSeededRandom } from '@/utils/seededRandom';

// ---- Types ----

export interface WaveConfig {
  waveNumber: number;
  enemies: Array<{
    type: EnemyType;
    count: number;
    spawnDelay: number; // seconds after wave start before this group spawns
  }>;
}

// ---- Score Constants ----

export const SCORE = {
  SKIFF_SUNK: 100,
  BARGE_SUNK: 250,
  WAVE_SURVIVED: 500,
} as const;

// ---- Pure Functions ----

/**
 * Generate wave config for a given wave number.
 * Difficulty scales with wave number:
 * - Wave 1: 2 skiffs
 * - Wave 2: 3 skiffs
 * - Wave 3: 4 skiffs
 * - Wave 4+: waveNumber + 1 skiffs, capped at 8
 * - Barges introduced at wave 5 (1 barge), +1 every 3 waves after, capped at 3
 */
export function generateWaveConfig(waveNumber: number): WaveConfig {
  const skiffCount = Math.min(waveNumber + 1, 8);
  const bargeCount = waveNumber >= 5 ? Math.min(1 + Math.floor((waveNumber - 5) / 3), 3) : 0;

  const enemies: WaveConfig['enemies'] = [{ type: 'skiff', count: skiffCount, spawnDelay: 0 }];

  if (bargeCount > 0) {
    enemies.push({ type: 'barge', count: bargeCount, spawnDelay: 2 });
  }

  return { waveNumber, enemies };
}

/**
 * Generate deterministic spawn positions for a wave.
 * Enemies spawn within a ring (minRadius to maxRadius) from center,
 * evenly distributed around a circle with small random jitter.
 * Y is always 0 (buoyancy handles vertical positioning).
 */
export function generateSpawnPositions(
  count: number,
  seed: number,
  minRadius: number = 80,
  maxRadius: number = 120,
): Array<[number, number, number]> {
  if (count <= 0) return [];

  const rng = createSeededRandom(seed);
  const positions: Array<[number, number, number]> = [];
  const angleStep = (2 * Math.PI) / count;

  for (let i = 0; i < count; i++) {
    // Base angle evenly spaced, with random jitter up to half the step
    const jitter = (rng() - 0.5) * angleStep * 0.5;
    const angle = angleStep * i + jitter;

    // Random radius within the ring
    const radius = minRadius + rng() * (maxRadius - minRadius);

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    positions.push([x, 0, z]);
  }

  return positions;
}

/**
 * Calculate score for sinking an enemy.
 */
export function scoreForEnemy(type: EnemyType): number {
  return type === 'barge' ? SCORE.BARGE_SUNK : SCORE.SKIFF_SUNK;
}
