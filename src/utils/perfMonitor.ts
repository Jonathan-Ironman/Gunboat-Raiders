/**
 * Development-only FPS performance monitor.
 *
 * Tracks frame timing and exposes a live snapshot on `window.__GAME_PERF__`
 * so Playwright tests and agents can read it via `page.evaluate()`.
 *
 * Two operating modes:
 *   1. Standalone RAF loop — started by `installPerfMonitor()` in main.tsx.
 *      Works without React Three Fiber.
 *   2. R3F integration — `PerfMonitorR3F` component calls
 *      `stopPerfMonitorRAF()` then `exposeGamePerf()` on mount, and drives
 *      updates via `feedR3FFrame()` from useFrame. This avoids double-counting.
 *
 * Statistics (minFPS, avgFPS) reset every RESET_INTERVAL_MS milliseconds to
 * surface recent performance rather than long-running averages.
 *
 * This module must ONLY be imported / called in development mode.
 */

/** How often (ms) min/avg statistics reset. */
const RESET_INTERVAL_MS = 5_000;

export interface GamePerfSnapshot {
  /** Most recent frame's FPS (1 / deltaSeconds). */
  currentFPS: number;
  /** Lowest FPS seen in the current reset window. */
  minFPS: number;
  /** Mean FPS across all frames in the current reset window. */
  avgFPS: number;
  /** Total frames rendered since the monitor started. */
  frameCount: number;
}

// ---------------------------------------------------------------------------
// Module-level mutable state — one singleton per app.
// ---------------------------------------------------------------------------

let rafHandle: number | null = null;
let lastTimestamp = 0;
let fpsAccumulator = 0;
let windowFrameCount = 0;
let windowElapsed = 0;

/** The live snapshot object. window.__GAME_PERF__ points to this directly. */
const snapshot: GamePerfSnapshot = {
  currentFPS: 0,
  minFPS: Infinity,
  avgFPS: 0,
  frameCount: 0,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resetWindow(): void {
  fpsAccumulator = 0;
  windowFrameCount = 0;
  windowElapsed = 0;
  snapshot.minFPS = Infinity;
}

function recordFrame(deltaMs: number): void {
  // Ignore degenerate deltas (tab hidden, post-pause resume, first frame).
  if (deltaMs <= 0 || deltaMs > 1_000) return;

  const fps = 1_000 / deltaMs;

  snapshot.currentFPS = fps;
  snapshot.frameCount += 1;

  fpsAccumulator += fps;
  windowFrameCount += 1;
  windowElapsed += deltaMs;

  if (fps < snapshot.minFPS) {
    snapshot.minFPS = fps;
  }

  snapshot.avgFPS = fpsAccumulator / windowFrameCount;

  if (windowElapsed >= RESET_INTERVAL_MS) {
    resetWindow();
  }
}

// ---------------------------------------------------------------------------
// RAF loop (standalone mode)
// ---------------------------------------------------------------------------

function rafTick(timestamp: number): void {
  if (lastTimestamp !== 0) {
    recordFrame(timestamp - lastTimestamp);
  }
  lastTimestamp = timestamp;
  rafHandle = requestAnimationFrame(rafTick);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type DevWindow = Window &
  typeof globalThis & {
    __GAME_PERF__: GamePerfSnapshot;
  };

/**
 * Expose `window.__GAME_PERF__` pointing at the live snapshot object.
 * Does not start the RAF loop. Safe to call multiple times.
 */
export function exposeGamePerf(): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;
  (window as DevWindow).__GAME_PERF__ = snapshot;
}

/**
 * Install the standalone RAF-based FPS loop and expose `window.__GAME_PERF__`.
 * Call once from `main.tsx` inside the `import.meta.env.DEV` guard.
 * If the R3F component mounts later it will call `stopPerfMonitorRAF()` and
 * take over timing via `feedR3FFrame()`.
 */
export function installPerfMonitor(): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;
  exposeGamePerf();
  if (rafHandle === null) {
    rafHandle = requestAnimationFrame(rafTick);
  }
}

/**
 * Stop the standalone RAF loop without removing `window.__GAME_PERF__`.
 * Called by `PerfMonitorR3F` when it takes over timing via useFrame.
 */
export function stopPerfMonitorRAF(): void {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
  lastTimestamp = 0;
}

/**
 * Feed one frame delta from the R3F render loop.
 * Call from a useFrame hook after calling `stopPerfMonitorRAF()`.
 * @param deltaSeconds - Frame delta in seconds (R3F useFrame `delta` arg).
 */
export function feedR3FFrame(deltaSeconds: number): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;
  recordFrame(deltaSeconds * 1_000);
}

/**
 * Return a point-in-time copy of the current snapshot.
 * The live object is always available on `window.__GAME_PERF__`.
 */
export function getPerfSnapshot(): Readonly<GamePerfSnapshot> {
  return { ...snapshot };
}
