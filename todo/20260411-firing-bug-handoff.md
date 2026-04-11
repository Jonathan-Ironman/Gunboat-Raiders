# Firing bug — handoff for next session

**Priority: BLOCKER.** Combat feel is broken. Multiple attempts have failed. This is where the next session starts.

## The user's exact observation (literal, use as the test scenario)

Jonathan has repeated this multiple times, with increasing clarity. The bug description in his own words (translated from Dutch, paraphrased for clarity):

1. **Refresh and start** — everything works. Can aim and fire in all four quadrants (fore / aft / port / starboard).
2. **Sail straight forward** (press W) a short distance. No active steering input.
3. **Aim line at the front visually disappears.**
4. **Cannot fire forward anymore.** Firing in the forward quadrant produces nothing.
5. **Rotating the boat on its own axis does not restore it.** Even after a full spin, the aim lines only appear pointing **toward the center of the map** (world origin), never in the direction away from center.
6. Reproduction is 100% reliable. Happens every single time Jonathan sails forward more than a few seconds.
7. **Near the start point, all four quadrants work.** The further you move from origin, the more restricted the aim line direction becomes — and it always points back toward origin.

Additional clues Jonathan surfaced during debugging:

- **Before pointer lock is acquired**, when the cursor is still free and visible on the canvas, moving the cursor around the boat already produces aim lines in the direction of the cursor. That suggests **two different cursor / quadrant selection code paths exist**: one for the free-cursor state (before "click to aim") and one for pointer-locked play. Jonathan's strong suspicion is that these two paths compute the active quadrant differently, and at least one of them has a stale or wrong reference point.
- **The aim line literally disappears visually.** This is not a silent denial (where you click and nothing fires but the aim line stays). The trajectory preview component stops rendering for the quadrant that can no longer fire. That means `activeQuadrant` is actually switching to something else, and the fire is hitting that other mount.
- **It is not about nearby objects.** Rocks, enemies, etc. have no effect. It is purely about the player boat's world position relative to the map origin.

## What this is NOT (rule these out — multiple agents have wasted time on them)

- ❌ **Not cooldown or silent click denial.** Cooldown is already set to 0.15s and Opus fixed the click-buffer eating. The aim line _visibly disappears_ — that is not a cooldown symptom.
- ❌ **Not pool exhaustion or disposal leak.** A prior pass fixed a real leak in `ProjectileSystemR3F.tsx`'s lifetime expiry path (was using y-position heuristic instead of pool index). That leak was real but is not this bug.
- ❌ **Not port/starboard swap.** A prior agent flipped the `cameraAngle` formula from `atan2(-sin(az), -cos(az))` to `PI - az`. Jonathan confirmed it was correct before the flip. The flip was reverted.
- ❌ **Not a quadrant-boundary oscillation.** A research agent hypothesized that wave-driven boat heading drift was flipping the quadrant across the ±π/4 boundary. That hypothesis is wrong: Jonathan can aim solidly in one direction, no oscillation, and still the aim line is missing.
- ❌ **Not heading-dependent (chase-cam theory).** Opus theorized that involuntary yaw from wave torque was making the world-azimuth-based camera drift out of sync with boat heading. Opus implemented a "chase-cam" fix (`worldAzimuth = azimuth + boatHeading`) in `CameraSystemR3F.tsx` that passed 45/45 smoke tests. **Jonathan retested after this fix — the bug is exactly unchanged.** The tests did not reproduce what he sees.
- ❌ **Not arena bounds or map edge check.** There is no arena-bounds gate in the fire pipeline (research confirmed).
- ❌ **Not NaN cooldown from a bad delta frame.** This was listed as top suspect in a `firing-conditions-audit.md` document but was never actually verified against Jonathan's symptom; his aim line _disappearing_ rules it out.

## Leading hypothesis (unconfirmed, start here in the next session)

**The mouse → world raycast hits a plane that is anchored to world origin, not to the boat.** As the boat moves away from origin, the raycast hit point stays near origin. The vector from boat-to-hitpoint is then always roughly "toward origin", and the quadrant selector computes that as whatever quadrant points toward the center of the map.

This matches every observation:

- Near origin: hit point is near boat, all quadrants reachable
- Far from origin: hit point is stuck near origin, only the quadrant pointing toward origin lights up
- Rotating the boat: hit point is still near origin, still the same world direction, still the same quadrant relative to world — but boat-relative quadrant appears to rotate with the boat, so the "toward-origin" quadrant label changes as the boat spins
- Cursor-free-play mode also has the bug because the same raycast/plane is used

**Candidates for the stale reference point:**

- A `Vector3(0, 0, 0)` hard-coded as a target somewhere in `CameraSystemR3F.tsx` or `CameraSystem.ts`
- A `raycaster.setFromCamera` hit against a plane at world Y=0 with no offset to follow the boat
- A `target` ref that was initialized to the initial boat spawn position and never updated
- A `lookAt()` target on the camera or a helper that points at origin
- Any computation that uses `new Vector3()` (implicitly zero) as a default

**The simplest verification**: dev global the current `targetWorldPoint` used in the mouse → quadrant calculation, sail forward in Playwright, assert the target stays near origin. If it does, that's the bug.

## How to approach this next session (process rules — follow strictly)

