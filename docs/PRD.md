# PRD: Gunboat Raiders

## Problem Statement

- **What:** A playable speedboat combat game must be built from scratch for the Three.js Water Pro Giveaway competition
- **Who:** Solo developer (Jonathan), judged by Dan Greenheck (creator of Three.js Water Pro)
- **Why:** Competition entry. Must demonstrate creative use of water/ocean themes in Three.js, be playable, and be deployed by Monday 2026-04-13 00:00 UTC
- **Constraint:** Everything must be built from scratch -- no game templates, no starter kits

## Proposed Solution

A wave-based arcade speedboat combat game. The player pilots an armed speedboat with broadside cannons, fighting waves of enemy boats on an endless ocean. The camera orbits independently from the boat, and the player fires whichever cannon bank faces the camera direction. Post-apocalyptic Mad Max-on-water aesthetic.

### Key Components
1. **Water rendering** -- Gerstner wave shader for visuals, CPU-side wave sampling for buoyancy
2. **Physics-driven boats** -- Rapier rigid bodies with buoyancy forces, thrust, and drag
3. **Broadside cannon combat** -- Camera-quadrant firing system, physical cannonball projectiles
4. **Wave-based enemies** -- AI boats that spawn in waves, approach, and engage
5. **Scoring and progression** -- Survive waves, sink enemies, track score

### Integration Points
- React Three Fiber wraps Three.js scene graph and render loop
- react-three-rapier provides physics simulation (rigid bodies, collisions, forces)
- drei provides camera controls, keyboard input, billboards, trails
- Zustand manages all game state outside the render tree
- Howler.js handles audio independently from React lifecycle
- three.quarks manages particle VFX via a batched renderer

---

## Requirements

### Functional Requirements

- [ ] FR-01: Ocean water renders with animated waves and looks convincing
- [ ] FR-02: Player boat floats on water with physics-based buoyancy
- [ ] FR-03: Player can steer boat with WASD (thrust, reverse, turn)
- [ ] FR-04: Camera orbits boat independently with mouse movement
- [ ] FR-05: Camera direction relative to boat heading determines active firing quadrant
- [ ] FR-06: Click fires cannons in the active quadrant
- [ ] FR-07: Cannonballs travel in a physical arc (gravity + impulse)
- [ ] FR-08: Cannonballs deal damage on direct hit and splash damage near misses
- [ ] FR-09: Boats have armor (regenerating) and hull (permanent) health
- [ ] FR-10: Boat sinks when hull reaches 0
- [ ] FR-11: Enemy boats spawn in waves with increasing difficulty
- [ ] FR-12: Enemy AI approaches player and fires broadsides
- [ ] FR-13: All enemies destroyed advances to next wave
- [ ] FR-14: Score tracks waves survived and enemies sunk
- [ ] FR-15: HUD displays health, wave number, score, and active quadrant
- [ ] FR-16: Rock obstacles exist in the arena
- [ ] FR-17: Trajectory preview arc shows where cannonballs will land
- [ ] FR-18: Game over state when player hull reaches 0

### Non-Functional Requirements

- **Performance:** Stable 60 FPS on mid-range hardware (GTX 1060 / M1 equivalent). Target draw calls under 200. Physics step at fixed 60Hz.
- **Load time:** Under 5 seconds on broadband. Total asset budget under 20 MB.
- **Browser support:** Chrome and Firefox (latest). Edge as bonus. No mobile requirement.
- **Accessibility:** Keyboard-only play is functional (mouse for camera, but default forward-facing quadrant works without mouse movement).
- **Deployment:** Static site on Cloudflare Pages. Single page, no server required.

---

## Technical Implementation Plan

### Architecture Overview

```
+------------------+     +-------------------+
|   React (UI)     |     |  Zustand Store    |
|   - HUD overlay  |<--->|  - gameState      |
|   - Menus        |     |  - entities[]     |
+------------------+     |  - wave/score     |
         |                +-------------------+
         v                        ^
+------------------+              |
|  R3F Scene       |              |
|  <Canvas>        |   useFrame reads store
|    +----------+  |   via getState() (no re-render)
|    | Physics  |  |              |
|    | <Physics>|--+---> Systems (useFrame hooks)
|    |  Bodies  |  |     - BuoyancySystem
|    |  Collisions |     - MovementSystem
|    +----------+  |     - WeaponSystem
|    | Entities |  |     - ProjectileSystem
|    |  Player  |  |     - AISystem
|    |  Enemies |  |     - WaveSystem
|    |  Projectiles|     - DamageSystem
|    +----------+  |
|    | Environment||
|    |  Water    | |
|    |  Sky      | |
|    |  Rocks    | |
|    +----------+  |
|    | VFX       | |
|    |  Particles ||
|    |  Post-proc ||
|    +----------+  |
+------------------+
```

### ECS-Inspired Pattern

This game uses an ECS-inspired architecture adapted for React. Entities are React components that register themselves in the Zustand store. Systems are `useFrame` hooks that read store state via `getState()` (avoiding re-renders) and apply logic each frame.

**Key pattern:** All per-frame game logic reads state via `useGameStore.getState()`, never via React subscriptions. React subscriptions are only used for UI components (HUD, menus) that need to re-render.

### Technology Stack (Locked)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 19 + Vite + TypeScript | Build system, component model |
| 3D Rendering | Three.js via React Three Fiber | Scene graph, render loop |
| Physics | react-three-rapier v2 (Rapier WASM) | Rigid bodies, collisions, forces |
| Helpers | @react-three/drei | KeyboardControls, Sky, Billboard, Trail, Html |
| Post-processing | @react-three/postprocessing | Bloom, Vignette, ChromaticAberration |
| Particles | three.quarks | Muzzle flash, explosions, splashes |
| Audio | Howler.js | Positional 3D audio, sound pooling |
| State | Zustand | Game state, entity registry |
| Water | Custom Gerstner shader + CPU mirror | Visual waves + buoyancy sampling |
| Deploy | Cloudflare Pages | Static hosting |

---

### Data Architecture

#### Core Types and Interfaces

