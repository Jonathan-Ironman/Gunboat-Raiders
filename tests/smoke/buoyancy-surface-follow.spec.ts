import { test, expect, type Page } from '@playwright/test';
import { startPlayingFromMenu, waitForPlayerBody } from '../helpers/gameTestUtils';

interface BodyStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

interface BodyStatePatch {
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  linvel?: { x: number; y: number; z: number };
  angvel?: { x: number; y: number; z: number };
}

interface WaveSample {
  height: number;
  normal: [number, number, number];
  time: number;
}

interface TrackingSample {
  bodyY: number;
  error: number;
  horizontalSpeed: number;
  waveHeight: number;
}

async function startPlaying(page: Page): Promise<void> {
  await startPlayingFromMenu(page);
  await waitForPlayerBody(page, 15_000);
}

async function waitForEnemyBodyId(page: Page, timeoutMs = 30_000): Promise<string> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __GET_ALL_ENEMY_BODY_STATES__?: () => ReadonlyMap<string, unknown>;
      };
      const bodies = w.__GET_ALL_ENEMY_BODY_STATES__?.();
      return bodies !== undefined && bodies.size > 0;
    },
    undefined,
    { timeout: timeoutMs },
  );

  const enemyId = await page.evaluate<string | null>(() => {
    const w = window as unknown as {
      __GET_ALL_ENEMY_BODY_STATES__?: () => ReadonlyMap<string, unknown>;
    };
    return Array.from(w.__GET_ALL_ENEMY_BODY_STATES__?.().keys() ?? [])[0] ?? null;
  });

  if (!enemyId) {
    throw new Error('Expected at least one enemy body id after waiting for spawns.');
  }

  return enemyId;
}

async function placeBoatsForCase(
  page: Page,
  enemyId: string,
  playerPosition: { x: number; z: number },
  enemyPosition: { x: number; z: number },
  forwardSpeed: number,
): Promise<void> {
  const result = await page.evaluate(
    ({
      enemyId: targetEnemyId,
      enemyPosition,
      forwardSpeed,
      playerPosition,
    }: {
      enemyId: string;
      enemyPosition: { x: number; z: number };
      forwardSpeed: number;
      playerPosition: { x: number; z: number };
    }) => {
      type TestWindow = Window &
        typeof globalThis & {
          __GET_PLAYER_BODY_STATE__?: () => BodyStateSnapshot | null;
          __GET_ENEMY_BODY_STATE__?: (id: string) => BodyStateSnapshot | undefined;
          __TEST_PATCH_PLAYER_BODY_STATE__?: (patch: BodyStatePatch) => boolean;
          __TEST_PATCH_ENEMY_BODY_STATE__?: (id: string, patch: BodyStatePatch) => boolean;
          __TEST_GET_WAVE_SAMPLE__?: (x: number, z: number) => WaveSample;
        };

      const w = window as TestWindow;
      const playerState = w.__GET_PLAYER_BODY_STATE__?.();
      const enemyState = w.__GET_ENEMY_BODY_STATE__?.(targetEnemyId);
      const waveSampler = w.__TEST_GET_WAVE_SAMPLE__;
      const patchPlayer = w.__TEST_PATCH_PLAYER_BODY_STATE__;
      const patchEnemy = w.__TEST_PATCH_ENEMY_BODY_STATE__;

      if (!playerState || !enemyState || !waveSampler || !patchPlayer || !patchEnemy) {
        return false;
      }

      const playerWave = waveSampler(playerState.position.x, playerState.position.z);
      const enemyWave = waveSampler(enemyState.position.x, enemyState.position.z);
      const playerBias = playerState.position.y - playerWave.height;
      const enemyBias = enemyState.position.y - enemyWave.height;
      const playerTargetWave = waveSampler(playerPosition.x, playerPosition.z);
      const enemyTargetWave = waveSampler(enemyPosition.x, enemyPosition.z);
      const uprightRotation = { x: 0, y: 0, z: 0, w: 1 };
      const forwardVelocity = { x: 0, y: 0, z: forwardSpeed };
      const zeroAngularVelocity = { x: 0, y: 0, z: 0 };

      const playerApplied = patchPlayer({
        position: {
          x: playerPosition.x,
          y: playerTargetWave.height + playerBias,
          z: playerPosition.z,
        },
        rotation: uprightRotation,
        linvel: forwardVelocity,
        angvel: zeroAngularVelocity,
      });

      const enemyApplied = patchEnemy(targetEnemyId, {
        position: {
          x: enemyPosition.x,
          y: enemyTargetWave.height + enemyBias,
          z: enemyPosition.z,
        },
        rotation: uprightRotation,
        linvel: forwardVelocity,
        angvel: zeroAngularVelocity,
      });

      return playerApplied && enemyApplied;
    },
    { enemyId, enemyPosition, forwardSpeed, playerPosition },
  );

  expect(result, 'Expected player and enemy patch bridges to accept the setup pose.').toBe(true);
}

