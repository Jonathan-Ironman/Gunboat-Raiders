/**
 * R3F weapon system — handles firing logic each frame.
 *
 * Ticks cooldowns, listens for mouse click to fire,
 * spawns projectiles through the pool manager.
 *
 * Firing requires pointer lock to be active (left click while locked fires
 * cannons). The first canvas click acquires pointer lock (handled by
 * CameraSystemR3F); subsequent clicks trigger fire.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import { getPlayerBodyState } from './physicsRefs';
import { getProjectilePoolManager } from './projectilePoolRefs';
import { tickCooldowns, canFire, computeFireData } from './WeaponSystem';
import { consumeTestFireRequest } from './weaponTestBridge';
import { emitVfxEvent } from '@/effects/vfxEvents';

export function WeaponSystemR3F() {
  const fireRequestedRef = useRef(false);

  // Listen for mousedown on document to capture clicks while pointer-locked.
  // Pointer lock must be active (acquired by CameraSystemR3F on first canvas
  // click) — the first click requests lock and does not fire.
  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0 && document.pointerLockElement !== null) {
      fireRequestedRef.current = true;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onMouseDown]);

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

    // Drain any test-bridge fire request (dev-only, used by Playwright).
    if (consumeTestFireRequest()) {
      fireRequestedRef.current = true;
    }

    // Handle fire request
    if (fireRequestedRef.current) {
      fireRequestedRef.current = false;

      const quadrant = store.activeQuadrant;

      if (canFire(updatedWeaponState, quadrant)) {
        // Read from cached body state (safe during useFrame)
        const bodyState = getPlayerBodyState();
        if (!bodyState) return;

        const pos = bodyState.position;
        const rot = bodyState.rotation;

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
