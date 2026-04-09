# Phase 6: Wave Spawning and Game Loop

## Objective

Implement wave-based enemy spawning with increasing difficulty, score tracking, and full game phase transitions (title, playing, wave-clear, game-over). After this phase, the game is fully playable.

## Prerequisites

- Phase 0 complete (store with game phases, score)
- Phase 4 complete (damage, sinking, game-over on player death)
- Phase 5 complete (enemy boats, AI)

## Files to Create/Modify

```
src/
  systems/
    WaveSystem.ts           # Pure logic: wave config generation, spawn positions, progression
    WaveSystemR3F.tsx        # R3F: useFrame checking wave state, spawning enemies
  store/
    gameStore.ts             # Verify: advanceWave, setPhase, resetGame actions
  utils/
    seededRandom.ts          # Already created in Phase 0, used for spawn positions
tests/
  unit/
    waveSystem.test.ts
```

## Implementation Details

### 1. Wave Configuration (Pure Logic - `WaveSystem.ts`)

```typescript
export interface WaveConfig {
  waveNumber: number;
  enemies: Array<{
    type: EnemyType;
    count: number;
    spawnDelay: number;  // seconds after wave start before this group spawns
  }>;
}

/**
 * Generate wave config for a given wave number.
 * Difficulty scales with wave number.
 */
export function generateWaveConfig(waveNumber: number): WaveConfig {
  // Wave 1: 2 skiffs
  // Wave 2: 3 skiffs
  // Wave 3: 4 skiffs
  // Wave 4+: waveNumber + 1 skiffs, capped at 8
  // Barge: introduced at wave 5 (1 barge), +1 every 3 waves after
  const skiffCount = Math.min(waveNumber + 1, 8);
  const bargeCount = waveNumber >= 5 ? 1 + Math.floor((waveNumber - 5) / 3) : 0;
  
  const enemies: WaveConfig['enemies'] = [
    { type: 'skiff', count: skiffCount, spawnDelay: 0 },
  ];
  if (bargeCount > 0) {
    enemies.push({ type: 'barge', count: Math.min(bargeCount, 3), spawnDelay: 2 });
  }
  return { waveNumber, enemies };
}

/**
 * Generate deterministic spawn positions for a wave.
 * Enemies spawn 80-120m from center, evenly distributed around a circle.
 */
export function generateSpawnPositions(
  count: number,
  seed: number,
  minRadius: number,   // 80
  maxRadius: number,   // 120
): Array<[number, number, number]> {
  // Use seeded PRNG for deterministic results
  // Distribute angles evenly with small random jitter
  // Y is always 0 (buoyancy handles vertical)
}

/** Score values */
export const SCORE = {
  SKIFF_SUNK: 100,
  BARGE_SUNK: 250,
  WAVE_SURVIVED: 500,
} as const;

/**
 * Calculate score for sinking an enemy.
 */
export function scoreForEnemy(type: EnemyType): number {
  return type === 'barge' ? SCORE.BARGE_SUNK : SCORE.SKIFF_SUNK;
}
```

### 2. Wave System R3F (`WaveSystemR3F.tsx`)

`useFrame` logic:

```
if phase === 'title': do nothing (waiting for user to start)

if phase === 'playing':
  if no active wave (wave === 0 or just started):
    generate wave config for wave 1
    set enemiesRemaining = total enemy count
    begin spawning enemies with staggered delays

  if spawning in progress:
    tick spawn timers
    spawn next enemy when its delay elapses
    call store.spawnEnemy(type, position) for each

  if enemiesRemaining === 0 AND all enemies sunk:
    add SCORE.WAVE_SURVIVED to score
    set phase to 'wave-clear'
    start wave-clear timer (3 seconds)

if phase === 'wave-clear':
  tick timer
  when timer <= 0:
    call store.advanceWave()
    generate next wave config
    set phase to 'playing'
    begin spawning next wave

if phase === 'game-over': do nothing (UI handles restart)
```

### 3. Game Start Flow

When the player clicks "Start" on the title screen:
1. `store.resetGame()` - clear all entities, reset score/wave
2. `store.spawnPlayer()` - create player entity
3. `store.setPhase('playing')` - start the game loop
4. WaveSystem picks up the 'playing' phase and begins wave 1

### 4. Game Over Flow

When player hull reaches 0 (handled in DamageSystem/store):
1. `store.setPhase('game-over')` - triggered by applyDamage when player sinks
2. WaveSystem stops spawning
3. UI shows game-over screen with final score and wave number

### 5. Restart Flow

When player clicks "Restart" on game-over screen:
1. Remove all enemies and projectiles from store
2. `store.resetGame()`
3. `store.spawnPlayer()`
4. `store.setPhase('playing')`

## Tests to Write

### `tests/unit/waveSystem.test.ts`

```
- test: wave 1 config has 2 skiffs, 0 barges
- test: wave 2 config has 3 skiffs, 0 barges
- test: wave 3 config has 4 skiffs, 0 barges
- test: wave 5 config includes 1 barge
- test: wave 8 config includes 2 barges (1 + floor((8-5)/3) = 2)
- test: skiff count caps at 8
- test: barge count caps at 3

- test: generateSpawnPositions returns correct count of positions
- test: generateSpawnPositions with same seed returns identical positions
- test: generateSpawnPositions with different seed returns different positions
- test: all spawn positions are within minRadius-maxRadius distance from origin
- test: spawn position Y coordinate is always 0

- test: scoreForEnemy('skiff') returns 100
- test: scoreForEnemy('barge') returns 250
- test: WAVE_SURVIVED constant is 500

- test: store advanceWave increments wave number
- test: store resetGame resets wave to 0, score to 0, phase to 'title'
```

## Acceptance Criteria

- [ ] `pnpm test -- tests/unit/waveSystem.test.ts` passes all 16+ tests
- [ ] `generateWaveConfig` runs in Node.js with no browser APIs
- [ ] `generateSpawnPositions` is deterministic (same seed = same positions)
- [ ] Spawn positions are always within the 80-120m radius band
- [ ] Score values match: skiff=100, barge=250, wave=500
- [ ] `pnpm verify` passes
- [ ] Game phase transitions are testable via store actions alone (no rendering needed)

## Verification Command

```bash
pnpm verify
```
