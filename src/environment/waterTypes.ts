/**
 * Shared water context definition — separated from the provider component
 * to satisfy react-refresh (components-only file rule).
 */
import { createContext } from 'react';
import type { GerstnerWave, WaveSample } from './gerstnerWaves';

export interface WaterContextValue {
  /** Sample wave height and normal at world position (x, z) using current time. */
  getWaveHeightAtPosition: (x: number, z: number) => WaveSample;
  /** Sample wave height and normal at world position (x, z) at a specific time. */
  getWaveHeightAtTime: (x: number, z: number, time: number) => WaveSample;
  /** The initialized wave parameters. */
  waves: readonly GerstnerWave[];
}

export const WaterCtx = createContext<WaterContextValue | null>(null);
