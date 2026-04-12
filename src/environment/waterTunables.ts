import type { WaveModulationConfig } from './waterTypes';

export const WATER_GEOMETRY = {
  planeSize: 2000,
  planeSegments: 128,
} as const;

export const WAVE_UNIFORM_LAYOUT = {
  floatsPerWave: 7,
} as const;

export const WAVE_MODULATION: WaveModulationConfig = {
  modulatedWaveCount: 2,
  noiseScale: 0.005,
  timeScale: 0.01,
  minAmplitudeMultiplier: 0.6,
  maxAmplitudeMultiplier: 1.2,
};
