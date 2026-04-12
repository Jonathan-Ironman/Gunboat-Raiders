import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { initWaves, getWaveHeight, DEFAULT_WAVES } from './gerstnerWaves';
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

  const waves = useMemo(() => initWaves([...DEFAULT_WAVES]), []);

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

  useEffect(() => {
    if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;

    type TestWindow = Window &
      typeof globalThis & {
        __TEST_GET_WAVE_SAMPLE__?: (
          x: number,
          z: number,
        ) => { height: number; normal: [number, number, number]; time: number };
      };

    const w = window as TestWindow;
    w.__TEST_GET_WAVE_SAMPLE__ = (x: number, z: number) => {
      const time = timeRef.current;
      const sample = getWaveHeight(x, z, time, waves);
      return { ...sample, time };
    };

    return () => {
      delete w.__TEST_GET_WAVE_SAMPLE__;
    };
  }, [waves]);

  return <WaterCtx.Provider value={value}>{children}</WaterCtx.Provider>;
}
