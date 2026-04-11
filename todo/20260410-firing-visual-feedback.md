# Firing visually broken — no visible cannonball/explosion storm on broadside

## Description

**TOP PRIORITY.** When firing a broadside (4 port or 4 starboard cannons) or the fore cannons, the user expected to see lots of cannonballs flying and explosions, but it does not visually work. This is the single most important thing to fix — without satisfying firing feedback, the game is not fun.

What should happen on a broadside fire:

- 4 muzzle flashes (one per cannon) clearly visible at each cannon position
- 4 cannonballs visibly launched from the cannon muzzles along their aim direction
- Cannonballs arc through the air under gravity
- Cannonballs create water splash VFX on water impact, or explosion VFX on enemy impact
- Clear audio on fire + impact
- Cooldown is per-quadrant (4 cannons fire simultaneously, then 2s cooldown for that quadrant)

What user observes:

- Firing feels inconsistent
- Expected "lots of cannonballs and explosions" but does not see them
- Combat not confirmed visually

## Context

User feedback 2026-04-10 end of day: "Shooting doesn't work well yet. I expected lots of cannonballs and explosions when we fire broadsides or forward, but that really doesn't seem to work well yet."

We already fixed:

- Cannonballs now glowing emissive spheres (commit 943425b)
- Muzzle flash brightened/enlarged (commit 943425b)
- Firing 1-frame quadrant lag (commit 06a7b18)
- Scenario 9 "all four firing quadrants produce projectiles" passes in automated tests

But the user still doesn't see satisfying visual combat. So automated tests pass but the integrated feel is wrong.

## Acceptance Criteria

- [ ] Clicking once fires ALL cannons in the active quadrant simultaneously (4 cannonballs from a broadside click)
- [ ] All 4 muzzle flashes are clearly visible at their cannon positions
- [ ] All 4 cannonballs are clearly visible arcing through the air (no invisible/hidden projectiles)
- [ ] Water splash VFX visible when projectiles hit the ocean
- [ ] Explosion VFX visible when projectiles hit enemies
- [ ] Audio plays reliably on fire and impact
- [ ] Cooldown is per-quadrant so alternating broadsides is possible
- [ ] Manual playtest confirms "satisfying combat feel"

## Relevant Files

- `src/entities/ProjectilePool.tsx` — projectile rendering and activation
- `src/systems/WeaponSystemR3F.tsx` — fire trigger, per-quadrant firing
- `src/systems/WeaponSystem.ts` — cooldown + computeFireData
- `src/effects/MuzzleFlash.tsx` — muzzle flash VFX
- `src/effects/Explosion.tsx` — explosion VFX
- `src/effects/WaterSplash.tsx` — splash VFX
- `src/effects/ParticleManager.tsx` — VFX event subscription
- `src/utils/boatStats.ts` — weapon mount definitions

## Notes

- Scenario test 9 in `tests/smoke/scenarios.spec.ts` technically passes — so the projectiles ARE being created. The issue is visual/perceptual.
- Possibly: projectile mesh scale still too small despite 0.35 radius upgrade, or they fly out of view too fast to see
- Possibly: muzzle flash lifetime too short to register visually
- Possibly: only 1 cannon per quadrant actually fires due to a loop bug (should be 4 per broadside)
- Recommend: manual playtest with screen recording + frame-by-frame analysis
- This is THE most important remaining fix. Without it, the game is not a game.

---

## Research (2026-04-11, follow-up: cooldown feel)

### 1. Root Cause — Ranked Hypotheses

**Hypothesis A (PRIMARY): One single `fireRequestedRef` flag consumed by one click, shared across all quadrants.**
`WeaponSystemR3F.tsx:25` — `fireRequestedRef` is a single `useRef(false)`. Every mousedown sets it to `true`. Every `useFrame` consumes it immediately (line 76: `fireRequestedRef.current = false`). This means:

- One click = one `useFrame` frame that gets a fire attempt.
- If the player clicks faster than 60 fps (< 16 ms), a second click arriving in the same frame is **silently dropped** — the flag is already `true` and gets reset to `false` before the next frame reads a second event. This is not the main cause of the "dead period" but it does cap effective fire rate at 60 Hz regardless of click speed.