```typescript
// ---- Entity Types ----

type EntityId = string; // nanoid

type EntityType = 'player' | 'enemy' | 'projectile' | 'rock';

type FiringQuadrant = 'fore' | 'aft' | 'port' | 'starboard';

type EnemyType = 'skiff' | 'barge';

type AIState = 'spawning' | 'approaching' | 'positioning' | 'broadside' | 'fleeing' | 'sinking';

type GamePhase = 'title' | 'playing' | 'wave-clear' | 'game-over';

// ---- Component Data (plain objects, not React components) ----

interface HealthComponent {
  armor: number;
  armorMax: number;
  armorRegenRate: number;    // points per second
  hull: number;
  hullMax: number;
}

interface WeaponMount {
  quadrant: FiringQuadrant;
  localOffset: [number, number, number]; // position relative to boat center
  localDirection: [number, number, number]; // firing direction in local space
}

interface WeaponComponent {
  mounts: WeaponMount[];
  cooldown: number;          // seconds between shots per quadrant
  cooldownRemaining: Record<FiringQuadrant, number>;
  damage: number;            // per cannonball
  splashDamage: number;      // within splash radius
  splashRadius: number;      // meters
  muzzleVelocity: number;    // initial speed
  elevationAngle: number;    // radians, launch angle above horizontal
}

interface MovementComponent {
  thrustForce: number;
  reverseForce: number;
  turnTorque: number;
  maxSpeed: number;          // for AI speed limiting
}

interface AIComponent {
  type: EnemyType;
  state: AIState;
  targetId: EntityId | null;
  stateTimer: number;
  preferredRange: number;    // meters, ideal engagement distance
  detectionRange: number;    // meters
}

interface BoatEntity {
  id: EntityId;
  type: 'player' | 'enemy';
  enemyType?: EnemyType;
  health: HealthComponent;
  weapons: WeaponComponent;
  movement: MovementComponent;
  ai?: AIComponent;
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion
  isSinking: boolean;
}

interface ProjectileEntity {
  id: EntityId;
  ownerId: EntityId;
  ownerType: 'player' | 'enemy';
  damage: number;
  splashDamage: number;
  splashRadius: number;
  spawnTime: number;
  maxLifetime: number;       // seconds, auto-despawn
}

// ---- Game State ----

interface WaveConfig {
  waveNumber: number;
  enemies: Array<{
    type: EnemyType;
    count: number;
    spawnDelay: number;      // seconds after wave start
  }>;
}

interface GameState {
  phase: GamePhase;
  wave: number;
  score: number;
  enemiesRemaining: number;
  enemiesSunkTotal: number;

  // Entity registry
  player: BoatEntity | null;
  enemies: Map<EntityId, BoatEntity>;
  projectiles: Map<EntityId, ProjectileEntity>;

  // Camera state
  activeQuadrant: FiringQuadrant;
  cameraAngle: number;       // radians, relative to world

  // Actions
  spawnPlayer: () => void;
  spawnEnemy: (type: EnemyType, position: [number, number, number]) => EntityId;
  removeEnemy: (id: EntityId) => void;
  spawnProjectile: (config: Omit<ProjectileEntity, 'id'>) => EntityId;
  removeProjectile: (id: EntityId) => void;
  applyDamage: (targetId: EntityId, damage: number) => void;
  setActiveQuadrant: (quadrant: FiringQuadrant) => void;
  advanceWave: () => void;
  addScore: (points: number) => void;
  setPhase: (phase: GamePhase) => void;
  resetGame: () => void;
}
```

#### Gerstner Wave Parameters

```typescript
interface GerstnerWave {
  direction: [number, number]; // normalized 2D direction
  steepness: number;           // 0-1, wave sharpness (Q parameter)
  wavelength: number;          // meters
  amplitude: number;           // meters (derived: wavelength / (2 * PI * steepness * numWaves))
  speed: number;               // derived from wavelength via dispersion relation
  phase: number;               // phase offset
}

// CPU-side sampling function (must match shader exactly)
function getWaveHeight(x: number, z: number, time: number, waves: GerstnerWave[]): {
  height: number;              // y position
  normal: [number, number, number]; // surface normal for tilt
};

// Default wave set (4 waves for MVP, expandable to 8)
const DEFAULT_WAVES: GerstnerWave[] = [
  { direction: [1, 0],    steepness: 0.25, wavelength: 60, speed: 0, phase: 0 },
  { direction: [0, 1],    steepness: 0.25, wavelength: 40, speed: 0, phase: 0.5 },
  { direction: [0.7, 0.7], steepness: 0.15, wavelength: 25, speed: 0, phase: 1.0 },
  { direction: [0.3, -0.9], steepness: 0.10, wavelength: 15, speed: 0, phase: 1.5 },
];
// speed is derived: sqrt(9.8 * wavelength / (2 * PI))
```

#### Collision Groups

```typescript
// Rapier collision groups (bitmask)
// Membership bits (which group this body belongs to)
// Filter bits (which groups this body collides with)

const COLLISION_GROUPS = {
  PLAYER:            0, // group 0
  ENEMY:             1, // group 1
  PLAYER_PROJECTILE: 2, // group 2
  ENEMY_PROJECTILE:  3, // group 3
  ENVIRONMENT:       4, // group 4
} as const;

// Collision matrix:
// Player           collides with: Enemy, EnemyProjectile, Environment
// Enemy            collides with: Player, PlayerProjectile, Environment, Enemy
// PlayerProjectile collides with: Enemy, Environment
// EnemyProjectile  collides with: Player, Environment
// Environment      collides with: Player, Enemy, PlayerProjectile, EnemyProjectile

// react-three-rapier interactionGroups helper:
// interactionGroups(membership, filter)
// membership & filter are bit indices
```

#### Boat Stat Presets

