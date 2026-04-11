# Enemy projectiles: static orange balls, no velocity

## Description

During playtest 2026-04-11 (post-wave-sync fix) the user confirmed that enemies do now fire cannons — good news — but what they fire is broken:

- The projectile appears as an orange sphere that **does not move**
- It hangs in place at the spawn position for a variable duration (sometimes longer, sometimes shorter — inconsistent)
- Then it despawns
- Never travels toward the player, never arcs under gravity, never hits anything

This is clearly a broken spawn path for enemy-owned projectiles. Player projectiles (after the prior firing fixes) appear to work, so this is specific to the enemy fire path.

## Suspects

- `WeaponSystem.computeFireData` may not compute a valid velocity for enemy mounts
- `ProjectilePool` may receive a zero linvel when an enemy fires
- Rapier body may be set as `fixed` or `kinematicPosition` instead of `dynamic` on enemy shots
- The variable lifetime suggests the projectile TTL is running normally but the physics force/velocity application is failing silently

## Acceptance Criteria

- [ ] Enemy projectiles launch with correct muzzle velocity
- [ ] Enemy projectiles arc under gravity like player projectiles
- [ ] Enemy projectiles hit the player boat and deal damage
- [ ] Enemy projectile visuals match player projectiles (emissive, trail, splash)
- [ ] Scenario test: enemy fires → projectile linvel magnitude > threshold after 1 frame
- [ ] Scenario test: enemy fires → player health decreases within N seconds

## Relevant Files

- `src/systems/WeaponSystem.ts` — pure fire data computation
- `src/systems/WeaponSystemR3F.tsx` — R3F wrapper applying velocity
- `src/entities/ProjectilePool.tsx` — pooled projectile activation
- `src/systems/AISystemR3F.tsx` — where enemies decide to fire

---

## Research (2026-04-11)

### Root Cause: All Pool Projectiles Use PLAYER_PROJECTILE Collision Group — Enemy Shots Immediately Self-Collide and Die

**Files examined:** `src/entities/ProjectilePool.tsx`, `src/systems/AISystemR3F.tsx`, `src/systems/WeaponSystem.ts`, `src/utils/boatStats.ts`, `src/utils/collisionGroups.ts`, `src/entities/EnemyBoat.tsx`

#### Finding 1 — Hardcoded PLAYER_PROJECTILE collision group on all pool slots (PRIMARY bug)

In `ProjectilePool.tsx` lines 73-76:

```js
const PLAYER_PROJECTILE_GROUPS = interactionGroups(COLLISION_GROUPS.PLAYER_PROJECTILE, [
  COLLISION_GROUPS.ENEMY,
  COLLISION_GROUPS.ENVIRONMENT,
]);
```

This constant is applied to the `BallCollider` on line 350:

```jsx
<BallCollider
  key="projectile-collider"
  args={[PROJECTILE_VISUAL_RADIUS]}
  collisionGroups={PLAYER_PROJECTILE_GROUPS} // ← always PLAYER_PROJECTILE
/>
```

Because `InstancedRigidBodies` shares one `colliderNodes` template across ALL pool slots, every projectile — whether fired by the player or an enemy — is placed in the `PLAYER_PROJECTILE` collision group (bit 2).

The enemy boat collider (`EnemyBoat.tsx` lines 48-53) has membership in group `ENEMY` (bit 1) and filters `[PLAYER, PLAYER_PROJECTILE, ENVIRONMENT, ENEMY]`. This means enemy bodies explicitly receive collisions FROM `PLAYER_PROJECTILE`. When an enemy fires, the new projectile (in group `PLAYER_PROJECTILE`) immediately intersects with the firing enemy's own CuboidCollider (in group `ENEMY`, filtering `PLAYER_PROJECTILE`), triggering a collision callback before the physics step can move the ball.

The collision handler (`ProjectilePool.tsx` lines 126-192) reads `metadata.ownerId` and compares with `targetId` via `findEnemyIdByBody`. When the target IS the firing enemy, the self-damage guard prevents damage, but `queueProjectileDeactivation(index)` is called unconditionally (line 191). The queued deactivation is drained by `ProjectileSystemR3F` at the start of the next frame, which zeros velocity, moves the body to y=-1000, and puts it to sleep.

**Result:** The enemy projectile is born, spawns at the muzzle position (visible as an orange sphere), gets collision-queued within the same physics step, and dies on the next frame. The visual "static ball that hangs briefly then despawns" is exactly this — one to two frames of existence. The "variable delay" is the non-deterministic timing between the physics step and the deactivation drain, which runs in a separate `useFrame`.

#### Finding 2 — Enemy fire path calls computeFireData correctly; velocity IS non-zero

