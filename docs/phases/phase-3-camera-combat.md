# Phase 3: Camera, Quadrant Detection, and Cannon Combat

## Objective

Implement the independent orbit camera, quadrant detection system (camera angle relative to boat heading), cannon firing, projectile pool with physics, and trajectory preview arc.

## Prerequisites

- Phase 0 complete (store, test infra)
- Phase 1 complete (water, getWaveHeight)
- Phase 2 complete (player boat, buoyancy, movement)

## Files to Create/Modify

```
src/
  systems/
    CameraSystem.ts         # Pure logic: quadrant detection
    CameraSystemR3F.tsx      # R3F: custom camera orbit + quadrant update
    WeaponSystem.ts          # Pure logic: cooldown tick, fire decision
    WeaponSystemR3F.tsx      # R3F: mouse click, projectile spawning
    ProjectileSystem.ts      # Pure logic: lifetime management
    ProjectileSystemR3F.tsx  # R3F: despawn expired projectiles
  entities/
    ProjectilePool.tsx       # InstancedRigidBodies pool (50 cannonballs)
  effects/
    TrajectoryPreview.tsx    # Visual arc showing landing zone
  App.tsx                    # Add camera, weapon, projectile systems
tests/
  unit/
    quadrant.test.ts
    weapon.test.ts
    projectile.test.ts
```

## 3D Assets

- `public/models/cannon-ball.glb` - cannonball projectile model (used in instanced pool)

## Implementation Details

### 1. Camera System (Pure Logic - `CameraSystem.ts`)

The quadrant calculation is the testable pure function:

```typescript
import { type FiringQuadrant } from '@/store/gameStore';

/**
 * Compute which firing quadrant is active based on camera direction
 * relative to boat heading.
 * 
 * @param cameraAzimuth - camera orbit angle in radians (world space)
 * @param boatHeading - boat forward direction angle in radians (world space)
 * @returns the active firing quadrant
 */
export function computeQuadrant(cameraAzimuth: number, boatHeading: number): FiringQuadrant {
  let relative = cameraAzimuth - boatHeading;
  // Normalize to -PI..PI
  while (relative > Math.PI) relative -= 2 * Math.PI;
  while (relative < -Math.PI) relative += 2 * Math.PI;
  
  if (relative > -Math.PI / 4 && relative <= Math.PI / 4) return 'fore';
  if (relative > Math.PI / 4 && relative <= 3 * Math.PI / 4) return 'starboard';
  if (relative > -3 * Math.PI / 4 && relative <= -Math.PI / 4) return 'port';
  return 'aft';
}
```

### 2. Camera System R3F (`CameraSystemR3F.tsx`)

Custom camera, NOT drei OrbitControls (they fight with game input).

- Track mouse movement via `onPointerMove` on the Canvas container
- Mouse X delta rotates azimuth, Mouse Y delta adjusts elevation
- Camera position: spherical coordinates around the player boat
  - Radius: 15 meters
  - Azimuth: free rotation (unclamped)
  - Elevation: clamped 15-60 degrees
- Camera always looks at `playerPosition + [0, 2, 0]` (slight upward offset)
- Each frame in `useFrame`:
  1. Get player position from rigid body ref
  2. Compute camera world position from spherical coords
  3. Set `camera.position` and `camera.lookAt(target)`
  4. Compute camera direction angle: `atan2(lookDir.x, lookDir.z)`
  5. Get boat heading: extract forward vector from boat quaternion
  6. Call `computeQuadrant(cameraAngle, boatHeading)` 
  7. Update store: `setActiveQuadrant(quadrant)`

Pointer lock is NOT required for MVP. Use pointer delta from `onPointerMove`.

### 3. Weapon System (Pure Logic - `WeaponSystem.ts`)

```typescript
export interface WeaponState {
  cooldownRemaining: Record<FiringQuadrant, number>;
  cooldown: number;
}

/** Tick cooldowns by delta time */
export function tickCooldowns(state: WeaponState, delta: number): WeaponState;

/** Check if a quadrant can fire */
export function canFire(state: WeaponState, quadrant: FiringQuadrant): boolean;

/** Compute projectile spawn data for a fire event */
export interface ProjectileSpawn {
  position: [number, number, number];
  impulse: [number, number, number];
}

export function computeFireData(
  mounts: WeaponMount[],
  quadrant: FiringQuadrant,
  boatPosition: [number, number, number],
  boatRotation: [number, number, number, number],
  muzzleVelocity: number,
  elevationAngle: number
): ProjectileSpawn[];
```