1. **Do NOT start by writing code.** Do not dispatch an execution agent yet.
2. **First write a Playwright scenario test that reproduces EXACTLY Jonathan's steps:**
   - Start game, wait for playing phase
   - Press W for ~3 seconds (actual key press, not a dev teleport)
   - Move the cursor (or test-bridge the azimuth) so the camera is facing forward, in multiple ways to make sure _some_ method works
   - Read `__ACTIVE_QUADRANT__` — expected `'fore'`
   - Read `__AIM_LINE_VISIBLE_QUADRANTS__` (add this dev global if it does not exist — the trajectory preview must expose which quadrant arcs are currently being rendered)
   - Click to fire; assert a projectile spawns in the fore direction
   - The test must FAIL on the current code. If it passes, the reproduction is wrong and the test must be made stricter until it captures what Jonathan is seeing. **Do not proceed until the test fails.**
3. **Once the test reliably fails, investigate the root cause** by reading the code paths involved:
   - `src/systems/CameraSystemR3F.tsx` — both the pointer-lock useFrame path and the cursor-fallback mousemove path
   - `src/systems/CameraSystem.ts` — pure math helpers
   - `src/effects/TrajectoryPreview.tsx` — how it decides whether to render an arc for a given quadrant
   - `src/systems/cameraTestBridge.ts` (new, from Opus) — may introduce sticky state that confuses non-test play
   - `src/systems/WeaponSystemR3F.tsx` — reads `activeQuadrant` on fire
   - `src/utils/boatStats.ts` — mount local positions (probably fine, rule out)
   - `src/main.tsx` — dev globals exposed
   - `src/entities/PlayerBoat.tsx` — where the boat body and mesh are
4. **Fix, re-run the test, loop until green.** Only then run the broader smoke suite. Only then ask Jonathan to verify visually.
5. **No "academic theories".** Every hypothesis must be backed by the reproduction test either confirming or disproving it. Jonathan explicitly said: stop chasing hypotheses that don't match what he describes.

## Relevant files to look at

- `src/systems/CameraSystemR3F.tsx` — **primary suspect**, heavily modified by recent agents including an in-flight chase-cam rework that did not fix the bug
- `src/systems/CameraSystem.ts`
- `src/systems/cameraTestBridge.ts` (NEW, added by Opus — test hook that may be contributing to confusion)
- `src/effects/TrajectoryPreview.tsx`
- `src/systems/WeaponSystem.ts`
- `src/systems/WeaponSystemR3F.tsx`
- `src/entities/ProjectilePool.tsx`
- `src/entities/EnemyProjectilePool.tsx`
- `src/entities/PlayerBoat.tsx`
- `src/utils/boatStats.ts`
- `src/main.tsx` (dev globals)
- `todo/20260410-firing-visual-feedback.md` — extensive research history, several "## Research" sections
- `todo/20260411-firing-conditions-audit.md` — 17-gate audit (useful reference, but several top suspects turned out to be wrong)

## Pending code changes at handoff time

At the moment this todo was written, these files are uncommitted in the working tree:

- `src/entities/EnemyProjectilePool.tsx`
- `src/entities/ProjectilePool.tsx`
- `src/main.tsx`
- `src/systems/CameraSystemR3F.tsx`
- `src/systems/ProjectileSystemR3F.tsx`
- `src/systems/WeaponSystem.ts`
- `src/systems/WeaponSystemR3F.tsx`
- `src/systems/projectilePoolRefs.ts`
- `src/systems/cameraTestBridge.ts` (new)
- `src/utils/boatStats.ts`
- `tests/unit/projectile.test.ts`
- `tests/unit/weapon.test.ts`
- `tests/smoke/firing-orientation.spec.ts` (new)
- `tests/smoke/firing-position-drift.spec.ts` (new)

**These changes include several real improvements** from earlier in the session — pool leak fix, pool split for player/enemy, click buffering, shorter cooldown, pointer-lock-independent firing — that probably are worth keeping. But they also include the Opus chase-cam rework that did NOT fix the bug and may be adding complexity. The next session should:

1. First run the reproduction test against this pending code
2. If the bug reproduces: keep the pending changes as the starting point and add the real fix on top
3. If somehow the pending code already fixes it (unlikely — Jonathan retested): commit and move on
4. If the pending code makes things worse: selectively revert the Opus chase-cam changes while keeping the earlier leak fix and cooldown restoration

## How Jonathan feels right now

Frustrated. He has said multiple times: "Ik voel me een beetje een broken record." Multiple agents have chased wrong theories while he has clearly and repeatedly described the exact same symptom. He wants:

- Less academic theorizing
- More test-driven scenario reproduction of what he **actually** sees
- Agents that respect his observations and stop reinterpreting them into different bugs

## Status: COMPLETED 2026-04-11

The firing bug was resolved in commit `b613415` (`feat(combat): unblock firing, split enemy pool, clean HUD`). Root causes addressed:

- **Pointer-lock gate removed from WeaponSystem** — replaced with a phase check; clicks no longer dropped silently after Escape/alt-tab
- **CameraSystem pointer-lock gate dropped from azimuth** — mouse-position fallback keeps `activeQuadrant` fresh regardless of lock state; this fixed "aim lines disappear" and "only fires toward center"
- **Enemy pool split** — `EnemyProjectilePool.tsx` created with correct `ENEMY_PROJECTILE` collision groups (separate issue but fixed together)

The Playwright smoke tests added as part of the investigation (`firing-orientation.spec.ts`, `firing-position-drift.spec.ts`) remain in the codebase as regression guards (commit `7190794`).
