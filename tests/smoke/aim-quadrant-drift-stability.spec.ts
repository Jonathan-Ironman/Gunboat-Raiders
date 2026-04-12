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
}

interface SnapshotBundle {
  aim: AimDebugSnapshot | null;
  line: AimLineDebugSnapshot | null;
}

async function startPlaying(page: Page): Promise<void> {
  await startGame(page);
  await waitForPhase(page, 'mainMenu', 20_000);
  await page.getByTestId('start-button').click();
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

test.describe('aim quadrant stability after real thrust drift', () => {
  test('quadrant stays stable when camera input is unchanged', async ({ page }) => {
    await startPlaying(page);
    await page.waitForTimeout(1_000);

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

    await fireAndAssertSpawn(page, 'pre-drift fire');

    // Real user flow: hold W for several seconds to drift away from origin.
    await page.keyboard.down('w');
    await page.waitForTimeout(3_500);
    await page.keyboard.up('w');
    await page.waitForTimeout(250);

    const afterDrift = await captureDebug(page);
    expect(afterDrift.aim, 'Expected __AIM_DEBUG__ after drift.').not.toBeNull();

    await fireAndAssertSpawn(page, 'post-drift fire');

    const beforeAim = beforeDrift.aim as AimDebugSnapshot;
    const afterAim = afterDrift.aim as AimDebugSnapshot;

    const cameraInputUnchanged =
      Math.abs(beforeAim.cameraAzimuth - afterAim.cameraAzimuth) < 1e-6 &&
      Math.abs(beforeAim.cameraElevation - afterAim.cameraElevation) < 1e-6;

    expect(
      cameraInputUnchanged,
      `Camera input changed unexpectedly.\nBefore: ${toDebugString(beforeDrift)}\nAfter: ${toDebugString(afterDrift)}`,
    ).toBeTruthy();

    expect(
      afterAim.activeQuadrant,
      `Quadrant flipped despite unchanged camera input.\nBefore: ${toDebugString(beforeDrift)}\nAfter: ${toDebugString(afterDrift)}`,
    ).toBe(beforeAim.activeQuadrant);
  });
});
