import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

interface TestWave {
  amplitude: number;
  direction: [number, number];
  phase: number;
  speed: number;
  wavelength: number;
}

interface PlayerBodyState {
  angvel: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linvel: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
}

interface BodyStatePatch {
  angvel?: { x: number; y: number; z: number };
  linvel?: { x: number; y: number; z: number };
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
}

interface RenderBounds {
  max: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
}

interface RenderPoint {
  x: number;
  y: number;
  z: number;
}

interface WaveModulationConfig {
  maxAmplitudeMultiplier: number;
  minAmplitudeMultiplier: number;
  modulatedWaveCount: number;
  noiseScale: number;
  timeScale: number;
}

interface WaveSyncSample {
  angvel: { x: number; y: number; z: number };
  bodyX: number;
  time: number;
  coveredRatio: number;
  deepCoveredRatio: number;
  linvel: { x: number; y: number; z: number };
  renderedMinusBottom: number;
  renderedMinusVisibleBottom: number;
  renderedMinusCpu: number;
  bodyY: number;
  bodyZ: number;
  horizontalSpeed: number;
  meanHullDelta: number;
  visibleBottomY: number;
  waveY: number;
  renderedWaveY: number;
  rotation: { x: number; y: number; z: number; w: number };
  speed: number;
  worstHullPointWaveY: number;
  worstHullPointX: number;
  worstHullPointY: number;
  worstHullPointZ: number;
}

interface PositionScanResult {
  x: number;
  z: number;
  worst: number;
  worstSample: WaveSyncSample | null;
}

interface DriveScenario {
  name: string;
  x: number;
  z: number;
  yaw: number;
}

async function startPlaying(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type TestWindow = Window & typeof globalThis & { __TEST_T0__?: number };
    const w = window as TestWindow;
    w.__TEST_T0__ = performance.now();
  });

  await startGame(page);
  await waitForPhase(page, 'mainMenu', 20_000);

  const newGameButton = page.locator('[data-testid="main-menu-new-game-btn"]');
  await expect(newGameButton).toBeVisible({ timeout: 15_000 });
  await newGameButton.click();

  await waitForPhase(page, 'briefing', 15_000);

  const startButton = page.locator('[data-testid="briefing-start-btn"]');
  await expect(startButton).toBeVisible({ timeout: 15_000 });
  await startButton.click();

  await waitForPhase(page, 'playing', 15_000);

  await page.waitForFunction(
    () => {
      type TestWindow = Window &
        typeof globalThis & {
          __GET_PLAYER_BODY_STATE__?: unknown;
        };
      const w = window as TestWindow;
      return typeof w.__GET_PLAYER_BODY_STATE__ === 'function';
    },
    undefined,
    { timeout: 10_000 },
  );
}