`computeFireData` transforms each mount's `localOffset` and `localDirection` to world space using the boat's quaternion, then computes the impulse vector from `worldDirection * muzzleVelocity`.

### 4. Weapon System R3F (`WeaponSystemR3F.tsx`)

- `useFrame`: tick cooldowns each frame
- Listen for `pointerdown` event on the Canvas
- On click:
  1. Read active quadrant from store
  2. Check cooldown via `canFire()`
  3. Call `computeFireData()` to get spawn positions and impulses
  4. For each spawn: activate a projectile from the pool
  5. Reset quadrant cooldown
  6. Dispatch muzzle flash event (for Phase 9 VFX)

### 5. Projectile Pool (`ProjectilePool.tsx`)

- Pre-allocate 50 cannonball rigid bodies using `<InstancedRigidBodies>`
- Each: `type="dynamic"`, `ccd={true}` (continuous collision detection for fast-moving), `gravityScale={1}`, `<BallCollider radius={0.15}>`
- Inactive projectiles: position at `[0, -1000, 0]`, body set to `sleep()`
- Load `cannon-ball.glb` as the instanced mesh
- Pool manager (stored in a ref or module-level singleton):
  ```typescript
  activate(position, impulse, ownerId, ownerType): number // returns pool index
  deactivate(index): void
  ```
- `activate`: wake body, set position, apply impulse, set collision group (PLAYER_PROJECTILE or ENEMY_PROJECTILE), register in store
- `deactivate`: move to sleep position, sleep body, remove from store
- `onCollisionEnter` on each body: dispatch to damage system (Phase 4)

### 6. Projectile System (Pure Logic - `ProjectileSystem.ts`)

```typescript
/** Check which projectiles have exceeded their lifetime */
export function getExpiredProjectiles(
  projectiles: Map<string, { spawnTime: number; maxLifetime: number }>,
  currentTime: number
): string[];
```

### 7. Trajectory Preview (`TrajectoryPreview.tsx`)

- Simulate projectile path: step forward with velocity + gravity for ~60 steps
- Use the mean mount position and direction for the active quadrant
- Draw with drei `<Line>` using a transparent white material
- Update every frame to reflect current active quadrant and boat orientation
- Steps: `position += velocity * dt; velocity.y -= 9.81 * dt;` for each step

## Tests to Write

### `tests/unit/quadrant.test.ts`

```
- test: camera same direction as boat (relative=0) returns 'fore'
- test: camera 90 degrees right of boat returns 'starboard'
- test: camera 90 degrees left of boat returns 'port'
- test: camera 180 degrees from boat returns 'aft'
- test: camera at exactly 45 degrees returns 'starboard' (boundary)
- test: camera at exactly -45 degrees returns 'port' (boundary)
- test: wrapping: boat heading=350deg, camera=10deg => relative ~20deg => 'fore'
- test: wrapping: boat heading=10deg, camera=350deg => relative ~-20deg => 'fore'
- test: all four quadrants produce correct results with boat heading=PI/3
```

### `tests/unit/weapon.test.ts`

```
- test: tickCooldowns reduces remaining time by delta
- test: tickCooldowns does not go below zero
- test: canFire returns true when cooldownRemaining is 0
- test: canFire returns false when cooldownRemaining > 0
- test: computeFireData returns correct number of spawns for 'port' (4 mounts)
- test: computeFireData returns correct number of spawns for 'fore' (2 mounts)
- test: computeFireData returns correct number of spawns for 'aft' (1 mount)
- test: computeFireData impulse has non-zero Y component (elevation angle)
- test: computeFireData with boat rotated 90deg produces rotated impulse directions
```

### `tests/unit/projectile.test.ts`

```
- test: getExpiredProjectiles returns empty array when none expired
- test: getExpiredProjectiles returns ids of projectiles past maxLifetime
- test: getExpiredProjectiles does not return non-expired projectiles
```

## Acceptance Criteria

- [ ] `pnpm test -- tests/unit/quadrant.test.ts` passes all 9 tests
- [ ] `pnpm test -- tests/unit/weapon.test.ts` passes all 9 tests
- [ ] `pnpm test -- tests/unit/projectile.test.ts` passes all 3 tests
- [ ] `computeQuadrant` runs in Node.js with no browser APIs
- [ ] `computeFireData` runs in Node.js with no browser APIs
- [ ] `pnpm verify` passes
- [ ] Playwright smoke: canvas still renders without errors

## Verification Command

```bash
pnpm verify
```
