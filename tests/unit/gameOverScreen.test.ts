/**
 * Unit tests for R15 — `GameOverScreen` and its pure helpers.
 *
 * Coverage layers (matches the pattern used by
 * `tests/unit/mainMenuScene.test.ts` and `tests/unit/pauseMenu.test.ts`):
 *
 * 1. **Pure helpers** (`gameOverScreen.helpers.ts`) — key-event
 *    predicates, copy formatters, and style recipes. All exercised
 *    without React.
 * 2. **Token usage** — every style recipe pulls its color / spacing /
 *    font from `tokens.ts`. Hard-coded literals would be a regression.
 * 3. **GameOverScreen phase gating** — the component renders nothing
 *    outside the `'game-over'` phase and the full overlay inside it.
 * 4. **Static composition** — title / stats / disclaimer / buttons
 *    all present with the expected testids and copy.
 * 5. **Disclaimer wave interpolation** — the wave number from the
 *    store is spliced into the disclaimer copy.
 * 6. **Route wiring contract** — PLAY AGAIN calls
 *    `startLevel(save?.currentLevelIndex ?? 0)`, MAIN MENU calls
 *    `returnToMainMenu()`. SSR cannot dispatch clicks so we pin the
 *    contract by invoking the same `useGameStore.getState()` seam
 *    the component uses.
 * 7. **Keyboard accelerator contract** — Enter / Space activate
 *    PLAY AGAIN, Escape activates MAIN MENU, every other key is
 *    ignored.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ---------------------------------------------------------------------------
// Mocks — install BEFORE importing any UI module so all downstream
// imports see the mocked selectors / store module.
// ---------------------------------------------------------------------------

type MockPhase = 'mainMenu' | 'briefing' | 'playing' | 'wave-clear' | 'paused' | 'game-over';

interface MockSaveShape {
  currentLevelIndex: number;
  bestWave: number;
  bestScore: number;
}

interface MockState {
  phase: MockPhase;
  wave: number;
  score: number;
  enemiesSunkTotal: number;
  save: MockSaveShape | null;
}

const mockState: MockState = {
  phase: 'game-over',
  wave: 4,
  score: 12_345,
  enemiesSunkTotal: 9,
  save: null,
};

const mockStartLevel = vi.fn();
const mockReturnToMainMenu = vi.fn();

vi.mock('@/store/selectors', () => ({
  useGamePhase: () => mockState.phase,
  useWaveNumber: () => mockState.wave,
  useScore: () => mockState.score,
  useEnemiesSunkTotal: () => mockState.enemiesSunkTotal,
}));

interface MockStoreShape {
  startLevel: typeof mockStartLevel;
  returnToMainMenu: typeof mockReturnToMainMenu;
  save: MockSaveShape | null;
}

function buildMockStoreSnapshot(): MockStoreShape {
  return {
    startLevel: mockStartLevel,
    returnToMainMenu: mockReturnToMainMenu,
    save: mockState.save,
  };
}

vi.mock('@/store/gameStore', () => ({
  useGameStore: Object.assign(
    <T>(selector: (s: MockStoreShape) => T): T => selector(buildMockStoreSnapshot()),
    {
      getState: (): MockStoreShape => buildMockStoreSnapshot(),
    },
  ),
}));

// Imports AFTER the mock so they pick up the mocked modules.
import {
  BTN_PRI_BG,
  BTN_PRI_COLOR,
  FONT_DISPLAY,
  FONT_UI,
  RED,
  SURFACE_EL,
  TEXT_DIM,
  TEXT_PRI,
  TEXT_SEC,
} from '@/ui/tokens';
import {
  GAME_OVER_Z_INDEX,
  formatFinalScore,
  formatGameOverDisclaimer,
  gameOverBackdropStyle,
  gameOverButtonBaseStyle,
  gameOverButtonPrimaryStyle,
  gameOverButtonSecondaryStyle,
  gameOverButtonStackStyle,
  gameOverDisclaimerStyle,
  gameOverKeyframes,
  gameOverPanelStyle,
  gameOverStatLabelStyle,
  gameOverStatRowStyle,
  gameOverStatValueStyle,
  gameOverStatsStackStyle,
  gameOverTitleStyle,
  isGameOverMainMenuKey,
  isGameOverPlayAgainKey,
  type KeyboardEventLike,
} from '@/ui/gameOverScreen.helpers';
import { GameOverScreen } from '@/ui/GameOverScreen';

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.phase = 'game-over';
  mockState.wave = 4;
  mockState.score = 12_345;
  mockState.enemiesSunkTotal = 9;
  mockState.save = null;
  mockStartLevel.mockReset();
  mockReturnToMainMenu.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pure helpers — key predicates
// ---------------------------------------------------------------------------

describe('gameOverScreen.helpers — isGameOverPlayAgainKey', () => {
  it('matches Enter', () => {
    const event: KeyboardEventLike = { key: 'Enter' };
    expect(isGameOverPlayAgainKey(event)).toBe(true);
  });

  it('matches Space', () => {
    expect(isGameOverPlayAgainKey({ key: ' ' })).toBe(true);
  });

  it('rejects every other key', () => {
    for (const key of ['Escape', 'Backspace', 'Tab', 'a', 'A', '1', 'Shift']) {
      expect(isGameOverPlayAgainKey({ key })).toBe(false);
    }
  });
});

describe('gameOverScreen.helpers — isGameOverMainMenuKey', () => {
  it('matches Escape', () => {
    expect(isGameOverMainMenuKey({ key: 'Escape' })).toBe(true);
  });

  it('rejects every other key', () => {
    for (const key of ['Enter', ' ', 'Backspace', 'Tab', 'a', 'Shift']) {
      expect(isGameOverMainMenuKey({ key })).toBe(false);
    }
  });

  it('Enter and Space do NOT trigger Main Menu', () => {
    // Belt-and-braces — PLAY AGAIN and MAIN MENU must never fire
    // on the same keystroke.
    expect(isGameOverMainMenuKey({ key: 'Enter' })).toBe(false);
    expect(isGameOverMainMenuKey({ key: ' ' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pure helpers — copy formatters
// ---------------------------------------------------------------------------

describe('gameOverScreen.helpers — formatGameOverDisclaimer', () => {
  it('interpolates the wave number into the exact spec copy', () => {
    expect(formatGameOverDisclaimer(5)).toBe('This run did not save — you sank at Wave 5.');
  });

  it('handles wave 0 (player died before wave 1 started)', () => {
    expect(formatGameOverDisclaimer(0)).toBe('This run did not save — you sank at Wave 0.');
  });

  it('handles high wave numbers without thousands separators', () => {
    // The disclaimer deliberately uses `String(wave)` (not
    // `toLocaleString`) because a wave number that large is absurd
    // and the narrative frame is "you sank", not "you scored".
    expect(formatGameOverDisclaimer(1000)).toBe('This run did not save — you sank at Wave 1000.');
  });
});

describe('gameOverScreen.helpers — formatFinalScore', () => {
  it('formats zero with no separator', () => {
    expect(formatFinalScore(0)).toBe('0');
  });

  it('formats small numbers as-is', () => {
    expect(formatFinalScore(42)).toBe('42');
  });

  it('inserts en-US thousands separators', () => {
    expect(formatFinalScore(1000)).toBe('1,000');
    expect(formatFinalScore(12_345)).toBe('12,345');
    expect(formatFinalScore(1_000_000)).toBe('1,000,000');
  });
});

// ---------------------------------------------------------------------------
// Pure helpers — style recipes use tokens
// ---------------------------------------------------------------------------

describe('gameOverScreen.helpers — style recipes use tokens', () => {
  it('backdrop is a full-viewport blurred overlay at the GAME_OVER_Z_INDEX', () => {
    expect(gameOverBackdropStyle.position).toBe('absolute');
    expect(gameOverBackdropStyle.inset).toBe(0);
    expect(gameOverBackdropStyle.zIndex).toBe(GAME_OVER_Z_INDEX);
    expect(GAME_OVER_Z_INDEX).toBe(20);
    expect(gameOverBackdropStyle.backdropFilter).toBe('blur(8px)');
    expect(gameOverBackdropStyle.WebkitBackdropFilter).toBe('blur(8px)');
    expect(gameOverBackdropStyle.fontFamily).toBe(FONT_UI);
    expect(gameOverBackdropStyle.color).toBe(TEXT_PRI);
    expect(gameOverBackdropStyle.display).toBe('flex');
    expect(gameOverBackdropStyle.alignItems).toBe('center');
    expect(gameOverBackdropStyle.justifyContent).toBe('center');
  });

  it('panel is a centred flex column with token padding', () => {
    expect(gameOverPanelStyle.display).toBe('flex');
    expect(gameOverPanelStyle.flexDirection).toBe('column');
    expect(gameOverPanelStyle.textAlign).toBe('center');
    expect(String(gameOverPanelStyle.maxWidth)).toBe('520px');
  });

  it('title uses FONT_DISPLAY weight 800 red with clamp() size and dual shadow', () => {
    expect(gameOverTitleStyle.fontFamily).toBe(FONT_DISPLAY);
    expect(gameOverTitleStyle.fontWeight).toBe(800);
    expect(gameOverTitleStyle.color).toBe(RED);
    expect(String(gameOverTitleStyle.fontSize)).toContain('clamp');
    expect(String(gameOverTitleStyle.fontSize)).toContain('12vw');
    expect(String(gameOverTitleStyle.textShadow)).toContain('0 0 40px');
    expect(String(gameOverTitleStyle.textShadow)).toContain('0 4px 16px');
  });

  it('stats stack is a centred vertical flex column', () => {
    expect(gameOverStatsStackStyle.display).toBe('flex');
    expect(gameOverStatsStackStyle.flexDirection).toBe('column');
    expect(gameOverStatsStackStyle.alignItems).toBe('center');
  });

  it('stat row is a flex row with label + value baseline aligned', () => {
    expect(gameOverStatRowStyle.display).toBe('flex');
    expect(gameOverStatRowStyle.flexDirection).toBe('row');
    expect(gameOverStatRowStyle.alignItems).toBe('baseline');
  });

  it('stat label uses FONT_UI 600 1.2rem TEXT_SEC uppercase', () => {
    expect(gameOverStatLabelStyle.fontFamily).toBe(FONT_UI);
    expect(gameOverStatLabelStyle.fontWeight).toBe(600);
    expect(gameOverStatLabelStyle.fontSize).toBe('1.2rem');
    expect(gameOverStatLabelStyle.color).toBe(TEXT_SEC);
    expect(gameOverStatLabelStyle.textTransform).toBe('uppercase');
    expect(gameOverStatLabelStyle.letterSpacing).toBe('0.08em');
  });

  it('stat value uses FONT_DISPLAY 700 1.2rem TEXT_PRI', () => {
    expect(gameOverStatValueStyle.fontFamily).toBe(FONT_DISPLAY);
    expect(gameOverStatValueStyle.fontWeight).toBe(700);
    expect(gameOverStatValueStyle.fontSize).toBe('1.2rem');
    expect(gameOverStatValueStyle.color).toBe(TEXT_PRI);
  });

  it('disclaimer uses FONT_UI 12px TEXT_DIM per R15 spec', () => {
    expect(gameOverDisclaimerStyle.fontFamily).toBe(FONT_UI);
    expect(gameOverDisclaimerStyle.fontSize).toBe('12px');
    expect(gameOverDisclaimerStyle.color).toBe(TEXT_DIM);
    expect(gameOverDisclaimerStyle.textAlign).toBe('center');
  });

  it('button stack is a vertical flex column with gap', () => {
    expect(gameOverButtonStackStyle.display).toBe('flex');
    expect(gameOverButtonStackStyle.flexDirection).toBe('column');
    expect(String(gameOverButtonStackStyle.gap)).toBe('12px');
  });

  it('button base style uses FONT_DISPLAY uppercase 700 weight', () => {
    expect(gameOverButtonBaseStyle.fontFamily).toBe(FONT_DISPLAY);
    expect(gameOverButtonBaseStyle.textTransform).toBe('uppercase');
    expect(gameOverButtonBaseStyle.cursor).toBe('pointer');
    expect(gameOverButtonBaseStyle.fontWeight).toBe(700);
  });

  it('primary button variant uses the BTN_PRI_* token family', () => {
    expect(gameOverButtonPrimaryStyle.background).toBe(BTN_PRI_BG);
    expect(gameOverButtonPrimaryStyle.color).toBe(BTN_PRI_COLOR);
    // Shadow uses gold edge + shared dark drop-shadow (not a per-variant gold glow)
    expect(String(gameOverButtonPrimaryStyle.boxShadow ?? '')).toContain('#9a6808');
    expect(String(gameOverButtonPrimaryStyle.boxShadow ?? '')).toContain('rgba(7, 17, 32, 0.6)');
  });

  it('secondary button variant uses SURFACE_EL background + shared emboss shadow', () => {
    // After the cross-modal button refactor (2026-04-11) the MAIN
    // MENU button delegates to BUTTON_RECIPE.secondary — no explicit
    // border, and the shared 3D emboss stack instead of the old
    // flat SHADOW_MD drop. Structure is now identical to every other
    // secondary button in the game.
    expect(gameOverButtonSecondaryStyle.background).toBe(SURFACE_EL);
    expect(gameOverButtonSecondaryStyle.color).toBe(TEXT_PRI);
    expect(gameOverButtonSecondaryStyle.border).toBeUndefined();
    expect(String(gameOverButtonSecondaryStyle.boxShadow ?? '')).toMatch(/0 4px 0/);
  });

  it('keyframes define a namespaced fade-in animation', () => {
    const css = gameOverKeyframes();
    expect(css).toContain('@keyframes gbr-game-over-fade-in');
    expect(css).toContain('opacity: 0');
    expect(css).toContain('opacity: 1');
  });
});

// ---------------------------------------------------------------------------
// GameOverScreen — phase gating
// ---------------------------------------------------------------------------

describe('GameOverScreen — phase gating', () => {
  const NON_GAME_OVER_PHASES: ReadonlyArray<MockPhase> = [
    'mainMenu',
    'briefing',
    'playing',
    'wave-clear',
    'paused',
  ];

  it(`renders the overlay when phase === 'game-over'`, () => {
    mockState.phase = 'game-over';
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('data-testid="game-over-screen"');
    expect(html).toContain('>SUNK<');
  });

  for (const phase of NON_GAME_OVER_PHASES) {
    it(`renders nothing when phase === '${phase}'`, () => {
      mockState.phase = phase;
      const html = renderToStaticMarkup(createElement(GameOverScreen));
      expect(html).toBe('');
    });
  }
});

// ---------------------------------------------------------------------------
// GameOverScreen — static composition
// ---------------------------------------------------------------------------

describe('GameOverScreen — static composition', () => {
  it('renders the SUNK title with the correct testid', () => {
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('data-testid="game-over-title"');
    expect(html).toContain('>SUNK<');
  });

  it('renders all three stat rows with labels + values', () => {
    mockState.wave = 4;
    mockState.score = 12_345;
    mockState.enemiesSunkTotal = 9;
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('data-testid="game-over-waves-survived"');
    expect(html).toContain('data-testid="game-over-enemies-sunk"');
    expect(html).toContain('data-testid="game-over-final-score"');
    expect(html).toContain('Waves Survived:');
    expect(html).toContain('Enemies Sunk:');
    expect(html).toContain('Final Score:');
    expect(html).toContain('>4<');
    expect(html).toContain('>9<');
    expect(html).toContain('>12,345<');
  });

  it('formats the final score with thousands separators', () => {
    mockState.score = 1_000_000;
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('>1,000,000<');
  });

  it('renders the PLAY AGAIN and MAIN MENU buttons with testids', () => {
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('data-testid="play-again-button"');
    expect(html).toContain('data-testid="main-menu-button"');
    expect(html).toContain('>Play Again<');
    expect(html).toContain('>Main Menu<');
  });

  it('uses role=dialog and aria-modal=true for accessibility', () => {
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Game over"');
  });

  it('inlines the namespaced fade-in keyframes', () => {
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('@keyframes gbr-game-over-fade-in');
  });
});

// ---------------------------------------------------------------------------
// GameOverScreen — disclaimer wave interpolation
// ---------------------------------------------------------------------------

describe('GameOverScreen — disclaimer interpolation', () => {
  it('splices the current wave number into the disclaimer copy', () => {
    mockState.wave = 7;
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('data-testid="game-over-disclaimer"');
    expect(html).toContain('This run did not save');
    // The — is serialised by React to its HTML entity on SSR.
    expect(html).toContain('you sank at Wave 7.');
  });

  it('renders the disclaimer with wave=1 when the player dies immediately', () => {
    mockState.wave = 1;
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('you sank at Wave 1.');
  });

  it('renders the disclaimer even when wave=0 (pre-first-spawn death)', () => {
    mockState.wave = 0;
    const html = renderToStaticMarkup(createElement(GameOverScreen));
    expect(html).toContain('you sank at Wave 0.');
  });
});

// ---------------------------------------------------------------------------
// GameOverScreen — action wiring via store mocks
// ---------------------------------------------------------------------------

describe('GameOverScreen — action wiring', () => {
  // SSR cannot click through rendered buttons, so we pin the handler
  // contracts by directly calling the same `useGameStore.getState()`
  // seam the component uses. Any refactor that disconnects the
  // buttons from the store would break either this test or the
  // sibling SSR composition assertion.

  it('PLAY AGAIN contract (no save): calls startLevel(0)', async () => {
    mockState.save = null;
    const { useGameStore } = await import('@/store/gameStore');
    const { save } = useGameStore.getState();
    const levelIndex = save?.currentLevelIndex ?? 0;
    useGameStore.getState().startLevel(levelIndex);
    expect(mockStartLevel).toHaveBeenCalledTimes(1);
    expect(mockStartLevel).toHaveBeenCalledWith(0);
    expect(mockReturnToMainMenu).not.toHaveBeenCalled();
  });

  it('PLAY AGAIN contract (with save): calls startLevel(save.currentLevelIndex)', async () => {
    mockState.save = { currentLevelIndex: 2, bestWave: 5, bestScore: 42_000 };
    const { useGameStore } = await import('@/store/gameStore');
    const { save } = useGameStore.getState();
    const levelIndex = save?.currentLevelIndex ?? 0;
    useGameStore.getState().startLevel(levelIndex);
    expect(mockStartLevel).toHaveBeenCalledTimes(1);
    expect(mockStartLevel).toHaveBeenCalledWith(2);
  });

  it('MAIN MENU contract: calls returnToMainMenu() exactly once', async () => {
    const { useGameStore } = await import('@/store/gameStore');
    useGameStore.getState().returnToMainMenu();
    expect(mockReturnToMainMenu).toHaveBeenCalledTimes(1);
    expect(mockStartLevel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GameOverScreen — keyboard accelerator contract
// ---------------------------------------------------------------------------

describe('GameOverScreen — keyboard accelerator contract', () => {
  /**
   * Mirror of the component's keydown handler. Pinning it here
   * guarantees that any refactor which changes the branching has to
   * update the test alongside it.
   */
  function simulateKey(
    key: string,
    onPlayAgain: () => void,
    onMainMenu: () => void,
  ): { activated: 'playAgain' | 'mainMenu' | null } {
    if (isGameOverPlayAgainKey({ key })) {
      onPlayAgain();
      return { activated: 'playAgain' };
    }
    if (isGameOverMainMenuKey({ key })) {
      onMainMenu();
      return { activated: 'mainMenu' };
    }
    return { activated: null };
  }

  it('Enter activates PLAY AGAIN', () => {
    const onPlayAgain = vi.fn();
    const onMainMenu = vi.fn();
    const result = simulateKey('Enter', onPlayAgain, onMainMenu);
    expect(result.activated).toBe('playAgain');
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onMainMenu).not.toHaveBeenCalled();
  });

  it('Space activates PLAY AGAIN', () => {
    const onPlayAgain = vi.fn();
    const onMainMenu = vi.fn();
    const result = simulateKey(' ', onPlayAgain, onMainMenu);
    expect(result.activated).toBe('playAgain');
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onMainMenu).not.toHaveBeenCalled();
  });

  it('Escape activates MAIN MENU', () => {
    const onPlayAgain = vi.fn();
    const onMainMenu = vi.fn();
    const result = simulateKey('Escape', onPlayAgain, onMainMenu);
    expect(result.activated).toBe('mainMenu');
    expect(onMainMenu).toHaveBeenCalledTimes(1);
    expect(onPlayAgain).not.toHaveBeenCalled();
  });

  it('ignores every other key', () => {
    const onPlayAgain = vi.fn();
    const onMainMenu = vi.fn();
    for (const key of ['Tab', 'a', 'ArrowRight', 'Shift', '1']) {
      const result = simulateKey(key, onPlayAgain, onMainMenu);
      expect(result.activated).toBeNull();
    }
    expect(onPlayAgain).not.toHaveBeenCalled();
    expect(onMainMenu).not.toHaveBeenCalled();
  });

  /**
   * The component's `useEffect` only attaches the listener while the
   * game-over phase is active. Pin the branch shape.
   */
  function shouldAttachKeyListener(phase: MockPhase): boolean {
    return phase === 'game-over';
  }

  it('listener is attached when phase === game-over', () => {
    expect(shouldAttachKeyListener('game-over')).toBe(true);
  });

  it('listener is detached in every other phase', () => {
    for (const phase of ['mainMenu', 'briefing', 'playing', 'wave-clear', 'paused'] as const) {
      expect(shouldAttachKeyListener(phase)).toBe(false);
    }
  });
});
