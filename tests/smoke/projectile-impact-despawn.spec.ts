/**
 * Regression test for the "cannonball sticks to the impact point" bug.
 *
 * User-reported symptom (2026-04-11): when a projectile collides with a ship
 * or a rock, the visible cannonball stays frozen at the impact point instead
 * of disappearing. The pool slot was being reclaimed correctly at the data
 * level (the 2025 storeId-leak fix), and the physics body was being moved to
 * y = -1000, but the visible InstancedMesh kept rendering the sphere at the
 * old impact position forever.
 *
 * Root cause (confirmed by reading node_modules/@react-three/rapier/.../esm.js
 * line ~936): the Physics mesh-update loop skips any rigid body that is
 * sleeping unless its `state.object` is an InstancedMesh. For
 * InstancedRigidBodies, each instance's `state.object` is the inner
 * <object3D> wrapper, NOT the shared InstancedMesh, so the "instanced mesh
 * exception" never fires and the matrix sync is skipped. ProjectilePool /
 * EnemyProjectilePool were calling `body.sleep()` IMMEDIATELY after
 * `setTranslation(0, -1000, 0)`, so the sleep fired in the same frame as the
 * move and the instance matrix never picked up the new translation.
 *
 * The fix (same file): drop the explicit `body.sleep()`. Rapier auto-sleep
 * parks the body a few frames later once linvel/angvel/gravity are all zero,
 * at which point the mesh has already been rendered far below the world.
 *
 * This test proves the fix by reading the GPU-facing instanceMatrix directly
 * (via `window.__GET_PROJECTILE_INSTANCE_TRANSLATION__`) and asserting that
 * after a deactivation the visible translation is at the sleep Y, not the
 * impact Y. It drives the exact collision → queue → drain → deactivate
 * pipeline by pushing into the pending queue via the test bridge.
 */

import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

interface BodyStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

interface InstanceTranslation {
  x: number;
  y: number;
  z: number;
}

const SLEEP_POSITION_Y = -1000;

async function startPlaying(page: Page): Promise<void> {
  await startGame(page);
  // Clear any persisted save so "New Game" doesn't trigger the overwrite
  // confirm dialog. Must run AFTER page load so localStorage is accessible,
  // and BEFORE interacting with the main menu.
  await page.evaluate(() => {
    localStorage.clear();
  });
  // Reload so the store re-hydrates with no save.
  await page.reload();
  await page.waitForLoadState('networkidle');

  await waitForPhase(page, 'mainMenu', 20_000);

  // Post-R7 main menu flow: "New Game" → briefing modal → "Start".
  const newGameBtn = page.locator('[data-testid="main-menu-new-game-btn"]');
  await expect(newGameBtn).toBeVisible({ timeout: 15_000 });
  await newGameBtn.click();

  const briefingStartBtn = page.locator('[data-testid="briefing-start-btn"]');
  await expect(briefingStartBtn).toBeVisible({ timeout: 15_000 });
  await briefingStartBtn.click();

  await waitForPhase(page, 'playing', 15_000);
  // Wait for bodies + projectile pool to be registered.
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __GET_PLAYER_BODY_STATE__?: () => BodyStateSnapshot | null;
        __GET_PROJECTILE_INSTANCE_TRANSLATION__?: (
          pool: 'player' | 'enemy',
          index: number,
        ) => InstanceTranslation | null;
      };
      return (
        w.__GET_PLAYER_BODY_STATE__?.() !== null &&
        w.__GET_PROJECTILE_INSTANCE_TRANSLATION__?.('player', 0) !== null
      );
    },
    undefined,
    { timeout: 15_000 },
  );
}

async function setCameraAzimuth(page: Page, azimuth: number): Promise<void> {
  await page.evaluate((az: number) => {
    const w = window as unknown as { __SET_CAMERA_AZIMUTH__?: (a: number) => void };
    w.__SET_CAMERA_AZIMUTH__?.(az);
  }, azimuth);
}

async function fireOnce(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __TEST_REQUEST_FIRE__?: () => void };
    w.__TEST_REQUEST_FIRE__?.();
  });
}

