/**
 * R3F camera system — custom orbit camera around the player boat.
 *
 * Tracks mouse movement to rotate azimuth/elevation in spherical coordinates.
 * Each frame: positions camera around player, computes active firing quadrant.
 *
 * Includes a position guard to prevent the camera from following the player
 * body to extreme positions during initial physics stabilization.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Quaternion, Vector3 } from 'three';
import { getPlayerBody } from './physicsRefs';
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
  const azimuthRef = useRef(0);
  const elevationRef = useRef(CAMERA_INITIAL_ELEVATION);
  const isPointerDownRef = useRef(false);

  const onPointerDown = useCallback(() => {
    isPointerDownRef.current = true;
  }, []);

  const onPointerUp = useCallback(() => {
    isPointerDownRef.current = false;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isPointerDownRef.current) return;
    azimuthRef.current += e.movementX * CAMERA_SENSITIVITY_X;
    elevationRef.current = Math.max(
      CAMERA_MIN_ELEVATION,
      Math.min(CAMERA_MAX_ELEVATION, elevationRef.current - e.movementY * CAMERA_SENSITIVITY_Y),
    );
  }, []);

  useEffect(() => {
    const domElement = gl.domElement;
    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('pointerleave', onPointerUp);
    domElement.addEventListener('pointermove', onPointerMove);
    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointerleave', onPointerUp);
      domElement.removeEventListener('pointermove', onPointerMove);
    };
  }, [gl.domElement, onPointerDown, onPointerUp, onPointerMove]);

  useFrame(({ camera }) => {
    const body = getPlayerBody();
    if (!body) return;

    const pos = body.translation();
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

    // Get boat heading from rigid body quaternion
    const rot = body.rotation();
    _quat.set(rot.x, rot.y, rot.z, rot.w);
    _euler.setFromQuaternion(_quat, 'YXZ');
    const boatHeading = _euler.y;

    // Compute and update active quadrant
    const quadrant = computeQuadrant(cameraAngle, boatHeading);
    const store = useGameStore.getState();
    if (store.activeQuadrant !== quadrant) {
      store.setActiveQuadrant(quadrant);
    }
  });

  return null;
}
