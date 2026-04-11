/**
 * Unit tests for Slice R2 store extensions:
 *  - Phase enum rename (`'title'` → `'mainMenu'`) and new phases
 *    (`'briefing'`, `'paused'`).
 *  - New phase-flow actions: `pauseGame`, `resumeGame`, `openBriefing`,
 *    `startLevel`, `returnToMainMenu`.
 *  - Settings / save slices with localStorage persistence.
 *  - `usePlayerWeaponHeat` selector reading
 *    `player.weapons.heat` from the overheat mechanic slice.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useGameStore, type GamePhase, type SettingsSlice } from '@/store/gameStore';
import { STORAGE_KEY, type PersistedState } from '@/utils/persistence';

// ---------------------------------------------------------------------------
// In-memory Storage polyfill (Vitest runs in node — no window by default).
// ---------------------------------------------------------------------------

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

interface FakeWindow {
  localStorage: Storage;
}

let storage: MemoryStorage;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  storage = new MemoryStorage();
  const globalObj = globalThis as unknown as { window?: FakeWindow };
  globalObj.window = { localStorage: storage };

  // Silence audio/persistence warnings from deliberate failure tests.
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Restore store to a clean main-menu state. `resetGame()` deliberately
  // leaves settings / save alone (those are user-visible persistent
  // slices), so the test harness explicitly wipes them to default before
  // each case.
  useGameStore.getState().resetGame();
  useGameStore.setState({
    settings: { sfxVolume: 1, musicVolume: 1 },
    save: null,
  });
});

afterEach(() => {
  warnSpy.mockRestore();
  const globalObj = globalThis as unknown as { window?: FakeWindow };
  delete globalObj.window;
});

function getState() {
  return useGameStore.getState();
}

// ---------------------------------------------------------------------------
// Phase enum
// ---------------------------------------------------------------------------

describe('gameStore R2 — phase enum', () => {
  it('boots into mainMenu', () => {
    expect(getState().phase).toBe<GamePhase>('mainMenu');
  });

  it('accepts the new briefing phase via setPhase', () => {
    getState().setPhase('briefing');
    expect(getState().phase).toBe<GamePhase>('briefing');
  });

  it('accepts the new paused phase via setPhase', () => {
    getState().setPhase('paused');
    expect(getState().phase).toBe<GamePhase>('paused');
  });

  it('resetGame leaves phase in mainMenu (not the legacy title)', () => {
    getState().startGame();
    expect(getState().phase).toBe('playing');
    getState().resetGame();
    expect(getState().phase).toBe('mainMenu');
  });
});

// ---------------------------------------------------------------------------
// pauseGame / resumeGame
// ---------------------------------------------------------------------------

describe('gameStore R2 — pauseGame / resumeGame', () => {
  it('pauseGame transitions playing → paused', () => {
    getState().startGame();
    expect(getState().phase).toBe('playing');
    getState().pauseGame();
    expect(getState().phase).toBe('paused');
  });

  it('pauseGame transitions wave-clear → paused', () => {
    getState().startGame();
    getState().setPhase('wave-clear');
    getState().pauseGame();
    expect(getState().phase).toBe('paused');
  });

  it('pauseGame is a no-op in mainMenu', () => {
    getState().pauseGame();
    expect(getState().phase).toBe('mainMenu');
  });

  it('pauseGame is a no-op in game-over', () => {
    getState().setPhase('game-over');
    getState().pauseGame();
    expect(getState().phase).toBe('game-over');
  });

  it('resumeGame transitions paused → playing', () => {
    getState().startGame();
    getState().pauseGame();
    getState().resumeGame();
    expect(getState().phase).toBe('playing');
  });

  it('resumeGame is a no-op outside paused', () => {
    getState().startGame();
    getState().resumeGame();
    expect(getState().phase).toBe('playing');
  });
});

// ---------------------------------------------------------------------------
// openBriefing / startLevel / returnToMainMenu
// ---------------------------------------------------------------------------

describe('gameStore R2 — openBriefing', () => {
  it('stashes the level index and transitions to briefing', () => {
    getState().openBriefing(0);
    expect(getState().phase).toBe('briefing');
    expect(getState().briefingLevelIndex).toBe(0);

    getState().openBriefing(3);
    expect(getState().briefingLevelIndex).toBe(3);
  });
});

describe('gameStore R2 — startLevel', () => {
  it('atomically spawns the player and enters playing', () => {
    getState().addScore(999);
    getState().spawnEnemy('skiff', [0, 0, 50]);
    getState().openBriefing(0);

    getState().startLevel(0);

    const state = getState();
    expect(state.phase).toBe('playing');
    expect(state.player).not.toBeNull();
    expect(state.player?.id).toBe('player');
    expect(state.enemies.size).toBe(0);
    expect(state.score).toBe(0);
    expect(state.wave).toBe(1);
    expect(state.briefingLevelIndex).toBe(0);
  });

  it('remembers which level was started for subsequent save calls', () => {
    getState().startLevel(2);
    expect(getState().briefingLevelIndex).toBe(2);
  });
});

describe('gameStore R2 — returnToMainMenu', () => {
  it('tears down game state and returns to mainMenu', () => {
    getState().startGame();
    getState().spawnEnemy('barge', [0, 0, 50]);
    getState().addScore(500);

    getState().returnToMainMenu();

    const state = getState();
    expect(state.phase).toBe('mainMenu');
    expect(state.player).toBeNull();
    expect(state.enemies.size).toBe(0);
    expect(state.score).toBe(0);
    expect(state.wave).toBe(0);
  });

  it('preserves settings and save across the teardown', () => {
    getState().setSfxVolume(0.5);
    getState().saveAtLevel(0);
    expect(getState().save).not.toBeNull();

    getState().startGame();
    getState().returnToMainMenu();

    expect(getState().settings.sfxVolume).toBe(0.5);
    expect(getState().save).not.toBeNull();
    expect(getState().save?.currentLevelIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Settings slice + persistence
// ---------------------------------------------------------------------------

describe('gameStore R2 — settings', () => {
  it('defaults to sfxVolume=1, musicVolume=1 when nothing is persisted', () => {
    const settings: SettingsSlice = getState().settings;
    expect(settings.sfxVolume).toBe(1);
    expect(settings.musicVolume).toBe(1);
  });

  it('setSfxVolume clamps into [0, 1] and persists', () => {
    getState().setSfxVolume(0.3);
    expect(getState().settings.sfxVolume).toBe(0.3);

    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    if (raw === null) throw new Error('unreachable');
    const parsed = JSON.parse(raw) as PersistedState;
    expect(parsed.settings.sfxVolume).toBe(0.3);
  });

  it('setSfxVolume clamps negative values to 0', () => {
    getState().setSfxVolume(-0.5);
    expect(getState().settings.sfxVolume).toBe(0);
  });

  it('setSfxVolume clamps values > 1 to 1', () => {
    getState().setSfxVolume(5);
    expect(getState().settings.sfxVolume).toBe(1);
  });

  it('setMusicVolume updates and persists without audio side effects', () => {
    getState().setMusicVolume(0.2);
    expect(getState().settings.musicVolume).toBe(0.2);

    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) throw new Error('no persisted blob');
    const parsed = JSON.parse(raw) as PersistedState;
    expect(parsed.settings.musicVolume).toBe(0.2);
  });
});

// ---------------------------------------------------------------------------
// Save slice + persistence
// ---------------------------------------------------------------------------

describe('gameStore R2 — save', () => {
  it('defaults to null on a fresh store', () => {
    expect(getState().save).toBeNull();
  });

  it('saveAtLevel writes a save blob and persists it', () => {
    getState().startGame();
    getState().addScore(1200);

    getState().saveAtLevel(0);

    const save = getState().save;
    expect(save).not.toBeNull();
    expect(save?.currentLevelIndex).toBe(0);
    expect(save?.bestScore).toBe(1200);

    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) throw new Error('no persisted blob');
    const parsed = JSON.parse(raw) as PersistedState;
    expect(parsed.save).not.toBeNull();
    expect(parsed.save?.currentLevelIndex).toBe(0);
    expect(parsed.save?.bestScore).toBe(1200);
  });

  it('saveAtLevel rolls bestWave / bestScore forward monotonically', () => {
    getState().startGame();
    getState().addScore(2000);
    getState().advanceWave(); // wave: 2
    getState().advanceWave(); // wave: 3
    getState().saveAtLevel(0);

    expect(getState().save?.bestScore).toBe(2000);
    expect(getState().save?.bestWave).toBe(3);

    // Now play a worse run and save again — best-so-far must not regress.
    getState().startGame(); // wave=1, score=0
    getState().saveAtLevel(0);

    expect(getState().save?.bestScore).toBe(2000);
    expect(getState().save?.bestWave).toBe(3);
  });

  it('clearSave removes the save but preserves settings', () => {
    getState().setSfxVolume(0.25);
    getState().saveAtLevel(0);
    expect(getState().save).not.toBeNull();

    getState().clearSave();
    expect(getState().save).toBeNull();
    expect(getState().settings.sfxVolume).toBe(0.25);

    // The persisted blob should still exist (settings-only, save=null).
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) throw new Error('expected settings blob to persist');
    const parsed = JSON.parse(raw) as PersistedState;
    expect(parsed.save).toBeNull();
    expect(parsed.settings.sfxVolume).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------
// R18 — SaveSystem: `startLevel` is the save trigger for V1 because it's
// the single atomic entry point into a mission. Calling saveAtLevel at the
// tail of startLevel guarantees Continue is enabled the instant play
// begins, a reload lands on the same level, and replays idempotently
// refresh the save.
// ---------------------------------------------------------------------------

describe('gameStore R18 — startLevel writes a save checkpoint', () => {
  it('persists a save blob with the correct level index', () => {
    expect(getState().save).toBeNull();
    getState().startLevel(0);

    const save = getState().save;
    expect(save).not.toBeNull();
    expect(save?.currentLevelIndex).toBe(0);
    expect(save?.bestWave).toBe(1); // freshly reset wave
    expect(save?.bestScore).toBe(0);

    // Persisted to the expected localStorage key.
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) throw new Error('expected save blob to persist');
    const parsed = JSON.parse(raw) as PersistedState;
    expect(parsed.save).not.toBeNull();
    expect(parsed.save?.currentLevelIndex).toBe(0);
  });

  it('keeps best-so-far records monotonic across replays', () => {
    getState().startLevel(0);
    getState().addScore(2500);
    getState().advanceWave();
    getState().advanceWave();
    // Manual checkpoint with the new best values — simulates a later
    // save trigger (e.g. wave-clear, game-over, explicit exit).
    getState().saveAtLevel(0);
    expect(getState().save?.bestScore).toBe(2500);
    expect(getState().save?.bestWave).toBe(3);

    // Replay (PLAY AGAIN path): startLevel resets wave=1/score=0 and
    // re-saves. Records must not regress.
    getState().startLevel(0);
    expect(getState().save?.bestScore).toBe(2500);
    expect(getState().save?.bestWave).toBe(3);
    // But currentLevelIndex still points at the started level.
    expect(getState().save?.currentLevelIndex).toBe(0);
  });

  it('startLevel does not double-save (single persisted write per call)', () => {
    const setItemSpy = vi.spyOn(storage, 'setItem');
    getState().startLevel(0);
    // Every `setItem` invocation is a distinct persist. R18 wires a
    // single saveAtLevel call at the end of startLevel — so exactly
    // one persist should happen per startLevel invocation.
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
    setItemSpy.mockRestore();
  });
});

describe('gameStore R18 — save round-trip (save → clear)', () => {
  it('Continue predicate flips true after startLevel and false after clearSave', () => {
    // Mirror of the `useHasSave()` selector closure.
    const hasSave = () => getState().save !== null;

    expect(hasSave()).toBe(false);

    getState().startLevel(0);
    expect(hasSave()).toBe(true);

    getState().clearSave();
    expect(hasSave()).toBe(false);

    // localStorage still holds a settings-only blob (clearSave preserves
    // settings) — but with save === null.
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) throw new Error('expected settings-only blob to persist');
    const parsed = JSON.parse(raw) as PersistedState;
    expect(parsed.save).toBeNull();
  });

  it('startLevel → clearSave → startLevel rewrites the save', () => {
    getState().startLevel(0);
    expect(getState().save).not.toBeNull();

    getState().clearSave();
    expect(getState().save).toBeNull();

    getState().startLevel(0);
    expect(getState().save).not.toBeNull();
    expect(getState().save?.currentLevelIndex).toBe(0);
  });
});

describe('gameStore R18 — hydration from localStorage', () => {
  it('reloads a persisted save into the fresh store instance', async () => {
    // Seed localStorage with a known save blob BEFORE importing the
    // store module. `vi.resetModules()` throws away the cached module
    // graph so the hydration code in `gameStore.ts` runs again against
    // the seeded storage.
    const seeded: PersistedState = {
      settings: { sfxVolume: 0.7, musicVolume: 0.3 },
      save: { currentLevelIndex: 0, bestWave: 4, bestScore: 8_000 },
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(seeded));

    vi.resetModules();
    const mod = await import('@/store/gameStore');
    const hydrated = mod.useGameStore.getState();

    expect(hydrated.settings.sfxVolume).toBe(0.7);
    expect(hydrated.settings.musicVolume).toBe(0.3);
    expect(hydrated.save).not.toBeNull();
    expect(hydrated.save?.currentLevelIndex).toBe(0);
    expect(hydrated.save?.bestWave).toBe(4);
    expect(hydrated.save?.bestScore).toBe(8_000);
  });

  it('hydrates save=null when no blob is present', async () => {
    // No storage seed — module eval should fall back to defaults.
    vi.resetModules();
    const mod = await import('@/store/gameStore');
    const hydrated = mod.useGameStore.getState();

    expect(hydrated.save).toBeNull();
    expect(hydrated.settings.sfxVolume).toBe(1);
    expect(hydrated.settings.musicVolume).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// usePlayerWeaponHeat selector — reads the overheat mechanic field.
// ---------------------------------------------------------------------------

describe('selectors — usePlayerWeaponHeat', () => {
  it('returns 0 when there is no player', () => {
    // Use the non-hook accessor for headless tests.
    const heat = getState().player?.weapons.heat ?? 0;
    expect(heat).toBe(0);
  });

  it('reads the heat field from player.weapons after startGame', () => {
    getState().startGame();
    const player = getState().player;
    expect(player).not.toBeNull();
    // The overheat mechanic initializes heat to 0 on fresh spawn.
    expect(player?.weapons.heat).toBe(0);
    expect(player?.weapons.heatLockout).toBe(false);
  });

  it('reflects mutations to player.weapons.heat', () => {
    getState().startGame();
    const player = getState().player;
    if (player === null) throw new Error('player missing after startGame');

    useGameStore.setState({
      player: {
        ...player,
        weapons: { ...player.weapons, heat: 0.42 },
      },
    });

    expect(getState().player?.weapons.heat).toBe(0.42);
  });
});