async function installWaveSyncSampler(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const waterConfigModulePath = '/src/environment/waterConfig.ts';
    const waterTunablesModulePath = '/src/environment/waterTunables.ts';

    const { SHARED_WAVE_SAMPLING } = (await import(waterConfigModulePath)) as {
      SHARED_WAVE_SAMPLING: { waves: readonly TestWave[] };
    };
    const { WAVE_MODULATION } = (await import(waterTunablesModulePath)) as {
      WAVE_MODULATION: WaveModulationConfig;
    };
    const waves = SHARED_WAVE_SAMPLING.waves;
    const TWO_PI = 2 * Math.PI;

    type TestWindow = Window &
      typeof globalThis & {
        __GET_PLAYER_BODY_STATE__?: () => PlayerBodyState | null;
        __GET_PLAYER_RENDER_BOUNDS__?: () => RenderBounds | null;
        __GET_PLAYER_RENDER_HULL_POINTS__?: () => RenderPoint[] | null;
        __TEST_PATCH_PLAYER_BODY_STATE__?: (patch: BodyStatePatch) => boolean;
        __TEST_GET_WAVE_SAMPLE__?: (
          x: number,
          z: number,
        ) => { height: number; normal: [number, number, number]; time: number };
        __TEST_SAMPLE_WAVE_SYNC__?: () => WaveSyncSample | null;
      };
    const w = window as TestWindow;

    const fract = (value: number): number => value - Math.floor(value);
    const mix = (a: number, b: number, t: number): number => a * (1 - t) + b * t;
    const hash2D = (x: number, z: number): number =>
      fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);

    function noise2D(x: number, z: number): number {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      const fxRaw = fract(x);
      const fzRaw = fract(z);
      const fx = fxRaw * fxRaw * (3 - 2 * fxRaw);
      const fz = fzRaw * fzRaw * (3 - 2 * fzRaw);

      const a = hash2D(ix, iz);
      const b = hash2D(ix + 1, iz);
      const c = hash2D(ix, iz + 1);
      const d = hash2D(ix + 1, iz + 1);

      return mix(mix(a, b, fx), mix(c, d, fx), fz);
    }

    function getAmplitudeMultiplier(x: number, z: number, time: number): number {
      const noise = noise2D(
        x * WAVE_MODULATION.noiseScale + time * WAVE_MODULATION.timeScale,
        z * WAVE_MODULATION.noiseScale + time * WAVE_MODULATION.timeScale,
      );

      return mix(
        WAVE_MODULATION.minAmplitudeMultiplier,
        WAVE_MODULATION.maxAmplitudeMultiplier,
        noise,
      );
    }

    function sampleSourceDisplacement(x: number, z: number, time: number) {
      const amplitudeMultiplier = getAmplitudeMultiplier(x, z, time);

      let dx = 0;
      let dy = 0;
      let dz = 0;

      for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
        const wave = waves[waveIndex];
        if (!wave) continue;

        const amp =
          wave.amplitude *
          (waveIndex < WAVE_MODULATION.modulatedWaveCount ? amplitudeMultiplier : 1);
        const k = TWO_PI / wave.wavelength;
        const theta =
          k * (wave.direction[0] * x + wave.direction[1] * z) - wave.speed * k * time + wave.phase;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        dx += wave.direction[0] * amp * cosTheta;
        dz += wave.direction[1] * amp * cosTheta;
        dy += amp * sinTheta;
      }

      return { worldX: x + dx, worldZ: z + dz, height: dy };
    }

    function sampleRenderedHeightAtWorld(worldX: number, worldZ: number, time: number): number {
      let guessX = worldX;
      let guessZ = worldZ;

      for (let i = 0; i < 8; i++) {
        const sample = sampleSourceDisplacement(guessX, guessZ, time);
        guessX += worldX - sample.worldX;
        guessZ += worldZ - sample.worldZ;
      }

      return sampleSourceDisplacement(guessX, guessZ, time).height;
    }

    w.__TEST_SAMPLE_WAVE_SYNC__ = (): WaveSyncSample | null => {
      const body = w.__GET_PLAYER_BODY_STATE__?.();
      const waveSampler = w.__TEST_GET_WAVE_SAMPLE__;
      const renderBounds = w.__GET_PLAYER_RENDER_BOUNDS__?.();
      const renderHullPoints = w.__GET_PLAYER_RENDER_HULL_POINTS__?.();
      if (!body) return null;
      if (typeof waveSampler !== 'function') return null;
      if (!renderBounds) return null;
      if (!renderHullPoints || renderHullPoints.length === 0) return null;

      const wave = waveSampler(body.position.x, body.position.z);
      const renderedWaveY = sampleRenderedHeightAtWorld(
        body.position.x,
        body.position.z,
        wave.time,
      );
      const speed = Math.hypot(body.linvel.x, body.linvel.y, body.linvel.z);
      const horizontalSpeed = Math.hypot(body.linvel.x, body.linvel.z);
      const firstHullPoint = renderHullPoints[0];
      if (!firstHullPoint) return null;

      let worstHullPoint: RenderPoint = firstHullPoint;
      let worstHullPointWaveY = sampleRenderedHeightAtWorld(
        worstHullPoint.x,
        worstHullPoint.z,
        wave.time,
      );
      let worstHullDelta = worstHullPointWaveY - worstHullPoint.y;
      let hullDeltaSum = worstHullDelta;
      let coveredCount = worstHullDelta > 0.05 ? 1 : 0;
      let deepCoveredCount = worstHullDelta > 0.15 ? 1 : 0;

      for (let i = 1; i < renderHullPoints.length; i++) {
        const point = renderHullPoints[i];
        if (!point) continue;
        const pointWaveY = sampleRenderedHeightAtWorld(point.x, point.z, wave.time);
        const pointDelta = pointWaveY - point.y;
        hullDeltaSum += pointDelta;
        if (pointDelta > 0.05) coveredCount += 1;
        if (pointDelta > 0.15) deepCoveredCount += 1;
        if (pointDelta > worstHullDelta) {
          worstHullDelta = pointDelta;
          worstHullPoint = point;
          worstHullPointWaveY = pointWaveY;
        }
      }

      return {
        angvel: body.angvel,
        bodyX: body.position.x,
        coveredRatio: coveredCount / renderHullPoints.length,
        deepCoveredRatio: deepCoveredCount / renderHullPoints.length,
        linvel: body.linvel,
        time: wave.time,
        renderedMinusBottom: renderedWaveY - body.position.y,
        renderedMinusVisibleBottom: worstHullDelta,
        renderedMinusCpu: renderedWaveY - wave.height,
        bodyY: body.position.y,
        bodyZ: body.position.z,
        horizontalSpeed,
        meanHullDelta: hullDeltaSum / renderHullPoints.length,
        visibleBottomY: renderBounds.min.y,
        waveY: wave.height,
        renderedWaveY,
        rotation: body.rotation,
        speed,
        worstHullPointWaveY,
        worstHullPointX: worstHullPoint.x,
        worstHullPointY: worstHullPoint.y,
        worstHullPointZ: worstHullPoint.z,
      };
    };
  });
}

