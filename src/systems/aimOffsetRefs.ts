/**
 * Module-scope aim offset refs — the player's fine-aim delta within the
 * active firing quadrant. Black Flag-style variable aim: the quadrant is
 * still selected by camera azimuth (fore / aft / port / starboard), but
 * within each 90° slice the player gets a ±12° yaw window and an
 * asymmetric pitch window (+8° up / -6° down) layered on top of the mount direction.
 *
 * The refs are written once per frame by `CameraSystemR3F` (priority -1,
 * before the weapon system) and read every time a shot is fired or the
 * trajectory preview is drawn. This keeps the offset fully reactive to
 * live camera input without paying React-store overhead — the values are
 * volatile per-frame, so Zustand subscriptions would just churn
 * unnecessarily.
 *
 * Pattern mirrors `cameraTestBridge.ts` and `projectilePoolRefs.ts`:
 * component files only export components (react-refresh rule), so any
 * non-component module-scope state lives in a sibling `*.ts` file.
 */
/**
 * Fine-aim offset relative to the active quadrant's mount direction.
 *
 * - `yaw` is rotation around the world Y axis in radians, applied to the
 *   horizontal component of the mount direction. Positive = rotate toward
 *   the quadrant's clockwise-neighbour direction (right-hand rule).
 * - `pitch` is an ADDITIVE delta on top of `player.weapons.elevationAngle`
 *   in radians. Positive = higher arc, negative = flatter fire.
 */
export interface AimOffset {
  yaw: number;
  pitch: number;
}

/**
 * Maximum yaw offset (radians). ±12° keeps the aim cone inside a 90°
 * quadrant with a 33° safety margin on each side, so the player can
 * never accidentally fire into the adjacent quadrant's arc.
 */
export const MAX_YAW_OFFSET = (12 * Math.PI) / 180;

/**
 * Maximum upward pitch offset (radians). +8° layered on top of the player's
 * base `elevationAngle` (~5.7°) gives an effective max elevation of ~13.7°.
 * Do NOT reduce — the upward reach is correct per playtest feedback.
 */
export const MAX_PITCH_OFFSET_UP = (8 * Math.PI) / 180;

/**
 * Maximum downward pitch offset (radians). -6° layered on top of the player's
 * base `elevationAngle` (~5.7°) gives an effective min elevation of about -0.3°:
 * slightly below horizontal for closer targets after the boat started riding
 * higher on the waves, while still staying far above the camera system's
 * harder anti-water safety floor.
 * Still tighter than the upward range so the cannon cannot dip sharply down.
 */
export const MAX_PITCH_OFFSET_DOWN = (6 * Math.PI) / 180;

// Module-scope singleton. Mutated in place every frame by CameraSystemR3F
// and read by WeaponSystemR3F + TrajectoryPreview. A single shared object
// is returned from `getAimOffset()` so hot-path readers don't allocate.
const _aimOffset: AimOffset = { yaw: 0, pitch: 0 };
const _forcedAimOffset: AimOffset = { yaw: 0, pitch: 0 };
let hasForcedAimOffset = false;

/**
 * Write the current aim offset. Clamps both axes to the allowed range
 * so callers can push raw camera-derived values without needing to
 * clamp them themselves.
 */
export function setAimOffset(yaw: number, pitch: number): void {
  _aimOffset.yaw = clamp(yaw, -MAX_YAW_OFFSET, MAX_YAW_OFFSET);
  _aimOffset.pitch = clamp(pitch, -MAX_PITCH_OFFSET_DOWN, MAX_PITCH_OFFSET_UP);
}

/**
 * Test-only sticky aim override. Lets Playwright hold a deterministic
 * yaw/pitch across frames without racing CameraSystemR3F's live writes.
 * Pass null to release the override and return to normal camera-driven aim.
 */
export function requestTestAimOffset(next: AimOffset | null): void {
  if (next === null) {
    hasForcedAimOffset = false;
    _forcedAimOffset.yaw = 0;
    _forcedAimOffset.pitch = 0;
    return;
  }

  hasForcedAimOffset = true;
  _forcedAimOffset.yaw = clamp(next.yaw, -MAX_YAW_OFFSET, MAX_YAW_OFFSET);
  _forcedAimOffset.pitch = clamp(next.pitch, -MAX_PITCH_OFFSET_DOWN, MAX_PITCH_OFFSET_UP);
}

/**
 * Read the current aim offset. Returns the module-scope singleton — do
 * not mutate the returned object. If you need to capture a snapshot
 * (e.g. for a queued fire intent) copy the `yaw` / `pitch` scalars.
 */
export function getAimOffset(): Readonly<AimOffset> {
  return hasForcedAimOffset ? _forcedAimOffset : _aimOffset;
}

/** Reset the offset back to zero. Used by tests / scene unmount. */
export function resetAimOffset(): void {
  _aimOffset.yaw = 0;
  _aimOffset.pitch = 0;
  requestTestAimOffset(null);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
