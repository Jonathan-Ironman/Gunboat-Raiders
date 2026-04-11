/**
 * Unit tests for `src/ui/ControlsOverlay.tsx` — R17 slice.
 *
 * These tests cover three layers:
 *
 * 1. **Pure helpers** (`ControlsOverlay.helpers.ts`) — phase gating,
 *    key-event matching, text-input guarding, and style recipes. Pure
 *    functions are exercised exhaustively without React.
 * 2. **Tokens in styles** — every style recipe must pull its colors,
 *    spacing, typography, and motion from `tokens.ts`. Hard-coded
 *    values would be an immediate regression.
 * 3. **Component rendering** via `react-dom/server` — the overlay
 *    component is rendered for each phase / `open` state combination
 *    and the output HTML is asserted. The component's `useEffect` key
 *    listener does NOT run under SSR, so the keydown dispatch logic is
 *    validated through the pure helpers instead (which is where the
 *    real branching lives).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  CONTROLS_QUADRANT_CAPTION,
  CONTROLS_QUADRANT_DIAGRAM,
  controlsBackdropStyle,
  controlsKeyPillStyle,
  controlsKeyframes,
  controlsPanelStyle,
  controlsTitleStyle,
  isCloseKey,
  isEventFromTextInput,
  isToggleKey,
  shouldIgnoreKeyEvent,
  shouldRenderControlsOverlay,
  type KeyboardEventLike,
} from '@/ui/ControlsOverlay.helpers';
import { KEYBINDINGS } from '@/ui/keybindings';
import { BORDER, DUR_NORMAL, FONT_DISPLAY, SHADOW_LG, SURFACE_EL, TEXT_PRI } from '@/ui/tokens';

// ---------------------------------------------------------------------------
// Mock the store selectors so the component can be rendered headlessly
// without booting Zustand. This mirrors the R14 LowHullWarning pattern.
// ---------------------------------------------------------------------------

type MockPhase = 'mainMenu' | 'briefing' | 'playing' | 'wave-clear' | 'paused' | 'game-over';

const mockState: { phase: MockPhase } = { phase: 'mainMenu' };

vi.mock('@/store/selectors', () => ({
  useGamePhase: () => mockState.phase,
  usePlayerHealth: () => null,
  useWaveNumber: () => 0,
  useScore: () => 0,
  useEnemiesRemaining: () => 0,
  useEnemiesSunkTotal: () => 0,
}));

// Import AFTER the mock so it picks up the mocked selector module.
import { ControlsOverlay, ControlsOverlayPanel } from '@/ui/ControlsOverlay';

function setPhase(phase: MockPhase): void {
  mockState.phase = phase;
}

beforeEach(() => {
  setPhase('mainMenu');
});

// ---------------------------------------------------------------------------
// shouldRenderControlsOverlay
// ---------------------------------------------------------------------------

describe('ControlsOverlay — shouldRenderControlsOverlay', () => {
  it('allows the overlay during "playing"', () => {
    expect(shouldRenderControlsOverlay('playing')).toBe(true);
  });

  it('allows the overlay during "wave-clear" (inter-wave lull)', () => {
    expect(shouldRenderControlsOverlay('wave-clear')).toBe(true);
  });

  it('suppresses the overlay on the main menu', () => {
    expect(shouldRenderControlsOverlay('mainMenu')).toBe(false);
  });

  it('suppresses the overlay during the briefing modal', () => {
    expect(shouldRenderControlsOverlay('briefing')).toBe(false);
  });

  it('suppresses the overlay while the game is paused', () => {
    expect(shouldRenderControlsOverlay('paused')).toBe(false);
  });

  it('suppresses the overlay on the game-over screen', () => {
    expect(shouldRenderControlsOverlay('game-over')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isToggleKey
// ---------------------------------------------------------------------------

describe('ControlsOverlay — isToggleKey', () => {
  it('matches lowercase "h"', () => {
    expect(isToggleKey({ key: 'h' })).toBe(true);
  });

  it('matches uppercase "H"', () => {
    expect(isToggleKey({ key: 'H' })).toBe(true);
  });

  it('matches the "?" help shortcut', () => {
    expect(isToggleKey({ key: '?' })).toBe(true);
  });

  it('ignores every other key', () => {
    for (const key of ['w', 'a', 's', 'd', 'Escape', 'Enter', ' ', '/', 'F1']) {
      expect(isToggleKey({ key })).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// isCloseKey
// ---------------------------------------------------------------------------

describe('ControlsOverlay — isCloseKey', () => {
  it('matches Escape', () => {
    expect(isCloseKey({ key: 'Escape' })).toBe(true);
  });

  it('does not match any of the toggle keys', () => {
    expect(isCloseKey({ key: 'h' })).toBe(false);
    expect(isCloseKey({ key: 'H' })).toBe(false);
    expect(isCloseKey({ key: '?' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isEventFromTextInput + shouldIgnoreKeyEvent
// ---------------------------------------------------------------------------

/**
 * The node-only test environment does not provide `HTMLInputElement` as
 * a global. We install a tiny stub class here for the duration of the
 * describe block so we can test the `instanceof` branch without a
 * full DOM. Restored afterwards to keep the environment clean.
 */
