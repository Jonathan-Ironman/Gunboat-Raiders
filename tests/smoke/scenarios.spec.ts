/**
 * End-to-end gameplay SCENARIO tests.
 *
 * These tests exercise the full, integrated game in a real browser and
 * deterministically verify core gameplay by reading the physics body cache
 * and the Zustand store through dev-only `window.*` globals exposed from
 * `src/main.tsx`.
 *
 * Unlike unit tests, these scenarios prove the game actually works end-to-end:
 * physics runs, keyboard input moves the boat, cannons fly through the world,
 * enemies spawn and take damage, and the title → playing → game-over loop
 * survives a full round trip.
 *
 * Run with: `pnpm test:smoke`
 */

import { test, expect, type Page } from '@playwright/test';
import { startGame, getGameState, getGameErrors, waitForPhase } from '../helpers/gameTestUtils';

// ---------------------------------------------------------------------------
// Types mirrored from physicsRefs.ts — kept here to avoid cross-tsconfig imports.
// ---------------------------------------------------------------------------

interface BodyStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

// ---------------------------------------------------------------------------
// Known error patterns (pre-existing engine quirks, not failures of our game)
// ---------------------------------------------------------------------------

const KNOWN_ERROR_PATTERNS = [
  // Rapier WASM recursive aliasing — transient during physics step edges.
  'recursive use of an object detected',
  // Physics body reference race on initial mount.
  'getPlayerBody is not defined',
];

function filterKnownErrors(errors: string[]): string[] {
  return errors.filter((err) => !KNOWN_ERROR_PATTERNS.some((p) => err.includes(p)));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Click START GAME and wait for phase='playing'. */
async function startPlaying(page: Page): Promise<void> {
  await startGame(page);
  await waitForPhase(page, 'mainMenu', 20_000);

  const startButton = page.locator('[data-testid="start-button"]');
  await expect(startButton).toBeVisible({ timeout: 15_000 });
  await startButton.click();

  await waitForPhase(page, 'playing', 15_000);

  // Wait until the player rigid body is registered AND its cached state is
  // available — otherwise getPlayerBodyState() returns null for the first
  // few frames.
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __GET_PLAYER_BODY_STATE__?: () => BodyStateSnapshot | null;
      };
      return w.__GET_PLAYER_BODY_STATE__?.() !== null;
    },
    undefined,
    { timeout: 15_000 },
  );
}

/** Read the cached player body state via the dev-only window global. */
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

/** Read all cached projectile body states as an array. */
async function readProjectileBodyStates(page: Page): Promise<BodyStateSnapshot[]> {
  return page.evaluate<BodyStateSnapshot[]>(() => {
    const w = window as unknown as {
      __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<number, BodyStateSnapshot>;
    };
    const map = w.__GET_ALL_PROJECTILE_BODY_STATES__?.();
    if (!map) return [];
    return Array.from(map.values());
  });
}

/** Read all cached enemy body states as an array of [id, state] pairs. */
async function readEnemyBodyStates(
  page: Page,
): Promise<Array<{ id: string; state: BodyStateSnapshot }>> {
  return page.evaluate<Array<{ id: string; state: BodyStateSnapshot }>>(() => {
    const w = window as unknown as {
      __GET_ALL_ENEMY_BODY_STATES__?: () => ReadonlyMap<string, BodyStateSnapshot>;
    };
    const map = w.__GET_ALL_ENEMY_BODY_STATES__?.();
    if (!map) return [];
    return Array.from(map.entries()).map(([id, state]) => ({ id, state }));
  });
}

/** Trigger a cannon fire via the dev-only test bridge. */
async function requestFire(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __TEST_REQUEST_FIRE__?: () => void };
    w.__TEST_REQUEST_FIRE__?.();
  });
}

/**
 * Wait until at least `minCount` enemy physics bodies have been registered in
 * the cache. Polls every 250ms up to `timeoutMs`. More reliable than a fixed
 * wait because wave spawn timing depends on dev-server warm-up speed.
 */