async function collectWorstSubmersion(
  page: Page,
  iterations: number,
  intervalMs: number,
): Promise<{ worst: number; worstSample: WaveSyncSample | null; samples: WaveSyncSample[] }> {
  const samples: WaveSyncSample[] = [];
  let worst = -Infinity;
  let worstSample: WaveSyncSample | null = null;

  for (let i = 0; i < iterations; i++) {
    await page.waitForTimeout(intervalMs);
    const sample = await page.evaluate<WaveSyncSample | null>(() => {
      type TestWindow = Window &
        typeof globalThis & {
          __TEST_SAMPLE_WAVE_SYNC__?: () => WaveSyncSample | null;
        };
      const w = window as TestWindow;
      return w.__TEST_SAMPLE_WAVE_SYNC__?.() ?? null;
    });
    if (!sample) continue;
    samples.push(sample);
    if (sample.renderedMinusVisibleBottom > worst) {
      worst = sample.renderedMinusVisibleBottom;
      worstSample = sample;
    }
  }

  return { worst, worstSample, samples };
}

async function patchPlayerBodyState(page: Page, patch: BodyStatePatch): Promise<void> {
  const applied = await page.evaluate((nextPatch: BodyStatePatch) => {
    type TestWindow = Window &
      typeof globalThis & {
        __TEST_PATCH_PLAYER_BODY_STATE__?: (patch: BodyStatePatch) => boolean;
      };
    const w = window as TestWindow;
    return w.__TEST_PATCH_PLAYER_BODY_STATE__?.(nextPatch) ?? false;
  }, patch);

  expect(applied, 'Expected player body patch bridge to succeed.').toBe(true);
}

function quaternionFromYaw(yaw: number): { x: number; y: number; z: number; w: number } {
  const half = yaw / 2;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}

async function moveBoatToStationaryPose(page: Page, x: number, z: number, yaw = 0): Promise<void> {
  const anchor = await page.evaluate(
    ({ nextX, nextZ }: { nextX: number; nextZ: number }) => {
      type TestWindow = Window &
        typeof globalThis & {
          __GET_PLAYER_BODY_STATE__?: () => PlayerBodyState | null;
          __TEST_GET_WAVE_SAMPLE__?: (
            x: number,
            z: number,
          ) => { height: number; normal: [number, number, number]; time: number };
        };
      const w = window as TestWindow;
      const body = w.__GET_PLAYER_BODY_STATE__?.();
      const wave = w.__TEST_GET_WAVE_SAMPLE__?.(nextX, nextZ);
      return {
        y: wave ? wave.height + 0.3 : (body?.position.y ?? 0.8),
      };
    },
    { nextX: x, nextZ: z },
  );

  await patchPlayerBodyState(page, {
    position: { x, y: anchor.y, z },
    rotation: quaternionFromYaw(yaw),
    linvel: { x: 0, y: 0, z: 0 },
    angvel: { x: 0, y: 0, z: 0 },
  });
}

