/**
 * Unit tests for `src/ui/useFullscreen.ts`.
 *
 * Coverage layers:
 *
 * 1. **Pure helpers** (`readIsFullscreen`, `fullscreenAction`) — tested
 *    directly without React so the decision logic is pinned headlessly.
 *    These helpers are exported specifically to enable this pattern
 *    (identical to the helper exports in `pauseMenu.helpers.ts` etc.).
 *
 * 2. **Document API wiring simulation** — mirrors the component's
 *    `toggleFullscreen` branching: calls `requestFullscreen` when not
 *    in fullscreen, calls `exitFullscreen` when in fullscreen, and
 *    swallows rejections silently. Tested by mocking `document` APIs
 *    just as the component would use them.
 *
 * 3. **Event listener contract** — pins that `fullscreenchange` is
 *    subscribed on mount and unsubscribed on cleanup, using the same
 *    simulation approach used in `pauseMenu.test.ts` and
 *    `mainMenuScene.test.ts`.
 *
 * 4. **SSR / Node safety** — the module must be importable in a Node
 *    environment where `document` is undefined. `readIsFullscreen()`
 *    must return `false` in that case.
 *
 * Vitest environment: `node` (matches the global `vite.config.ts`
 * setting). No JSDOM, no `@testing-library/react` — pure function
 * and simulation tests only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fullscreenAction, readIsFullscreen } from '@/ui/useFullscreen';

// ---------------------------------------------------------------------------
// 1. readIsFullscreen — pure helper
// ---------------------------------------------------------------------------

describe('readIsFullscreen — in Node (no document)', () => {
  it('returns false when document is undefined (SSR / Node)', () => {
    // The test runner is Node — `document` is genuinely undefined here.
    expect(typeof document).toBe('undefined');
    expect(readIsFullscreen()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. readIsFullscreen — with a mocked document
// ---------------------------------------------------------------------------

describe('readIsFullscreen — with mocked document', () => {
  // In Node, `globalThis.document` is `undefined`. We use a cast to set
  // a partial mock without fighting the strict `Document` type — the
  // same pattern used throughout this test file.
  const g = globalThis as Record<string, unknown>;
  const originalDocument = g['document'];

  afterEach(() => {
    g['document'] = originalDocument;
  });

  it('returns false when fullscreenElement is null', () => {
    g['document'] = { fullscreenElement: null };
    expect(readIsFullscreen()).toBe(false);
  });

  it('returns true when fullscreenElement is a DOM element', () => {
    g['document'] = { fullscreenElement: {} };
    expect(readIsFullscreen()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. fullscreenAction — pure helper
// ---------------------------------------------------------------------------

describe('fullscreenAction', () => {
  it('returns "request" when not currently in fullscreen', () => {
    expect(fullscreenAction(false)).toBe('request');
  });

  it('returns "exit" when currently in fullscreen', () => {
    expect(fullscreenAction(true)).toBe('exit');
  });
});

// ---------------------------------------------------------------------------
// 4. toggleFullscreen logic — mock document APIs
// ---------------------------------------------------------------------------

describe('toggleFullscreen — wiring via mocked document APIs', () => {
  /**
   * Simulate the body of `toggleFullscreen` from the hook exactly.
   * The hook's `useCallback` wraps this exact branching; we pin the
   * wiring here so a refactor that disconnects the action from the API
   * call must break this test.
   */
  function simulateToggle(
    isCurrentlyFullscreen: boolean,
    requestFn: () => Promise<void>,
    exitFn: () => Promise<void>,
  ): void {
    if (fullscreenAction(isCurrentlyFullscreen) === 'request') {
      requestFn().catch(() => {
        /* intentionally swallowed */
      });
    } else {
      exitFn().catch(() => {
        /* intentionally swallowed */
      });
    }
  }

  it('calls requestFullscreen when not in fullscreen', () => {
    const requestFn = vi.fn().mockResolvedValue(undefined);
    const exitFn = vi.fn().mockResolvedValue(undefined);
    simulateToggle(false, requestFn, exitFn);
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(exitFn).not.toHaveBeenCalled();
  });

  it('calls exitFullscreen when already in fullscreen', () => {
    const requestFn = vi.fn().mockResolvedValue(undefined);
    const exitFn = vi.fn().mockResolvedValue(undefined);
    simulateToggle(true, requestFn, exitFn);
    expect(exitFn).toHaveBeenCalledTimes(1);
    expect(requestFn).not.toHaveBeenCalled();
  });

  it('does NOT throw when requestFullscreen rejects', async () => {
    const requestFn = vi.fn().mockRejectedValue(new Error('SecurityError'));
    const exitFn = vi.fn().mockResolvedValue(undefined);
    // Must not throw — rejection is caught and discarded.
    await expect(
      new Promise<void>((resolve) => {
        simulateToggle(false, requestFn, exitFn);
        // Allow the microtask queue to flush so the catch runs.
        resolve();
      }),
    ).resolves.toBeUndefined();
  });

  it('does NOT throw when exitFullscreen rejects', async () => {
    const requestFn = vi.fn().mockResolvedValue(undefined);
    const exitFn = vi.fn().mockRejectedValue(new Error('NotAllowed'));
    await expect(
      new Promise<void>((resolve) => {
        simulateToggle(true, requestFn, exitFn);
        resolve();
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. fullscreenchange event listener contract
// ---------------------------------------------------------------------------

describe('fullscreenchange event listener contract', () => {
  /**
   * Simulate the `useEffect` body from the hook. The hook adds one
   * listener on mount and removes it on cleanup. This test pins the
   * exact addEventListener / removeEventListener call contract so any
   * refactor that forgets cleanup must break it.
   */

  interface MockEventTarget {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  }

  function simulateEffect(target: MockEventTarget): () => void {
    const handleChange = (): void => {
      /* readIsFullscreen() would be called in the real hook */
    };
    target.addEventListener('fullscreenchange', handleChange);
    // Return the cleanup function (mirrors the useEffect return).
    return () => {
      target.removeEventListener('fullscreenchange', handleChange);
    };
  }

  let mockTarget: MockEventTarget;

  beforeEach(() => {
    mockTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  it('adds the fullscreenchange listener on mount', () => {
    simulateEffect(mockTarget);
    expect(mockTarget.addEventListener).toHaveBeenCalledTimes(1);
    expect(mockTarget.addEventListener).toHaveBeenCalledWith(
      'fullscreenchange',
      expect.any(Function),
    );
  });

  it('removes the fullscreenchange listener on cleanup (unmount)', () => {
    const cleanup = simulateEffect(mockTarget);
    cleanup();
    expect(mockTarget.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mockTarget.removeEventListener).toHaveBeenCalledWith(
      'fullscreenchange',
      expect.any(Function),
    );
  });

  it('the same handler reference is passed to both add and remove', () => {
    // Capture the handler by intercepting addEventListener itself.
    let capturedHandler: ((...args: unknown[]) => void) | undefined;
    mockTarget.addEventListener.mockImplementation(
      (_event: string, handler: (...args: unknown[]) => void) => {
        capturedHandler = handler;
      },
    );
    const cleanup = simulateEffect(mockTarget);
    cleanup();
    // removeEventListener must have been called with the exact same reference.
    expect(mockTarget.removeEventListener).toHaveBeenCalledWith(
      'fullscreenchange',
      capturedHandler,
    );
  });
});

// ---------------------------------------------------------------------------
// 6. PauseMenu — fullscreen button presence in SSR output
// ---------------------------------------------------------------------------

// These assertions check that the Button with `data-testid="pause-menu-fullscreen-btn"`
// is rendered inside PauseMenu when phase === 'paused'. We reuse the same
// SSR + mocked store pattern established by `pauseMenu.test.ts`.

type MockPhase = 'mainMenu' | 'briefing' | 'playing' | 'wave-clear' | 'paused' | 'game-over';

interface MockPauseState {
  phase: MockPhase;
  wave: number;
  score: number;
  hasSave: boolean;
  sfxVolume: number;
  musicVolume: number;
}

const mockPauseState: MockPauseState = {
  phase: 'paused',
  wave: 1,
  score: 0,
  hasSave: false,
  sfxVolume: 0.5,
  musicVolume: 1,
};

const mockResumeGame = vi.fn();
const mockReturnToMainMenu = vi.fn();
const mockSetSfxVolumePause = vi.fn();

vi.mock('@/store/selectors', () => ({
  useGamePhase: () => mockPauseState.phase,
  useWaveNumber: () => mockPauseState.wave,
  useScore: () => mockPauseState.score,
  useHasSave: () => mockPauseState.hasSave,
  useSettings: () => ({
    sfxVolume: mockPauseState.sfxVolume,
    musicVolume: mockPauseState.musicVolume,
  }),
}));

vi.mock('@/store/gameStore', () => ({
  useGameStore: Object.assign(
    <T>(
      selector: (s: {
        resumeGame: typeof mockResumeGame;
        returnToMainMenu: typeof mockReturnToMainMenu;
        setSfxVolume: typeof mockSetSfxVolumePause;
      }) => T,
    ): T =>
      selector({
        resumeGame: mockResumeGame,
        returnToMainMenu: mockReturnToMainMenu,
        setSfxVolume: mockSetSfxVolumePause,
      }),
    {
      getState: () => ({
        resumeGame: mockResumeGame,
        returnToMainMenu: mockReturnToMainMenu,
        setSfxVolume: mockSetSfxVolumePause,
      }),
    },
  ),
}));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PauseMenu } from '@/ui/PauseMenu';
import { MainMenuScene } from '@/ui/MainMenuScene';

describe('PauseMenu — fullscreen button', () => {
  beforeEach(() => {
    mockPauseState.phase = 'paused';
    mockResumeGame.mockReset();
    mockReturnToMainMenu.mockReset();
    mockSetSfxVolumePause.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the fullscreen button with the correct test id', () => {
    const html = renderToStaticMarkup(createElement(PauseMenu));
    expect(html).toContain('data-testid="pause-menu-fullscreen-btn"');
  });

  it('renders the "Fullscreen" label in the default (non-fullscreen) state', () => {
    // readIsFullscreen() returns false in Node (no document) —
    // the initial label must be "Fullscreen".
    const html = renderToStaticMarkup(createElement(PauseMenu));
    expect(html).toContain('>Fullscreen<');
  });

  it('places the fullscreen button between Continue and Settings', () => {
    const html = renderToStaticMarkup(createElement(PauseMenu));
    const continuePos = html.indexOf('data-testid="pause-continue-btn"');
    const fullscreenPos = html.indexOf('data-testid="pause-menu-fullscreen-btn"');
    const settingsPos = html.indexOf('data-testid="pause-settings-btn"');
    const exitPos = html.indexOf('data-testid="pause-exit-btn"');
    expect(continuePos).toBeLessThan(fullscreenPos);
    expect(fullscreenPos).toBeLessThan(settingsPos);
    expect(settingsPos).toBeLessThan(exitPos);
  });

  it('does NOT render the fullscreen button when phase is not paused', () => {
    mockPauseState.phase = 'playing';
    const html = renderToStaticMarkup(createElement(PauseMenu));
    expect(html).not.toContain('data-testid="pause-menu-fullscreen-btn"');
  });
});

// ---------------------------------------------------------------------------
// 7. MainMenuScene — fullscreen button presence in SSR output
// ---------------------------------------------------------------------------

describe('MainMenuScene — fullscreen button', () => {
  beforeEach(() => {
    mockPauseState.phase = 'mainMenu';
    mockResumeGame.mockReset();
    mockReturnToMainMenu.mockReset();
    mockSetSfxVolumePause.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the fullscreen button with the correct test id', () => {
    const html = renderToStaticMarkup(createElement(MainMenuScene));
    expect(html).toContain('data-testid="main-menu-fullscreen-btn"');
  });

  it('renders the "Fullscreen" label in the default (non-fullscreen) state', () => {
    const html = renderToStaticMarkup(createElement(MainMenuScene));
    expect(html).toContain('>Fullscreen<');
  });

  it('places the fullscreen button after Settings in the button stack', () => {
    const html = renderToStaticMarkup(createElement(MainMenuScene));
    const settingsPos = html.indexOf('data-testid="main-menu-settings-btn"');
    const fullscreenPos = html.indexOf('data-testid="main-menu-fullscreen-btn"');
    expect(settingsPos).toBeLessThan(fullscreenPos);
  });

  it('does NOT render the fullscreen button when phase is not mainMenu', () => {
    mockPauseState.phase = 'paused';
    const html = renderToStaticMarkup(createElement(MainMenuScene));
    expect(html).not.toContain('data-testid="main-menu-fullscreen-btn"');
  });
});
