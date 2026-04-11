import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './App';
import { installErrorLogger } from './utils/errorLogger';
import { installPerfMonitor } from './utils/perfMonitor';
import { useGameStore } from './store/gameStore';
import { requestTestFire } from './systems/weaponTestBridge';
import { requestTestAzimuth } from './systems/cameraTestBridge';
import {
  getPlayerBodyState,
  getPlayerBody,
  getAllEnemyBodyStates,
  getEnemyBodyState,
  getAllProjectileBodyStates,
} from './systems/physicsRefs';
import './index.css';

// ---- Test / development globals --------------------------------------------
// Expose game errors and the Zustand store on `window` so Playwright tests can
// read them via `page.evaluate()`. Enabled in dev mode AND in e2e builds
// (`VITE_E2E=1 pnpm build`) so we can run the full smoke+scenario suite
// against the real production bundle. The actual production deploy is built
// without VITE_E2E, so Vite's `import.meta.env.DEV` / `VITE_E2E` replacement
// folds the condition to `false` and rollup dead-code-eliminates the block.
// Imports above are already referenced by app code elsewhere, so they add
// zero bytes beyond the live-code paths.
if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
  type TestWindow = Window &
    typeof globalThis & {
      __GAME_ERRORS__: unknown[];
      __ZUSTAND_STORE__: typeof useGameStore;
      __TEST_REQUEST_FIRE__: typeof requestTestFire;
      __SET_CAMERA_AZIMUTH__: typeof requestTestAzimuth;
      __GET_PLAYER_BODY_STATE__: typeof getPlayerBodyState;
      __GET_PLAYER_BODY__: typeof getPlayerBody;
      __GET_ALL_ENEMY_BODY_STATES__: typeof getAllEnemyBodyStates;
      __GET_ENEMY_BODY_STATE__: typeof getEnemyBodyState;
      __GET_ALL_PROJECTILE_BODY_STATES__: typeof getAllProjectileBodyStates;
    };
  const w = window as TestWindow;

  // Initialise the error accumulator synchronously so the logger (installed
  // below) can push into it immediately on first tick.
  w.__GAME_ERRORS__ = [];

  // Install error listeners (onerror, unhandledrejection, console.error patch).
  installErrorLogger();

  // Install FPS performance monitor — exposes window.__GAME_PERF__.
  // The R3F PerfMonitorR3F component will take over timing from the Canvas
  // once it mounts; this standalone RAF loop acts as an early fallback.
  installPerfMonitor();

  // Expose the Zustand store so tests can read game state.
  w.__ZUSTAND_STORE__ = useGameStore;

  // Expose test-only fire bridge so Playwright can trigger cannons without
  // needing pointer lock (headless browsers cannot reliably acquire it).
  w.__TEST_REQUEST_FIRE__ = requestTestFire;

  // Expose camera azimuth setter so tests can drive the orbit angle without
  // simulating pointer-lock mouse deltas.
  w.__SET_CAMERA_AZIMUTH__ = requestTestAzimuth;

  // Expose physics body state cache and raw body accessor so tests can read positions.
  w.__GET_PLAYER_BODY_STATE__ = getPlayerBodyState;
  w.__GET_PLAYER_BODY__ = getPlayerBody;
  w.__GET_ALL_ENEMY_BODY_STATES__ = getAllEnemyBodyStates;
  w.__GET_ENEMY_BODY_STATE__ = getEnemyBodyState;
  w.__GET_ALL_PROJECTILE_BODY_STATES__ = getAllProjectileBodyStates;
}
// -----------------------------------------------------------------------------

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found — check index.html has <div id="root">');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
