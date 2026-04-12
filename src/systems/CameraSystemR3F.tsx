/**
 * R3F camera system — custom orbit camera around the player boat.
 *
 * Tracks mouse movement to rotate azimuth/elevation in spherical coordinates.
 * Uses pointer lock so camera rotates freely without requiring a mouse button hold.
 * Each frame: positions camera around player, computes active firing quadrant.
 *
 * When pointer lock is active, azimuth updates from movementX deltas (accurate).
 * When pointer lock is NOT active (e.g. after Escape or alt-tab), the azimuth
 * is frozen but the active firing quadrant falls back to a cursor-position-based
 * computation: the angle from canvas center to the mouse cursor determines which
 * quadrant the player is aiming at. This prevents the frozen-quadrant bug where
 * clicking after lock loss always fires into a stale, potentially-cooldown-blocked
 * quadrant.
 *
 * Includes a position guard to prevent the camera from following the player
 * body to extreme positions during initial physics stabilization.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Quaternion, Vector3 } from 'three';
import { getPlayerBodyState } from './physicsRefs';
import { computeQuadrant } from './CameraSystem';
import { useGameStore, type FiringQuadrant } from '@/store/gameStore';
import { setAimOffset, MAX_PITCH_OFFSET_UP, MAX_PITCH_OFFSET_DOWN } from './aimOffsetRefs';
import { setIsPointerLocked, resetPointerLockRefs } from './pointerLockRefs';
import { getForcedAzimuth } from './cameraTestBridge';

/** Camera orbit configuration */
const CAMERA_RADIUS = 15;
const CAMERA_MIN_ELEVATION = (15 * Math.PI) / 180;
const CAMERA_MAX_ELEVATION = (60 * Math.PI) / 180;
const CAMERA_INITIAL_ELEVATION = (30 * Math.PI) / 180;
const CAMERA_SENSITIVITY_X = 0.003;
const CAMERA_SENSITIVITY_Y = 0.003;
const CAMERA_TARGET_OFFSET_Y = 2;

/** Maximum reasonable body coordinate; positions beyond this are ignored. */
const MAX_BODY_COORD = 500;

/** Minimum camera Y position — always stay above water surface. */
const CAMERA_MIN_Y = 3;

/**
 * Centre angles (relative to boat heading) for each firing quadrant.
 * Each quadrant is a 90° slice around these centres; the player's
 * fine-aim yaw offset is the angular distance between the camera's
 * look-angle and the centre of the current quadrant, clamped to a safe
 * sub-cone by `aimOffsetRefs.MAX_YAW_OFFSET`.
 */
const QUADRANT_CENTER: Record<FiringQuadrant, number> = {
  fore: 0,
  starboard: Math.PI / 2,
  aft: Math.PI,
  port: -Math.PI / 2,
};

/** Normalise an angle to the `(-π, π]` range. */
function normalizeAngle(a: number): number {
  let n = a;
  while (n > Math.PI) n -= 2 * Math.PI;
  while (n < -Math.PI) n += 2 * Math.PI;
  return n;
}

/**
 * Hard floor and ceiling for the TOTAL cannon elevation (base + pitch
 * offset combined). Applied after the offset is computed so the clamp is
 * always respected regardless of the player's base `elevationAngle`.
 *
 * MIN: -2° (−0.035 rad) — prevents firing straight into the water.
 * MAX: +18° (+0.314 rad) — prevents mortaring straight up.
 */
const TOTAL_ELEVATION_MIN = (-2 * Math.PI) / 180;
const TOTAL_ELEVATION_MAX = (18 * Math.PI) / 180;

/**
 * Player base elevation angle (radians). Mirrors `BOAT_STATS.player.weapons.elevationAngle`
 * so the hard-cap computation can clamp pitch offsets without importing boatStats.
 * Must be kept in sync if boatStats changes.
 */
const PLAYER_BASE_ELEVATION = 0.06;

