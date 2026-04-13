/**
 * R3F weapon system — handles firing logic each frame.
 *
 * Ticks cooldowns, listens for mouse click to fire, spawns projectiles
 * through the pool manager.
 *
 * Firing requires BOTH `phase === 'playing'` AND `getIsPointerLocked() === true`.
 * The pointer-lock gate prevents stray shots during the async window between
 * `resumeGame()` / `startLevel()` (which set phase synchronously) and the
 * confirming `pointerlockchange` event (which fires asynchronously). Without
 * this gate the very click that acquires lock — before lock is confirmed —
 * would fire a cannon shot. The gate also clears the pending-fire queue on
 * lock loss so buffered shots cannot drain into an unlocked state.
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
 *
 * ## Hold-to-fire
 *
 * Holding the left mouse button sets `mouseHeldRef = true`. Each frame, if
 * the active quadrant is ready AND heat allows AND the pending queue has
 * room, one intent is enqueued. The same drain logic then consumes it, so
 * held fire fires at exactly the cooldown-limited rate, respects the
 * yellow/red bracket slowdown, and halts while locked out. Tap-to-fire
 * is preserved because `onMouseDown` also enqueues one immediate intent.
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
import { consumeTestFireRequests } from './weaponTestBridge';
import { getAimOffset } from './aimOffsetRefs';
import { getIsPointerLocked } from './pointerLockRefs';
import { emitVfxEvent } from '@/effects/vfxEvents';

/**
 * Maximum number of pending fire intents that can be buffered. A small cap
 * prevents runaway buffering during long cooldowns while still letting a
 * short burst of rapid clicks (3–4) all fire reliably.
 */
const PENDING_FIRE_CAP = 4;

export function WeaponSystemR3F() {
  // Separate queues for real mouse clicks vs dev-only test-bridge clicks.
  // Real mouse intents are cleared on pointer-lock loss; test-bridge intents
  // are allowed to drain unlocked so Playwright can drive the full firing
  // pipeline headlessly.
  const pendingMouseFiresRef = useRef(0);
  const pendingBridgeFiresRef = useRef(0);

  // True while the player is holding the left mouse button. While held the
  // frame tick tops up the mouse queue each frame (subject to cap + both
  // gates), which produces continuous fire at the cooldown-limited rate
  // without duplicating any of the gating logic. Tap-to-fire still works
  // because `onMouseDown` also queues one immediate intent.
  const mouseHeldRef = useRef(false);

  // Listen for left-click on document. Queue a fire only when:
  //   1) The game is in the 'playing' phase.
  //   2) Pointer lock is confirmed (getIsPointerLocked() === true).
  // Requiring lock prevents a stray shot from the click that initially
  // acquires pointer lock — that click arrives before the browser fires
  // `pointerlockchange`, so `getIsPointerLocked()` is still false and
  // the fire intent is correctly suppressed.
  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0 && useGameStore.getState().phase === 'playing' && getIsPointerLocked()) {
      mouseHeldRef.current = true;
      if (pendingMouseFiresRef.current + pendingBridgeFiresRef.current < PENDING_FIRE_CAP) {
        pendingMouseFiresRef.current += 1;
      }
    }
  }, []);

  // Release the held flag on any mouseup for button 0. We also clear it on
  // mouseleave / blur so a dropped focus (alt-tab, dev-tools) can't leave
  // the weapon stuck firing.
  const onMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 0) {
      mouseHeldRef.current = false;
    }
  }, []);

  const onMouseLeaveOrBlur = useCallback(() => {
    mouseHeldRef.current = false;
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onMouseLeaveOrBlur);
    document.addEventListener('mouseleave', onMouseLeaveOrBlur);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onMouseLeaveOrBlur);
      document.removeEventListener('mouseleave', onMouseLeaveOrBlur);
    };
  }, [onMouseDown, onMouseUp, onMouseLeaveOrBlur]);

  useFrame((_state, delta) => {
    const store = useGameStore.getState();
    // R4: halt firing logic entirely while paused. Heat decay, cooldown
    // ticks, pending-fire drain — all frozen. On resume the weapon picks
    // up exactly where it left off (cooldowns and heat are stored in
    // player.weapons, not local refs).
    if (store.phase === 'paused') return;
    const { player } = store;
    if (!player) return;

    // Pointer-lock drain gate: if lock is lost mid-play (Escape, alt-tab,
    // dev-tools focus) discard any queued intents and the held flag so
    // shots cannot drain once lock is re-acquired after a long pause. The
    // `pointerlockchange` handler in CameraSystemR3F calls `pauseGame()`
    // which sets phase → 'paused', but that Zustand write is not
    // synchronous within this frame so we check the flag here too.
    if (!getIsPointerLocked()) {
      pendingMouseFiresRef.current = 0;
      mouseHeldRef.current = false;
    }

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
    // Each request is equivalent to one mouse click, so preserve the full
    // count rather than collapsing multiple clicks into one boolean frame flag.
    const pendingTestFires = consumeTestFireRequests();
    if (pendingTestFires > 0) {
      const availableSlots =
        PENDING_FIRE_CAP - (pendingMouseFiresRef.current + pendingBridgeFiresRef.current);
      if (availableSlots > 0) {
        pendingBridgeFiresRef.current += Math.min(availableSlots, pendingTestFires);
      }
    }

    // Hold-to-fire: while the left mouse button is held, top up the pending
    // queue each frame so the drain logic below fires at the
    // cooldown-limited rate. We enqueue at most one intent per frame and
    // only when the active quadrant is ready AND heat allows AND the cap
    // has room — so held fire naturally respects the same two gates as
    // tap fire and never bypasses PENDING_FIRE_CAP.
    if (
      mouseHeldRef.current &&
      pendingMouseFiresRef.current + pendingBridgeFiresRef.current < PENDING_FIRE_CAP
    ) {
      const heldQuadrantReady = canFire(
        { cooldown: player.weapons.cooldown, cooldownRemaining: updatedCooldowns },
        store.activeQuadrant,
      );
      if (heldQuadrantReady && isFireAllowedByHeat(heatState)) {
        pendingMouseFiresRef.current += 1;
      }
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
    if (pendingMouseFiresRef.current + pendingBridgeFiresRef.current === 0) {
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
    if (pendingMouseFiresRef.current > 0) {
      pendingMouseFiresRef.current -= 1;
    } else if (pendingBridgeFiresRef.current > 0) {
      pendingBridgeFiresRef.current -= 1;
    } else {
      commit(updatedCooldowns);
      return;
    }

    // Read from cached body state (safe during useFrame).
    const bodyState = getPlayerBodyState();
    if (!bodyState) {
      // No body yet — drop this intent. Heat already decayed.
      commit(updatedCooldowns);
      return;
    }

    const pos = bodyState.position;
    const rot = bodyState.rotation;

    // Read the current fine-aim offset (yaw + pitch) written by
    // CameraSystemR3F this frame. The simpler "counter + live read" queue
    // semantics mean that if a click arrives during a cooldown, the
    // queued shot fires at the aim direction that's live at drain time —
    // which matches the hold-to-fire intuition of "shoot where I'm
    // pointing right now" with a 1-2 frame lag that is imperceptible.
    const aim = getAimOffset();

    const spawns = computeFireData(
      player.weapons.mounts,
      quadrant,
      [pos.x, pos.y, pos.z],
      [rot.x, rot.y, rot.z, rot.w],
      player.weapons.muzzleVelocity,
      player.weapons.elevationAngle,
      aim.yaw,
      aim.pitch,
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
