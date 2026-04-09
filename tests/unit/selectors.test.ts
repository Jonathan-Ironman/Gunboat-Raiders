import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

function getStore() {
  return useGameStore.getState();
}

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe('selectors — player health', () => {
  it('returns null when no player spawned', () => {
    const health = getStore().player?.health ?? null;
    expect(health).toBeNull();
  });

  it('returns correct health after spawnPlayer', () => {
    getStore().spawnPlayer();
    const health = getStore().player?.health;
    expect(health).not.toBeNull();
    expect(health?.armor).toBe(100);
    expect(health?.armorMax).toBe(100);
    expect(health?.hull).toBe(100);
    expect(health?.hullMax).toBe(100);
  });
});

describe('selectors — wave number', () => {
  it('returns 0 initially', () => {
    expect(getStore().wave).toBe(0);
  });

  it('returns 1 after advanceWave', () => {
    getStore().advanceWave();
    expect(getStore().wave).toBe(1);
  });
});

describe('selectors — score', () => {
  it('returns 0 initially', () => {
    expect(getStore().score).toBe(0);
  });

  it('returns 100 after addScore(100)', () => {
    getStore().addScore(100);
    expect(getStore().score).toBe(100);
  });
});

describe('selectors — active quadrant', () => {
  it("returns 'fore' by default", () => {
    expect(getStore().activeQuadrant).toBe('fore');
  });
});

describe('selectors — game phase', () => {
  it("returns 'title' initially", () => {
    expect(getStore().phase).toBe('title');
  });
});
