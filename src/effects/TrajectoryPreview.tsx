/**
 * Trajectory preview — shows a visual ribbon arc of the projected cannonball path.
 *
 * Simulates projectile path using basic Euler integration with gravity.
 * Rendered as a camera-facing flat ribbon (custom BufferGeometry) whose width
 * scales with the number of cannon mounts in the active quadrant, matching
 * the Assassin's Creed IV Black Flag aim-ribbon aesthetic.
 *
 * Ribbon geometry is updated in-place each frame (attribute writes only, no
 * allocation) for zero-GC per-frame cost.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { useGameStore, type FiringQuadrant, type WeaponMount } from '@/store/gameStore';
import { getPlayerBodyState } from '@/systems/physicsRefs';
import { getAimOffset } from '@/systems/aimOffsetRefs';
import { getIsPointerLocked } from '@/systems/pointerLockRefs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAJECTORY_STEPS = 60;
const TRAJECTORY_DT = 0.05; // seconds per step
const GRAVITY_Y = -9.81;

// Width per cannon mount — so 4 broadside mounts → ~4× wider than 1 fore mount.
// Base half-width per mount, in world units.
// Bumped 0.2 → 0.4 so a 4-mount broadside produces ~1.6 unit half-width
// (3.2 unit total), visually spanning the cannon spread.
const HALF_WIDTH_PER_MOUNT = 0.4;

// Minimum half-width even with a single mount (visual floor)
const MIN_HALF_WIDTH = 0.4;

// Gold accent colour matching the game's aim / UI theme (0xFFD700)
const RIBBON_COLOR = 0xffd700;
const RIBBON_OPACITY = 0.4;

// ---------------------------------------------------------------------------
// Pre-allocated scratch objects (avoid per-frame allocation)
// ---------------------------------------------------------------------------

const _pos = new Vector3();
const _vel = new Vector3();
const _tangent = new Vector3();
const _right = new Vector3();
const _up = new Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Build the index buffer for a ribbon strip with `steps + 1` cross-sections,
 * each cross-section having 2 vertices (left, right).
 *
 * Vertex layout for cross-section i:
 *   left  vertex = i * 2
 *   right vertex = i * 2 + 1
 */
function buildRibbonIndices(steps: number): Uint16Array {
  const triCount = steps * 2; // 2 triangles per quad
  const indices = new Uint16Array(triCount * 3);
  let idx = 0;
  for (let i = 0; i < steps; i++) {
    const tl = i * 2;
    const tr = i * 2 + 1;
    const bl = (i + 1) * 2;
    const br = (i + 1) * 2 + 1;
    // First triangle
    indices[idx++] = tl;
    indices[idx++] = bl;
    indices[idx++] = tr;
    // Second triangle
    indices[idx++] = tr;
    indices[idx++] = bl;
    indices[idx++] = br;
  }
  return indices;
}

// ---------------------------------------------------------------------------
// Mount data helpers (identical logic to original implementation)
// ---------------------------------------------------------------------------

