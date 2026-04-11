/**
 * Unit tests for `src/ui/WaveAnnouncement.tsx` — R16 slice.
 *
 * The WaveAnnouncement overlay is a full-screen wave-clear announcement
 * composed of two letterbox bars and two swapping headlines, driven by a
 * tiny local state machine. These tests cover:
 *
 * 1. The pure sub-phase resolver (`computeWaveAnnouncementSubPhase`) so
 *    the timing math is verifiable without mounting React.
 * 2. The copy formatter (`formatIncomingHeadline`).
 * 3. The style builders — layout, token usage, no hardcoded hex colors.
 * 4. The phase gate (`shouldRenderWaveAnnouncement`).
 * 5. The React component rendered through `react-dom/server` — asserts
 *    the correct initial markup (letterbox bars, "WAVE CLEARED" copy,
 *    correct "WAVE {n+1} INCOMING" copy using the *incoming* sub-phase
 *    markup, and phase gating).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  computeWaveAnnouncementSubPhase,
  formatIncomingHeadline,
  headlineColor,
  headlineStyle,
  letterboxBottomStyle,
  letterboxTopStyle,
  shouldRenderWaveAnnouncement,
  waveAnnouncementRootStyle,
  WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS,
  WAVE_ANNOUNCEMENT_EXIT_MS,
  WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS,
  WAVE_ANNOUNCEMENT_TOTAL_MS,
  WAVE_CLEARED_HEADLINE,
  LETTERBOX_HEIGHT,
} from '@/ui/waveAnnouncement.helpers';
import {
  BG_DEEP,
  DUR_MEDIUM,
  DUR_NORMAL,
  DUR_SLOW,
  EASE_OUT,
  FONT_DISPLAY,
  GOLD,
  TEXT_PRI,
} from '@/ui/tokens';

// ---------------------------------------------------------------------------
// Mock the store selectors module. The WaveAnnouncement component reads
// `useGamePhase` and `useWaveNumber`; the other selectors are stubbed so
// the module import still resolves when a future refactor adds more
// imports.
// ---------------------------------------------------------------------------

type MockPhase = 'mainMenu' | 'playing' | 'wave-clear' | 'game-over';

const mockState: { phase: MockPhase; wave: number } = {
  phase: 'playing',
  wave: 0,
};

vi.mock('@/store/selectors', () => ({
  useGamePhase: () => mockState.phase,
  useWaveNumber: () => mockState.wave,
  usePlayerHealth: () => null,
  useScore: () => 0,
  useEnemiesRemaining: () => 0,
  useEnemiesSunkTotal: () => 0,
}));

// Import AFTER the mock so the component picks up the mocked selectors.
import { WaveAnnouncement } from '@/ui/WaveAnnouncement';

function setMockState(phase: MockPhase, wave: number): void {
  mockState.phase = phase;
  mockState.wave = wave;
}

beforeEach(() => {
  setMockState('playing', 0);
});

// ---------------------------------------------------------------------------
// Timing constants — anchored to tokens so regressions surface loudly
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — timing constants', () => {
  it('clear-hold is 3 * DUR_SLOW (1500ms)', () => {
    expect(WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS).toBe(3 * DUR_SLOW);
    expect(WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS).toBe(1500);
  });

  it('incoming-hold is 3 * DUR_SLOW (1500ms)', () => {
    expect(WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS).toBe(3 * DUR_SLOW);
    expect(WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS).toBe(1500);
  });

  it('exit fade uses DUR_NORMAL (200ms)', () => {
    expect(WAVE_ANNOUNCEMENT_EXIT_MS).toBe(DUR_NORMAL);
    expect(WAVE_ANNOUNCEMENT_EXIT_MS).toBe(200);
  });

  it('total lifetime sums all three sub-phase durations (3200ms)', () => {
    expect(WAVE_ANNOUNCEMENT_TOTAL_MS).toBe(
      WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS +
        WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS +
        WAVE_ANNOUNCEMENT_EXIT_MS,
    );
    expect(WAVE_ANNOUNCEMENT_TOTAL_MS).toBe(3200);
  });
});

// ---------------------------------------------------------------------------
// computeWaveAnnouncementSubPhase — the local state machine
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — computeWaveAnnouncementSubPhase', () => {
  it('starts in the `clear` sub-phase at t=0', () => {
    expect(computeWaveAnnouncementSubPhase(0)).toBe('clear');
  });

  it('stays in `clear` up to (but not including) the clear-hold boundary', () => {
    expect(computeWaveAnnouncementSubPhase(1)).toBe('clear');
    expect(computeWaveAnnouncementSubPhase(WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS - 1)).toBe('clear');
  });

  it('switches to `incoming` exactly at the clear-hold boundary', () => {
    expect(computeWaveAnnouncementSubPhase(WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS)).toBe('incoming');
  });

  it('stays in `incoming` across the full incoming-hold window', () => {
    const end = WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS + WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS - 1;
    expect(computeWaveAnnouncementSubPhase(end)).toBe('incoming');
  });

  it('switches to `exit` exactly at the incoming-hold boundary', () => {
    const boundary = WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS + WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS;
    expect(computeWaveAnnouncementSubPhase(boundary)).toBe('exit');
  });

  it('stays in `exit` for the duration of the fade-out', () => {
    expect(computeWaveAnnouncementSubPhase(WAVE_ANNOUNCEMENT_TOTAL_MS - 1)).toBe('exit');
  });

  it('switches to `done` at the end of the total lifetime', () => {
    expect(computeWaveAnnouncementSubPhase(WAVE_ANNOUNCEMENT_TOTAL_MS)).toBe('done');
    expect(computeWaveAnnouncementSubPhase(WAVE_ANNOUNCEMENT_TOTAL_MS + 500)).toBe('done');
  });

  it('defends against non-finite and negative elapsed values', () => {
    expect(computeWaveAnnouncementSubPhase(-1)).toBe('clear');
    expect(computeWaveAnnouncementSubPhase(Number.NaN)).toBe('clear');
    expect(computeWaveAnnouncementSubPhase(Number.POSITIVE_INFINITY)).toBe('clear');
  });
});

// ---------------------------------------------------------------------------
// shouldRenderWaveAnnouncement — phase gate
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — shouldRenderWaveAnnouncement', () => {
  it('returns true only for the `wave-clear` phase', () => {
    expect(shouldRenderWaveAnnouncement('wave-clear')).toBe(true);
  });

  it('returns false for every other phase', () => {
    expect(shouldRenderWaveAnnouncement('playing')).toBe(false);
    expect(shouldRenderWaveAnnouncement('mainMenu')).toBe(false);
    expect(shouldRenderWaveAnnouncement('briefing')).toBe(false);
    expect(shouldRenderWaveAnnouncement('paused')).toBe(false);
    expect(shouldRenderWaveAnnouncement('game-over')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatIncomingHeadline — text formatter
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — formatIncomingHeadline', () => {
  it('advertises the next wave number', () => {
    expect(formatIncomingHeadline(1)).toBe('WAVE 2 INCOMING');
    expect(formatIncomingHeadline(2)).toBe('WAVE 3 INCOMING');
    expect(formatIncomingHeadline(9)).toBe('WAVE 10 INCOMING');
  });

  it('handles wave 0 (before first wave starts) by advertising wave 1', () => {
    expect(formatIncomingHeadline(0)).toBe('WAVE 1 INCOMING');
  });

  it('floors fractional input rather than passing through NaN copy', () => {
    expect(formatIncomingHeadline(2.9)).toBe('WAVE 3 INCOMING');
  });

  it('falls back to wave 1 for non-finite or negative inputs', () => {
    expect(formatIncomingHeadline(-5)).toBe('WAVE 1 INCOMING');
    expect(formatIncomingHeadline(Number.NaN)).toBe('WAVE 1 INCOMING');
    expect(formatIncomingHeadline(Number.POSITIVE_INFINITY)).toBe('WAVE 1 INCOMING');
  });

  it('always begins with "WAVE " and ends with " INCOMING"', () => {
    const label = formatIncomingHeadline(7);
    expect(label.startsWith('WAVE ')).toBe(true);
    expect(label.endsWith(' INCOMING')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Style builders — overlay root
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — waveAnnouncementRootStyle', () => {
  it('lays out as a full-viewport, pointer-events-none overlay above the HUD', () => {
    const style = waveAnnouncementRootStyle(1);
    expect(style.position).toBe('absolute');
    expect(style.inset).toBe(0);
    expect(style.pointerEvents).toBe('none');
    // HUD sits at zIndex 10; overlay must sit above it.
    expect(style.zIndex).toBe(20);
  });

  it('uses the Harbour Dawn display font stack', () => {
    expect(waveAnnouncementRootStyle(1).fontFamily).toBe(FONT_DISPLAY);
  });

  it('exposes the fade-out opacity for the exit sub-phase', () => {
    expect(waveAnnouncementRootStyle(1).opacity).toBe(1);
    expect(waveAnnouncementRootStyle(0).opacity).toBe(0);
  });

  it('clamps opacity into [0, 1]', () => {
    expect(waveAnnouncementRootStyle(-1).opacity).toBe(0);
    expect(waveAnnouncementRootStyle(5).opacity).toBe(1);
  });

  it('wires the exit fade to DUR_NORMAL + EASE_OUT via a CSS transition', () => {
    const { transition } = waveAnnouncementRootStyle(1);
    expect(typeof transition).toBe('string');
    expect(transition).toContain(`${String(DUR_NORMAL)}ms`);
    expect(transition).toContain(EASE_OUT);
    expect(transition).toContain('opacity');
  });
});

// ---------------------------------------------------------------------------
// Style builders — letterbox bars
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — letterbox bars', () => {
  it('top bar uses BG_DEEP as the background color', () => {
    expect(letterboxTopStyle(true).background).toBe(BG_DEEP);
  });

  it('bottom bar uses BG_DEEP as the background color', () => {
    expect(letterboxBottomStyle(true).background).toBe(BG_DEEP);
  });

  it('top bar slides from -8vh (hidden) to 0 (visible)', () => {
    expect(letterboxTopStyle(false).top).toBe(`-${LETTERBOX_HEIGHT}`);
    expect(letterboxTopStyle(true).top).toBe(0);
  });

  it('bottom bar slides from -8vh (hidden) to 0 (visible)', () => {
    expect(letterboxBottomStyle(false).bottom).toBe(`-${LETTERBOX_HEIGHT}`);
    expect(letterboxBottomStyle(true).bottom).toBe(0);
  });

  it('letterbox height is 8vh per the Harbour Dawn letterbox spec', () => {
    expect(LETTERBOX_HEIGHT).toBe('8vh');
    expect(letterboxTopStyle(true).height).toBe('8vh');
    expect(letterboxBottomStyle(true).height).toBe('8vh');
  });

  it('both bars transition their position over DUR_MEDIUM ease-out', () => {
    const top = letterboxTopStyle(true);
    const bottom = letterboxBottomStyle(true);
    expect(top.transition).toContain(`${String(DUR_MEDIUM)}ms`);
    expect(top.transition).toContain(EASE_OUT);
    expect(top.transition).toContain('top');
    expect(bottom.transition).toContain(`${String(DUR_MEDIUM)}ms`);
    expect(bottom.transition).toContain(EASE_OUT);
    expect(bottom.transition).toContain('bottom');
  });

  it('both bars stretch edge to edge and sit at absolute position', () => {
    for (const style of [letterboxTopStyle(true), letterboxBottomStyle(true)]) {
      expect(style.position).toBe('absolute');
      expect(style.left).toBe(0);
      expect(style.right).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Style builders — headlines
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — headlineStyle', () => {
  it('uses the display font stack at weight 800', () => {
    const style = headlineStyle('clear', true);
    expect(style.fontFamily).toBe(FONT_DISPLAY);
    expect(style.fontWeight).toBe(800);
  });

  it('uses BG_DEEP for the drop-shadow lift', () => {
    const style = headlineStyle('clear', true);
    expect(style.textShadow).toContain(BG_DEEP);
  });

  it('uses TEXT_PRI for the "CLEARED" beat', () => {
    expect(headlineColor('clear')).toBe(TEXT_PRI);
    expect(headlineStyle('clear', true).color).toBe(TEXT_PRI);
  });

  it('uses GOLD for the "INCOMING" beat', () => {
    expect(headlineColor('incoming')).toBe(GOLD);
    expect(headlineStyle('incoming', true).color).toBe(GOLD);
  });

  it('is invisible and over-scaled before its entrance animation fires', () => {
    const hidden = headlineStyle('clear', false);
    expect(hidden.opacity).toBe(0);
    expect(hidden.transform).toBe('scale(1.3)');
  });

  it('is fully visible at scale(1) once its sub-phase is active', () => {
    const visible = headlineStyle('clear', true);
    expect(visible.opacity).toBe(1);
    expect(visible.transform).toBe('scale(1)');
  });

  it('runs the entrance/exit animation over DUR_MEDIUM', () => {
    const style = headlineStyle('clear', true);
    expect(typeof style.transition).toBe('string');
    expect(style.transition).toContain(`${String(DUR_MEDIUM)}ms`);
    expect(style.transition).toContain('opacity');
    expect(style.transition).toContain('transform');
  });
});

// ---------------------------------------------------------------------------
// Style builders — token hygiene
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — token hygiene', () => {
  it('contains no hardcoded hex colours outside of the allowed tokens', () => {
    const serialised = JSON.stringify({
      root: waveAnnouncementRootStyle(1),
      top: letterboxTopStyle(true),
      bottom: letterboxBottomStyle(true),
      clearHeadline: headlineStyle('clear', true),
      incomingHeadline: headlineStyle('incoming', true),
    });
    const hexes = serialised.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    for (const hex of hexes) {
      expect([BG_DEEP, GOLD, TEXT_PRI]).toContain(hex);
    }
  });

  it('does not reference the legacy "Rajdhani" or "Black Ops One" fonts', () => {
    const serialised = JSON.stringify({
      root: waveAnnouncementRootStyle(1),
      clearHeadline: headlineStyle('clear', true),
      incomingHeadline: headlineStyle('incoming', true),
    });
    expect(serialised).not.toContain('Rajdhani');
    expect(serialised).not.toContain('Black Ops One');
  });
});

// ---------------------------------------------------------------------------
// React component — phase gating & rendered markup
// ---------------------------------------------------------------------------

describe('WaveAnnouncement — component rendering', () => {
  it('renders null outside of the `wave-clear` phase', () => {
    setMockState('playing', 2);
    expect(renderToStaticMarkup(createElement(WaveAnnouncement))).toBe('');

    setMockState('mainMenu', 0);
    expect(renderToStaticMarkup(createElement(WaveAnnouncement))).toBe('');

    setMockState('game-over', 5);
    expect(renderToStaticMarkup(createElement(WaveAnnouncement))).toBe('');
  });

  it('renders the overlay, both letterbox bars, and the "WAVE CLEARED" headline during wave-clear', () => {
    setMockState('wave-clear', 2);
    const html = renderToStaticMarkup(createElement(WaveAnnouncement));

    expect(html).toContain('data-testid="wave-announcement"');
    expect(html).toContain('data-testid="wave-announcement-letterbox-top"');
    expect(html).toContain('data-testid="wave-announcement-letterbox-bottom"');
    expect(html).toContain('data-testid="wave-announcement-cleared"');
    expect(html).toContain(WAVE_CLEARED_HEADLINE);
  });

  it('renders the "WAVE {n+1} INCOMING" headline node with the correct copy for the current wave', () => {
    setMockState('wave-clear', 2);
    const html = renderToStaticMarkup(createElement(WaveAnnouncement));

    // The incoming headline is mounted from the first frame — its
    // visibility is toggled via opacity/transform, not conditional
    // mounting, so the expected copy is always present in the DOM.
    expect(html).toContain('data-testid="wave-announcement-incoming"');
    expect(html).toContain('WAVE 3 INCOMING');
  });

  it('uses the live wave number to compute the incoming headline', () => {
    setMockState('wave-clear', 5);
    const html = renderToStaticMarkup(createElement(WaveAnnouncement));
    expect(html).toContain('WAVE 6 INCOMING');

    setMockState('wave-clear', 0);
    const htmlStart = renderToStaticMarkup(createElement(WaveAnnouncement));
    expect(htmlStart).toContain('WAVE 1 INCOMING');
  });

  it('exposes the initial sub-phase via a data attribute so tests can assert the state machine', () => {
    setMockState('wave-clear', 1);
    const html = renderToStaticMarkup(createElement(WaveAnnouncement));
    // The overlay mounts in the `clear` sub-phase on every fresh render.
    expect(html).toContain('data-sub-phase="clear"');
  });

  it('marks the overlay as a polite aria-live region', () => {
    setMockState('wave-clear', 1);
    const html = renderToStaticMarkup(createElement(WaveAnnouncement));
    expect(html).toContain('aria-live="polite"');
  });

  it('exports the component as a function', () => {
    expect(typeof WaveAnnouncement).toBe('function');
  });
});