`AISystemR3F.tsx` lines 126-133 call `computeFireData` with the enemy's cached `bodyState.rotation`. With a skiff at identity rotation `[0,0,0,1]`, port mount local direction `[-1, 0.3, 0]` and `muzzleVelocity: 25`, `elevationAngle: 0.35`, the computed impulse is approximately `[-23.5, 8.6, 0]` m/s. This is a valid non-zero velocity.

`ProjectilePool.activate()` at line 244 calls `body.setLinvel({ x: impulse[0], y: impulse[1], z: impulse[2] }, true)` — correct API, correct values. The physics body WOULD move if it survived past the collision callback.

**The velocity is correct. The ball dies before physics moves it.** That is why it appears static.

#### Finding 3 — Variable TTL confirmed: it is the frame-delay between collision and deactivation drain

`ProjectileSystemR3F.tsx` line 36-38 drains `pendingDeactivations` at the start of each `useFrame`. Rapier physics step timing relative to `useFrame` is not fixed-order — the pending queue can drain in 1 frame or 2 depending on whether physics runs before or after the deactivation drain in a given frame. This explains the "sometimes longer, sometimes shorter" disappearance time.

#### Finding 4 — Enemy projectiles never reach the player (confirmed: wrong collision group)

The collision matrix in `collisionGroups.ts` specifies:

- `EnemyProjectile` (group 3) should collide with `Player` (group 0) and `Environment` (group 4)
- `Player` (group 0) filters `[ENEMY, ENEMY_PROJECTILE, ENVIRONMENT]`

Since all pool projectiles are in `PLAYER_PROJECTILE` (group 2) instead of `ENEMY_PROJECTILE` (group 3), the player's collider never receives a collision from an enemy shot. Even if the self-collision bug were fixed and enemy balls survived, they would still pass through the player without dealing damage.

#### Finding 5 — InstancedRigidBodies colliderNodes is per-instance but shared template

`colliderNodes` in react-three-rapier creates a collider inside each rigid body instance, but the JSX template is defined once. All instances share the same `collisionGroups` value from that template. There is no per-instance collision group override available through `colliderNodes`. To have mixed collision groups in the same pool, the pool must be split (one for player projectiles, one for enemy projectiles).

#### Finding 6 — The enemy fire path uses the same poolManager as the player

`AISystemR3F.tsx` line 135: `const poolManager = getProjectilePoolManager()` — this is the single global pool from `ProjectilePool.tsx`. There is no separate enemy pool. The fix requires either (a) splitting into two pool components (player + enemy, each with correct collision group), or (b) passing a collision group override to `activate()` and rebuilding the collider per-activation (not possible with InstancedRigidBodies). Option (a) is the correct approach.

---

### Recommended Fix Sketch (for dev agent — do NOT implement here)

**The fix is a pool split, not a parameter change.**

1. **Create `EnemyProjectilePool.tsx`** — identical to `ProjectilePool.tsx` except:
   - The `BallCollider` uses `ENEMY_PROJECTILE_GROUPS = interactionGroups(COLLISION_GROUPS.ENEMY_PROJECTILE, [COLLISION_GROUPS.PLAYER, COLLISION_GROUPS.ENVIRONMENT])`
   - The ownerType passed to `setProjectileSlotMetadata` is verified to be `'enemy'`
   - Register via a separate `setEnemyProjectilePoolManager` / `getEnemyProjectilePoolManager` function in `projectilePoolRefs.ts`

2. **Update `AISystemR3F.tsx`** to call `getEnemyProjectilePoolManager()` instead of `getProjectilePoolManager()` when firing enemy shots.

3. **Keep `ProjectilePool.tsx` unchanged** — it remains the player-only pool.

4. **Add both pool components to the scene** (wherever `ProjectilePool` is currently placed in the R3F tree, add `EnemyProjectilePool` alongside it).

5. **Verify enemy self-collision is resolved**: with enemy shots in `ENEMY_PROJECTILE` group and enemy bodies filtering `[PLAYER, PLAYER_PROJECTILE, ENVIRONMENT, ENEMY]` (does NOT include `ENEMY_PROJECTILE`), the self-collision cannot happen.

6. **Optionally**: reduce enemy cooldowns (skiff: 3.0s → 1.5s, barge: 2.5s → 1.5s) so enemy fire rate is more perceptible during testing.

---

### Deterministic Test Plan

All tests below would FAIL against current code and PASS after the pool-split fix is applied.

#### Test D — Enemy muzzle velocity test (new scenario)

**File:** `tests/smoke/scenarios.spec.ts`
**Globals needed:** `window.__GET_ALL_PROJECTILE_BODY_STATES__` (already exposed), `window.__ZUSTAND_STORE__` (already exposed)
**What it proves:** Enemy projectiles are born with non-zero velocity.