/**
 * Map the camera orbit elevation to a pitch offset added on top of the
 * weapon's base `elevationAngle`.
 *
 * Behaviour:
 *   elevation = CAMERA_INITIAL_ELEVATION (30°) → zero offset (comfortable
 *     horizon view fires at the base elevation — no adjustment).
 *   elevation < CAMERA_INITIAL_ELEVATION (camera near sea-level, looking
 *     outward) → positive pitch offset (slight extra arc for long range).
 *   elevation > CAMERA_INITIAL_ELEVATION (steep top-down view, camera
 *     high above) → negative pitch offset (flatter shot for close targets).
 *
 * The upward and downward ranges are ASYMMETRIC:
 *   upward:   MAX_PITCH_OFFSET_UP   (+8°) — generous upward reach preserved
 *             from playtest feedback.
 *   downward: MAX_PITCH_OFFSET_DOWN (-3°) — tight downward reach so the
 *             cannon does not dip too far when the camera looks steeply down.
 *
 * The total elevation is hard-clamped by the caller to
 * [TOTAL_ELEVATION_MIN, TOTAL_ELEVATION_MAX] as a second safety net.
 *
 * The two half-ranges (min..initial and initial..max) are NOT symmetric
 * in degrees (15° wide vs 30° wide), so the mapping is piecewise linear
 * in elevation but maps each half to its respective pitch limit.
 */
function cameraElevationToPitchOffset(elevation: number): number {
  if (elevation <= CAMERA_INITIAL_ELEVATION) {
    // [min, initial] → [+MAX_PITCH_OFFSET_UP, 0].
    const span = CAMERA_INITIAL_ELEVATION - CAMERA_MIN_ELEVATION;
    if (span <= 0) return 0;
    const t = (elevation - CAMERA_MIN_ELEVATION) / span;
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    return MAX_PITCH_OFFSET_UP * (1 - clamped);
  }
  // (initial, max] → (0, -MAX_PITCH_OFFSET_DOWN].
  const span = CAMERA_MAX_ELEVATION - CAMERA_INITIAL_ELEVATION;
  if (span <= 0) return 0;
  const t = (elevation - CAMERA_INITIAL_ELEVATION) / span;
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return -MAX_PITCH_OFFSET_DOWN * clamped;
}

// Reusable Three.js objects to avoid per-frame allocations
const _quat = new Quaternion();
const _euler = new Euler();
const _target = new Vector3();
const _cameraPos = new Vector3();
const _lookDir = new Vector3();
const SHOULD_EXPOSE_AIM_DEBUG = import.meta.env.DEV || import.meta.env.VITE_E2E === '1';
type AimDebugState = {
  boatWorldPosition: { x: number; y: number; z: number };
  boatHeading: number;
  pointerLocked: boolean;
  cameraAzimuth: number;
  cameraElevation: number;
  cameraAngle: number;
  aimRelative: number;
  activeQuadrant: FiringQuadrant;
};
const _aimDebug: AimDebugState = {
  boatWorldPosition: { x: 0, y: 0, z: 0 },
  boatHeading: 0,
  pointerLocked: false,
  cameraAzimuth: 0,
  cameraElevation: 0,
  cameraAngle: 0,
  aimRelative: 0,
  activeQuadrant: 'fore',
};

function publishAimDebug(
  position: { x: number; y: number; z: number },
  boatHeading: number,
  pointerLocked: boolean,
  cameraAzimuth: number,
  cameraElevation: number,
  cameraAngle: number,
  aimRelative: number,
  activeQuadrant: FiringQuadrant,
): void {
  if (!SHOULD_EXPOSE_AIM_DEBUG) return;
  const w = window as Window &
    typeof globalThis & {
      __AIM_DEBUG__?: AimDebugState;
    };
  _aimDebug.boatWorldPosition.x = position.x;
  _aimDebug.boatWorldPosition.y = position.y;
  _aimDebug.boatWorldPosition.z = position.z;
  _aimDebug.boatHeading = boatHeading;
  _aimDebug.pointerLocked = pointerLocked;
  _aimDebug.cameraAzimuth = cameraAzimuth;
  _aimDebug.cameraElevation = cameraElevation;
  _aimDebug.cameraAngle = cameraAngle;
  _aimDebug.aimRelative = aimRelative;
  _aimDebug.activeQuadrant = activeQuadrant;
  w.__AIM_DEBUG__ = _aimDebug;
}