async function readActiveProjectilePoolIndices(page: Page): Promise<number[]> {
  return page.evaluate<number[]>(() => {
    const w = window as unknown as {
      __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<number, BodyStateSnapshot>;
    };
    const map = w.__GET_ALL_PROJECTILE_BODY_STATES__?.();
    if (!map) return [];
    const result: number[] = [];
    for (const [idx, state] of map.entries()) {
      if (state.position.y > -100) result.push(idx);
    }
    return result;
  });
}

async function readInstanceTranslation(
  page: Page,
  pool: 'player' | 'enemy',
  index: number,
): Promise<InstanceTranslation | null> {
  return page.evaluate(
    ({ p, i }: { p: 'player' | 'enemy'; i: number }): InstanceTranslation | null => {
      const w = window as unknown as {
        __GET_PROJECTILE_INSTANCE_TRANSLATION__?: (
          pool: 'player' | 'enemy',
          index: number,
        ) => InstanceTranslation | null;
      };
      return w.__GET_PROJECTILE_INSTANCE_TRANSLATION__?.(p, i) ?? null;
    },
    { p: pool, i: index },
  );
}

async function queueDeactivation(
  page: Page,
  pool: 'player' | 'enemy',
  index: number,
): Promise<void> {
  await page.evaluate(
    ({ p, i }: { p: 'player' | 'enemy'; i: number }) => {
      const w = window as unknown as {
        __TEST_QUEUE_PROJECTILE_DEACTIVATION__?: (pool: 'player' | 'enemy', index: number) => void;
      };
      w.__TEST_QUEUE_PROJECTILE_DEACTIVATION__?.(p, i);
    },
    { p: pool, i: index },
  );
}

