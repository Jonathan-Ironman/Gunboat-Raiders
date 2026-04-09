/**
 * Reusable Playwright helpers for Gunboat Raiders smoke tests.
 *
 * These utilities read from the development-only window globals exposed by
 * `src/main.tsx`:
 *   - `window.__GAME_ERRORS__`   — captured JS errors
 *   - `window.__ZUSTAND_STORE__` — live Zustand store reference
 */

import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared types (mirrored from src/utils/errorLogger.ts)
// Kept here to avoid cross-tsconfig imports between the node and app configs.
// ---------------------------------------------------------------------------

export interface GameError {
  timestamp: string;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  type: 'uncaught' | 'unhandled-rejection' | 'console-error' | 'error-boundary';
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * Returns human-readable strings for all errors captured since the page loaded.
 */
export async function getGameErrors(page: Page): Promise<string[]> {
  const errors = await page.evaluate<GameError[]>(() => {
    const w = window as Window & { __GAME_ERRORS__?: GameError[] };
    return w.__GAME_ERRORS__ ?? [];
  });

  return errors.map((e) => `[${e.type}] ${e.timestamp} — ${e.message}`);
}

/**
 * Returns all raw `GameError` objects captured since the page loaded.
 */
export async function getRawGameErrors(page: Page): Promise<GameError[]> {
  return page.evaluate<GameError[]>(() => {
    const w = window as Window & { __GAME_ERRORS__?: GameError[] };
    return w.__GAME_ERRORS__ ?? [];
  });
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain-object snapshot of the current Zustand store state.
 * Returns `null` if the store has not been exposed yet.
 */
export async function getGameState(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate<Record<string, unknown> | null>(() => {
    type StoreRef = { getState: () => Record<string, unknown> };
    const w = window as Window & { __ZUSTAND_STORE__?: StoreRef };
    return w.__ZUSTAND_STORE__ ? w.__ZUSTAND_STORE__.getState() : null;
  });
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the root, wait for `networkidle`, and ensure the React root
 * has mounted before returning.
 */
export async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('#root').waitFor({ state: 'attached', timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Phase helpers
// ---------------------------------------------------------------------------

/**
 * Polls `window.__ZUSTAND_STORE__.getState().phase` until it equals the
 * expected value, or the timeout elapses.
 *
 * @param page     - Playwright page object
 * @param phase    - The `GamePhase` value to wait for (e.g. `'playing'`)
 * @param timeout  - Maximum wait in milliseconds (default: 15 000)
 */
export async function waitForPhase(page: Page, phase: string, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    (expectedPhase: string) => {
      type StoreRef = { getState: () => { phase?: string } };
      const w = window as Window & { __ZUSTAND_STORE__?: StoreRef };
      return w.__ZUSTAND_STORE__?.getState().phase === expectedPhase;
    },
    phase,
    { timeout },
  );
}
