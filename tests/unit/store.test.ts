import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

function getStore() {
  return useGameStore.getState();
}

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe('gameStore — initial state', () => {
  it('has phase="title", wave=0, score=0', () => {
    const state = getStore();
    expect(state.phase).toBe('title');
    expect(state.wave).toBe(0);
    expect(state.score).toBe(0);
  });

  it('has no player, enemies, or projectiles', () => {
    const state = getStore();
    expect(state.player).toBeNull();
    expect(state.enemies.size).toBe(0);
    expect(state.projectiles.size).toBe(0);
  });
});

describe('gameStore — spawnPlayer', () => {
  it('creates a player entity with correct health stats', () => {
    getStore().spawnPlayer();
    const { player } = getStore();
    expect(player).not.toBeNull();
    expect(player?.id).toBe('player');
    expect(player?.type).toBe('player');
    expect(player?.health.armor).toBe(100);
    expect(player?.health.hull).toBe(100);
    expect(player?.health.armorRegenRate).toBe(3);
  });

  it('sets phase to "playing"', () => {
    getStore().spawnPlayer();
    expect(getStore().phase).toBe('playing');
  });
});

describe('gameStore — spawnEnemy', () => {
  it('adds a skiff to the enemies map', () => {
    const id = getStore().spawnEnemy('skiff', [50, 0, 50]);
    expect(getStore().enemies.has(id)).toBe(true);
    expect(getStore().enemies.get(id)?.enemyType).toBe('skiff');
  });

  it('adds a barge with correct health stats', () => {
    const id = getStore().spawnEnemy('barge', [0, 0, 100]);
    const enemy = getStore().enemies.get(id);
    expect(enemy?.health.armor).toBe(80);
    expect(enemy?.health.hull).toBe(120);
  });

  it('increments enemiesRemaining', () => {
    expect(getStore().enemiesRemaining).toBe(0);
    getStore().spawnEnemy('skiff', [0, 0, 50]);
    expect(getStore().enemiesRemaining).toBe(1);
    getStore().spawnEnemy('barge', [0, 0, -50]);
    expect(getStore().enemiesRemaining).toBe(2);
  });
});

describe('gameStore — applyDamage', () => {
  it('reduces armor first, then hull', () => {
    getStore().spawnPlayer();
    getStore().applyDamage('player', 30);
    const { player } = getStore();
    expect(player?.health.armor).toBe(70);
    expect(player?.health.hull).toBe(100);
  });

  it('overflows damage from armor to hull correctly', () => {
    getStore().spawnPlayer();
    // Armor = 100, Hull = 100, damage = 120
    // Armor absorbs 100, remaining 20 hits hull
    getStore().applyDamage('player', 120);
    const { player } = getStore();
    expect(player?.health.armor).toBe(0);
    expect(player?.health.hull).toBe(80);
  });

  it('goes straight to hull when armor is depleted', () => {
    getStore().spawnPlayer();
    getStore().applyDamage('player', 100); // deplete armor
    getStore().applyDamage('player', 50); // hits hull directly
    const { player } = getStore();
    expect(player?.health.armor).toBe(0);
    expect(player?.health.hull).toBe(50);
  });

  it('sets isSinking when hull reaches 0', () => {
    getStore().spawnPlayer();
    getStore().applyDamage('player', 9999);
    expect(getStore().player?.isSinking).toBe(true);
  });

  it('transitions phase to "game-over" when player sinks', () => {
    getStore().spawnPlayer();
    getStore().applyDamage('player', 9999);
    expect(getStore().phase).toBe('game-over');
  });

  it('applies damage to enemies correctly', () => {
    const id = getStore().spawnEnemy('skiff', [0, 0, 50]);
    // Skiff armor=30, hull=40
    getStore().applyDamage(id, 50); // 30 armor + 20 hull
    const enemy = getStore().enemies.get(id);
    expect(enemy?.health.armor).toBe(0);
    expect(enemy?.health.hull).toBe(20);
  });

  it('does not make hull negative on overkill', () => {
    getStore().spawnPlayer();
    getStore().applyDamage('player', 9999);
    expect(getStore().player?.health.hull).toBe(0);
  });

  it('decrements enemiesRemaining when enemy sinks via applyDamage', () => {
    const id = getStore().spawnEnemy('skiff', [0, 0, 50]);
    expect(getStore().enemiesRemaining).toBe(1);
    // Skiff: armor=30, hull=40 => total 70 to sink
    getStore().applyDamage(id, 100);
    expect(getStore().enemiesRemaining).toBe(0);
  });

  it('increments enemiesSunkTotal when enemy sinks via applyDamage', () => {
    const id = getStore().spawnEnemy('skiff', [0, 0, 50]);
    getStore().applyDamage(id, 100);
    expect(getStore().enemiesSunkTotal).toBe(1);
  });

  it('does not double-count if applyDamage called on already-sinking enemy', () => {
    const id = getStore().spawnEnemy('skiff', [0, 0, 50]);
    getStore().applyDamage(id, 100); // sinks
    expect(getStore().enemiesSunkTotal).toBe(1);
    getStore().applyDamage(id, 10); // already sinking
    expect(getStore().enemiesSunkTotal).toBe(1); // no double-count
  });
});

describe('gameStore — removeEnemy', () => {
  it('removes the enemy from the map', () => {
    const id = getStore().spawnEnemy('skiff', [0, 0, 50]);
    getStore().removeEnemy(id);
    expect(getStore().enemies.has(id)).toBe(false);
  });

  it('does not change counters (applyDamage handles sink counting)', () => {
    const id = getStore().spawnEnemy('skiff', [0, 0, 50]);
    expect(getStore().enemiesRemaining).toBe(1);
    getStore().removeEnemy(id);
    // removeEnemy is now a pure cleanup — counters unchanged
    expect(getStore().enemiesRemaining).toBe(1);
    expect(getStore().enemiesSunkTotal).toBe(0);
  });
});

describe('gameStore — advanceWave', () => {
  it('increments the wave number', () => {
    expect(getStore().wave).toBe(0);
    getStore().advanceWave();
    expect(getStore().wave).toBe(1);
    getStore().advanceWave();
    expect(getStore().wave).toBe(2);
  });
});

describe('gameStore — addScore', () => {
  it('increases score by given points', () => {
    getStore().addScore(100);
    expect(getStore().score).toBe(100);
    getStore().addScore(250);
    expect(getStore().score).toBe(350);
  });
});

describe('gameStore — setPhase', () => {
  it('transitions game phase', () => {
    getStore().setPhase('playing');
    expect(getStore().phase).toBe('playing');
    getStore().setPhase('wave-clear');
    expect(getStore().phase).toBe('wave-clear');
    getStore().setPhase('game-over');
    expect(getStore().phase).toBe('game-over');
  });
});

describe('gameStore — resetGame', () => {
  it('returns to initial state', () => {
    // Mess up the store
    getStore().spawnPlayer();
    getStore().spawnEnemy('barge', [0, 0, 50]);
    getStore().addScore(500);
    getStore().advanceWave();

    getStore().resetGame();

    const state = getStore();
    expect(state.phase).toBe('title');
    expect(state.wave).toBe(0);
    expect(state.score).toBe(0);
    expect(state.player).toBeNull();
    expect(state.enemies.size).toBe(0);
    expect(state.enemiesRemaining).toBe(0);
    expect(state.enemiesSunkTotal).toBe(0);
  });
});
