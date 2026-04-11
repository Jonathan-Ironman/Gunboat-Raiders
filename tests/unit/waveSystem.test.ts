import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateWaveConfig,
  generateSpawnPositions,
  scoreForEnemy,
  SCORE,
} from '@/systems/WaveSystem';
import { useGameStore } from '@/store/gameStore';

beforeEach(() => {
  useGameStore.getState().resetGame();
});

// ---- generateWaveConfig ----

describe('generateWaveConfig', () => {
  it('wave 1 config has 2 skiffs, 0 barges', () => {
    const config = generateWaveConfig(1);
    expect(config.waveNumber).toBe(1);
    const skiffGroup = config.enemies.find((e) => e.type === 'skiff');
    const bargeGroup = config.enemies.find((e) => e.type === 'barge');
    expect(skiffGroup?.count).toBe(2);
    expect(bargeGroup).toBeUndefined();
  });

  it('wave 2 config has 3 skiffs, 0 barges', () => {
    const config = generateWaveConfig(2);
    const skiffGroup = config.enemies.find((e) => e.type === 'skiff');
    const bargeGroup = config.enemies.find((e) => e.type === 'barge');
    expect(skiffGroup?.count).toBe(3);
    expect(bargeGroup).toBeUndefined();
  });

  it('wave 3 config has 4 skiffs, 0 barges', () => {
    const config = generateWaveConfig(3);
    const skiffGroup = config.enemies.find((e) => e.type === 'skiff');
    const bargeGroup = config.enemies.find((e) => e.type === 'barge');
    expect(skiffGroup?.count).toBe(4);
    expect(bargeGroup).toBeUndefined();
  });

  it('wave 5 config includes 1 barge', () => {
    const config = generateWaveConfig(5);
    const bargeGroup = config.enemies.find((e) => e.type === 'barge');
    expect(bargeGroup).toBeDefined();
    expect(bargeGroup?.count).toBe(1);
  });

  it('wave 8 config includes 2 barges (1 + floor((8-5)/3) = 2)', () => {
    const config = generateWaveConfig(8);
    const bargeGroup = config.enemies.find((e) => e.type === 'barge');
    expect(bargeGroup?.count).toBe(2);
  });

  it('skiff count caps at 8', () => {
    const config = generateWaveConfig(20);
    const skiffGroup = config.enemies.find((e) => e.type === 'skiff');
    expect(skiffGroup?.count).toBe(8);
  });

  it('barge count caps at 3', () => {
    // wave 14: 1 + floor((14-5)/3) = 1 + 3 = 4, capped at 3
    const config = generateWaveConfig(14);
    const bargeGroup = config.enemies.find((e) => e.type === 'barge');
    expect(bargeGroup?.count).toBe(3);
  });
});

// ---- generateSpawnPositions ----

describe('generateSpawnPositions', () => {
  it('returns correct count of positions', () => {
    const positions = generateSpawnPositions(5, 42);
    expect(positions).toHaveLength(5);
  });

  it('same seed returns identical positions', () => {
    const a = generateSpawnPositions(4, 123);
    const b = generateSpawnPositions(4, 123);
    expect(a).toEqual(b);
  });

  it('different seed returns different positions', () => {
    const a = generateSpawnPositions(4, 100);
    const b = generateSpawnPositions(4, 200);
    // Very unlikely to be equal with different seeds
    expect(a).not.toEqual(b);
  });

  it('all spawn positions are within minRadius-maxRadius distance from origin', () => {
    const minR = 80;
    const maxR = 120;
    const positions = generateSpawnPositions(10, 999, minR, maxR);
    for (const pos of positions) {
      const dist = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]);
      expect(dist).toBeGreaterThanOrEqual(minR - 0.01);
      expect(dist).toBeLessThanOrEqual(maxR + 0.01);
    }
  });

  it('spawn position Y coordinate is always 0', () => {
    const positions = generateSpawnPositions(8, 42);
    for (const pos of positions) {
      expect(pos[1]).toBe(0);
    }
  });
});

// ---- scoreForEnemy ----

describe('scoreForEnemy', () => {
  it('scoreForEnemy("skiff") returns 100', () => {
    expect(scoreForEnemy('skiff')).toBe(100);
  });

  it('scoreForEnemy("barge") returns 250', () => {
    expect(scoreForEnemy('barge')).toBe(250);
  });

  it('WAVE_SURVIVED constant is 500', () => {
    expect(SCORE.WAVE_SURVIVED).toBe(500);
  });
});

// ---- Store integration ----

describe('store — wave actions', () => {
  it('advanceWave increments wave number', () => {
    const store = useGameStore.getState();
    expect(store.wave).toBe(0);
    store.advanceWave();
    expect(useGameStore.getState().wave).toBe(1);
    store.advanceWave();
    expect(useGameStore.getState().wave).toBe(2);
  });

  it('resetGame resets wave to 0, score to 0, phase to "mainMenu"', () => {
    const store = useGameStore.getState();
    store.spawnPlayer();
    store.addScore(1000);
    store.advanceWave();
    store.advanceWave();

    store.resetGame();

    const state = useGameStore.getState();
    expect(state.wave).toBe(0);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('mainMenu');
  });
});
