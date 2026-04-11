/**
 * R3F weapon system — handles firing logic each frame.
 *
 * Ticks cooldowns, listens for mouse click to fire,
 * spawns projectiles through the pool manager.
 *
 * Firing works whenever the game phase is 'playing'. The pointer-lock gate
 * has been intentionally removed: pointer lock can be lost at any time
 * (Escape, alt-tab, browser focus change) and silently dropping clicks when
 * lock is absent makes firing feel broken. The game already requires an
 * initial canvas click to enter playing state, so any left-click during
 * 'playing' phase is a valid fire intent.
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

  // Listen for left-click on document. Fire whenever the game is in the
  // 'playing' phase — no pointer-lock requirement. Pointer lock is acquired
  // by CameraSystemR3F for mouse-look, but losing it must not silently
  // disable firing.
  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0 && useGameStore.getState().phase === 'playing') {
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
