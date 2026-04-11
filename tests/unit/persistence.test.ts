/**
 * Unit tests for `src/utils/persistence.ts`.
 *
 * Vitest runs in a Node environment, so `window.localStorage` does not
 * exist by default. These tests install a minimal in-memory Storage
 * polyfill on `globalThis.window` before each test so the persistence
 * utility exercises its real code path (including its try/catch safety
 * nets).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  clearPersisted,
  loadPersisted,
  savePersisted,
  STORAGE_KEY,
  type PersistedState,
} from '@/utils/persistence';

// ---------------------------------------------------------------------------
// Minimal in-memory Storage polyfill (good enough for `getItem` / `setItem`
// / `removeItem` — the only methods the utility uses).
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

function installFakeWindow(): MemoryStorage {
  const storage = new MemoryStorage();
  const globalObj = globalThis as unknown as { window?: FakeWindow };
  globalObj.window = { localStorage: storage };
  return storage;
}

function uninstallFakeWindow(): void {
  const globalObj = globalThis as unknown as { window?: FakeWindow };
  delete globalObj.window;
}

const VALID_STATE: PersistedState = {
  settings: { sfxVolume: 0.6, musicVolume: 0.4 },
  save: { currentLevelIndex: 2, bestWave: 7, bestScore: 15_000 },
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  installFakeWindow();
  // Silence expected `console.warn` noise from the negative-path tests.
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  uninstallFakeWindow();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('persistence — round-trip', () => {
  it('writes a full state blob and reads it back unchanged', () => {
    savePersisted(VALID_STATE);
    const loaded = loadPersisted();
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(VALID_STATE);
  });

  it('supports a settings-only blob (save=null)', () => {
    const settingsOnly: PersistedState = {
      settings: { sfxVolume: 1, musicVolume: 0 },
      save: null,
    };
    savePersisted(settingsOnly);
    const loaded = loadPersisted();
    expect(loaded).toEqual(settingsOnly);
  });

  it('uses the STORAGE_KEY literal', () => {
    expect(STORAGE_KEY).toBe('gr_state_v1');
    savePersisted(VALID_STATE);
    const raw = globalThis.window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Shape-validation failure paths
// ---------------------------------------------------------------------------

describe('persistence — shape validation', () => {
  it('returns null when the blob is missing the settings field', () => {
    globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ save: null }));
    expect(loadPersisted()).toBeNull();
  });

  it('returns null when a volume is NaN', () => {
    globalThis.window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: { sfxVolume: Number.NaN, musicVolume: 0 },
        save: null,
      }),
    );
    expect(loadPersisted()).toBeNull();
  });

  it('returns null when a volume is out of range (> 1)', () => {
    globalThis.window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: { sfxVolume: 1.5, musicVolume: 0.2 },
        save: null,
      }),
    );
    expect(loadPersisted()).toBeNull();
  });

  it('returns null when save.currentLevelIndex is non-integer', () => {
    globalThis.window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: { sfxVolume: 0.5, musicVolume: 0.5 },
        save: { currentLevelIndex: 1.25, bestWave: 0, bestScore: 0 },
      }),
    );
    expect(loadPersisted()).toBeNull();
  });

  it('returns null when save.bestScore is negative', () => {
    globalThis.window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: { sfxVolume: 0.5, musicVolume: 0.5 },
        save: { currentLevelIndex: 0, bestWave: 0, bestScore: -1 },
      }),
    );
    expect(loadPersisted()).toBeNull();
  });

  it('returns null when the JSON itself is malformed', () => {
    globalThis.window.localStorage.setItem(STORAGE_KEY, 'not json {{');
    expect(loadPersisted()).toBeNull();
  });

  it('returns null when the key is missing', () => {
    expect(loadPersisted()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearPersisted
// ---------------------------------------------------------------------------

describe('persistence — clearPersisted', () => {
  it('removes the blob so loadPersisted returns null', () => {
    savePersisted(VALID_STATE);
    expect(loadPersisted()).toEqual(VALID_STATE);
    clearPersisted();
    expect(loadPersisted()).toBeNull();
  });

  it('is a silent no-op when no blob exists', () => {
    expect(() => {
      clearPersisted();
    }).not.toThrow();
    expect(loadPersisted()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Storage unavailable (no `window`)
// ---------------------------------------------------------------------------

describe('persistence — headless (no window)', () => {
  beforeEach(() => {
    uninstallFakeWindow();
  });

  it('loadPersisted returns null without throwing', () => {
    expect(loadPersisted()).toBeNull();
  });

  it('savePersisted is a silent no-op without throwing', () => {
    expect(() => {
      savePersisted(VALID_STATE);
    }).not.toThrow();
  });

  it('clearPersisted is a silent no-op without throwing', () => {
    expect(() => {
      clearPersisted();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Storage throws (quota / disabled)
// ---------------------------------------------------------------------------

describe('persistence — storage failures', () => {
  it('savePersisted swallows errors thrown by setItem', () => {
    const failing: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    const globalObj = globalThis as unknown as { window?: FakeWindow };
    globalObj.window = { localStorage: failing };

    expect(() => {
      savePersisted(VALID_STATE);
    }).not.toThrow();
  });

  it('loadPersisted swallows errors thrown by getItem', () => {
    const failing: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => {
        throw new Error('storage disabled');
      },
      key: () => null,
      removeItem: () => {},
      setItem: () => {},
    };
    const globalObj = globalThis as unknown as { window?: FakeWindow };
    globalObj.window = { localStorage: failing };

    expect(loadPersisted()).toBeNull();
  });
});
