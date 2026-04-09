/**
 * R3F weapon system — handles firing logic each frame.
 *
 * Ticks cooldowns, listens for mouse click to fire,
 * spawns projectiles through the pool manager.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Quaternion } from 'three';
import { useGameStore } from '@/store/gameStore';
import { getPlayerBody } from './physicsRefs';
import { getProjectilePoolManager } from './projectilePoolRefs';
import { tickCooldowns, canFire, computeFireData } from './WeaponSystem';
import { emitVfxEvent } from '@/effects/vfxEvents';

// Reusable Three.js objects
const _quat = new Quaternion();
const _euler = new Euler();

export function WeaponSystemR3F() {
  const { gl } = useThree();
  const fireRequestedRef = useRef(false);

  // Listen for click on the canvas to request fire
  const onPointerDown = useCallback((e: PointerEvent) => {
    // Only fire on left mouse button (button 0)
    if (e.button === 0) {
      fireRequestedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const domElement = gl.domElement;
    domElement.addEventListener('pointerdown', onPointerDown);
    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown);
    };
  }, [gl.domElement, onPointerDown]);

  useFrame((_state, delta) => {
    const store = useGameStore.getState();
    const { player } = store;
    if (!player) return;

    // Tick cooldowns
    const updatedWeaponState = tickCooldowns(
      {
        cooldown: player.weapons.cooldown,
        cooldownRemaining: { ...player.weapons.cooldownRemaining },
      },
      delta,
    );

    // Update cooldowns in store
    useGameStore.setState({
      player: {
        ...player,
        weapons: {
          ...player.weapons,
          cooldownRemaining: updatedWeaponState.cooldownRemaining,
        },
      },
    });

    // Handle fire request
    if (fireRequestedRef.current) {
      fireRequestedRef.current = false;

      const quadrant = store.activeQuadrant;

      if (canFire(updatedWeaponState, quadrant)) {
        const body = getPlayerBody();
        if (!body) return;

        const pos = body.translation();
        const rot = body.rotation();

        // Get boat heading for elevation application
        _quat.set(rot.x, rot.y, rot.z, rot.w);
        _euler.setFromQuaternion(_quat, 'YXZ');

        const spawns = computeFireData(
          player.weapons.mounts,
          quadrant,
          [pos.x, pos.y, pos.z],
          [rot.x, rot.y, rot.z, rot.w],
          player.weapons.muzzleVelocity,
          player.weapons.elevationAngle,
        );

        const poolManager = getProjectilePoolManager();
        if (poolManager) {
          for (const spawn of spawns) {
            poolManager.activate(
              spawn.position,
              spawn.impulse,
              player.id,
              'player',
              player.weapons.damage,
              player.weapons.splashDamage,
              player.weapons.splashRadius,
            );

            // Trigger muzzle flash VFX at each mount position
            emitVfxEvent({
              type: 'muzzle-flash',
              position: spawn.position,
              time: performance.now() / 1000,
            });
          }
        }

        // Reset cooldown for this quadrant
        const currentPlayer = useGameStore.getState().player;
        if (currentPlayer) {
          useGameStore.setState({
            player: {
              ...currentPlayer,
              weapons: {
                ...currentPlayer.weapons,
                cooldownRemaining: {
                  ...currentPlayer.weapons.cooldownRemaining,
                  [quadrant]: player.weapons.cooldown,
                },
              },
            },
          });
        }
      }
    }
  });

  return null;
}
