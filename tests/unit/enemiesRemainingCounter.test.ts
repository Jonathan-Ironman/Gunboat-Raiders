import { describe, it, expect } from 'vitest';
import { EnemiesRemainingCounter } from '@/ui/EnemiesRemainingCounter';
import {
  enemiesRemainingContainerStyle,
  enemiesRemainingTextStyle,
  formatEnemiesRemaining,
  getEnemiesRemainingOpacity,
} from '@/ui/EnemiesRemainingCounter.styles';
import { DUR_NORMAL, FONT_UI, TEXT_MUTED } from '@/ui/tokens';

describe('EnemiesRemainingCounter — text formatting', () => {
  it('formats a positive count as "N REMAINING"', () => {
    expect(formatEnemiesRemaining(4)).toBe('4 REMAINING');
    expect(formatEnemiesRemaining(1)).toBe('1 REMAINING');
  });

  it('still formats zero as "0 REMAINING" (visibility is handled by opacity)', () => {
    expect(formatEnemiesRemaining(0)).toBe('0 REMAINING');
  });
});

describe('EnemiesRemainingCounter — opacity visibility', () => {
  it('is fully visible (opacity 1) while enemies are alive', () => {
    expect(getEnemiesRemainingOpacity(1)).toBe(1);
    expect(getEnemiesRemainingOpacity(4)).toBe(1);
    expect(getEnemiesRemainingOpacity(99)).toBe(1);
  });

  it('fades to opacity 0 on wave-clear (remaining === 0)', () => {
    expect(getEnemiesRemainingOpacity(0)).toBe(0);
  });

  it('treats negative values defensively as hidden', () => {
    expect(getEnemiesRemainingOpacity(-1)).toBe(0);
  });
});

describe('EnemiesRemainingCounter — token usage', () => {
  it('uses the UI font stack', () => {
    expect(enemiesRemainingTextStyle.fontFamily).toBe(FONT_UI);
  });

  it('uses TEXT_MUTED for the caption colour', () => {
    expect(enemiesRemainingTextStyle.color).toBe(TEXT_MUTED);
  });

  it('transitions opacity using the DUR_NORMAL token duration', () => {
    expect(enemiesRemainingContainerStyle.transition).toContain(`${String(DUR_NORMAL)}ms`);
    expect(enemiesRemainingContainerStyle.transition).toContain('opacity');
  });

  it('contains no hardcoded hex colours other than allowed tokens', () => {
    const serialised = JSON.stringify({
      enemiesRemainingContainerStyle,
      enemiesRemainingTextStyle,
    });
    const hexes = serialised.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    for (const hex of hexes) {
      expect([TEXT_MUTED]).toContain(hex);
    }
  });

  it('does not reference the legacy "Rajdhani" font', () => {
    const serialised = JSON.stringify({
      enemiesRemainingContainerStyle,
      enemiesRemainingTextStyle,
    });
    expect(serialised).not.toContain('Rajdhani');
  });
});

describe('EnemiesRemainingCounter — layout', () => {
  it('sits below the WaveCounter on the same top-centre anchor', () => {
    expect(enemiesRemainingContainerStyle.position).toBe('absolute');
    expect(enemiesRemainingContainerStyle.top).toBe('calc(1.5rem + 2.8rem)');
    expect(enemiesRemainingContainerStyle.left).toBe('50%');
    expect(enemiesRemainingContainerStyle.transform).toBe('translateX(-50%)');
  });

  it('uppercases the caption with wide letter-spacing', () => {
    expect(enemiesRemainingTextStyle.textTransform).toBe('uppercase');
    expect(enemiesRemainingTextStyle.letterSpacing).toBe('0.1em');
  });
});

describe('EnemiesRemainingCounter — component export', () => {
  it('exports the component as a function', () => {
    expect(typeof EnemiesRemainingCounter).toBe('function');
  });
});
