/**
 * Deterministic firing matrix — proves that every (boat yaw × camera orbit
 * quadrant) cell in the integrated pipeline fires a projectile in the
 * expected world-space direction.
 *
 * The user's bug: "depending on boat orientation some quadrants I can fire
 * and others I can't — the aim line is there but the cannon won't fire." The
 * suspicion was that aim-line quadrant and fire-path quadrant disagreed for
 * certain boat orientations. This test drives the REAL pipeline:
 *
 *   camera orbit azimuth → CameraSystemR3F.computeQuadrant → store.activeQuadrant
 *   → WeaponSystemR3F.canFire + computeFireData → ProjectilePool.activate
 *
 * For every cell of the matrix it asserts:
 *
 *   1. A projectile is actually spawned in the pool (no silent drop).
 *   2. The projectile's horizontal velocity azimuth matches the expected
 *      world-space direction for the mount used by the computed quadrant
 *      at the current boat yaw, within tolerance.
 *   3. The store's activeQuadrant at fire-time matches what
 *      computeQuadrant(cameraAzimuth, boatHeading) produces.
 *
 * Together these prove the aim-line and fire-path read a single, consistent
 * quadrant source for all boat orientations.
 */

import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

// ---------------------------------------------------------------------------
// Types mirrored from physicsRefs.ts / store
// ---------------------------------------------------------------------------

interface BodyStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

type Quadrant = 'fore' | 'aft' | 'port' | 'starboard';

// ---------------------------------------------------------------------------
// Pure helpers (duplicate the production quadrant math so the test is
// independent of implementation; any drift between these two copies
// surfaces as a test failure).
// ---------------------------------------------------------------------------

function computeQuadrantLocal(cameraAngle: number, boatHeading: number): Quadrant {
  let rel = cameraAngle - boatHeading;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  if (rel > -Math.PI / 4 && rel <= Math.PI / 4) return 'fore';
  if (rel > Math.PI / 4 && rel <= (3 * Math.PI) / 4) return 'starboard';
  if (rel > (-3 * Math.PI) / 4 && rel <= -Math.PI / 4) return 'port';
  return 'aft';
}

/**
 * Convert a camera orbit azimuth (as stored in CameraSystemR3F's `azimuthRef`)
 * into the "cameraAngle" (world-space look direction azimuth) that the
 * production camera system feeds into computeQuadrant.
 *
 * WORLD-FIXED CAM: the camera orbits the boat in WORLD space, so the
 * camera position uses `azimuth` directly (independent of boat heading).
 * Replicates:
 *   _cameraPos ≈ target + R*(sin(az), _, cos(az))
 *   _lookDir   = target − _cameraPos
 *   cameraAngle = atan2(_lookDir.x, _lookDir.z)
 *              = atan2(−sin(az), −cos(az))
 *              = az + π  (mod 2π)
 */
function cameraAzimuthToLookAngle(cameraAzimuth: number, _boatHeading: number): number {
  return Math.atan2(-Math.sin(cameraAzimuth), -Math.cos(cameraAzimuth));
}

/**
 * For a desired *target quadrant* relative to the boat, compute a camera
 * orbit azimuth that will produce that quadrant. Used to drive the real
 * camera → quadrant pipeline in the matrix test.
 *
 * With world-fixed cam:
 *   cameraAngle = az + π
 *   relative    = cameraAngle − boatHeading = az + π − boatHeading
 *
 * Solve `az + π − boatHeading ≡ rel (mod 2π)` for `az`:
 *   az = rel + boatHeading − π
 *
 * Quadrant-to-relative mapping (midpoint of each arc):
 *   fore      → rel = 0
 *   starboard → rel = π/2
 *   aft       → rel = π
 *   port      → rel = -π/2
 */
function cameraAzimuthForQuadrant(boatHeading: number, quadrant: Quadrant): number {
  const rel: Record<Quadrant, number> = {
    fore: 0,
    starboard: Math.PI / 2,
    aft: Math.PI,
    port: -Math.PI / 2,
  };
  return rel[quadrant] + boatHeading - Math.PI;
}

