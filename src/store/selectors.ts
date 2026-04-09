import { useGameStore } from './gameStore';

/** Player health component (null when no player spawned). */
export const usePlayerHealth = () => useGameStore((s) => s.player?.health ?? null);

/** Current wave number. */
export const useWaveNumber = () => useGameStore((s) => s.wave);

/** Current score. */
export const useScore = () => useGameStore((s) => s.score);

/** Currently active firing quadrant. */
export const useActiveQuadrant = () => useGameStore((s) => s.activeQuadrant);

/** Current game phase. */
export const useGamePhase = () => useGameStore((s) => s.phase);

/** Number of enemies remaining in current wave. */
export const useEnemiesRemaining = () => useGameStore((s) => s.enemiesRemaining);

/** Total enemies sunk across all waves. */
export const useEnemiesSunkTotal = () => useGameStore((s) => s.enemiesSunkTotal);
