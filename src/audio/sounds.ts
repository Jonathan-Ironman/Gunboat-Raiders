/**
 * Sound definitions for the game.
 *
 * Each entry maps a logical sound name to its configuration.
 * Audio files are expected in public/audio/ — if missing, AudioManager
 * handles the error gracefully without crashing.
 */

export interface SoundConfig {
  readonly src: readonly string[];
  readonly volume: number;
  readonly pool: number;
  readonly loop?: boolean | undefined;
}

export const SOUNDS = {
  cannon_fire: {
    src: ['/audio/cannon.mp3'],
    volume: 0.7,
    pool: 10,
  },
  explosion: {
    src: ['/audio/explosion.mp3'],
    volume: 0.8,
    pool: 5,
  },
  splash: {
    src: ['/audio/splash.mp3'],
    volume: 0.5,
    pool: 8,
  },
  engine_hum: {
    src: ['/audio/engine.mp3'],
    volume: 0.3,
    pool: 1,
    loop: true,
  },
  ambient: {
    src: ['/audio/ocean-ambient.mp3'],
    volume: 0.2,
    pool: 1,
    loop: true,
  },
} as const satisfies Record<string, SoundConfig>;

export type SoundName = keyof typeof SOUNDS;
