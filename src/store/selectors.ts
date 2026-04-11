import { useGameStore } from './gameStore';

/** Player health component (null when no player spawned). */
export const usePlayerHealth = () => useGameStore((s) => s.player?.health ?? null);

/** Current wave number. */
export const useWaveNumber = () => useGameStore((s) => s.wave);

/** Current score. */
export const useScore = () => useGameStore((s) => s.score);

/** Current game phase. */
export const useGamePhase = () => useGameStore((s) => s.phase);

/** Number of enemies remaining in current wave. */
export const useEnemiesRemaining = () => useGameStore((s) => s.enemiesRemaining);

/** Total enemies sunk across all waves. */
export const useEnemiesSunkTotal = () => useGameStore((s) => s.enemiesSunkTotal);

// ---- R2 — persisted slices + phase flow ----

/** Full settings slice (sfxVolume, musicVolume). */
export const useSettings = () => useGameStore((s) => s.settings);

/** Persistent save slice, or `null` when no save exists. */
export const useSave = () => useGameStore((s) => s.save);

/** True if a persistent save is present — drives main menu Continue button. */
export const useHasSave = () => useGameStore((s) => s.save !== null);

/** Currently staged level index for the briefing modal. */
export const useBriefingLevelIndex = () => useGameStore((s) => s.briefingLevelIndex);

/**
 * Player weapon overheat value in [0, 1]. Returns 0 when there is no
 * player (main menu, briefing). Reads the `heat` field added by the
 * overheat mechanic slice at `player.weapons.heat`.
 */
export const usePlayerWeaponHeat = () => useGameStore((s) => s.player?.weapons.heat ?? 0);