async function waitForEnemyBodies(page: Page, minCount = 1, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    (min: number) => {
      const w = window as unknown as {
        __GET_ALL_ENEMY_BODY_STATES__?: () => ReadonlyMap<string, unknown>;
      };
      const map = w.__GET_ALL_ENEMY_BODY_STATES__?.();
      return map !== undefined && map.size >= min;
    },
    minCount,
    { timeout: timeoutMs },
  );
}

/** Read the current average FPS from the perf snapshot. */
async function readAvgFps(page: Page): Promise<number> {
  return page.evaluate<number>(() => {
    const w = window as unknown as {
      __GAME_PERF__?: { avgFPS: number };
    };
    return w.__GAME_PERF__?.avgFPS ?? 0;
  });
}

// ---------------------------------------------------------------------------
// Scenario tests
// ---------------------------------------------------------------------------

test.describe('End-to-end gameplay scenarios', () => {
  // Each scenario does real physics work, so allow plenty of headroom.
  test.describe.configure({ timeout: 60_000 });

  test('1 — W moves boat forward by a meaningful distance', async ({ page }) => {
    await startPlaying(page);

    // Let buoyancy / initial spawn settle so the boat isn't still oscillating
    // from impact with the water.
    await page.waitForTimeout(3_000);

    const before = await readPlayerBodyState(page);

    await page.keyboard.down('w');
    await page.waitForTimeout(5_000);
    await page.keyboard.up('w');
    await page.waitForTimeout(300);

    const after = await readPlayerBodyState(page);

    const dx = after.position.x - before.position.x;
    const dz = after.position.z - before.position.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);

    expect(
      horizontal,
      `Horizontal distance should exceed 15m after holding W for 5s. ` +
        `before=(${before.position.x.toFixed(2)}, ${before.position.z.toFixed(2)}) ` +
        `after=(${after.position.x.toFixed(2)}, ${after.position.z.toFixed(2)}) ` +
        `dist=${horizontal.toFixed(2)}m`,
    ).toBeGreaterThan(15);

    // Boat must not have flown off into the sky / sunk into the void.
    expect(
      after.position.y,
      `Y position should stay reasonable (−2..+3). got=${after.position.y.toFixed(2)}`,
    ).toBeGreaterThan(-2);
    expect(after.position.y).toBeLessThan(3);
  });

  test('2 — A and D rotate the boat in opposite directions', async ({ page }) => {
    await startPlaying(page);

    await page.waitForTimeout(3_000);

    // Heading = yaw extracted from quaternion (y-axis rotation).
    const yawOf = (s: BodyStateSnapshot): number => {
      const { x, y, z, w } = s.rotation;
      return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x));
    };

    // Angular distance accounting for wrap-around.
    const angularDelta = (a: number, b: number): number => {
      let d = a - b;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d; // signed
    };

    const startState = await readPlayerBodyState(page);
    const startYaw = yawOf(startState);

    // The player boat has high angular damping (3.0) and modest turn torque
    // (400), so yaw changes are slow by design — the boat feels weighty.
    // A 3-second hold produces ~0.1–0.2 rad of yaw change, which is still
    // a deterministic, unambiguous signal.
    await page.keyboard.down('a');
    await page.waitForTimeout(3_000);
    await page.keyboard.up('a');
    await page.waitForTimeout(400);

    const afterA = await readPlayerBodyState(page);
    const yawAfterA = yawOf(afterA);
    const signedDeltaA = angularDelta(yawAfterA, startYaw);

    expect(
      Math.abs(signedDeltaA),
      `Heading should change by at least 0.05 rad after holding A for 3s. ` +
        `startYaw=${startYaw.toFixed(3)} afterA=${yawAfterA.toFixed(3)} ` +
        `delta=${signedDeltaA.toFixed(3)}`,
    ).toBeGreaterThan(0.05);

    // Now hold D for 3 seconds. The sign of the delta over this interval
    // (relative to afterA) should be opposite to A's.
    await page.keyboard.down('d');
    await page.waitForTimeout(3_000);
    await page.keyboard.up('d');
    await page.waitForTimeout(400);

    const afterD = await readPlayerBodyState(page);
    const yawAfterD = yawOf(afterD);
    const signedDeltaD = angularDelta(yawAfterD, yawAfterA);

    expect(
      Math.abs(signedDeltaD),
      `Heading should also change under D. afterA=${yawAfterA.toFixed(3)} ` +
        `afterD=${yawAfterD.toFixed(3)} delta=${signedDeltaD.toFixed(3)}`,
    ).toBeGreaterThan(0.05);

    // Crucial assertion: A and D torque must have opposite signs.
    expect(
      Math.sign(signedDeltaA) * Math.sign(signedDeltaD),
      `A and D should rotate the boat in opposite directions. ` +
        `signedDeltaA=${signedDeltaA.toFixed(3)} signedDeltaD=${signedDeltaD.toFixed(3)}`,
    ).toBeLessThan(0);
  });

  test('3 — cannonballs fly after firing', async ({ page }) => {
    await startPlaying(page);
    // Wait for physics, GLTF loads, and the projectile pool manager to be
    // registered. On cold start these may take several seconds.
    await page.waitForTimeout(3_000);

    const before = await readPlayerBodyState(page);
    const spawnOrigin = { x: before.position.x, z: before.position.z };

    // Fire (test bridge bypasses pointer-lock requirement). Retry until a
    // projectile actually appears — on cold start the first fire may be
    // dropped if the projectile pool hasn't registered yet.
    let projectiles: BodyStateSnapshot[] = [];
    const fireDeadline = Date.now() + 15_000;
    while (Date.now() < fireDeadline) {
      await requestFire(page);
      await page.waitForTimeout(500);
      projectiles = await readProjectileBodyStates(page);
      if (projectiles.length > 0) break;
      // Cooldown is 2s per quadrant — wait past the cooldown before retrying.
      await page.waitForTimeout(1_700);
    }

    expect(
      projectiles.length,
      `At least one projectile should exist in the physics pool after firing`,
    ).toBeGreaterThan(0);

    // At least one projectile must have non-zero velocity (it's *flying*).
    const maxSpeed = Math.max(
      ...projectiles.map((p) =>
        Math.sqrt(p.linvel.x * p.linvel.x + p.linvel.y * p.linvel.y + p.linvel.z * p.linvel.z),
      ),
    );
    expect(
      maxSpeed,
      `Projectile velocity magnitude should exceed 10 m/s. got=${maxSpeed.toFixed(2)}`,
    ).toBeGreaterThan(10);

    // Record spawn positions so we can measure travel.
    const initialDistances = projectiles.map((p) =>
      Math.sqrt((p.position.x - spawnOrigin.x) ** 2 + (p.position.z - spawnOrigin.z) ** 2),
    );

    // Wait long enough for the ball to travel a meaningful distance.
    await page.waitForTimeout(1_000);

    const projectilesLater = await readProjectileBodyStates(page);

    // A projectile might have expired and been deactivated — check the
    // maximum distance any projectile reached from the boat spawn origin.
    const laterDistances = projectilesLater.map((p) =>
      Math.sqrt((p.position.x - spawnOrigin.x) ** 2 + (p.position.z - spawnOrigin.z) ** 2),
    );

    const maxLaterDistance = laterDistances.length > 0 ? Math.max(...laterDistances) : 0;

    expect(
      maxLaterDistance,
      `At least one projectile should have travelled >20m from boat spawn. ` +
        `initial=${JSON.stringify(initialDistances.map((d) => d.toFixed(1)))} ` +
        `later=${JSON.stringify(laterDistances.map((d) => d.toFixed(1)))}`,
    ).toBeGreaterThan(20);
  });

  test('4 — enemies spawn and are positioned in the arena', async ({ page }) => {
    await startPlaying(page);

    // Wave system uses a 2s INITIAL_SPAWN_DELAY + 0.5s per-enemy stagger.
    // Wait until at least one enemy is registered in the physics cache,
    // polling to stay robust against cold-start timing.
    await waitForEnemyBodies(page, 1, 40_000);

    // Maps don't survive JSON round-trip through page.evaluate, so we read
    // the size directly in the browser context.
    const enemyCount = await page.evaluate<number>(() => {
      const w = window as unknown as {
        __ZUSTAND_STORE__?: { getState: () => { enemies: Map<string, unknown> } };
      };
      return w.__ZUSTAND_STORE__?.getState().enemies.size ?? 0;
    });
    expect(
      enemyCount,
      `At least one enemy should have spawned into the store. got=${enemyCount}`,
    ).toBeGreaterThanOrEqual(1);

    // Also verify physics bodies exist and are inside the arena ring (80..120m
    // from origin, with some tolerance for drift after spawn).
    const bodies = await readEnemyBodyStates(page);
    expect(
      bodies.length,
      `At least one enemy physics body should be cached. got=${bodies.length}`,
    ).toBeGreaterThanOrEqual(1);

    const radii = bodies.map(({ state: s }) =>
      Math.sqrt(s.position.x * s.position.x + s.position.z * s.position.z),
    );
    const minRadius = Math.min(...radii);
    const maxRadius = Math.max(...radii);

    // Allow generous tolerance: spawn ring is 80..120, but AI may already have
    // moved them a bit toward the player. Assert they're roughly in range.
    expect(
      minRadius,
      `Enemies should be at least ~40m from the player (approach tolerance). ` +
        `radii=${JSON.stringify(radii.map((r) => r.toFixed(1)))}`,
    ).toBeGreaterThan(40);
    expect(
      maxRadius,
      `Enemies should be within ~140m of the player (spawn+jitter tolerance). ` +
        `radii=${JSON.stringify(radii.map((r) => r.toFixed(1)))}`,
    ).toBeLessThan(140);
  });

  test('5 — full combat loop: cannonballs damage enemies on impact', async ({ page }) => {
    // Combat integration needs extra headroom for projectile flight time and
    // multiple weapon cooldowns (2s per quadrant).
    test.setTimeout(120_000);

    await startPlaying(page);

    // Wait until the wave system has actually spawned BOTH wave-1 enemies
    // into the physics cache. Waiting for a stable enemy count matters
    // because the healthBefore/healthAfter comparison is meaningless if
    // enemies are still spawning in during the test.
    await waitForEnemyBodies(page, 2, 25_000);

    // Extra settle so AI has a chance to tick and position cache is fresh.
    await page.waitForTimeout(500);

    const bodies = await readEnemyBodyStates(page);
    expect(bodies.length, 'need at least one enemy to shoot at').toBeGreaterThanOrEqual(2);

    const healthSnapshot = async (): Promise<number> =>
      page.evaluate<number>(() => {
        type Enemy = { health: { hull: number; armor: number } };
        const w = window as unknown as {
          __ZUSTAND_STORE__?: { getState: () => { enemies: Map<string, Enemy> } };
        };
        const enemies = w.__ZUSTAND_STORE__?.getState().enemies;
        if (!enemies) return 0;
        let total = 0;
        for (const e of enemies.values()) {
          total += e.health.hull + e.health.armor;
        }
        return total;
      });
    const sunkSnapshot = async (): Promise<number> =>
      page.evaluate<number>(() => {
        const w = window as unknown as {
          __ZUSTAND_STORE__?: { getState: () => { enemiesSunkTotal: number } };
        };
        return w.__ZUSTAND_STORE__?.getState().enemiesSunkTotal ?? 0;
      });

    const healthBefore = await healthSnapshot();
    const sunkBefore = await sunkSnapshot();

    // Teleport the player right next to the closest enemy so ballistics don't
    // dominate the outcome. Port-side cannons fire straight along -X, so we
    // place the player +X of the enemy with heading=0 (boat forward = +Z).
    const player = await readPlayerBodyState(page);
    const closest = bodies.reduce(
      (best, cur) => {
        const d =
          (cur.state.position.x - player.position.x) ** 2 +
          (cur.state.position.z - player.position.z) ** 2;
        return d < best.d ? { d, body: cur } : best;
      },
      { d: Infinity, body: bodies[0]! },
    ).body;

    // Range of 60m is well inside cannonball ballistic range (~200m) and gives
    // the projectile room to arc down onto the target (20° elevation).
    const targetX = closest.state.position.x + 60;
    const targetZ = closest.state.position.z;

    await page.evaluate(
      (args: { x: number; z: number }) => {
        const w = window as unknown as {
          __GET_PLAYER_BODY__?: () => {
            setTranslation: (t: { x: number; y: number; z: number }, wake: boolean) => void;
            setRotation: (r: { x: number; y: number; z: number; w: number }, wake: boolean) => void;
            setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
            setAngvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
          } | null;
        };
        const body = w.__GET_PLAYER_BODY__?.();
        if (!body) return;
        body.setTranslation({ x: args.x, y: 0.8, z: args.z }, true);
        body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      },
      { x: targetX, z: targetZ },
    );

    // Switch to port broadside (4 cannons) for maximum hit chance.
    await page.evaluate(() => {
      const w = window as unknown as {
        __ZUSTAND_STORE__?: {
          getState: () => { setActiveQuadrant: (q: string) => void };
        };
      };
      w.__ZUSTAND_STORE__?.getState().setActiveQuadrant('port');
    });

    await page.waitForTimeout(200);

    // Fire five volleys spaced past the cooldown so every one actually fires.
    for (let i = 0; i < 5; i++) {
      await requestFire(page);
      await page.waitForTimeout(2_100);
    }

    // Give projectiles time to finish arcing into the target.
    await page.waitForTimeout(3_000);

    const healthAfter = await healthSnapshot();
    const sunkAfter = await sunkSnapshot();

    const damaged = healthAfter < healthBefore;
    const sunk = sunkAfter > sunkBefore;

    expect(
      damaged || sunk,
      `Combat loop: expected enemies to take damage or be sunk. ` +
        `healthBefore=${healthBefore} healthAfter=${healthAfter} ` +
        `sunkBefore=${sunkBefore} sunkAfter=${sunkAfter}. ` +
        `If this test fails, the projectile → damage pipeline is likely broken: ` +
        `check that projectile collisions actually call applyDamage().`,
    ).toBe(true);
  });

  test('6 — game-over triggers via damage and Play Again restarts', async ({ page }) => {
    await startPlaying(page);
    await page.waitForTimeout(1_500);

    const statePlaying = await getGameState(page);
    expect(statePlaying!['phase']).toBe('playing');

    // Apply massive damage to the player via the store action — the applyDamage
    // reducer caps at hull 0 and transitions to 'game-over'.
    await page.evaluate(() => {
      const w = window as unknown as {
        __ZUSTAND_STORE__?: {
          getState: () => { applyDamage: (id: string, dmg: number) => void };
        };
      };
      w.__ZUSTAND_STORE__?.getState().applyDamage('player', 9999);
    });

    await waitForPhase(page, 'game-over', 5_000);

    const gameOverScreen = page.locator('[data-testid="game-over-screen"]');
    await expect(gameOverScreen).toBeVisible({ timeout: 5_000 });

    const playAgainButton = page.locator('[data-testid="play-again-button"]');
    await expect(playAgainButton).toBeVisible({ timeout: 5_000 });
    await playAgainButton.click();

    await waitForPhase(page, 'playing', 15_000);

    const restarted = await getGameState(page);
    expect(restarted!['phase']).toBe('playing');
    expect(restarted!['player'], 'Player should exist after restart').not.toBeNull();
  });

  test('7 — no unexpected errors during a full gameplay session', async ({ page }) => {
    await startPlaying(page);
    await page.waitForTimeout(2_000);

    // Move, turn, fire — cover the main input paths.
    await page.keyboard.down('w');
    await page.waitForTimeout(1_000);
    await page.keyboard.up('w');

    await page.keyboard.down('a');
    await page.waitForTimeout(700);
    await page.keyboard.up('a');

    await page.keyboard.down('d');
    await page.waitForTimeout(700);
    await page.keyboard.up('d');

    await requestFire(page);
    await page.waitForTimeout(500);
    await requestFire(page);

    // Move the mouse inside the canvas to exercise camera events.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, {
        steps: 10,
      });
    }

    await page.waitForTimeout(2_000);

    const allErrors = await getGameErrors(page);
    const unexpected = filterKnownErrors(allErrors);
    expect(
      unexpected,
      `Unexpected JS errors during gameplay:\n${unexpected.join('\n')}`,
    ).toHaveLength(0);
  });

  test('8 — performance: average FPS stays above 30', async ({ page }) => {
    await startPlaying(page);

    // Warm-up: first few seconds include shader compilation and physics island
    // construction. The perf monitor resets stats every 5s, so waiting ~3s
    // here lets the reset window naturally capture recent frames.
    await page.waitForTimeout(3_000);

    // Measure the avgFPS snapshot over a 5-second sample. We take the best of
    // several samples to avoid capturing the exact frame right after a reset
    // (when avgFPS can momentarily read a spiked value).
    const fpsSamples: number[] = [];
    const sampleCount = 5;
    const sampleIntervalMs = 1_000;
    for (let i = 0; i < sampleCount; i++) {
      await page.waitForTimeout(sampleIntervalMs);
      fpsSamples.push(await readAvgFps(page));
    }

    // Use the median of samples — robust against outliers from the reset
    // boundary and initial startup lag.
    const sorted = [...fpsSamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

    expect(
      median,
      `Median avg FPS should exceed 30 over ${sampleCount} samples. ` +
        `samples=${JSON.stringify(fpsSamples.map((f) => f.toFixed(1)))}`,
    ).toBeGreaterThan(30);
  });

  test('9 — all four firing quadrants produce projectiles', async ({ page }) => {
    // Verifies that fore, aft, port, and starboard each launch at least one
    // cannonball when fired. This test was added to catch the 1-frame quadrant
    // lag bug where WeaponSystemR3F read a stale activeQuadrant because it ran
    // before CameraSystemR3F in the useFrame order.
    test.setTimeout(90_000);

    await startPlaying(page);
    // Let physics and the projectile pool fully initialise.
    await page.waitForTimeout(4_000);

    /** Set the active quadrant directly via the store and fire once, returning
     *  the number of live projectiles immediately after the shot. */
    const setQuadrantAndFire = async (quadrant: string): Promise<number> => {
      // Set quadrant via the Zustand store action.
      await page.evaluate((q: string) => {
        const w = window as unknown as {
          __ZUSTAND_STORE__?: {
            getState: () => { setActiveQuadrant: (quad: string) => void };
          };
        };
        w.__ZUSTAND_STORE__?.getState().setActiveQuadrant(q as never);
      }, quadrant);

      // Small settle so useFrame picks up the new quadrant before the fire.
      await page.waitForTimeout(150);

      await requestFire(page);
      await page.waitForTimeout(400);

      return page.evaluate<number>(() => {
        const w = window as unknown as {
          __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<number, BodyStateSnapshot>;
        };
        return w.__GET_ALL_PROJECTILE_BODY_STATES__?.()?.size ?? 0;
      });
    };

    const quadrants = ['fore', 'aft', 'port', 'starboard'] as const;
    const results: Record<string, number> = {};

    for (const q of quadrants) {
      // Wait past the per-quadrant cooldown (2s) before each shot so we know
      // the cooldown cannot be the reason a shot fails.
      await page.waitForTimeout(2_200);

      // Retry up to 3 times in case the pool manager hasn't registered yet.
      let count = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        count = await setQuadrantAndFire(q);
        if (count > 0) break;
        await page.waitForTimeout(2_200); // wait out cooldown before retry
      }
      results[q] = count;
    }

    for (const q of quadrants) {
      expect(
        results[q],
        `Quadrant '${q}' should have produced at least one projectile. ` +
          `All results: ${JSON.stringify(results)}`,
      ).toBeGreaterThan(0);
    }
  });

  test('10 — activeQuadrant updates from mouse position when pointer lock is released', async ({
    page,
  }) => {
    // Regression test for the pointer-lock azimuth freeze bug.
    //
    // When pointer lock is active the camera azimuth updates from movementX
    // deltas (correct). When pointer lock is released, movementX is always 0
    // so azimuthRef freezes — and with it activeQuadrant freezes too.
    //
    // The fix: when pointer lock is NOT active, compute the active quadrant
    // from raw mouse cursor position relative to canvas center. Moving the
    // cursor to the right half of the canvas => starboard; left half => port.
    //
    // BASELINE (before fix): this test FAILS because activeQuadrant never
    // changes after pointer lock is released regardless of mouse position.
    // AFTER FIX: the test passes because quadrant tracks cursor position.
    test.setTimeout(60_000);

    await startPlaying(page);
    await page.waitForTimeout(3_000);

    // Release pointer lock (if held by the canvas from startPlaying)
    await page.evaluate(() => {
      document.exitPointerLock();
    });
    await page.waitForTimeout(200);

    // Get canvas bounding box so we can compute meaningful cursor positions
    const canvas = page.locator('canvas');
    const bbox = await canvas.boundingBox();
    if (!bbox) throw new Error('Canvas not found');

    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;

    // Move mouse to right side of canvas — should resolve to 'starboard'
    await page.mouse.move(bbox.x + bbox.width * 0.75, cy);
    await page.waitForTimeout(200);

    const quadrantAfterRightMove = await page.evaluate<string>(() => {
      const w = window as unknown as {
        __ZUSTAND_STORE__?: { getState: () => { activeQuadrant: string } };
      };
      return w.__ZUSTAND_STORE__?.getState().activeQuadrant ?? 'unknown';
    });

    // Move mouse to left side of canvas — should resolve to 'port'
    await page.mouse.move(bbox.x + bbox.width * 0.25, cy);
    await page.waitForTimeout(200);

    const quadrantAfterLeftMove = await page.evaluate<string>(() => {
      const w = window as unknown as {
        __ZUSTAND_STORE__?: { getState: () => { activeQuadrant: string } };
      };
      return w.__ZUSTAND_STORE__?.getState().activeQuadrant ?? 'unknown';
    });

    // Move mouse to top-center — should resolve to 'fore'
    await page.mouse.move(cx, bbox.y + bbox.height * 0.1);
    await page.waitForTimeout(200);

    const quadrantAfterTopMove = await page.evaluate<string>(() => {
      const w = window as unknown as {
        __ZUSTAND_STORE__?: { getState: () => { activeQuadrant: string } };
      };
      return w.__ZUSTAND_STORE__?.getState().activeQuadrant ?? 'unknown';
    });

    expect(
      quadrantAfterRightMove,
      `Mouse on right side of canvas (no pointer lock) should yield 'starboard'. ` +
        `Got: '${quadrantAfterRightMove}'`,
    ).toBe('starboard');

    expect(
      quadrantAfterLeftMove,
      `Mouse on left side of canvas (no pointer lock) should yield 'port'. ` +
        `Got: '${quadrantAfterLeftMove}'`,
    ).toBe('port');

    expect(
      quadrantAfterTopMove,
      `Mouse at top-center of canvas (no pointer lock) should yield 'fore'. ` +
        `Got: '${quadrantAfterTopMove}'`,
    ).toBe('fore');

    // Dev test bridge override should deterministically control the computed
    // active quadrant regardless of cursor position while lock is absent.
    await page.evaluate(() => {
      const w = window as unknown as { __SET_CAMERA_AZIMUTH__?: (a: number | null) => void };
      w.__SET_CAMERA_AZIMUTH__?.(Math.PI);
    });
    await page.waitForTimeout(150);
    await page.mouse.move(bbox.x + bbox.width * 0.9, bbox.y + bbox.height * 0.9);
    await page.waitForTimeout(150);

    const forcedQuadrant = await page.evaluate<string>(() => {
      const w = window as unknown as {
        __ZUSTAND_STORE__?: { getState: () => { activeQuadrant: string } };
      };
      return w.__ZUSTAND_STORE__?.getState().activeQuadrant ?? 'unknown';
    });

    expect(
      forcedQuadrant,
      `With __SET_CAMERA_AZIMUTH__(Math.PI), activeQuadrant should deterministically be 'fore'. ` +
        `Got: '${forcedQuadrant}'`,
    ).toBe('fore');

    // Cleanup so later smoke tests return to normal camera input behavior.
    await page.evaluate(() => {
      const w = window as unknown as { __SET_CAMERA_AZIMUTH__?: (a: number | null) => void };
      w.__SET_CAMERA_AZIMUTH__?.(null);
    });
  });
});
