/**
 * Persistence utility for Gunboat Raiders.
 *
 * Stores both settings (sfx / music volume) and save data (level, best
 * wave, best score) together under a single JSON blob keyed by
 * `gr_state_v1`. Every read/write is wrapped in try/catch so localStorage
 * problems (disabled storage, quota exceeded, malformed JSON) never throw
 * into game code — they are logged and the caller gets `null` / a silent
 * no-op.
 *
 * Pattern mirrors the Firefly project's shape-validated save/load pattern
 * (see `D:/Projects/Firefly/src/game/PlayerState.ts:110`).
 */

/** localStorage key for the persisted state blob. */
export const STORAGE_KEY = 'gr_state_v1';

/** Persistent settings slice — volume is normalized [0, 1]. */
export interface PersistedSettings {
  sfxVolume: number;
  musicVolume: number;
}

/** Persistent save slice — progression and best results. */
export interface PersistedSave {
  currentLevelIndex: number;
  bestWave: number;
  bestScore: number;
}

/** Root shape written to localStorage under `STORAGE_KEY`. */
export interface PersistedState {
  settings: PersistedSettings;
  save: PersistedSave | null;
}

/**
 * Treats any non-null object as an indexable record. Safe at runtime; the
 * cast is the only way to narrow TypeScript's `object` type to something
 * we can key into.
 */
function asRecord(data: object): Record<string, unknown> {
  return data as Record<string, unknown>;
}

/**
 * Validates that `data` looks like a `PersistedSettings`. Both volumes
 * must be finite numbers — NaN / Infinity are rejected. Range is
 * validated here too: out-of-range values mean the blob is corrupt and
 * should not be trusted.
 */
function isPersistedSettingsShape(data: unknown): data is PersistedSettings {
  if (typeof data !== 'object' || data === null) return false;
  const d = asRecord(data);
  const sfx = d['sfxVolume'];
  const music = d['musicVolume'];
  if (typeof sfx !== 'number' || !Number.isFinite(sfx)) return false;
  if (typeof music !== 'number' || !Number.isFinite(music)) return false;
  if (sfx < 0 || sfx > 1) return false;
  if (music < 0 || music > 1) return false;
  return true;
}

/** Validates that `data` looks like a `PersistedSave`. */
function isPersistedSaveShape(data: unknown): data is PersistedSave {
  if (typeof data !== 'object' || data === null) return false;
  const d = asRecord(data);
  const level = d['currentLevelIndex'];
  const wave = d['bestWave'];
  const score = d['bestScore'];
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 0) return false;
  if (typeof wave !== 'number' || !Number.isInteger(wave) || wave < 0) return false;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return false;
  return true;
}

/**
 * Validates that `data` is a full `PersistedState`. `save` may be `null`
 * (no game started) but `settings` must always be present.
 */
function isPersistedStateShape(data: unknown): data is PersistedState {
  if (typeof data !== 'object' || data === null) return false;
  const d = asRecord(data);
  if (!isPersistedSettingsShape(d['settings'])) return false;
  const saveField = d['save'];
  if (saveField === null) return true;
  return isPersistedSaveShape(saveField);
}

/**
 * Returns the global `localStorage` if available, or `null` in headless
 * environments (Node / SSR / tests without a DOM). Accessing
 * `window.localStorage` can throw in restricted iframes, so we guard it.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch (err) {
    console.warn('[persistence] localStorage access failed:', err);
    return null;
  }
}

/**
 * Loads and validates the persisted state. Returns `null` when:
 *  - localStorage is unavailable
 *  - the key is missing
 *  - JSON parsing fails
 *  - the blob fails shape validation
 *
 * The caller is expected to fall back to defaults in all of these cases.
 */
export function loadPersisted(): PersistedState | null {
  const storage = getStorage();
  if (storage === null) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[persistence] loadPersisted getItem failed:', err);
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[persistence] loadPersisted JSON.parse failed:', err);
    return null;
  }

  if (!isPersistedStateShape(parsed)) {
    console.warn('[persistence] loadPersisted shape mismatch — ignoring blob');
    return null;
  }

  return parsed;
}

/**
 * Writes `state` to localStorage. Errors (quota exceeded, storage
 * disabled) are logged and swallowed — the game continues without
 * persistence.
 */
export function savePersisted(state: PersistedState): void {
  const storage = getStorage();
  if (storage === null) return;

  try {
    const serialized = JSON.stringify(state);
    storage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.warn('[persistence] savePersisted failed:', err);
  }
}

/** Removes the persisted blob from localStorage. Silent on failure. */
export function clearPersisted(): void {
  const storage = getStorage();
  if (storage === null) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[persistence] clearPersisted failed:', err);
  }
}
