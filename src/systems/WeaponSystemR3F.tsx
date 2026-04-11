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
import {
  tickCooldowns,
  canFire,
  computeFireData,
  applyShotHeat,
  decayHeat,
  heatBracketCooldownMultiplier,
  isFireAllowedByHeat,
  type HeatState,
} from './WeaponSystem';
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

    // Tick cooldowns.
    const updatedCooldowns = tickCooldowns(
      {
        cooldown: player.weapons.cooldown,
        cooldownRemaining: { ...player.weapons.cooldownRemaining },
      },
      delta,
    ).cooldownRemaining;

    // Snapshot current heat and immediately apply one frame of passive
    // decay. Decay is ALWAYS on — whether or not the player fires this
    // frame — so the tuning math is a simple per-second net rate:
    //
    //   (shots/s × HEAT_PER_SHOT) − HEAT_DECAY_PER_SECOND
    //
    // Calibrated so full broadside (26.67 shots/s) nets +0.05 heat/s.
    let heatState: HeatState = decayHeat(
      { heat: player.weapons.heat, lockedOut: player.weapons.heatLockout },
      delta,
    );

    // Drain any test-bridge fire requests (dev-only, used by Playwright).
    // Each test request is equivalent to one mouse click.
    if (consumeTestFireRequest() && pendingFiresRef.current < PENDING_FIRE_CAP) {
      pendingFiresRef.current += 1;
    }

    // Helper: commit cooldowns + heat to the store, re-reading `player` so
    // concurrent updates (damage, movement) are not clobbered by this frame.
    const commit = (cooldownRemaining: Record<typeof store.activeQuadrant, number>): void => {
      const currentPlayer = useGameStore.getState().player;
      if (!currentPlayer) return;
      useGameStore.setState({
        player: {
          ...currentPlayer,
          weapons: {
            ...currentPlayer.weapons,
            cooldownRemaining,
            heat: heatState.heat,
            heatLockout: heatState.lockedOut,
          },
        },
      });
    };

    // If nothing is pending, push the decayed heat + cooldowns so the UI
    // and other systems see them progressing.
    if (pendingFiresRef.current === 0) {
      commit(updatedCooldowns);
      return;
    }

    // A fire intent is pending. Two independent gates must pass:
    //   1) The active quadrant's cooldown must have elapsed.
    //   2) The shared heat must not be in sticky lockout.
    // If either fails we keep the intent queued. Heat already decayed
    // above so the player isn't punished for clicking during lockout.
    const quadrant = store.activeQuadrant;
    const quadrantReady = canFire(
      { cooldown: player.weapons.cooldown, cooldownRemaining: updatedCooldowns },
      quadrant,
    );
    const heatAllows = isFireAllowedByHeat(heatState);

    if (!quadrantReady || !heatAllows) {
      commit(updatedCooldowns);
      return;
    }

    // Consume one pending intent and fire.
    pendingFiresRef.current -= 1;

    // Read from cached body state (safe during useFrame).
    const bodyState = getPlayerBodyState();
    if (!bodyState) {
      // No body yet — drop this intent. Heat already decayed.
      commit(updatedCooldowns);
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

    // Read the bracket multiplier from the PRE-SHOT heat so this shot's
    // cooldown reflects the bracket the player clicked in, not the one the
    // click pushed them into. Locking this in before the per-projectile
    // heat increments also avoids a rare cross-bracket jump mid-click.
    const bracketMultiplier = heatBracketCooldownMultiplier(heatState.heat);

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

        // Heat bookkeeping: each spawned projectile adds HEAT_PER_SHOT to
        // the shared heat pool. A full broadside (4 mounts) contributes
        // 4× the increment per click, so the time-to-100% calibration
        // (20 s of sustained broadside → 1.0) is preserved.
        heatState = applyShotHeat(heatState);
      }
    }

    // Reset cooldown for the fired quadrant (scaled by the heat bracket
    // multiplier) and push the ticked cooldowns for the others.
    commit({
      ...updatedCooldowns,
      [quadrant]: player.weapons.cooldown * bracketMultiplier,
    });
  });

  return null;
}
