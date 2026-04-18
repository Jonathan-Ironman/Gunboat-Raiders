/**
 * Detects whether the app is running under an end-to-end test harness.
 *
 * Two independent signals are checked so the flag survives harness quirks:
 *
 * 1. `VITE_E2E` build-time env var — set by `playwright.config.ts` when the
 *    dev server is started by Playwright itself.
 * 2. `?e2e=1` URL query param — a runtime fallback used when the dev server
 *    was started outside of Playwright (e.g. `reuseExistingServer: true` on
 *    local runs, or the Playwright MCP tooling which only navigates and
 *    never boots a server, so no env var ever reaches the app).
 *
 * Either signal is sufficient — they complement each other. Code paths that
 * would leak browser state onto the host (notably `requestPointerLock()` on
 * Windows, which leaves `ClipCursor` bounds on the desktop after teardown)
 * must consult this helper before running.
 */
export function isE2E(): boolean {
  if (import.meta.env.VITE_E2E === '1') return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('e2e');
}