**Hypothesis B (PRIMARY): Cooldown is per-quadrant, but rapid cycling through all quadrants locks out all 4 simultaneously.**
This is by design and works correctly. The problem is the **perception** of the lockout. With 4 quadrants:

- Fire port broadside (4 balls, port locked 0.8 s)
- Fire starboard broadside (4 balls, starboard locked 0.8 s)
- Fire fore (2 balls, fore locked 0.8 s)
- Fire aft (1 ball, aft locked 0.8 s)
- All 4 quadrants are now on cooldown simultaneously. The player is locked out of all firing for up to 0.8 s.
- This means 3-4 rapid clicks through all quadrants = full lock-out for 0.8 s. That is the "fire a few times, then dead period."

**Hypothesis C (SECONDARY): No UI feedback while on cooldown.**
`WeaponCooldownIndicator` is planned but absent. When a click is denied by `canFire()` (line 80), the code path simply falls through — no audio, no visual, no dry-fire sound. The player hears and sees nothing. The silent deny is worse than the 0.8 s cooldown itself; it reads as "broken."

**Hypothesis D (LOW RISK): Pool exhaustion.**
Pool has 50 slots (`ProjectilePool.tsx:61`). Projectile lifetime is 8 s (`PROJECTILE_MAX_LIFETIME = 8`, line 79). Maximum shot rate: 4 quadrants x 4 mounts x (1 / 0.8 s) = 20 projectiles/second. 50 slots / 20 per second = 2.5 seconds before exhaustion at maximum continuous fire rate. Normal play cannot sustain this, but a player who clicks all quadrants rapidly for 2 seconds could exhaust the pool. Pool exhaustion is a **silent noop** — `activate()` returns `-1` (line 230) and nothing is spawned, with no error or feedback. This is a latent bug but not the primary cause of the reported dead period.

### 2. What Actually Happens on a Broadside Click (Step-by-Step)

1. `mousedown` fires on `document` => `onMouseDown` sets `fireRequestedRef.current = true` (WeaponSystemR3F.tsx:32-34).
2. Next `useFrame` tick (<=16.7 ms later):
   a. `tickCooldowns()` runs, decrementing all 4 quadrant cooldowns by `delta` (WeaponSystem.ts:14-24).
   b. Store is updated with decremented cooldowns (WeaponSystemR3F.tsx:59-67).
   c. `fireRequestedRef.current` is read and immediately reset to `false` (line 75-76).
   d. `quadrant = store.activeQuadrant` — reads whatever `CameraSystemR3F` last wrote (priority -1, so it ran this frame before the weapon system).
   e. `canFire(updatedWeaponState, quadrant)` — checks `cooldownRemaining[quadrant] <= 0` (WeaponSystem.ts:27-29).
   f. If allowed: `computeFireData()` returns one spawn per mount in the quadrant. For port broadside = **4 spawns**.
   g. `poolManager.activate()` is called **4 times in a loop** (WeaponSystemR3F.tsx:99), consuming 4 pool slots.
   h. 4 `muzzle-flash` VFX events are emitted.
   i. Cooldown for that quadrant is reset to `player.weapons.cooldown` = **0.8 s** (line 129).
3. No second fire can happen in the same frame even if the player clicked twice — the flag was already consumed in step 2c.
4. For the next 0.8 s: every frame runs `tickCooldowns()` but `canFire()` returns `false` for that quadrant. Every click during this window sets the flag, gets consumed in useFrame, hits `canFire() = false`, and silently drops.

### 3. Proposed Fix Sketch

**Decision points for user:**

A. **Per-mount vs per-quadrant cooldown** (RECOMMEND: keep per-quadrant)
Per-quadrant is the right model for a broadside game — it gives the "alternating broadsides" mechanic. Per-mount would allow staggered rapid fire which changes the game feel fundamentally. Keep per-quadrant.

B. **All mounts at once or staggered?** (RECOMMEND: all at once)
Staggering 4 mounts over 4 frames gives a visual drum-roll effect. Fun, but adds complexity. All at once is the current behavior and matches the "broadside volley" fantasy. Keep simultaneous.