```
setup: startPlaying, waitForEnemyBodies(1, 40_000)
step: read store enemies, find the first enemy id
step: via store, teleport the first enemy adjacent to the player (within preferredRange)
  - set enemy position via physicsRefs.getEnemyBody(id).setTranslation({x,y,z}, true)
step: set enemy AI state to 'broadside' in the store (weaponCooldownReady=true)
  - direct store mutation: enemies.get(id).weapons.cooldownRemaining = {port:0, starboard:0, fore:0, aft:0}
step: wait 500ms (one AI tick fires the broadside)
step: read all projectile body states
assert: at least one projectile has linvel magnitude > 10 m/s
```

**Failure on current code:** All enemy projectiles die within 1-2 frames due to self-collision. By the time the body state is read 500ms later, no projectiles from the enemy volley survive. linvel magnitude = 0 (no active slots). Test fails.

**Pass after fix:** Enemy shots survive past the physics step and show non-zero velocity. Test passes.

**Threshold:** `Math.sqrt(vx*vx + vy*vy + vz*vz) > 10` for at least one projectile slot. The expected value is approximately 23-25 m/s for a skiff.

#### Test E — Enemy projectile motion test (new scenario)

**File:** `tests/smoke/scenarios.spec.ts`
**What it proves:** Enemy projectiles physically move over time (not static).

```
setup: same as Test D, trigger one enemy volley
step: immediately read projectile positions (snapshot A)
step: wait 500ms
step: read projectile positions (snapshot B)
assert: for at least one projectile that appears in both snapshots, the XZ distance moved > muzzleVelocity * 0.5 * 0.5 (i.e., > 6m for a 25 m/s projectile over 0.5s)
```

**Failure on current code:** Enemy projectiles despawn in ≤2 frames. No slot appears in both snapshot A and snapshot B. The XZ-moved comparison has nothing to compare. Test fails (or treats missing slots as 0 distance, which is < 6m).

**Pass after fix:** Projectile survives, moves >6m in 500ms. Test passes.

**Threshold:** XZ displacement > 6m over 500ms. If the projectile has already despawned by snapshot B (moved off map), check that snapshot A had at least one non-zero-velocity entry.

#### Test F — Enemy damages player test (new scenario)

**File:** `tests/smoke/scenarios.spec.ts`
**What it proves:** Full enemy fire pipeline: fire → projectile survives → hits player → applyDamage called → player health decreases.

```
setup: startPlaying, waitForEnemyBodies(1)
step: read player health before (hull + armor)
step: teleport player to origin (0, 0.8, 0)
step: teleport first enemy to (0, 0.8, 20) — 20m behind player, broadside angle correct
step: force enemy into broadside state with cooldown=0
step: wait 3000ms (enough for projectile to travel 20m at 25 m/s = 0.8s + margin)
step: read player health after
assert: healthAfter < healthBefore  OR  player.isSinking === true
```

**Failure on current code:** Enemy projectiles die immediately (self-collision), never reach player, player health unchanged. Test fails.

**Pass after fix:** Enemy projectile survives, travels 20m, hits player, damage applied. Test passes.

**Threshold:** `healthAfter < healthBefore`. Recommended wait: 3000ms. File: `tests/smoke/scenarios.spec.ts`.

#### Supporting unit test — self-collision prevention in split pools (new unit test)

**File:** `tests/unit/projectile.test.ts`
**What it proves:** The enemy pool's collision group does NOT include ENEMY, so a freshly spawned enemy projectile cannot self-collide with the enemy body.

This is a static analysis / type check — verify that:

```js
ENEMY_PROJECTILE_GROUPS = interactionGroups(COLLISION_GROUPS.ENEMY_PROJECTILE, [
  COLLISION_GROUPS.PLAYER,
  COLLISION_GROUPS.ENVIRONMENT,
]);
// does NOT include COLLISION_GROUPS.ENEMY
```

A simple unit test can import the group constant and assert the filter bitmask does not have the ENEMY bit set. This test would have caught the bug at authoring time if it had existed.

## Status: COMPLETED 2026-04-11

Enemy projectile static bug resolved. Root cause was hardcoded `PLAYER_PROJECTILE` collision group on all pool slots, causing enemy shots to self-collide with the firing enemy's collider and die within 1-2 frames. Fixed by splitting the projectile pool into two components:

- `EnemyProjectilePool.tsx` created with `ENEMY_PROJECTILE` collision groups that exclude ENEMY bodies
- `AISystemR3F.tsx` updated to use the enemy pool manager

All landed in commit `b613415` (`feat(combat): unblock firing, split enemy pool, clean HUD`). Enemy projectiles now launch with correct velocity, arc under gravity, and reach the player.
