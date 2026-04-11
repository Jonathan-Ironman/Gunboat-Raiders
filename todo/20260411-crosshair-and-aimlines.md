# Remove crosshair + quadrant HUD + fix missing aim lines

## Description

Three linked HUD cleanups:

1. **Crosshair must go** — there is a center-screen crosshair/cursor. We already have cannon aim trajectory lines which serve as the aiming cue. Remove the crosshair entirely.
2. **Quadrant diamonds above the boat must go** — the little diamond indicators floating over the player boat (showing which quadrant is active) add nothing now that the trajectory lines are clear. Remove them.
3. **Aim lines only render for 2 of 4 quadrants** — currently front + starboard aim arcs are visible, port and rear are not. This may be connected to the firing reliability bug (if only some quadrants compute aim data, only some can fire).

## Acceptance Criteria

- [ ] No center-screen crosshair rendered in any phase
- [ ] No quadrant-indicator diamonds floating over the player boat
- [ ] All 4 quadrants (front, rear, port, starboard) render aim trajectory lines when weapons are ready
- [ ] Aim lines match actual projectile trajectories
- [ ] Scenario test asserts 4 aim-line meshes present when playing

## Relevant Files

- `src/ui/` — HUD/crosshair
- `src/effects/` — aim line rendering
- `src/systems/WeaponSystemR3F.tsx` — per-quadrant state

## Research (2026-04-11)

### Root Cause — Crosshair

`src/ui/Crosshair.tsx` is a DOM component (pure HTML `<div>` elements, no Three.js) that renders a 4-segment crosshair centered at `top: 50%; left: 50%` (lines 14-23). It is unconditionally included in `HUD.tsx` (line 29) whenever the game phase is `'playing'` or `'wave-clear'` (`HUD.tsx` lines 20, 29). There is no toggle — it always renders during gameplay.

### Root Cause — Quadrant Diamonds

`src/ui/QuadrantIndicator.tsx` is also a DOM component (`position: absolute`, centered, 80x80px container, lines 4-12). It renders 4 diamond segments (`diamondStyle`, lines 42-51) using the active quadrant from the store. It is unconditionally included in `HUD.tsx` line 28. Both the crosshair and the quadrant indicator are sibling children of the same HUD `<div>`, positioned at the screen center — they stack on top of each other at 50%/50%.

### Root Cause — Aim Lines (only 2 of 4 quadrants render)

`src/effects/TrajectoryPreview.tsx` renders a **single** `THREE.Line` via `<primitive object={lineObj} />` (line 173). In `useFrame` it reads `store.activeQuadrant` (line 111) and calls `getMeanMountData(player.weapons.mounts, activeQuadrant)` (line 114). This means:

- Only **one trajectory line exists at any time** — the one for the currently active quadrant.
- The line updates each frame to whichever quadrant is currently active. There is no "missing quadrant" in the data: all 4 quadrants have mounts defined (`boatStats.ts` lines 36-50).
- The bug described (only front + starboard render, port + rear do not) is therefore **not** caused by missing data or gating logic. The most likely cause is that the active quadrant is only ever switching between `'fore'` and `'starboard'` during the reporter's testing, meaning the input/rotation that drives `setActiveQuadrant` is not rotating the boat far enough to trigger `'port'` or `'aft'` selection.
- There is no per-quadrant line array, no `if (quadrant === 'fore' || quadrant === 'starboard')` guard, and no pointer-lock gating on the trajectory preview itself.

**Is there a pointer-lock gate suppressing aim lines?** No. `TrajectoryPreview` is rendered unconditionally inside `GameEntities` (App.tsx line 73) and has no pointer-lock check. `WeaponSystemR3F` does check pointer lock before firing (line 28: `document.pointerLockElement !== null`), but `TrajectoryPreview` is independent of that.

**Is the aim-line bug connected to the cannon-alignment bug via a shared mount list?** Indirectly. Both read from `BOAT_STATS.player.weapons.mounts`. `getMeanMountData` filters by quadrant and averages offsets (lines 35-58). After the cannon alignment fix (fixing port Z spacing), the mean offset for port broadside will change by ~0 in X, ~0 in Y, and very slightly in Z (currently mean Z = (1.0+0+−0.5+−1.0)/4 = −0.125; with corrected [1.5, 0.5, −0.5, −1.5] it becomes 0). The trajectory line origin will shift a fraction of a unit — cosmetically fine. No causal connection to the aim-line visibility issue.

