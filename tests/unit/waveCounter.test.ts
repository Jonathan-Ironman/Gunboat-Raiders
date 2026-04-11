import { describe, it, expect } from 'vitest';
import { WaveCounter } from '@/ui/WaveCounter';
import {
  formatWaveLabel,
  shouldRenderWaveCounter,
  waveCounterContainerStyle,
  waveCounterTextStyle,
} from '@/ui/WaveCounter.styles';
import { BG_DEEP, FONT_DISPLAY, GOLD } from '@/ui/tokens';

describe('WaveCounter — phase gating', () => {
  it('hides the counter when wave === 0 (pre-first-wave)', () => {
    expect(shouldRenderWaveCounter(0)).toBe(false);
  });

  it('hides the counter when wave is negative (defensive)', () => {
    expect(shouldRenderWaveCounter(-1)).toBe(false);
  });

  it('shows the counter for wave 1 and beyond', () => {
    expect(shouldRenderWaveCounter(1)).toBe(true);
    expect(shouldRenderWaveCounter(5)).toBe(true);
    expect(shouldRenderWaveCounter(99)).toBe(true);
  });
});

describe('WaveCounter — label formatting', () => {
  it('formats a wave number into the expected label string', () => {
    expect(formatWaveLabel(1)).toBe('WAVE 1');
    expect(formatWaveLabel(3)).toBe('WAVE 3');
    expect(formatWaveLabel(12)).toBe('WAVE 12');
  });
});

describe('WaveCounter — token usage', () => {
  it('uses the Baloo 2 display font stack', () => {
    expect(waveCounterTextStyle.fontFamily).toBe(FONT_DISPLAY);
  });

  it('uses brand gold for the wave label colour', () => {
    expect(waveCounterTextStyle.color).toBe(GOLD);
  });

  it('uses BG_DEEP for the drop-shadow lift', () => {
    expect(waveCounterTextStyle.textShadow).toContain(BG_DEEP);
  });

  it('contains no hardcoded hex colours', () => {
    const serialised = JSON.stringify({ waveCounterContainerStyle, waveCounterTextStyle });
    // Only BG_DEEP is allowed (referenced via the token above).
    const hexes = serialised.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    for (const hex of hexes) {
      expect([GOLD, BG_DEEP]).toContain(hex);
    }
  });

  it('does not reference the legacy "Black Ops One" or "Rajdhani" fonts', () => {
    const serialised = JSON.stringify({ waveCounterContainerStyle, waveCounterTextStyle });
    expect(serialised).not.toContain('Black Ops One');
    expect(serialised).not.toContain('Rajdhani');
  });
});

describe('WaveCounter — container positioning', () => {
  it('is top-centre anchored so it pairs with EnemiesRemainingCounter', () => {
    expect(waveCounterContainerStyle.position).toBe('absolute');
    expect(waveCounterContainerStyle.top).toBe('1.5rem');
    expect(waveCounterContainerStyle.left).toBe('50%');
    expect(waveCounterContainerStyle.transform).toBe('translateX(-50%)');
  });
});

describe('WaveCounter — component export', () => {
  it('exports the component as a function', () => {
    expect(typeof WaveCounter).toBe('function');
  });
});