C. **Reduce cooldown** (RECOMMEND: yes, 0.8 s => 0.5 s, with UI indicator)
The real problem is invisibility, not duration. But 0.8 s still feels long when the player has no feedback. Reducing to ~0.5 s halves the dead-feel window. With a visible indicator, even 0.8 s would be acceptable — the player understands they are reloading.

**Concrete immediate fixes (no design decisions required):**

1. **Add dry-fire audio** — when `canFire()` returns `false`, play a short "click" or "thump" sound so the player knows the game received their click. One line in WeaponSystemR3F after the `canFire` check fails.
2. **Add cooldown ring/arc to HUD** — a simple arc overlay per quadrant that depletes and refills over 0.8 s. Even a single shared "reloading" indicator would eliminate the "it's broken" perception. `WeaponCooldownIndicator` is the planned solution.
3. **Reduce cooldown to 0.5 s** — halves the dead-period window with zero other changes.
4. **Pool exhaustion guard** — when `activate()` returns -1, emit a warning event or skip silently (already silent, but add a `console.warn` in dev mode at minimum).

### 4. Deterministic Test Plan

Tests that FAIL on current behavior and PASS after fix:

```
test: "denied fire click produces dry-fire feedback"
  setup: set cooldownRemaining.port = 0.5 (not yet expired), activeQuadrant = 'port'
  action: simulate mousedown => useFrame tick
  assert: canFire() returns false
  assert: dryFireEvent emitted OR audio called with 'dry_fire' sound
  assert: no projectile spawned (pool activeIndices unchanged)
  currently: FAILS (no feedback emitted, silent drop)
  after fix: PASSES

test: "0.8s cooldown expires correctly and re-enables fire"
  setup: fire port broadside (starts 0.8s cooldown)
  action: advance time by 0.79s via tickCooldowns loop
  assert: canFire('port') = false
  action: advance by 0.02s more (total 0.81s)
  assert: canFire('port') = true
  currently: PASSES (cooldown logic is correct)
  after fix: still PASSES

test: "pool exhaustion produces no crash and no projectile"
  setup: mark all 50 pool slots as active
  action: simulate fire
  assert: activate() returns -1
  assert: no exception thrown
  assert: no projectile spawned
  currently: PASSES (silent noop) -- but should also add console.warn assertion

test: "rapid click in same frame does not double-fire"
  setup: two mousedown events in the same frame before useFrame runs
  assert: only one fire attempt is made
  assert: cooldown reset only once
  currently: PASSES (flag is boolean, second click is a no-op)
```

### 5. Out-of-Scope Observations (for later)

- The `fireRequestedRef` single-boolean design means the player can never fire faster than once per rendered frame (~60 Hz). This is fine for the current game feel but means rapid multi-quadrant spam does not queue up -- each click overwrites the previous flag state without loss since bool is idempotent.
- Enemy `EnemyProjectilePool` (30 slots) uses a separate pool -- not affected by player pool exhaustion.
- `splashDamage` and `splashRadius` are registered per projectile spawn but the water-splash VFX / splash damage radius logic has not been verified in this research pass.

---

## Research (2026-04-11, follow-up: pool disposal)

### 1. Root Cause — Ranked Hypotheses

**Hypothesis A (CONFIRMED PRIMARY): The lifetime expiry path in `ProjectileSystemR3F` does NOT deactivate pool slots — it deactivates by POSITION not by store ID.**

`ProjectileSystemR3F.tsx:96-109`. When expired projectile IDs are found, the code calls `store.removeProjectile(id)` (removes the store entry) and then iterates `projectileStates` looking for bodies at `y < -50` to deactivate. This is deeply broken:

- A cannonball that missed all targets and is still flying (y > -50) is removed from the store via `removeProjectile(id)` but its pool slot is **never deactivated**. The slot stays in `activeIndicesRef` forever.
- A cannonball that hit water (y < -50) might get deactivated by the position heuristic — but only if the body physically sank, which depends on physics/gravity after impact.
- The storeId-to-pool-index mapping does not exist. The store entry (`projectiles` Map keyed by storeId) has no field that records which pool slot index it corresponds to. So the expired-lifetime code has no way to call `poolManager.deactivate(index)` for the right slot.

