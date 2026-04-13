/**
 * Regression test for the "aim line disappears after sailing forward" bug.
 *
 * User scenario (verbatim):
 *   "Refresh and start. I can fire in all directions. Then I sail straight
 *   forward a bit. I literally see my aim line at the front disappear. I can
 *   no longer fire forward. This is 100% position-related. As long as I'm
 *   near the start point I can fire in all quadrants."
 *
 * The test drives the REAL integrated pipeline (no unit shortcuts):
 *
 *   1. Start the game.
 *   2. Establish a baseline: with the boat at (or near) the origin, set the
 *      camera/orient so the computed quadrant is 'fore' and fire. Assert a
 *      projectile spawns, record the store.activeQuadrant at fire-time and
 *      the trajectory-preview-equivalent mount-world-direction angle.
 *   3. Teleport the boat ~60 m away from the origin along +X (simulating the
 *      player sailing forward — boat yaw and cursor position are unchanged).
 *   4. Re-fire with the SAME camera azimuth / cursor position.
 *   5. Assert:
 *      - store.activeQuadrant is still 'fore' (no quadrant drift)
 *      - a projectile spawns (no silent drop)
 *      - the projectile's horizontal direction azimuth matches the
 *        pre-teleport one within tolerance (no aim drift)
 *   6. Additional edge cells: boat at +30 X, −30 X, +30 Z, −30 Z, and a
 *      diagonal — all must still fire forward with the same direction.
 *
 * The test intentionally uses teleport-based position changes instead of
 * applying thrust for 30 frames: that isolates the bug to "boat position
 * changed" and eliminates buoyancy/physics variability from the test. If
 * the bug is position-dependent (as the user hypothesises) the teleport
 * reproduces it; if it's motion/velocity-dependent, a second test variant
 * can be added after the first is green.
 */

import { test, expect, type Page } from '@playwright/test';
import { startPlayingFromMenu, waitForPlayerBody } from '../helpers/gameTestUtils';

// ---------------------------------------------------------------------------
// Shared types (mirrored from physicsRefs.ts / store)
// ---------------------------------------------------------------------------

interface BodyStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

type Quadrant = 'fore' | 'aft' | 'port' | 'starboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function startPlaying(page: Page): Promise<void> {
  await startPlayingFromMenu(page);
  await waitForPlayerBody(page);
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __GET_PLAYER_BODY__?: () => unknown;
      };
      return w.__GET_PLAYER_BODY__?.() !== null;
    },
    undefined,
    { timeout: 15_000 },
  );
}

/**
 * Teleport the player boat to a given world-XZ position. Also re-sets yaw to
 * 0 and zeroes velocities so buoyancy drift during fire-settle is minimised.
 */