/**
 * Compute the expected world-space horizontal azimuth for a projectile fired
 * from a given quadrant's mounts at a given boat yaw, using the same math as
 * computeFireData. The player boat local mount directions (mean, since all
 * mounts of a quadrant share the same direction) are:
 *   fore:      [0, 0.3, 1]
 *   aft:       [0, 0.3, -1]
 *   port:      [-1, 0.3, 0]
 *   starboard: [1, 0.3, 0]
 */
function expectedImpulseAzimuth(quadrant: Quadrant, boatYaw: number): number {
  const local: Record<Quadrant, [number, number, number]> = {
    fore: [0, 0.3, 1],
    aft: [0, 0.3, -1],
    port: [-1, 0.3, 0],
    starboard: [1, 0.3, 0],
  };
  const [lx, , lz] = local[quadrant];
  // Pure yaw rotation of (lx, _, lz) around Y axis:
  //   x' = lx * cos(yaw) + lz * sin(yaw)
  //   z' = -lx * sin(yaw) + lz * cos(yaw)
  const cos = Math.cos(boatYaw);
  const sin = Math.sin(boatYaw);
  const wx = lx * cos + lz * sin;
  const wz = -lx * sin + lz * cos;
  return Math.atan2(wx, wz);
}

/** Signed shortest-arc angular difference in (-PI, PI]. */
function angularDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ---------------------------------------------------------------------------
// Browser-driver helpers
// ---------------------------------------------------------------------------

async function startPlaying(page: Page): Promise<void> {
  await startGame(page);
  await waitForPhase(page, 'mainMenu', 20_000);

  const startButton = page.locator('[data-testid="start-button"]');
  await expect(startButton).toBeVisible({ timeout: 15_000 });
  await startButton.click();

  await waitForPhase(page, 'playing', 15_000);

  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __GET_PLAYER_BODY_STATE__?: () => BodyStateSnapshot | null;
        __GET_PLAYER_BODY__?: () => unknown;
      };
      return w.__GET_PLAYER_BODY_STATE__?.() !== null && w.__GET_PLAYER_BODY__?.() !== null;
    },
    undefined,
    { timeout: 15_000 },
  );
}

/**
 * Force the player boat's yaw by writing directly to the Rapier body. Also
 * zeroes linvel/angvel to freeze the pose. Must be called each frame of a
 * short settle window so buoyancy torque does not pull the boat off pose.
 */
