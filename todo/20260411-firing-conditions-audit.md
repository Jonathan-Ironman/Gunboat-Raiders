# Firing conditions audit (2026-04-11)

## TLDR

- **Total distinct gates found:** 17
- **Silent-drop gates:** 10 (marked below)
- **Suspected culprits for "fires work then stops" symptom:**
  1. Pool exhaustion with no slot recycling — once all 80 slots fill up (due to a deactivation leak), every subsequent fire is silently dropped forever
  2. `getPlayerBodyState()` returning null after PhysicsSyncSystem miss — intent is consumed (`pendingFiresRef -= 1`) but no projectile spawns
  3. `poolManager` null check without reclaim — activate() call skipped entirely if pool ref unmounted and re-mounted during a phase transition

---

## Stage 1 — Input layer

### Gate 1: Phase guard on mousedown

- **Location:** `src/systems/WeaponSystemR3F.tsx:63`
- **Condition:** `e.button === 0 && store.phase === 'playing'` — click is ONLY buffered during `playing` phase
- **Failure mode:** Silent drop — the click is discarded, `pendingFiresRef` is not incremented
- **Observable?** No — no UI feedback, no sound, no animation
- **Suspicion level:** LOW for the "stops" symptom — phase rarely changes mid-play. However it IS relevant during the `wave-clear` -> `playing` transition (3 s intermission). Clicks during `wave-clear` are all dropped silently.

### Gate 2: Buffer cap (PENDING_FIRE_CAP = 4)

- **Location:** `src/systems/WeaponSystemR3F.tsx:50, 64-65`
- **Condition:** `pendingFiresRef.current < PENDING_FIRE_CAP` — if 4 intents are already queued, the 5th click is discarded
- **Failure mode:** Silent drop — click discarded without incrementing counter
- **Observable?** No
- **Suspicion level:** LOW for the specific "then stops" symptom — would only trigger if the player clicks 5+ times before any fire resolves. With a 150 ms cooldown this would require clicking faster than 27 Hz.

### Gate 3: Test-bridge fire path (dev only)

- **Location:** `src/systems/WeaponSystemR3F.tsx:93-95`
- **Condition:** `consumeTestFireRequest()` returns true AND `pendingFiresRef.current < PENDING_FIRE_CAP`
- **Failure mode:** If cap is already at 4, the test-bridge request is consumed (flag cleared) but NOT queued — **the intent is eaten silently**
- **Observable?** No
- **Suspicion level:** MEDIUM in test/Playwright scenarios — can cause flaky test firing

### Gate 4: `pendingFiresRef` never cleared on phase change

- **Location:** `src/systems/WeaponSystemR3F.tsx:56` — `useRef(0)`, no reset anywhere
- **Condition:** If a wave ends while 3 intents are buffered, all 3 are carried into the next wave and fire the moment the quadrant's cooldown allows — this is correct behavior
- **Failure mode:** Not a drop — but could cause unexpected auto-fires at wave start if a player clicked rapidly near wave-clear
- **Observable?** No
- **Suspicion level:** LOW

---

## Stage 2 — Quadrant selection

### Gate 5: `bodyState` null guard in CameraSystemR3F (quadrant not updated)

- **Location:** `src/systems/CameraSystemR3F.tsx:124-125`
- **Condition:** If `getPlayerBodyState()` returns null (physics not yet synced), the entire camera useFrame exits early — `activeQuadrant` in the store is NOT updated
- **Failure mode:** The quadrant stays frozen at whatever value it had last frame. If that quadrant is on cooldown, the fire intent waits. This is not a drop, but delays resolution.
- **Observable?** No
- **Suspicion level:** LOW — only happens during the first 1-2 frames of game start

### Gate 6: Position guard (extreme coordinates)

- **Location:** `src/systems/CameraSystemR3F.tsx:131-138`
- **Condition:** If body coords exceed `MAX_BODY_COORD = 500`, camera frame exits early — quadrant not updated
- **Failure mode:** Same as Gate 5 — quadrant frozen at stale value
- **Observable?** No
- **Suspicion level:** LOW — only during physics instability