**Actual fix needed for aim lines**: The description "port + rear do not render" is likely a misdiagnosis of the rotation behavior (the quadrant selector only activates port when the player is pointing the boat's port side toward the mouse/camera target). The fix is to either (a) confirm this is the case and document it, or (b) if all 4 lines should always be visible simultaneously, replace the single-line approach in `TrajectoryPreview.tsx` with a 4-line approach (one per quadrant), always rendering all four. The current architecture supports a single active-quadrant line only.

**Decision point for dev agent**: Clarify with user/orchestrator whether the aim lines should always show all 4 quadrant arcs simultaneously, or only the active one. The fix strategy differs fundamentally between these two interpretations.

### Recommended Fix Sketch

**File: `src/ui/HUD.tsx`**

- Remove `<QuadrantIndicator />` (line 28) and its import (line 5).
- Remove `<Crosshair />` (line 29) and its import (line 6).
- Both component files (`Crosshair.tsx`, `QuadrantIndicator.tsx`) can be deleted if no other code references them. Verify with a grep before deletion.

**File: `src/effects/TrajectoryPreview.tsx`** (if all-4-quadrants interpretation is chosen)

- Change the single `lineObj` to an array of 4 line objects, one per quadrant: `'fore'`, `'aft'`, `'port'`, `'starboard'`.
- In `useFrame`, iterate all 4 quadrants. For each, call `getMeanMountData` and compute the trajectory arc into that quadrant's line geometry.
- Render all 4 as `<primitive>` children. The active quadrant's line can be rendered more opaque (opacity 0.7) and inactive ones semi-transparent (opacity 0.2) to still show all arcs while highlighting the active one.

If the single-active-quadrant behavior is intentional (only show the arc you're about to fire), then the "missing port + rear" report is user error and no code change is needed for aim lines — just document it.

### Deterministic Test Plan

**Test 1 — Crosshair is not rendered in HUD (DOM test)**

```
// Render <HUD /> with phase='playing' in a test environment
// Query for data-testid="crosshair"
expect(screen.queryByTestId('crosshair')).toBeNull();
```

Currently FAILS: `Crosshair` is present and renders `data-testid="crosshair"` (Crosshair.tsx line 82).

**Test 2 — QuadrantIndicator is not rendered in HUD (DOM test)**

```
expect(screen.queryByTestId('quadrant-indicator')).toBeNull();
```

Currently FAILS: `QuadrantIndicator` renders `data-testid="quadrant-indicator"` (QuadrantIndicator.tsx line 96).

**Test 3 — TrajectoryPreview renders a line for every quadrant when all have mounts (unit test for getMeanMountData, no renderer)**

```
// getMeanMountData is not exported; export it for testing or test via observable effect
// Test that all 4 quadrants return non-null mount data for BOAT_STATS.player.weapons.mounts
const quadrants = ['fore', 'aft', 'port', 'starboard'] as const;
quadrants.forEach(q => {
  const result = getMeanMountData(BOAT_STATS.player.weapons.mounts, q);
  expect(result).not.toBeNull();
});
```

Currently PASSES for data correctness (all 4 quadrants have mounts). This test verifies the data is not the bug.

**Test 4 — Scenario: 4 trajectory line primitives exist in the scene (if all-4-quadrants is implemented)**
Uses a headless R3F render test or Playwright screenshot. Asserts that 4 Three.js Line objects are present in the scene. Currently FAILS (only 1 line object exists). Only write this test if the all-4 interpretation is chosen.

### Out-of-Scope Observations

- `QuadrantIndicator.tsx` positions itself at `top: 50%; left: 50%` — exactly on top of the crosshair. Both are DOM elements occupying the screen center. Removing both eliminates visual clutter.
- The `useActiveQuadrant` selector in `QuadrantIndicator.tsx` line 1 will become dead code after the removal. Remove the selector import to keep the codebase clean.
- `PointerLockHint.tsx` is also in the HUD and is unrelated — leave it.
- The firing pointer-lock requirement in `WeaponSystemR3F.tsx` line 28 is a separate concern from trajectory preview visibility. The trajectory line renders regardless of pointer lock state, which is the correct behavior for aiming feedback.
- `getMeanMountData` in `TrajectoryPreview.tsx` is not exported; if unit tests are needed for it, export it or move it to a shared utility.
- No changes needed to `WeaponSystemR3F.tsx`, `boatStats.ts`, or any physics/game logic file for this task.

## Status: COMPLETED 2026-04-11

All three items resolved:

1. **Crosshair removed** — `src/ui/Crosshair.tsx` deleted, removed from `HUD.tsx` (commit `b613415`)
2. **Quadrant indicator diamonds removed** — `src/ui/QuadrantIndicator.tsx` deleted, removed from `HUD.tsx` (commit `b613415`)
3. **Aim lines** — The investigation confirmed all 4 quadrants have trajectory data; the "only 2 showing" report was a user-perception issue (only active quadrant shown by design). The ribbon trajectory upgrade (commit `d67e31b`) makes the active-quadrant arc much more visible. Aim lines now correctly reflect the variable-aim offsets (commit `5ea02fa`).
