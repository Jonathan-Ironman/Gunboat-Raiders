/**
 * useFullscreen — shared fullscreen toggle hook.
 *
 * Used by both `PauseMenu` and `MainMenuScene` to surface a single
 * "Fullscreen / Exit Fullscreen" button without duplicating the
 * Fullscreen API wiring in each component.
 *
 * ### Behaviour
 *
 * - Returns `{ isFullscreen, toggleFullscreen }`.
 * - `isFullscreen` is true when `document.fullscreenElement !== null`.
 * - Subscribes to the `fullscreenchange` event on mount so the flag
 *   updates when fullscreen is exited via ANY means (browser button,
 *   F11, Esc, or another API call).
 * - Unsubscribes on unmount to prevent memory leaks.
 * - `toggleFullscreen` calls `document.documentElement.requestFullscreen()`
 *   when not in fullscreen, and `document.exitFullscreen()` when in
 *   fullscreen. Both branches are wrapped in a `.catch()` handler — a
 *   browser rejection (e.g. iframe sandbox) silently no-ops; it must
 *   never crash or propagate to the React error boundary.
 *
 * ### Standard API only
 *
 * This hook uses the standards-track `requestFullscreen` /
 * `exitFullscreen` / `fullscreenchange` / `fullscreenElement` API.
 * Vendor-prefixed variants are intentionally omitted — the game
 * targets Chrome, Firefox, Edge, and Safari where the unprefixed API
 * is universally available.
 *
 * ### SSR safety
 *
 * Module imports are safe in Node — `readIsFullscreen` and the `useEffect`
 * body both guard against missing `document`. The hook may be mounted in
 * any environment; if `document` is unavailable the hook returns a benign
 * default state and registers no listeners. The `toggleFullscreen` body
 * calls `document.documentElement.requestFullscreen()`, but that is only
 * triggered by a user click — never on render or import — so module-import
 * safety is preserved.
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit testing without a DOM
// ---------------------------------------------------------------------------

/**
 * Read the current fullscreen state from `document.fullscreenElement`.
 *
 * Returns `false` in non-browser environments (Node, SSR) so the hook
 * starts in a known-off state when running headlessly.
 */
export function readIsFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.fullscreenElement !== null;
}

/**
 * Determine whether `requestFullscreen` or `exitFullscreen` should be
 * called given the current fullscreen state. Returns the action name so
 * the logic is testable without touching the real Fullscreen API.
 */
export function fullscreenAction(isCurrentlyFullscreen: boolean): 'request' | 'exit' {
  return isCurrentlyFullscreen ? 'exit' : 'request';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Return shape for `useFullscreen`. */
export interface UseFullscreenResult {
  /** `true` when the browser is currently in fullscreen mode. */
  readonly isFullscreen: boolean;
  /**
   * Toggle fullscreen on/off. Safe to call from any user-gesture
   * handler (button click qualifies). Rejects are silently swallowed
   * so the UI never crashes.
   */
  readonly toggleFullscreen: () => void;
}

/**
 * React hook that tracks and toggles browser fullscreen state.
 *
 * Must be called inside a React component mounted in a browser context.
 * Importing this module in Node is safe; calling the hook in Node is
 * not (effects are a no-op but `useState` works fine).
 */
export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(readIsFullscreen);

  // Sync state whenever fullscreen changes via any means.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleChange = (): void => {
      setIsFullscreen(readIsFullscreen());
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
    };
  }, []);

  const toggleFullscreen = useCallback((): void => {
    if (fullscreenAction(readIsFullscreen()) === 'request') {
      document.documentElement.requestFullscreen().catch((err: unknown) => {
        // Expected on iframe sandbox / missing user gesture. Logged so dev
        // builds surface unexpected failures.
        console.warn('[useFullscreen] requestFullscreen rejected:', err);
      });
    } else {
      document.exitFullscreen().catch((err: unknown) => {
        // Expected on iframe sandbox / missing user gesture. Logged so dev
        // builds surface unexpected failures.
        console.warn('[useFullscreen] exitFullscreen rejected:', err);
      });
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}
