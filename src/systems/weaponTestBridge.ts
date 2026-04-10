/**
 * Dev-only bridge that lets automated tests (Playwright) request a cannon fire
 * without needing pointer lock. The production weapon pipeline requires the
 * user to click inside a pointer-locked canvas — headless browsers cannot
 * reliably acquire pointer lock, so tests use this bridge instead.
 *
 * Usage from tests:
 *   await page.evaluate(() => window.__TEST_REQUEST_FIRE__());
 *
 * The WeaponSystemR3F component polls `consumeTestFireRequest()` each frame
 * and triggers a fire if a request is pending. Kept separate from
 * WeaponSystemR3F.tsx to satisfy react-refresh (component files must only
 * export React components).
 */

let testFireRequested = false;

/** Called by tests (via a window global) to request a fire next frame. */
export function requestTestFire(): void {
  testFireRequested = true;
}

/**
 * Consume the pending fire request (if any). Returns true if a fire was
 * requested since the last call.
 */
export function consumeTestFireRequest(): boolean {
  if (testFireRequested) {
    testFireRequested = false;
    return true;
  }
  return false;
}
