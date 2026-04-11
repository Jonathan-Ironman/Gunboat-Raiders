import { describe, it, expect } from 'vitest';
import { ScoreDisplay } from '@/ui/ScoreDisplay';
import {
  formatScore,
  scoreDisplayContainerStyle,
  scoreDisplayLabelStyle,
  scoreDisplayValueStyle,
} from '@/ui/ScoreDisplay.styles';
import { FONT_DISPLAY, FONT_UI, GOLD, TEXT_MUTED } from '@/ui/tokens';

describe('ScoreDisplay — number formatting', () => {
  it('formats a large score with locale thousands separators', () => {
    expect(formatScore(12450)).toBe('12,450');
  });

  it('formats zero as "0"', () => {
    expect(formatScore(0)).toBe('0');
  });

  it('formats small numbers without separators', () => {
    expect(formatScore(7)).toBe('7');
    expect(formatScore(999)).toBe('999');
  });

  it('formats millions with two separators', () => {
    expect(formatScore(1_234_567)).toBe('1,234,567');
  });
});

describe('ScoreDisplay — token usage', () => {
  it('uses the display font stack for the numeric value', () => {
    expect(scoreDisplayValueStyle.fontFamily).toBe(FONT_DISPLAY);
  });

  it('uses brand gold for the score value colour', () => {
    expect(scoreDisplayValueStyle.color).toBe(GOLD);
  });

  it('uses the UI font stack for the "SCORE" label', () => {
    expect(scoreDisplayLabelStyle.fontFamily).toBe(FONT_UI);
  });

  it('uses TEXT_MUTED for the label colour', () => {
    expect(scoreDisplayLabelStyle.color).toBe(TEXT_MUTED);
  });

  it('contains no hardcoded hex colours other than allowed tokens', () => {
    const serialised = JSON.stringify({
      scoreDisplayContainerStyle,
      scoreDisplayLabelStyle,
      scoreDisplayValueStyle,
    });
    const hexes = serialised.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    for (const hex of hexes) {
      expect([GOLD, TEXT_MUTED]).toContain(hex);
    }
  });

  it('does not reference the legacy "Rajdhani" font', () => {
    const serialised = JSON.stringify({
      scoreDisplayContainerStyle,
      scoreDisplayLabelStyle,
      scoreDisplayValueStyle,
    });
    expect(serialised).not.toContain('Rajdhani');
  });
});

describe('ScoreDisplay — layout', () => {
  it('is top-right anchored', () => {
    expect(scoreDisplayContainerStyle.position).toBe('absolute');
    expect(scoreDisplayContainerStyle.top).toBe('1.5rem');
    expect(scoreDisplayContainerStyle.right).toBe('2rem');
  });

  it('stacks label above value (column layout, right-aligned)', () => {
    expect(scoreDisplayContainerStyle.display).toBe('flex');
    expect(scoreDisplayContainerStyle.flexDirection).toBe('column');
    expect(scoreDisplayContainerStyle.alignItems).toBe('flex-end');
  });

  it('uses tabular-nums so the numeric value does not jitter as it grows', () => {
    expect(scoreDisplayValueStyle.fontVariantNumeric).toBe('tabular-nums');
  });
});

describe('ScoreDisplay — component export', () => {
  it('exports the component as a function', () => {
    expect(typeof ScoreDisplay).toBe('function');
  });
});
