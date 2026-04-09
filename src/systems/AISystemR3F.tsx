/**
 * R3F wrapper for AISystem -- iterates over all enemies each frame,
 * builds AIContext from rigid body + store state, calls computeAIDecision,
 * and applies forces/firing decisions.
 */

import { useFrame } from '@react-three/fiber';
import { Euler, Quaternion } from 'three';
import { useGameStore } from '@/store/gameStore';
import { getEnemyBody, getPlayerBody } from './physicsRefs';
import { getProjectilePoolManager } from './projectilePoolRefs';
import { computeAIDecision } from './AISystem';
import type { AIContext } from './AISystem';
import { computeFireData, tickCooldowns, canFire } from './WeaponSystem';

// Reusable Three.js objects to avoid per-frame allocations
const _quat = new Quaternion();
const _euler = new Euler();

/**
 * System component that runs AI logic for all enemies each frame.
 * Must be placed inside <Physics>.
 */
export function AISystemR3F() {
  useFrame((_state, delta) => {
    const store = useGameStore.getState();
    const { enemies, player } = store;
    if (!player) return;

    const playerBody = getPlayerBody();
    if (!playerBody) return;

    const playerPos = playerBody.translation();
    const playerPosition: [number, number, number] = [playerPos.x, playerPos.y, playerPos.z];

    const updatedEnemies = new Map(enemies);
    let hasChanges = false;

    for (const [id, enemy] of enemies) {
      if (!enemy.ai) continue;

      const body = getEnemyBody(id);
      if (!body) continue;

      // Skip sinking enemies (animation handled by EnemyBoat component)
      if (enemy.isSinking) continue;

      // Read position and heading from rigid body
      const pos = body.translation();
      const rot = body.rotation();

      // Guard against NaN state
      if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) continue;

      _quat.set(rot.x, rot.y, rot.z, rot.w);
      _euler.setFromQuaternion(_quat, 'YXZ');
      const heading = _euler.y;

      // Compute distance to player
      const dx = playerPosition[0] - pos.x;
      const dz = playerPosition[2] - pos.z;
      const distanceToTarget = Math.sqrt(dx * dx + dz * dz);

      // Tick weapon cooldowns
      const updatedWeaponState = tickCooldowns(
        {
          cooldown: enemy.weapons.cooldown,
          cooldownRemaining: { ...enemy.weapons.cooldownRemaining },
        },
        delta,
      );

      // Determine which quadrants are ready
      // For AI, check the broadside quadrants (port/starboard)
      const portReady = canFire(updatedWeaponState, 'port');
      const starboardReady = canFire(updatedWeaponState, 'starboard');

      // Build AI context
      const ctx: AIContext = {
        selfPosition: [pos.x, pos.y, pos.z],
        selfHeading: heading,
        selfHealth: {
          armor: enemy.health.armor,
          hull: enemy.health.hull,
          hullMax: enemy.health.hullMax,
        },
        targetPosition: playerPosition,
        distanceToTarget,
        preferredRange: enemy.ai.preferredRange,
        detectionRange: enemy.ai.detectionRange,
        currentState: enemy.ai.state,
        stateTimer: enemy.ai.stateTimer,
        weaponCooldownReady: portReady || starboardReady,
      };

      // Compute AI decision
      const decision = computeAIDecision(ctx, delta);

      // Apply forces based on decision
      const thrustForce = decision.thrust * enemy.movement.thrustForce;
      const turnTorque = decision.turn * enemy.movement.turnTorque;

      // Apply thrust in the direction the boat is facing
      const forceX = Math.sin(heading) * thrustForce;
      const forceZ = Math.cos(heading) * thrustForce;
      body.addForce({ x: forceX, y: 0, z: forceZ }, true);
      body.addTorque({ x: 0, y: -turnTorque, z: 0 }, true);

      // Handle firing
      if (decision.fire && decision.fireQuadrant) {
        const quadrant = decision.fireQuadrant;
        if (canFire(updatedWeaponState, quadrant)) {
          const spawns = computeFireData(
            enemy.weapons.mounts,
            quadrant,
            [pos.x, pos.y, pos.z],
            [rot.x, rot.y, rot.z, rot.w],
            enemy.weapons.muzzleVelocity,
            enemy.weapons.elevationAngle,
          );

          const poolManager = getProjectilePoolManager();
          if (poolManager) {
            for (const spawn of spawns) {
              poolManager.activate(
                spawn.position,
                spawn.impulse,
                id,
                'enemy',
                enemy.weapons.damage,
                enemy.weapons.splashDamage,
                enemy.weapons.splashRadius,
              );
            }
          }

          // Reset cooldown for this quadrant
          updatedWeaponState.cooldownRemaining[quadrant] = enemy.weapons.cooldown;
        }
      }

      // Update enemy state in store
      const updatedEnemy = {
        ...enemy,
        ai: {
          ...enemy.ai,
          state: decision.newState,
          stateTimer: decision.newStateTimer,
        },
        weapons: {
          ...enemy.weapons,
          cooldownRemaining: updatedWeaponState.cooldownRemaining,
        },
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotation: [rot.x, rot.y, rot.z, rot.w] as [number, number, number, number],
      };

      updatedEnemies.set(id, updatedEnemy);
      hasChanges = true;
    }

    if (hasChanges) {
      useGameStore.setState({ enemies: updatedEnemies });
    }
  });

  return null;
}
