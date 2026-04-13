/**
 * Dev-only bridge that lets automated tests (Playwright) request a cannon fire
 * without needing pointer lock. The production weapon pipeline requires the
 * user to click inside a pointer-locked canvas — headless browsers cannot
 * reliably acquire pointer lock, so tests use this bridge instead.
 *
 * Usage from tests:
 *   await page.evaluate(() => window.__TEST_REQUEST_FIRE__());
 *
 * The WeaponSystemR3F component polls `consumeTestFireRequests()` each frame
 * and drains however many test clicks landed since the previous frame. Kept separate from
 * WeaponSystemR3F.tsx to satisfy react-refresh (component files must only
 * export React components).
 */

let pendingTestFireRequests = 0;

/** Called by tests (via a window global) to request a fire next frame. */
export function requestTestFire(): void {
  pendingTestFireRequests += 1;
}

/**
 * Consume and clear all pending fire requests since the last call.
 * Returns the exact number of clicks the test bridge received.
 */
export function consumeTestFireRequests(): number {
  const count = pendingTestFireRequests;
  pendingTestFireRequests = 0;
  return count;
}
