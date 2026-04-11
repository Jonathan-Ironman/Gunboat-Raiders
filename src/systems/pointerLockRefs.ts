/**
 * Module-scope pointer-lock state — a lightweight shared flag that tracks
 * whether the browser currently holds pointer lock on the game canvas.
 *
 * `CameraSystemR3F` owns the `pointerlockchange` event listener and calls
 * `setIsPointerLocked` whenever lock is acquired or lost. Any system that
 * must behave differently while unlocked (WeaponSystemR3F, TrajectoryPreview)
 * calls `getIsPointerLocked()` — a cheap module-scope boolean read — instead
 * of subscribing to the Zustand store or duplicating event listeners.
 *
 * Pattern mirrors `aimOffsetRefs.ts` and `projectilePoolRefs.ts`:
 * component files only export components (react-refresh rule), so any
 * non-component module-scope state lives in a sibling `*.ts` file.
 *
 * ## Why this gate matters
 *
 * `phase === 'playing'` is set synchronously by `resumeGame()` /
 * `startLevel()`, but the browser fires `pointerlockchange` asynchronously
 * (at least one event-loop turn later). During that gap any `mousedown`
 * would be processed as a fire command — including the very click that
 * triggered `resumeGame` / lock acquisition. Gating on this flag closes
 * that race: fire and aim-ribbon are suppressed until lock is confirmed.
 */

/** Module-scope singleton. Written by CameraSystemR3F, read by consumers. */
let isPointerLocked = false;

/**
 * Record the current pointer-lock state. Called by `CameraSystemR3F`
 * inside its `pointerlockchange` listener, immediately after updating its
 * local `isPointerLockedRef`.
 */
export function setIsPointerLocked(value: boolean): void {
  isPointerLocked = value;
}

/**
 * Returns `true` while the browser holds pointer lock on the game canvas.
 * Returns `false` during the async gap between a lock request and the
 * confirming `pointerlockchange` event, and after lock is released.
 */
export function getIsPointerLocked(): boolean {
  return isPointerLocked;
}

/**
 * Reset to the unlocked state. Called alongside `resetAimOffset()` when
 * the scene is torn down (tests, hot-reload). Ensures a clean slate so
 * the next mount starts with the correct default.
 */
export function resetPointerLockRefs(): void {
  isPointerLocked = false;
}
