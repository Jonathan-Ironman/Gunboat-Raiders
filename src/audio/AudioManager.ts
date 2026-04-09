/**
 * Audio manager — Howler.js setup with pooling and graceful failure.
 *
 * Wraps Howler.js to provide simple play/stop/position API.
 * All errors (missing files, blocked audio context) are caught
 * and logged without crashing the game.
 */

import { Howl, Howler } from 'howler';
import { SOUNDS, type SoundConfig, type SoundName } from './sounds';

/** Map of loaded Howl instances keyed by sound name. */
const howls = new Map<SoundName, Howl>();

/** Whether the manager has been initialized. */
let initialized = false;

/** Whether audio loading failed (missing files etc). */
const loadFailed = new Set<SoundName>();

/**
 * Initialize all sounds. Call once at app startup.
 * Fails gracefully — missing audio files are logged but don't crash.
 */
function init(): void {
  if (initialized) return;
  initialized = true;

  // Iterate all sound keys explicitly to preserve type safety
  const soundNames = Object.keys(SOUNDS) as SoundName[];
  for (const soundName of soundNames) {
    const config: SoundConfig = SOUNDS[soundName];
    try {
      const howl = new Howl({
        src: [...config.src],
        volume: config.volume,
        loop: config.loop ?? false,
        preload: true,
        pool: config.pool,
        onloaderror: (_id: number, error: unknown) => {
          loadFailed.add(soundName);
          console.warn(`[AudioManager] Failed to load "${soundName}":`, error);
        },
      });
      howls.set(soundName, howl);
    } catch (err) {
      loadFailed.add(soundName);
      console.warn(`[AudioManager] Error creating Howl for "${soundName}":`, err);
    }
  }
}

/**
 * Play a sound by name, optionally at a 3D position.
 * Returns the Howler sound ID, or -1 if the sound couldn't play.
 */
function play(name: SoundName, position?: [number, number, number]): number {
  if (!initialized) init();

  const howl = howls.get(name);
  if (!howl || loadFailed.has(name)) return -1;

  try {
    const id = howl.play();

    if (position) {
      howl.pos(position[0], position[1], position[2], id);
    }

    return id;
  } catch (err) {
    console.warn(`[AudioManager] Error playing "${name}":`, err);
    return -1;
  }
}

/**
 * Stop a specific sound or all instances of a named sound.
 */
function stop(name: SoundName, id?: number): void {
  const howl = howls.get(name);
  if (!howl) return;

  try {
    if (id !== undefined) {
      howl.stop(id);
    } else {
      howl.stop();
    }
  } catch {
    // Silently ignore stop errors
  }
}

/**
 * Update the global listener position (the player's "ears").
 * Call each frame from the camera/player system.
 */
function setListenerPosition(x: number, y: number, z: number): void {
  try {
    Howler.pos(x, y, z);
  } catch {
    // Silently ignore listener position errors
  }
}

/**
 * Set master volume (0.0 to 1.0).
 */
function setMasterVolume(volume: number): void {
  try {
    Howler.volume(volume);
  } catch {
    // Silently ignore volume errors
  }
}

/**
 * Clean up all sounds. Call on unmount.
 */
function dispose(): void {
  for (const howl of howls.values()) {
    try {
      howl.unload();
    } catch {
      // Silently ignore unload errors
    }
  }
  howls.clear();
  loadFailed.clear();
  initialized = false;
}

export const AudioManager = {
  init,
  play,
  stop,
  setListenerPosition,
  setMasterVolume,
  dispose,
} as const;
