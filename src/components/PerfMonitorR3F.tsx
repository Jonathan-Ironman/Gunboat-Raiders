/**
 * R3F FPS monitor component.
 *
 * When mounted inside <Canvas>, this component takes ownership of FPS
 * tracking by:
 *   1. Stopping the standalone RAF loop started by `installPerfMonitor()`.
 *   2. Driving perf updates via R3F's useFrame so `window.__GAME_PERF__`
 *      reflects canvas render timing exactly.
 *
 * Renders nothing. Mount once inside <Canvas> (dev mode only).
 * In production this module is tree-shaken away entirely.
 */

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { stopPerfMonitorRAF, exposeGamePerf, feedR3FFrame } from '@/utils/perfMonitor';

function PerfMonitorFrameHook() {
  useFrame((_state, delta) => {
    feedR3FFrame(delta);
  });
  return null;
}

/**
 * Mount inside <Canvas> to track FPS via the R3F render loop.
 * Only active in development mode.
 */
export function PerfMonitorR3F() {
  useEffect(() => {
    // Hand timing ownership to useFrame.
    stopPerfMonitorRAF();
    // Re-expose the global in case it was removed; the live snapshot object
    // is updated in-place by feedR3FFrame so no further setup is needed.
    exposeGamePerf();
  }, []);

  return <PerfMonitorFrameHook />;
}