describe('ControlsOverlay — text-input guards', () => {
  let originalInput: unknown;
  let originalTextarea: unknown;

  // Minimal stand-ins for the browser DOM element classes. Given a
  // constructor function is all that `instanceof` needs, we give them
  // a dummy readonly marker to satisfy `@typescript-eslint/no-extraneous-class`
  // without ever consulting the marker at runtime.
  class StubInput {
    readonly __stub = 'input' as const;
  }
  class StubTextarea {
    readonly __stub = 'textarea' as const;
  }

  beforeEach(() => {
    originalInput = (globalThis as { HTMLInputElement?: unknown }).HTMLInputElement;
    originalTextarea = (globalThis as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement;
    (globalThis as { HTMLInputElement?: unknown }).HTMLInputElement = StubInput;
    (globalThis as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement = StubTextarea;
  });

  afterEach(() => {
    (globalThis as { HTMLInputElement?: unknown }).HTMLInputElement = originalInput;
    (globalThis as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement = originalTextarea;
  });

  it('reports "from text input" when target is an HTMLInputElement instance', () => {
    const event: KeyboardEventLike = { key: 'h', target: new StubInput() };
    expect(isEventFromTextInput(event)).toBe(true);
    expect(shouldIgnoreKeyEvent(event)).toBe(true);
  });

  it('reports "from text input" when target is an HTMLTextAreaElement instance', () => {
    const event: KeyboardEventLike = { key: 'h', target: new StubTextarea() };
    expect(isEventFromTextInput(event)).toBe(true);
    expect(shouldIgnoreKeyEvent(event)).toBe(true);
  });

  it('reports false for a plain object target', () => {
    const event: KeyboardEventLike = { key: 'h', target: { tagName: 'DIV' } };
    expect(isEventFromTextInput(event)).toBe(false);
    expect(shouldIgnoreKeyEvent(event)).toBe(false);
  });

  it('reports false when target is null or missing', () => {
    expect(isEventFromTextInput({ key: 'h', target: null })).toBe(false);
    expect(isEventFromTextInput({ key: 'h' })).toBe(false);
    expect(shouldIgnoreKeyEvent({ key: 'h' })).toBe(false);
  });
});

describe('ControlsOverlay — text-input guards without DOM globals', () => {
  // Verifies the helper stays safe when `HTMLInputElement` is undefined
  // (which is the default in the node test environment). The helper
  // must fall through to `false` rather than throwing a ReferenceError.

  it('never throws and always returns false when DOM globals are absent', () => {
    const originalInput = (globalThis as { HTMLInputElement?: unknown }).HTMLInputElement;
    const originalTextarea = (globalThis as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement;
    delete (globalThis as { HTMLInputElement?: unknown }).HTMLInputElement;
    delete (globalThis as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement;
    try {
      expect(isEventFromTextInput({ key: 'h', target: {} })).toBe(false);
      expect(shouldIgnoreKeyEvent({ key: 'h', target: {} })).toBe(false);
    } finally {
      (globalThis as { HTMLInputElement?: unknown }).HTMLInputElement = originalInput;
      (globalThis as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement = originalTextarea;
    }
  });
});

// ---------------------------------------------------------------------------
// Style recipes — token-driven, no magic values
// ---------------------------------------------------------------------------

describe('ControlsOverlay — style recipes', () => {
  it('backdrop fills the viewport and catches pointer events', () => {
    expect(controlsBackdropStyle.position).toBe('fixed');
    expect(controlsBackdropStyle.inset).toBe(0);
    expect(controlsBackdropStyle.pointerEvents).toBe('auto');
    expect(controlsBackdropStyle.background).toBe('transparent');
    expect(typeof controlsBackdropStyle.zIndex).toBe('number');
  });

  it('panel uses BORDER, SHADOW_LG, and TEXT_PRI from tokens', () => {
    expect(controlsPanelStyle.border).toContain(BORDER);
    expect(controlsPanelStyle.boxShadow).toBe(SHADOW_LG);
    expect(controlsPanelStyle.color).toBe(TEXT_PRI);
    expect(controlsPanelStyle.fontFamily).toContain('Nunito');
  });

  it('panel slides in over DUR_NORMAL (from tokens)', () => {
    const animation = String(controlsPanelStyle.animation);
    expect(animation).toContain(`${String(DUR_NORMAL)}ms`);
    expect(animation).toContain('gbr-controls-slide-in');
    expect(animation).toContain('ease-out');
  });

  it('title uses FONT_DISPLAY', () => {
    expect(controlsTitleStyle.fontFamily).toBe(FONT_DISPLAY);
    expect(controlsTitleStyle.color).toBe(TEXT_PRI);
  });

  it('key pill uses SURFACE_EL background and BORDER', () => {
    expect(controlsKeyPillStyle.background).toBe(SURFACE_EL);
    expect(controlsKeyPillStyle.border).toContain(BORDER);
  });

  it('keyframes define the slide-in animation with a unique name', () => {
    const css = controlsKeyframes();
    expect(css).toContain('@keyframes gbr-controls-slide-in');
    expect(css).toContain('translateX(100%)');
    expect(css).toContain('translateX(0)');
    expect(css).toContain('opacity');
  });
});

describe('ControlsOverlay — quadrant diagram content', () => {
  it('has three lines of ASCII art', () => {
    const lines = CONTROLS_QUADRANT_DIAGRAM.split('\n');
    expect(lines.length).toBe(3);
  });

  it('mentions FORE, AFT, PORT, and STBD', () => {
    expect(CONTROLS_QUADRANT_DIAGRAM).toContain('FORE');
    expect(CONTROLS_QUADRANT_DIAGRAM).toContain('AFT');
    expect(CONTROLS_QUADRANT_DIAGRAM).toContain('PORT');
    expect(CONTROLS_QUADRANT_DIAGRAM).toContain('STBD');
  });

  it('has a short caption', () => {
    expect(CONTROLS_QUADRANT_CAPTION.length).toBeGreaterThan(0);
    expect(CONTROLS_QUADRANT_CAPTION.toLowerCase()).toContain('cannon');
  });
});

// ---------------------------------------------------------------------------
// Component rendering via react-dom/server
// ---------------------------------------------------------------------------

describe('ControlsOverlay — component rendering', () => {
  it('renders null on the main menu', () => {
    setPhase('mainMenu');
    const html = renderToStaticMarkup(createElement(ControlsOverlay));
    expect(html).toBe('');
  });

  it('renders null during the briefing modal', () => {
    setPhase('briefing');
    const html = renderToStaticMarkup(createElement(ControlsOverlay));
    expect(html).toBe('');
  });

  it('renders null while paused', () => {
    setPhase('paused');
    const html = renderToStaticMarkup(createElement(ControlsOverlay));
    expect(html).toBe('');
  });

  it('renders null on game-over', () => {
    setPhase('game-over');
    const html = renderToStaticMarkup(createElement(ControlsOverlay));
    expect(html).toBe('');
  });

  it('renders null while playing but closed (initial mount)', () => {
    // The overlay starts closed. Under SSR the `useEffect` key listener
    // never fires, so the component should produce empty output even
    // though the phase permits it.
    setPhase('playing');
    const html = renderToStaticMarkup(createElement(ControlsOverlay));
    expect(html).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Presentational panel — always renders, no internal gating
// ---------------------------------------------------------------------------

describe('ControlsOverlayPanel — presentational rendering', () => {
  // The presentational panel is always rendered (no phase/open gating),
  // so we can drive it directly via react-dom/server without touching
  // the stateful `ControlsOverlay` wrapper. This is the clean seam the
  // component file exposes to tests.

  const noop = (): void => undefined;
  const renderPanel = (): string =>
    renderToStaticMarkup(
      createElement(ControlsOverlayPanel, {
        onClose: noop,
        onPanelClick: noop,
      }),
    );

  it('renders the backdrop and panel containers with test ids', () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="controls-overlay"');
    expect(html).toContain('data-testid="controls-overlay-panel"');
  });

  it('renders the CONTROLS title and close button', () => {
    const html = renderPanel();
    expect(html).toContain('>CONTROLS<');
    expect(html).toContain('data-testid="controls-close"');
    expect(html).toContain('aria-label="Close controls overlay"');
  });

  it('renders a section block for every keybinding category', () => {
    const html = renderPanel();
    for (const category of KEYBINDINGS) {
      expect(html).toContain(`data-testid="controls-section-${category.id}"`);
      expect(html).toContain(`>${category.title}<`);
    }
  });

  it('renders every keybinding row (key pill + action label)', () => {
    const html = renderPanel();
    for (const category of KEYBINDINGS) {
      for (const binding of category.bindings) {
        expect(html).toContain(binding.action);
        // Each row has a unique data-testid so Playwright / the future
        // SettingsModal can target them precisely.
        expect(html).toContain(`data-testid="controls-row-${category.id}-${binding.key}"`);
      }
    }
  });

  it('renders the quadrant diagram and caption', () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="controls-quadrant-diagram"');
    expect(html).toContain('FORE');
    expect(html).toContain('AFT');
    expect(html).toContain('PORT');
    expect(html).toContain('STBD');
    expect(html).toContain(CONTROLS_QUADRANT_CAPTION);
  });

  it('marks the overlay as a dialog for assistive tech', () => {
    const html = renderPanel();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Keyboard controls"');
  });

  it('inlines the slide-in keyframes block', () => {
    const html = renderPanel();
    expect(html).toContain('@keyframes gbr-controls-slide-in');
  });
});