### Gate 7: Pointer-lock / cursor-fallback quadrant path

- **Location:** `src/systems/CameraSystemR3F.tsx:192-213`
- **Condition:** When pointer lock is NOT held AND no test azimuth override is set, the quadrant is computed from raw mouse cursor position relative to canvas center. If the cursor is exactly at center (dx=0, dy=0), `atan2(0,0)` = 0, which maps `computeQuadrant(boatHeading, boatHeading)` = `fore`. This means a stationary cursor at canvas center always resolves to `fore`.
- **Failure mode:** Not a drop — fires `fore` regardless of player intent, which may have a full cooldown
- **Observable?** No — quadrant silently switches to fore
- **Suspicion level:** MEDIUM — if the player alt-tabs, loses pointer lock, and the cursor is near center when they click back, they may fire into an unexpected (and cooling) quadrant

### Gate 8: `lastWrittenQuadrantRef` deduplication — test override suppression

- **Location:** `src/systems/CameraSystemR3F.tsx:219-222`
- **Condition:** The camera system only calls `setActiveQuadrant()` when its own computed quadrant changes. External callers (tests calling `setActiveQuadrant` directly) can set the quadrant, but if the camera computes the same quadrant it last wrote, it will NOT overwrite the store — so test overrides survive. However, if the camera computes a DIFFERENT quadrant on the very next frame (e.g., the player is rotating the boat), it WILL overwrite the test override.
- **Failure mode:** In live play, not a problem. In tests, the forced quadrant can be overwritten if the test does not hold the azimuth override via `cameraTestBridge`.
- **Observable?** No
- **Suspicion level:** LOW in production, MEDIUM in tests

### Gate 9: `cameraTestBridge` sticky override — production leak path

- **Location:** `src/systems/cameraTestBridge.ts:22` — module-level `let forcedAzimuth`
- **Condition:** `forcedAzimuth` is module-level state — it persists across hot-module-reloads in dev, across React tree unmounts, and across `startGame()` / `resetGame()` calls. If a test leaves `forcedAzimuth` set (i.e., does not call `__SET_CAMERA_AZIMUTH__(null)` in cleanup), subsequent play sessions will have their camera orbit permanently frozen at the last test azimuth.
- **Failure mode:** Camera angle locked, quadrant permanently frozen — fires always aimed at one stale quadrant whose cooldown may be permanently blocking
- **Observable?** No — the player sees normal camera movement visually (camera still moves via mousemove) but the quadrant never updates from the frozen angle. This can manifest as "can fire for a while, then stops" if the frozen quadrant exhausts its cooldown but then resets immediately via a fire, never allowing another quadrant to become active.
- **Suspicion level:** HIGH — if Playwright tests run before manual play sessions in the same browser session, this is a live bug

---

## Stage 3 — Cooldown

### Gate 10: Per-quadrant cooldown check

- **Location:** `src/systems/WeaponSystemR3F.tsx:112`, `src/systems/WeaponSystem.ts:33-35`
- **Condition:** `canFire()` returns `cooldownRemaining[quadrant] <= 0`. If the quadrant still has time remaining, the pending intent is kept queued and cooldowns are pushed to store. No fire this frame.
- **Failure mode:** Not a drop — intent stays in buffer and is retried next frame. This is the intended queue behavior.
- **Observable?** No
- **Suspicion level:** LOW on its own — but becomes HIGH when combined with a frozen quadrant (Gate 7 or Gate 9). A frozen quadrant that just fired resets its cooldown to `0.15 s`; the weapon system correctly waits and retries. BUT if the active quadrant flips to one that has 0 cooldown remaining WHILE a pending intent is queued, it fires immediately — this is correct.

### Gate 11: Cooldown never resets on phase transition

