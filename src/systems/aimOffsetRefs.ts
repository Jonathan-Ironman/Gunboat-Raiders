/**
 * Module-scope aim offset refs — the player's fine-aim delta within the
 * active firing quadrant. Black Flag-style variable aim: the quadrant is
 * still selected by camera azimuth (fore / aft / port / starboard), but
 * within each 90° slice the player gets a ±18° yaw window and a ±8°
 * pitch window layered on top of the mount direction.
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
 * Maximum yaw offset (radians). ±18° keeps the aim cone inside a 90°
 * quadrant with a 27° safety margin on each side, so the player can
 * never accidentally fire into the adjacent quadrant's arc.
 */
export const MAX_YAW_OFFSET = (18 * Math.PI) / 180;

/**
 * Maximum pitch offset (radians). ±8° layered on top of the player's
 * base `elevationAngle` (~3.4°) gives an effective elevation range of
 * roughly -4.6° to +11.4° before the hard floor clamp. Tight enough
 * to prevent the cannons from arcing to the sky or firing into the water.
 */
export const MAX_PITCH_OFFSET = (8 * Math.PI) / 180;

// Module-scope singleton. Mutated in place every frame by CameraSystemR3F
// and read by WeaponSystemR3F + TrajectoryPreview. A single shared object
// is returned from `getAimOffset()` so hot-path readers don't allocate.
const _aimOffset: AimOffset = { yaw: 0, pitch: 0 };

/**
 * Write the current aim offset. Clamps both axes to the allowed range
 * so callers can push raw camera-derived values without needing to
 * clamp them themselves.
 */
export function setAimOffset(yaw: number, pitch: number): void {
  _aimOffset.yaw = clamp(yaw, -MAX_YAW_OFFSET, MAX_YAW_OFFSET);
  _aimOffset.pitch = clamp(pitch, -MAX_PITCH_OFFSET, MAX_PITCH_OFFSET);
}

/**
 * Read the current aim offset. Returns the module-scope singleton — do
 * not mutate the returned object. If you need to capture a snapshot
 * (e.g. for a queued fire intent) copy the `yaw` / `pitch` scalars.
 */
export function getAimOffset(): Readonly<AimOffset> {
  return _aimOffset;
}

/** Reset the offset back to zero. Used by tests / scene unmount. */
export function resetAimOffset(): void {
  _aimOffset.yaw = 0;
  _aimOffset.pitch = 0;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