```typescript
const BOAT_STATS = {
  player: {
    health: { armor: 100, armorMax: 100, armorRegenRate: 3, hull: 100, hullMax: 100 },
    movement: { thrustForce: 800, reverseForce: 300, turnTorque: 200, maxSpeed: 15 },
    weapons: {
      cooldown: 2.0,
      damage: 25,
      splashDamage: 10,
      splashRadius: 3,
      muzzleVelocity: 30,
      elevationAngle: 0.35, // ~20 degrees
      mounts: [
        // Fore (2 small)
        { quadrant: 'fore', localOffset: [0.4, 0.8, 2.0], localDirection: [0, 0.3, 1] },
        { quadrant: 'fore', localOffset: [-0.4, 0.8, 2.0], localDirection: [0, 0.3, 1] },
        // Port broadside (4)
        { quadrant: 'port', localOffset: [-1.2, 0.8, 1.0], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.2, 0.8, 0.0], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.2, 0.8, -0.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.2, 0.8, -1.0], localDirection: [-1, 0.3, 0] },
        // Starboard broadside (4)
        { quadrant: 'starboard', localOffset: [1.2, 0.8, 1.0], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.2, 0.8, 0.0], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.2, 0.8, -0.5], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.2, 0.8, -1.0], localDirection: [1, 0.3, 0] },
        // Aft (1 small)
        { quadrant: 'aft', localOffset: [0, 0.8, -2.0], localDirection: [0, 0.3, -1] },
      ],
    },
  },
  skiff: {
    health: { armor: 30, armorMax: 30, armorRegenRate: 1, hull: 40, hullMax: 40 },
    movement: { thrustForce: 600, reverseForce: 200, turnTorque: 250, maxSpeed: 18 },
    weapons: {
      cooldown: 3.0,
      damage: 15,
      splashDamage: 5,
      splashRadius: 2,
      muzzleVelocity: 25,
      elevationAngle: 0.35,
      mounts: [
        { quadrant: 'port', localOffset: [-0.8, 0.6, 0.0], localDirection: [-1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [0.8, 0.6, 0.0], localDirection: [1, 0.3, 0] },
      ],
    },
  },
  barge: {
    health: { armor: 80, armorMax: 80, armorRegenRate: 2, hull: 120, hullMax: 120 },
    movement: { thrustForce: 400, reverseForce: 150, turnTorque: 100, maxSpeed: 8 },
    weapons: {
      cooldown: 2.5,
      damage: 20,
      splashDamage: 12,
      splashRadius: 4,
      muzzleVelocity: 28,
      elevationAngle: 0.35,
      mounts: [
        { quadrant: 'port', localOffset: [-1.5, 0.8, 1.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.5, 0.8, 0.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.5, 0.8, -0.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.5, 0.8, 1.5], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.5, 0.8, 0.5], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.5, 0.8, -0.5], localDirection: [1, 0.3, 0] },
      ],
    },
  },
} as const;
```

---

### File Structure

```
src/
  main.tsx                    # React root, mount <App />
  App.tsx                     # <Canvas> + <Physics> + <KeyboardControls> wrapper
  vite-env.d.ts               # Vite type declarations

  store/
    gameStore.ts              # Zustand store: GameState, actions, slices
    selectors.ts              # Memoized selectors for HUD subscriptions

  systems/
    BuoyancySystem.tsx        # useFrame: sample wave heights, apply forces to all boats
    MovementSystem.tsx         # useFrame: read keyboard input, apply thrust/turn forces
    WeaponSystem.tsx           # useFrame: cooldown ticks, fire on click, spawn projectiles
    ProjectileSystem.tsx       # useFrame: lifetime management, despawn old projectiles
    AISystem.tsx               # useFrame: enemy state machines, decision making
    WaveSystem.tsx             # useFrame: wave progression, enemy spawning
    DamageSystem.tsx           # Collision event handler: calculate and apply damage
    CameraSystem.tsx           # useFrame: compute active quadrant from camera angle

  entities/
    PlayerBoat.tsx             # Player rigid body + mesh + weapon mounts
    EnemyBoat.tsx              # Enemy rigid body + mesh + AI component registration
    Projectile.tsx             # Single cannonball rigid body (instanced pool parent)
    ProjectilePool.tsx         # InstancedRigidBodies pool manager (50 cannonballs)
    Rock.tsx                   # Static rigid body obstacle

  environment/
    Water.tsx                  # Gerstner wave shader mesh (visual)
    WaterContext.tsx            # React context providing getWaveHeight() function
    gerstnerWaves.ts           # CPU-side Gerstner wave math (shared with shader)
    waterShader.ts             # GLSL vertex/fragment shader strings
    Sky.tsx                    # drei Sky component (Preetham model) configuration
    Rocks.tsx                  # Seeded procedural rock placement

  effects/
    PostProcessing.tsx         # EffectComposer: Bloom + Vignette + optional ChromaticAberration
    ParticleManager.tsx        # three.quarks BatchedRenderer setup
    MuzzleFlash.tsx            # Particle system: cannon fire flash
    Explosion.tsx              # Particle system: hit explosion
    WaterSplash.tsx            # Particle system: cannonball splash
    TrajectoryPreview.tsx      # Transparent arc line showing projectile path

  ui/
    HUD.tsx                    # Main HUD container (drei Html overlay)
    HealthBar.tsx              # Armor + Hull health display
    WaveCounter.tsx            # Current wave number
    ScoreDisplay.tsx           # Score
    QuadrantIndicator.tsx      # Active firing quadrant visual
    TitleScreen.tsx            # Start screen
    GameOverScreen.tsx         # Game over with score + restart

  audio/
    AudioManager.ts            # Howler.js setup: load sounds, pooling, positional updates
    sounds.ts                  # Sound definitions (sprite map, pool sizes)

  utils/
    constants.ts               # Game balance constants, physics constants
    boatStats.ts               # Boat stat presets (player, skiff, barge)
    collisionGroups.ts         # Rapier collision group definitions
    math.ts                    # Vector helpers, angle normalization, quadrant calculation
    seededRandom.ts            # Deterministic PRNG for wave generation and rock placement

  assets/
    models/                    # GLTF boat models (Kenney + Sketchfab)
    textures/                  # Water normal maps, skybox if needed
    audio/                     # Sound files (mp3/ogg)

public/
  index.html
  favicon.ico
```