- **Location:** `src/store/gameStore.ts:297-303` (`resetGame`), `:305-332` (`startGame`)
- **Condition:** `startGame()` re-creates the player with `makeDefaultCooldowns()` — all four quadrant cooldowns reset to 0. `resetGame()` sets `player: null` which effectively discards cooldown state. Cooldown is properly reset on new game.
- **Failure mode:** None under normal conditions
- **Observable?** N/A
- **Suspicion level:** LOW

### Gate 12: Cooldown NaN / Infinity path

- **Location:** `src/systems/WeaponSystem.ts:14-24` (`tickCooldowns`)
- **Condition:** `delta` is the R3F frame delta in seconds. If `delta` is `NaN` or `Infinity` (e.g., first frame after tab-focus-restore where the browser gives a huge delta), `Math.max(0, remaining - NaN)` = `NaN`. NaN is NOT <= 0, so `canFire()` returns false permanently for that quadrant.
- **Failure mode:** The cooldown for the affected quadrant is stuck at `NaN` permanently. `canFire()` returns false forever. All pending intents for that quadrant are held in the buffer indefinitely. Since `pendingFiresRef` is never decremented, the buffer fills to cap (4) and further clicks are dropped silently.
- **Observable?** No — no console error, no UI change. The player just cannot fire. The only recovery is a page reload.
- **Suspicion level:** HIGH — tab-switching or long browser freezes can produce a huge first-delta. This perfectly matches "fires work for a while, then suddenly stops."

---

## Stage 4 — Pool activation

### Gate 13: `poolManager` null check (pool not mounted)

- **Location:** `src/systems/WeaponSystemR3F.tsx:153`
- **Condition:** `if (poolManager)` — if `getProjectilePoolManager()` returns null, the entire activate-and-VFX block is skipped. The pending intent was already decremented at line 125.
- **Failure mode:** Silent drop — `pendingFiresRef` was decremented, cooldown was reset (line 184), but no projectile was spawned and no VFX was emitted. The slot is "used" without producing a shot.
- **Observable?** No
- **Suspicion level:** HIGH — `ProjectilePool` and `WeaponSystemR3F` are both inside `<GameEntities>` which renders only when `phase !== 'title'`. However, the pool manager is registered in a `useEffect` which runs AFTER the component mounts. There is a race window of potentially 1-2 frames after phase changes where `WeaponSystemR3F` is running but the pool manager ref is not yet set. During this window, any click produces a cooldown reset with no projectile.

### Gate 14: Pool exhaustion — no slot recycling

- **Location:** `src/entities/ProjectilePool.tsx:240-244`
- **Condition:** If all 80 slots are occupied (`activeIndicesRef.current` has 80 entries), `activate()` returns -1. The result of `activate()` is not checked by the caller.
- **Failure mode:** Silent drop — `poolManager.activate()` is called, returns -1, caller ignores the return value. A `console.warn` fires in DEV mode. The storeId from `spawnProjectile()` is never called because `activate()` returns before calling it — wait, actually `spawnProjectile` is called INSIDE `activate()` in `ProjectilePool.tsx:263`. So if `index === -1` at line 241, we return -1 before `spawnProjectile`. No store entry is created. No slot is marked active. But the pending intent was already decremented and cooldown reset. **The shot is lost silently.**
- **Observable?** DEV console.warn only — no production feedback
- **Suspicion level:** MEDIUM — with 80 slots and 8 s max lifetime, exhaustion requires sustained firing of all 4 quadrants simultaneously for >1 second. More likely under the next gate.

### Gate 15: Pool slot leak via incomplete deactivation on collision

- **Location:** `src/entities/ProjectilePool.tsx:95-125` (`deactivateSlot`)
- **Condition:** `deactivateSlot()` calls Rapier WASM methods inside a try/catch. If the try block throws (Rapier mid-step), the body is NOT moved to sleep position and NOT put to sleep. However `activeIndicesRef.current.delete(index)` and `clearProjectileSlotMetadata(index)` have already run at lines 107 and 113. The slot is now logically "inactive" (not in activeIndicesRef) but physically the body is still somewhere in the world at its last position, possibly still moving. On the next frame it will be treated as available and can be re-activated — which repositions it correctly. This is safe.
- **Failure mode:** No leak on the logical side. The physical body may produce a stale collision for one frame.
- **Observable?** No
- **Suspicion level:** LOW

