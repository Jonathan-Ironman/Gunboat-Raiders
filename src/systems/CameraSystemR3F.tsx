/**
 * R3F camera system — custom orbit camera around the player boat.
 *
 * Tracks mouse movement to rotate azimuth/elevation in spherical coordinates.
 * Uses pointer lock so camera rotates freely without requiring a mouse button hold.
 * Each frame: positions camera around player, computes active firing quadrant.
 *
 * Includes a position guard to prevent the camera from following the player
 * body to extreme positions during initial physics stabilization.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Quaternion, Vector3 } from 'three';
import { getPlayerBodyState } from './physicsRefs';
import { computeQuadrant } from './CameraSystem';
import { useGameStore } from '@/store/gameStore';

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

// Reusable Three.js objects to avoid per-frame allocations
const _quat = new Quaternion();
const _euler = new Euler();
const _target = new Vector3();
const _cameraPos = new Vector3();
const _lookDir = new Vector3();

export function CameraSystemR3F() {
  const gl = useThree((state) => state.gl);
  // Initial azimuth = PI places the camera behind the boat (-Z side),
  // looking forward along +Z, so the default firing quadrant is 'fore'.
  const azimuthRef = useRef(Math.PI);
  const elevationRef = useRef(CAMERA_INITIAL_ELEVATION);
  const isPointerLockedRef = useRef(false);

  /**
   * Last quadrant we wrote to the store. Kept here (not read from the store)
   * so that external callers — particularly automated tests that call
   * `setActiveQuadrant` directly — can override the quadrant without the
   * camera system immediately clobbering it. We only push an update when
   * the camera-computed quadrant actually changes between frames.
   */
  const lastWrittenQuadrantRef = useRef<ReturnType<typeof computeQuadrant> | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    // Only rotate camera when pointer is locked — raw movementX/Y give true deltas
    if (!isPointerLockedRef.current) return;
    azimuthRef.current -= e.movementX * CAMERA_SENSITIVITY_X;
    elevationRef.current = Math.max(
      CAMERA_MIN_ELEVATION,
      Math.min(CAMERA_MAX_ELEVATION, elevationRef.current + e.movementY * CAMERA_SENSITIVITY_Y),
    );
  }, []);

  const onPointerLockChange = useCallback(() => {
    isPointerLockedRef.current = document.pointerLockElement === gl.domElement;
  }, [gl.domElement]);

  const onCanvasClick = useCallback(() => {
    // First click on canvas requests pointer lock for camera + fire control
    if (!isPointerLockedRef.current) {
      void gl.domElement.requestPointerLock();
    }
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
    };
  }, [gl.domElement, onCanvasClick, onPointerLockChange, onMouseMove]);

  // Priority -1: runs before WeaponSystemR3F (priority 0) so that
  // activeQuadrant is always written before the weapon system reads it.
  // PhysicsSyncSystem runs at -20, so cached body state is ready by the time
  // this runs.
  useFrame(({ camera }) => {
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

    const azimuth = azimuthRef.current;
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

    // Compute active quadrant and only push to the store when OUR computed
    // value changes — not when the store value disagrees. This allows
    // external callers (e.g. tests) to set the quadrant independently
    // without the camera system immediately overwriting it every frame.
    const quadrant = computeQuadrant(cameraAngle, boatHeading);
    if (lastWrittenQuadrantRef.current !== quadrant) {
      lastWrittenQuadrantRef.current = quadrant;
      useGameStore.getState().setActiveQuadrant(quadrant);
    }
  }, -1);

  return null;
}