---

### Information Flow

#### Per-Frame Game Loop (inside useFrame)

```
1. INPUT PHASE
   MovementSystem reads KeyboardControls state
   CameraSystem reads camera world position + boat heading -> computes activeQuadrant

2. PHYSICS PHASE (useBeforePhysicsStep)
   BuoyancySystem: for each boat rigid body ->
     sample 4-8 hull points through getWaveHeight() ->
     compute net buoyancy force + torque ->
     apply via rigidBody.applyForce() / applyTorque()
   MovementSystem: apply thrust force + turn torque to player rigid body

3. SIMULATION PHASE (Rapier steps internally at fixed timestep)
   Collision events fire -> DamageSystem handles projectile-boat collisions

4. GAME LOGIC PHASE
   WeaponSystem: tick cooldowns, check fire input, spawn projectiles
   ProjectileSystem: despawn expired projectiles
   AISystem: update enemy state machines, issue movement/fire commands
   WaveSystem: check if wave clear, spawn next wave
   DamageSystem: process queued damage, check for sinking, update store

5. RENDER PHASE (automatic via R3F)
   Three.js renders scene
   PostProcessing applies effects
   HUD reads store via React subscriptions and re-renders
```

#### Damage Flow

```
Cannonball collides with boat (Rapier collision event)
  -> onContactForce / onCollisionEnter fires
  -> DamageSystem reads projectile.damage from store
  -> If armor > 0: damage absorbed by armor first (armor -= damage, overflow to hull)
  -> If armor <= 0: remaining damage applied to hull
  -> If hull <= 0: mark entity as sinking, trigger sink VFX, add score
  -> Remove projectile from physics world
  -> Update store (triggers HUD re-render for player)
```

#### Cannonball splash damage (near miss)

```
Cannonball hits water plane (y < wave height at impact point) or lifetime expires
  -> Check all boat positions within splashRadius
  -> Apply splashDamage to each (attenuated by distance)
  -> Spawn water splash VFX
  -> Remove projectile
```

---

### Detailed Step-by-Step Implementation Plan

Each step produces a working, testable increment. Steps are ordered to front-load the hardest unknowns (water + buoyancy) and reach "playable game" as fast as possible.

---

#### Phase 1: Foundation

##### Step 1: Project Scaffolding

- [ ] `npm create vite@latest` with React + TypeScript template
- [ ] Install all dependencies:
  ```
  @react-three/fiber @react-three/drei @react-three/postprocessing
  @react-three/rapier three
  three.quarks howler zustand
  nanoid
  ```
- [ ] Install dev dependencies: `@types/three @types/howler`
- [ ] Configure `tsconfig.json`: strict mode, path aliases (`@/` -> `src/`)
- [ ] Create folder structure as defined above
- [ ] Create bare `App.tsx` with `<Canvas>` and a spinning cube placeholder
- [ ] Verify `npm run dev` works and renders

**Acceptance:** Browser shows a rotating cube on black background. No errors in console.

##### Step 2: Zustand Store Foundation

- [ ] Create `gameStore.ts` with full `GameState` interface
- [ ] Implement all actions: `spawnPlayer`, `spawnEnemy`, `removeEnemy`, `spawnProjectile`, `removeProjectile`, `applyDamage`, `setActiveQuadrant`, `advanceWave`, `addScore`, `setPhase`, `resetGame`
- [ ] Create `selectors.ts` with memoized selectors for HUD values
- [ ] Create `constants.ts` with all game balance values
- [ ] Create `boatStats.ts` with player/skiff/barge presets
- [ ] Create `collisionGroups.ts` with Rapier interaction group helpers
- [ ] Create `math.ts` with vector utilities and quadrant calculation

**Acceptance:** Store can be created, actions can be called, state updates correctly. Console logging confirms correct behavior.

##### Step 3: Water Rendering

- [ ] Implement `gerstnerWaves.ts`: CPU-side Gerstner wave evaluation (position + normal)
  - 4 wave components with configurable direction, steepness, wavelength
  - `getWaveHeight(x, z, time)` returns `{ height, normal }`
  - Must match GPU shader math exactly
- [ ] Implement `waterShader.ts`: GLSL vertex shader displacing a plane mesh with same Gerstner formula
  - Uniforms: `uTime`, `uWaves[4]` (direction, steepness, wavelength, phase)
  - Fragment shader: deep ocean color, Fresnel-based specular highlights, foam on steep crests
- [ ] Create `Water.tsx`: large `PlaneGeometry` (256x256, 256 segments) with custom `ShaderMaterial`
  - Animate `uTime` in useFrame
- [ ] Create `WaterContext.tsx`: React context providing `getWaveHeight` to all children
- [ ] Create `Sky.tsx`: drei `<Sky>` component with late-afternoon sun angle for dramatic lighting

**Acceptance:** Browser shows animated ocean waves with a sky. Water moves convincingly. `getWaveHeight()` returns correct Y values that visually match the shader.

---

#### Phase 2: Core Boat Mechanics

##### Step 4: Physics World + Player Boat

- [ ] Add `<Physics>` wrapper in `App.tsx` with `gravity={[0, -9.81, 0]}`, `debug` prop for development
- [ ] Add `<KeyboardControls>` wrapper in `App.tsx` with WASD + Space mappings
- [ ] Create `PlayerBoat.tsx`:
  - `<RigidBody>` with `type="dynamic"`, `gravityScale={0}` (buoyancy handles gravity), `linearDamping={2.5}`, `angularDamping={3.0}`
  - `enabledTranslations={[true, true, true]}`, `enabledRotations={[true, true, true]}`
  - Collision group: PLAYER, interacts with ENEMY + ENEMY_PROJECTILE + ENVIRONMENT
  - Placeholder mesh: box geometry approximating boat shape (2.4m wide, 1.5m tall, 5m long)
  - Register entity in Zustand store on mount, unregister on unmount
  - Expose rigid body ref for systems to apply forces
- [ ] Load GLTF boat model (Kenney or Sketchfab) and replace placeholder when ready

