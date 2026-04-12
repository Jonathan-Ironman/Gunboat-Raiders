/**
 * Dev-only bridge that lets automated tests (Playwright) directly drive the
 * camera orbit azimuth without simulating pointer-lock mouse events. The
 * production camera rotates via raw mouse deltas inside pointer lock, which
 * headless browsers cannot reliably acquire, so tests use this bridge to
 * prove the firing pipeline's camera → quadrant → fire pathway end to end.
 *
 * Usage from tests:
 *   await page.evaluate((a) => window.__SET_CAMERA_AZIMUTH__(a), azimuth);
 *
 * The bridge is *sticky*: once a test sets an azimuth, CameraSystemR3F uses
 * that value for both orbit positioning and active-quadrant derivation on
 * every subsequent frame until cleared with `__SET_CAMERA_AZIMUTH__(null)`.
 * While forced, the camera system bypasses pointer-lock/cursor quadrant
 * branching and does not mutate pointer-lock state.
 *
 * Kept in a separate module from CameraSystemR3F.tsx to satisfy
 * react-refresh's "component files only export components" rule.
 */

let forcedAzimuth: number | null = null;

/**
 * Called by tests (via a window global) to request (or clear) a camera
 * azimuth override. Pass a number to force the azimuth; pass null to
 * release the override and return the camera to its normal input mode.
 */
export function requestTestAzimuth(azimuth: number | null): void {
  forcedAzimuth = azimuth;
}

/**
 * Read the currently forced camera azimuth, or null if no override is
 * active. CameraSystemR3F calls this once per frame inside useFrame.
 */
export function getForcedAzimuth(): number | null {
  return forcedAzimuth;
}
