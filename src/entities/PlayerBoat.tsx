/**
 * Player boat entity — RigidBody with loaded 3D model and cannon mounts.
 *
 * Registers itself with the buoyancy/movement systems via their global registries
 * on mount. The player entity is pre-created in the store by startGame() before
 * this component renders.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody, CuboidCollider, interactionGroups } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { BOAT_STATS } from '../utils/boatStats';
import { COLLISION_GROUPS } from '../utils/collisionGroups';
import { PLAYER_HULL_SAMPLE_POINTS } from '../systems/BuoyancySystem';
import {
  registerBuoyancyBody,
  unregisterBuoyancyBody,
  setPlayerBody,
} from '../systems/physicsRefs';
import { BOAT_MASS, BUOYANCY_STRENGTH } from '../utils/constants';
import { Box3, Vector3, type Mesh, type Object3D } from 'three';

// Preload models for better loading performance
useGLTF.preload('/models/player-boat.glb');
useGLTF.preload('/models/cannon.glb');

const PLAYER_ID = 'player';

/** Y-axis rotation (radians) for each weapon mount quadrant so cannons face outward. */
const CANNON_ROTATION_BY_QUADRANT: Record<string, number> = {
  fore: 0, // faces +Z (forward)
  port: -Math.PI / 2, // faces -X (left)
  starboard: Math.PI / 2, // faces +X (right)
  aft: Math.PI, // faces -Z (backward)
};

/**
 * Player collider half-extents. Used to compute density so Rapier body mass
 * matches BOAT_MASS from constants (required for correct buoyancy forces).
 */
const PLAYER_HALF_EXTENTS: [number, number, number] = [1.2, 0.75, 2.5];
const PLAYER_COLLIDER_VOLUME =
  2 * PLAYER_HALF_EXTENTS[0] * 2 * PLAYER_HALF_EXTENTS[1] * 2 * PLAYER_HALF_EXTENTS[2];
const PLAYER_DENSITY = BOAT_MASS / PLAYER_COLLIDER_VOLUME;

/** Collision groups: player collides with enemy, enemy projectile, environment */
const PLAYER_COLLISION_GROUPS = interactionGroups(COLLISION_GROUPS.PLAYER, [
  COLLISION_GROUPS.ENEMY,
  COLLISION_GROUPS.ENEMY_PROJECTILE,
  COLLISION_GROUPS.ENVIRONMENT,
]);

// The player boat needs a bit more buoyancy authority than the generic hull
// setup so it can recover from long planing runs without visually lagging
// behind the rendered wave surface.
const PLAYER_BUOYANCY_OVERRIDES = {
  buoyancyStrength: BUOYANCY_STRENGTH * 1.25,
} as const;