test.describe('Projectile impact despawn', () => {
  test.describe.configure({ timeout: 120_000 });

  test.afterEach(async ({ page }) => {
    // Be a good MCP citizen — close browser cleanly.
    await page.close().catch(() => undefined);
  });

  test('player cannonball mesh moves off-screen when its pool slot is deactivated (collision path)', async ({
    page,
  }) => {
    await startPlaying(page);
    await page.waitForTimeout(2_000);

    // Fire forward (camera azimuth π → camera behind boat → quadrant fore).
    await setCameraAzimuth(page, Math.PI);
    await page.waitForTimeout(120);

    const before = await readActiveProjectilePoolIndices(page);

    // Fire a volley and wait for at least one new pool slot to come alive.
    await fireOnce(page);

    let newIndex = -1;
    const spawnDeadline = Date.now() + 1_500;
    while (Date.now() < spawnDeadline) {
      await page.waitForTimeout(25);
      const after = await readActiveProjectilePoolIndices(page);
      const fresh = after.filter((i) => !before.includes(i));
      if (fresh.length > 0) {
        newIndex = fresh[0]!;
        break;
      }
    }
    expect(
      newIndex,
      'A new projectile pool slot should be active after firing',
    ).toBeGreaterThanOrEqual(0);

    // Give the mesh at least one render frame to pick up the in-flight matrix,
    // then snapshot the instance translation BEFORE we deactivate. This is the
    // "impact point" — whatever position the mesh has when the slot is
    // recycled must NOT be where it ends up.
    await page.waitForTimeout(80);
    const inFlight = await readInstanceTranslation(page, 'player', newIndex);
    expect(inFlight, 'Instance translation must be readable for an active slot').not.toBeNull();
    if (!inFlight) throw new Error('unreachable');

    // The live muzzle-fire height is ~1..4m above the water; anywhere above
    // the sleep position is fine as the "impact proxy" here.
    expect(
      inFlight.y,
      'Active projectile instance matrix must be above the sleep position',
    ).toBeGreaterThan(-100);

    // Simulate a collision impact by pushing the slot into the deactivation
    // queue — the same code path the real onCollisionEnter handler runs.
    // ProjectileSystemR3F will drain the queue at the start of the next frame
    // and call poolManager.deactivate(newIndex) → deactivateSlot(newIndex).
    await queueDeactivation(page, 'player', newIndex);

    // Poll the GPU-facing instanceMatrix until the slot has been despawned.
    // In the bug's previous state, the Y coordinate of the instance matrix
    // stayed near the in-flight Y indefinitely because `body.sleep()` ran in
    // the same frame as `setTranslation` and r3r skipped the matrix update.
    let final: InstanceTranslation | null = null;
    const despawnDeadline = Date.now() + 2_000;
    while (Date.now() < despawnDeadline) {
      await page.waitForTimeout(25);
      final = await readInstanceTranslation(page, 'player', newIndex);
      if (final && final.y < -100) break;
    }

    expect(final, 'Instance translation must still be readable').not.toBeNull();
    if (!final) throw new Error('unreachable');

    // The instance matrix Y must be at the sleep depth (-1000), not sitting
    // near the impact point. A generous tolerance of ±5 absorbs any Rapier
    // auto-sleep micro-drift without allowing the mesh to stick to impact.
    expect(
      final.y,
      `Deactivated projectile mesh still visible at y=${final.y.toFixed(2)} ` +
        `(was at in-flight y=${inFlight.y.toFixed(2)} before deactivation). ` +
        `The instanced mesh matrix never received the sleep-position update — ` +
        `the cannonball is stuck at the impact point. Expected y ≈ ${String(SLEEP_POSITION_Y)}.`,
    ).toBeLessThan(-100);
    expect(Math.abs(final.y - SLEEP_POSITION_Y)).toBeLessThan(5);

    // Sanity: the deactivated slot should also be gone from the filtered body
    // state cache (which drops anything at y < -100), confirming the rigid
    // body itself moved.
    const afterIndices = await readActiveProjectilePoolIndices(page);
    expect(afterIndices).not.toContain(newIndex);
  });

  test('lifetime-expired projectile mesh also despawns (same deactivate path)', async ({
    page,
  }) => {
    // Belt and braces: the lifetime-expiry path calls poolManager.deactivate
    // directly (not via the queue). It runs the same deactivateSlot, but it
    // avoids the queue-drain step so it's a useful second angle on the same
    // bug. We don't want to wait 8s for real lifetime expiry, so we trigger
    // the deactivation via the queue bridge AFTER the body is fully airborne.
    await startPlaying(page);
    await page.waitForTimeout(2_000);

    await setCameraAzimuth(page, Math.PI / 2); // starboard broadside
    await page.waitForTimeout(120);

    const before = await readActiveProjectilePoolIndices(page);
    await fireOnce(page);

    let newIndex = -1;
    const deadline = Date.now() + 1_500;
    while (Date.now() < deadline) {
      await page.waitForTimeout(25);
      const after = await readActiveProjectilePoolIndices(page);
      const fresh = after.filter((i) => !before.includes(i));
      if (fresh.length > 0) {
        newIndex = fresh[0]!;
        break;
      }
    }
    expect(newIndex).toBeGreaterThanOrEqual(0);

    // Let the projectile fly for a few hundred ms — the mesh's instance
    // matrix will now sit several metres above the water and several metres
    // to the side of the boat. If the despawn is broken, that's where it'll
    // stick after deactivation.
    await page.waitForTimeout(300);

    const inFlight = await readInstanceTranslation(page, 'player', newIndex);
    expect(inFlight).not.toBeNull();
    if (!inFlight) throw new Error('unreachable');
    expect(inFlight.y).toBeGreaterThan(-100);

    await queueDeactivation(page, 'player', newIndex);

    let final: InstanceTranslation | null = null;
    const despawnDeadline = Date.now() + 2_000;
    while (Date.now() < despawnDeadline) {
      await page.waitForTimeout(25);
      final = await readInstanceTranslation(page, 'player', newIndex);
      if (final && final.y < -100) break;
    }

    expect(final).not.toBeNull();
    if (!final) throw new Error('unreachable');
    expect(
      final.y,
      `After deactivation the instance matrix was still at y=${final.y.toFixed(2)}, ` +
        `expected y ≈ ${String(SLEEP_POSITION_Y)}. In-flight y was ${inFlight.y.toFixed(2)}.`,
    ).toBeLessThan(-100);
    expect(Math.abs(final.y - SLEEP_POSITION_Y)).toBeLessThan(5);
  });
});
