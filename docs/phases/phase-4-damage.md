# Phase 4: Damage System

## Objective

Implement the armor/hull damage model, collision-driven damage application, armor regeneration, splash damage on water impact, and boat sinking when hull reaches zero.

## Prerequisites

- Phase 0 complete (store with applyDamage action)
- Phase 3 complete (projectile pool, collision events)

## Files to Create/Modify

```
src/
  systems/
    DamageSystem.ts          # Pure logic: damage calculation
    DamageSystemR3F.tsx       # R3F: collision event handler, armor regen
  utils/
    collisionGroups.ts       # Verify/update collision matrix
  store/
    gameStore.ts             # Ensure applyDamage handles armor->hull overflow
tests/
  unit/
    damage.test.ts
```

## Implementation Details

### 1. Damage Calculation (Pure Logic - `DamageSystem.ts`)

```typescript
export interface DamageInput {
  currentArmor: number;
  currentHull: number;
  incomingDamage: number;
}

export interface DamageResult {
  newArmor: number;
  newHull: number;
  armorDamageDealt: number;
  hullDamageDealt: number;
  isSunk: boolean;
}

/**
 * Apply damage: armor absorbs first, overflow goes to hull.
 * Returns new health values and whether the target is sunk.
 */
export function calculateDamage(input: DamageInput): DamageResult {
  const armorDamageDealt = Math.min(input.currentArmor, input.incomingDamage);
  const overflow = input.incomingDamage - armorDamageDealt;
  const hullDamageDealt = Math.min(input.currentHull, overflow);
  const newArmor = input.currentArmor - armorDamageDealt;
  const newHull = input.currentHull - hullDamageDealt;
  return {
    newArmor,
    newHull,
    armorDamageDealt,
    hullDamageDealt,
    isSunk: newHull <= 0,
  };
}

/**
 * Compute splash damage for entities within radius of impact point.
 * Damage attenuates linearly with distance.
 */
export function calculateSplashDamage(
  impactPosition: [number, number, number],
  targets: Array<{ id: string; position: [number, number, number] }>,
  splashDamage: number,
  splashRadius: number,
  ownerId: string
): Array<{ id: string; damage: number }>;

/**
 * Compute armor regeneration for one frame.
 */
export function regenArmor(
  currentArmor: number,
  armorMax: number,
  regenRate: number,
  delta: number
): number;
```

### 2. Damage System R3F (`DamageSystemR3F.tsx`)

Handles collision events from the projectile pool:

- `onCollisionEnter` callback registered on projectile rigid bodies (in ProjectilePool)
- When a projectile collides with a boat:
  1. Identify the hit entity from rigid body userData (set entityId on each body)
  2. Look up projectile data from store (damage, ownerId)
  3. Prevent self-damage: if `projectile.ownerId === hitEntity.id`, skip
  4. Call `calculateDamage()` with current health and incoming damage
  5. Update store via `applyDamage(targetId, damage)`
  6. If `isSunk`: set `isSinking = true` on entity, add score (100 for skiff, 250 for barge)
  7. Deactivate the projectile (return to pool)

Splash damage on water impact:
- In `ProjectileSystemR3F`, when checking expired projectiles, also check if `projectile.y < getWaveHeight(x, z, t).height`
- On water impact: call `calculateSplashDamage()` with all boat positions
- Apply damage to each affected boat
- Deactivate the projectile

Armor regeneration:
- In `useFrame`: for each boat entity in store, call `regenArmor()` and update armor

### 3. Collision Groups (verify in `collisionGroups.ts`)

Using `interactionGroups(membership, filter)` from react-three-rapier:

| Body Type | Membership | Collides With |
|-----------|-----------|---------------|
| Player | 0 | 1 (enemy), 3 (enemy projectile), 4 (environment) |
| Enemy | 1 | 0 (player), 2 (player projectile), 4 (environment), 1 (enemy) |
| Player Projectile | 2 | 1 (enemy), 4 (environment) |
| Enemy Projectile | 3 | 0 (player), 4 (environment) |
| Environment | 4 | 0, 1, 2, 3 (all) |

### 4. Store Updates (`gameStore.ts`)

Ensure `applyDamage` action:
- Accepts `(targetId: EntityId, damage: number)`
- Finds entity (player or in enemies map)
- Calls `calculateDamage` logic
- Updates entity health in store
- If hull <= 0: sets `isSinking = true`
- If target is enemy and sunk: decrements `enemiesRemaining`, increments `enemiesSunkTotal`
- If target is player and sunk: sets phase to `game-over`

### 5. Sinking Behavior

When a boat's `isSinking` flag is true:
- In R3F render component: gradually translate Y downward (e.g., -2 units/sec)
- Apply a slow roll rotation
- After 3 seconds: remove from store and unmount component
- No more collision detection while sinking (disable collider or move to inactive group)

## Tests to Write

### `tests/unit/damage.test.ts`

```
- test: full armor absorbs all damage, hull unchanged
  input: armor=50, hull=100, damage=30
  expect: newArmor=20, newHull=100, isSunk=false

- test: damage exceeds armor, overflow hits hull
  input: armor=20, hull=100, damage=50
  expect: newArmor=0, newHull=70, isSunk=false

- test: zero armor means all damage goes to hull
  input: armor=0, hull=50, damage=30
  expect: newArmor=0, newHull=20, isSunk=false

- test: damage exactly kills hull
  input: armor=0, hull=30, damage=30
  expect: newHull=0, isSunk=true

- test: overkill damage does not make hull negative
  input: armor=0, hull=10, damage=50
  expect: newHull=0, isSunk=true

- test: massive damage through armor and hull in one hit
  input: armor=10, hull=20, damage=100
  expect: newArmor=0, newHull=0, isSunk=true

- test: zero damage changes nothing
  input: armor=50, hull=100, damage=0
  expect: newArmor=50, newHull=100, isSunk=false

- test: splashDamage returns empty array when no targets in radius
- test: splashDamage returns correct attenuated damage for target at half radius
- test: splashDamage excludes owner from targets
- test: splashDamage with target at edge of radius returns near-zero damage
- test: splashDamage with target at center returns full splashDamage

- test: regenArmor increases armor by regenRate * delta
- test: regenArmor does not exceed armorMax
- test: regenArmor with armor already at max returns max
```

## Acceptance Criteria

- [ ] `pnpm test -- tests/unit/damage.test.ts` passes all 15+ tests
- [ ] `calculateDamage` runs in Node.js with no browser APIs
- [ ] `calculateSplashDamage` runs in Node.js with no browser APIs
- [ ] `regenArmor` runs in Node.js with no browser APIs
- [ ] Store `applyDamage` correctly transitions player to game-over when hull=0
- [ ] Store `applyDamage` correctly decrements enemiesRemaining on enemy sink
- [ ] `pnpm verify` passes

## Verification Command

```bash
pnpm verify
```
