# Phase 7: UI (HUD, Title Screen, Game Over)

## Objective

Implement the HTML overlay HUD (health bars, wave counter, score, quadrant indicator), title screen, game-over screen, and enemy health bars using drei Billboard.

## Prerequisites

- Phase 0 complete (store with selectors)
- Phase 6 complete (game phases, score, wave number)

## Files to Create/Modify

```
src/
  ui/
    HUD.tsx                  # Main HUD container
    HealthBar.tsx            # Player armor + hull display
    WaveCounter.tsx          # Wave number display
    ScoreDisplay.tsx         # Score display
    QuadrantIndicator.tsx    # Active firing quadrant visual
    TitleScreen.tsx          # Start screen overlay
    GameOverScreen.tsx       # Game over overlay
    EnemyHealthBar.tsx       # drei Billboard above enemy boats
  store/
    selectors.ts             # Memoized selectors for HUD values
  entities/
    EnemyBoat.tsx            # Add EnemyHealthBar to enemy boats
  App.tsx                    # Add HUD, title, game-over screens
```

## Implementation Details

### 1. Store Selectors (`selectors.ts`)

Create selectors that React UI components subscribe to. These cause re-renders, which is correct for UI.

```typescript
import { useGameStore } from './gameStore';

export const usePlayerHealth = () => useGameStore(s => s.player?.health);
export const useWaveNumber = () => useGameStore(s => s.wave);
export const useScore = () => useGameStore(s => s.score);
export const useActiveQuadrant = () => useGameStore(s => s.activeQuadrant);
export const useGamePhase = () => useGameStore(s => s.phase);
export const useEnemiesRemaining = () => useGameStore(s => s.enemiesRemaining);
```

### 2. HUD Container (`HUD.tsx`)

- drei `<Html>` component with `fullscreen` prop, positioned as overlay
- `pointer-events: none` on the container (clicks pass through to canvas)
- Only renders when `phase === 'playing'` or `phase === 'wave-clear'`
- Contains: HealthBar, WaveCounter, ScoreDisplay, QuadrantIndicator

### 3. Health Bar (`HealthBar.tsx`)

- Position: bottom-left of screen
- Two stacked bars:
  - Blue bar (armor): width = `(armor / armorMax) * 100%`
  - Red bar (hull): width = `(hull / hullMax) * 100%`
- Numeric labels: "ARMOR 85/100", "HULL 100/100"
- CSS transitions for smooth width changes
- Subscribes to `usePlayerHealth()` selector

### 4. Wave Counter (`WaveCounter.tsx`)

- Position: top-center
- Text: "WAVE 3"
- Large, bold, white with text shadow
- Subscribes to `useWaveNumber()` selector

### 5. Score Display (`ScoreDisplay.tsx`)

- Position: top-right
- Text: score number with thousands separator
- White, mono-spaced font
- Subscribes to `useScore()` selector

### 6. Quadrant Indicator (`QuadrantIndicator.tsx`)

- Position: center of screen
- Four directional segments arranged in a diamond/cross pattern
- Labels: F (fore), A (aft), P (port), S (starboard)
- Active quadrant: bright white/yellow, slightly larger
- Inactive quadrants: dimmed grey, smaller
- CSS-only, no canvas drawing needed
- Subscribes to `useActiveQuadrant()` selector

### 7. Title Screen (`TitleScreen.tsx`)

- Full-screen overlay with semi-transparent dark background
- Title: "GUNBOAT RAIDERS" in large, bold, distressed-style font
- Subtitle: "Survive the waves. Sink the rest."
- Button: "START GAME" with `pointer-events: auto`
- On click: calls `store.resetGame()`, `store.spawnPlayer()`, `store.setPhase('playing')`
- Only visible when `phase === 'title'`

### 8. Game Over Screen (`GameOverScreen.tsx`)

- Full-screen overlay with semi-transparent dark red background
- Title: "SUNK" in large text
- Stats: "Waves Survived: X", "Enemies Sunk: Y", "Final Score: Z"
- Button: "PLAY AGAIN" with `pointer-events: auto`
- On click: same as title screen start flow
- Only visible when `phase === 'game-over'`

### 9. Enemy Health Bar (`EnemyHealthBar.tsx`)

- drei `<Billboard>` component above each enemy boat (Y offset +3)
- Small horizontal bar showing armor (blue) + hull (red)
- Only visible when enemy has taken damage (full health = hidden)
- `<Html>` inside `<Billboard>` for CSS styling, or use a simple `<Plane>` mesh with colored materials

### 10. App.tsx Updates

- Add `<HUD />` inside Canvas (drei Html)
- Add `<TitleScreen />` and `<GameOverScreen />` as regular React components OUTSIDE the Canvas (HTML overlay)
- Conditionally render game entities only when `phase !== 'title'`

## Tests to Write

### `tests/unit/selectors.test.ts`

```
- test: usePlayerHealth returns null when no player spawned
- test: usePlayerHealth returns correct health after spawnPlayer
- test: useWaveNumber returns 0 initially
- test: useWaveNumber returns 1 after advanceWave
- test: useScore returns 0 initially
- test: useScore returns 100 after addScore(100)
- test: useActiveQuadrant returns 'fore' by default
- test: useGamePhase returns 'title' initially
```

Note: Since these are Zustand selectors, test them by calling store actions and checking getState() values directly. Do not try to render React hooks in unit tests -- just test the store state that selectors read from.

### `tests/smoke/ui.spec.ts` (Playwright)

```
- test: title screen is visible on page load
- test: title screen shows "GUNBOAT RAIDERS" text
- test: clicking start game hides title screen
- test: HUD elements appear after starting game (health bar, wave counter, score)
- test: quadrant indicator has 4 directional segments
```

## Acceptance Criteria

- [ ] `pnpm test -- tests/unit/selectors.test.ts` passes all 8 tests
- [ ] `pnpm test:smoke` passes UI smoke tests
- [ ] Title screen is visible on initial page load
- [ ] Clicking "START GAME" transitions to playing state
- [ ] HUD shows health bars, wave counter, score during gameplay
- [ ] Quadrant indicator updates as camera moves (manual visual check only)
- [ ] Game-over screen shows on player death with correct stats
- [ ] "PLAY AGAIN" restarts the game cleanly
- [ ] `pnpm verify` passes

## Verification Command

```bash
pnpm verify && pnpm test:smoke
```