**Acceptance:** A box-shaped "boat" exists in the physics world, visible in the scene. Physics debug wireframe shows the collider.

##### Step 5: Buoyancy System

- [ ] Create `BuoyancySystem.tsx`:
  - `useBeforePhysicsStep` hook (runs before each Rapier step)
  - For each boat rigid body, sample 4-8 hull points (corners + midpoints of bottom face)
  - Transform sample points from local to world space using rigid body position + rotation
  - For each point below wave surface: apply upward force proportional to submersion depth
  - Apply restoring torque to align boat with wave surface normal
  - Net gravity is handled by buoyancy (gravityScale=0 on the rigid body, buoyancy applies downward force when above water to simulate weight)
  - Boat weight constant balances with buoyancy at waterline
- [ ] Hull sample points for player boat (relative to center):
  ```
  Bow:    [0, -0.5, 2.5]
  Stern:  [0, -0.5, -2.5]
  Port:   [-1.2, -0.5, 0]
  Stbd:   [1.2, -0.5, 0]
  PortBow:  [-0.8, -0.5, 1.5]
  StbdBow:  [0.8, -0.5, 1.5]
  PortStern: [-0.8, -0.5, -1.5]
  StbdStern: [0.8, -0.5, -1.5]
  ```
- [ ] Tuning constants: `buoyancyStrength`, `waterDrag`, `boatMass`

**Acceptance:** Boat floats on the ocean surface, bobs up and down with waves, tilts on wave slopes. Does not fly away or sink to infinity.

##### Step 6: Movement System

- [ ] Create `MovementSystem.tsx`:
  - `useBeforePhysicsStep` hook
  - Read keyboard state from `useKeyboardControls`
  - W: apply forward thrust force along boat's local Z axis
  - S: apply reverse thrust (weaker)
  - A: apply positive Y-axis torque (turn port / left)
  - D: apply negative Y-axis torque (turn starboard / right)
  - Forces applied via `rigidBody.applyForce()` and `rigidBody.applyTorque()`
  - Linear damping on rigid body simulates water drag (no explicit drag calculation needed)
- [ ] Use `lockTranslations` on Y-axis: NO -- buoyancy handles vertical. All axes free.
- [ ] Tune: thrust=800, reverse=300, torque=200, linearDamping=2.5, angularDamping=3.0

**Acceptance:** Player can drive boat around the ocean with WASD. Boat accelerates, decelerates, and turns. Feels like a boat, not a car (momentum, drift on turns).

---

#### Phase 3: Camera and Combat

##### Step 7: Camera System + Quadrant Detection

- [ ] Create `CameraSystem.tsx`:
  - drei `OrbitControls`-based approach: camera orbits player boat at fixed distance
  - OR custom camera: `useFrame` positions camera on a sphere around the boat, mouse delta rotates azimuth/elevation
  - **Recommended approach:** Custom camera in useFrame for full control. No OrbitControls (they fight with the game).
  - Camera position: `boat.position + spherical(radius=15, azimuth=mouseAzimuth, elevation=0.4)`
  - Camera always looks at boat position + slight forward offset
  - Mouse movement updates azimuth freely (no clamping). Elevation clamped to 15-60 degrees.
  - Pointer lock: NOT required for MVP. Standard mouse movement.
- [ ] Quadrant calculation:
  - Boat heading angle = `atan2(boatForward.x, boatForward.z)` (world space)
  - Camera angle = `atan2(cameraDirection.x, cameraDirection.z)` from boat to camera lookat direction
  - Relative angle = camera angle - boat heading (normalize to -PI..PI)
  - Quadrant mapping:
    - -45 to 45 degrees: FORE
    - 45 to 135 degrees: STARBOARD
    - -135 to -45 degrees: PORT
    - else: AFT
  - Store active quadrant in Zustand: `setActiveQuadrant(quadrant)`

**Acceptance:** Camera orbits smoothly around the boat with mouse movement. Active quadrant changes correctly as camera rotates. Moving boat heading changes quadrant even with static camera.

##### Step 8: Weapon System + Projectile Pool

- [ ] Create `ProjectilePool.tsx`:
  - Pre-allocate pool of 50 cannonball instances using `InstancedRigidBodies`
  - Each instance: `<RigidBody type="dynamic" ccd={true} gravityScale={1}>` with `<BallCollider radius={0.15}>`
  - Inactive projectiles positioned far below the world (y=-1000) with `sleeping={true}`
  - Collision group: PLAYER_PROJECTILE or ENEMY_PROJECTILE (set per activation)
  - `onCollisionEnter` handler dispatches to DamageSystem
  - Pool manager: `activate(position, impulse, ownerType) -> id`, `deactivate(id)`
- [ ] Create `WeaponSystem.tsx`:
  - `useFrame` hook: tick cooldown timers each frame (`dt`)
  - Listen for mouse click (via `onPointerDown` on Canvas or event listener)
  - On click: check active quadrant cooldown. If ready:
    - Get weapon mounts for active quadrant from boat entity
    - For each mount: transform localOffset and localDirection to world space
    - Calculate launch impulse: `worldDirection * muzzleVelocity + upward component for arc`
    - Activate a projectile from pool at mount world position with impulse
    - Reset quadrant cooldown
    - Trigger muzzle flash VFX at mount position
    - Play cannon fire sound
- [ ] Create `TrajectoryPreview.tsx`:
  - Simulate projectile path: iterate position with velocity + gravity for N steps
  - Draw as `<Line>` (drei) or `<TubeGeometry>` with transparent material
  - Update every frame based on active quadrant's mounts
  - Show where the center of the volley will land

**Acceptance:** Click fires cannonballs from the active quadrant's mounts. Cannonballs arc through the air realistically. Trajectory preview shows the expected landing zone. Cooldowns prevent spam firing.

##### Step 9: Damage System + Collision Handling

- [ ] Create `DamageSystem.tsx`:
  - Handle `onCollisionEnter` events from projectile pool
  - Identify hit entity by rigid body user data or collision group
  - Look up projectile data from store (damage, splashDamage, ownerId)
  - Prevent self-damage (ownerId check)
  - Apply damage: armor absorbs first, overflow to hull
  - If hull <= 0: set `isSinking = true`, trigger sink sequence, add score
  - Deactivate the projectile (return to pool)
  - Flash screen vignette if player was hit