async function restoreWorstSample(page: Page, sample: WaveSyncSample | null): Promise<void> {
  if (!sample) return;
  await patchPlayerBodyState(page, {
    position: { x: sample.bodyX, y: sample.bodyY, z: sample.bodyZ },
    rotation: sample.rotation,
    linvel: { x: 0, y: 0, z: 0 },
    angvel: { x: 0, y: 0, z: 0 },
  });
  await page.waitForTimeout(200);
}

async function scanStationaryPositions(
  page: Page,
  positions: Array<{ x: number; z: number }>,
  iterations: number,
  intervalMs: number,
): Promise<PositionScanResult[]> {
  const results: PositionScanResult[] = [];

  for (const position of positions) {
    await moveBoatToStationaryPose(page, position.x, position.z);
    await page.waitForTimeout(300);
    const settled = await collectWorstSubmersion(page, iterations, intervalMs);
    results.push({
      x: position.x,
      z: position.z,
      worst: settled.worst,
      worstSample: settled.worstSample,
    });
  }

  return results;
}

async function waitForHorizontalSpeedBelow(
  page: Page,
  threshold: number,
  timeoutMs: number,
): Promise<void> {
  await page.waitForFunction(
    (maxHorizontalSpeed: number) => {
      type TestWindow = Window &
        typeof globalThis & {
          __TEST_SAMPLE_WAVE_SYNC__?: () => WaveSyncSample | null;
        };
      const w = window as TestWindow;
      const sample = w.__TEST_SAMPLE_WAVE_SYNC__?.();
      return sample != null && sample.horizontalSpeed <= maxHorizontalSpeed;
    },
    threshold,
    { timeout: timeoutMs },
  );
}

async function runDriveThenStopScenario(
  page: Page,
  scenario: DriveScenario,
  driveIterations = 25,
  stopIterations = 35,
): Promise<PositionScanResult> {
  await moveBoatToStationaryPose(page, scenario.x, scenario.z, scenario.yaw);
  await page.waitForTimeout(300);

  await page.keyboard.down('w');
  await collectWorstSubmersion(page, driveIterations, 100);
  await page.keyboard.up('w');

  await waitForHorizontalSpeedBelow(page, 2.0, 12_000);
  const stopped = await collectWorstSubmersion(page, stopIterations, 100);

  return {
    x: scenario.x,
    z: scenario.z,
    worst: stopped.worst,
    worstSample: stopped.worstSample,
  };
}

