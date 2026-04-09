/**
 * Trajectory preview — shows a visual arc of the projected cannonball path.
 *
 * Simulates projectile path using basic Euler integration with gravity,
 * rendered as a THREE.Line via primitive for per-frame geometry updates.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Line as ThreeLine,
  LineBasicMaterial,
  Vector3,
} from 'three';
import { useGameStore, type FiringQuadrant, type WeaponMount } from '@/store/gameStore';
import { getPlayerBodyState } from '@/systems/physicsRefs';

const TRAJECTORY_STEPS = 60;
const TRAJECTORY_DT = 0.05; // seconds per step
const GRAVITY_Y = -9.81;

// Reusable objects for per-frame computation
const _pos = new Vector3();
const _vel = new Vector3();

/**
 * Compute the mean mount position and direction for a given quadrant.
 */
function getMeanMountData(
  mounts: readonly WeaponMount[],
  quadrant: FiringQuadrant,
): { offset: [number, number, number]; direction: [number, number, number] } | null {
  const quadrantMounts = mounts.filter((m) => m.quadrant === quadrant);
  if (quadrantMounts.length === 0) return null;

  const count = quadrantMounts.length;
  let ox = 0,
    oy = 0,
    oz = 0;
  let dx = 0,
    dy = 0,
    dz = 0;

  for (const m of quadrantMounts) {
    ox += m.localOffset[0];
    oy += m.localOffset[1];
    oz += m.localOffset[2];
    dx += m.localDirection[0];
    dy += m.localDirection[1];
    dz += m.localDirection[2];
  }

  return {
    offset: [ox / count, oy / count, oz / count],
    direction: [dx / count, dy / count, dz / count],
  };
}

/**
 * Rotate a vector by a quaternion.
 */
function rotateVec(
  v: [number, number, number],
  qx: number,
  qy: number,
  qz: number,
  qw: number,
): [number, number, number] {
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);

  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

export function TrajectoryPreview() {
  // Create the line object once with pre-allocated geometry
  const lineObj = useMemo(() => {
    const positions = new Float32Array((TRAJECTORY_STEPS + 1) * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setDrawRange(0, TRAJECTORY_STEPS + 1);

    const material = new LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });

    return new ThreeLine(geometry, material);
  }, []);

  // Ref to track the primitive for cleanup isn't needed; useMemo handles it.
  const lineObjRef = useRef(lineObj);
  lineObjRef.current = lineObj;

  useFrame(() => {
    const line = lineObjRef.current;
    // Read from cached body state (safe during useFrame)
    const bodyState = getPlayerBodyState();
    if (!bodyState) return;

    const store = useGameStore.getState();
    const { player, activeQuadrant } = store;
    if (!player) return;

    const mountData = getMeanMountData(player.weapons.mounts, activeQuadrant);
    if (!mountData) return;

    const bPos = bodyState.position;
    const bRot = bodyState.rotation;

    // Transform mount offset to world space
    const worldOffset = rotateVec(mountData.offset, bRot.x, bRot.y, bRot.z, bRot.w);
    const startX = bPos.x + worldOffset[0];
    const startY = bPos.y + worldOffset[1];
    const startZ = bPos.z + worldOffset[2];

    // Transform direction to world space and apply elevation
    const worldDir = rotateVec(mountData.direction, bRot.x, bRot.y, bRot.z, bRot.w);
    const hLen = Math.sqrt(worldDir[0] * worldDir[0] + worldDir[2] * worldDir[2]);

    let dirX: number, dirY: number, dirZ: number;
    if (hLen > 0.0001) {
      const cosElev = Math.cos(player.weapons.elevationAngle);
      const sinElev = Math.sin(player.weapons.elevationAngle);
      dirX = (worldDir[0] / hLen) * cosElev;
      dirY = sinElev;
      dirZ = (worldDir[2] / hLen) * cosElev;
    } else {
      dirX = 0;
      dirY = 1;
      dirZ = 0;
    }

    // Initial velocity
    const muzzleVelocity = player.weapons.muzzleVelocity;
    _pos.set(startX, startY, startZ);
    _vel.set(dirX * muzzleVelocity, dirY * muzzleVelocity, dirZ * muzzleVelocity);

    const posAttr = line.geometry.getAttribute('position');

    let drawCount = TRAJECTORY_STEPS + 1;
    posAttr.setXYZ(0, _pos.x, _pos.y, _pos.z);

    // Euler integration to simulate trajectory
    for (let i = 1; i <= TRAJECTORY_STEPS; i++) {
      _vel.y += GRAVITY_Y * TRAJECTORY_DT;
      _pos.x += _vel.x * TRAJECTORY_DT;
      _pos.y += _vel.y * TRAJECTORY_DT;
      _pos.z += _vel.z * TRAJECTORY_DT;

      posAttr.setXYZ(i, _pos.x, _pos.y, _pos.z);

      // Stop at water level
      if (_pos.y < 0) {
        drawCount = i + 1;
        break;
      }
    }

    line.geometry.setDrawRange(0, drawCount);
    posAttr.needsUpdate = true;
  });

  return <primitive object={lineObj} />;
}