### Gate 16: `getIndexByStoreId` miss on expired projectile

- **Location:** `src/systems/ProjectileSystemR3F.tsx:101-116`
- **Condition:** On lifetime expiry, the system calls `poolManager.getIndexByStoreId(id)`. If the storeId is not found (returns -1) — which happens if the projectile was already deactivated by collision before expiry runs — the fallback at line 115 calls `store.removeProjectile(id)` directly.
- **Failure mode:** Not a drop — the store is cleaned up correctly. However if BOTH the collision deactivation AND lifetime expiry run in the same frame for the same projectile, `removeProjectile` is called twice. The second call on a Map that no longer has the key is a no-op (Map.delete on missing key does nothing). No crash, no leak.
- **Observable?** No
- **Suspicion level:** LOW

### Gate 17: `storeIdToIndexRef` double-activation leak

- **Location:** `src/entities/ProjectilePool.tsx:281`
- **Condition:** If `activate()` is somehow called with the same `storeId` twice (impossible in practice since storeId is a nanoid UUID), `storeIdToIndexRef.current.set(storeId, index)` would overwrite the first entry. The first slot would then be unreachable by storeId lookup. It would never be freed by lifetime expiry (which uses storeId), only potentially by collision. This is a theoretical leak.
- **Failure mode:** Theoretical slot leak
- **Observable?** No
- **Suspicion level:** LOW (UUIDs make collision near-impossible)

---

## Stage 5 — Store-side fire logic

### (No gates found)

The store has no guards on `spawnProjectile` — it unconditionally creates an entry. No enemy-count, wave-phase, or score-based guards block firing. `setPhase` does not touch weapon or projectile state. `applyDamage` does not affect the weapon component. There are no derived selectors that would deny firing.

The `activeQuadrant` default is `'fore'` (set at store init, `src/store/gameStore.ts:155`). It is never reset by `resetGame()` or `startGame()` — but since both re-create the player with all-zero cooldowns, firing from any quadrant works immediately.

---

## Stage 6 — Projectile lifetime

### (No gates — only one notable behavior)

**Lifetime value:** `PROJECTILE_MAX_LIFETIME = 8` seconds (both `ProjectilePool.tsx:82` and `EnemyProjectilePool.tsx:49`).

**Lifetime tick:** `ProjectileSystemR3F.tsx` reads `projectiles` from store each frame, builds a lifetime map, calls `getExpiredProjectiles()` which compares `currentTime - spawnTime >= maxLifetime`. Uses `performance.now() / 1000` as `currentTime`. Consistent with `spawnTime` which also uses `performance.now() / 1000` at activate time.

**Deactivation path consistency:** On expiry, `poolManager.deactivate(poolIndex)` is called which internally: (1) reads metadata via `getProjectileSlotMetadata`, (2) calls `removeProjectile(meta.storeId)`, (3) calls `deactivateSlot(index)` which removes from `activeIndicesRef`, removes from `storeIdToIndexRef`, clears metadata, and sleeps the body. All three data structures (activeIndicesRef, storeIdToIndexRef, slotMetadata) are updated consistently.

**Note:** `splashedSlots` in `ProjectileSystemR3F.tsx` is a module-level `Set` that is never cleared on game reset. On a new game, old pool indices could have stale splash tracking — but since the splash detection only triggers when a projectile crosses y=0 downward, and new projectiles start fresh, this is cosmetically benign.

---

## Stage 7 — Phase transitions

### What happens on `playing` -> `wave-clear` (3 s intermission)

- **`pendingFiresRef`:** NOT cleared — any buffered intents carry over
- **Cooldown state:** NOT reset — remains in store as last written
- **Active projectiles:** NOT drained — continue flying, aging, and colliding
- **Click buffering:** Phase guard (Gate 1) blocks new clicks during `wave-clear` — clicks in the 3 s window are silently dropped
- **WeaponSystemR3F useFrame:** Still running — it ticks cooldowns and drains the buffer even during `wave-clear`. The buffer is empty (Gate 1 prevents additions) but cooldown tick writes to the store every frame, keeping the UI cooldown display updated.