export function CameraSystemR3F() {
  const gl = useThree((state) => state.gl);
  // Initial azimuth = PI places the camera behind the boat (-Z side),
  // looking forward along +Z, so the default firing quadrant is 'fore'.
  const azimuthRef = useRef(Math.PI);
  const elevationRef = useRef(CAMERA_INITIAL_ELEVATION);
  const isPointerLockedRef = useRef(false);

  /**
   * Raw mouse cursor position in page coordinates.
   * Updated on every mousemove event — works regardless of pointer-lock state.
   * Used to compute the active quadrant when pointer lock is not held.
   */
  const mousePosRef = useRef({ x: 0, y: 0 });

  /**
   * Last quadrant we wrote to the store. Kept here (not read from the store)
   * so that external callers — particularly automated tests that call
   * `setActiveQuadrant` directly — can override the quadrant without the
   * camera system immediately clobbering it. We only push an update when
   * the camera-computed quadrant actually changes between frames.
   */
  const lastWrittenQuadrantRef = useRef<ReturnType<typeof computeQuadrant> | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    // Always track raw cursor position — used for quadrant computation when lock is absent.
    mousePosRef.current = { x: e.clientX, y: e.clientY };

    // Only update azimuth from deltas when pointer is locked.
    // movementX/Y are unreliable (usually 0) without pointer lock.
    if (!isPointerLockedRef.current) return;
    azimuthRef.current -= e.movementX * CAMERA_SENSITIVITY_X;
    elevationRef.current = Math.max(
      CAMERA_MIN_ELEVATION,
      Math.min(CAMERA_MAX_ELEVATION, elevationRef.current + e.movementY * CAMERA_SENSITIVITY_Y),
    );
  }, []);

  const onPointerLockChange = useCallback(() => {
    const wasLocked = isPointerLockedRef.current;
    const nowLocked = document.pointerLockElement === gl.domElement;
    isPointerLockedRef.current = nowLocked;
    // Mirror to the shared module-scope flag so WeaponSystemR3F and
    // TrajectoryPreview can read it without duplicating event listeners.
    setIsPointerLocked(nowLocked);

    // R4 — Pause-on-pointer-lock-loss.
    //
    // The browser releases pointer lock on Escape (and on alt-tab, context
    // menu, dev-tools focus, etc.). We listen for the lock-loss transition
    // and pause the game whenever it happens mid-play. No explicit Escape
    // key handler is needed — that would actually double-fire because the
    // browser already translates Escape into a lock-loss event.
    //
    // `pauseGame()` itself is a no-op outside `'playing' | 'wave-clear'`,
    // so we don't need to re-check the phase here, but we do to keep the
    // intent explicit and to avoid a pointless `getState()` call during
    // main-menu / briefing / paused transitions that also fire this event.
    if (wasLocked && !nowLocked) {
      const { phase, pauseGame } = useGameStore.getState();
      if (phase === 'playing') {
        pauseGame();
      }
    }
  }, [gl.domElement]);

  const onCanvasClick = useCallback(() => {
    // R8: never steal pointer lock away from the main menu or briefing
    // modals. The lock request MUST only be issued while the player is
    // actively in control of the boat — otherwise clicking the Start
    // button on the title screen would silently grab the mouse and
    // blackhole every subsequent menu interaction. `wave-clear` is
    // included because the wave-transition overlay leaves gameplay
    // input fully active (see R4 pause flow).
    if (isPointerLockedRef.current) return;
    const phase = useGameStore.getState().phase;
    if (phase !== 'playing' && phase !== 'wave-clear') return;
    void gl.domElement.requestPointerLock();
  }, [gl.domElement]);

  useEffect(() => {
    const domElement = gl.domElement;
    domElement.addEventListener('click', onCanvasClick);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      domElement.removeEventListener('click', onCanvasClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      // Release pointer lock on unmount
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
      // Reset module-scope pointer-lock flag so the next mount starts
      // with a clean unlocked state (matches the JSDoc on resetPointerLockRefs).
      // Note: resetAimOffset() is NOT called here — that is a separate
      // gap flagged for follow-up; fixing it is out of scope for this commit.
      resetPointerLockRefs();
    };
  }, [gl.domElement, onCanvasClick, onPointerLockChange, onMouseMove]);

  // Priority -1: runs before WeaponSystemR3F (priority 0) so that
  // activeQuadrant is always written before the weapon system reads it.
  // PhysicsSyncSystem runs at -20, so cached body state is ready by the time
  // this runs.
  useFrame(({ camera }) => {
    // R4: halt per-frame camera/quadrant updates while paused. The
    // `pointerlockchange` event listener (attached above via useEffect) is
    // not affected by this early-return — document events fire regardless,
    // so Escape still releases lock and our handler still catches it.
    if (useGameStore.getState().phase === 'paused') return;

    // Read from cached body state (populated by PhysicsSyncSystem after each
    // physics step) to avoid Rapier WASM "recursive use of an object" errors.
    const bodyState = getPlayerBodyState();
    if (!bodyState) return;

    const pos = bodyState.position;
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) return;

    // Guard: skip camera updates while physics body is at extreme positions
    // (occurs during initial Rapier stabilization frames)
    if (
      Math.abs(pos.x) > MAX_BODY_COORD ||
      Math.abs(pos.y) > MAX_BODY_COORD ||
      Math.abs(pos.z) > MAX_BODY_COORD
    ) {
      return;
    }

    const forcedAzimuth = getForcedAzimuth();
    if (forcedAzimuth !== null) {
      azimuthRef.current = forcedAzimuth;
    }
    const azimuth = forcedAzimuth ?? azimuthRef.current;
    const elevation = elevationRef.current;
    const cosElev = Math.cos(elevation);
    const sinElev = Math.sin(elevation);

    // Use clamped Y to prevent camera from going below water when boat sinks
    const clampedY = Math.max(0, pos.y);

    _cameraPos.set(
      pos.x + CAMERA_RADIUS * cosElev * Math.sin(azimuth),
      Math.max(CAMERA_MIN_Y, clampedY + CAMERA_RADIUS * sinElev),
      pos.z + CAMERA_RADIUS * cosElev * Math.cos(azimuth),
    );
    _target.set(pos.x, clampedY + CAMERA_TARGET_OFFSET_Y, pos.z);

    camera.position.copy(_cameraPos);
    camera.lookAt(_target);

    // Compute camera direction angle (azimuth of the look direction)
    _lookDir.subVectors(_target, _cameraPos);
    const cameraAngle = Math.atan2(_lookDir.x, _lookDir.z);

    // Get boat heading from cached rotation
    const rot = bodyState.rotation;
    _quat.set(rot.x, rot.y, rot.z, rot.w);
    _euler.setFromQuaternion(_quat, 'YXZ');
    const boatHeading = _euler.y;

    // Determine the active quadrant AND the camera-relative angle used to
    // derive the fine-aim yaw offset below.
    //
    // When pointer lock is active: use the camera orbit azimuth (accurate,
    // reflects actual camera orientation from pointer deltas).
    //
    // When pointer lock is NOT active: the azimuth is frozen (movementX/Y are
    // unreliable without lock). Fall back to computing the quadrant from the
    // raw mouse cursor position relative to canvas center. The angle from
    // canvas center to cursor is treated as a camera-relative direction, giving
    // the player intuitive cursor-based quadrant selection while lock is absent.
    let quadrant: ReturnType<typeof computeQuadrant>;
    // `aimRelative` is the camera's aiming direction in a boat-local frame
    // (−π..π, 0 = fore). Used for both quadrant selection and yaw-offset
    // computation so the two reads are guaranteed to agree.
    let aimRelative: number;
    if (isPointerLockedRef.current) {
      aimRelative = normalizeAngle(cameraAngle - boatHeading);
      quadrant = computeQuadrant(cameraAngle, boatHeading);
    } else {
      const domElement = gl.domElement;
      const rect = domElement.getBoundingClientRect();
      const dx = mousePosRef.current.x - (rect.left + rect.width / 2);
      // Invert dy so "up on screen" = positive (matches math convention: fore is up)
      const dy = -(mousePosRef.current.y - (rect.top + rect.height / 2));
      // Angle of the cursor from canvas center, in world-space terms.
      // atan2(dx, dy): dy is "forward" (up on screen = fore), dx is "right" (starboard).
      const cursorAngle = Math.atan2(dx, dy);
      aimRelative = cursorAngle;
      // The cursor angle is relative to the canvas — treat it as an absolute
      // world-space azimuth (same coordinate system as boatHeading) so that
      // computeQuadrant correctly maps it to port/starboard/fore/aft.
      quadrant = computeQuadrant(cursorAngle + boatHeading, boatHeading);
    }

    // Only push to the store when OUR computed value changes — not when the
    // store value disagrees. This allows external callers (e.g. tests) to set
    // the quadrant independently without the camera system immediately
    // overwriting it every frame.
    if (lastWrittenQuadrantRef.current !== quadrant) {
      lastWrittenQuadrantRef.current = quadrant;
      useGameStore.getState().setActiveQuadrant(quadrant);
    }

    // Variable aim within the active quadrant.
    //
    // The quadrant acts as a 90° gate — the weapon system snaps the shot to
    // whichever quadrant the camera (or cursor, in lock-absent mode) is
    // pointing into — and on top of that the player gets a ±12° yaw /
    // (+8°/-3°) asymmetric pitch cone of fine aim. The yaw delta is the signed angular distance
    // between the player's boat-local aim direction (`aimRelative`) and the
    // centre of the current quadrant; setAimOffset() clamps both axes to
    // their allowed range so the aim can never leak into the adjacent
    // quadrant's arc.
    //
    // Keeping the offset module-scope (aimOffsetRefs) instead of in the
    // Zustand store avoids a per-frame reactive write for a value that no
    // React component subscribes to — the only readers are WeaponSystemR3F
    // and TrajectoryPreview, both of which run inside useFrame.
    const yawDelta = normalizeAngle(aimRelative - QUADRANT_CENTER[quadrant]);
    const rawPitchDelta = cameraElevationToPitchOffset(elevationRef.current);
    // Hard cap on total cannon elevation (base + pitch offset). Clamp the
    // pitch delta so the effective elevation (PLAYER_BASE_ELEVATION + delta)
    // never drops below TOTAL_ELEVATION_MIN (can't fire into the water) or
    // exceeds TOTAL_ELEVATION_MAX (can't mortar straight overhead).
    const minPitch = TOTAL_ELEVATION_MIN - PLAYER_BASE_ELEVATION;
    const maxPitch = TOTAL_ELEVATION_MAX - PLAYER_BASE_ELEVATION;
    const pitchDelta =
      rawPitchDelta < minPitch ? minPitch : rawPitchDelta > maxPitch ? maxPitch : rawPitchDelta;
    setAimOffset(yawDelta, pitchDelta);

    publishAimDebug(
      pos,
      boatHeading,
      isPointerLockedRef.current,
      azimuth,
      elevation,
      cameraAngle,
      aimRelative,
      quadrant,
    );
  }, -1);

  return null;
}
