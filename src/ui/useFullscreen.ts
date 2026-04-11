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
 *   fullscreen. Both branches are wrapped in a try/catch — a browser
 *   rejection (e.g. iframe sandbox) silently no-ops; it must never
 *   crash or propagate to the React error boundary.
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
 * All `document` accesses are guarded with `typeof document !== 'undefined'`
 * so the module is safe to import in a Node.js test runner (our Vitest
 * environment is `node`, not `jsdom`). The hook itself must only be
 * called in a browser (React requires a DOM for effects), but the
 * module import must not throw.
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
    const handleChange = (): void => {
      setIsFullscreen(readIsFullscreen());
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
    };
  }, []);

  const toggleFullscreen = useCallback((): void => {
    if (fullscreenAction(isFullscreen) === 'request') {
      document.documentElement.requestFullscreen().catch(() => {
        // Browser rejected the request (e.g. iframe sandbox, user
        // gesture policy). Silently ignore — the button label will
        // simply not change.
      });
    } else {
      document.exitFullscreen().catch(() => {
        // Unlikely — exit almost never fails — but guard anyway.
      });
    }
  }, [isFullscreen]);

  return { isFullscreen, toggleFullscreen };
}
