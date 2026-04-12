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
  linvel: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
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
  time: number;
  renderedMinusBottom: number;
  renderedMinusVisibleBottom: number;
  renderedMinusCpu: number;
  bodyY: number;
  visibleBottomY: number;
  waveY: number;
  renderedWaveY: number;
  speed: number;
  worstHullPointWaveY: number;
  worstHullPointX: number;
  worstHullPointY: number;
  worstHullPointZ: number;
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
      const firstHullPoint = renderHullPoints[0];
      if (!firstHullPoint) return null;

      let worstHullPoint: RenderPoint = firstHullPoint;
      let worstHullPointWaveY = sampleRenderedHeightAtWorld(
        worstHullPoint.x,
        worstHullPoint.z,
        wave.time,
      );
      let worstHullDelta = worstHullPointWaveY - worstHullPoint.y;

      for (let i = 1; i < renderHullPoints.length; i++) {
        const point = renderHullPoints[i];
        if (!point) continue;
        const pointWaveY = sampleRenderedHeightAtWorld(point.x, point.z, wave.time);
        const pointDelta = pointWaveY - point.y;
        if (pointDelta > worstHullDelta) {
          worstHullDelta = pointDelta;
          worstHullPoint = point;
          worstHullPointWaveY = pointWaveY;
        }
      }

      return {
        time: wave.time,
        renderedMinusBottom: renderedWaveY - body.position.y,
        renderedMinusVisibleBottom: worstHullDelta,
        renderedMinusCpu: renderedWaveY - wave.height,
        bodyY: body.position.y,
        visibleBottomY: renderBounds.min.y,
        waveY: wave.height,
        renderedWaveY,
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

test.describe('Buoyancy visual sync', () => {
  test.describe.configure({ timeout: 120_000 });

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
});
