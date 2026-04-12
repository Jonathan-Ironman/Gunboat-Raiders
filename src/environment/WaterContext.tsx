import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { getWaveHeight } from './gerstnerWaves';
import { SHARED_WAVE_SAMPLING } from './waterConfig';
import { WaterCtx } from './waterTypes';
import type { WaterContextValue } from './waterTypes';

interface WaterProviderProps {
  children: ReactNode;
}

/**
 * Provides wave sampling functions to child components.
 * Tracks elapsed time via useFrame and stores it in a ref for non-reactive access.
 */
export function WaterProvider({ children }: WaterProviderProps) {
  const timeRef = useRef(0);

  const waves = useMemo(() => SHARED_WAVE_SAMPLING.waves, []);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  const value = useMemo<WaterContextValue>(
    () => ({
      getWaveHeightAtPosition: (x: number, z: number) => {
        return getWaveHeight(x, z, timeRef.current, waves);
      },
      getWaveHeightAtTime: (x: number, z: number, time: number) => {
        return getWaveHeight(x, z, time, waves);
      },
      waves,
    }),
    [waves],
  );

  return <WaterCtx.Provider value={value}>{children}</WaterCtx.Provider>;
}
