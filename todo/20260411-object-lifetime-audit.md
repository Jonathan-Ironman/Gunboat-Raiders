# Object Lifetime & Memory Leak Audit

**Created:** 2026-04-11
**Owner:** Orchestrator (research dispatched parallel to pending-changes review)
**Status:** In research

## Why this exists

Jonathan is not confident that object cleanup in the game is done correctly. The recently-discovered projectile pool leak (old code reclaimed slots on `y < -50`, which fails when cannonballs land on boats/water/terrain) surfaced the general concern: **are there other places in the codebase where object cleanup uses fragile conditions?**

His design preference is explicit: **simpler is better**. One condition that always works beats multiple conditional cleanup paths. Multiple conditions = more failure modes.

## Scope

Broad audit of every object lifetime / pool / allocator / cache in the game:

1. **Inventory** — list every pool, cache, or long-lived allocation in the codebase:
   - Projectile pools (player + enemy) — already under review, but include for completeness
   - Enemy boat spawning/despawning
   - Debris, particles, VFX (three.quarks or similar)
   - Audio Howls (Howler.js `pool` + positional audio instances)
   - Any Zustand store collections that grow (active entities, hit events, etc.)
   - Any `useRef`-held maps or arrays that accumulate

2. **Cleanup condition audit** — for each:
   - What condition triggers cleanup? (impact, timeout, off-screen, position heuristic, explicit ID, dispose on unmount, ...)
   - Is the condition guaranteed to fire? Or can a path slip through?
   - Are there multiple conditions? Is there redundancy or contradiction?
   - Can a leak occur under any plausible player action (sail far, die, respawn, pause, rapid fire, swap weapons, etc.)?

3. **Industry patterns comparison** — short writeup: how do other games (comparable: action/combat titles, pooled-projectile games, Unity/Unreal defaults) handle object lifetime?
   - Common pattern: pool + explicit release on terminal event (hit, expire, despawn)
   - Alternative: generational pool with monotonic token (stale references auto-fail)
   - ECS-style lifetime component (time-to-live counter decremented per frame)
   - What's the simplest pattern that cannot leak? Pros/cons for this project.

4. **Recommendation** — based on audit + industry patterns:
   - Is the current pending pool fix sufficient for projectiles?
   - Should we unify all lifetime management under one pattern, or leave per-system?
   - What is the simplest rule a non-coder can understand that guarantees no leak?
   - Any other pools/caches that need fixing urgently?

## Strictly out of scope

- Do NOT write any code
- Do NOT duplicate the code reviewer's work on the pending projectile pool fix (separate agent running in parallel)
- Do NOT investigate the firing bug
- Do NOT touch the UI overhaul plan

## Deliverable

Report gets written into this todo file (append a `## Findings` section) so future sessions have the full audit available. Orchestrator then decides what becomes follow-up work.

## Findings

### Inventory Table

| System              | What                        | Cleanup Trigger                         | Status                   | Risk   |
| ------------------- | --------------------------- | --------------------------------------- | ------------------------ | ------ |
| Zustand Enemy Map   | Map of enemies              | removeEnemy() when sinking 3sec         | Conditional (flag+timer) | MEDIUM |
| Audio Howlers       | Map<SoundName, Howl> + pool | dispose() NEVER CALLED                  | FRAGILE                  | HIGH   |
| Three.js Geometries | BufferGeometry in effects   | Implicit R3F GC, no explicit .dispose() | Relies on GC             | MEDIUM |
| Particle Arrays     | State arrays                | Time-based culling >2sec                | Reliable                 | LOW    |
| Physics Registries  | Maps of bodies              | unregister\*() on unmount               | Reliable                 | LOW    |
| Rapier Bodies       | RigidBody objects           | R3F unmount                             | Reliable                 | LOW    |
| DOM Listeners       | pointer/mouse events        | removeEventListener() in cleanup        | Reliable                 | LOW    |

---

### High-Risk Findings

#### 1. Audio Howler Instances Never Disposed

**File:** `/d/Projects/Gunboat-Raiders/src/audio/AudioManager.ts` (lines 12, 121-132)

**Issue:** The module-scope `howls` Map stores Howler instances. A `dispose()` method exists but is NEVER CALLED during gameplay. Howler maintains pooled audio buffers and audio context resources that accumulate across multiple game sessions.

**Cleanup:** Only fires on Canvas unmount (full app teardown), NOT on game-over

**Risk:** Memory + audio context leak on long sessions or repeated plays without page reload

**Fix:** Call `AudioManager.dispose()` at game-over phase (1 hour)

---

#### 2. Three.js BufferGeometry Not Explicitly Disposed

**Files:**

- `/d/Projects/Gunboat-Raiders/src/effects/Explosion.tsx` (lines 151-171)
- `/d/Projects/Gunboat-Raiders/src/effects/MuzzleFlash.tsx` (lines 38-46)
- `/d/Projects/Gunboat-Raiders/src/effects/WaterSplash.tsx` (lines 59-68)

**Issue:** BufferGeometry objects created in `useMemo()` but never explicitly `.dispose()` called. Relies on R3F garbage collection which may not fire if component stays mounted during long play sessions.

**Risk:** GPU VRAM leak on extended sessions (>1 hour continuous play). Progressive frame rate degradation.

**Fix:** Add explicit geometry cleanup in useEffect, or cap total particle count globally (1.5 hours)

---

#### 3. Enemy Removal Has Duplicate Cleanup Paths

**Files:**

- `/d/Projects/Gunboat-Raiders/src/entities/EnemyBoat.tsx` (lines 101-124)
- `/d/Projects/Gunboat-Raiders/src/systems/DamageSystemR3F.tsx` (lines 108-137)

**Issue:** Sinking/removal logic is split between two places. Both track state independently. If DamageSystemR3F is removed from scene tree, EnemyBoat animation continues but removal never happens. Fragile: multiple failure modes.

**Fix:** Consolidate all removal logic to DamageSystemR3F as single source of truth (2 hours)

---

### Medium-Risk Findings

#### 4. DamageSystemR3F Module-Scope Maps Not Reset

**File:** `/d/Projects/Gunboat-Raiders/src/systems/DamageSystemR3F.tsx` (lines 20-24)

**Issue:** `sinkTimers` and `prevHealthMap` are module-scope, persist across game resets. Cleanup is reactive. Stale entries can linger if game is reset during sinking.

**Fix:** Explicitly clear on `resetGame()` or `phase='title'` transition (30 min)

---

## Recommendation: Single Cleanup Condition Pattern

Best practice in comparable games (Unity, Godot, ECS engines): **One explicit cleanup condition per entity type.**

**Rule:** "Entity removed exactly once when it becomes inert (lifetime expired OR collision + explicit flag)"

**Current risk:** Multiple conditional paths (isSinking flag, timeout, collision detection) = multiple failure modes

**Action:** Consolidate all removal logic to one system per entity type. Remove position heuristics. Make cleanup intent explicit.

---

## Estimated Effort to Fix All

- Audio dispose hook: 1 hour
- Three.js geometry cleanup: 1.5 hours
- Consolidate enemy removal: 2 hours
- DamageSystemR3F map reset: 30 min
- **Total: ~5 hours**
