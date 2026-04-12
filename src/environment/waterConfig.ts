import { DEFAULT_WAVES, initWaves } from './gerstnerWaves';
import type { WaveSamplingContract } from './waterTypes';
import { WAVE_UNIFORM_LAYOUT } from './waterTunables';

const initializedWaves = initWaves([...DEFAULT_WAVES]);

export const SHARED_WAVE_SAMPLING: WaveSamplingContract = {
  waves: initializedWaves,
};

/**
 * Encode initialized waves into a flat Float32Array for the GPU uniform.
 * Per wave: [dirX, dirZ, steepness, wavelength, amplitude, speed, phase] = 7 floats
 */
export function encodeWaveData(contract: WaveSamplingContract): Float32Array {
  const { waves } = contract;
  const data = new Float32Array(waves.length * WAVE_UNIFORM_LAYOUT.floatsPerWave);

  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    if (!w) continue;
    const base = i * WAVE_UNIFORM_LAYOUT.floatsPerWave;
    data[base + 0] = w.direction[0];
    data[base + 1] = w.direction[1];
    data[base + 2] = w.steepness;
    data[base + 3] = w.wavelength;
    data[base + 4] = w.amplitude;
    data[base + 5] = w.speed;
    data[base + 6] = w.phase;
  }

  return data;
}