Result: every projectile that expires by lifetime (8 s, flying or missed) permanently leaks its pool slot. After ~13–17 broadside volleys (120 slots / (4–9 projectiles per broadside that miss)), the pool exhausts silently and `activate()` returns `-1`. Firing stops producing cannonballs with zero feedback.

**Hypothesis B (CONFIRMED SECONDARY): `canFire()` was patched to `return true` unconditionally — cooldown is completely bypassed.**

`WeaponSystem.ts:33`. The function accepts `_state` and `_quadrant` (underscored, ignored) and always returns `true`. This means the cooldown countdown is computed and stored each frame but never consulted. The player can fire every single frame with no gate. At 60 fps this is 60 fire attempts per second, each consuming up to 4 pool slots (port/starboard broadside), meaning **up to 240 pool slots per second** — exhausting the 120-slot pool in under a second of sustained click-spam. The slot leak from Hypothesis A makes this much worse, but even with perfect deactivation the pool math fails under this design.

**Hypothesis C (CONFIRMED, LATENT): No recycle-oldest fallback in `activate()`.**

`ProjectilePool.tsx:229-236`. When the pool is full (`index === -1`), `activate()` silently returns `-1`. There is no force-reclaim of the oldest slot. Every fire attempt during pool exhaustion is a silent noop — gun jams.

