# Player broadside cannon alignment

## Description

The 4 broadside cannons on the player boat are misaligned: 3 sit close together, 1 is spaced further apart. They must be evenly distributed along the hull length and pulled slightly inward toward the centerline — they currently stick out too far from the boat.

## Acceptance Criteria

- [x] All 4 port broadside cannons evenly spaced along the hull
- [x] All 4 starboard broadside cannons evenly spaced along the hull
- [x] Port and starboard cannons mirrored exactly
- [x] Cannons moved inward toward hull centerline (less overhang)
- [x] Fore cannons still positioned naturally at bow
- [x] Verified in a scenario/unit test asserting mount offsets

## Relevant Files

- `src/utils/boatStats.ts` — weapon mount definitions
- `src/entities/PlayerBoat.tsx` — cannon rendering

## Research (2026-04-11)

### Root Cause

The 4 port broadside mounts are defined at `src/utils/boatStats.ts` lines 39-42 with Z offsets of `1.0`, `0.0`, `-0.5`, `-1.0`. The spacing between each consecutive pair is `1.0`, `0.5`, `0.5` — the gap from the first mount to the second is double the gap between the remaining three. This is the source of the "3 sit close together, 1 is spaced further apart" visual. Additionally, the X offset is `±1.2` for all broadside mounts; this value places the cannon barrel significantly outside the hull collider half-extent (`PLAYER_HALF_EXTENTS[0] = 1.2` in `PlayerBoat.tsx` line 41), meaning the cannon model edge extends beyond the collision box.

Specific evidence:

- `boatStats.ts` line 39: port mount 1 at Z = `1.0`
- `boatStats.ts` line 40: port mount 2 at Z = `0.0` (gap = 1.0)
- `boatStats.ts` line 41: port mount 3 at Z = `-0.5` (gap = 0.5)
- `boatStats.ts` line 42: port mount 4 at Z = `-1.0` (gap = 0.5)
- Starboard mirrors port exactly (`boatStats.ts` lines 44-47), so the same uneven spacing is mirrored on the right side.
- X offset for all broadside mounts is `±1.2`, equal to the collider half-width, meaning cannons sit at the very edge of (or past) the hull.

### Recommended Fix Sketch

File: `src/utils/boatStats.ts` only.

1. **Even spacing**: Choose a symmetric Z range and divide into 3 equal gaps for 4 mounts. A natural fit given the hull length is Z `1.5` to `-1.5` in steps of `1.0`, giving offsets `[1.5, 0.5, -0.5, -1.5]`. Alternatively `[1.2, 0.4, -0.4, -1.2]` if a tighter cluster is preferred. Both are perfectly even.

2. **Pull inward**: Reduce the broadside X offset from `1.2` to `0.9` (or `0.85`). The hull visual mesh is narrower than the collider half-extent; `0.9` keeps cannons inside the hull silhouette while still appearing on the side.

3. **Mirror check**: Port X must be exactly `-1 * starboard X`; Z values must match exactly. After any change, verify programmatically (see test plan).

4. **Fore/aft mounts**: No change needed — their positions are not part of this issue.

No changes needed to `PlayerBoat.tsx`; it already iterates `BOAT_STATS.player.weapons.mounts` generically (lines 107, 137-145) and applies the mount offset directly. Fixing the data in `boatStats.ts` is sufficient.

## Status: COMPLETED 2026-04-11

All acceptance criteria checked (checkboxes already marked in file). Front broadside mount Z corrected for even spacing; cannons pulled inward. Unit tests added. Landed in commit `853667a` (`tune(boats): move player cannons inward and lower, raise baseline`) and `bb6582a` (`fix(combat): even broadside cannon spacing + wider ribbon trajectory`). Previous agent also noted completion at bottom of file.

### Deterministic Test Plan

All tests are pure unit tests (no renderer) and can live in a new file `src/utils/__tests__/boatStats.test.ts`.

**Test 1 — Port broadside Z offsets are evenly spaced**

```
const portMounts = BOAT_STATS.player.weapons.mounts.filter(m => m.quadrant === 'port');
const zOffsets = portMounts.map(m => m.localOffset[2]).sort((a, b) => b - a);
const gaps = zOffsets.slice(1).map((z, i) => Math.abs(zOffsets[i] - z));
// All gaps must be equal (within floating-point tolerance)
gaps.forEach(g => expect(g).toBeCloseTo(gaps[0], 5));
```

Currently FAILS: gaps are [1.0, 0.5, 0.5].

**Test 2 — Starboard Z offsets are evenly spaced**
Same pattern filtering `quadrant === 'starboard'`.
Currently FAILS for same reason.

**Test 3 — Port and starboard are exact X mirrors**

```
const port = mounts.filter(m => m.quadrant === 'port');
const star = mounts.filter(m => m.quadrant === 'starboard');
expect(port.length).toBe(star.length);
port.forEach((pm, i) => {
  expect(pm.localOffset[0]).toBeCloseTo(-star[i].localOffset[0], 5);
  expect(pm.localOffset[1]).toBeCloseTo(star[i].localOffset[1], 5);
  expect(pm.localOffset[2]).toBeCloseTo(star[i].localOffset[2], 5);
});
```

Currently PASSES (mirrors are consistent). Must still pass after fix.

**Test 4 — Broadside X offsets are within hull width**

```
const broadsideMounts = mounts.filter(m => m.quadrant === 'port' || m.quadrant === 'starboard');
broadsideMounts.forEach(m => {
  expect(Math.abs(m.localOffset[0])).toBeLessThan(1.1); // inward target
});
```

Currently FAILS: all broadside mounts have |X| = 1.2.

**Test 5 — Mount count per quadrant is correct**

```
expect(portMounts.length).toBe(4);
expect(starMounts.length).toBe(4);
```

Currently PASSES. Must still pass after fix.

### Out-of-Scope Observations

- The `TrajectoryPreview` uses the mean of all mounts in the active quadrant (`getMeanMountData` in `TrajectoryPreview.tsx` line 31). After fixing Z offsets, the mean Z will shift slightly for the broadside trajectory line origin — this is cosmetically correct behavior, not a bug.
- `PlayerBoat.tsx` logs mesh bounding boxes in dev mode (lines 83-104). After the fix, checking those logs against the new X offset would confirm the cannon mesh fits within hull bounds — useful for the dev agent to verify visually.
- Enemy alignment (barge/skiff) uses evenly-spaced mounts and is unaffected.
- No test infrastructure changes are needed; `boatStats.ts` is already importable as a pure ES module with no R3F/browser dependencies.

## Fixed 2026-04-11

Front broadside mount Z corrected from `1.0` → `0.5` for both port and starboard, making all 4 mounts evenly spaced at 0.5-unit intervals (`0.5, 0.0, -0.5, -1.0`). Unit tests added to `tests/unit/boatStats.test.ts` pinning the new values and asserting even spacing. Changes landed in task `gbr-cannon-spacing-ribbon-width` (agent `gbr-dev-cannon-ribbon`, 202604112325).