async function collectTrackingSamples(
  page: Page,
  enemyId: string,
  targetForwardSpeed: number,
  sampleCount: number,
  intervalMs: number,
): Promise<{ enemy: TrackingSample[]; player: TrackingSample[] }> {
  const playerSamples: TrackingSample[] = [];
  const enemySamples: TrackingSample[] = [];

  for (let i = 0; i < sampleCount; i += 1) {
    await page.waitForTimeout(intervalMs);

    const sample = await page.evaluate(
      ({
        enemyId: targetEnemyId,
        targetForwardSpeed,
      }: {
        enemyId: string;
        targetForwardSpeed: number;
      }) => {
        type TestWindow = Window &
          typeof globalThis & {
            __GET_PLAYER_BODY_STATE__?: () => BodyStateSnapshot | null;
            __GET_ENEMY_BODY_STATE__?: (id: string) => BodyStateSnapshot | undefined;
            __TEST_PATCH_PLAYER_BODY_STATE__?: (patch: BodyStatePatch) => boolean;
            __TEST_PATCH_ENEMY_BODY_STATE__?: (id: string, patch: BodyStatePatch) => boolean;
            __TEST_GET_WAVE_SAMPLE__?: (x: number, z: number) => WaveSample;
          };

        const w = window as TestWindow;
        const playerState = w.__GET_PLAYER_BODY_STATE__?.();
        const enemyState = w.__GET_ENEMY_BODY_STATE__?.(targetEnemyId);
        const waveSampler = w.__TEST_GET_WAVE_SAMPLE__;
        const patchPlayer = w.__TEST_PATCH_PLAYER_BODY_STATE__;
        const patchEnemy = w.__TEST_PATCH_ENEMY_BODY_STATE__;

        if (!playerState || !enemyState || !waveSampler) {
          return null;
        }

        patchPlayer?.({
          linvel: {
            x: 0,
            y: playerState.linvel.y,
            z: targetForwardSpeed,
          },
        });
        patchEnemy?.(targetEnemyId, {
          linvel: {
            x: 0,
            y: enemyState.linvel.y,
            z: targetForwardSpeed,
          },
        });

        const playerWave = waveSampler(playerState.position.x, playerState.position.z);
        const enemyWave = waveSampler(enemyState.position.x, enemyState.position.z);

        return {
          enemy: {
            bodyY: enemyState.position.y,
            error: enemyState.position.y - enemyWave.height,
            horizontalSpeed: Math.hypot(enemyState.linvel.x, enemyState.linvel.z),
            waveHeight: enemyWave.height,
          },
          player: {
            bodyY: playerState.position.y,
            error: playerState.position.y - playerWave.height,
            horizontalSpeed: Math.hypot(playerState.linvel.x, playerState.linvel.z),
            waveHeight: playerWave.height,
          },
        };
      },
      { enemyId, targetForwardSpeed },
    );

    if (!sample) {
      continue;
    }

    playerSamples.push(sample.player);
    enemySamples.push(sample.enemy);
  }

  return {
    enemy: enemySamples,
    player: playerSamples,
  };
}

function assertSurfaceTracking(
  label: string,
  samples: TrackingSample[],
  targetForwardSpeed: number,
) {
  expect(samples.length, `${label}: expected to collect enough tracking samples`).toBeGreaterThan(
    20,
  );

  const errors = samples.map((sample) => sample.error);
  const meanError = errors.reduce((sum, error) => sum + error, 0) / errors.length;
  const deviations = errors.map((error) => Math.abs(error - meanError));
  const meanDeviation =
    deviations.reduce((sum, deviation) => sum + deviation, 0) / deviations.length;
  const maxDeviation = deviations.reduce((max, deviation) => Math.max(max, deviation), 0);
  const maxAbsError = errors.reduce((max, error) => Math.max(max, Math.abs(error)), 0);
  const averageHorizontalSpeed =
    samples.reduce((sum, sample) => sum + sample.horizontalSpeed, 0) / samples.length;
  const maxHorizontalSpeed = samples.reduce(
    (max, sample) => Math.max(max, sample.horizontalSpeed),
    0,
  );

  expect(
    meanDeviation,
    `${label}: average deviation from the local waterline is too large (${meanDeviation.toFixed(3)}m)`,
  ).toBeLessThan(0.8);
  expect(
    maxDeviation,
    `${label}: peak deviation from the local waterline is too large (${maxDeviation.toFixed(3)}m)`,
  ).toBeLessThan(1.9);
  expect(
    maxAbsError,
    `${label}: body drifted too far from the sampled wave surface (${maxAbsError.toFixed(3)}m)`,
  ).toBeLessThan(2.4);
  expect(
    Math.abs(meanError),
    `${label}: persistent height bias is suspiciously large (${meanError.toFixed(3)}m)`,
  ).toBeLessThan(0.9);

  if (targetForwardSpeed === 0) {
    expect(
      averageHorizontalSpeed,
      `${label}: stationary bucket should stay near rest on the surface`,
    ).toBeLessThan(2);
    return;
  }

  expect(
    maxHorizontalSpeed,
    `${label}: expected some meaningful horizontal motion for the ${targetForwardSpeed.toFixed(1)} m/s bucket`,
  ).toBeGreaterThan(1.5);
}

test.describe('Buoyancy surface follow', () => {
  test.describe.configure({ timeout: 180_000 });

  test('player and enemy bodies stay coupled to the sampled wave surface across positions and speeds', async ({
    page,
  }) => {
    await startPlaying(page);

    const enemyId = await waitForEnemyBodyId(page);

    // Startup includes wave spawns, AI activation, and initial hull settling.
    await page.waitForTimeout(2_000);

    const cases = [
      { name: 'stationary-origin', speed: 0, player: { x: 0, z: 0 } },
      { name: 'mid-speed-east', speed: 6, player: { x: 80, z: -40 } },
      { name: 'high-speed-west', speed: 12, player: { x: -110, z: 90 } },
    ];

    for (const testCase of cases) {
      await placeBoatsForCase(
        page,
        enemyId,
        testCase.player,
        { x: testCase.player.x + 10, z: testCase.player.z + 6 },
        testCase.speed,
      );

      await page.waitForTimeout(400);

      const tracked = await collectTrackingSamples(page, enemyId, testCase.speed, 36, 100);

      assertSurfaceTracking(`player @ ${testCase.name}`, tracked.player, testCase.speed);
      assertSurfaceTracking(`enemy @ ${testCase.name}`, tracked.enemy, testCase.speed);
    }
  });
});
