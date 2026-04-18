import { exec } from 'node:child_process';

/**
 * Playwright global teardown — Windows cursor-clip backstop.
 *
 * Forcibly release any residual `ClipCursor` state that may have leaked out
 * of Chromium. Background: when a Chromium page is torn down while
 * `requestPointerLock()` is held, Windows leaves the OS cursor clipped to
 * whatever rectangle the browser had reserved — confining the user's real
 * mouse to a quarter of the screen until reboot or manual release. The
 * in-app fix (visibility / blur / pagehide -> `exitPointerLock()` in
 * `CameraSystemR3F`) handles the normal case; this teardown is cheap
 * insurance for crashes, SIGKILLs, and any future regressions.
 *
 * The PowerShell one-liner clips the cursor to `Rectangle.Empty`, which the
 * Win32 API interprets as "release the clip". Errors are swallowed — a
 * teardown failure must never mask the real test result.
 */
export default function globalTeardown(): void {
  if (process.platform !== 'win32') return;
  exec(
    'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Clip = [System.Drawing.Rectangle]::Empty"',
  );
}
