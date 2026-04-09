# Phase 0: Project Scaffolding and Test Infrastructure

## Objective

Set up Vite + React 19 + TypeScript project with all dependencies, Vitest for headless unit tests, Playwright for visual smoke tests, and the simulation-step abstraction that enables all subsequent phases to be tested without a browser.

## Prerequisites

None. This is the first phase.

## Files to Create

```
src/
  main.tsx
  App.tsx
  vite-env.d.ts
  store/
    gameStore.ts
  systems/
    types.ts           # SimulatableSystem interface
  utils/
    constants.ts
    math.ts
    boatStats.ts
    collisionGroups.ts
    seededRandom.ts
tests/
  setup.ts             # Vitest setup
  unit/
    store.test.ts
  smoke/
    app.spec.ts        # Playwright smoke test
vitest.config.ts
playwright.config.ts
tsconfig.json
vite.config.ts
package.json
index.html
```

## Implementation Details

### 1. Project Initialization

```bash
pnpm create vite@latest . --template react-ts
```

### 2. Install Dependencies

```bash
pnpm add react@19 react-dom@19 \
  @react-three/fiber @react-three/drei @react-three/postprocessing \
  @react-three/rapier three \
  three.quarks howler zustand nanoid

pnpm add -D @types/three @types/howler \
  vitest @vitest/ui \
  playwright @playwright/test \
  eslint typescript
```

### 3. TypeScript Configuration

`tsconfig.json` must use strict mode and path aliases:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

### 4. Vite Configuration

`vite.config.ts`:
- React plugin
- Path alias resolution (`@/` maps to `src/`)
- No special config needed yet

### 5. Vitest Configuration

`vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
```

### 6. Playwright Configuration

`playwright.config.ts`:
- Base URL: `http://localhost:5173`
- Web server: `pnpm dev`
- Single Chromium browser
- Screenshot on failure

### 7. Package Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "playwright test",
    "verify": "pnpm build && pnpm lint && pnpm test"
  }
}
```

### 8. Simulation Step Abstraction

This is the critical architecture for testability. All game systems must be callable without a renderer.

`src/systems/types.ts`:

```typescript
/** Input state that systems read each frame */
export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  mouseX: number;  // normalized -1..1
  mouseY: number;  // normalized -1..1
}

/** Default input (nothing pressed) */
export const EMPTY_INPUT: InputState = {
  forward: false, backward: false,
  left: false, right: false,
  fire: false, mouseX: 0, mouseY: 0,
};

/**
 * All game systems implement this interface.
 * Systems read from the Zustand store via getState(),
 * apply logic, then write back via actions.
 * 
 * The `step` method can be called:
 * - From useFrame (rendering context)
 * - From a headless test (no Canvas, no GPU)
 */
export interface SimulatableSystem {
  step(delta: number, input: InputState): void;
}
```

### 9. Zustand Store Skeleton

`src/store/gameStore.ts`:

Define the full `GameState` interface from the PRD with all types:

```typescript
type EntityId = string;
type EntityType = 'player' | 'enemy' | 'projectile' | 'rock';
type FiringQuadrant = 'fore' | 'aft' | 'port' | 'starboard';
type EnemyType = 'skiff' | 'barge';
type AIState = 'spawning' | 'approaching' | 'positioning' | 'broadside' | 'fleeing' | 'sinking';
type GamePhase = 'title' | 'playing' | 'wave-clear' | 'game-over';
```

Include all component interfaces: `HealthComponent`, `WeaponMount`, `WeaponComponent`, `MovementComponent`, `AIComponent`, `BoatEntity`, `ProjectileEntity`, `WaveConfig`, `GameState`.

Implement all store actions: `spawnPlayer`, `spawnEnemy`, `removeEnemy`, `spawnProjectile`, `removeProjectile`, `applyDamage`, `setActiveQuadrant`, `advanceWave`, `addScore`, `setPhase`, `resetGame`.

See the PRD `Data Architecture` section for exact type definitions.

### 10. Utility Modules

`src/utils/constants.ts`: All game balance constants (buoyancy strength, water drag, boat mass, etc.)

`src/utils/math.ts`: Vector helpers, angle normalization, quadrant calculation function:

```typescript
export function getQuadrant(cameraAngle: number, boatHeading: number): FiringQuadrant {
  let relative = cameraAngle - boatHeading;
  // Normalize to -PI..PI
  relative = ((relative + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (relative > -Math.PI / 4 && relative <= Math.PI / 4) return 'fore';
  if (relative > Math.PI / 4 && relative <= 3 * Math.PI / 4) return 'starboard';
  if (relative > -3 * Math.PI / 4 && relative <= -Math.PI / 4) return 'port';
  return 'aft';
}
```

`src/utils/boatStats.ts`: Player, skiff, and barge stat presets (copy exactly from PRD `Boat Stat Presets`).

`src/utils/collisionGroups.ts`: Rapier collision group bitmask definitions (from PRD `Collision Groups`).

`src/utils/seededRandom.ts`: Simple mulberry32 or similar PRNG accepting a seed number.

### 11. App.tsx - Minimal R3F Scene

```tsx
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';

export function App() {
  return (
    <Canvas>
      <Physics gravity={[0, -9.81, 0]}>
        {/* Future phases add entities here */}
      </Physics>
      <ambientLight intensity={0.5} />
    </Canvas>
  );
}
```

## Tests to Write

### `tests/unit/store.test.ts`

```
- test: initial state has phase='title', wave=0, score=0
- test: spawnPlayer creates a player entity with correct health stats
- test: spawnEnemy adds to enemies map with correct type
- test: applyDamage reduces armor first, then hull
- test: applyDamage with damage > armor overflows to hull correctly
- test: removeEnemy decrements enemiesRemaining
- test: advanceWave increments wave number
- test: addScore increases score
- test: setPhase transitions game phase
- test: resetGame returns to initial state
```

### `tests/unit/math.test.ts`

```
- test: getQuadrant returns 'fore' when camera faces same direction as boat
- test: getQuadrant returns 'port' when camera is left of boat heading
- test: getQuadrant returns 'starboard' when camera is right of boat heading
- test: getQuadrant returns 'aft' when camera faces opposite to boat
- test: getQuadrant handles angle wrapping around PI/-PI
```

### `tests/unit/seededRandom.test.ts`

```
- test: same seed produces same sequence
- test: different seeds produce different sequences
- test: output is in range [0, 1)
```

### `tests/smoke/app.spec.ts` (Playwright)

```
- test: page loads without errors
- test: canvas element exists in DOM
```

## Acceptance Criteria

- [ ] `pnpm build` completes with zero errors
- [ ] `pnpm lint` (tsc --noEmit) passes with zero errors
- [ ] `pnpm test` runs all unit tests and passes (store, math, seededRandom)
- [ ] `pnpm test:smoke` opens browser, finds canvas element, passes
- [ ] `pnpm verify` runs build + lint + test sequentially and succeeds
- [ ] Zustand store can be instantiated in Node.js without any browser/Canvas APIs
- [ ] `InputState` and `SimulatableSystem` types are exported and importable from `@/systems/types`

## Verification Command

```bash
pnpm verify
```