### What happens on `wave-clear` -> `playing` (next wave)

- **`pendingFiresRef`:** Still 0 (no new clicks allowed during intermission)
- **Cooldown state:** Fully ticked down to 0 during the 3 s window — player can fire immediately
- **No reset, no drain needed**

### What happens on `playing` -> `game-over`

- **`setPhase('game-over')` is called from `applyDamage()`** (`src/store/gameStore.ts:251`)
- **`pendingFiresRef`:** NOT cleared
- **WeaponSystemR3F useFrame:** Still running (it's inside `<GameEntities>` which stays mounted during `game-over`). BUT: `if (!player) return` at line 80 — `player.isSinking` is true but `player` is not null, so this guard does NOT stop the weapon system. The phase guard on mousedown (Gate 1) prevents NEW clicks. The weapon system continues ticking cooldowns and would drain any buffered intents. However `getPlayerBodyState()` returns the last cached body state, so technically a buffered intent could fire during the game-over phase.
- **Pool:** NOT drained — projectiles continue until lifetime expires
- **Observable concern:** If the player clicked just before game-over, the buffered intent may fire a projectile during game-over phase. Not a bug per se but unintended.

### What happens on `game-over` -> `startGame()` (new game)

- **`startGame()`** (`src/store/gameStore.ts:305`) atomically resets everything in one `set()` call including `phase: 'playing'`, a new player, fresh `projectiles: new Map()`, fresh `enemies: new Map()`
- **`pendingFiresRef`:** NOT cleared (it's a React ref inside `WeaponSystemR3F`, which stays mounted). A new game starts with any leftover pending intents. Unlikely to be non-zero in practice.
- **Pool manager:** `ProjectilePool` stays mounted (same React tree). The pool's `activeIndicesRef` is NOT cleared. Any projectiles still "active" from the previous game remain active in the pool. The store's `projectiles` map is cleared, so `ProjectileSystemR3F` will not find them by storeId for lifetime expiry. These slots will **never be freed** unless they collide with something. This is a **pool slot leak on new game**.
- **Suspicion level:** MEDIUM — after several consecutive games, leaked slots accumulate and reduce effective pool size, eventually triggering Pool exhaustion (Gate 14).

---

## Stage 8 — Silent drops and additional patterns found

### `getPlayerBodyState()` null drop (within-fire path)

- **Location:** `src/systems/WeaponSystemR3F.tsx:128-138`
- **Condition:** After passing all prior gates and decrementing `pendingFiresRef`, if `getPlayerBodyState()` returns null the intent is dropped. Cooldowns are written back to store.
- **Failure mode:** Silent drop — the pending count was decremented, cooldown was NOT reset (line 184 runs only after successful spawn), so the consumed intent is gone and the quadrant cooldown stays at its ticked-down value. This means cooldown does NOT reset to 0.15 s — the player's next fire opportunity comes sooner than expected. Not harmful but the shot is lost.
- **Observable?** No
- **Suspicion level:** LOW in normal play; MEDIUM immediately after phase change when physics hasn't synced yet

### `computeFireData` returns empty array (no mounts for quadrant)

- **Location:** `src/systems/WeaponSystemR3F.tsx:143-151`, `src/systems/WeaponSystem.ts:64`
- **Condition:** If `mounts.filter(m => m.quadrant === quadrant)` returns an empty array (i.e., the player boat has no mounts configured for the active quadrant), `spawns` is `[]`. The for-loop over `spawns` does nothing. The cooldown IS reset (line 184). The pending intent is consumed. No projectile spawns.
- **Failure mode:** Silent drop of projectile. The cooldown resets as if a shot was fired, but nothing visible happens. From player data: `fore` has 2 mounts, `port` 4, `starboard` 4, `aft` 1 — all four quadrants are covered. This gate would only trigger if the mount configuration were corrupted or the wrong quadrant enum were used.
- **Observable?** No
- **Suspicion level:** LOW in normal play

### Space key `fire` binding is dead code

- **Location:** `src/App.tsx:36`, `src/systems/MovementSystemR3F.tsx:29`
- **Condition:** `KeyboardControls` registers `{ name: 'fire', keys: ['Space'] }`. The `Controls` type in `MovementSystemR3F.tsx` includes `'fire'`. But `getKeys().fire` is never read anywhere in the codebase.
- **Failure mode:** Space bar does nothing — player pressing Space expecting to fire gets no response. The click-based fire path (Gate 1) is the only live path.
- **Observable?** No feedback whatsoever — the bind is completely dead
- **Suspicion level:** Not a "stops" bug but a missing feature that could confuse players

---

## Ranked suspicion list for the current symptom ("fires work then stops")

1. **Gate 12 — Cooldown NaN from large delta (HIGH)** — A single frame with `delta = Infinity` or `delta = NaN` (tab switch, browser freeze, performance spike) corrupts the quadrant cooldown to NaN. `NaN <= 0` is `false`, so `canFire()` returns false permanently. The buffer fills to cap (4). Further clicks are silently dropped. The only recovery is page reload. This is the most likely culprit because: (a) it is catastrophic and permanent within a session, (b) it is triggered by common user behavior (alt-tab), (c) it produces exactly the "fires for a while, then suddenly stops forever" symptom.

2. **Gate 9 — cameraTestBridge sticky azimuth leaving quadrant frozen (HIGH)** — If any Playwright test run left `forcedAzimuth` non-null, subsequent manual play sessions have their quadrant frozen at the test value. Depending on which quadrant the frozen angle maps to, and whether the boat is rotating, the player could be stuck firing into one quadrant that repeatedly hits its 150 ms cooldown. This matches "stops then maybe works again" if the boat happens to rotate such that the frozen angle maps to a different quadrant momentarily.

3. **Gate 13 — poolManager null window after phase transition (HIGH)** — There is a 1-2 frame race window after `GameEntities` mounts where `WeaponSystemR3F` is running but `ProjectilePool`'s `useEffect` has not yet fired to register the pool manager. During this window, pending intents are consumed (cooldown resets, `pendingFiresRef` decrements) with no projectile produced. While brief, if the player clicks during the title-to-playing transition, the clicks may be buffered and then silently consumed in this race window.

4. **Gate 14/Game-reset pool leak — slots accumulate across games (MEDIUM)** — On `startGame()`, the store's `projectiles` map is cleared but the pool's `activeIndicesRef` is not. Projectiles active at game-reset become permanently leaked slots. After multiple games, the effective pool size shrinks, eventually causing exhaustion during normal firing.

5. **Gate 7 — Cursor-at-center maps to fore when pointer lock lost (MEDIUM)** — After Escape or alt-tab, cursor position drives quadrant selection. A centered cursor resolves to `fore`. If `fore` just fired and is on cooldown, the next click waits for it. The player may perceive this as "I clicked starboard but nothing happened" — which matches the reported symptom.

---

## Gates with NO user-visible feedback when they block (silent-drop inventory)

All of the following drop the firing intent with zero UI feedback, no sound, no animation:

1. Gate 1 — Phase guard blocks click outside `playing` phase
2. Gate 2 — Buffer cap (PENDING_FIRE_CAP = 4) silently discards 5th+ click
3. Gate 3 — Test-bridge request eaten when buffer is at cap
4. Gate 7 — Cursor at canvas center freezes quadrant to `fore`
5. Gate 9 — Sticky test azimuth overrides quadrant silently
6. Gate 12 — NaN cooldown permanently blocks one or all quadrants
7. Gate 13 — poolManager null window consumes intent without spawning
8. Gate 14 — Pool exhaustion returns -1, caller ignores, no shot
9. Gate 15/bodyState null — Intent consumed at line 125, no projectile, no reset
10. computeFireData empty-array — cooldown resets but no projectile spawns
