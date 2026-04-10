import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './App';
import './index.css';

// ---- Development-only globals -----------------------------------------------
// Expose game errors and the Zustand store on `window` so Playwright tests can
// read them via `page.evaluate()`. Everything here is guarded by
// `import.meta.env.DEV` so tree-shaking removes it entirely from production.
if (import.meta.env.DEV) {
  // Initialise the error accumulator synchronously so the logger (installed
  // below) can push into it immediately on first tick.
  (window as Window & typeof globalThis & { __GAME_ERRORS__: unknown[] }).__GAME_ERRORS__ = [];

  // Install error listeners (onerror, unhandledrejection, console.error patch).
  void import('./utils/errorLogger').then(({ installErrorLogger }) => {
    installErrorLogger();
  });

  // Install FPS performance monitor — exposes window.__GAME_PERF__.
  // The R3F PerfMonitorR3F component will take over timing from the Canvas
  // once it mounts; this standalone RAF loop acts as an early fallback.
  void import('./utils/perfMonitor').then(({ installPerfMonitor }) => {
    installPerfMonitor();
  });

  // Expose the Zustand store so tests can read game state.
  void import('./store/gameStore').then(({ useGameStore }) => {
    type DevWindow = Window &
      typeof globalThis & {
        __ZUSTAND_STORE__: typeof useGameStore;
      };
    (window as DevWindow).__ZUSTAND_STORE__ = useGameStore;
  });

  // Expose test-only fire bridge so Playwright can trigger cannons without
  // needing pointer lock (headless browsers cannot reliably acquire it).
  void import('./systems/weaponTestBridge').then(({ requestTestFire }) => {
    type DevWindow = Window & typeof globalThis & { __TEST_REQUEST_FIRE__: typeof requestTestFire };
    (window as DevWindow).__TEST_REQUEST_FIRE__ = requestTestFire;
  });

  // Expose physics body state cache and raw body accessor so tests can read positions.
  void import('./systems/physicsRefs').then(
    ({
      getPlayerBodyState,
      getPlayerBody,
      getAllEnemyBodyStates,
      getEnemyBodyState,
      getAllProjectileBodyStates,
    }) => {
      type DevWindow = Window &
        typeof globalThis & {
          __GET_PLAYER_BODY_STATE__: typeof getPlayerBodyState;
          __GET_PLAYER_BODY__: typeof getPlayerBody;
          __GET_ALL_ENEMY_BODY_STATES__: typeof getAllEnemyBodyStates;
          __GET_ENEMY_BODY_STATE__: typeof getEnemyBodyState;
          __GET_ALL_PROJECTILE_BODY_STATES__: typeof getAllProjectileBodyStates;
        };
      const devWindow = window as DevWindow;
      devWindow.__GET_PLAYER_BODY_STATE__ = getPlayerBodyState;
      devWindow.__GET_PLAYER_BODY__ = getPlayerBody;
      devWindow.__GET_ALL_ENEMY_BODY_STATES__ = getAllEnemyBodyStates;
      devWindow.__GET_ENEMY_BODY_STATE__ = getEnemyBodyState;
      devWindow.__GET_ALL_PROJECTILE_BODY_STATES__ = getAllProjectileBodyStates;
    },
  );
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
