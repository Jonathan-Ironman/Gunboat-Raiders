/**
 * R3F wave system — drives the game phase state machine via useFrame.
 * Spawns enemies in waves with staggered delays, detects wave completion,
 * and manages phase transitions.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import type { EnemyType } from '@/store/gameStore';
import { generateWaveConfig, generateSpawnPositions, SCORE } from './WaveSystem';
import type { WaveConfig } from './WaveSystem';

/** Delay in seconds between wave-clear and next wave start. */
const WAVE_CLEAR_DELAY = 3.0;

/** Minimum delay before the first enemy spawn to let physics stabilize. */
const INITIAL_SPAWN_DELAY = 2.0;

interface SpawnEntry {
  type: EnemyType;
  position: [number, number, number];
  delay: number;
  spawned: boolean;
}

interface WaveState {
  config: WaveConfig | null;
  spawnEntries: SpawnEntry[];
  waveTimer: number;
  allSpawned: boolean;
  waveClearTimer: number;
  waveBonusAwarded: boolean;
}

function createInitialWaveState(): WaveState {
  return {
    config: null,
    spawnEntries: [],
    waveTimer: 0,
    allSpawned: false,
    waveClearTimer: 0,
    waveBonusAwarded: false,
  };
}

/**
 * Build the spawn entries list from a wave config.
 * Generates positions for each enemy group and assigns staggered delays.
 */
function buildSpawnEntries(config: WaveConfig, waveSeed: number): SpawnEntry[] {
  const entries: SpawnEntry[] = [];
  let positionIndex = 0;

  // Calculate total enemies for position generation
  const totalEnemies = config.enemies.reduce((sum, g) => sum + g.count, 0);
  const positions = generateSpawnPositions(totalEnemies, waveSeed, 80, 120);

  for (const group of config.enemies) {
    for (let i = 0; i < group.count; i++) {
      entries.push({
        type: group.type,
        position: positions[positionIndex] ?? [100, 0, 0],
        delay: INITIAL_SPAWN_DELAY + group.spawnDelay + i * 0.5, // stagger within group
        spawned: false,
      });
      positionIndex++;
    }
  }

  return entries;
}

/**
 * Wave system component — must be placed inside <Physics>.
 * Drives the game loop: mainMenu -> playing -> wave-clear -> playing -> ...
 */
export function WaveSystemR3F() {
  const waveState = useRef<WaveState>(createInitialWaveState());

  useFrame((_state, delta) => {
    const store = useGameStore.getState();
    const { phase, wave } = store;
    const ws = waveState.current;

    // ---- MAIN-MENU / BRIEFING / PAUSED / GAME-OVER: idle ----
    if (
      phase === 'mainMenu' ||
      phase === 'briefing' ||
      phase === 'paused' ||
      phase === 'game-over'
    ) {
      // Reset wave state so it's clean for next game
      if (ws.config !== null) {
        waveState.current = createInitialWaveState();
      }
      return;
    }

    // ---- PLAYING: spawn and monitor ----
    if (phase === 'playing') {
      // Initialize wave if needed
      if (ws.config === null || ws.config.waveNumber !== wave) {
        const currentWave = wave === 0 ? 1 : wave;
        // Advance wave in store if wave is 0 (game just started)
        if (wave === 0) {
          store.advanceWave(); // wave becomes 1
        }
        const config = generateWaveConfig(currentWave);
        const seed = currentWave * 7919; // deterministic seed per wave
        ws.config = config;
        ws.spawnEntries = buildSpawnEntries(config, seed);
        ws.waveTimer = 0;
        ws.allSpawned = false;
        ws.waveBonusAwarded = false;
      }

      // Tick wave timer
      ws.waveTimer += delta;

      // Spawn enemies whose delay has elapsed
      let spawnedThisFrame = false;
      for (const entry of ws.spawnEntries) {
        if (!entry.spawned && ws.waveTimer >= entry.delay) {
          store.spawnEnemy(entry.type, entry.position);
          entry.spawned = true;
          spawnedThisFrame = true;
        }
      }

      // Check if all enemies have been spawned
      if (!ws.allSpawned) {
        ws.allSpawned = ws.spawnEntries.every((e) => e.spawned);
      }

      // Avoid reading stale state if we just spawned
      if (spawnedThisFrame) return;

      // Detect wave clear: all spawned AND all enemies sunk (enemiesRemaining === 0)
      const currentStore = useGameStore.getState();
      if (ws.allSpawned && currentStore.enemiesRemaining === 0 && ws.spawnEntries.length > 0) {
        // Award wave survival bonus
        if (!ws.waveBonusAwarded) {
          store.addScore(SCORE.WAVE_SURVIVED);
          ws.waveBonusAwarded = true;
        }
        store.setPhase('wave-clear');
        ws.waveClearTimer = WAVE_CLEAR_DELAY;
      }

      return;
    }

    // ---- WAVE-CLEAR: countdown to next wave ----
    // phase === 'wave-clear' is the only remaining possibility
    ws.waveClearTimer -= delta;

    if (ws.waveClearTimer <= 0) {
      store.advanceWave();
      // Reset wave state so next frame picks up the new wave
      waveState.current = createInitialWaveState();
      store.setPhase('playing');
    }
  });

  return null;
}
