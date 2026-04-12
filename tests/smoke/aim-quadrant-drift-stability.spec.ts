import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

type Quadrant = 'fore' | 'aft' | 'port' | 'starboard';

interface AimDebugSnapshot {
  boatWorldPosition: { x: number; y: number; z: number };
  boatHeading: number;
  pointerLocked: boolean;
  cameraAzimuth: number;
  cameraElevation: number;
  cameraAngle: number;
  aimRelative: number;
  activeQuadrant: Quadrant;
}

interface AimLineDebugSnapshot {
  visible: boolean;
  quadrant: Quadrant | null;
  activeSteps: number;
  frustumCulled: boolean;
  renderedLastFrame: boolean;
}

interface BodyStatePatch {
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  linvel?: { x: number; y: number; z: number };
  angvel?: { x: number; y: number; z: number };
}

interface SnapshotBundle {
  aim: AimDebugSnapshot | null;
  line: AimLineDebugSnapshot | null;
}

interface ProjectileStateSnapshot {
  idx: number;
  position: { x: number; y: number; z: number };
  linvel: { x: number; y: number; z: number };
  instance: { x: number; y: number; z: number } | null;
}

interface ProjectileRenderDebugSnapshot {
  renderedLastFrame: boolean;
  frustumCulled: boolean;
  activeCount: number;
}

const FORE_LINE_REPRO_POSE: BodyStatePatch = {
  position: { x: -2.3041486740112305, y: -1.19098961353302, z: 25.820390701293945 },
  rotation: {
    x: -0.04774694889783859,
    y: -0.12168444693088531,
    z: -0.02384580858051777,
    w: 0.9911329746246338,
  },
  linvel: { x: 0, y: 0, z: 0 },
  angvel: { x: 0, y: 0, z: 0 },
};

function horizontalDistance(
  from: AimDebugSnapshot['boatWorldPosition'],
  to: AimDebugSnapshot['boatWorldPosition'],
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return Math.sqrt(dx * dx + dz * dz);
}

async function startPlaying(page: Page): Promise<void> {
  await startGame(page);
  // Start from a clean boot flow so "New Game" never routes through the
  // overwrite confirm and the test exercises the current menu UX.
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  await waitForPhase(page, 'mainMenu', 20_000);

  const newGameBtn = page.locator('[data-testid="main-menu-new-game-btn"]');
  await expect(newGameBtn).toBeVisible({ timeout: 15_000 });
  await newGameBtn.click();

  const briefingStartBtn = page.locator('[data-testid="briefing-start-btn"]');
  await expect(briefingStartBtn).toBeVisible({ timeout: 15_000 });
  await briefingStartBtn.click();

  await waitForPhase(page, 'playing', 15_000);
  await page.waitForFunction(
    () =>
      (window as { __GET_PLAYER_BODY_STATE__?: () => unknown }).__GET_PLAYER_BODY_STATE__?.() !==
      null,
    undefined,
    { timeout: 15_000 },
  );
}

async function setCameraAzimuth(page: Page, azimuth: number): Promise<void> {
  await page.evaluate((az: number) => {
    (window as { __SET_CAMERA_AZIMUTH__?: (a: number) => void }).__SET_CAMERA_AZIMUTH__?.(az);
  }, azimuth);
}

async function patchPlayerBodyState(page: Page, patch: BodyStatePatch): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const applied = await page.evaluate((nextPatch: BodyStatePatch) => {
      return (
        (
          window as {
            __TEST_PATCH_PLAYER_BODY_STATE__?: (patch: BodyStatePatch) => boolean;
          }
        ).__TEST_PATCH_PLAYER_BODY_STATE__?.(nextPatch) ?? false
      );
    }, patch);

    if (applied) return;
    await page.waitForTimeout(25);
  }

  expect(false, 'Expected player body patch bridge to succeed within the retry window.').toBe(true);
}

async function acquirePointerLock(page: Page): Promise<void> {
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await canvas.click({ position: { x: 320, y: 180 } });
  await page.waitForFunction(
    () => (window as { __AIM_DEBUG__?: AimDebugSnapshot }).__AIM_DEBUG__?.pointerLocked === true,
    undefined,
    { timeout: 5_000 },
  );
  // Let the camera + trajectory visuals settle for a frame or two after the
  // browser confirms pointer lock, so screenshots reflect what a player sees.
  await page.waitForTimeout(200);
}