function getMeanMountData(
  mounts: readonly WeaponMount[],
  quadrant: FiringQuadrant,
): {
  offset: [number, number, number];
  direction: [number, number, number];
  mountCount: number;
} | null {
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
    mountCount: count,
  };
}

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrajectoryPreview() {
  // Max vertices = (TRAJECTORY_STEPS + 1) cross-sections × 2 verts each
  const maxVerts = (TRAJECTORY_STEPS + 1) * 2;

  const meshObj = useMemo(() => {
    const positions = new Float32Array(maxVerts * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    // Build indices for the maximum possible ribbon (all steps drawn)
    const indices = buildRibbonIndices(TRAJECTORY_STEPS);
    geometry.setIndex(new Uint16BufferAttribute(indices, 1));

    // Draw nothing until the first frame populates positions
    geometry.setDrawRange(0, 0);

    const material = new MeshBasicMaterial({
      color: RIBBON_COLOR,
      transparent: true,
      opacity: RIBBON_OPACITY,
      depthWrite: false,
      side: 2, // THREE.DoubleSide — visible from both sides of the ribbon
    });

    const mesh = new Mesh(geometry, material);
    // Ensure ribbon renders above water without z-fighting
    mesh.renderOrder = 1;

    return mesh;
  }, [maxVerts]);

  const meshRef = useRef(meshObj);
  meshRef.current = meshObj;

  useFrame(() => {
    const mesh = meshRef.current;

    // Hide the ribbon during the async window before pointer lock is
    // confirmed — same gate as WeaponSystemR3F so the aim arc never
    // appears for a shot that cannot be fired.
    if (!getIsPointerLocked()) {
      mesh.geometry.setDrawRange(0, 0);
      return;
    }

    const bodyState = getPlayerBodyState();
    if (!bodyState) {
      mesh.geometry.setDrawRange(0, 0);
      return;
    }

    const store = useGameStore.getState();
    const { player, activeQuadrant } = store;
    if (!player) {
      mesh.geometry.setDrawRange(0, 0);
      return;
    }

    const mountData = getMeanMountData(player.weapons.mounts, activeQuadrant);
    if (!mountData) {
      mesh.geometry.setDrawRange(0, 0);
      return;
    }

    const bPos = bodyState.position;
    const bRot = bodyState.rotation;

    // Transform mount offset to world space
    const worldOffset = rotateVec(mountData.offset, bRot.x, bRot.y, bRot.z, bRot.w);
    const startX = bPos.x + worldOffset[0];
    const startY = bPos.y + worldOffset[1];
    const startZ = bPos.z + worldOffset[2];

    // Transform direction to world space and apply aim offsets
    // (must exactly match computeFireData to avoid arc divergence)
    const worldDir = rotateVec(mountData.direction, bRot.x, bRot.y, bRot.z, bRot.w);
    const hLen = Math.sqrt(worldDir[0] * worldDir[0] + worldDir[2] * worldDir[2]);

    const aim = getAimOffset();
    const cosYaw = Math.cos(aim.yaw);
    const sinYaw = Math.sin(aim.yaw);
    const effectiveElevation = player.weapons.elevationAngle + aim.pitch;
    const cosElev = Math.cos(effectiveElevation);
    const sinElev = Math.sin(effectiveElevation);

    let dirX: number, dirY: number, dirZ: number;
    if (hLen > 0.0001) {
      const hx = worldDir[0] / hLen;
      const hz = worldDir[2] / hLen;
      const rx = hx * cosYaw + hz * sinYaw;
      const rz = -hx * sinYaw + hz * cosYaw;
      dirX = rx * cosElev;
      dirY = sinElev;
      dirZ = rz * cosElev;
    } else {
      dirX = 0;
      dirY = 1;
      dirZ = 0;
    }

    // Half-width scales with mount count, floored at MIN_HALF_WIDTH
    const halfWidth = Math.max(MIN_HALF_WIDTH, mountData.mountCount * HALF_WIDTH_PER_MOUNT);

    // Initial velocity for Euler integration
    const muzzleVelocity = player.weapons.muzzleVelocity;
    _pos.set(startX, startY, startZ);
    _vel.set(dirX * muzzleVelocity, dirY * muzzleVelocity, dirZ * muzzleVelocity);

    const posAttr = mesh.geometry.getAttribute('position');

    // ------------------------------------------------------------------
    // Step 0: write the first cross-section
    // ------------------------------------------------------------------
    // Tangent at step 0 = normalised initial velocity
    _tangent.set(_vel.x, _vel.y, _vel.z).normalize();
    // Ribbon "right" vector: tangent cross up, projected onto horizontal plane
    _right.crossVectors(_up, _tangent).normalize();
    if (_right.lengthSq() < 0.0001) {
      _right.set(1, 0, 0);
    }

    posAttr.setXYZ(0, _pos.x - _right.x * halfWidth, _pos.y, _pos.z - _right.z * halfWidth);
    posAttr.setXYZ(1, _pos.x + _right.x * halfWidth, _pos.y, _pos.z + _right.z * halfWidth);

    let activeSteps = TRAJECTORY_STEPS;

    // ------------------------------------------------------------------
    // Steps 1..TRAJECTORY_STEPS
    // ------------------------------------------------------------------
    for (let i = 1; i <= TRAJECTORY_STEPS; i++) {
      _vel.y += GRAVITY_Y * TRAJECTORY_DT;
      _pos.x += _vel.x * TRAJECTORY_DT;
      _pos.y += _vel.y * TRAJECTORY_DT;
      _pos.z += _vel.z * TRAJECTORY_DT;

      // Tangent = normalised velocity at this step
      _tangent.set(_vel.x, _vel.y, _vel.z).normalize();
      _right.crossVectors(_up, _tangent).normalize();
      if (_right.lengthSq() < 0.0001) {
        _right.set(1, 0, 0);
      }

      posAttr.setXYZ(i * 2, _pos.x - _right.x * halfWidth, _pos.y, _pos.z - _right.z * halfWidth);
      posAttr.setXYZ(
        i * 2 + 1,
        _pos.x + _right.x * halfWidth,
        _pos.y,
        _pos.z + _right.z * halfWidth,
      );

      // Stop at water level
      if (_pos.y < 0) {
        activeSteps = i;
        break;
      }
    }

    // Each quad between cross-sections i and i+1 = 6 indices (2 triangles)
    mesh.geometry.setDrawRange(0, activeSteps * 6);
    posAttr.needsUpdate = true;
  });

  return <primitive object={meshObj} />;
}
