/**
 * Shared water sampling + rendering contracts.
 * Keep this file focused on type contracts to avoid implementation drift.
 */
import { createContext } from 'react';
import type { GerstnerWave, WaveSample } from './gerstnerWaves';

export interface WaveModulationConfig {
  /** Number of leading waves (by index) that receive amplitude modulation. */
  modulatedWaveCount: number;
  /** Noise sampling scale for world-space X/Z coordinates. */
  noiseScale: number;
  /** Temporal drift factor applied to both noise axes. */
  timeScale: number;
  /** Minimum amplitude multiplier from noise remap. */
  minAmplitudeMultiplier: number;
  /** Maximum amplitude multiplier from noise remap. */
  maxAmplitudeMultiplier: number;
}

/**
 * Contract for all terms that can affect sampled height.
 * Height = sum(base Gerstner waves) + wave-level amplitude modulation.
 */
export interface WaveSamplingContract {
  waves: readonly GerstnerWave[];
  modulation: WaveModulationConfig;
}

export interface WaterContextValue {
  /** Sample wave height and normal at world position (x, z) using current time. */
  getWaveHeightAtPosition: (x: number, z: number) => WaveSample;
  /** Sample wave height and normal at world position (x, z) at a specific time. */
  getWaveHeightAtTime: (x: number, z: number, time: number) => WaveSample;
  /** Shared initialized wave parameters used by both CPU and GPU paths. */
  waves: readonly GerstnerWave[];
}

export const WaterCtx = createContext<WaterContextValue | null>(null);
