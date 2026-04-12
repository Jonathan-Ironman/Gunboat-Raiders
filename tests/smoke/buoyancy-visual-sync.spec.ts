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
  bodyMinusRenderedWave: number;
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
  renderMidMinusRenderedWave: number;
  renderMidY: number;
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

interface DriveSegment {
  durationMs: number;
  keys: Array<'a' | 'd' | 's' | 'w'>;
}

interface WaveSyncWindowSummary {
  bodyMinusRenderedWaveRange: number;
  maxCoveredRatio: number;
  maxDeepCoveredRatio: number;
  maxPitchMagnitude: number;
  maxRollMagnitude: number;
  maxHorizontalSpeed: number;
  maxMeanHullDelta: number;
  maxRenderMidMinusRenderedWave: number;
  maxVerticalSpeed: number;
  meanBodyMinusRenderedWave: number;
  meanMeanHullDelta: number;
  meanRenderMidMinusRenderedWave: number;
  minBodyMinusRenderedWave: number;
  minPitch: number;
  minRenderMidMinusRenderedWave: number;
  minRoll: number;
  pitchRange: number;
  renderMidMinusRenderedWaveRange: number;
  rollRange: number;
  samples: WaveSyncSample[];
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
      const renderMidY = (renderBounds.min.y + renderBounds.max.y) * 0.5;
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
        bodyMinusRenderedWave: body.position.y - renderedWaveY,
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
        renderMidMinusRenderedWave: renderMidY - renderedWaveY,
        renderMidY,
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

async function collectWaveSyncWindow(
  page: Page,
  iterations: number,
  intervalMs: number,
): Promise<WaveSyncWindowSummary> {
  const { samples } = await collectWorstSubmersion(page, iterations, intervalMs);
  expect(
    samples.length,
    'Expected wave sync window to capture at least one sample.',
  ).toBeGreaterThan(0);

  const bodyOffsets = samples.map((sample) => sample.bodyMinusRenderedWave);
  const renderMidOffsets = samples.map((sample) => sample.renderMidMinusRenderedWave);
  const meanHullDeltas = samples.map((sample) => sample.meanHullDelta);
  const pitches = samples.map((sample) => pitchFromQuaternion(sample.rotation));
  const rolls = samples.map((sample) => rollFromQuaternion(sample.rotation));

  const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

  return {
    bodyMinusRenderedWaveRange: Math.max(...bodyOffsets) - Math.min(...bodyOffsets),
    maxCoveredRatio: Math.max(...samples.map((sample) => sample.coveredRatio)),
    maxDeepCoveredRatio: Math.max(...samples.map((sample) => sample.deepCoveredRatio)),
    maxPitchMagnitude: Math.max(...pitches.map((pitch) => Math.abs(pitch))),
    maxRollMagnitude: Math.max(...rolls.map((roll) => Math.abs(roll))),
    maxHorizontalSpeed: Math.max(...samples.map((sample) => sample.horizontalSpeed)),
    maxMeanHullDelta: Math.max(...meanHullDeltas),
    maxRenderMidMinusRenderedWave: Math.max(...renderMidOffsets),
    maxVerticalSpeed: Math.max(...samples.map((sample) => Math.abs(sample.linvel.y))),
    meanBodyMinusRenderedWave: sum(bodyOffsets) / bodyOffsets.length,
    meanMeanHullDelta: sum(meanHullDeltas) / meanHullDeltas.length,
    meanRenderMidMinusRenderedWave: sum(renderMidOffsets) / renderMidOffsets.length,
    minBodyMinusRenderedWave: Math.min(...bodyOffsets),
    minPitch: Math.min(...pitches),
    minRenderMidMinusRenderedWave: Math.min(...renderMidOffsets),
    minRoll: Math.min(...rolls),
    pitchRange: Math.max(...pitches) - Math.min(...pitches),
    renderMidMinusRenderedWaveRange: Math.max(...renderMidOffsets) - Math.min(...renderMidOffsets),
    rollRange: Math.max(...rolls) - Math.min(...rolls),
    samples,
  };
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

function yawFromQuaternion(rotation: { x: number; y: number; z: number; w: number }): number {
  const sinyCosp = 2 * (rotation.w * rotation.y + rotation.x * rotation.z);
  const cosyCosp = 1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z);
  return Math.atan2(sinyCosp, cosyCosp);
}

function pitchFromQuaternion(rotation: { x: number; y: number; z: number; w: number }): number {
  const sinPitch = 2 * (rotation.w * rotation.x - rotation.z * rotation.y);
  if (Math.abs(sinPitch) >= 1) {
    return Math.sign(sinPitch) * (Math.PI / 2);
  }
  return Math.asin(sinPitch);
}

function rollFromQuaternion(rotation: { x: number; y: number; z: number; w: number }): number {
  const sinRollCosp = 2 * (rotation.w * rotation.z + rotation.x * rotation.y);
  const cosRollCosp = 1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z);
  return Math.atan2(sinRollCosp, cosRollCosp);
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

async function setPressedKeys(
  page: Page,
  activeKeys: ReadonlySet<'a' | 'd' | 's' | 'w'>,
  nextKeys: readonly ('a' | 'd' | 's' | 'w')[],
): Promise<Set<'a' | 'd' | 's' | 'w'>> {
  const targetKeys = new Set(nextKeys);

  for (const key of activeKeys) {
    if (!targetKeys.has(key)) {
      await page.keyboard.up(key);
    }
  }

  for (const key of targetKeys) {
    if (!activeKeys.has(key)) {
      await page.keyboard.down(key);
    }
  }

  return targetKeys;
}

async function runRouteAndStop(
  page: Page,
  scenario: DriveScenario,
  segments: readonly DriveSegment[],
  stopSpeedThreshold = 0.15,
): Promise<WaveSyncWindowSummary> {
  await moveBoatToStationaryPose(page, scenario.x, scenario.z, scenario.yaw);
  await page.waitForTimeout(300);

  let activeKeys = new Set<'a' | 'd' | 's' | 'w'>();
  try {
    for (const segment of segments) {
      activeKeys = await setPressedKeys(page, activeKeys, segment.keys);
      await collectWorstSubmersion(page, Math.max(1, Math.ceil(segment.durationMs / 100)), 100);
    }
  } finally {
    await setPressedKeys(page, activeKeys, []);
  }

  await waitForHorizontalSpeedBelow(page, stopSpeedThreshold, 30_000);
  return collectWaveSyncWindow(page, 60, 100);
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

  test('player boat should return to the same whole-boat waterline band after a long drive', async ({
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

    let worstScenarioName = 'n/a';
    let worstOffsetDelta = -Infinity;
    let worstDetails = '';

    for (const scenario of scenarios) {
      await moveBoatToStationaryPose(page, scenario.x, scenario.z, scenario.yaw);
      await page.waitForTimeout(300);

      await page.keyboard.down('w');
      await collectWorstSubmersion(page, 80, 100);
      await page.keyboard.up('w');

      await waitForHorizontalSpeedBelow(page, 0.5, 20_000);
      const postDriveWindow = await collectWaveSyncWindow(page, 45, 100);
      const anchorSample = postDriveWindow.samples[postDriveWindow.samples.length - 1];
      expect(anchorSample, `Expected final sample for ${scenario.name}.`).toBeDefined();
      if (!anchorSample) continue;

      await moveBoatToStationaryPose(
        page,
        anchorSample.bodyX,
        anchorSample.bodyZ,
        yawFromQuaternion(anchorSample.rotation),
      );
      await page.waitForTimeout(2_000);
      await waitForHorizontalSpeedBelow(page, 0.15, 10_000);
      const referenceWindow = await collectWaveSyncWindow(page, 45, 100);

      const offsetDelta = Math.abs(
        postDriveWindow.meanBodyMinusRenderedWave - referenceWindow.meanBodyMinusRenderedWave,
      );
      if (offsetDelta > worstOffsetDelta) {
        worstOffsetDelta = offsetDelta;
        worstScenarioName = scenario.name;
        worstDetails =
          `post-drive mean body-wave ${postDriveWindow.meanBodyMinusRenderedWave.toFixed(3)}m, ` +
          `reference mean body-wave ${referenceWindow.meanBodyMinusRenderedWave.toFixed(3)}m, ` +
          `post-drive mean hull ${postDriveWindow.meanMeanHullDelta.toFixed(3)}m, ` +
          `reference mean hull ${referenceWindow.meanMeanHullDelta.toFixed(3)}m, ` +
          `post-drive max covered ${postDriveWindow.maxCoveredRatio.toFixed(3)}, ` +
          `reference max covered ${referenceWindow.maxCoveredRatio.toFixed(3)}, ` +
          `post-drive max horizontal speed ${postDriveWindow.maxHorizontalSpeed.toFixed(3)} m/s`;
      }
    }

    expect(
      worstOffsetDelta,
      `Worst whole-boat waterline offset drift ${worstOffsetDelta.toFixed(3)}m in ${worstScenarioName}: ${worstDetails}`,
    ).toBeLessThan(0.25);
  });

  test('player boat whole-body phase band should not widen after a long drive', async ({
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

    let worstScenarioName = 'n/a';
    let worstRangeDelta = -Infinity;
    let worstDetails = '';

    for (const scenario of scenarios) {
      await moveBoatToStationaryPose(page, scenario.x, scenario.z, scenario.yaw);
      await page.waitForTimeout(300);

      await page.keyboard.down('w');
      await collectWorstSubmersion(page, 80, 100);
      await page.keyboard.up('w');

      await waitForHorizontalSpeedBelow(page, 0.5, 20_000);
      const postDriveWindow = await collectWaveSyncWindow(page, 60, 100);
      const anchorSample = postDriveWindow.samples[postDriveWindow.samples.length - 1];
      expect(anchorSample, `Expected final sample for ${scenario.name}.`).toBeDefined();
      if (!anchorSample) continue;

      await moveBoatToStationaryPose(
        page,
        anchorSample.bodyX,
        anchorSample.bodyZ,
        yawFromQuaternion(anchorSample.rotation),
      );
      await page.waitForTimeout(2_000);
      await waitForHorizontalSpeedBelow(page, 0.15, 10_000);
      const referenceWindow = await collectWaveSyncWindow(page, 60, 100);

      const phaseBandDelta =
        postDriveWindow.bodyMinusRenderedWaveRange - referenceWindow.bodyMinusRenderedWaveRange;
      if (phaseBandDelta > worstRangeDelta) {
        worstRangeDelta = phaseBandDelta;
        worstScenarioName = scenario.name;
        worstDetails =
          `post-drive body-wave range ${postDriveWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, ` +
          `reference body-wave range ${referenceWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, ` +
          `post-drive render-mid range ${postDriveWindow.renderMidMinusRenderedWaveRange.toFixed(3)}m, ` +
          `reference render-mid range ${referenceWindow.renderMidMinusRenderedWaveRange.toFixed(3)}m, ` +
          `post-drive max covered ${postDriveWindow.maxCoveredRatio.toFixed(3)}, ` +
          `reference max covered ${referenceWindow.maxCoveredRatio.toFixed(3)}, ` +
          `post-drive max horizontal speed ${postDriveWindow.maxHorizontalSpeed.toFixed(3)} m/s`;
      }
    }

    expect(
      worstRangeDelta,
      `Worst whole-boat phase-band widening ${worstRangeDelta.toFixed(3)}m in ${worstScenarioName}: ${worstDetails}`,
    ).toBeLessThan(0.2);
  });

  test('player boat whole-body phase should recover after steering-heavy routes', async ({
    page,
  }) => {
    await startPlaying(page);
    await installWaveSyncSampler(page);

    const routeScenarios: Array<DriveScenario & { segments: DriveSegment[] }> = [
      {
        name: 'south-slalom',
        x: 0,
        z: -130,
        yaw: 0,
        segments: [
          { durationMs: 2200, keys: ['w'] },
          { durationMs: 2200, keys: ['w', 'd'] },
          { durationMs: 1800, keys: ['w'] },
          { durationMs: 2200, keys: ['w', 'a'] },
          { durationMs: 2200, keys: ['w'] },
        ],
      },
      {
        name: 'west-slalom',
        x: -130,
        z: 0,
        yaw: Math.PI / 2,
        segments: [
          { durationMs: 2200, keys: ['w'] },
          { durationMs: 2200, keys: ['w', 'a'] },
          { durationMs: 1800, keys: ['w'] },
          { durationMs: 2200, keys: ['w', 'd'] },
          { durationMs: 2200, keys: ['w'] },
        ],
      },
      {
        name: 'east-slalom',
        x: 130,
        z: 0,
        yaw: -Math.PI / 2,
        segments: [
          { durationMs: 2200, keys: ['w'] },
          { durationMs: 2200, keys: ['w', 'd'] },
          { durationMs: 1800, keys: ['w'] },
          { durationMs: 2200, keys: ['w', 'a'] },
          { durationMs: 2200, keys: ['w'] },
        ],
      },
    ];

    let worstScenarioName = 'n/a';
    let worstRangeDelta = -Infinity;
    let worstDetails = '';

    for (const scenario of routeScenarios) {
      const postDriveWindow = await runRouteAndStop(page, scenario, scenario.segments, 0.05);
      const anchorSample = postDriveWindow.samples[postDriveWindow.samples.length - 1];
      expect(anchorSample, `Expected final sample for ${scenario.name}.`).toBeDefined();
      if (!anchorSample) continue;

      await moveBoatToStationaryPose(
        page,
        anchorSample.bodyX,
        anchorSample.bodyZ,
        yawFromQuaternion(anchorSample.rotation),
      );
      await page.waitForTimeout(2_000);
      await waitForHorizontalSpeedBelow(page, 0.15, 10_000);
      const referenceWindow = await collectWaveSyncWindow(page, 60, 100);

      const phaseBandDelta =
        postDriveWindow.bodyMinusRenderedWaveRange - referenceWindow.bodyMinusRenderedWaveRange;
      if (phaseBandDelta > worstRangeDelta) {
        worstRangeDelta = phaseBandDelta;
        worstScenarioName = scenario.name;
        worstDetails =
          `post-drive body-wave range ${postDriveWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, ` +
          `reference body-wave range ${referenceWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, ` +
          `post-drive mean hull ${postDriveWindow.meanMeanHullDelta.toFixed(3)}m, ` +
          `reference mean hull ${referenceWindow.meanMeanHullDelta.toFixed(3)}m, ` +
          `post-drive pitch range ${postDriveWindow.pitchRange.toFixed(3)}rad, ` +
          `reference pitch range ${referenceWindow.pitchRange.toFixed(3)}rad, ` +
          `post-drive roll range ${postDriveWindow.rollRange.toFixed(3)}rad, ` +
          `reference roll range ${referenceWindow.rollRange.toFixed(3)}rad, ` +
          `post-drive max |vy| ${postDriveWindow.maxVerticalSpeed.toFixed(3)} m/s, ` +
          `reference max |vy| ${referenceWindow.maxVerticalSpeed.toFixed(3)} m/s, ` +
          `post-drive max covered ${postDriveWindow.maxCoveredRatio.toFixed(3)}, ` +
          `reference max covered ${referenceWindow.maxCoveredRatio.toFixed(3)}, ` +
          `post-drive max horizontal speed ${postDriveWindow.maxHorizontalSpeed.toFixed(3)} m/s`;
      }
    }

    expect(
      worstRangeDelta,
      `Worst steering-route whole-boat phase-band widening ${worstRangeDelta.toFixed(3)}m in ${worstScenarioName}: ${worstDetails}`,
    ).toBeLessThan(0.2);
  });

  test('diagnostic: random steering routes should not widen the whole-boat phase band', async ({
    page,
  }) => {
    test.skip(process.env.BUOYANCY_DIAGNOSTIC !== '1', 'Diagnostic scan disabled by default.');

    await startPlaying(page);
    await installWaveSyncSampler(page);

    const routeScenarios: Array<DriveScenario & { segments: DriveSegment[] }> = [
      {
        name: 'south-zigzag-long',
        x: 0,
        z: -145,
        yaw: 0,
        segments: [
          { durationMs: 1800, keys: ['w'] },
          { durationMs: 1500, keys: ['w', 'd'] },
          { durationMs: 1200, keys: ['w'] },
          { durationMs: 1800, keys: ['w', 'a'] },
          { durationMs: 1300, keys: ['w'] },
          { durationMs: 1600, keys: ['w', 'd'] },
          { durationMs: 1800, keys: ['w'] },
        ],
      },
      {
        name: 'west-zigzag-long',
        x: -145,
        z: 0,
        yaw: Math.PI / 2,
        segments: [
          { durationMs: 1800, keys: ['w'] },
          { durationMs: 1500, keys: ['w', 'a'] },
          { durationMs: 1200, keys: ['w'] },
          { durationMs: 1800, keys: ['w', 'd'] },
          { durationMs: 1300, keys: ['w'] },
          { durationMs: 1600, keys: ['w', 'a'] },
          { durationMs: 1800, keys: ['w'] },
        ],
      },
      {
        name: 'east-zigzag-long',
        x: 145,
        z: 0,
        yaw: -Math.PI / 2,
        segments: [
          { durationMs: 1800, keys: ['w'] },
          { durationMs: 1500, keys: ['w', 'd'] },
          { durationMs: 1200, keys: ['w'] },
          { durationMs: 1800, keys: ['w', 'a'] },
          { durationMs: 1300, keys: ['w'] },
          { durationMs: 1600, keys: ['w', 'd'] },
          { durationMs: 1800, keys: ['w'] },
        ],
      },
      {
        name: 'north-zigzag-long',
        x: 0,
        z: 145,
        yaw: Math.PI,
        segments: [
          { durationMs: 1800, keys: ['w'] },
          { durationMs: 1500, keys: ['w', 'a'] },
          { durationMs: 1200, keys: ['w'] },
          { durationMs: 1800, keys: ['w', 'd'] },
          { durationMs: 1300, keys: ['w'] },
          { durationMs: 1600, keys: ['w', 'a'] },
          { durationMs: 1800, keys: ['w'] },
        ],
      },
    ];

    let worstScenarioName = 'n/a';
    let worstRangeDelta = -Infinity;
    let worstDetails = '';

    for (const scenario of routeScenarios) {
      const postDriveWindow = await runRouteAndStop(page, scenario, scenario.segments, 0.15);
      const anchorSample = postDriveWindow.samples[postDriveWindow.samples.length - 1];
      expect(anchorSample, `Expected final sample for ${scenario.name}.`).toBeDefined();
      if (!anchorSample) continue;

      await moveBoatToStationaryPose(
        page,
        anchorSample.bodyX,
        anchorSample.bodyZ,
        yawFromQuaternion(anchorSample.rotation),
      );
      await page.waitForTimeout(2_000);
      await waitForHorizontalSpeedBelow(page, 0.15, 10_000);
      const referenceWindow = await collectWaveSyncWindow(page, 80, 100);

      const phaseBandDelta =
        postDriveWindow.bodyMinusRenderedWaveRange - referenceWindow.bodyMinusRenderedWaveRange;
      if (phaseBandDelta > worstRangeDelta) {
        worstRangeDelta = phaseBandDelta;
        worstScenarioName = scenario.name;
        worstDetails =
          `post-drive body-wave range ${postDriveWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, ` +
          `reference body-wave range ${referenceWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, ` +
          `post-drive mean hull ${postDriveWindow.meanMeanHullDelta.toFixed(3)}m, ` +
          `reference mean hull ${referenceWindow.meanMeanHullDelta.toFixed(3)}m, ` +
          `post-drive pitch range ${postDriveWindow.pitchRange.toFixed(3)}rad, ` +
          `reference pitch range ${referenceWindow.pitchRange.toFixed(3)}rad, ` +
          `post-drive roll range ${postDriveWindow.rollRange.toFixed(3)}rad, ` +
          `reference roll range ${referenceWindow.rollRange.toFixed(3)}rad, ` +
          `post-drive max |vy| ${postDriveWindow.maxVerticalSpeed.toFixed(3)} m/s, ` +
          `reference max |vy| ${referenceWindow.maxVerticalSpeed.toFixed(3)} m/s, ` +
          `post-drive max covered ${postDriveWindow.maxCoveredRatio.toFixed(3)}, ` +
          `reference max covered ${referenceWindow.maxCoveredRatio.toFixed(3)}, ` +
          `post-drive max horizontal speed ${postDriveWindow.maxHorizontalSpeed.toFixed(3)} m/s`;
      }
    }

    console.log(
      `[buoyancy-diagnostic] worst phase-band widening ${worstRangeDelta.toFixed(3)}m in ${worstScenarioName}: ${worstDetails}`,
    );

    expect(
      worstRangeDelta,
      `Diagnostic whole-boat phase-band widening ${worstRangeDelta.toFixed(3)}m in ${worstScenarioName}: ${worstDetails}`,
    ).toBeLessThan(0.2);
  });

  test('diagnostic: freezing xz motion should reveal whether drift is causing the phase band', async ({
    page,
  }) => {
    test.skip(process.env.BUOYANCY_DIAGNOSTIC !== '1', 'Diagnostic scan disabled by default.');

    await startPlaying(page);
    await installWaveSyncSampler(page);

    const scenario: DriveScenario & { segments: DriveSegment[] } = {
      name: 'south-zigzag-long',
      x: 0,
      z: -145,
      yaw: 0,
      segments: [
        { durationMs: 1800, keys: ['w'] },
        { durationMs: 1500, keys: ['w', 'd'] },
        { durationMs: 1200, keys: ['w'] },
        { durationMs: 1800, keys: ['w', 'a'] },
        { durationMs: 1300, keys: ['w'] },
        { durationMs: 1600, keys: ['w', 'd'] },
        { durationMs: 1800, keys: ['w'] },
      ],
    };

    const postDriveWindow = await runRouteAndStop(page, scenario, scenario.segments, 0.15);
    const anchorSample = postDriveWindow.samples[postDriveWindow.samples.length - 1];
    expect(anchorSample, `Expected final sample for ${scenario.name}.`).toBeDefined();
    if (!anchorSample) return;

    await patchPlayerBodyState(page, {
      position: { x: anchorSample.bodyX, y: anchorSample.bodyY, z: anchorSample.bodyZ },
      rotation: anchorSample.rotation,
      linvel: { x: 0, y: anchorSample.linvel.y, z: 0 },
      angvel: anchorSample.angvel,
    });
    await page.waitForTimeout(200);
    const frozenWindow = await collectWaveSyncWindow(page, 60, 100);

    await moveBoatToStationaryPose(
      page,
      anchorSample.bodyX,
      anchorSample.bodyZ,
      yawFromQuaternion(anchorSample.rotation),
    );
    await page.waitForTimeout(2_000);
    await waitForHorizontalSpeedBelow(page, 0.15, 10_000);
    const referenceWindow = await collectWaveSyncWindow(page, 60, 100);

    console.log(
      `[buoyancy-diagnostic-freeze] post ${postDriveWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, frozen ${frozenWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, reference ${referenceWindow.bodyMinusRenderedWaveRange.toFixed(3)}m, post max |vy| ${postDriveWindow.maxVerticalSpeed.toFixed(3)} m/s, frozen max |vy| ${frozenWindow.maxVerticalSpeed.toFixed(3)} m/s, reference max |vy| ${referenceWindow.maxVerticalSpeed.toFixed(3)} m/s`,
    );

    expect(postDriveWindow.bodyMinusRenderedWaveRange).toBeGreaterThanOrEqual(0);
  });
});