- [ ] Armor regeneration: in `useFrame`, increment armor by `armorRegenRate * dt` up to `armorMax`
- [ ] Splash damage on water impact:
  - When projectile Y < waveHeight at projectile XZ position (or on timeout):
    - Query all boat positions within `splashRadius`
    - Apply `splashDamage * (1 - distance/splashRadius)` to each
    - Spawn water splash VFX
    - Deactivate projectile

**Acceptance:** Cannonballs hitting enemy boats deal damage. Armor depletes before hull. Enemies sink when hull hits 0. Player takes damage from enemy projectiles. Near-miss splashes deal reduced damage.

---

#### Phase 4: Enemies and Game Loop

##### Step 10: Enemy Boat Entity

- [ ] Create `EnemyBoat.tsx`:
  - Same rigid body setup as player (dynamic, buoyancy-enabled, gravityScale=0)
  - Different collision group: ENEMY
  - Different collider size based on enemy type (skiff: smaller, barge: larger)
  - Stats loaded from `boatStats.ts`
  - Registers in Zustand `enemies` map on mount, removes on unmount
  - Visual: different colored placeholder box, later different GLTF model
  - Sinking animation: when `isSinking`, gradually increase Y downward, rotate, remove after 3 seconds

**Acceptance:** Enemy boats can be spawned, float on water, and have correct collision groups.

##### Step 11: AI System

- [ ] Create `AISystem.tsx`:
  - `useFrame` hook iterating over all enemies in store
  - State machine per enemy:

  ```
  SPAWNING (2s invulnerability, fade in)
    -> APPROACHING

  APPROACHING (move toward player)
    - Calculate direction to player
    - Apply thrust force toward player
    - When within preferredRange: -> POSITIONING

  POSITIONING (maneuver for broadside)
    - Turn to present port or starboard broadside to player
    - When broadside angle within 30 degrees: -> BROADSIDE

  BROADSIDE (fire!)
    - Fire weapons from the quadrant facing the player
    - After firing: hold for 1-2s then -> APPROACHING (re-engage)

  SINKING (hull <= 0)
    - No AI, visual animation handles it
  ```

  - Skiff AI: fast approach, quick broadside, re-position frequently
  - Barge AI (stretch): slow approach, parks and fires repeatedly

**Acceptance:** Enemy boats approach the player, maneuver to present a broadside, and fire. They don't get stuck or orbit endlessly. Combat feels like a real engagement.

##### Step 12: Wave System + Scoring

- [ ] Create `WaveSystem.tsx`:
  - `useFrame` hook
  - Wave definitions (procedural, seeded):
    ```
    Wave 1: 2 skiffs
    Wave 2: 3 skiffs
    Wave 3: 4 skiffs
    Wave 4: 5 skiffs + 1 barge (if implemented)
    Wave N: scale count with wave number, cap at reasonable limit
    ```
  - Spawn enemies at random positions 80-120m from player (seeded random)
  - Stagger spawns: 1 enemy per second within a wave
  - Track `enemiesRemaining` in store
  - When `enemiesRemaining === 0`: brief pause (3s), then `advanceWave()`
  - Score: +100 per skiff sunk, +250 per barge sunk, +500 per wave survived
- [ ] Integrate with game phase:
  - `title` -> player clicks start -> `playing`
  - `playing` + player hull 0 -> `game-over`
  - `wave-clear` (3s pause) -> `playing` (next wave)

**Acceptance:** Enemies spawn in waves. Killing all enemies advances to the next wave. Waves get harder. Score accumulates. Game ends when player dies. This is a PLAYABLE GAME.

---

#### Phase 5: UI and Environment

##### Step 13: HUD

- [ ] Create `HUD.tsx`: drei `<Html>` overlay, positioned absolutely, `pointer-events: none`
- [ ] `HealthBar.tsx`:
  - Two stacked bars: blue (armor) over red (hull)
  - Width proportional to current/max
  - Numeric display: "ARMOR 85/100" and "HULL 100/100"
  - Position: bottom-left
  - Uses Zustand selector subscription (React re-render is fine for HUD)
- [ ] `WaveCounter.tsx`: "WAVE 3" centered at top
- [ ] `ScoreDisplay.tsx`: score number, top-right
- [ ] `QuadrantIndicator.tsx`:
  - Four directional segments around screen center (fore/aft/port/starboard)
  - Active quadrant highlighted (bright color + slight glow)
  - Inactive quadrants dimmed
- [ ] `TitleScreen.tsx`: "GUNBOAT RAIDERS" title, "CLICK TO START" instruction, brief premise text
- [ ] `GameOverScreen.tsx`: "SUNK" title, final score, waves survived, "CLICK TO RESTART"

**Acceptance:** All HUD elements display and update in real-time. Title screen shows on load. Game over shows on death. Quadrant indicator accurately reflects camera-relative firing direction.

##### Step 14: Rock Obstacles

- [ ] Create `Rock.tsx`: static `RigidBody` with `ConvexHullCollider` from mesh geometry
  - Visual: drei `<Icosahedron>` scaled non-uniformly and rotated for organic rock look
  - Color: dark grey/brown
  - Collision group: ENVIRONMENT
- [ ] Create `Rocks.tsx`:
  - Seeded random placement (deterministic per game session)
  - N rocks (15-25) placed within arena radius (200m from center)
  - Minimum distance from center (30m, safe spawn zone)
  - Minimum distance between rocks (15m)
  - Rocks partially submerged (Y position at wave height minus some offset)
- [ ] Boats and projectiles collide with rocks

**Acceptance:** Rocks are visible on the ocean. Boats cannot pass through them. Cannonballs hit rocks. Rocks add tactical cover and navigation hazards.

---

#### Phase 6: Polish

##### Step 15: Particle VFX

- [ ] Create `ParticleManager.tsx`:
  - three.quarks `BatchedRenderer` added to scene
  - Single instance, systems added/removed as needed