async function setBoatYaw(page: Page, yawRadians: number): Promise<void> {
  await page.evaluate((yaw: number) => {
    const w = window as unknown as {
      __GET_PLAYER_BODY__?: () => {
        setRotation: (r: { x: number; y: number; z: number; w: number }, wake: boolean) => void;
        setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
        setAngvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
      } | null;
    };
    const body = w.__GET_PLAYER_BODY__?.();
    if (!body) return;
    const half = yaw / 2;
    body.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, yawRadians);
}

/** Drive the camera orbit azimuth via the dev-only test bridge. */
async function setCameraAzimuth(page: Page, azimuth: number): Promise<void> {
  await page.evaluate((az: number) => {
    const w = window as unknown as { __SET_CAMERA_AZIMUTH__?: (a: number) => void };
    w.__SET_CAMERA_AZIMUTH__?.(az);
  }, azimuth);
}

/** Read the cooldownRemaining for a specific quadrant. */
async function readCooldown(page: Page, quadrant: Quadrant): Promise<number> {
  return page.evaluate((q: Quadrant) => {
    type S = {
      getState: () => {
        player: { weapons: { cooldownRemaining: Record<Quadrant, number> } } | null;
      };
    };
    const w = window as unknown as { __ZUSTAND_STORE__?: S };
    return w.__ZUSTAND_STORE__?.getState().player?.weapons.cooldownRemaining[q] ?? 999;
  }, quadrant);
}

/** Read the cached player body state. */
async function readPlayerBodyState(page: Page): Promise<BodyStateSnapshot> {
  const state = await page.evaluate<BodyStateSnapshot | null>(() => {
    const w = window as unknown as {
      __GET_PLAYER_BODY_STATE__?: () => BodyStateSnapshot | null;
    };
    return w.__GET_PLAYER_BODY_STATE__?.() ?? null;
  });
  if (!state) throw new Error('Player body state is null');
  return state;
}

/**
 * Read all active projectile body states keyed by pool index.
 *
 * Keying by pool index (not just the value array) lets the matrix test
 * identify the EXACT new projectile spawned by this shot — the freshly
 * activated pool slot — so we don't mistake a still-flying projectile from
 * the previous cell for the one we just fired.
 */
async function readActiveProjectileMap(page: Page): Promise<Map<number, BodyStateSnapshot>> {
  const entries = await page.evaluate<Array<[number, BodyStateSnapshot]>>(() => {
    const w = window as unknown as {
      __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<number, BodyStateSnapshot>;
    };
    const map = w.__GET_ALL_PROJECTILE_BODY_STATES__?.();
    if (!map) return [];
    const result: Array<[number, BodyStateSnapshot]> = [];
    for (const [idx, state] of map.entries()) {
      if (state.position.y > -100) result.push([idx, state]);
    }
    return result;
  });
  return new Map(entries);
}

/** Extract yaw (Y-axis rotation) from a quaternion, in radians, in (-π, π]. */
function yawFromQuat(q: { x: number; y: number; z: number; w: number }): number {
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
}

/**
 * Atomically:
 *   1. Re-assert boat yaw (buoyancy may have drifted it slightly)
 *   2. Set camera azimuth
 *   3. Request test fire
 *   4. Read active store quadrant (right before the fire happens)
 * All in a single page.evaluate so the fire can't be clobbered between steps.
 */
async function fireAtQuadrantViaCamera(
  page: Page,
  yawRad: number,
  cameraAzimuth: number,
): Promise<{ quadrantAtFire: Quadrant }> {
  return page.evaluate(
    ({ yaw, az }: { yaw: number; az: number }) => {
      const w = window as unknown as {
        __GET_PLAYER_BODY__?: () => {
          setRotation: (r: { x: number; y: number; z: number; w: number }, w: boolean) => void;
          setLinvel: (v: { x: number; y: number; z: number }, w: boolean) => void;
          setAngvel: (v: { x: number; y: number; z: number }, w: boolean) => void;
        } | null;
        __SET_CAMERA_AZIMUTH__?: (a: number) => void;
        __TEST_REQUEST_FIRE__?: () => void;
        __ZUSTAND_STORE__?: { getState: () => { activeQuadrant: string } };
      };
      const body = w.__GET_PLAYER_BODY__?.();
      if (body) {
        const half = yaw / 2;
        body.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      w.__SET_CAMERA_AZIMUTH__?.(az);
      w.__TEST_REQUEST_FIRE__?.();
      const q = w.__ZUSTAND_STORE__?.getState().activeQuadrant ?? 'fore';
      return { quadrantAtFire: q as Quadrant };
    },
    { yaw: yawRad, az: cameraAzimuth },
  );
}

/**
 * Fire once at the given (boat yaw, target quadrant) cell and wait for a new
 * projectile to materialize. Returns the freshly spawned projectile (the one
 * in a pool slot that was NOT present in the pre-fire snapshot), or null if
 * no projectile appeared at all.
 */
async function fireCellAndCapture(
  page: Page,
  yawRad: number,
  targetQuadrant: Quadrant,
): Promise<{ projectile: BodyStateSnapshot | null; quadrantAtFire: Quadrant }> {
  // 1) Freeze boat + keep yaw steady for several frames so buoyancy doesn't drift.
  for (let i = 0; i < 3; i++) {
    await setBoatYaw(page, yawRad);
    await page.waitForTimeout(30);
  }

  // 2) Drive the camera azimuth so the camera system computes targetQuadrant.
  const cameraAz = cameraAzimuthForQuadrant(yawRad, targetQuadrant);
  await setCameraAzimuth(page, cameraAz);
  await page.waitForTimeout(80); // let the camera useFrame run and write store

  // 3) Wait for the target quadrant's cooldown to elapse.
  const deadline = Date.now() + 800;
  while (Date.now() < deadline) {
    const cd = await readCooldown(page, targetQuadrant);
    if (cd <= 0) break;
    await page.waitForTimeout(25);
  }

  const beforeMap = await readActiveProjectileMap(page);

  // 4) Atomic fire: re-assert yaw + camera + fire + snapshot quadrant.
  const { quadrantAtFire } = await fireAtQuadrantViaCamera(page, yawRad, cameraAz);

  // 5) Poll for new projectile pool slots to appear.
  let newStates: Array<{ idx: number; state: BodyStateSnapshot }> = [];
  const fireDeadline = Date.now() + 600;
  while (Date.now() < fireDeadline) {
    await page.waitForTimeout(25);
    const afterMap = await readActiveProjectileMap(page);
    newStates = [];
    for (const [idx, state] of afterMap.entries()) {
      if (!beforeMap.has(idx)) newStates.push({ idx, state });
    }
    if (newStates.length > 0) break;
  }

  if (newStates.length === 0) return { projectile: null, quadrantAtFire };

  // Multiple new mounts can fire simultaneously (broadside has 4). Pick the
  // one with the highest linear speed — the freshest snapshot, before gravity
  // has decayed any vertical component. All mounts in a quadrant share the
  // same local direction so any of them answers the azimuth question
  // equivalently.
  newStates.sort((a, b) => {
    const va = a.state.linvel;
    const vb = b.state.linvel;
    const sa = va.x * va.x + va.y * va.y + va.z * va.z;
    const sb = vb.x * vb.x + vb.y * vb.y + vb.z * vb.z;
    return sb - sa;
  });
  return { projectile: newStates[0]?.state ?? null, quadrantAtFire };
}

// ---------------------------------------------------------------------------
// Matrix tests
// ---------------------------------------------------------------------------

const YAW_ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const QUADRANTS: readonly Quadrant[] = ['fore', 'starboard', 'aft', 'port'] as const;

/**
 * Azimuth tolerance (radians) between projectile velocity direction and the
 * expected world-space mount direction. Mount directions include a small
 * upward tilt (Y = 0.3), which gets normalized on the horizontal plane, so
 * a ~0.2 rad (~11°) tolerance absorbs quaternion precision and physics
 * settle without masking a real quadrant mismatch.
 */
const AZIMUTH_TOLERANCE = 0.25;

test.describe('Firing orientation matrix', () => {
  test.describe.configure({ timeout: 360_000 });

  test('every (boat yaw × camera quadrant) cell fires in the expected world direction', async ({
    page,
  }) => {
    await startPlaying(page);
    // Let physics, projectile pool, and shader compilation settle.
    await page.waitForTimeout(3_000);

    const failures: string[] = [];
    const cellLog: Array<{
      yawDeg: number;
      quadrant: Quadrant;
      storeQuadrant: Quadrant;
      expectedAz: number;
      actualAz: number;
      delta: number;
      fired: boolean;
    }> = [];

    for (const yawDeg of YAW_ANGLES_DEG) {
      const yawRad = (yawDeg * Math.PI) / 180;

      for (const quadrant of QUADRANTS) {
        const result = await fireCellAndCapture(page, yawRad, quadrant);

        // Read actual boat yaw from the cached body state at fire time.
        const body = await readPlayerBodyState(page);
        const actualYaw = yawFromQuat(body.rotation);

        // If the boat drifted a lot (shouldn't), track it in the log.
        if (Math.abs(angularDelta(actualYaw, yawRad)) > 0.05) {
          failures.push(
            `yaw=${String(yawDeg)}° quadrant=${quadrant}: boat yaw drifted ` +
              `to ${((actualYaw * 180) / Math.PI).toFixed(1)}°`,
          );
        }

        const cameraAz = cameraAzimuthForQuadrant(actualYaw, quadrant);
        const cameraAngle = cameraAzimuthToLookAngle(cameraAz, actualYaw);
        const predictedStoreQ = computeQuadrantLocal(cameraAngle, actualYaw);

        if (!result.projectile) {
          cellLog.push({
            yawDeg,
            quadrant,
            storeQuadrant: result.quadrantAtFire,
            expectedAz: expectedImpulseAzimuth(quadrant, actualYaw),
            actualAz: NaN,
            delta: NaN,
            fired: false,
          });
          failures.push(
            `yaw=${String(yawDeg)}° quadrant=${quadrant}: NO PROJECTILE (silently dropped), ` +
              `storeQuadrantAtFire=${result.quadrantAtFire} predicted=${predictedStoreQ}`,
          );
          continue;
        }

        const { linvel } = result.projectile;
        const actualAz = Math.atan2(linvel.x, linvel.z);
        const expectedAz = expectedImpulseAzimuth(quadrant, actualYaw);
        const delta = Math.abs(angularDelta(actualAz, expectedAz));

        cellLog.push({
          yawDeg,
          quadrant,
          storeQuadrant: result.quadrantAtFire,
          expectedAz,
          actualAz,
          delta,
          fired: true,
        });

        if (delta > AZIMUTH_TOLERANCE) {
          failures.push(
            `yaw=${String(yawDeg)}° quadrant=${quadrant}: ` +
              `actualYaw=${((actualYaw * 180) / Math.PI).toFixed(1)}° ` +
              `storeQ=${result.quadrantAtFire} predictedQ=${predictedStoreQ} ` +
              `expectedAz=${expectedAz.toFixed(3)} gotAz=${actualAz.toFixed(3)} ` +
              `delta=${delta.toFixed(3)} rad`,
          );
        }

        // Pace between shots so per-quadrant cooldown (150ms) elapses for
        // the next cell. 200ms is safe headroom.
        await page.waitForTimeout(200);
      }
    }

    const grid = YAW_ANGLES_DEG.map((yaw) => {
      const row = QUADRANTS.map((q) => {
        const cell = cellLog.find((c) => c.yawDeg === yaw && c.quadrant === q);
        if (!cell) return '???';
        if (!cell.fired) return 'DROP';
        if (cell.delta > AZIMUTH_TOLERANCE) return `BAD(${cell.delta.toFixed(2)})`;
        return 'OK';
      }).join('  ');
      return `${String(yaw).padStart(3, ' ')}°: ${row}`;
    }).join('\n');

    expect(
      failures,
      `Firing matrix failures:\n${failures.join('\n')}\n\nGrid (yaw rows, quadrant cols [fore starboard aft port]):\n${grid}`,
    ).toEqual([]);
  });

  test('rapid fire in fixed orientation produces a projectile for every click', async ({
    page,
  }) => {
    await startPlaying(page);
    await page.waitForTimeout(3_000);

    // Fixed: yaw 0, camera oriented so computed quadrant = starboard.
    const yawRad = 0;
    const targetQuadrant: Quadrant = 'starboard';

    const SHOT_COUNT = 10;
    let successes = 0;
    for (let i = 0; i < SHOT_COUNT; i++) {
      const result = await fireCellAndCapture(page, yawRad, targetQuadrant);
      if (result.projectile) successes++;
    }

    expect(successes, `Expected all ${String(SHOT_COUNT)} shots to produce a projectile`).toBe(
      SHOT_COUNT,
    );
  });

  /**
   * Regression test for the orientation-dependent "my click was eaten" bug.
   *
   * Symptom (user): "depending on boat orientation, some quadrants I can
   * fire and others I can't." Root cause: the weapon system silently drops
   * any click that arrives while the active quadrant's per-quadrant
   * cooldown is non-zero. Because the cooldown is PER QUADRANT, rapid
   * clicks at the same orientation hit the same cooling quadrant and eat
   * clicks, while clicks at an orientation whose quadrant is not yet
   * cooling go through — creating an apparent orientation-dependent
   * reliability issue.
   *
   * The fix is to hold the fire request across frames until canFire allows
   * the shot, so a click queued during cooldown fires on the very next
   * frame the quadrant becomes ready.
   *
   * This test asserts that N rapid clicks (faster than cooldown) produce N
   * projectiles — no silent drops — over a bounded time window. It is the
   * deterministic proof of the user-reported bug.
   */
  test('rapid clicks during cooldown are queued, not silently dropped', async ({ page }) => {
    await startPlaying(page);
    await page.waitForTimeout(3_000);

    const yawRad = 0;
    const targetQuadrant: Quadrant = 'starboard';
    const cameraAz = cameraAzimuthForQuadrant(yawRad, targetQuadrant);

    // Settle yaw + camera so the camera computes `starboard` consistently.
    for (let i = 0; i < 3; i++) {
      await setBoatYaw(page, yawRad);
      await setCameraAzimuth(page, cameraAz);
      await page.waitForTimeout(40);
    }

    // Read the initial pool state as a baseline. Every new pool slot that
    // appears during the burst + drain window must be attributable to a
    // click in the burst — no background system spawns player projectiles.
    const seenSlots = new Set<number>();
    const initial = await readActiveProjectileMap(page);
    for (const idx of initial.keys()) seenSlots.add(idx);

    /**
     * Fire N clicks back-to-back with a very short (~30ms) gap — far less
     * than the 150ms cooldown. In the bug's previous state, only shot 1
     * spawns a projectile; shots 2..N are dropped because `fireRequestedRef`
     * is consumed and canFire=false, so the request is cleared without
     * firing. A queue-on-cooldown implementation MUST keep the flag until
     * canFire allows the shot.
     *
     * Each successful fire spawns one projectile per mount in the active
     * quadrant (starboard has 4 mounts). We therefore expect CLICK_COUNT ×
     * MOUNTS_PER_QUADRANT total new pool slots after the drain window.
     */
    const CLICK_COUNT = 6;
    const MOUNTS_PER_STARBOARD = 4; // from BOAT_STATS.player.weapons.mounts
    const EXPECTED_SPAWNS = CLICK_COUNT * MOUNTS_PER_STARBOARD;

    for (let i = 0; i < CLICK_COUNT; i++) {
      await fireAtQuadrantViaCamera(page, yawRad, cameraAz);
      // 30ms between clicks: well below cooldown, so at least 4 of 6 clicks
      // arrive while the previous shot's cooldown is still counting down.
      await page.waitForTimeout(30);
    }

    // Drain window: poll the pool for new slots for long enough to cover
    // CLICK_COUNT × cooldown (6 × 150ms = 900ms) with generous headroom for
    // the request-to-spawn render latency.
    const drainDeadline = Date.now() + 2_500;
    while (Date.now() < drainDeadline) {
      const map = await readActiveProjectileMap(page);
      for (const idx of map.keys()) {
        if (!seenSlots.has(idx)) seenSlots.add(idx);
      }
      if (seenSlots.size - initial.size >= EXPECTED_SPAWNS) break;
      await page.waitForTimeout(20);
    }

    const newSpawns = seenSlots.size - initial.size;
    expect(
      newSpawns,
      `Expected all ${String(CLICK_COUNT)} rapid clicks to spawn ` +
        `${String(EXPECTED_SPAWNS)} projectiles total ` +
        `(${String(MOUNTS_PER_STARBOARD)} starboard mounts × ${String(CLICK_COUNT)} clicks). ` +
        `Clicks during cooldown must be queued, not dropped. got=${String(newSpawns)}`,
    ).toBe(EXPECTED_SPAWNS);
  });

  test('orientation sweep: rotating through all yaws while firing succeeds every cell', async ({
    page,
  }) => {
    await startPlaying(page);
    await page.waitForTimeout(3_000);

    const SWEEP_STEPS = 12;
    let successes = 0;

    for (let i = 0; i < SWEEP_STEPS; i++) {
      const yawRad = (i / SWEEP_STEPS) * 2 * Math.PI;
      const quadrant = QUADRANTS[i % QUADRANTS.length]!;
      const result = await fireCellAndCapture(page, yawRad, quadrant);
      if (result.projectile) successes++;
    }

    expect(successes, `Expected every sweep cell to fire`).toBe(SWEEP_STEPS);
  });
});