test.describe('Buoyancy visual sync', () => {
  test.describe.configure({ timeout: 180_000 });

  test('player boat should not remain deeply submerged while moving or after stopping', async ({
    page,
  }) => {
    await startPlaying(page);
    await installWaveSyncSampler(page);

    // Measure against the actual rendered hull bounds, not just the rigid-body origin.
    // That keeps the smoke tied to what is visibly on screen even if the model origin
    // or hull sample points move later.
    await page.waitForTimeout(2_500);
    const idle = await collectWorstSubmersion(page, 15, 100);
    await page.keyboard.down('w');
    const moving = await collectWorstSubmersion(page, 40, 100);
    await page.keyboard.up('w');

    const stopped = await collectWorstSubmersion(page, 60, 100);

    const failures: string[] = [];
    if (moving.worst >= 0.55) {
      failures.push(
        `Moving delta ${moving.worst.toFixed(3)}m at speed ${moving.worstSample?.speed.toFixed(3) ?? 'n/a'} m/s (hullPointY ${moving.worstSample?.worstHullPointY.toFixed(3) ?? 'n/a'}, hullWaveY ${moving.worstSample?.worstHullPointWaveY.toFixed(3) ?? 'n/a'}, hullPointXZ ${moving.worstSample ? `${moving.worstSample.worstHullPointX.toFixed(2)}, ${moving.worstSample.worstHullPointZ.toFixed(2)}` : 'n/a'})`,
      );
    }
    if (stopped.worst >= 0.55) {
      failures.push(
        `Stopped delta ${stopped.worst.toFixed(3)}m at speed ${stopped.worstSample?.speed.toFixed(3) ?? 'n/a'} m/s (hullPointY ${stopped.worstSample?.worstHullPointY.toFixed(3) ?? 'n/a'}, hullWaveY ${stopped.worstSample?.worstHullPointWaveY.toFixed(3) ?? 'n/a'}, hullPointXZ ${stopped.worstSample ? `${stopped.worstSample.worstHullPointX.toFixed(2)}, ${stopped.worstSample.worstHullPointZ.toFixed(2)}` : 'n/a'})`,
      );
    }

    expect(
      failures,
      `Idle worst ${idle.worst.toFixed(3)}m at speed ${idle.worstSample?.speed.toFixed(3) ?? 'n/a'} m/s`,
    ).toEqual([]);
  });

  test('player boat should not become deeply wave-out-of-sync at scanned stationary locations', async ({
    page,
  }) => {
    await startPlaying(page);
    await installWaveSyncSampler(page);

    const positions = [
      { x: -140, z: -140 },
      { x: -140, z: -70 },
      { x: -140, z: 0 },
      { x: -140, z: 70 },
      { x: -140, z: 140 },
      { x: -70, z: -140 },
      { x: -70, z: -70 },
      { x: -70, z: 0 },
      { x: -70, z: 70 },
      { x: -70, z: 140 },
      { x: 0, z: -140 },
      { x: 0, z: -70 },
      { x: 0, z: 70 },
      { x: 0, z: 140 },
      { x: 70, z: -140 },
      { x: 70, z: -70 },
      { x: 70, z: 0 },
      { x: 70, z: 70 },
      { x: 70, z: 140 },
      { x: 140, z: -140 },
      { x: 140, z: -70 },
      { x: 140, z: 0 },
      { x: 140, z: 70 },
      { x: 140, z: 140 },
    ];

    const results = await scanStationaryPositions(page, positions, 24, 100);
    const worst = results.reduce<PositionScanResult | null>((currentWorst, next) => {
      if (!currentWorst || next.worst > currentWorst.worst) return next;
      return currentWorst;
    }, null);

    await restoreWorstSample(page, worst?.worstSample ?? null);

    expect(
      worst?.worst ?? 0,
      `Worst stationary location delta ${(worst?.worst ?? 0).toFixed(3)}m at (${worst?.x ?? 'n/a'}, ${worst?.z ?? 'n/a'}) with hullPointY ${worst?.worstSample?.worstHullPointY.toFixed(3) ?? 'n/a'}, hullWaveY ${worst?.worstSample?.worstHullPointWaveY.toFixed(3) ?? 'n/a'}, horizontal speed ${worst?.worstSample?.horizontalSpeed.toFixed(3) ?? 'n/a'} m/s`,
    ).toBeLessThan(0.55);
  });

  test('player boat should stay wave-synced during longer stationary windows at scanned locations', async ({
    page,
  }) => {
    await startPlaying(page);
    await installWaveSyncSampler(page);

    const positions = [
      { x: -140, z: -140 },
      { x: -140, z: 0 },
      { x: -140, z: 140 },
      { x: 0, z: -140 },
      { x: 0, z: 0 },
      { x: 0, z: 140 },
      { x: 140, z: -140 },
      { x: 140, z: 0 },
      { x: 140, z: 140 },
    ];

    const results = await scanStationaryPositions(page, positions, 80, 100);
    const worst = results.reduce<PositionScanResult | null>((currentWorst, next) => {
      if (!currentWorst || next.worst > currentWorst.worst) return next;
      return currentWorst;
    }, null);

    await restoreWorstSample(page, worst?.worstSample ?? null);

    expect(
      worst?.worst ?? 0,
      `Worst long-window stationary delta ${(worst?.worst ?? 0).toFixed(3)}m at (${worst?.x ?? 'n/a'}, ${worst?.z ?? 'n/a'}) with hullPointY ${worst?.worstSample?.worstHullPointY.toFixed(3) ?? 'n/a'}, hullWaveY ${worst?.worstSample?.worstHullPointWaveY.toFixed(3) ?? 'n/a'}, horizontal speed ${worst?.worstSample?.horizontalSpeed.toFixed(3) ?? 'n/a'} m/s`,
    ).toBeLessThan(0.55);
  });

  test('player boat should not stay deeply out of sync after driving to scanned locations and stopping', async ({
    page,
  }) => {
    await startPlaying(page);
    await installWaveSyncSampler(page);

    const scenarios: DriveScenario[] = [
      { name: 'origin-forward', x: 0, z: 0, yaw: 0 },
      { name: 'west-to-center', x: -90, z: 0, yaw: Math.PI / 2 },
      { name: 'east-to-center', x: 90, z: 0, yaw: -Math.PI / 2 },
      { name: 'south-to-center', x: 0, z: -90, yaw: 0 },
      { name: 'north-to-center', x: 0, z: 90, yaw: Math.PI },
    ];

    const results: Array<PositionScanResult & { name: string }> = [];
    for (const scenario of scenarios) {
      const result = await runDriveThenStopScenario(page, scenario);
      results.push({ ...result, name: scenario.name });
    }

    const worst = results.reduce<(PositionScanResult & { name: string }) | null>(
      (currentWorst, next) => {
        if (!currentWorst || next.worst > currentWorst.worst) return next;
        return currentWorst;
      },
      null,
    );

    await restoreWorstSample(page, worst?.worstSample ?? null);

    expect(
      worst?.worst ?? 0,
      `Worst post-drive stopped delta ${(worst?.worst ?? 0).toFixed(3)}m in ${worst?.name ?? 'n/a'} at (${worst?.x ?? 'n/a'}, ${worst?.z ?? 'n/a'}) with hullPointY ${worst?.worstSample?.worstHullPointY.toFixed(3) ?? 'n/a'}, hullWaveY ${worst?.worstSample?.worstHullPointWaveY.toFixed(3) ?? 'n/a'}, horizontal speed ${worst?.worstSample?.horizontalSpeed.toFixed(3) ?? 'n/a'} m/s`,
    ).toBeLessThan(0.55);
  });

  test('player boat should not fall behind the waves after longer drives and a full stop', async ({
    page,
  }) => {
    await startPlaying(page);
    await installWaveSyncSampler(page);

    const scenarios: DriveScenario[] = [
      { name: 'far-south-to-center', x: 0, z: -120, yaw: 0 },
      { name: 'far-west-to-center', x: -120, z: 0, yaw: Math.PI / 2 },
      { name: 'far-east-to-center', x: 120, z: 0, yaw: -Math.PI / 2 },
      { name: 'far-north-to-center', x: 0, z: 120, yaw: Math.PI },
    ];

    const results: Array<PositionScanResult & { name: string }> = [];
    for (const scenario of scenarios) {
      const result = await runDriveThenStopScenario(page, scenario, 80, 45);
      results.push({ ...result, name: scenario.name });
    }

    const worst = results.reduce<(PositionScanResult & { name: string }) | null>(
      (currentWorst, next) => {
        if (!currentWorst || next.worst > currentWorst.worst) return next;
        return currentWorst;
      },
      null,
    );

    await restoreWorstSample(page, worst?.worstSample ?? null);

    expect(
      worst?.worst ?? 0,
      `Worst long-drive stopped delta ${(worst?.worst ?? 0).toFixed(3)}m in ${worst?.name ?? 'n/a'} at (${worst?.x ?? 'n/a'}, ${worst?.z ?? 'n/a'}) with hullPointY ${worst?.worstSample?.worstHullPointY.toFixed(3) ?? 'n/a'}, hullWaveY ${worst?.worstSample?.worstHullPointWaveY.toFixed(3) ?? 'n/a'}, covered ratio ${worst?.worstSample?.coveredRatio.toFixed(3) ?? 'n/a'}, horizontal speed ${worst?.worstSample?.horizontalSpeed.toFixed(3) ?? 'n/a'} m/s`,
    ).toBeLessThan(0.55);
  });
});
