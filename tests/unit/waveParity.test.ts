import { describe, expect, it } from 'vitest';
import { getWaveHeight } from '../../src/environment/gerstnerWaves';
import { SHARED_WAVE_SAMPLING } from '../../src/environment/waterConfig';
import { WAVE_MODULATION } from '../../src/environment/waterTunables';

function fract(value: number): number {
  return value - Math.floor(value);
}

function mix(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

function shaderHash2D(x: number, z: number): number {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

function shaderNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fxRaw = fract(x);
  const fzRaw = fract(z);
  const fx = fxRaw * fxRaw * (3 - 2 * fxRaw);
  const fz = fzRaw * fzRaw * (3 - 2 * fzRaw);

  const a = shaderHash2D(ix, iz);
  const b = shaderHash2D(ix + 1, iz);
  const c = shaderHash2D(ix, iz + 1);
  const d = shaderHash2D(ix + 1, iz + 1);

  return mix(mix(a, b, fx), mix(c, d, fx), fz);
}

function shaderMirrorHeightAndNormal(x: number, z: number, time: number) {
  const waves = SHARED_WAVE_SAMPLING.waves;
  function sampleSourceDisplacement(sourceX: number, sourceZ: number) {
    const noiseX = sourceX * WAVE_MODULATION.noiseScale + time * WAVE_MODULATION.timeScale;
    const noiseZ = sourceZ * WAVE_MODULATION.noiseScale + time * WAVE_MODULATION.timeScale;
    const modNoise = shaderNoise2D(noiseX, noiseZ);
    const ampMod = mix(
      WAVE_MODULATION.minAmplitudeMultiplier,
      WAVE_MODULATION.maxAmplitudeMultiplier,
      modNoise,
    );

    let dx = 0;
    let dy = 0;
    let dz = 0;
    let dNx = 0;
    let dNz = 0;

    for (let i = 0; i < waves.length; i++) {
      const wave = waves[i];
      if (!wave) continue;

      const k = (2 * Math.PI) / wave.wavelength;
      const amp = i < WAVE_MODULATION.modulatedWaveCount ? wave.amplitude * ampMod : wave.amplitude;
      const theta =
        k * (wave.direction[0] * sourceX + wave.direction[1] * sourceZ) -
        wave.speed * k * time +
        wave.phase;

      const s = Math.sin(theta);
      const c = Math.cos(theta);

      dx += wave.direction[0] * amp * c;
      dz += wave.direction[1] * amp * c;
      dy += amp * s;
      dNx += wave.direction[0] * k * amp * c;
      dNz += wave.direction[1] * k * amp * c;
    }

    const nx = -dNx;
    const ny = 1;
    const nz = -dNz;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

    return {
      worldX: sourceX + dx,
      worldZ: sourceZ + dz,
      height: dy,
      normal: [nx / len, ny / len, nz / len] as const,
    };
  }

  let sourceX = x;
  let sourceZ = z;
  for (let i = 0; i < 8; i++) {
    const displaced = sampleSourceDisplacement(sourceX, sourceZ);
    sourceX += x - displaced.worldX;
    sourceZ += z - displaced.worldZ;
  }

  const resolved = sampleSourceDisplacement(sourceX, sourceZ);
  return {
    height: resolved.height,
    normal: resolved.normal,
  };
}

describe('wave CPU/shader parity', () => {
  it('matches mirrored shader height + normal in world space across multiple coordinates', () => {
    const samples: Array<[number, number, number]> = [
      [0, 0, 0],
      [10.5, -4.25, 1.75],
      [-63.4, 22.1, 7.3],
      [140.8, -88.2, 15.0],
      [3.2, 190.4, 0.4],
    ];

    for (const [x, z, time] of samples) {
      const cpu = getWaveHeight(x, z, time, SHARED_WAVE_SAMPLING.waves);
      const shaderMirror = shaderMirrorHeightAndNormal(x, z, time);

      expect(cpu.height).toBeCloseTo(shaderMirror.height, 6);
      expect(cpu.normal[0]).toBeCloseTo(shaderMirror.normal[0], 6);
      expect(cpu.normal[1]).toBeCloseTo(shaderMirror.normal[1], 6);
      expect(cpu.normal[2]).toBeCloseTo(shaderMirror.normal[2], 6);
    }
  });

  it('includes world-space horizontal displacement in sampled height', () => {
    const x = -65;
    const z = 170;
    const time = 26;

    const cpu = getWaveHeight(x, z, time, SHARED_WAVE_SAMPLING.waves);

    const sourceSpaceOnly = (() => {
      const waves = SHARED_WAVE_SAMPLING.waves;
      const noiseX = x * WAVE_MODULATION.noiseScale + time * WAVE_MODULATION.timeScale;
      const noiseZ = z * WAVE_MODULATION.noiseScale + time * WAVE_MODULATION.timeScale;
      const modNoise = shaderNoise2D(noiseX, noiseZ);
      const ampMod = mix(
        WAVE_MODULATION.minAmplitudeMultiplier,
        WAVE_MODULATION.maxAmplitudeMultiplier,
        modNoise,
      );

      let dy = 0;
      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i];
        if (!wave) continue;
        const k = (2 * Math.PI) / wave.wavelength;
        const amp =
          i < WAVE_MODULATION.modulatedWaveCount ? wave.amplitude * ampMod : wave.amplitude;
        const theta =
          k * (wave.direction[0] * x + wave.direction[1] * z) - wave.speed * k * time + wave.phase;
        dy += amp * Math.sin(theta);
      }
      return dy;
    })();

    expect(cpu.height).not.toBeCloseTo(sourceSpaceOnly, 3);
  });

  it('includes modulation terms in height (first waves are noise-modulated)', () => {
    const x = 33.3;
    const z = -71.2;
    const time = 4.4;

    const mirror = shaderMirrorHeightAndNormal(x, z, time);

    // Control mirror that disables modulation intentionally for comparison.
    const noMod = (() => {
      const waves = SHARED_WAVE_SAMPLING.waves;
      let dy = 0;
      for (const wave of waves) {
        const k = (2 * Math.PI) / wave.wavelength;
        const theta =
          k * (wave.direction[0] * x + wave.direction[1] * z) - wave.speed * k * time + wave.phase;
        dy += wave.amplitude * Math.sin(theta);
      }
      return dy;
    })();

    expect(mirror.height).not.toBeCloseTo(noMod, 6);
  });
});
