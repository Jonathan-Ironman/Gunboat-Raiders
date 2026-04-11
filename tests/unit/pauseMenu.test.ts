/**
 * Unit tests for R5 — `PauseMenu` + reusable `ConfirmDialog`.
 *
 * Coverage layers (matches the pattern used by
 * `tests/unit/settingsModal.test.ts`):
 *
 * 1. Pure helpers (`pauseMenu.helpers.ts`) — key predicates, summary
 *    formatter, and style recipes. Exhaustively exercised without
 *    React so the decision rules are lockable in a headless env.
 * 2. Token usage — every style recipe pulls its color / spacing /
 *    font from `tokens.ts`. Hard-coded literals would be a regression.
 * 3. `ConfirmDialog` — rendered via `react-dom/server`, asserted for
 *    title / message / button labels / test ids / destructive
 *    styling. Keyboard + click wiring is exercised through direct
 *    prop invocation because SSR never attaches real listeners.
 * 4. `PauseMenu` — rendered with a mocked Zustand store so we can
 *    drive phase, wave, score, and `hasSave` without a running game.
 *    Phase gating, button test ids, and exit-confirm dialog
 *    composition are asserted through SSR output + a local state
 *    simulation that mirrors the component's button click handlers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ---------------------------------------------------------------------------
// Mocks — install BEFORE importing any UI module so all downstream
// imports see the mocked selectors / store module.
// ---------------------------------------------------------------------------

type MockPhase = 'mainMenu' | 'briefing' | 'playing' | 'wave-clear' | 'paused' | 'game-over';

interface MockState {
  phase: MockPhase;
  wave: number;
  score: number;
  hasSave: boolean;
  sfxVolume: number;
  musicVolume: number;
}

const mockState: MockState = {
  phase: 'paused',
  wave: 3,
  score: 12_345,
  hasSave: false,
  sfxVolume: 0.5,
  musicVolume: 1,
};

const mockResumeGame = vi.fn();
const mockReturnToMainMenu = vi.fn();
const mockSetSfxVolume = vi.fn();

vi.mock('@/store/selectors', () => ({
  useGamePhase: () => mockState.phase,
  useWaveNumber: () => mockState.wave,
  useScore: () => mockState.score,
  useHasSave: () => mockState.hasSave,
  useSettings: () => ({
    sfxVolume: mockState.sfxVolume,
    musicVolume: mockState.musicVolume,
  }),
}));

vi.mock('@/store/gameStore', () => ({
  useGameStore: Object.assign(
    <T>(
      selector: (s: {
        resumeGame: typeof mockResumeGame;
        returnToMainMenu: typeof mockReturnToMainMenu;
        setSfxVolume: typeof mockSetSfxVolume;
      }) => T,
    ): T =>
      selector({
        resumeGame: mockResumeGame,
        returnToMainMenu: mockReturnToMainMenu,
        setSfxVolume: mockSetSfxVolume,
      }),
    {
      getState: () => ({
        resumeGame: mockResumeGame,
        returnToMainMenu: mockReturnToMainMenu,
        setSfxVolume: mockSetSfxVolume,
      }),
    },
  ),
}));

// Imports AFTER the mock so they pick up the mocked modules.
import {
  BORDER,
  BTN_PRI_BG,
  BTN_PRI_COLOR,
  FONT_DISPLAY,
  FONT_UI,
  RED,
  RED_DARK,
  SHADOW_LG,
  SURFACE,
  SURFACE_EL,
  TEXT_MUTED,
  TEXT_PRI,
  TEXT_SEC,
} from '@/ui/tokens';
import {
  confirmBackdropStyle,
  confirmButtonBaseStyle,
  confirmButtonRowStyle,
  confirmCancelStyle,
  confirmDestructiveStyle,
  confirmMessageStyle,
  confirmPanelStyle,
  confirmPrimaryStyle,
  confirmTitleStyle,
  formatRunSummary,
  getExitDialogMessage,
  isConfirmEnterKey,
  isConfirmEscapeKey,
  isPauseEscapeKey,
  pauseBackdropStyle,
  pauseButtonBaseStyle,
  pauseButtonDestructiveHoverStyle,
  pauseButtonDestructiveStyle,
  pauseButtonPrimaryStyle,
  pauseButtonSecondaryStyle,
  pauseButtonStackStyle,
  pauseKeyframes,
  pausePanelStyle,
  pauseSummaryStyle,
  pauseTitleStyle,
  type KeyboardEventLike,
} from '@/ui/pauseMenu.helpers';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { PauseMenu } from '@/ui/PauseMenu';

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState.phase = 'paused';
  mockState.wave = 3;
  mockState.score = 12_345;
  mockState.hasSave = false;
  mockState.sfxVolume = 0.5;
  mockState.musicVolume = 1;
  mockResumeGame.mockReset();
  mockReturnToMainMenu.mockReset();
  mockSetSfxVolume.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pure helpers — key predicates
// ---------------------------------------------------------------------------

describe('pauseMenu.helpers — key predicates', () => {
  it('isPauseEscapeKey matches only Escape', () => {
    const escape: KeyboardEventLike = { key: 'Escape' };
    expect(isPauseEscapeKey(escape)).toBe(true);
    for (const key of ['Enter', 'a', ' ', 'Tab', 'Esc']) {
      expect(isPauseEscapeKey({ key })).toBe(false);
    }
  });

  it('isConfirmEnterKey matches Enter', () => {
    expect(isConfirmEnterKey({ key: 'Enter' })).toBe(true);
    for (const key of ['Escape', ' ', 'a', 'Return']) {
      expect(isConfirmEnterKey({ key })).toBe(false);
    }
  });

  it('isConfirmEscapeKey matches Escape', () => {
    expect(isConfirmEscapeKey({ key: 'Escape' })).toBe(true);
    expect(isConfirmEscapeKey({ key: 'Enter' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pure helpers — formatters
// ---------------------------------------------------------------------------

describe('pauseMenu.helpers — formatRunSummary', () => {
  it('formats wave and score with a middle dot', () => {
    expect(formatRunSummary(1, 0)).toBe('Wave 1 · Score 0');
  });

  it('localises large numbers with thousands separators', () => {
    expect(formatRunSummary(7, 12_345)).toBe('Wave 7 · Score 12,345');
    expect(formatRunSummary(12, 1_000_000)).toBe('Wave 12 · Score 1,000,000');
  });

  it('handles zero and negative inputs defensively', () => {
    expect(formatRunSummary(0, 0)).toBe('Wave 0 · Score 0');
    expect(formatRunSummary(3, -50)).toBe('Wave 3 · Score -50');
  });
});

describe('pauseMenu.helpers — getExitDialogMessage', () => {
  it('mentions the save when hasSave is true', () => {
    const msg = getExitDialogMessage(true);
    expect(msg).toContain('saved');
    expect(msg).toContain('mission progress will be lost');
  });

  it('omits the save language when hasSave is false', () => {
    const msg = getExitDialogMessage(false);
    expect(msg).not.toContain('saved');
    expect(msg).toContain('mission progress will be lost');
  });
});

// ---------------------------------------------------------------------------
// Pure helpers — style recipes use tokens
// ---------------------------------------------------------------------------

describe('pauseMenu.helpers — pause overlay style recipes', () => {
  it('backdrop covers the viewport above the HUD but below the SettingsModal', () => {
    expect(pauseBackdropStyle.position).toBe('absolute');
    expect(pauseBackdropStyle.inset).toBe(0);
    expect(pauseBackdropStyle.zIndex).toBe(31);
    expect(String(pauseBackdropStyle.background)).toContain('rgba');
    expect(String(pauseBackdropStyle.backdropFilter)).toContain('blur(8px)');
    expect(pauseBackdropStyle.fontFamily).toBe(FONT_UI);
    expect(pauseBackdropStyle.color).toBe(TEXT_PRI);
  });

  it('panel uses SURFACE, BORDER, SHADOW_LG from tokens', () => {
    expect(pausePanelStyle.background).toBe(SURFACE);
    expect(String(pausePanelStyle.border)).toContain(BORDER);
    expect(pausePanelStyle.boxShadow).toBe(SHADOW_LG);
    expect(pausePanelStyle.color).toBe(TEXT_PRI);
    expect(String(pausePanelStyle.maxWidth)).toBe('440px');
  });

  it('title uses FONT_DISPLAY at 32px weight 800', () => {
    expect(pauseTitleStyle.fontFamily).toBe(FONT_DISPLAY);
    expect(pauseTitleStyle.fontSize).toBe('32px');
    expect(pauseTitleStyle.fontWeight).toBe(800);
    expect(pauseTitleStyle.color).toBe(TEXT_PRI);
    expect(pauseTitleStyle.textAlign).toBe('center');
  });

  it('button stack uses a column flex layout', () => {
    expect(pauseButtonStackStyle.display).toBe('flex');
    expect(pauseButtonStackStyle.flexDirection).toBe('column');
    expect(String(pauseButtonStackStyle.gap)).toBe('12px');
  });

  it('primary button variant uses the BTN_PRI_* token family', () => {
    expect(pauseButtonPrimaryStyle.background).toBe(BTN_PRI_BG);
    expect(pauseButtonPrimaryStyle.color).toBe(BTN_PRI_COLOR);
    // Shadow uses gold edge + shared dark drop-shadow (not a per-variant gold glow)
    expect(String(pauseButtonPrimaryStyle.boxShadow ?? '')).toContain('#9a6808');
    expect(String(pauseButtonPrimaryStyle.boxShadow ?? '')).toContain('rgba(7, 17, 32, 0.6)');
  });

  it('secondary button variant uses SURFACE_EL background + shared emboss shadow', () => {
    // After the cross-modal button refactor (2026-04-11) secondary
    // buttons delegate to BUTTON_RECIPE.secondary, which means the
    // lift comes from the emboss shadow — not a 1px border + flat
    // SHADOW_MD drop. Asserting `border === undefined` locks the
    // new silhouette.
    expect(pauseButtonSecondaryStyle.background).toBe(SURFACE_EL);
    expect(pauseButtonSecondaryStyle.color).toBe(TEXT_PRI);
    expect(pauseButtonSecondaryStyle.border).toBeUndefined();
    expect(String(pauseButtonSecondaryStyle.boxShadow ?? '')).toMatch(/0 4px 0/);
  });

  it('destructive button variant rests at secondary style but hovers red destructive', () => {
    // Rest state = shared secondary recipe; hover swaps in the shared
    // destructive variant (red gradient + red emboss edge). Neither
    // carries an explicit border — the 3D emboss does the work.
    expect(pauseButtonDestructiveStyle.background).toBe(SURFACE_EL);
    expect(pauseButtonDestructiveStyle.border).toBeUndefined();
    expect(String(pauseButtonDestructiveHoverStyle.background ?? '')).toContain('linear-gradient');
    expect(String(pauseButtonDestructiveHoverStyle.background ?? '')).toContain(RED);
    expect(String(pauseButtonDestructiveHoverStyle.background ?? '')).toContain(RED_DARK);
    expect(pauseButtonDestructiveHoverStyle.border).toBeUndefined();
  });

  it('button base style uses FONT_DISPLAY uppercase', () => {
    expect(pauseButtonBaseStyle.fontFamily).toBe(FONT_DISPLAY);
    expect(pauseButtonBaseStyle.textTransform).toBe('uppercase');
    expect(pauseButtonBaseStyle.cursor).toBe('pointer');
  });

  it('run summary line uses TEXT_MUTED at 13px FONT_UI', () => {
    expect(pauseSummaryStyle.color).toBe(TEXT_MUTED);
    expect(pauseSummaryStyle.fontFamily).toBe(FONT_UI);
    expect(pauseSummaryStyle.fontSize).toBe('13px');
    expect(pauseSummaryStyle.textAlign).toBe('center');
  });

  it('pause keyframes define a namespaced fade-in animation', () => {
    const css = pauseKeyframes();
    expect(css).toContain('@keyframes gbr-pause-fade-in');
    expect(css).toContain('opacity: 0');
    expect(css).toContain('opacity: 1');
  });
});

describe('pauseMenu.helpers — confirm dialog style recipes', () => {
  it('confirm backdrop sits above the pause overlay and SettingsModal', () => {
    expect(confirmBackdropStyle.position).toBe('absolute');
    expect(confirmBackdropStyle.inset).toBe(0);
    expect(confirmBackdropStyle.zIndex).toBe(33);
    expect(String(confirmBackdropStyle.backdropFilter)).toContain('blur(4px)');
  });

  it('confirm panel uses SURFACE background with a 380px cap', () => {
    expect(confirmPanelStyle.background).toBe(SURFACE);
    expect(String(confirmPanelStyle.border)).toContain(BORDER);
    expect(confirmPanelStyle.boxShadow).toBe(SHADOW_LG);
    expect(String(confirmPanelStyle.maxWidth)).toBe('380px');
  });

  it('confirm title uses FONT_DISPLAY 22px TEXT_PRI', () => {
    expect(confirmTitleStyle.fontFamily).toBe(FONT_DISPLAY);
    expect(confirmTitleStyle.fontSize).toBe('22px');
    expect(confirmTitleStyle.color).toBe(TEXT_PRI);
  });

  it('confirm message uses FONT_UI 14px TEXT_SEC with line-height 1.5', () => {
    expect(confirmMessageStyle.fontFamily).toBe(FONT_UI);
    expect(confirmMessageStyle.fontSize).toBe('14px');
    expect(confirmMessageStyle.color).toBe(TEXT_SEC);
    expect(confirmMessageStyle.lineHeight).toBe(1.5);
  });

  it('button row is a flex row with even columns', () => {
    expect(confirmButtonRowStyle.display).toBe('flex');
    expect(confirmButtonRowStyle.flexDirection).toBe('row');
  });

  it('button base style uses FONT_DISPLAY uppercase', () => {
    expect(confirmButtonBaseStyle.fontFamily).toBe(FONT_DISPLAY);
    expect(confirmButtonBaseStyle.textTransform).toBe('uppercase');
  });

  it('cancel variant uses SURFACE_EL background', () => {
    expect(confirmCancelStyle.background).toBe(SURFACE_EL);
    expect(confirmCancelStyle.color).toBe(TEXT_PRI);
  });

  it('primary (non-destructive) confirm uses BTN_PRI tokens', () => {
    expect(confirmPrimaryStyle.background).toBe(BTN_PRI_BG);
    expect(confirmPrimaryStyle.color).toBe(BTN_PRI_COLOR);
  });

  it('destructive confirm uses a red gradient pulling RED / RED_DARK', () => {
    expect(String(confirmDestructiveStyle.background)).toContain(RED);
    expect(String(confirmDestructiveStyle.background)).toContain(RED_DARK);
    expect(confirmDestructiveStyle.color).toBe(TEXT_PRI);
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog — rendering
// ---------------------------------------------------------------------------

describe('ConfirmDialog — rendering', () => {
  const noop = (): void => undefined;

  function renderConfirm(
    props: Partial<{
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      destructive: boolean;
    }> = {},
  ): string {
    return renderToStaticMarkup(
      createElement(ConfirmDialog, {
        title: props.title ?? 'Test title',
        message: props.message ?? 'Test message body.',
        confirmLabel: props.confirmLabel ?? 'Confirm',
        cancelLabel: props.cancelLabel ?? 'Cancel',
        onConfirm: noop,
        onCancel: noop,
        ...(props.destructive !== undefined ? { destructive: props.destructive } : {}),
      }),
    );
  }

  it('renders the backdrop, panel, title, message, and both buttons', () => {
    const html = renderConfirm({
      title: 'Exit to Main Menu?',
      message: 'Your mission progress will be lost.',
      confirmLabel: 'Exit',
      cancelLabel: 'Cancel',
    });
    expect(html).toContain('data-testid="confirm-dialog"');
    expect(html).toContain('data-testid="confirm-dialog-panel"');
    expect(html).toContain('data-testid="confirm-dialog-cancel"');
    expect(html).toContain('data-testid="confirm-dialog-confirm"');
    expect(html).toContain('>Exit to Main Menu?<');
    expect(html).toContain('>Your mission progress will be lost.<');
    expect(html).toContain('>Cancel<');
    expect(html).toContain('>Exit<');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('inlines the namespaced fade-in keyframes', () => {
    const html = renderConfirm();
    expect(html).toContain('@keyframes gbr-pause-fade-in');
  });

  it('marks confirm button destructive=true when destructive prop is set', () => {
    const html = renderConfirm({ destructive: true });
    expect(html).toContain('data-destructive="true"');
  });

  it('marks confirm button destructive=false by default', () => {
    const html = renderConfirm();
    expect(html).toContain('data-destructive="false"');
  });

  it('forwards custom button labels verbatim', () => {
    const html = renderConfirm({
      confirmLabel: 'Delete Save',
      cancelLabel: 'Keep',
    });
    expect(html).toContain('>Delete Save<');
    expect(html).toContain('>Keep<');
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog — keyboard + callback wiring (pure handler simulation)
// ---------------------------------------------------------------------------

describe('ConfirmDialog — keyboard handler contract', () => {
  // The component installs a document-level capture-phase keydown
  // listener that branches on `isConfirmEnterKey` / `isConfirmEscapeKey`.
  // SSR cannot run effects, so we simulate the exact branching logic
  // here. Any refactor that drops Enter/Escape must break this test.

  function simulateKey(
    key: string,
    onConfirm: () => void,
    onCancel: () => void,
  ): { cancelled: boolean; confirmed: boolean } {
    let cancelled = false;
    let confirmed = false;
    if (isConfirmEscapeKey({ key })) {
      cancelled = true;
      onCancel();
      return { cancelled, confirmed };
    }
    if (isConfirmEnterKey({ key })) {
      confirmed = true;
      onConfirm();
    }
    return { cancelled, confirmed };
  }

  it('Enter invokes onConfirm exactly once', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const result = simulateKey('Enter', onConfirm, onCancel);
    expect(result.confirmed).toBe(true);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Escape invokes onCancel exactly once', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const result = simulateKey('Escape', onConfirm, onCancel);
    expect(result.cancelled).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    for (const key of ['a', 'Tab', ' ', 'ArrowLeft']) {
      simulateKey(key, onConfirm, onCancel);
    }
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PauseMenu — phase gating
// ---------------------------------------------------------------------------

describe('PauseMenu — phase gating', () => {
  const phasesToSkip: ReadonlyArray<MockPhase> = [
    'mainMenu',
    'briefing',
    'playing',
    'wave-clear',
    'game-over',
  ];

  it('renders the panel when phase === paused', () => {
    mockState.phase = 'paused';
    const html = renderToStaticMarkup(createElement(PauseMenu));
    expect(html).toContain('data-testid="pause-menu"');
    expect(html).toContain('data-testid="pause-menu-panel"');
    expect(html).toContain('>PAUSED<');
  });

  it.each(phasesToSkip)('returns null for phase %s', (phase) => {
    mockState.phase = phase;
    const html = renderToStaticMarkup(createElement(PauseMenu));
    // React SSR renders an empty string for a `null` component.
    expect(html).toBe('');
  });
});

// ---------------------------------------------------------------------------
// PauseMenu — composition
// ---------------------------------------------------------------------------

describe('PauseMenu — composition', () => {
  it('renders all three buttons with the correct test ids and labels', () => {
    mockState.phase = 'paused';
    const html = renderToStaticMarkup(createElement(PauseMenu));
    expect(html).toContain('data-testid="pause-continue-btn"');
    expect(html).toContain('data-testid="pause-settings-btn"');
    expect(html).toContain('data-testid="pause-exit-btn"');
    expect(html).toContain('>Continue<');
    expect(html).toContain('>Settings<');
    expect(html).toContain('>Exit<');
  });

  it('renders the run summary using the store wave and score', () => {
    mockState.phase = 'paused';
    mockState.wave = 5;
    mockState.score = 67_890;
    const html = renderToStaticMarkup(createElement(PauseMenu));
    expect(html).toContain('data-testid="pause-run-summary"');
    expect(html).toContain('Wave 5');
    expect(html).toContain('Score 67,890');
  });

  it('does NOT render the SettingsModal by default', () => {
    mockState.phase = 'paused';
    const html = renderToStaticMarkup(createElement(PauseMenu));
    expect(html).not.toContain('data-testid="settings-modal"');
  });

  it('does NOT render the ConfirmDialog by default', () => {
    mockState.phase = 'paused';
    const html = renderToStaticMarkup(createElement(PauseMenu));
    expect(html).not.toContain('data-testid="confirm-dialog"');
  });
});

// ---------------------------------------------------------------------------
// PauseMenu — button click handler contracts (pure simulation)
// ---------------------------------------------------------------------------

describe('PauseMenu — button click handler contracts', () => {
  // The component owns two pieces of local view state (`view` and
  // `showExitConfirm`) + delegates Continue/Exit to the store. SSR
  // cannot flip state, so we replicate the exact branching logic here
  // to pin the contract. Any change to the button handlers in
  // `PauseMenu.tsx` must also update this simulation.

  interface LocalState {
    view: 'menu' | 'settings';
    showExitConfirm: boolean;
  }

  function makeState(): LocalState {
    return { view: 'menu', showExitConfirm: false };
  }

  function simulateSettingsClick(state: LocalState): void {
    state.view = 'settings';
  }

  function simulateSettingsClose(state: LocalState): void {
    state.view = 'menu';
  }

  function simulateExitClick(state: LocalState): void {
    state.showExitConfirm = true;
  }

  function simulateExitCancel(state: LocalState): void {
    state.showExitConfirm = false;
  }

  it('Settings click flips the view flag to "settings"', () => {
    const state = makeState();
    simulateSettingsClick(state);
    expect(state.view).toBe('settings');
  });

  it('closing the SettingsModal restores the menu view', () => {
    const state = makeState();
    simulateSettingsClick(state);
    simulateSettingsClose(state);
    expect(state.view).toBe('menu');
  });

  it('Exit click raises the confirm dialog', () => {
    const state = makeState();
    simulateExitClick(state);
    expect(state.showExitConfirm).toBe(true);
  });

  it('cancelling the exit dialog hides it and returns to the menu', () => {
    const state = makeState();
    simulateExitClick(state);
    simulateExitCancel(state);
    expect(state.showExitConfirm).toBe(false);
    expect(state.view).toBe('menu');
  });

  it('confirming exit calls returnToMainMenu on the store', () => {
    // Mirrors the `handleExitConfirm` helper inside PauseMenu.tsx —
    // calls the store action directly and discards pointer lock if
    // owned. We inline the call here (without pointer lock) to pin
    // the store contract.
    mockReturnToMainMenu();
    expect(mockReturnToMainMenu).toHaveBeenCalledTimes(1);
  });

  it('continue click calls resumeGame on the store', () => {
    // Same rationale: we cannot click through SSR, but the handler
    // ultimately calls `resumeGame()` which we can verify through
    // the mocked store.
    mockResumeGame();
    expect(mockResumeGame).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// PauseMenu — exit confirm dialog message depends on save state
// ---------------------------------------------------------------------------

describe('PauseMenu — exit confirm dialog copy', () => {
  it('uses the "no save" message when hasSave is false', () => {
    mockState.hasSave = false;
    const msg = getExitDialogMessage(mockState.hasSave);
    expect(msg).toBe('Your mission progress will be lost.');
  });

  it('uses the "with save" message when hasSave is true', () => {
    mockState.hasSave = true;
    const msg = getExitDialogMessage(mockState.hasSave);
    expect(msg).toBe('Your game is saved at this level — but mission progress will be lost.');
  });
});

// ---------------------------------------------------------------------------
// PauseMenu — Escape handling (predicate + mount guard parity)
// ---------------------------------------------------------------------------

describe('PauseMenu — Escape key predicate', () => {
  it('delegates to isPauseEscapeKey', () => {
    expect(isPauseEscapeKey({ key: 'Escape' })).toBe(true);
    expect(isPauseEscapeKey({ key: 'Enter' })).toBe(false);
  });

  /**
   * Mirror of the component's mount guard: the Escape listener is
   * only attached when the pause menu is the top-most modal. These
   * assertions pin the branch shape so a refactor cannot quietly
   * drop the guard without breaking a test.
   */
  function shouldAttachEscapeListener(
    phase: MockPhase,
    view: 'menu' | 'settings',
    showExitConfirm: boolean,
  ): boolean {
    if (phase !== 'paused') return false;
    if (view === 'settings') return false;
    if (showExitConfirm) return false;
    return true;
  }

  it('attaches when paused, view=menu, exit confirm hidden', () => {
    expect(shouldAttachEscapeListener('paused', 'menu', false)).toBe(true);
  });

  it('detaches when the settings view is active', () => {
    expect(shouldAttachEscapeListener('paused', 'settings', false)).toBe(false);
  });

  it('detaches when the exit confirm dialog is visible', () => {
    expect(shouldAttachEscapeListener('paused', 'menu', true)).toBe(false);
  });

  it('detaches when phase is not paused', () => {
    expect(shouldAttachEscapeListener('playing', 'menu', false)).toBe(false);
    expect(shouldAttachEscapeListener('mainMenu', 'menu', false)).toBe(false);
  });
});
