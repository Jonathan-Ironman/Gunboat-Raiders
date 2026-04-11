/**
 * R3F weapon system — handles firing logic each frame.
 *
 * Ticks cooldowns, listens for mouse click to fire, spawns projectiles
 * through the pool manager.
 *
 * Firing works whenever the game phase is 'playing'. The pointer-lock gate
 * has been intentionally removed: pointer lock can be lost at any time
 * (Escape, alt-tab, browser focus change) and silently dropping clicks
 * when lock is absent makes firing feel broken.
 *
 * ## Pending-fire queue (fixes the "some quadrants won't fire" bug)
 *
 * Each mouse click buffers one pending fire intent. Every render frame we
 * pop as many pending intents as the current quadrant's cooldown allows
 * (at most one per frame because firing resets the quadrant's cooldown).
 * This means a click that arrives during the 150 ms post-fire cooldown is
 * queued until the quadrant becomes ready instead of being silently
 * dropped — the previous "consume the flag, test canFire, shrug" pattern
 * was the root cause the user observed as "depending on boat orientation,
 * some quadrants I can fire and others I can't": clicks aimed at a
 * still-cooling quadrant were eaten while clicks aimed at a ready
 * quadrant passed through.
 *
 * Pending intents are capped at PENDING_FIRE_CAP to prevent runaway
 * buffering if the user holds the button during a very long cooldown.
 * The cap is small (4) because the per-quadrant cooldown is short
 * (150 ms) and anything beyond a small burst would feel laggy.
 *
 * Each pending intent re-reads `store.activeQuadrant` at drain time, so
 * "click while aiming at A, rotate to B before cooldown elapses" fires
 * the queued shot from B — matching player intent ("fire at wherever
 * I am aiming now").
 */

import { useEffect, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import { getPlayerBodyState } from './physicsRefs';
import { getProjectilePoolManager } from './projectilePoolRefs';
import { tickCooldowns, canFire, computeFireData } from './WeaponSystem';
import { consumeTestFireRequest } from './weaponTestBridge';
import { emitVfxEvent } from '@/effects/vfxEvents';

/**
 * Maximum number of pending fire intents that can be buffered. A small cap
 * prevents runaway buffering during long cooldowns while still letting a
 * short burst of rapid clicks (3–4) all fire reliably.
 */
const PENDING_FIRE_CAP = 4;

export function WeaponSystemR3F() {
  // Counter of pending fire requests waiting for a ready quadrant. Each
  // mouse click or test-bridge request increments this (up to the cap);
  // each successful fire decrements it by one.
  const pendingFiresRef = useRef(0);

  // Listen for left-click on document. Queue a fire whenever the game is
  // in the 'playing' phase — no pointer-lock requirement. Pointer lock is
  // acquired by CameraSystemR3F for mouse-look, but losing it must not
  // silently disable firing.
  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0 && useGameStore.getState().phase === 'playing') {
      if (pendingFiresRef.current < PENDING_FIRE_CAP) {
        pendingFiresRef.current += 1;
      }
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
    const updatedCooldowns = tickCooldowns(
      {
        cooldown: player.weapons.cooldown,
        cooldownRemaining: { ...player.weapons.cooldownRemaining },
      },
      delta,
    ).cooldownRemaining;

    // Drain any test-bridge fire requests (dev-only, used by Playwright).
    // Each test request is equivalent to one mouse click.
    if (consumeTestFireRequest() && pendingFiresRef.current < PENDING_FIRE_CAP) {
      pendingFiresRef.current += 1;
    }

    // If nothing is pending we still need to push the ticked cooldowns
    // back to the store so the UI / other systems see them decreasing.
    if (pendingFiresRef.current === 0) {
      useGameStore.setState({
        player: {
          ...player,
          weapons: { ...player.weapons, cooldownRemaining: updatedCooldowns },
        },
      });
      return;
    }

    // Try to drain one pending intent. At most one fire per frame per
    // quadrant because firing resets that quadrant's cooldown.
    const quadrant = store.activeQuadrant;
    if (
      !canFire({ cooldown: player.weapons.cooldown, cooldownRemaining: updatedCooldowns }, quadrant)
    ) {
      // Cannot fire this frame — keep the pending intent queued and push
      // the ticked cooldowns so they continue counting down.
      useGameStore.setState({
        player: {
          ...player,
          weapons: { ...player.weapons, cooldownRemaining: updatedCooldowns },
        },
      });
      return;
    }

    // Consume one pending intent and fire.
    pendingFiresRef.current -= 1;

    // Read from cached body state (safe during useFrame)
    const bodyState = getPlayerBodyState();
    if (!bodyState) {
      // No body yet — push cooldowns and drop this intent (cannot fire).
      useGameStore.setState({
        player: {
          ...player,
          weapons: { ...player.weapons, cooldownRemaining: updatedCooldowns },
        },
      });
      return;
    }

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

        emitVfxEvent({
          type: 'muzzle-flash',
          position: spawn.position,
          time: performance.now() / 1000,
        });
      }
    }

    // Reset cooldown for the fired quadrant and push ticked cooldowns
    // for the others. Re-read player from store to avoid a stale closure.
    const currentPlayer = useGameStore.getState().player;
    if (currentPlayer) {
      useGameStore.setState({
        player: {
          ...currentPlayer,
          weapons: {
            ...currentPlayer.weapons,
            cooldownRemaining: {
              ...updatedCooldowns,
              [quadrant]: currentPlayer.weapons.cooldown,
            },
          },
        },
      });
    }
  });

  return null;
}