- [ ] `MuzzleFlash.tsx`:
  - Bright orange/yellow burst, 5-10 particles
  - Short lifetime (0.15s), high initial velocity outward from cannon
  - Emissive material (for bloom pickup)
  - `toneMapped={false}` for HDR bloom
- [ ] `Explosion.tsx`:
  - On cannonball impact: 20-30 orange/red particles + smoke (grey, slower)
  - Expanding sphere, 0.5s lifetime
  - Emissive core for bloom
- [ ] `WaterSplash.tsx`:
  - On cannonball water impact: upward white/blue particles
  - Column shape, 0.3s lifetime
  - Pair with a simple expanding ring on water surface

**Acceptance:** Cannon fire has visible muzzle flash. Hits produce explosions. Water impacts produce splashes. Effects are visible and don't tank framerate.

##### Step 16: Post-Processing

- [ ] Create `PostProcessing.tsx`:
  - `<EffectComposer>` wrapping:
    - `<Bloom luminanceThreshold={1} luminanceSmoothing={0.9} intensity={0.5} />`
    - `<Vignette eskil={false} offset={0.1} darkness={0.5} />`
  - Dynamic vignette: on player damage hit, animate `darkness` to 0.9 then back to 0.5 over 0.3s
  - Optional: `<ChromaticAberration offset={[0,0]} />` pulsed on hit
- [ ] Camera shake: drei `<CameraShake>` component
  - Triggered on nearby explosions
  - Intensity proportional to distance
  - Short duration (0.2s)

**Acceptance:** Bloom makes muzzle flash and explosions glow. Vignette pulses on damage. Camera shakes on nearby explosions. No significant FPS impact.

##### Step 17: Audio

- [ ] Create `AudioManager.ts`:
  - Initialize Howler with master volume
  - Sound definitions with pooling:
    - `cannon_fire`: pool 10, short cannon boom
    - `explosion`: pool 5, impact explosion
    - `splash`: pool 8, water splash
    - `engine_hum`: loop, volume modulated by thrust
    - `ambient_ocean`: loop, constant background
  - Positional audio: set `Howler.pos()` to camera position each frame
  - Per-sound: set `sound.pos(x, y, z)` for 3D spatialization
- [ ] Create `sounds.ts`: sound file paths and configuration
- [ ] Integrate into systems:
  - WeaponSystem -> cannon_fire on shoot
  - DamageSystem -> explosion on hit
  - ProjectileSystem -> splash on water impact
  - MovementSystem -> engine_hum volume tied to thrust input
  - Always playing: ambient_ocean

**Acceptance:** Cannon shots have sound. Explosions have sound. Ambient ocean plays. Sounds are spatialized (louder when close). Sound pooling prevents audio glitches from rapid fire.

##### Step 18: GLTF Model Integration

- [ ] Load player boat model (Sketchfab Fast Assault Boat or Kenney watercraft)
  - drei `useGLTF` with preloading
  - Scale to match physics collider (approximately 5m long)
  - Apply gritty material overrides (rougher, darker, rust-tinted)
- [ ] Load enemy boat models (Kenney watercraft kit variants)
  - Skiff: smaller model
  - Barge: larger model (if implemented)
- [ ] Ensure models are centered at origin with forward pointing along +Z

**Acceptance:** Boats look like boats, not boxes. Models match collider sizes. No visual gaps or floating artifacts.

---

#### Phase 7: Deploy

##### Step 19: Build Optimization

- [ ] `vite.config.ts` production build:
  - Code splitting: dynamic import for three.quarks (heavy)
  - Asset optimization: compress textures, audio files
  - Target bundle: under 2 MB JS (gzipped), under 20 MB total with assets
- [ ] Test production build locally: `npm run build && npm run preview`
- [ ] Fix any build-only issues (tree-shaking, missing imports)

**Acceptance:** `npm run build` succeeds. Preview runs without errors. Bundle size within budget.

##### Step 20: Cloudflare Pages Deployment

- [ ] Connect repo to Cloudflare Pages (or use `wrangler pages deploy`)
- [ ] Build settings: framework = Vite, build command = `npm run build`, output = `dist`
- [ ] Custom domain or `*.pages.dev` URL
- [ ] Test deployed version in Chrome and Firefox
- [ ] Verify game loads under 5 seconds
- [ ] Capture a screenshot/video for competition submission

**Acceptance:** Game is live at a public URL. Loads fast. Plays correctly. Ready for submission.

---

### Vertical Slices for Iterative Delivery

#### Slice 1: Sailing Simulator (Steps 1-6)
**Scope:** A boat floats on an ocean, player can drive it around.
**Components:** Water, Sky, PlayerBoat, BuoyancySystem, MovementSystem, Store (minimal)
**What it proves:** Core tech works -- water rendering, physics integration, buoyancy math.
**Acceptance:** Player sails a boat on a dynamic ocean. Feels good to control.

#### Slice 2: Cannon Test Range (Steps 7-9)
**Scope:** Player boat can fire cannons into the ocean. No enemies yet.
**Components:** CameraSystem, WeaponSystem, ProjectilePool, TrajectoryPreview, DamageSystem (partial)
**What it proves:** Camera quadrant system works, projectile physics works, pool pattern works.
**Acceptance:** Player orbits camera, sees trajectory preview, clicks to fire, cannonballs arc and splash.

#### Slice 3: First Contact (Steps 10-12)
**Scope:** Enemy boats spawn, approach, fight, and die. Score and waves work.
**Components:** EnemyBoat, AISystem, WaveSystem, full DamageSystem
**What it proves:** Game loop is complete. This is a playable game.
**Acceptance:** Player fights waves of enemies. Can win (clear waves) and lose (die). Score tracks progress.

#### Slice 4: Presentation Layer (Steps 13-18)
**Scope:** HUD, rocks, VFX, audio, real models. The game feels finished.
**Components:** All UI, Rocks, ParticleManager + effects, PostProcessing, AudioManager, GLTF models
**What it proves:** Game is competition-ready.
**Acceptance:** Game looks polished, sounds good, and has clear visual feedback for all actions.

