# Phase 8: Rock Obstacles

## Objective

Add seeded procedurally placed rock obstacles as static Rapier rigid bodies that boats and projectiles collide with, creating tactical cover and navigation hazards.

## Prerequisites

- Phase 0 complete (seededRandom, collisionGroups)
- Phase 2 complete (boat physics, collision handling)
- Phase 4 complete (damage system for rock-boat collisions)

## Files to Create/Modify

```
src/
  entities/
    Rock.tsx                 # Single rock: static rigid body + visual mesh
  environment/
    Rocks.tsx                # Seeded procedural placement of all rocks
  utils/
    rockPlacement.ts         # Pure logic: generate rock positions from seed
  App.tsx                    # Add Rocks component
tests/
  unit/
    rockPlacement.test.ts
```

## Implementation Details

### 1. Rock Placement (Pure Logic - `rockPlacement.ts`)

```typescript
export interface RockConfig {
  position: [number, number, number];
  scale: [number, number, number];     // non-uniform for organic look
  rotation: [number, number, number];   // euler angles
}

/**
 * Generate deterministic rock positions for the arena.
 * 
 * @param seed - random seed for deterministic placement
 * @param count - number of rocks (15-25)
 * @param arenaRadius - max distance from center (200)
 * @param safeZoneRadius - min distance from center (30, player spawn area)
 * @param minSpacing - min distance between rocks (15)
 */
export function generateRockPositions(
  seed: number,
  count: number,
  arenaRadius: number,
  safeZoneRadius: number,
  minSpacing: number
): RockConfig[];
```

Algorithm:
1. Initialize seeded PRNG with `seed`
2. For each rock (up to `count`):
   - Generate random angle (0..2PI) and radius (safeZoneRadius..arenaRadius)
   - Convert to XZ position
   - Check minimum distance against all previously placed rocks
   - If too close, retry (up to 10 attempts, then skip this rock)
   - Y position: 0 (at water level, visual extends above and below)
   - Scale: random between [1.5, 2, 1.5] and [4, 6, 4] (non-uniform)
   - Rotation: random euler angles for organic look

### 2. Rock Entity (`Rock.tsx`)

- `<RigidBody type="fixed">` (static, immovable)
- `<CuboidCollider>` or `<ConvexHullCollider>` sized to match visual
- Collision group: ENVIRONMENT (collides with all)
- Visual: drei `<Icosahedron>` with `detail={1}` for a faceted rock look
  - Apply non-uniform scale from `RockConfig.scale`
  - Apply rotation from `RockConfig.rotation`
  - Material: `MeshStandardMaterial` with dark grey color, high roughness
- Y position: partially submerged (wave height at position minus a small offset)
  - Use `getWaveHeight` at rock position for initial Y, then static (rocks don't bob)

### 3. Rocks Container (`Rocks.tsx`)

- Call `generateRockPositions()` with a fixed seed (e.g., 42) on mount
- Render `<Rock>` for each `RockConfig`
- Memoize the positions (they never change during a game session)

### 4. Rock-Boat Collision

Collisions between rocks and boats are already handled by the Rapier physics engine through collision groups. The boat will simply bounce off or be blocked. Optionally, the damage system can apply a small amount of hull damage on rock collision (e.g., 5 hull damage per impact), but this is not required for MVP.

### 5. App.tsx Updates

- Add `<Rocks />` inside the Physics provider
- Rocks render regardless of game phase (they're environment, always present)

## Tests to Write

### `tests/unit/rockPlacement.test.ts`

```
- test: generateRockPositions returns correct count of rocks
- test: same seed produces identical positions (deterministic)
- test: different seed produces different positions
- test: all rocks are within arena radius
- test: no rocks are within safe zone radius
- test: minimum spacing between any two rocks is >= minSpacing
- test: rock scales are within expected bounds
- test: rock Y positions are all 0 (water level)
- test: function handles count=0 (returns empty array)
- test: function handles count=1 (single rock, no spacing constraint)
```

## Acceptance Criteria

- [ ] `pnpm test -- tests/unit/rockPlacement.test.ts` passes all 10 tests
- [ ] `generateRockPositions` runs in Node.js with no browser APIs
- [ ] Same seed always produces identical rock layout
- [ ] No rocks spawn within 30m of center (player safe zone)
- [ ] All rocks are within 200m of center (arena bounds)
- [ ] Minimum 15m spacing between any two rocks
- [ ] `pnpm verify` passes
- [ ] Playwright smoke: canvas renders with rocks visible (screenshot check)

## Verification Command

```bash
pnpm verify
```