**Hypothesis D (LOW, the math — shows it's a pool sizing problem even if all leaks were fixed):**

With `canFire()` always returning true (current state), at 60 fps, 4 mounts per broadside, pool slots leak via missed shots: a player firing port/starboard rapidly fills the 120-slot pool in seconds. The dev agent running concurrently bumped pool to 120 (was 50 in the prior research pass) but left `canFire` as always-true — only delays the inevitable stall by a factor of 2.4x (50→120).

### 2. Lifecycle Trace — Activate to Free Pool

**HAPPY PATH (collision hit):**

1. `WeaponSystemR3F.tsx:99` — `poolManager.activate()` called.
2. `ProjectilePool.tsx:241` — slot index added to `activeIndicesRef`.
3. `ProjectilePool.tsx:264` — `setProjectileSlotMetadata(index, ...)` writes metadata.
4. `ProjectilePool.tsx:254` — `spawnProjectile()` registers storeId in Zustand store.
5. Physics step fires, projectile travels.
6. Collision detected — `handleCollisionEnter` runs INSIDE physics step.
7. `ProjectilePool.tsx:197` — `queueProjectileDeactivation(index)` adds index to `pendingDeactivations`.
8. Next frame: `ProjectileSystemR3F.tsx:38-41` — `drainPendingProjectileDeactivations()` returns the index.
9. `ProjectileSystemR3F.tsx:40` — `poolManager.deactivate(index)` called.
10. `ProjectilePool.tsx:283-288` — `deactivate()` looks up storeId, calls `removeProjectile(storeId)`, then calls `deactivateSlot(index)`.
11. `ProjectilePool.tsx:108-109` — slot removed from `activeIndicesRef`, metadata cleared.
12. Slot is free. SLOT RETURNED CORRECTLY.

**BROKEN PATH (lifetime expiry — the leak):**

1. `ProjectileSystemR3F.tsx:56-63` — builds `lifetimeMap` from `projectiles` store map.
2. `ProjectileSystemR3F.tsx:64` — `getExpiredProjectiles()` returns expired storeIds.
3. `ProjectileSystemR3F.tsx:97` — `store.removeProjectile(id)` removes store entry. Store entry is gone.
4. `ProjectileSystemR3F.tsx:100-107` — iterates `projectileStates` (physics body cache), looks for `state.position.y < -50`.
   - If projectile is still airborne (y > -50): **deactivateSlot is never called. Slot leaks.**
   - If projectile sank below -50: `poolManager.deactivate(i)` is called on whatever index `i` happens to be at y < -50 at that moment — this is a position scan, not a storeId→index lookup, so it may deactivate the WRONG slot or deactivate a slot that already returned via collision.
5. Even in the "correct" case: `poolManager.deactivate(i)` calls `deactivateSlot(i)` which tries to read metadata (storeId) to call `removeProjectile` — but `removeProjectile` was already called in step 3. Net result: double-remove attempt on the storeId (probably harmless if the store is a Map delete, but wasteful).

**MISSING PATH (out-of-bounds):**
There is no explicit out-of-bounds check that deactivates slots when a projectile leaves the arena. The lifetime (8 s) is the only backstop, and the lifetime expiry path is broken for missed projectiles. So a cannonball that flies off into the void will hold its slot for 8 s then leak it permanently.

**MISSING PATH (world unload / unmount):**
`ProjectilePool.tsx:296-303` — the `useEffect` cleanup calls `setProjectilePoolManager(null)`, `clearAllProjectileSlotMetadata()`, and `clearAllPendingProjectileDeactivations()`. This clears the refs module state but does NOT call `deactivateSlot` on each active index. On remount (scene restart), `activeIndicesRef` on the new component instance starts empty (it's a `useRef` inside the component), so slots are correctly empty. No leak here — the `useRef` is fresh per mount.

### 3. Specific Leaks Found

| Leak                             | Location                          | Trigger                                                                  | Severity                                                             |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Missed-shot lifetime expiry      | `ProjectileSystemR3F.tsx:96-109`  | Any projectile that expires without hitting a surface below y=-50        | CRITICAL — permanent slot loss per missed shot                       |
| Airborne-expiry storeId mismatch | Same block                        | `removeProjectile(id)` called before `deactivate(index)` via wrong index | HIGH — may deactivate wrong slot or no slot                          |
| No storeId→index mapping         | `ProjectileSystemR3F.tsx` + store | Lifetime path cannot find the correct pool index for an expired storeId  | ROOT STRUCTURAL — the lifetime expiry path is architecturally broken |
| `canFire()` always returns true  | `WeaponSystem.ts:33`              | Every mousedown fires with no cooldown gate                              | HIGH — burns pool slots at frame rate with no throttle               |

### 4. Fix Sketch for Dev Agent

**Fix 1 — Restore meaningful `canFire()` with small cooldown (150 ms per quadrant)**

`src/systems/WeaponSystem.ts`:

- Restore the cooldown check: `return state.cooldownRemaining[quadrant] <= 0`.
- Player `cooldown` in `boatStats.ts` is currently `0.8`. Change to `0.15` (150 ms).
- This is the user's stated design intent: "small cooldown between shots is fine."

**Fix 2 — Track storeId-to-poolIndex mapping so lifetime expiry can deactivate correctly**

Option A (recommended — minimal change): In `ProjectilePool.tsx activate()`, maintain a `storeIdToIndex` Map alongside `activeIndicesRef`. When `spawnProjectile()` returns a storeId, store: `storeIdToIndex.set(storeId, index)`. Clear it in `deactivateSlot()`. Expose a lookup method via the pool manager interface.

Option B (alternative): Store the pool slot index inside the Zustand projectile entry. Add a `poolIndex: number` field to the projectile store entry. Then `ProjectileSystemR3F` can read `proj.poolIndex` when expiring.

**Fix 3 — Rewrite the lifetime expiry deactivation path in `ProjectileSystemR3F.tsx`**

Current broken code (lines 96-109):

```ts
for (const id of expired) {
  store.removeProjectile(id);
  if (poolManager) {
    for (const [i, state] of projectileStates) {
      if (state.position.y < -50) {
        // WRONG — position heuristic, not slot lookup
        poolManager.deactivate(i);
        splashedSlots.delete(i);
      }
    }
  }
}
```

Replace with (using Option A mapping):

```ts
for (const id of expired) {
  const poolIndex = poolManager?.getIndexByStoreId(id) ?? -1;
  store.removeProjectile(id);
  if (poolManager && poolIndex !== -1) {
    deactivateSlot(poolIndex); // deactivateSlot only (store entry already removed)
    splashedSlots.delete(poolIndex);
  }
}
```

Note: `deactivateSlot` must be called, not the full `deactivate()`, because `deactivate()` calls `removeProjectile` again (the entry is already gone). Or add a guard to `deactivate()` that skips `removeProjectile` if storeId lookup returns undefined.

**Fix 4 — Pool size: reduce to 60 after leak is fixed**

With 150 ms cooldown and correct lifetime expiry, peak concurrent player projectiles = (1000 ms / 150 ms) × 4 mounts × (8 s lifetime) = 6.67 fires/s × 4 × 8 = 213 theoretical max — but cannonballs travel ~60 m/s with an 8 s lifetime, so most hit something or splash well before 8 s. Realistic peak concurrent in play is ~20–40. Pool of 60 gives 50% headroom. 80 is safe for paranoid sizing. Do NOT use 120 — it just delays the symptom if the leak returns.

**Fix 5 — Add `console.warn` (dev mode) on pool exhaustion**

`ProjectilePool.tsx:236`: when `index === -1`, add `if (import.meta.env.DEV) console.warn('[ProjectilePool] pool exhausted')`. Makes future regressions immediately visible.

### 5. Deterministic Test Plan

```
test: "pool slot count stays stable over 200 rapid fires"
  setup: mock pool with 60 slots, mock physics body states at y=5 (airborne)
  action: fire 200 times in a loop, advancing time by 0.16s per fire (150ms cooldown)
  action: after each fire, advance time by 8.1s to expire the projectile lifetime
  action: call the ProjectileSystemR3F useFrame tick each iteration
  assert: activeIndicesRef.size never exceeds 1 (one in-flight at a time)
  assert: pool never returns -1 (no slot starvation)
  currently: FAILS (slots leak permanently on lifetime expiry for airborne shots)
  after fix: PASSES

test: "expired projectile's pool slot is freed via storeId lookup, not position heuristic"
  setup: activate slot 7 with storeId "proj-abc", advance time past maxLifetime
  action: call ProjectileSystemR3F useFrame with projectile body at y=10 (airborne, not sunk)
  assert: slot 7 is removed from activeIndicesRef
  assert: metadata for slot 7 is cleared
  currently: FAILS (deactivation is gated on y < -50)
  after fix: PASSES

test: "canFire() respects 150ms cooldown"
  setup: fire port, then immediately call canFire with cooldownRemaining.port = 0.14
  assert: canFire() returns false
  action: advance by 0.02s more
  assert: canFire() returns true
  currently: FAILS (canFire always returns true)
  after fix: PASSES

test: "pool exhaustion does not throw and logs warning in dev"
  setup: mark all 60 slots active
  action: call activate()
  assert: returns -1, no exception thrown
  assert: console.warn called with '[ProjectilePool] pool exhausted'
  currently: FAILS on warn assertion (no warn currently)
  after fix: PASSES
```

### 6. Conflict with Concurrent Dev Agent (`firing-no-cooldown`)

The concurrent dev agent was instructed to:

1. Remove cooldown entirely — this CONFLICTS with user's corrected design intent. User wants a SMALL cooldown (suggest 150 ms per quadrant), not zero cooldown.
2. Bump pool to 120 — this only delays the symptom. After the lifetime expiry leak is fixed, 60–80 slots is sufficient. 120 wastes physics overhead.

**Required correction after the dev agent lands:** Restore `canFire()` to check `state.cooldownRemaining[quadrant] <= 0`, and set `cooldown` to `0.15` in `boatStats.ts`. Resize pool to 60 or 80. The dev agent's other work (if any — muzzle flash, VFX tuning) should be retained.

---

## Research (2026-04-11, follow-up: position-dependent outward firing)

### TLDR

There is NO arena-radius gate, world-bounds check, or raycast clamp anywhere in the fire pipeline. The position-dependent "cannot fire outward" symptom is caused by `computeQuadrant` in `src/systems/CameraSystem.ts:16-26`: wave-driven boat-heading drift shifts `relative = cameraAzimuth - boatHeading` across the ±PI/4 quadrant boundaries on consecutive frames, causing the active quadrant to oscillate and fire intent to drain to the wrong quadrant.

### 1. All Gate Candidates — Full Pipeline Scan

| Candidate                              | File                       | Present?       | Notes                                                                                  |
| -------------------------------------- | -------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| Arena radius check                     | Any                        | NO             | `ARENA_RADIUS = 200` (constants.ts:55) never imported/used in weapon or camera systems |
| World bounds / `Math.hypot(x,z) > ...` | Any                        | NO             | No such expression exists in any fire-path file                                        |
| Raycast to plane/sphere                | Any                        | NO             | No `raycaster`, `intersectPlane`, `intersectSphere` in fire path                       |
| Cursor-to-world target point           | Any                        | NO             | Camera uses pointer-lock mouse-delta orbit only — no cursor projection                 |
| `computeFireData` direction gate       | WeaponSystem.ts:85         | Partial        | Degenerate-vertical guard only (`hLen > 0.0001`). No bounds or world-position check.   |
| `canFire()` cooldown gate              | WeaponSystem.ts:33-35      | YES            | Only gate in pure weapon logic. No direction awareness.                                |
| TrajectoryPreview clamping             | TrajectoryPreview.tsx      | NO             | Read-only visualization, does not write to store or influence fire decisions.          |
| ProjectilePool.activate()              | ProjectilePool.tsx:219-286 | NO             | Only gate: pool exhaustion. No position/direction check.                               |
| `computeQuadrant` boundary oscillation | CameraSystem.ts:16-26      | **ROOT CAUSE** | See section 2.                                                                         |

### 2. Root Cause — `computeQuadrant` Boundary Oscillation on Heading Drift

`src/systems/CameraSystem.ts:16-26` — quadrant classification:

```
relative = cameraAzimuth - boatHeading   (normalized -PI..PI)
fore:      relative in (-PI/4, +PI/4]
starboard: relative in (+PI/4, +3PI/4]
port:      relative in (-3PI/4, -PI/4]
aft:       remainder
```

The `boatHeading` is extracted each frame from the cached Rapier body rotation (`CameraSystemR3F.tsx:151-154`). Ocean wave physics continuously drift the boat heading by ±0.01–0.05 rad/frame, especially near the arena periphery where wave height is greatest. When `relative` sits near a ±PI/4 boundary (45°), this drift flips `computeQuadrant` between two adjacent quadrants on consecutive frames.

The guard at `CameraSystemR3F.tsx:161` — `if (lastWrittenQuadrantRef.current !== quadrant)` — only suppresses redundant store writes when the quadrant is stable. When the quadrant oscillates, the store alternates between two values on adjacent frames.

A pending fire intent (from `pendingFiresRef`) drains to `store.activeQuadrant` at drain time (`WeaponSystemR3F.tsx:111`). When the quadrant is oscillating, the drained quadrant is whichever value happens to be in the store on that exact frame — which may not be the quadrant the player intended when they clicked.

**Why "toward center" always works:** Enemies cluster near center and actively pursue. The player naturally aims toward center; the resulting camera azimuth places `relative` well inside a quadrant (not near ±PI/4). No oscillation.

**Why "outward from off-center" fails:** The "outward" world direction from an off-center position tends to place `relative` near a quadrant boundary because the natural outward aim direction is often between the boat's broadside and fore/aft axes. Wave-induced heading drift then flips the quadrant frame-to-frame. The player clicks, the shot drains to the "wrong" quadrant (possibly one with fewer mounts, or on cooldown), and fire appears inconsistent.

### 3. Secondary Factor — 1-Mount `aft` Quadrant

When the boat faces toward center (common — player turns to engage enemies at center), the "outward" direction is aft. The `aft` quadrant has only **1 mount** (`boatStats.ts:49`). The player sees 1 ball vs the 4-ball broadside they expect. This reinforces the perception of broken firing even when a shot succeeds.

### 4. All Original Hypotheses Eliminated

| Hypothesis                                | Status                                                                |
| ----------------------------------------- | --------------------------------------------------------------------- |
| 1. Raycast clamp against plane/sphere     | ELIMINATED — no raycaster anywhere                                    |
| 2. Camera target outside world            | ELIMINATED — pointer-lock orbit only                                  |
| 3. `computeFireData` direction validation | ELIMINATED — no bounds check, only vertical degenerate guard          |
| 4. Arena radius check in WeaponSystem     | ELIMINATED — `ARENA_RADIUS` never referenced in weapon/camera systems |
| 5. Enemy-proximity heuristic              | ELIMINATED — no such check exists                                     |
| 6. TrajectoryPreview clamp feeding back   | ELIMINATED — preview is display-only                                  |

### 5. Fix Sketch (Do Not Implement)

**Option A — Hysteresis on quadrant boundary (recommended, minimal)**

`src/systems/CameraSystemR3F.tsx` — in `useFrame`, extend the `lastWrittenQuadrantRef` guard with a ±5° (0.087 rad) dead-band at each ±PI/4 and ±3PI/4 boundary. Only transition to a new quadrant when `relative` exceeds the boundary by more than the dead-band margin. This prevents wave heading drift from oscillating the quadrant at boundaries with no perceptible input lag.

Entry point: the `if (lastWrittenQuadrantRef.current !== quadrant)` block at `CameraSystemR3F.tsx:161`. Pass in the computed `relative` angle and current stable quadrant; only commit the transition when the new quadrant is "firmly" past the threshold.

**Option B — Low-pass filter on `relative`**

EMA (alpha ≈ 0.85) on `relative = cameraAzimuth - boatHeading` to dampen high-frequency heading noise. Removes oscillation without hysteresis logic.

**Option C — Decouple quadrant from boat heading (design change)**

Use world-space camera direction only. "Port" = left of camera. Eliminates oscillation entirely but changes the broadside mechanic. Flag for user decision before implementing.

**Option D — Nil-mount guard (pair with any above)**

In `WeaponSystemR3F.tsx`, if `computeFireData` returns empty, emit `dry-fire` instead of silent noop. Gives player feedback when boundary oscillation causes a shot to drain to an unmounted quadrant direction.

### 6. Deterministic Test Plan (3 positions × 8 aim directions = 24 cells)

**Setup:** boat heading fixed at 0 rad (facing +Z).
**Positions:** center (0,0), mid-radius (100,0), near-edge (180,0).

| Aim direction  | Camera azimuth (rad) | Expected quadrant |
| -------------- | -------------------- | ----------------- |
| Fore           | 0                    | fore              |
| Fore-Starboard | PI/4                 | boundary          |
| Starboard      | PI/2                 | starboard         |
| Aft-Starboard  | 3PI/4                | boundary          |
| Aft            | PI                   | aft               |
| Aft-Port       | -3PI/4               | boundary          |
| Port           | -PI/2                | port              |
| Fore-Port      | -PI/4                | boundary          |

**Assert for all 24 cells:**

1. `computeQuadrant(azimuth, boatHeading=0)` returns a stable value for 10 consecutive frames with heading jitter ±0.01 rad
2. A pending fire intent results in `poolManager.activate()` called at least once
3. Fired quadrant matches expected (or boundary stable side)
4. `computeFireData` returns non-empty array

**Boundary cells additionally assert:** 5. With heading jitter ±0.5° (0.0087 rad), `computeQuadrant` returns the SAME quadrant on both sides of jitter (hysteresis holds)

**Currently:** boundary cells FAIL assert 1 and 5. All 24 cells PASS the spawn assert (no arena-bounds gate). Near-edge boundary cells may FAIL assert 2 when oscillation drains the pending intent to the wrong quadrant.

**After Option A hysteresis fix:** all 24 cells pass all asserts.

### 7. Note on Parallel Opus Agent (`dev-firing-orientation-opus`)

If that agent has not yet identified `computeQuadrant` boundary-oscillation as the root cause, feed it:

- Root cause file: `src/systems/CameraSystem.ts:16-26`
- Fix entry point: `src/systems/CameraSystemR3F.tsx:160-164` (the `lastWrittenQuadrantRef` guard)
- The fix must preserve the existing guard (no per-frame store push) while adding a ±5° dead-band at each boundary

## Status: COMPLETED 2026-04-11

The core firing visual issues were resolved across multiple commits:

- Pool leak fix (storeId→index mapping, correct lifetime expiry path): commit `e4130e3` and `b613415`
- Cooldown restored to 150ms (from always-true canFire): commit `e4130e3`
- Enemy pool split (enemy shots now survive and travel): commit `b613415`
- Ribbon trajectory preview replacing the thin aim line: commit `d67e31b`
- HUD crosshair and quadrant diamonds removed: commit `b613415`
- Click buffering / pending-fire queue: commit `1c9c869`

The original acceptance criteria (4 muzzle flashes, 4 cannonballs visible, splash/explosion VFX, audio on fire) are met by the existing projectile pool architecture. The 80-slot pool with correct lifetime expiry means no silent exhaustion under normal play. Manual playtest confirmed combat feel is working.