#### Slice 5: Ship It (Steps 19-20)
**Scope:** Build, optimize, deploy.
**Acceptance:** Game is live at a public URL and submitted to the competition.

---

## Acceptance Criteria

### Must-Have (MVP)
- [ ] AC-01: Game loads in a browser and displays an ocean with dynamic waves
- [ ] AC-02: Player can steer a boat with WASD and it responds to waves (buoyancy)
- [ ] AC-03: Camera orbits boat with mouse, firing quadrant updates in real-time
- [ ] AC-04: Click fires cannonballs from the correct quadrant with visible arcs
- [ ] AC-05: Enemy boats spawn, approach player, and fire their own cannons
- [ ] AC-06: Damage system works: armor absorbs first, hull HP, boats sink at 0
- [ ] AC-07: Wave-based progression: clear wave -> next wave spawns harder
- [ ] AC-08: Score tracks enemies sunk and waves survived
- [ ] AC-09: Game over when player sinks, with restart option
- [ ] AC-10: Deployed to Cloudflare Pages at a public URL

### Should-Have (Polish)
- [ ] AC-11: HUD displays health bars, wave number, score, quadrant indicator
- [ ] AC-12: Trajectory preview arc shows expected cannonball landing
- [ ] AC-13: Rock obstacles provide tactical cover
- [ ] AC-14: Explosion and muzzle flash particle effects
- [ ] AC-15: Bloom post-processing on emissive effects
- [ ] AC-16: Sound effects for cannons, explosions, splashes, ambient ocean
- [ ] AC-17: Real GLTF boat models replace placeholder boxes

### Nice-to-Have (If Time)
- [ ] AC-18: Barge enemy type (heavy, slow, tanky)
- [ ] AC-19: Camera shake on nearby explosions
- [ ] AC-20: Vignette damage feedback
- [ ] AC-21: Engine hum audio tied to thrust
- [ ] AC-22: Sinking animation (list, rotate, descend)

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Buoyancy tuning takes too long | H | M | Start with simple Y-position snapping as fallback, iterate to force-based. Tuning constants documented. |
| Water shader doesn't match CPU sampling | H | M | Single source of truth: `gerstnerWaves.ts` defines wave params, shared as uniforms to shader. Write unit test comparing GPU readback vs CPU. |
| Rapier InstancedRigidBodies performance | M | L | Pool of 50 is well within Rapier's capacity. If issues: reduce pool size, increase projectile speed (fewer alive at once). |
| Enemy AI is too dumb or too hard | M | H | Tuning constants in `boatStats.ts` and AI state machine timers. Easy to adjust without code changes. Start with slow, predictable enemies. |
| three.quarks integration with R3F | M | M | Fallback: simple sprite-based effects with drei `<Billboard>` and `<Sprite>`. Particles are polish, not core. |
| Bundle size too large (three.js tree shaking) | L | M | Vite handles Three.js tree shaking well. three.quarks is the risk -- dynamic import if needed. |
| WebGL compatibility issues | M | L | Target modern Chrome/Firefox only. No mobile. Three.js handles most WebGL2 compatibility. |
| Time runs out before polish phase | H | M | Vertical slices ensure playable game after Slice 3. Polish is additive, not required. |
| GLTF model loading/scaling issues | L | M | Placeholder box-boats work for gameplay. Models are cosmetic. |
| Positional audio browser autoplay policy | L | H | Howler.js handles unlock automatically. First click (title screen) serves as user gesture. |

---

## Alternatives Considered

### Water Rendering
- **Spiri0/Threejs-WebGPU-IFFT-Ocean (FFT ocean):** More realistic but requires WebGPU, adding browser compatibility risk. Rejected for MVP -- Gerstner waves are sufficient and work on all WebGL2 browsers.
- **drei `<Ocean>` / Three.js Water.js addon:** Simpler but less control over wave parameters needed for buoyancy matching. Rejected -- we need exact CPU/GPU wave parity.
- **Chosen: Custom Gerstner shader + CPU mirror.** Full control, proven approach, CPU/GPU parity guaranteed.

### Physics
- **cannon-es:** Lighter but less maintained, no WASM performance. Rejected.
- **Custom physics (no library):** Too much work given the timeline. Rejected.
- **Chosen: react-three-rapier (Rapier WASM).** Best R3F integration, performant, well-documented collision groups and events.

### Camera System
- **drei OrbitControls:** Familiar but fights with game input (zoom, pan gestures). Would need significant configuration to disable unwanted interactions.
- **Chosen: Custom camera in useFrame.** Full control over orbit behavior, azimuth, elevation clamping. No unwanted gestures.

### Projectile System
- **Raycasting (hitscan):** Simpler but no visible cannonball arcs. Loses the core aesthetic.
- **Individual RigidBody per shot:** Creates/destroys physics bodies rapidly. GC pressure.
- **Chosen: InstancedRigidBodies pool.** Pre-allocated, no GC, Rapier handles CCD for fast-moving projectiles.

### State Management
- **React context:** Re-render storm from frequent updates.
- **Redux:** Overkill boilerplate for a game.
- **Jotai/Valtio:** Viable but less proven in R3F game patterns.
- **Chosen: Zustand with getState().** Zero re-render pattern for useFrame, React subscriptions only for UI. Industry standard for R3F games.

---

## Competition Strategy

Dan Greenheck (judge) cares about:
1. **Water integration** -- The game must showcase water. Buoyancy, wave interaction, splashes, ocean combat.
2. **Creativity** -- Not just "boat on water" but a complete game concept with personality.
3. **Playability** -- Must be fun to play, not just a tech demo.
4. **Built from scratch** -- No templates or game engines wrapping Three.js.

Our advantages:
- Wave-based combat has clear progression and replayability
- Broadside cannon system (AC: Black Flag style) is immediately understandable and fun
- Physical cannonball arcs + trajectory preview is satisfying
- Post-apocalyptic theme gives visual identity beyond "generic ocean game"
- Buoyancy-driven movement showcases water interaction in gameplay, not just visuals
