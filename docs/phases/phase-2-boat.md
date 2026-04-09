# Phase 2: Player Boat with Buoyancy and Movement

## Objective

Create the player boat entity with a Rapier rigid body, buoyancy system that uses `getWaveHeight()` to float on waves, WASD movement, and load the player-boat.glb 3D model with cannon.glb mounted at weapon positions.

## Prerequisites

- Phase 0 complete (store, test infra, SimulatableSystem)
- Phase 1 complete (water rendering, getWaveHeight, WaterContext)

## Files to Create/Modify

```
src/
  entities/
    PlayerBoat.tsx         # Rigid body + model + store registration
  systems/
    BuoyancySystem.ts      # Pure logic: compute buoyancy forces (headless-testable)
    BuoyancySystemR3F.tsx   # R3F wrapper: useBeforePhysicsStep calling BuoyancySystem
    MovementSystem.ts       # Pure logic: compute thrust/turn forces from input
    MovementSystemR3F.tsx   # R3F wrapper: useBeforePhysicsStep + useKeyboardControls
  App.tsx                   # Add PlayerBoat, systems, KeyboardControls
tests/
  unit/
    buoyancy.test.ts
    movement.test.ts
```

## 3D Assets

- `public/models/player-boat.glb` - player speedboat model
- `public/models/cannon.glb` - cannon model, mounted at each `WeaponMount.localOffset` from the player boat stats

## Implementation Details

### 1. Buoyancy System (Pure Logic - `BuoyancySystem.ts`)

This must be a pure function callable without R3F or Rapier, for headless tests.

```typescript
export interface BuoyancyInput {
  bodyPosition: [number, number, number];
  bodyRotation: [number, number, number, number]; // quaternion
  hullSamplePoints: [number, number, number][];    // local space
}

export interface BuoyancyOutput {
  force: [number, number, number];
  torque: [number, number, number];
}

export function computeBuoyancy(
  input: BuoyancyInput,
  getWaveHeight: (x: number, z: number, time: number) => { height: number; normal: [number, number, number] },
  time: number,
  config: { buoyancyStrength: number; boatMass: number; gravity: number }
): BuoyancyOutput;
```

Hull sample points (8 points, from PRD):
```
Bow:       [0, -0.5, 2.5]
Stern:     [0, -0.5, -2.5]
Port:      [-1.2, -0.5, 0]
Starboard: [1.2, -0.5, 0]
PortBow:   [-0.8, -0.5, 1.5]
StbdBow:   [0.8, -0.5, 1.5]
PortStern: [-0.8, -0.5, -1.5]
StbdStern: [0.8, -0.5, -1.5]
```

Logic per sample point:
1. Transform from local to world space using body position + rotation quaternion
2. Get wave height at that world XZ
3. If point is below wave surface: submersion = waveHeight - pointY
4. Apply upward force: `submersion * buoyancyStrength / numPoints`
5. Compute torque from offset of sample point relative to body center

Net gravity is simulated by setting `gravityScale=0` on the rigid body and having the buoyancy system apply a constant downward force equal to `boatMass * gravity`. This way buoyancy is the ONLY vertical force system.

### 2. Movement System (Pure Logic - `MovementSystem.ts`)

```typescript
export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boatHeading: number; // radians, current boat Y rotation
}

export interface MovementOutput {
  force: [number, number, number];   // world-space thrust force
  torque: [number, number, number];  // world-space turn torque
}

export function computeMovement(
  input: MovementInput,
  stats: { thrustForce: number; reverseForce: number; turnTorque: number }
): MovementOutput;
```

- Forward thrust along boat's local +Z axis (transform by heading)
- Reverse thrust along boat's local -Z axis (weaker: `reverseForce`)
- Turn: A = positive Y torque (turn port/left), D = negative Y torque

### 3. R3F Wrappers

`BuoyancySystemR3F.tsx`: Component that uses `useBeforePhysicsStep` to call `computeBuoyancy` and apply forces to all boat rigid bodies via `rigidBody.applyForce()` and `rigidBody.applyTorque()`.

`MovementSystemR3F.tsx`: Component that uses `useBeforePhysicsStep`, reads `useKeyboardControls`, calls `computeMovement`, and applies forces to the player rigid body.

### 4. Player Boat Entity (`PlayerBoat.tsx`)

- `<RigidBody>` with:
  - `type="dynamic"`
  - `gravityScale={0}` (buoyancy handles all vertical forces)
  - `linearDamping={2.5}` (water drag)
  - `angularDamping={3.0}`
  - `collisionGroups` from `collisionGroups.ts` (PLAYER group)
- Load `player-boat.glb` via drei `useGLTF`
- Load `cannon.glb` via drei `useGLTF`
- Mount cannon instances at each `WeaponMount.localOffset` from player boat stats
- Scale model to match physics collider (~5m long)
- `<CuboidCollider args={[1.2, 0.75, 2.5]}` /> (half-extents)
- On mount: register in Zustand store via `spawnPlayer()`
- On unmount: cleanup
- Expose rigid body ref via a forwarded ref or store it in a global ref map

### 5. App.tsx Updates

- Wrap Canvas children with `<KeyboardControls map={[...]}>` for WASD + Space
- Add `<PlayerBoat />`
- Add `<BuoyancySystemR3F />` and `<MovementSystemR3F />`

## Tests to Write

### `tests/unit/buoyancy.test.ts`

```
- test: boat at wave height experiences near-zero net vertical force (equilibrium)
- test: boat above wave surface experiences net downward force (gravity > buoyancy)
- test: boat below wave surface experiences net upward force (buoyancy > gravity)
- test: tilted wave surface produces non-zero torque
- test: all 8 sample points below water produces maximum buoyancy
- test: computeBuoyancy is deterministic (same inputs = same output)
```

### `tests/unit/movement.test.ts`

```
- test: forward=true produces positive force along boat heading direction
- test: backward=true produces negative force along boat heading (weaker magnitude)
- test: left=true produces positive Y torque
- test: right=true produces negative Y torque
- test: no input produces zero force and zero torque
- test: heading=PI/2 rotates thrust direction by 90 degrees
```

## Acceptance Criteria

- [ ] `pnpm test -- tests/unit/buoyancy.test.ts` passes all tests
- [ ] `pnpm test -- tests/unit/movement.test.ts` passes all tests
- [ ] `computeBuoyancy()` runs in Node.js without browser APIs
- [ ] `computeMovement()` runs in Node.js without browser APIs
- [ ] `pnpm verify` passes (build + lint + all tests)
- [ ] Playwright smoke: canvas renders with a visible boat model (no crash)

## Verification Command

```bash
pnpm verify
```
