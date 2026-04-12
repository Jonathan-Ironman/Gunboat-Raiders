import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

interface BodyStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  angvel: { x: number; y: number; z: number };
}

interface WaveSample {
  height: number;
  normal: [number, number, number];
  time: number;
}

interface HullErrorSample {
  waveHeight: number;
  hullY: number;
  error: number;
}

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
      };
      return w.__GET_PLAYER_BODY_STATE__?.() !== null;
    },
    undefined,
    { timeout: 15_000 },
  );
}

async function waitForEnemyBodyId(page: Page, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const id = await page.evaluate<string | null>(() => {
      const w = window as unknown as {
        __GET_ALL_ENEMY_BODY_STATES__?: () => ReadonlyMap<string, unknown>;
      };
      const map = w.__GET_ALL_ENEMY_BODY_STATES__?.();
      if (!map || map.size === 0) return null;
      return Array.from(map.keys())[0] ?? null;
    });
    if (id) return id;
    await page.waitForTimeout(100);
  }
  throw new Error('No enemy body appeared before timeout');
}

async function setBoatPoseAndVelocity(
  page: Page,
  enemyId: string,
  playerPosition: { x: number; z: number },
  enemyPosition: { x: number; z: number },
  forwardSpeed: number,
): Promise<void> {
  await page.evaluate(
    ({
      targetEnemyId,
      px,
      pz,
      ex,
      ez,
      speed,
    }: {
      targetEnemyId: string;
      px: number;
      pz: number;
      ex: number;
      ez: number;
      speed: number;
    }) => {
      type RigidBodyLike = {
        setTranslation: (p: { x: number; y: number; z: number }, wake: boolean) => void;
        setRotation: (r: { x: number; y: number; z: number; w: number }, wake: boolean) => void;
        setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
        setAngvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
        translation: () => { x: number; y: number; z: number };
      };

      const w = window as unknown as {
        __GET_PLAYER_BODY__?: () => RigidBodyLike | null;
        __GET_ENEMY_BODY__?: (id: string) => RigidBodyLike | null;
      };

      const playerBody = w.__GET_PLAYER_BODY__?.();
      const enemyBody = w.__GET_ENEMY_BODY__?.(targetEnemyId);
      const bodies: Array<{ body: RigidBodyLike; x: number; z: number }> = [];
      if (playerBody) bodies.push({ body: playerBody, x: px, z: pz });
      if (enemyBody) bodies.push({ body: enemyBody, x: ex, z: ez });

      for (const { body, x, z } of bodies) {
        const current = body.translation();
        body.setTranslation({ x, y: current.y, z }, true);
        body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        body.setLinvel({ x: 0, y: 0, z: speed }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    },
    {
      targetEnemyId: enemyId,
      px: playerPosition.x,
      pz: playerPosition.z,
      ex: enemyPosition.x,
      ez: enemyPosition.z,
      speed: forwardSpeed,
    },
  );
}

async function sampleHullErrorOverTime(
  page: Page,
  enemyId: string,
  forwardSpeed: number,
  sampleCount: number,
  intervalMs: number,
): Promise<{ player: HullErrorSample[]; enemy: HullErrorSample[] }> {
  const player: HullErrorSample[] = [];
  const enemy: HullErrorSample[] = [];

  for (let i = 0; i < sampleCount; i++) {
    await page.waitForTimeout(intervalMs);
    const sample = await page.evaluate(
      ({ targetEnemyId }: { targetEnemyId: string }) => {
        const w = window as unknown as {
          __GET_PLAYER_BODY_STATE__?: () => BodyStateSnapshot | null;
          __GET_ENEMY_BODY_STATE__?: (id: string) => BodyStateSnapshot | undefined;
          __TEST_GET_WAVE_SAMPLE__?: (x: number, z: number) => WaveSample;
        };
        const playerState = w.__GET_PLAYER_BODY_STATE__?.();
        const enemyState = w.__GET_ENEMY_BODY_STATE__?.(targetEnemyId);
        const waveSampler = w.__TEST_GET_WAVE_SAMPLE__;
        if (!playerState || !enemyState || !waveSampler) return null;

        const playerWave = waveSampler(playerState.position.x, playerState.position.z);
        const enemyWave = waveSampler(enemyState.position.x, enemyState.position.z);
        return {
          player: {
            waveHeight: playerWave.height,
            hullY: playerState.position.y,
            error: playerState.position.y - playerWave.height,
          },
          enemy: {
            waveHeight: enemyWave.height,
            hullY: enemyState.position.y,
            error: enemyState.position.y - enemyWave.height,
          },
        };
      },
      { targetEnemyId: enemyId },
    );

    if (!sample) continue;
    player.push(sample.player);
    enemy.push(sample.enemy);

    // Keep velocity bucket stable so each case truly tests low/medium/high speed.
    await page.evaluate(
      ({ targetEnemyId, speed }: { targetEnemyId: string; speed: number }) => {
        type RigidBodyLike = {
          setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void;
        };
        const w = window as unknown as {
          __GET_PLAYER_BODY__?: () => RigidBodyLike | null;
          __GET_ENEMY_BODY__?: (id: string) => RigidBodyLike | null;
        };
        w.__GET_PLAYER_BODY__?.()?.setLinvel({ x: 0, y: 0, z: speed }, true);
        w.__GET_ENEMY_BODY__?.(targetEnemyId)?.setLinvel({ x: 0, y: 0, z: speed }, true);
      },
      { targetEnemyId: enemyId, speed: forwardSpeed },
    );
  }

  return { player, enemy };
}

function assertBuoyancyTracking(label: string, samples: HullErrorSample[]): void {
  expect(samples.length, `${label}: expected non-empty samples`).toBeGreaterThan(10);

  const errors = samples.map((s) => s.error);
  const absErrors = errors.map((e) => Math.abs(e));
  const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const meanAbsError = absErrors.reduce((a, b) => a + b, 0) / absErrors.length;
  const maxAbsError = absErrors.reduce((a, b) => Math.max(a, b), 0);
  const above = errors.filter((e) => e > 0.2).length;
  const below = errors.filter((e) => e < -0.2).length;

  // Tolerances intentionally allow natural wave-follow oscillation.
  expect(
    meanAbsError,
    `${label}: average |hullY-waveY| too large (${meanAbsError.toFixed(3)}m)`,
  ).toBeLessThan(1.4);
  expect(
    maxAbsError,
    `${label}: peak |hullY-waveY| too large (${maxAbsError.toFixed(3)}m)`,
  ).toBeLessThan(2.4);

  // Persistent offset bias guard: prevent always-submerged or always-floating hull.
  expect(
    Math.abs(meanError),
    `${label}: persistent vertical bias detected (mean error ${meanError.toFixed(3)}m)`,
  ).toBeLessThan(0.55);
  expect(
    above,
    `${label}: hull almost never above sampled wave (above=${above}, below=${below})`,
  ).toBeGreaterThan(2);
  expect(
    below,
    `${label}: hull almost never below sampled wave (above=${above}, below=${below})`,
  ).toBeGreaterThan(2);
}

test.describe('Buoyancy surface follow', () => {
  test.describe.configure({ timeout: 240_000 });

  test('player and enemy hulls track sampled wave surface across positions and speeds', async ({
    page,
  }) => {
    await startPlaying(page);
    const enemyId = await waitForEnemyBodyId(page);

    // Let startup transients settle before targeted checks.
    await page.waitForTimeout(2_000);

    const cases = [
      { name: 'low-speed origin', speed: 0, position: { x: 0, z: 0 } },
      { name: 'medium-speed far-east', speed: 8, position: { x: 85, z: -45 } },
      { name: 'high-speed far-west', speed: 16, position: { x: -120, z: 95 } },
    ];

    for (const c of cases) {
      await setBoatPoseAndVelocity(
        page,
        enemyId,
        c.position,
        { x: c.position.x + 8, z: c.position.z + 6 },
        c.speed,
      );
      await page.waitForTimeout(250);

      const tracked = await sampleHullErrorOverTime(page, enemyId, c.speed, 40, 100);
      assertBuoyancyTracking(`player @ ${c.name}`, tracked.player);
      assertBuoyancyTracking(`enemy @ ${c.name}`, tracked.enemy);
    }
  });
});