async function captureDebug(page: Page): Promise<SnapshotBundle> {
  return page.evaluate(() => {
    const w = window as {
      __AIM_DEBUG__?: AimDebugSnapshot;
      __AIM_LINE_VISIBLE__?: AimLineDebugSnapshot;
    };
    return {
      aim: w.__AIM_DEBUG__ ?? null,
      line: w.__AIM_LINE_VISIBLE__ ?? null,
    };
  });
}

async function activeProjectileSlots(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const map = (
      window as {
        __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<number, { position: { y: number } }>;
      }
    ).__GET_ALL_PROJECTILE_BODY_STATES__?.();
    if (!map) return [];
    const out: number[] = [];
    for (const [idx, state] of map.entries()) {
      if (state.position.y > -100) out.push(idx);
    }
    return out;
  });
}

async function readLiveProjectiles(page: Page): Promise<ProjectileStateSnapshot[]> {
  return page.evaluate(() => {
    const map = (
      window as {
        __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<
          number,
          {
            position: { x: number; y: number; z: number };
            linvel: { x: number; y: number; z: number };
          }
        >;
      }
    ).__GET_ALL_PROJECTILE_BODY_STATES__?.();
    if (!map) return [];
    const out: ProjectileStateSnapshot[] = [];
    for (const [idx, state] of map.entries()) {
      if (state.position.y > -100) {
        out.push({
          idx,
          position: state.position,
          linvel: state.linvel,
          instance:
            (
              window as {
                __GET_PROJECTILE_INSTANCE_TRANSLATION__?: (
                  pool: 'player' | 'enemy',
                  index: number,
                ) => { x: number; y: number; z: number } | null;
              }
            ).__GET_PROJECTILE_INSTANCE_TRANSLATION__?.('player', idx) ?? null,
        });
      }
    }
    return out;
  });
}

async function captureProjectileRenderDebug(
  page: Page,
): Promise<ProjectileRenderDebugSnapshot | null> {
  return page.evaluate(() => {
    return (
      (
        window as {
          __PLAYER_PROJECTILE_RENDER_DEBUG__?: ProjectileRenderDebugSnapshot;
        }
      ).__PLAYER_PROJECTILE_RENDER_DEBUG__ ?? null
    );
  });
}

async function clickCanvasToFire(page: Page): Promise<void> {
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await canvas.click({ position: { x: 320, y: 180 } });
}

async function setQuadrantAim(page: Page, quadrant: Quadrant): Promise<void> {
  const applied = await page.evaluate((targetQuadrant: Quadrant) => {
    const aim = (window as { __AIM_DEBUG__?: AimDebugSnapshot }).__AIM_DEBUG__;
    if (!aim) return false;
    const centerAngleByQuadrant: Record<Quadrant, number> = {
      fore: 0,
      starboard: Math.PI / 2,
      aft: Math.PI,
      port: -Math.PI / 2,
    };
    const desiredCameraAngle = aim.boatHeading + centerAngleByQuadrant[targetQuadrant];
    const desiredAzimuth = desiredCameraAngle + Math.PI;
    (window as { __SET_CAMERA_AZIMUTH__?: (a: number) => void }).__SET_CAMERA_AZIMUTH__?.(
      desiredAzimuth,
    );
    return true;
  }, quadrant);

  expect(applied, `Expected to compute a forced camera azimuth for ${quadrant}.`).toBe(true);
  await page.waitForFunction(
    (targetQuadrant: Quadrant) =>
      (window as { __AIM_DEBUG__?: AimDebugSnapshot }).__AIM_DEBUG__?.activeQuadrant ===
      targetQuadrant,
    quadrant,
    { timeout: 5_000 },
  );
  await page.waitForTimeout(200);
}

