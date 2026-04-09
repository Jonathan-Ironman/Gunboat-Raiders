# Phase 5: Enemy Boats and AI

## Objective

Create enemy boat entities that load enemy-skiff.glb, implement the AI state machine (spawning, approaching, positioning, broadside, sinking), and enable enemies to fire broadsides at the player.

## Prerequisites

- Phase 0 complete (store, SimulatableSystem)
- Phase 2 complete (boat entity pattern, buoyancy)
- Phase 3 complete (weapon system, projectile pool)
- Phase 4 complete (damage system, collision groups)

## Files to Create/Modify

```
src/
  entities/
    EnemyBoat.tsx           # Rigid body + model + store registration
  systems/
    AISystem.ts             # Pure logic: state machine transitions, decisions
    AISystemR3F.tsx          # R3F: useFrame applying AI decisions to rigid bodies
  App.tsx                    # Add enemy rendering based on store
tests/
  unit/
    ai.test.ts
```

## 3D Assets

- `public/models/enemy-skiff.glb` - grunt enemy boat model
- `public/models/cannon.glb` - reuse cannon model for enemy weapon mounts

## Implementation Details

### 1. AI State Machine (Pure Logic - `AISystem.ts`)

```typescript
export interface AIContext {
  selfPosition: [number, number, number];
  selfHeading: number;                    // radians
  selfHealth: { armor: number; hull: number; hullMax: number };
  targetPosition: [number, number, number];
  distanceToTarget: number;
  preferredRange: number;
  detectionRange: number;
  currentState: AIState;
  stateTimer: number;
  weaponCooldownReady: boolean;           // can fire broadside?
}

export interface AIDecision {
  newState: AIState;
  newStateTimer: number;
  thrust: number;       // -1 to 1 (reverse to full forward)
  turn: number;         // -1 to 1 (port to starboard)
  fire: boolean;
  fireQuadrant: FiringQuadrant | null;
}

export function computeAIDecision(ctx: AIContext, delta: number): AIDecision;
```

State machine transitions:

**SPAWNING** (2 seconds invulnerability, fade-in)
- `stateTimer -= delta`
- When timer <= 0: transition to APPROACHING
- No movement, no firing

**APPROACHING** (move toward player)
- Compute direction to player
- Set `thrust = 1`, `turn` to steer toward player
- When `distanceToTarget <= preferredRange`: transition to POSITIONING

**POSITIONING** (maneuver for broadside)
- Turn to present port or starboard to player (whichever requires less turning)
- Determine which side faces player: compute angle from enemy heading to player direction
  - If player is to the left: present PORT broadside (turn right so left side faces player)
  - If player is to the right: present STARBOARD broadside
- `thrust = 0.3` (slow drift, maintain position)
- When broadside angle is within 30 degrees of ideal: transition to BROADSIDE

**BROADSIDE** (fire!)
- Fire from the quadrant facing the player
- After firing: hold for 1.5 seconds (stateTimer), then transition to APPROACHING
- `thrust = 0.2` (minimal movement)
- `turn = 0` (hold position)

**FLEEING** (stretch: hull < 20%)
- Turn away from player, full thrust
- Not required for MVP, can be omitted

**SINKING** (hull <= 0)
- No AI decisions, visual component handles animation
- Return neutral decision (no thrust, no turn, no fire)

Steering logic:
```typescript
function steerToward(selfHeading: number, targetAngle: number): number {
  let diff = targetAngle - selfHeading;
  // normalize to -PI..PI
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.sign(diff); // -1 or 1
}
```

### 2. AI System R3F (`AISystemR3F.tsx`)

- `useFrame` iterating over all enemies in `useGameStore.getState().enemies`
- For each enemy:
  1. Read rigid body position and rotation from Rapier (via ref map)
  2. Compute distance to player
  3. Build `AIContext`
  4. Call `computeAIDecision(ctx, delta)`
  5. Apply: update state/timer in store, apply forces to rigid body, trigger fire via weapon system

### 3. Enemy Boat Entity (`EnemyBoat.tsx`)

- Same pattern as PlayerBoat but:
  - Collision group: ENEMY (collides with Player, PlayerProjectile, Environment, other enemies)
  - Stats from `boatStats.skiff`
  - Load `enemy-skiff.glb` model
  - Mount `cannon.glb` at skiff weapon mount positions (2 mounts: port and starboard)
  - Different color tint or material override to distinguish from player
- Register in store via `spawnEnemy(type, position)` on mount
- Remove from store on unmount
- Sinking: when `isSinking`, animate Y downward + roll, remove after 3 seconds

### 4. App.tsx Updates

- Read `enemies` from store
- Render `<EnemyBoat>` for each enemy entity
- Buoyancy system already handles all rigid bodies (player + enemies)

## Tests to Write

### `tests/unit/ai.test.ts`

```
- test: SPAWNING state with timer > 0 stays in SPAWNING, no thrust/fire
- test: SPAWNING state with timer <= 0 transitions to APPROACHING
- test: APPROACHING moves toward target (thrust > 0)
- test: APPROACHING transitions to POSITIONING when within preferred range
- test: APPROACHING does NOT transition when beyond preferred range
- test: POSITIONING turns to present broadside (non-zero turn output)
- test: POSITIONING transitions to BROADSIDE when angle is within 30 degrees
- test: BROADSIDE sets fire=true with correct quadrant
- test: BROADSIDE transitions to APPROACHING after timer expires
- test: SINKING returns zero thrust, zero turn, no fire
- test: steerToward returns positive for target to the left
- test: steerToward returns negative for target to the right
- test: steerToward handles wrapping around PI boundary
- test: AI at detection range starts approaching (not ignoring)
- test: AI beyond detection range does not engage (stays neutral or patrolling)
```

## Acceptance Criteria

- [ ] `pnpm test -- tests/unit/ai.test.ts` passes all 15 tests
- [ ] `computeAIDecision` runs in Node.js with no browser APIs
- [ ] AI state machine is deterministic (same inputs = same outputs)
- [ ] `pnpm verify` passes
- [ ] Playwright smoke: canvas renders without errors when enemies are present

## Verification Command

```bash
pnpm verify
```
