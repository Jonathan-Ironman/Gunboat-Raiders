/**
 * Unit tests for `src/ui/WeaponHeatBar.tsx`.
 *
 * Post playtest 2026-04-11: the heat bar is a SEGMENTED row of discrete
 * blocks (N = HEAT_SEGMENT_COUNT) stacked at the top-left of the HUD.
 * Color bracket and the `HEAT` / `OVERHEATED` label behaviors are
 * unchanged; the fill mechanic is what flipped.
 *
 * Coverage:
 * 1. Pure helpers in `weaponHeatBar.helpers.ts` — heat-to-bracket,
 *    segment-fill math, label switch, token-driven gradients/styles.
 * 2. The React component (via `react-dom/server`) for phase gating,
 *    test ids, aria attributes, segment rendering, data attributes.
 * 3. Token usage — colors, fonts, radius, motion values all come from
 *    `src/ui/tokens.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  BAR_LEFT_REM,
  BAR_TOP_REM,
  buildContainerStyle,
  buildLabelStyle,
  buildSegmentStyle,
  buildTrackStyle,
  computeHeatBarState,
  HEAT_COOL_GRADIENT,
  HEAT_COOL_MAX,
  HEAT_HOT_GRADIENT,
  HEAT_OVERHEATED_THRESHOLD,
  HEAT_SEGMENT_COUNT,
  HEAT_WARM_GRADIENT,
  HEAT_WARM_MAX,
  LABEL_FONT_SIZE_PX,
  LABEL_LETTER_SPACING_EM,
  normalizeHeat,
  OVERHEAT_PULSE_ANIMATION_NAME,
  OVERHEAT_PULSE_CLASS,
  OVERHEAT_PULSE_DURATION_MS,
  SEGMENT_GAP_PX,
  SEGMENT_HEIGHT_PX,
  SEGMENT_RADIUS_PX,
  SEGMENT_WIDTH_PX,
  TRACK_WIDTH_PX,
  weaponHeatBarKeyframes,
} from '@/ui/weaponHeatBar.helpers';
import {
  BG_DEEP,
  BORDER_SUB,
  DUR_NORMAL,
  FONT_UI,
  GOLD,
  GOLD_DARK,
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
// computeHeatBarState — bracket mapping, segment fill, label switch
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — computeHeatBarState brackets', () => {
  it('classifies heat = 0 as cool with ZERO filled segments', () => {
    const s = computeHeatBarState(0);
    expect(s.heatBracket).toBe('cool');
    expect(s.gradientCss).toBe(HEAT_COOL_GRADIENT);
    expect(s.filledSegments).toBe(0);
    expect(s.labelText).toBe('HEAT');
    expect(s.isOverheated).toBe(false);
  });

  it('classifies heat = 0.4 as cool with 4/10 segments', () => {
    const s = computeHeatBarState(0.4);
    expect(s.heatBracket).toBe('cool');
    expect(s.gradientCss).toBe(HEAT_COOL_GRADIENT);
    expect(s.filledSegments).toBe(4);
  });

  it('classifies heat exactly at HEAT_COOL_MAX (0.5) as cool (inclusive upper bound)', () => {
    expect(HEAT_COOL_MAX).toBe(0.5);
    const s = computeHeatBarState(HEAT_COOL_MAX);
    expect(s.heatBracket).toBe('cool');
    expect(s.gradientCss).toBe(HEAT_COOL_GRADIENT);
    expect(s.filledSegments).toBe(5);
  });

  it('classifies heat = 0.6 as warm (gold) with 6/10 segments', () => {
    const s = computeHeatBarState(0.6);
    expect(s.heatBracket).toBe('warm');
    expect(s.gradientCss).toBe(HEAT_WARM_GRADIENT);
    expect(s.filledSegments).toBe(6);
    expect(s.labelText).toBe('HEAT');
    expect(s.isOverheated).toBe(false);
  });

  it('classifies heat exactly at HEAT_WARM_MAX (0.75) as warm (inclusive upper bound)', () => {
    expect(HEAT_WARM_MAX).toBe(0.75);
    const s = computeHeatBarState(HEAT_WARM_MAX);
    expect(s.heatBracket).toBe('warm');
    expect(s.gradientCss).toBe(HEAT_WARM_GRADIENT);
    // 0.75 × 10 = 7.5 → rounds to 8.
    expect(s.filledSegments).toBe(8);
  });

  it('classifies heat = 0.85 as hot (red) with 8–9 filled segments and HEAT label still', () => {
    const s = computeHeatBarState(0.85);
    expect(s.heatBracket).toBe('hot');
    expect(s.gradientCss).toBe(HEAT_HOT_GRADIENT);
    // 0.85 × 10 = 8.5 → rounds to 9 under banker-free round-half-up.
    expect(s.filledSegments).toBe(9);
    expect(s.labelText).toBe('HEAT');
    expect(s.isOverheated).toBe(false);
  });

  it('classifies heat exactly at HEAT_OVERHEATED_THRESHOLD (0.9) as hot but NOT overheated (strict >)', () => {
    expect(HEAT_OVERHEATED_THRESHOLD).toBe(0.9);
    const s = computeHeatBarState(HEAT_OVERHEATED_THRESHOLD);
    expect(s.heatBracket).toBe('hot');
    expect(s.labelText).toBe('HEAT');
    expect(s.isOverheated).toBe(false);
    expect(s.filledSegments).toBe(9);
  });

  it('classifies heat = 0.95 as hot AND overheated (label + pulse) with 10 segments', () => {
    const s = computeHeatBarState(0.95);
    expect(s.heatBracket).toBe('hot');
    expect(s.gradientCss).toBe(HEAT_HOT_GRADIENT);
    expect(s.filledSegments).toBe(10);
    expect(s.labelText).toBe('OVERHEATED');
    expect(s.isOverheated).toBe(true);
  });

  it('classifies heat = 1.0 as hot AND overheated with all segments filled', () => {
    const s = computeHeatBarState(1);
    expect(s.heatBracket).toBe('hot');
    expect(s.filledSegments).toBe(HEAT_SEGMENT_COUNT);
    expect(s.labelText).toBe('OVERHEATED');
    expect(s.isOverheated).toBe(true);
  });

  it('treats NaN / negative / > 1 inputs as clamped heat', () => {
    expect(computeHeatBarState(Number.NaN).filledSegments).toBe(0);
    expect(computeHeatBarState(-5).filledSegments).toBe(0);
    expect(computeHeatBarState(17).filledSegments).toBe(HEAT_SEGMENT_COUNT);
    expect(computeHeatBarState(17).isOverheated).toBe(true);
  });

  it('segment count is monotonic in heat across the 0..1 range', () => {
    let prev = -1;
    for (let i = 0; i <= 100; i += 1) {
      const s = computeHeatBarState(i / 100);
      expect(s.filledSegments).toBeGreaterThanOrEqual(prev);
      prev = s.filledSegments;
    }
  });
});

// ---------------------------------------------------------------------------
// Gradient recipes — token-driven
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — gradient recipes', () => {
  it('cool gradient composes from TEAL and TEAL_DARK tokens', () => {
    expect(HEAT_COOL_GRADIENT).toContain(TEAL);
    expect(HEAT_COOL_GRADIENT).toContain(TEAL_DARK);
    expect(HEAT_COOL_GRADIENT).toMatch(/^linear-gradient\(180deg,/);
  });

  it('warm gradient composes from GOLD and GOLD_DARK tokens', () => {
    expect(HEAT_WARM_GRADIENT).toContain(GOLD);
    expect(HEAT_WARM_GRADIENT).toContain(GOLD_DARK);
    expect(HEAT_WARM_GRADIENT).toMatch(/^linear-gradient\(180deg,/);
  });

  it('hot gradient composes from RED and RED_DARK tokens', () => {
    expect(HEAT_HOT_GRADIENT).toContain(RED);
    expect(HEAT_HOT_GRADIENT).toContain(RED_DARK);
    expect(HEAT_HOT_GRADIENT).toMatch(/^linear-gradient\(180deg,/);
  });
});

// ---------------------------------------------------------------------------
// Style builders — tokens, layout, transitions
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — buildContainerStyle', () => {
  it('positions the bar at the top-left HUD slot (top 2rem, left 2rem)', () => {
    const style = buildContainerStyle();
    expect(BAR_TOP_REM).toBe(2);
    expect(BAR_LEFT_REM).toBe(2);
    expect(style.position).toBe('absolute');
    expect(style.top).toBe('2rem');
    expect(style.left).toBe('2rem');
  });

  it('uses FONT_UI from tokens and the computed track width', () => {
    const style = buildContainerStyle();
    expect(style.fontFamily).toBe(FONT_UI);
    expect(style.width).toBe(`${String(TRACK_WIDTH_PX)}px`);
  });

  it('is a non-interactive HUD readout (no pointer events, no selection)', () => {
    const style = buildContainerStyle();
    expect(style.pointerEvents).toBe('none');
    expect(style.userSelect).toBe('none');
  });

  it('stacks the label above the segment row, aligned to the left edge', () => {
    const style = buildContainerStyle();
    expect(style.display).toBe('flex');
    expect(style.flexDirection).toBe('column');
    expect(style.alignItems).toBe('flex-start');
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
  it('renders a horizontal flex row of segments (no background/border)', () => {
    const style = buildTrackStyle();
    expect(style.display).toBe('flex');
    expect(style.flexDirection).toBe('row');
    expect(style.alignItems).toBe('center');
    expect(style.gap).toBe(`${String(SEGMENT_GAP_PX)}px`);
    expect(style.background).toBeUndefined();
    expect(style.border).toBeUndefined();
  });

  it('spans the full computed track width', () => {
    const style = buildTrackStyle();
    expect(style.width).toBe(`${String(TRACK_WIDTH_PX)}px`);
    expect(style.height).toBe(`${String(SEGMENT_HEIGHT_PX)}px`);
  });

  it('has zero padding so segments sit flush with the row edge', () => {
    const style = buildTrackStyle();
    expect(style.padding).toBe(0);
  });
});

describe('WeaponHeatBar — buildSegmentStyle', () => {
  it('paints a filled segment with the bracket gradient and no border', () => {
    const style = buildSegmentStyle({ filled: true, gradient: HEAT_COOL_GRADIENT });
    expect(style.background).toBe(HEAT_COOL_GRADIENT);
    expect(style.border).toBe('none');
  });

  it('paints an empty segment with BG_DEEP and a BORDER_SUB outline', () => {
    const style = buildSegmentStyle({ filled: false, gradient: HEAT_COOL_GRADIENT });
    expect(style.background).toBe(BG_DEEP);
    expect(style.border).toBe(`1px solid ${BORDER_SUB}`);
  });

  it('uses the segment geometry tokens', () => {
    const style = buildSegmentStyle({ filled: true, gradient: HEAT_HOT_GRADIENT });
    expect(style.width).toBe(`${String(SEGMENT_WIDTH_PX)}px`);
    expect(style.height).toBe(`${String(SEGMENT_HEIGHT_PX)}px`);
    expect(style.borderRadius).toBe(`${String(SEGMENT_RADIUS_PX)}px`);
    expect(style.boxSizing).toBe('border-box');
  });

  it('transitions background and border over DUR_NORMAL ease-out', () => {
    const style = buildSegmentStyle({ filled: true, gradient: HEAT_COOL_GRADIENT });
    const t = String(style.transition);
    expect(t).toContain(`background ${String(DUR_NORMAL)}ms ease-out`);
    expect(t).toContain(`border ${String(DUR_NORMAL)}ms ease-out`);
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
// Geometry — segment count, derived width
// ---------------------------------------------------------------------------

describe('WeaponHeatBar — segment geometry', () => {
  it('renders exactly 10 segments', () => {
    expect(HEAT_SEGMENT_COUNT).toBe(10);
  });

  it('derives TRACK_WIDTH_PX from segment geometry (no magic width)', () => {
    const expected =
      HEAT_SEGMENT_COUNT * SEGMENT_WIDTH_PX + (HEAT_SEGMENT_COUNT - 1) * SEGMENT_GAP_PX;
    expect(TRACK_WIDTH_PX).toBe(expected);
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

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

describe('WeaponHeatBar — component output', () => {
  it('renders HEAT_SEGMENT_COUNT segment divs regardless of heat', () => {
    setMockState('playing', 0);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    const segs = countOccurrences(html, 'data-testid="weapon-heat-bar-segment"');
    expect(segs).toBe(HEAT_SEGMENT_COUNT);
  });

  it('exposes cool bracket at low heat and renders the HEAT label', () => {
    setMockState('playing', 0.3);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-heat-bracket="cool"');
    expect(html).toContain('data-overheated="off"');
    expect(html).toContain('>HEAT<');
    // 0.3 × 10 = 3 filled segments.
    expect(html).toContain('data-filled-segments="3"');
    // Three segments should carry the 'on' flag, seven should be 'off'.
    expect(countOccurrences(html, 'data-segment-filled="on"')).toBe(3);
    expect(countOccurrences(html, 'data-segment-filled="off"')).toBe(7);
  });

  it('exposes warm bracket at mid heat (0.6 → 6 filled)', () => {
    setMockState('playing', 0.6);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-heat-bracket="warm"');
    expect(html).toContain('data-overheated="off"');
    expect(html).toContain('>HEAT<');
    expect(html).toContain('data-filled-segments="6"');
    expect(countOccurrences(html, 'data-segment-filled="on"')).toBe(6);
    expect(countOccurrences(html, 'data-segment-filled="off"')).toBe(4);
  });

  it('exposes hot bracket with HEAT label at heat = 0.85', () => {
    setMockState('playing', 0.85);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-heat-bracket="hot"');
    expect(html).toContain('data-overheated="off"');
    expect(html).toContain('>HEAT<');
    expect(html).toContain('data-filled-segments="9"');
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

  it('renders the track plus label children with their dedicated test ids', () => {
    setMockState('playing', 0.5);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-testid="weapon-heat-bar"');
    expect(html).toContain('data-testid="weapon-heat-bar-label"');
    expect(html).toContain('data-testid="weapon-heat-bar-track"');
    expect(html).toContain('data-testid="weapon-heat-bar-segment"');
  });

  it('at heat = 0 no segments render in the filled state', () => {
    setMockState('playing', 0);
    const html = renderToStaticMarkup(createElement(WeaponHeatBar));
    expect(html).toContain('data-filled-segments="0"');
    expect(countOccurrences(html, 'data-segment-filled="on"')).toBe(0);
    expect(countOccurrences(html, 'data-segment-filled="off"')).toBe(HEAT_SEGMENT_COUNT);
  });
});