export function PlayerBoat() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const modelRef = useRef<Object3D>(null);
  const boatGltf = useGLTF('/models/player-boat.glb');
  const cannonGltf = useGLTF('/models/cannon.glb');
  const boatScene = useMemo(() => boatGltf.scene.clone(), [boatGltf.scene]);
  const localHullSamplePoints = useMemo(() => {
    const bounds = new Box3().setFromObject(boatScene);
    const xInset = (bounds.max.x - bounds.min.x) * 0.08;
    const zInset = (bounds.max.z - bounds.min.z) * 0.05;
    const minX = bounds.min.x + xInset;
    const maxX = bounds.max.x - xInset;
    const minZ = bounds.min.z + zInset;
    const maxZ = bounds.max.z - zInset;
    const keelY = bounds.min.y;
    const lowHullTopY = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.45;
    const xSteps = 5;
    const ySteps = 3;
    const zSteps = 9;
    const xDenominator = xSteps - 1;
    const yDenominator = ySteps - 1;
    const zDenominator = zSteps - 1;
    const points: Vector3[] = [];
    const sampleYs = Array.from({ length: ySteps }, (_unused, index) => {
      const yT = index / yDenominator;
      return keelY + (lowHullTopY - keelY) * yT;
    });

    // Bottom surface
    for (let xi = 0; xi < xSteps; xi += 1) {
      const xT = xi / xDenominator;
      const sampleX = minX + (maxX - minX) * xT;

      for (let zi = 0; zi < zSteps; zi += 1) {
        const zT = zi / zDenominator;
        const sampleZ = minZ + (maxZ - minZ) * zT;
        points.push(new Vector3(sampleX, keelY, sampleZ));
      }
    }

    // Port / starboard low hull sides
    for (const sampleY of sampleYs) {
      for (let zi = 0; zi < zSteps; zi += 1) {
        const zT = zi / zDenominator;
        const sampleZ = minZ + (maxZ - minZ) * zT;
        points.push(new Vector3(minX, sampleY, sampleZ));
        points.push(new Vector3(maxX, sampleY, sampleZ));
      }
    }

    // Bow / stern low hull faces
    for (const sampleY of sampleYs) {
      for (let xi = 0; xi < xSteps; xi += 1) {
        const xT = xi / xDenominator;
        const sampleX = minX + (maxX - minX) * xT;
        points.push(new Vector3(sampleX, sampleY, minZ));
        points.push(new Vector3(sampleX, sampleY, maxZ));
      }
    }

    return points;
  }, [boatScene]);

  // Register with physics systems on mount; clean up on unmount.
  // The player entity is created in the store by startGame() before GameEntities
  // renders, so we do not call spawnPlayer() here.
  useEffect(() => {
    return () => {
      unregisterBuoyancyBody(PLAYER_ID);
      setPlayerBody(null);
    };
  }, []);

  // Register rigid body once it's available (after first render with ref set)
  const onRigidBodyReady = (body: RapierRigidBody) => {
    // RigidBody ref callback isn't available, so we use a ref + effect approach
    registerBuoyancyBody(PLAYER_ID, body, PLAYER_HULL_SAMPLE_POINTS, PLAYER_BUOYANCY_OVERRIDES);
    setPlayerBody(body);
  };

  // Use effect to register the rigid body after mount
  useEffect(() => {
    if (rigidBodyRef.current) {
      onRigidBodyReady(rigidBodyRef.current);
    }
  });

  // Debug: log model bounding box on mount
  useEffect(() => {
    if (import.meta.env.DEV) {
      const scene = boatScene;
      scene.traverse((obj) => {
        if ('isMesh' in obj && obj.isMesh === true) {
          const mesh = obj as Mesh;
          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          if (bb) {
            console.log(
              '[PlayerBoat] Mesh bbox:',
              JSON.stringify({
                name: mesh.name,
                min: [bb.min.x, bb.min.y, bb.min.z],
                max: [bb.max.x, bb.max.y, bb.max.z],
              }),
            );
          }
        }
      });

      const bounds = new Box3().setFromObject(scene);
      console.log(
        '[PlayerBoat] Scene bbox:',
        JSON.stringify({
          min: [bounds.min.x, bounds.min.y, bounds.min.z],
          max: [bounds.max.x, bounds.max.y, bounds.max.z],
        }),
      );
    }
  }, [boatScene]);

  useEffect(() => {
    if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;

    type TestWindow = Window &
      typeof globalThis & {
        __GET_PLAYER_RENDER_BOUNDS__?: () => {
          min: { x: number; y: number; z: number };
          max: { x: number; y: number; z: number };
        } | null;
        __GET_PLAYER_RENDER_HULL_POINTS__?: () => Array<{ x: number; y: number; z: number }> | null;
      };

    const w = window as TestWindow;
    const bounds = new Box3();

    w.__GET_PLAYER_RENDER_BOUNDS__ = () => {
      const model = modelRef.current;
      if (!model) return null;

      model.updateWorldMatrix(true, true);
      bounds.setFromObject(model);

      return {
        min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
        max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
      };
    };
    w.__GET_PLAYER_RENDER_HULL_POINTS__ = () => {
      const model = modelRef.current;
      if (!model) return null;

      model.updateWorldMatrix(true, true);
      return localHullSamplePoints.map((point) => {
        const worldPoint = model.localToWorld(point.clone());
        return { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z };
      });
    };

    return () => {
      delete w.__GET_PLAYER_RENDER_BOUNDS__;
      delete w.__GET_PLAYER_RENDER_HULL_POINTS__;
    };
  }, [localHullSamplePoints]);

  // Get weapon mounts from player stats for cannon placement
  const weaponMounts = BOAT_STATS.player.weapons.mounts;

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      gravityScale={0}
      // Low linear damping keeps the powerboat feeling crisp and lets buoyancy
      // handle most of the vertical motion. Gameplay top speed is enforced by
      // MovementSystemR3F via the configured movement.maxSpeed cap.
      linearDamping={0.15}
      // Low angular damping so the boat can freely pitch and roll with the
      // Gerstner wave surface. Buoyancy torque supplies its own velocity
      // damping; this value just tames the residual yaw spin from turns.
      angularDamping={0.8}
      position={[0, 1.0, 0]}
      colliders={false}
    >
      <CuboidCollider
        args={PLAYER_HALF_EXTENTS}
        collisionGroups={PLAYER_COLLISION_GROUPS}
        density={PLAYER_DENSITY}
      />

      {/* Player boat model */}
      <primitive ref={modelRef} object={boatScene} scale={[1, 1, 1]} rotation={[0, 0, 0]} />

      {/* Cannon models at each weapon mount position, rotated to face outward */}
      {weaponMounts.map((mount, index) => (
        <primitive
          key={index}
          object={cannonGltf.scene.clone()}
          position={mount.localOffset}
          rotation={[0, CANNON_ROTATION_BY_QUADRANT[mount.quadrant] ?? 0, 0]}
          scale={[0.5, 0.5, 0.5]}
        />
      ))}
    </RigidBody>
  );
}
