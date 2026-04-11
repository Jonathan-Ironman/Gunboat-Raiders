/**
 * Unit tests for `src/ui/WeaponHeatBar.tsx` — R13 slice.
 *
 * The WeaponHeatBar is a centered HUD readout that visualizes the player's
 * weapon overheat ratio (`player.weapons.heat`) as an inverted-fill bar
 * with three color brackets and an `OVERHEATED` pulse label. These tests
 * cover:
 *
 * 1. The pure helpers in `weaponHeatBar.helpers.ts` — heat-to-bracket
 *    mapping, inverted fill math, label switch, and the token-driven
 *    gradient / style outputs.
 * 2. The React component itself, rendered through `react-dom/server` so we
 *    can assert phase gating, test ids, aria attributes, and data attributes
 *    without mounting a DOM.
 * 3. Token usage — assert that colors, fonts, radius, and motion values
 *    come from `src/ui/tokens.ts` and not from magic numbers inside the
 *    helper / component files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  BAR_BOTTOM_REM,
  BAR_HEIGHT_PX,
  BAR_WIDTH_PX,
  buildContainerStyle,
  buildFillStyle,
  buildLabelStyle,
  buildTrackStyle,
  computeHeatBarState,
  HEAT_COOL_GRADIENT,
  HEAT_COOL_MAX,
  HEAT_HOT_GRADIENT,
  HEAT_OVERHEATED_THRESHOLD,
  HEAT_WARM_GRADIENT,
  HEAT_WARM_MAX,
  LABEL_FONT_SIZE_PX,
  LABEL_LETTER_SPACING_EM,
  normalizeHeat,
  OVERHEAT_PULSE_ANIMATION_NAME,
  OVERHEAT_PULSE_CLASS,
  OVERHEAT_PULSE_DURATION_MS,
  weaponHeatBarKeyframes,
} from '@/ui/weaponHeatBar.helpers';
import {
  BG_DEEP,
  BORDER_SUB,
  DUR_NORMAL,
  FONT_UI,
  GOLD,
  GOLD_DARK,
  RADIUS_SM,
  RED,
  RED_DARK,
  TEAL,
  TEAL_DARK,
  TEXT_MUTED,
} from '@/ui/tokens';

// ---------------------------------------------------------------------------
// Mock the store selectors module — the component uses `useGamePhase` and
// `usePlayerWeaponHeat` to source its inputs. We want direct control over
// both without depending on React's `useSyncExternalStore` behavior under
// `react-dom/server` (which does not play well with real Zustand hooks).
// ---------------------------------------------------------------------------

type MockPhase = 'mainMenu' | 'briefing' | 'playing' | 'wave-clear' | 'paused' | 'game-over';

const mockState: { phase: MockPhase; heat: number } = {
  phase: 'mainMenu',
  heat: 0,
};

vi.mock('@/store/selectors', () => ({
  useGamePhase: () => mockState.phase,
  usePlayerWeaponHeat: () => mockState.heat,
  // The component only consumes the two above, but keep the surface area
  // complete so an accidental import doesn't blow up.
  usePlayerHealth: () => null,
  useWaveNumber: () => 0,
  useScore: () => 0,
  useEnemiesRemaining: () => 0,
  useEnemiesSunkTotal: () => 0,
}));

import { WeaponHeatBar } from '@/ui/WeaponHeatBar';

function setMockState(phase: MockPhase, heat: number): void {
  mockState.phase = phase;
  mockState.heat = heat;
}

beforeEach(() => {
  setMockState('mainMenu', 0);
});

// ---------------------------------------------------------------------------
// normalizeHeat
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — normalizeHeat', () => {
  it('passes through valid unit-interval values', () => {
    expect(normalizeHeat(0)).toBe(0);
    expect(normalizeHeat(0.4)).toBe(0.4);
    expect(normalizeHeat(1)).toBe(1);
  });

  it('clamps out-of-range values into [0, 1]', () => {
    expect(normalizeHeat(-0.5)).toBe(0);
    expect(normalizeHeat(2)).toBe(1);
  });

  it('coerces non-finite inputs to 0', () => {
    expect(normalizeHeat(Number.NaN)).toBe(0);
    expect(normalizeHeat(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeHeat(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeHeatBarState — bracket mapping, inverted fill, label switch
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — computeHeatBarState brackets', () => {
  it('classifies heat = 0 as cool with full drained fill', () => {
    const s = computeHeatBarState(0);
    expect(s.heatBracket).toBe('cool');
    expect(s.gradientCss).toBe(HEAT_COOL_GRADIENT);
    expect(s.fillWidthPct).toBe(100);
    expect(s.labelText).toBe('HEAT');
    expect(s.isOverheated).toBe(false);
  });

  it('classifies heat = 0.4 as cool (teal)', () => {
    const s = computeHeatBarState(0.4);
    expect(s.heatBracket).toBe('cool');
    expect(s.gradientCss).toBe(HEAT_COOL_GRADIENT);
    // Inverted fill: (1 - 0.4) * 100 = 60.
    expect(s.fillWidthPct).toBeCloseTo(60, 10);
  });

  it('classifies heat exactly at HEAT_COOL_MAX (0.5) as cool (inclusive upper bound)', () => {
    expect(HEAT_COOL_MAX).toBe(0.5);
    const s = computeHeatBarState(HEAT_COOL_MAX);
    expect(s.heatBracket).toBe('cool');
    expect(s.gradientCss).toBe(HEAT_COOL_GRADIENT);
  });

  it('classifies heat = 0.6 as warm (gold)', () => {
    const s = computeHeatBarState(0.6);
    expect(s.heatBracket).toBe('warm');
    expect(s.gradientCss).toBe(HEAT_WARM_GRADIENT);
    expect(s.fillWidthPct).toBeCloseTo(40, 10);
    expect(s.labelText).toBe('HEAT');
    expect(s.isOverheated).toBe(false);
  });

  it('classifies heat exactly at HEAT_WARM_MAX (0.75) as warm (inclusive upper bound)', () => {
    expect(HEAT_WARM_MAX).toBe(0.75);
    const s = computeHeatBarState(HEAT_WARM_MAX);
    expect(s.heatBracket).toBe('warm');
    expect(s.gradientCss).toBe(HEAT_WARM_GRADIENT);
  });

  it('classifies heat = 0.85 as hot (red) with HEAT label still', () => {
    const s = computeHeatBarState(0.85);
    expect(s.heatBracket).toBe('hot');
    expect(s.gradientCss).toBe(HEAT_HOT_GRADIENT);
    expect(s.fillWidthPct).toBeCloseTo(15, 10);
    expect(s.labelText).toBe('HEAT');
    expect(s.isOverheated).toBe(false);
  });

  it('classifies heat exactly at HEAT_OVERHEATED_THRESHOLD (0.9) as hot but NOT overheated (strict >)', () => {
    expect(HEAT_OVERHEATED_THRESHOLD).toBe(0.9);
    const s = computeHeatBarState(HEAT_OVERHEATED_THRESHOLD);
    expect(s.heatBracket).toBe('hot');
    expect(s.labelText).toBe('HEAT');
    expect(s.isOverheated).toBe(false);
  });

  it('classifies heat = 0.95 as hot AND overheated (label + pulse)', () => {
    const s = computeHeatBarState(0.95);
    expect(s.heatBracket).toBe('hot');
    expect(s.gradientCss).toBe(HEAT_HOT_GRADIENT);
    expect(s.fillWidthPct).toBeCloseTo(5, 10);
    expect(s.labelText).toBe('OVERHEATED');
    expect(s.isOverheated).toBe(true);
  });

  it('classifies heat = 1.0 as hot AND overheated with zero fill', () => {
    const s = computeHeatBarState(1);
    expect(s.heatBracket).toBe('hot');
    expect(s.fillWidthPct).toBe(0);
    expect(s.labelText).toBe('OVERHEATED');
    expect(s.isOverheated).toBe(true);
  });

  it('treats NaN / negative / > 1 inputs as clamped heat', () => {
    expect(computeHeatBarState(Number.NaN).fillWidthPct).toBe(100);
    expect(computeHeatBarState(-5).fillWidthPct).toBe(100);
    expect(computeHeatBarState(17).fillWidthPct).toBe(0);
    expect(computeHeatBarState(17).isOverheated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gradient recipes — token-driven
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — gradient recipes', () => {
  it('cool gradient composes from TEAL and TEAL_DARK tokens', () => {
    expect(HEAT_COOL_GRADIENT).toContain(TEAL);
    expect(HEAT_COOL_GRADIENT).toContain(TEAL_DARK);
    expect(HEAT_COOL_GRADIENT).toMatch(/^linear-gradient\(90deg,/);
  });

  it('warm gradient composes from GOLD and GOLD_DARK tokens', () => {
    expect(HEAT_WARM_GRADIENT).toContain(GOLD);
    expect(HEAT_WARM_GRADIENT).toContain(GOLD_DARK);
    expect(HEAT_WARM_GRADIENT).toMatch(/^linear-gradient\(90deg,/);
  });

  it('hot gradient composes from RED and RED_DARK tokens', () => {
    expect(HEAT_HOT_GRADIENT).toContain(RED);
    expect(HEAT_HOT_GRADIENT).toContain(RED_DARK);
    expect(HEAT_HOT_GRADIENT).toMatch(/^linear-gradient\(90deg,/);
  });
});

// ---------------------------------------------------------------------------
// Style builders — tokens, layout, transitions
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — buildContainerStyle', () => {
  it('positions the bar at bottom 6.5rem, horizontally centered', () => {
    const style = buildContainerStyle();
    expect(BAR_BOTTOM_REM).toBe(6.5);
    expect(style.position).toBe('absolute');
    expect(style.bottom).toBe('6.5rem');
    expect(style.left).toBe('50%');
    expect(style.transform).toBe('translateX(-50%)');
  });

  it('uses FONT_UI from tokens and the 240px locked width', () => {
    const style = buildContainerStyle();
    expect(style.fontFamily).toBe(FONT_UI);
    expect(BAR_WIDTH_PX).toBe(240);
    expect(style.width).toBe('240px');
  });

  it('is a non-interactive HUD readout (no pointer events, no selection)', () => {
    const style = buildContainerStyle();
    expect(style.pointerEvents).toBe('none');
    expect(style.userSelect).toBe('none');
  });

  it('stacks the label above the track', () => {
    const style = buildContainerStyle();
    expect(style.display).toBe('flex');
    expect(style.flexDirection).toBe('column');
    expect(style.alignItems).toBe('center');
  });
});

describe('WeaponHeatBar — buildLabelStyle', () => {
  it('uses TEXT_MUTED and tokens for the normal label style', () => {
    const style = buildLabelStyle(false);
    expect(style.color).toBe(TEXT_MUTED);
    expect(style.fontFamily).toBe(FONT_UI);
    expect(style.fontSize).toBe(`${String(LABEL_FONT_SIZE_PX)}px`);
    expect(style.fontWeight).toBe(800);
    expect(style.letterSpacing).toBe(`${String(LABEL_LETTER_SPACING_EM)}em`);
    expect(style.textTransform).toBe('uppercase');
  });

  it('flips the color to RED when overheated', () => {
    const style = buildLabelStyle(true);
    expect(style.color).toBe(RED);
  });

  it('transitions the color change over DUR_NORMAL ease-out', () => {
    const style = buildLabelStyle(false);
    expect(String(style.transition)).toContain(`${String(DUR_NORMAL)}ms`);
    expect(String(style.transition)).toContain('ease-out');
    expect(String(style.transition)).toContain('color');
  });
});

describe('WeaponHeatBar — buildTrackStyle', () => {
  it('renders a 240×12 px shell with BG_DEEP background and BORDER_SUB border', () => {
    const style = buildTrackStyle();
    expect(style.width).toBe('240px');
    expect(style.height).toBe(`${String(BAR_HEIGHT_PX)}px`);
    expect(BAR_HEIGHT_PX).toBe(12);
    expect(style.background).toBe(BG_DEEP);
    expect(style.border).toBe(`1px solid ${BORDER_SUB}`);
  });

  it('uses RADIUS_SM for the container border-radius, with zero padding', () => {
    const style = buildTrackStyle();
    expect(RADIUS_SM).toBe(4);
    expect(style.borderRadius).toBe(`${String(RADIUS_SM)}px`);
    expect(style.padding).toBe(0);
    expect(style.overflow).toBe('hidden');
  });
});

describe('WeaponHeatBar — buildFillStyle', () => {
  it('applies the fill width from computed state as a percentage', () => {
    const fill = buildFillStyle(computeHeatBarState(0.25));
    // 0.25 heat → 75% drained fill.
    expect(fill.width).toBe('75%');
  });

  it('applies the hot gradient for high heat', () => {
    const fill = buildFillStyle(computeHeatBarState(0.85));
    expect(fill.background).toBe(HEAT_HOT_GRADIENT);
  });

  it('transitions both width and background over DUR_NORMAL ease-out (smooth lerp)', () => {
    const fill = buildFillStyle(computeHeatBarState(0.5));
    const t = String(fill.transition);
    expect(t).toContain(`width ${String(DUR_NORMAL)}ms ease-out`);
    expect(t).toContain(`background ${String(DUR_NORMAL)}ms ease-out`);
  });

  it('uses RADIUS_SM for the fill corners to match the track', () => {
    const fill = buildFillStyle(computeHeatBarState(0.2));
    expect(fill.borderRadius).toBe(`${String(RADIUS_SM)}px`);
  });
});

// ---------------------------------------------------------------------------
// weaponHeatBarKeyframes — pulse animation
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — weaponHeatBarKeyframes', () => {
  it('defines the pulse keyframes animation block', () => {
    const css = weaponHeatBarKeyframes();
    expect(css).toContain(`@keyframes ${OVERHEAT_PULSE_ANIMATION_NAME}`);
    // Spec: opacity pulses 0.5 → 1.0.
    expect(css).toContain('opacity: 0.5');
    expect(css).toContain('opacity: 1');
  });

  it('binds the animation to the pulse class on a 600ms alternate-infinite cycle', () => {
    const css = weaponHeatBarKeyframes();
    expect(OVERHEAT_PULSE_DURATION_MS).toBe(600);
    expect(css).toContain(`.${OVERHEAT_PULSE_CLASS}`);
    expect(css).toContain(`${String(OVERHEAT_PULSE_DURATION_MS)}ms`);
    expect(css).toContain('infinite');
    expect(css).toContain('alternate');
    expect(css).toContain('ease-out');
  });
});

// ---------------------------------------------------------------------------
// React component — phase gating & rendering through react-dom/server
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — component phase gating', () => {
  it('renders null on the main menu', () => {
    setMockState('mainMenu', 0.5);
    expect(renderToStaticMarkup(createElement(WeaponHeatBar))).toBe('');
  });

  it('renders null during briefing', () => {
    setMockState('briefing', 0.5);
    expect(renderToStaticMarkup(createElement(WeaponHeatBar))).toBe('');
  });

  it('renders null during game-over', () => {
    setMockState('game-over', 0.8);
    expect(renderToStaticMarkup(createElement(WeaponHeatBar))).toBe('');
  });

  it('renders during playing', () => {
    setMockState('playing', 0.2);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-testid="weapon-heat-bar"');
  });

  it('renders during wave-clear (bar stays visible between waves)', () => {
    setMockState('wave-clear', 0.2);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-testid="weapon-heat-bar"');
  });

  it('renders during paused (bar stays visible behind pause overlay)', () => {
    setMockState('paused', 0.2);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-testid="weapon-heat-bar"');
  });
});

// ---------------------------------------------------------------------------
// React component — visual state reflected in the DOM
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — component output', () => {
  it('exposes cool bracket at low heat and renders the HEAT label', () => {
    setMockState('playing', 0.3);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-heat-bracket="cool"');
    expect(html).toContain('data-overheated="off"');
    expect(html).toContain('>HEAT<');
    // Inverted fill: 0.3 heat → 70% width.
    expect(html).toContain('width:70%');
  });

  it('exposes warm bracket at mid heat', () => {
    setMockState('playing', 0.6);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-heat-bracket="warm"');
    expect(html).toContain('data-overheated="off"');
    expect(html).toContain('>HEAT<');
    expect(html).toContain('width:40%');
  });

  it('exposes hot bracket with HEAT label at heat = 0.85', () => {
    setMockState('playing', 0.85);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-heat-bracket="hot"');
    expect(html).toContain('data-overheated="off"');
    expect(html).toContain('>HEAT<');
    expect(html).toContain('width:15%');
  });

  it('switches to OVERHEATED label and on pulse class when heat > 0.9', () => {
    setMockState('playing', 0.95);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-heat-bracket="hot"');
    expect(html).toContain('data-overheated="on"');
    expect(html).toContain('>OVERHEATED<');
    expect(html).toContain(`class="${OVERHEAT_PULSE_CLASS}"`);
    // And the keyframes <style> block must be present so the animation resolves.
    expect(html).toContain(`@keyframes ${OVERHEAT_PULSE_ANIMATION_NAME}`);
  });

  it('does NOT apply the pulse class at exactly the threshold (0.9)', () => {
    setMockState('playing', 0.9);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-overheated="off"');
    expect(html).toContain('>HEAT<');
    expect(html).not.toContain(`class="${OVERHEAT_PULSE_CLASS}"`);
  });

  it('is a non-interactive readout (aria-hidden, pointer-events none)', () => {
    setMockState('playing', 0.5);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('pointer-events:none');
  });

  it('renders the track and fill children with their dedicated test ids', () => {
    setMockState('playing', 0.5);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-testid="weapon-heat-bar"');
    expect(html).toContain('data-testid="weapon-heat-bar-label"');
    expect(html).toContain('data-testid="weapon-heat-bar-track"');
    expect(html).toContain('data-testid="weapon-heat-bar-fill"');
  });
});