async function clearLiveProjectiles(page: Page): Promise<void> {
  const liveSlots = await activeProjectileSlots(page);
  if (liveSlots.length === 0) return;

  await page.evaluate((indices: number[]) => {
    const queue = (
      window as {
        __TEST_QUEUE_PROJECTILE_DEACTIVATION__?: (pool: 'player' | 'enemy', index: number) => void;
      }
    ).__TEST_QUEUE_PROJECTILE_DEACTIVATION__;
    for (const index of indices) {
      queue?.('player', index);
    }
  }, liveSlots);

  await page.waitForFunction(
    () => {
      const map = (
        window as {
          __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<
            number,
            { position: { y: number } }
          >;
        }
      ).__GET_ALL_PROJECTILE_BODY_STATES__?.();
      if (!map) return true;
      for (const [, state] of map.entries()) {
        if (state.position.y > -100) return false;
      }
      return true;
    },
    undefined,
    { timeout: 5_000 },
  );
}

async function fireAndAssertSpawn(page: Page, label: string): Promise<void> {
  const before = new Set(await activeProjectileSlots(page));
  await page.evaluate(() => {
    (window as { __TEST_REQUEST_FIRE__?: () => void }).__TEST_REQUEST_FIRE__?.();
  });

  const spawned = await page.waitForFunction(
    (beforeList: number[]) => {
      const map = (
        window as {
          __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<
            number,
            { position: { y: number } }
          >;
        }
      ).__GET_ALL_PROJECTILE_BODY_STATES__?.();
      if (!map) return false;
      const baseline = new Set(beforeList);
      for (const [idx, state] of map.entries()) {
        if (state.position.y > -100 && !baseline.has(idx)) return true;
      }
      return false;
    },
    [...before],
    { timeout: 1_500 },
  );

  expect(spawned, `${label}: expected a new projectile slot after fire request.`).toBeTruthy();
}

function toDebugString(bundle: SnapshotBundle): string {
  return JSON.stringify(bundle, null, 2);
}

async function exerciseQuadrantAtCurrentPose(
  page: Page,
  quadrant: Quadrant,
  screenshotStem: string,
  testInfo: { outputPath: (pathSegment: string) => string },
): Promise<void> {
  await clearLiveProjectiles(page);
  await setQuadrantAim(page, quadrant);

  const before = await captureDebug(page);
  expect(before.aim, `Expected aim debug for ${screenshotStem}.`).not.toBeNull();
  expect(before.line, `Expected aim line debug for ${screenshotStem}.`).not.toBeNull();
  expect(
    before.line?.visible,
    `${screenshotStem}: expected the aim line to be logically visible before firing.`,
  ).toBe(true);
  expect(
    before.line?.renderedLastFrame,
    `${screenshotStem}: expected the aim line mesh to have rendered before firing.`,
  ).toBe(true);
  expect(
    before.aim?.activeQuadrant,
    `${screenshotStem}: expected the camera bridge to select the requested quadrant.`,
  ).toBe(quadrant);

  const beforeSlots = new Set(await activeProjectileSlots(page));
  await clickCanvasToFire(page);

  const spawned = await page.waitForFunction(
    (existingSlots: number[]) => {
      const map = (
        window as {
          __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<
            number,
            { position: { y: number } }
          >;
        }
      ).__GET_ALL_PROJECTILE_BODY_STATES__?.();
      if (!map) return false;
      const baseline = new Set(existingSlots);
      for (const [idx, state] of map.entries()) {
        if (state.position.y > -100 && !baseline.has(idx)) return true;
      }
      return false;
    },
    [...beforeSlots],
    { timeout: 1_500 },
  );
  expect(spawned, `${screenshotStem}: expected a real click to spawn a projectile.`).toBeTruthy();

  await page.waitForTimeout(80);
  const after = await captureDebug(page);
  const projectileRender = await captureProjectileRenderDebug(page);
  const liveProjectiles = await readLiveProjectiles(page);
  const newProjectiles = liveProjectiles.filter((projectile) => !beforeSlots.has(projectile.idx));

  expect(after.line, `Expected aim line debug after firing for ${screenshotStem}.`).not.toBeNull();
  expect(
    after.line?.renderedLastFrame,
    `${screenshotStem}: expected the aim line mesh to still render after firing.`,
  ).toBe(true);
  expect(
    projectileRender,
    `${screenshotStem}: expected projectile render debug to be published.`,
  ).not.toBeNull();
  expect(
    projectileRender?.frustumCulled,
    `${screenshotStem}: projectile mesh frustum culling must stay disabled away from origin.`,
  ).toBe(false);
  expect(
    projectileRender?.renderedLastFrame,
    `${screenshotStem}: expected the projectile mesh to render on the previous frame.`,
  ).toBe(true);
  expect(
    newProjectiles.length,
    `${screenshotStem}: expected at least one newly spawned live projectile.\nLive: ${JSON.stringify(liveProjectiles, null, 2)}`,
  ).toBeGreaterThan(0);

  for (const projectile of newProjectiles) {
    expect(
      projectile.instance,
      `${screenshotStem}: expected a GPU-facing instance translation for projectile ${projectile.idx}.`,
    ).not.toBeNull();
    expect(
      projectile.instance?.y ?? -1000,
      `${screenshotStem}: projectile ${projectile.idx} instance translation should stay above the sleep pit.`,
    ).toBeGreaterThan(-100);
  }

  await page.screenshot({
    path: testInfo.outputPath(`${screenshotStem}.png`),
    fullPage: true,
  });
}