async function teleportBoat(page: Page, x: number, z: number): Promise<void> {
  await page.evaluate(
    ({ tx, tz }: { tx: number; tz: number }) => {
      const w = window as unknown as {
        __GET_PLAYER_BODY__?: () => {
          setTranslation: (p: { x: number; y: number; z: number }, wake: boolean) => void;
          setRotation: (r: { x: number; y: number; z: number; w: number }, wake: boolean) => void;
          setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
          setAngvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
          translation: () => { x: number; y: number; z: number };
        } | null;
      };
      const body = w.__GET_PLAYER_BODY__?.();
      if (!body) return;
      const cur = body.translation();
      body.setTranslation({ x: tx, y: cur.y, z: tz }, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },
    { tx: x, tz: z },
  );
}

/** Drive the camera orbit azimuth via the dev-only test bridge. */
async function setCameraAzimuth(page: Page, azimuth: number): Promise<void> {
  await page.evaluate((az: number) => {
    const w = window as unknown as { __SET_CAMERA_AZIMUTH__?: (a: number) => void };
    w.__SET_CAMERA_AZIMUTH__?.(az);
  }, azimuth);
}

async function readActiveQuadrant(page: Page): Promise<Quadrant> {
  return page.evaluate(() => {
    type S = { getState: () => { activeQuadrant: string } };
    const w = window as unknown as { __ZUSTAND_STORE__?: S };
    return (w.__ZUSTAND_STORE__?.getState().activeQuadrant ?? 'fore') as Quadrant;
  });
}

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

async function readActiveProjectileMap(page: Page): Promise<Map<number, BodyStateSnapshot>> {
  const entries = await page.evaluate<Array<[number, BodyStateSnapshot]>>(() => {
    const w = window as unknown as {
      __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<number, BodyStateSnapshot>;
    };
    const map = w.__GET_ALL_PROJECTILE_BODY_STATES__?.();
    if (!map) return [];
    const out: Array<[number, BodyStateSnapshot]> = [];
    for (const [idx, state] of map.entries()) {
      if (state.position.y > -100) out.push([idx, state]);
    }
    return out;
  });
  return new Map(entries);
}

/** Atomic fire: reassert position/yaw, set camera, fire, read store quadrant. */
async function atomicFire(
  page: Page,
  x: number,
  z: number,
  cameraAzimuth: number,
): Promise<{ quadrantAtFire: Quadrant }> {
  return page.evaluate(
    ({ tx, tz, az }: { tx: number; tz: number; az: number }) => {
      const w = window as unknown as {
        __GET_PLAYER_BODY__?: () => {
          setTranslation: (p: { x: number; y: number; z: number }, wake: boolean) => void;
          setRotation: (r: { x: number; y: number; z: number; w: number }, wake: boolean) => void;
          setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
          setAngvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
          translation: () => { x: number; y: number; z: number };
        } | null;
        __SET_CAMERA_AZIMUTH__?: (a: number) => void;
        __TEST_REQUEST_FIRE__?: () => void;
        __ZUSTAND_STORE__?: { getState: () => { activeQuadrant: string } };
      };
      const body = w.__GET_PLAYER_BODY__?.();
      if (body) {
        const cur = body.translation();
        body.setTranslation({ x: tx, y: cur.y, z: tz }, true);
        body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      w.__SET_CAMERA_AZIMUTH__?.(az);
      w.__TEST_REQUEST_FIRE__?.();
      const q = w.__ZUSTAND_STORE__?.getState().activeQuadrant ?? 'fore';
      return { quadrantAtFire: q as Quadrant };
    },
    { tx: x, tz: z, az: cameraAzimuth },
  );
}

/**
 * Fire forward from position (x, z). Waits for yaw/camera to settle, waits
 * for fore-quadrant cooldown, fires, and returns the freshest new projectile
 * alongside the store's activeQuadrant at fire-time.
 *
 * cameraAzimuth is chosen so the real CameraSystemR3F computes 'fore'
 * (camera-behind-boat). That azimuth is independent of boat world position,
 * which is exactly the invariant the bug tests.
 */
async function fireForwardFromPosition(
  page: Page,
  x: number,
  z: number,
): Promise<{ projectile: BodyStateSnapshot | null; quadrantAtFire: Quadrant }> {
  // Pre-fire: teleport and settle yaw+velocity for a few frames so buoyancy
  // doesn't drift the boat off pose.
  for (let i = 0; i < 3; i++) {
    await teleportBoat(page, x, z);
    await page.waitForTimeout(30);
  }

  // Camera orbit azimuth π positions the camera behind a yaw=0 boat,
  // looking forward (+Z), which maps to the 'fore' firing quadrant.
  const cameraAz = Math.PI;
  await setCameraAzimuth(page, cameraAz);
  await page.waitForTimeout(80);

  // Wait for fore cooldown to elapse.
  const deadline = Date.now() + 800;
  while (Date.now() < deadline) {
    const cd = await page.evaluate(() => {
      type S = {
        getState: () => {
          player: {
            weapons: { cooldownRemaining: Record<string, number> };
          } | null;
        };
      };
      const w = window as unknown as { __ZUSTAND_STORE__?: S };
      return w.__ZUSTAND_STORE__?.getState().player?.weapons.cooldownRemaining['fore'] ?? 999;
    });
    if (cd <= 0) break;
    await page.waitForTimeout(25);
  }

  const before = await readActiveProjectileMap(page);

  const { quadrantAtFire } = await atomicFire(page, x, z, cameraAz);

  // Poll for a freshly spawned pool slot.
  let newStates: Array<{ idx: number; state: BodyStateSnapshot }> = [];
  const fireDeadline = Date.now() + 800;
  while (Date.now() < fireDeadline) {
    await page.waitForTimeout(25);
    const after = await readActiveProjectileMap(page);
    newStates = [];
    for (const [idx, state] of after.entries()) {
      if (!before.has(idx)) newStates.push({ idx, state });
    }
    if (newStates.length > 0) break;
  }

  if (newStates.length === 0) return { projectile: null, quadrantAtFire };

  // Multiple mounts can fire simultaneously; pick the one with highest speed
  // (freshest velocity, least decayed by gravity).
  newStates.sort((a, b) => {
    const va = a.state.linvel;
    const vb = b.state.linvel;
    const sa = va.x * va.x + va.y * va.y + va.z * va.z;
    const sb = vb.x * vb.x + vb.y * vb.y + vb.z * vb.z;
    return sb - sa;
  });
  return { projectile: newStates[0]?.state ?? null, quadrantAtFire };
}

/** Signed shortest-arc angular difference in (-PI, PI]. */
function angularDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Firing position drift regression', () => {
  test.describe.configure({ timeout: 180_000 });

  test('forward firing works after boat moves far from origin', async ({ page }) => {
    await startPlaying(page);
    // Let physics and pool init settle.
    await page.waitForTimeout(3_000);

    // Baseline: near origin, forward fire must work.
    const baseline = await fireForwardFromPosition(page, 0, 0);
    expect(baseline.quadrantAtFire, 'Baseline quadrantAtFire must be fore').toBe('fore');
    expect(baseline.projectile, 'Baseline must spawn a projectile').not.toBeNull();
    const baselineAz = baseline.projectile
      ? Math.atan2(baseline.projectile.linvel.x, baseline.projectile.linvel.z)
      : NaN;
    expect(Number.isFinite(baselineAz)).toBe(true);

    // Reset fore cooldown by pacing.
    await page.waitForTimeout(300);

    // Sail forward: boat now 60m away from origin in +Z.
    const afterMove = await fireForwardFromPosition(page, 0, 60);

    // 1) Read the actual body position to prove the teleport landed.
    const body = await readPlayerBodyState(page);
    expect(
      Math.hypot(body.position.x, body.position.z),
      'Boat must actually be far from origin',
    ).toBeGreaterThan(25);

    // 2) Store quadrant must still be fore.
    expect(
      afterMove.quadrantAtFire,
      `After sailing forward, quadrantAtFire should still be 'fore' but was ` +
        `'${afterMove.quadrantAtFire}'. The aim-line / fire selector is ` +
        `drifting with boat position — 100% position-related bug.`,
    ).toBe('fore');

    // 3) Projectile must spawn.
    expect(
      afterMove.projectile,
      'After sailing forward, firing must still produce a projectile',
    ).not.toBeNull();

    // 4) Projectile direction must be the same as baseline.
    if (afterMove.projectile) {
      const afterAz = Math.atan2(afterMove.projectile.linvel.x, afterMove.projectile.linvel.z);
      const drift = Math.abs(angularDelta(afterAz, baselineAz));
      expect(
        drift,
        `Aim angle drifted by ${((drift * 180) / Math.PI).toFixed(1)}° after ` +
          `moving from origin to (0, 60). Baseline=${baselineAz.toFixed(3)} ` +
          `after=${afterAz.toFixed(3)}`,
      ).toBeLessThan(0.2);
    }
  });

  test('cursor-fallback forward aim survives sailing forward (real thrust)', async ({ page }) => {
    // Faithful reproduction of the user's exact scenario:
    //   1. Refresh + start (no canvas click — pointer lock NOT acquired)
    //   2. Move mouse to screen center (cursor-fallback → fore quadrant)
    //   3. Press W, sail forward for a few seconds
    //   4. Assert activeQuadrant is still 'fore'
    //   5. Fire and assert a projectile spawns
    await startPlaying(page);
    await page.waitForTimeout(3_000);

    // Explicitly clear any forced azimuth so cursor-fallback is in effect.
    await page.evaluate(() => {
      const w = window as unknown as { __SET_CAMERA_AZIMUTH__?: (a: number | null) => void };
      w.__SET_CAMERA_AZIMUTH__?.(null);
    });

    // Position the mouse slightly ABOVE the canvas center so cursor fallback
    // computes the 'fore' quadrant (cursorAngle = atan2(0, +y) = 0). A small
    // y-offset avoids the atan2(0, -0) = π edge case (negative-zero from
    // sign preservation in (0 - centerY)).
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const centerX = Math.floor(viewport.width / 2);
    const aboveCenterY = Math.floor(viewport.height / 2) - 100;
    await page.mouse.move(centerX, aboveCenterY);
    await page.waitForTimeout(80);

    // Dispatch a mousemove via the document directly. page.mouse.move goes
    // through Playwright's CDP input dispatcher which can miss document-level
    // listeners in some headless contexts; a direct dispatchEvent makes the
    // test robust across environments.
    await page.evaluate(
      ({ cx, cy }: { cx: number; cy: number }) => {
        const evt = new MouseEvent('mousemove', {
          clientX: cx,
          clientY: cy,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(evt);
      },
      { cx: centerX, cy: aboveCenterY },
    );
    await page.waitForTimeout(80);

    // Read initial state.
    const initialQuadrant = await readActiveQuadrant(page);
    const initialBody = await readPlayerBodyState(page);
    expect(
      initialQuadrant,
      'With cursor above canvas center (cursor-fallback path), initial ' + 'quadrant must be fore',
    ).toBe('fore');

    // Press W for 3 seconds to sail forward.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3_000);
    await page.keyboard.up('KeyW');
    // Settle for a moment (buoyancy decelerates).
    await page.waitForTimeout(200);

    // Keep mouse at the same "aim forward" point.
    await page.mouse.move(centerX, aboveCenterY);
    await page.evaluate(
      ({ cx, cy }: { cx: number; cy: number }) => {
        const evt = new MouseEvent('mousemove', {
          clientX: cx,
          clientY: cy,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(evt);
      },
      { cx: centerX, cy: aboveCenterY },
    );
    await page.waitForTimeout(120);

    const afterBody = await readPlayerBodyState(page);
    const distMoved = Math.hypot(
      afterBody.position.x - initialBody.position.x,
      afterBody.position.z - initialBody.position.z,
    );

    // Prove the boat actually moved meaningfully.
    expect(distMoved, 'Boat should have sailed forward').toBeGreaterThan(15);

    const afterQuadrant = await readActiveQuadrant(page);

    // THIS is the user's exact failure: cursor at center but quadrant is not
    // fore anymore after sailing forward.
    expect(
      afterQuadrant,
      `After sailing ${distMoved.toFixed(1)}m forward (cursor still at canvas ` +
        `center, no user input), activeQuadrant was '${afterQuadrant}' ` +
        `(initially '${initialQuadrant}'). Boat rotation quat: ` +
        `${JSON.stringify(afterBody.rotation)}. ` +
        `The aim-line reference point is drifting with boat position.`,
    ).toBe('fore');

    // Fire and assert a projectile spawns (pool-based; click via document).
    const before = await readActiveProjectileMap(page);
    await page.evaluate(() => {
      const w = window as unknown as { __TEST_REQUEST_FIRE__?: () => void };
      w.__TEST_REQUEST_FIRE__?.();
    });

    let newSpawns = 0;
    const deadline = Date.now() + 800;
    while (Date.now() < deadline) {
      await page.waitForTimeout(25);
      const after = await readActiveProjectileMap(page);
      newSpawns = 0;
      for (const idx of after.keys()) if (!before.has(idx)) newSpawns++;
      if (newSpawns > 0) break;
    }
    expect(newSpawns, 'Fire after sailing forward must spawn a projectile').toBeGreaterThan(0);
  });

  test('pointer-locked (test-bridge) forward aim survives sailing forward (real thrust)', async ({
    page,
  }) => {
    // Reproduces the pointer-locked path: real user clicks canvas → pointer
    // lock acquired → azimuth driven from mouse deltas. We simulate this via
    // __SET_CAMERA_AZIMUTH__ which forces the same computeQuadrant(cameraAngle,
    // boatHeading) path without needing real pointer lock (headless can't
    // acquire it). Then we apply real forward thrust (W key) and watch the
    // quadrant drift as buoyancy torque yaws the boat.
    await startPlaying(page);
    await page.waitForTimeout(3_000);

    // Force camera azimuth π → camera looks forward (+Z). With boat yaw 0
    // the quadrant is 'fore'. This is the production pointer-lock path, just
    // without the real pointer-lock acquisition.
    await setCameraAzimuth(page, Math.PI);
    await page.waitForTimeout(120);

    const initialBody = await readPlayerBodyState(page);
    const initialQuadrant = await readActiveQuadrant(page);
    expect(initialQuadrant, 'With camera azimuth π and boat at start, quadrant must be fore').toBe(
      'fore',
    );

    // Sail forward for 8 seconds so the boat clears wave-induced startup
    // drift and travels ~100m — matching the user's "sail forward a bit".
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(8_000);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(500);

    const afterBody = await readPlayerBodyState(page);
    const distMoved = Math.hypot(
      afterBody.position.x - initialBody.position.x,
      afterBody.position.z - initialBody.position.z,
    );
    expect(distMoved, 'Boat must actually have sailed forward').toBeGreaterThan(15);

    const afterQuadrant = await readActiveQuadrant(page);
    expect(
      afterQuadrant,
      `After sailing ${distMoved.toFixed(1)}m forward, activeQuadrant was ` +
        `'${afterQuadrant}' (expected 'fore'). Boat rotation: ` +
        `${JSON.stringify(afterBody.rotation)}`,
    ).toBe('fore');

    // Fire and assert projectile spawns.
    const before = await readActiveProjectileMap(page);
    await page.evaluate(() => {
      const w = window as unknown as { __TEST_REQUEST_FIRE__?: () => void };
      w.__TEST_REQUEST_FIRE__?.();
    });
    let newSpawns = 0;
    const deadline = Date.now() + 800;
    while (Date.now() < deadline) {
      await page.waitForTimeout(25);
      const after = await readActiveProjectileMap(page);
      newSpawns = 0;
      for (const idx of after.keys()) if (!before.has(idx)) newSpawns++;
      if (newSpawns > 0) break;
    }
    expect(newSpawns, 'Forward fire after sailing must spawn a projectile').toBeGreaterThan(0);
  });

  test('forward firing works from every cardinal position far from origin', async ({ page }) => {
    await startPlaying(page);
    await page.waitForTimeout(3_000);

    // Baseline to anchor the expected direction.
    const baseline = await fireForwardFromPosition(page, 0, 0);
    expect(baseline.projectile, 'Baseline at origin must fire').not.toBeNull();
    const baselineAz = baseline.projectile
      ? Math.atan2(baseline.projectile.linvel.x, baseline.projectile.linvel.z)
      : NaN;

    const positions: Array<{ label: string; x: number; z: number }> = [
      { label: 'far +X', x: 60, z: 0 },
      { label: 'far -X', x: -60, z: 0 },
      { label: 'far +Z', x: 0, z: 60 },
      { label: 'far -Z', x: 0, z: -60 },
      { label: 'far diagonal +X+Z', x: 45, z: 45 },
      { label: 'far diagonal -X-Z', x: -45, z: -45 },
    ];

    const failures: string[] = [];
    for (const p of positions) {
      await page.waitForTimeout(300); // Let cooldown elapse between shots.
      const res = await fireForwardFromPosition(page, p.x, p.z);
      if (res.quadrantAtFire !== 'fore') {
        failures.push(
          `${p.label} (${String(p.x)},${String(p.z)}): quadrantAtFire=${res.quadrantAtFire} (expected fore)`,
        );
        continue;
      }
      if (!res.projectile) {
        failures.push(`${p.label} (${String(p.x)},${String(p.z)}): no projectile spawned`);
        continue;
      }
      const az = Math.atan2(res.projectile.linvel.x, res.projectile.linvel.z);
      const drift = Math.abs(angularDelta(az, baselineAz));
      if (drift > 0.2) {
        failures.push(
          `${p.label} (${String(p.x)},${String(p.z)}): aim drift=${((drift * 180) / Math.PI).toFixed(1)}°`,
        );
      }
    }

    expect(failures, `Forward-fire failures:\n${failures.join('\n')}`).toEqual([]);
  });
});
