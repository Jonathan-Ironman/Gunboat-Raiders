import { useContext } from 'react';
import { WaterCtx } from './waterTypes';
import type { WaterContextValue } from './waterTypes';

export type { WaterContextValue };

export function useWater(): WaterContextValue {
  const ctx = useContext(WaterCtx);
  if (!ctx) {
    throw new Error('useWater must be used within a <WaterProvider>');
  }
  return ctx;
}
