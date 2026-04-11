/**
 * Unit tests for `src/ui/LowHullWarning.tsx` — R14 slice.
 *
 * The LowHullWarning component renders a full-viewport radial-gradient
 * vignette whenever the player's hull drops below the Harbour Dawn
 * critical threshold. These tests cover:
 *
 * 1. The pure helpers (`shouldShowLowHullWarning`, `computeLowHullIntensity`,
 *    `lowHullOverlayStyle`) that encapsulate the thresholding and styling
 *    logic, so the decision rules are verifiable in a headless node env.
 * 2. The React component itself, rendered through `react-dom/server` so we
 *    can assert the actual DOM output for each phase / health combination
 *    without needing a browser-like test environment.
 * 3. Token usage — assert that colors, thresholds, and motion values come
 *    from `src/ui/tokens.ts` and not from magic numbers inside the
 *    component file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  computeLowHullIntensity,
  hexToRgba,
  lowHullKeyframes,
  lowHullOverlayStyle,
  shouldShowLowHullWarning,
} from '@/ui/lowHullWarning.helpers';
import { HULL_CRITICAL_THRESHOLD, RED_DARK } from '@/ui/tokens';

// ---------------------------------------------------------------------------
// Mock the store selectors module so we can drive the component through
// tightly controlled return values without depending on React's server-
// side `useSyncExternalStore` snapshot behavior (which does not play well
// with Zustand hooks under `react-dom/server`).
// ---------------------------------------------------------------------------

type MockHealth = { hull: number; hullMax: number; armor: number; armorMax: number };
type MockPhase = 'title' | 'playing' | 'wave-clear' | 'game-over';

const mockState: { phase: MockPhase; health: MockHealth | null } = {
  phase: 'title',
  health: null,
};

vi.mock('@/store/selectors', () => ({
  useGamePhase: () => mockState.phase,
  usePlayerHealth: () => mockState.health,
  useWaveNumber: () => 0,
  useScore: () => 0,
  useEnemiesRemaining: () => 0,
  useEnemiesSunkTotal: () => 0,
}));

// Import the component AFTER the mock so it picks up the mocked selectors.
// Using a dynamic `await import(...)` would work too, but top-level mocks
// are hoisted by vitest so a normal static import is sufficient here.
import { LowHullWarning } from '@/ui/LowHullWarning';

function setMockState(phase: MockPhase, health: MockHealth | null): void {
  mockState.phase = phase;
  mockState.health = health;
}

function resetMockState(): void {
  setMockState('title', null);
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetMockState();
});

function enterPlayingPhaseWithHull(hull: number, hullMax = 100): void {
  setMockState('playing', { hull, hullMax, armor: 0, armorMax: 100 });
}

// ---------------------------------------------------------------------------
// shouldShowLowHullWarning
// ---------------------------------------------------------------------------

describe('LowHullWarning — shouldShowLowHullWarning', () => {
  it('returns true when hull ratio is strictly below the critical threshold', () => {
    expect(shouldShowLowHullWarning(29, 100)).toBe(true);
    expect(shouldShowLowHullWarning(1, 100)).toBe(true);
  });

  it('returns false at exactly the critical threshold (30%)', () => {
    // 30/100 = 0.3 = HULL_CRITICAL_THRESHOLD → strictly less than is false.
    expect(HULL_CRITICAL_THRESHOLD).toBe(0.3);
    expect(shouldShowLowHullWarning(30, 100)).toBe(false);
  });

  it('returns false when hull is above the critical threshold', () => {
    expect(shouldShowLowHullWarning(50, 100)).toBe(false);
    expect(shouldShowLowHullWarning(100, 100)).toBe(false);
  });

  it('returns true when hull has reached zero (maximum danger)', () => {
    expect(shouldShowLowHullWarning(0, 100)).toBe(true);
  });

  it('returns false for degenerate inputs (hullMax<=0, NaN, Infinity)', () => {
    expect(shouldShowLowHullWarning(10, 0)).toBe(false);
    expect(shouldShowLowHullWarning(10, -1)).toBe(false);
    expect(shouldShowLowHullWarning(Number.NaN, 100)).toBe(false);
    expect(shouldShowLowHullWarning(50, Number.NaN)).toBe(false);
    expect(shouldShowLowHullWarning(Number.POSITIVE_INFINITY, 100)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeLowHullIntensity
// ---------------------------------------------------------------------------

describe('LowHullWarning — computeLowHullIntensity', () => {
  it('returns 0 when hull is at or above the critical threshold', () => {
    expect(computeLowHullIntensity(30, 100)).toBe(0);
    expect(computeLowHullIntensity(50, 100)).toBe(0);
    expect(computeLowHullIntensity(100, 100)).toBe(0);
  });

  it('returns 1 when hull is at zero (or negative)', () => {
    expect(computeLowHullIntensity(0, 100)).toBe(1);
    expect(computeLowHullIntensity(-5, 100)).toBe(1);
  });

  it('linearly ramps opacity intensity between zero and the threshold', () => {
    // At 15% hull (half of 30% threshold) we expect intensity ≈ 0.5.
    expect(computeLowHullIntensity(15, 100)).toBeCloseTo(0.5, 5);
    // At 6% hull (20% of 30% threshold) intensity ≈ 0.8.
    expect(computeLowHullIntensity(6, 100)).toBeCloseTo(0.8, 5);
    // At 24% hull (80% of 30% threshold) intensity ≈ 0.2.
    expect(computeLowHullIntensity(24, 100)).toBeCloseTo(0.2, 5);
  });

  it('intensity is monotonic decreasing as hull increases', () => {
    const samples = [0, 5, 10, 15, 20, 25, 29];
    const intensities = samples.map((h) => computeLowHullIntensity(h, 100));
    for (let i = 1; i < intensities.length; i++) {
      const current = intensities[i];
      const previous = intensities[i - 1];
      if (current === undefined || previous === undefined) {
        throw new Error('unreachable: intensities array is fully populated');
      }
      expect(current).toBeLessThan(previous);
    }
  });

  it('returns 0 for degenerate inputs', () => {
    expect(computeLowHullIntensity(10, 0)).toBe(0);
    expect(computeLowHullIntensity(Number.NaN, 100)).toBe(0);
    expect(computeLowHullIntensity(10, Number.NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// hexToRgba
// ---------------------------------------------------------------------------

describe('LowHullWarning — hexToRgba', () => {
  it('converts a 6-digit hex color with an alpha channel', () => {
    // RED_DARK is '#cc3333' → rgb(204, 51, 51).
    expect(hexToRgba('#cc3333', 0.35)).toBe('rgba(204, 51, 51, 0.35)');
  });

  it('clamps alpha into [0, 1]', () => {
    expect(hexToRgba('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
    expect(hexToRgba('#ffffff', 2)).toBe('rgba(255, 255, 255, 1)');
  });
});

// ---------------------------------------------------------------------------
// lowHullOverlayStyle
// ---------------------------------------------------------------------------

describe('LowHullWarning — lowHullOverlayStyle', () => {
  it('lays out as a full-viewport, pointer-events-none overlay', () => {
    const style = lowHullOverlayStyle(1);
    expect(style.position).toBe('fixed');
    expect(style.inset).toBe(0);
    expect(style.pointerEvents).toBe('none');
    // Middle z-index so overlay sits above the canvas but below HUD widgets.
    expect(style.zIndex).toBe(5);
  });

  it('uses RED_DARK (tokens) as the vignette color', () => {
    const style = lowHullOverlayStyle(1);
    // Token-driven: the background must derive from RED_DARK's RGB.
    const { r, g, b } = parseHex(RED_DARK);
    expect(style.background).toContain(`rgba(${String(r)}, ${String(g)}, ${String(b)}`);
    expect(style.background).toContain('radial-gradient');
    expect(style.background).toContain('ellipse at center');
  });

  it('scales the peak alpha proportional to intensity', () => {
    const full = lowHullOverlayStyle(1);
    const half = lowHullOverlayStyle(0.5);
    const zero = lowHullOverlayStyle(0);

    // At intensity 1.0 the peak alpha is 0.35 (VIGNETTE_PEAK_ALPHA).
    expect(full.background).toContain('0.35');
    // At intensity 0.5 the peak alpha is 0.175.
    expect(half.background).toContain('0.175');
    // At intensity 0 the alpha is 0.
    expect(zero.background).toContain(', 0)');
  });

  it('exposes intensity as a CSS custom property for the keyframes', () => {
    expect(lowHullOverlayStyle(0.42)['--gbr-low-hull-intensity']).toBe('0.42');
    expect(lowHullOverlayStyle(0)['--gbr-low-hull-intensity']).toBe('0');
    expect(lowHullOverlayStyle(1)['--gbr-low-hull-intensity']).toBe('1');
  });

  it('clamps intensity input into [0, 1]', () => {
    expect(lowHullOverlayStyle(-5)['--gbr-low-hull-intensity']).toBe('0');
    expect(lowHullOverlayStyle(9)['--gbr-low-hull-intensity']).toBe('1');
  });

  it('references the shared pulse animation with a token-derived duration', () => {
    const style = lowHullOverlayStyle(1);
    // DUR_SLOW is 500ms, full pulse period is 2 * DUR_SLOW = 1000ms.
    expect(style.animation).toContain('gbr-low-hull-pulse');
    expect(style.animation).toContain('1000ms');
    expect(style.animation).toContain('ease-out');
    expect(style.animation).toContain('infinite');
    expect(style.animation).toContain('alternate');
  });
});

// ---------------------------------------------------------------------------
// lowHullKeyframes
// ---------------------------------------------------------------------------

describe('LowHullWarning — lowHullKeyframes', () => {
  it('defines a keyframes block that reads the CSS custom property', () => {
    const css = lowHullKeyframes();
    expect(css).toContain('@keyframes gbr-low-hull-pulse');
    expect(css).toContain('var(--gbr-low-hull-intensity');
    // Pulse should ramp from 0.5 * intensity to 1.0 * intensity.
    expect(css).toContain('* 0.5');
    expect(css).toContain('* 1');
  });
});

// ---------------------------------------------------------------------------
// React component — phase gating & rendering through react-dom/server
// ---------------------------------------------------------------------------

describe('LowHullWarning — component rendering', () => {
  it('renders null on the title screen (phase != playing/wave-clear)', () => {
    // Phase starts as 'title' after resetGame — no render expected even if
    // hull happened to be low.
    const html = renderToStaticMarkup(createElement(LowHullWarning));
    expect(html).toBe('');
  });

  it('renders null when phase is playing but hull is above the threshold', () => {
    enterPlayingPhaseWithHull(50);
    const html = renderToStaticMarkup(createElement(LowHullWarning));
    expect(html).toBe('');
  });

  it('renders null at the exact threshold (30%)', () => {
    enterPlayingPhaseWithHull(30);
    const html = renderToStaticMarkup(createElement(LowHullWarning));
    expect(html).toBe('');
  });

  it('renders the vignette when hull drops below the threshold (25%)', () => {
    enterPlayingPhaseWithHull(25);
    const html = renderToStaticMarkup(createElement(LowHullWarning));
    expect(html).toContain('data-testid="low-hull-warning"');
    expect(html).toContain('radial-gradient');
    expect(html).toContain('pointer-events:none');
    expect(html).toContain('position:fixed');
    expect(html).toContain('@keyframes gbr-low-hull-pulse');
  });

  it('increases visible intensity as hull drops', () => {
    enterPlayingPhaseWithHull(29);
    const htmlSubtle = renderToStaticMarkup(createElement(LowHullWarning));
    enterPlayingPhaseWithHull(3);
    const htmlSevere = renderToStaticMarkup(createElement(LowHullWarning));

    const subtleIntensity = extractCustomProperty(htmlSubtle, '--gbr-low-hull-intensity');
    const severeIntensity = extractCustomProperty(htmlSevere, '--gbr-low-hull-intensity');

    expect(subtleIntensity).toBeGreaterThan(0);
    expect(severeIntensity).toBeGreaterThan(subtleIntensity);
    expect(severeIntensity).toBeLessThanOrEqual(1);
  });

  it('renders null when hull hits zero IF the game has transitioned to game-over', () => {
    // The hull-zero rule should only suppress the vignette via the phase
    // gate (game-over is not 'playing' / 'wave-clear'), never via the
    // helper — the helper always reports true for hull 0.
    expect(shouldShowLowHullWarning(0, 100)).toBe(true);

    // Simulate the moment-of-death transition: hull has dropped to zero
    // and the phase has already flipped to 'game-over'. The component
    // must self-gate to suppress the vignette in this phase.
    setMockState('game-over', { hull: 0, hullMax: 100, armor: 0, armorMax: 100 });

    const html = renderToStaticMarkup(createElement(LowHullWarning));
    expect(html).toBe('');
  });

  it('still renders during wave-clear if hull is critical', () => {
    // The HUD keeps rendering during 'wave-clear' so the vignette must
    // also remain visible to preserve continuity across wave boundaries.
    setMockState('wave-clear', { hull: 10, hullMax: 100, armor: 0, armorMax: 100 });
    const html = renderToStaticMarkup(createElement(LowHullWarning));
    expect(html).toContain('data-testid="low-hull-warning"');
  });

  it('is hidden from assistive tech via aria-hidden', () => {
    enterPlayingPhaseWithHull(10);
    const html = renderToStaticMarkup(createElement(LowHullWarning));
    expect(html).toContain('aria-hidden="true"');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parses a `#rrggbb` hex string into its integer RGB channels. */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Extracts the numeric value of a CSS custom property from a serialized
 * HTML string. `react-dom/server` emits inline styles like
 * `style="--gbr-low-hull-intensity:0.5;..."`, so we can grep for the
 * property by name and parse the number.
 */
function extractCustomProperty(html: string, name: string): number {
  const escaped = name.replace(/-/g, '\\-');
  const re = new RegExp(`${escaped}\\s*:\\s*([0-9.]+)`);
  const match = re.exec(html);
  const captured = match?.[1];
  if (captured === undefined) {
    throw new Error(`Custom property ${name} not found in HTML: ${html}`);
  }
  return Number(captured);
}