test.describe('aim quadrant stability after real thrust drift', () => {
  test('first pointer-lock click does not spawn phantom projectiles', async ({ page }) => {
    await startPlaying(page);
    await page.waitForTimeout(1_000);

    const beforeClick = await captureDebug(page);
    const beforeProjectiles = await activeProjectileSlots(page);
    const beforeRender = await captureProjectileRenderDebug(page);

    expect(beforeClick.aim, 'Expected aim debug before pointer lock.').not.toBeNull();
    expect(beforeClick.line, 'Expected aim line debug before pointer lock.').not.toBeNull();
    expect(beforeClick.aim?.pointerLocked, 'Expected the game to start unlocked.').toBe(false);
    expect(beforeClick.line?.visible, 'Expected the aim line to stay hidden while unlocked.').toBe(
      false,
    );
    expect(
      beforeProjectiles,
      'Expected no live projectiles before the player intentionally fires.',
    ).toHaveLength(0);
    expect(
      beforeRender?.activeCount ?? 0,
      'Expected the projectile renderer to have zero active instances before the first intentional shot.',
    ).toBe(0);

    await acquirePointerLock(page);

    const afterClick = await captureDebug(page);
    const afterProjectiles = await activeProjectileSlots(page);
    const afterRender = await captureProjectileRenderDebug(page);

    expect(afterClick.aim, 'Expected aim debug after the first pointer-lock click.').not.toBeNull();
    expect(
      afterClick.line,
      'Expected aim line debug after the first pointer-lock click.',
    ).not.toBeNull();
    expect(afterClick.aim?.pointerLocked, 'Expected pointer lock after the first click.').toBe(
      true,
    );
    expect(
      afterClick.line?.visible,
      'Expected the aim line to become visible after pointer lock.',
    ).toBe(true);
    expect(
      afterProjectiles,
      'Expected the first pointer-lock click not to spawn any real projectiles.',
    ).toHaveLength(0);
    expect(
      afterRender?.activeCount ?? 0,
      'Expected the projectile renderer to still have zero active instances after the first pointer-lock click.',
    ).toBe(0);
  });

  test('quadrant stays stable when camera input is unchanged', async ({ page }, testInfo) => {
    await startPlaying(page);
    await page.waitForTimeout(1_000);

    await acquirePointerLock(page);

    // Keep camera input fixed for the full scenario.
    await setCameraAzimuth(page, Math.PI);
    await page.waitForTimeout(200);

    const beforeDrift = await captureDebug(page);
    expect(
      beforeDrift.aim,
      'Expected __AIM_DEBUG__ to be published in DEV/E2E mode.',
    ).not.toBeNull();
    expect(
      beforeDrift.line,
      'Expected __AIM_LINE_VISIBLE__ to be published in DEV/E2E mode.',
    ).not.toBeNull();
    expect(beforeDrift.aim?.pointerLocked, 'Expected pointer lock before drift.').toBe(true);
    expect(beforeDrift.line?.visible, 'Expected aim line to be visible before drift.').toBe(true);
    expect(
      beforeDrift.line?.renderedLastFrame,
      'Expected the aim line mesh to have rendered on the previous frame before drift.',
    ).toBe(true);

    const idleProjectiles = await activeProjectileSlots(page);
    expect(
      idleProjectiles,
      `Expected no live projectiles before the test fires.\nBefore: ${toDebugString(beforeDrift)}`,
    ).toHaveLength(0);

    await page.screenshot({
      path: testInfo.outputPath('before-drift.png'),
      fullPage: true,
    });

    await fireAndAssertSpawn(page, 'pre-drift fire');

    // Real user flow: hold W for several seconds to drift away from origin.
    await page.keyboard.down('w');
    await page.waitForTimeout(1_000);
    const oneSecondDrift = await captureDebug(page);
    await page.screenshot({
      path: testInfo.outputPath('after-1s-drift.png'),
      fullPage: true,
    });

    await page.waitForTimeout(2_000);
    const threeSecondDrift = await captureDebug(page);
    await page.screenshot({
      path: testInfo.outputPath('after-3s-drift.png'),
      fullPage: true,
    });

    await page.waitForTimeout(500);
    await page.keyboard.up('w');
    await page.waitForTimeout(250);

    const afterDrift = await captureDebug(page);
    expect(afterDrift.aim, 'Expected __AIM_DEBUG__ after drift.').not.toBeNull();
    expect(oneSecondDrift.aim, 'Expected __AIM_DEBUG__ after 1 second of drift.').not.toBeNull();
    expect(threeSecondDrift.aim, 'Expected __AIM_DEBUG__ after 3 seconds of drift.').not.toBeNull();

    await fireAndAssertSpawn(page, 'post-drift fire');

    const beforeAim = beforeDrift.aim as AimDebugSnapshot;
    const afterAim = afterDrift.aim as AimDebugSnapshot;
    const driftDistance = horizontalDistance(
      beforeAim.boatWorldPosition,
      afterAim.boatWorldPosition,
    );

    const cameraInputUnchanged =
      Math.abs(beforeAim.cameraAzimuth - afterAim.cameraAzimuth) < 1e-6 &&
      Math.abs(beforeAim.cameraElevation - afterAim.cameraElevation) < 1e-6;

    expect(
      driftDistance,
      `Boat did not travel far enough during the W-hold segment.\nBefore: ${toDebugString(beforeDrift)}\nAfter: ${toDebugString(afterDrift)}`,
    ).toBeGreaterThan(5);

    expect(
      cameraInputUnchanged,
      `Camera input changed unexpectedly.\nBefore: ${toDebugString(beforeDrift)}\nAfter: ${toDebugString(afterDrift)}`,
    ).toBeTruthy();

    expect(
      afterAim.activeQuadrant,
      `Quadrant flipped despite unchanged camera input.\nBefore: ${toDebugString(beforeDrift)}\nAfter: ${toDebugString(afterDrift)}`,
    ).toBe(beforeAim.activeQuadrant);

    await page.screenshot({
      path: testInfo.outputPath('after-drift.png'),
      fullPage: true,
    });
  });

  test('direct repro pose keeps preview meaningful when real shots still travel', async ({
    page,
  }, testInfo) => {
    await startPlaying(page);
    await page.waitForTimeout(1_000);

    await acquirePointerLock(page);
    await setCameraAzimuth(page, Math.PI);
    await page.waitForTimeout(200);

    await patchPlayerBodyState(page, FORE_LINE_REPRO_POSE);
    await page.waitForTimeout(50);

    const repro = await captureDebug(page);
    expect(repro.aim, 'Expected aim debug in direct repro pose.').not.toBeNull();
    expect(repro.line, 'Expected aim line debug in direct repro pose.').not.toBeNull();
    expect(repro.aim?.pointerLocked, 'Expected pointer lock in direct repro pose.').toBe(true);
    expect(repro.line?.visible, 'Expected aim line to remain logically visible.').toBe(true);
    expect(
      repro.line?.frustumCulled,
      'Expected trajectory preview frustum culling to stay disabled for the moving ribbon.',
    ).toBe(false);
    expect(
      repro.line?.renderedLastFrame,
      'Expected the trajectory preview mesh to actually render in the direct repro pose.',
    ).toBe(true);

    await page.screenshot({
      path: testInfo.outputPath('direct-repro-before-fire.png'),
      fullPage: true,
    });

    const before = new Set(await activeProjectileSlots(page));
    await clickCanvasToFire(page);

    const spawned = await page.waitForFunction(
      (beforeList: number[]) => {
        const map = (
          window as {
            __GET_ALL_PROJECTILE_BODY_STATES__?: () => ReadonlyMap<
              number,
              { position: { y: number } }
            >;
          }
        ).__GET_ALL_PROJECTILE_BODY_STATES__?.();
        if (!map) return false;
        const baseline = new Set(beforeList);
        for (const [idx, state] of map.entries()) {
          if (state.position.y > -100 && !baseline.has(idx)) return true;
        }
        return false;
      },
      [...before],
      { timeout: 1_500 },
    );
    expect(
      spawned,
      'Expected a real click to spawn projectiles in the direct repro pose.',
    ).toBeTruthy();

    await page.waitForTimeout(1_000);
    const liveProjectiles = await readLiveProjectiles(page);
    const furthestTravel = liveProjectiles.reduce((furthest, projectile) => {
      const dz = projectile.position.z - (repro.aim?.boatWorldPosition.z ?? 0);
      const dx = projectile.position.x - (repro.aim?.boatWorldPosition.x ?? 0);
      const horizontal = Math.sqrt(dx * dx + dz * dz);
      return Math.max(furthest, horizontal);
    }, 0);

    expect(
      liveProjectiles.length,
      `Expected real projectiles to remain active in the direct repro pose.\nRepro: ${toDebugString(repro)}`,
    ).toBeGreaterThan(0);
    expect(
      furthestTravel,
      `Expected spawned projectiles to travel a meaningful horizontal distance.\nRepro: ${toDebugString(repro)}\nLive: ${JSON.stringify(liveProjectiles, null, 2)}`,
    ).toBeGreaterThan(20);

    expect(
      repro.line?.activeSteps ?? 0,
      `Preview collapsed despite real projectiles travelling normally.\nRepro: ${toDebugString(repro)}\nLive: ${JSON.stringify(liveProjectiles, null, 2)}`,
    ).toBeGreaterThan(5);
  });

  test('aim lines and rendered shots survive all quadrants at spawn, drifted, and repro poses', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const quadrants: Quadrant[] = ['fore', 'starboard', 'aft', 'port'];

    await startPlaying(page);
    await page.waitForTimeout(1_000);
    await acquirePointerLock(page);
    for (const quadrant of quadrants) {
      await exerciseQuadrantAtCurrentPose(page, quadrant, `spawn-${quadrant}`, testInfo);
    }

    await startPlaying(page);
    await page.waitForTimeout(1_000);
    await acquirePointerLock(page);
    await page.evaluate(() => {
      (window as { __SET_CAMERA_AZIMUTH__?: (a: number) => void }).__SET_CAMERA_AZIMUTH__?.(
        Math.PI,
      );
    });
    await page.waitForTimeout(200);
    await page.keyboard.down('w');
    await page.waitForTimeout(3_000);
    await page.keyboard.up('w');
    await page.waitForTimeout(150);
    for (const quadrant of quadrants) {
      await exerciseQuadrantAtCurrentPose(page, quadrant, `drifted-${quadrant}`, testInfo);
    }

    await startPlaying(page);
    await page.waitForTimeout(1_000);
    await acquirePointerLock(page);
    await page.evaluate(() => {
      (window as { __SET_CAMERA_AZIMUTH__?: (a: number) => void }).__SET_CAMERA_AZIMUTH__?.(
        Math.PI,
      );
    });
    await page.waitForTimeout(200);
    await patchPlayerBodyState(page, FORE_LINE_REPRO_POSE);
    await page.waitForTimeout(100);
    for (const quadrant of quadrants) {
      await exerciseQuadrantAtCurrentPose(page, quadrant, `repro-${quadrant}`, testInfo);
    }
  });
});
