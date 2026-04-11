/**
 * Weapon overheat smoke — end-to-end verification that the shared heat
 * pool accumulates on real fires and decays when idle. This binds the
 * store field the HUD overhaul will later read, so it's the only
 * integration check needed before the UI slice.
 *
 * Mechanics under test (see `src/utils/overheatConstants.ts`):
 *   - HEAT_PER_SHOT ≈ 0.001875 per PROJECTILE spawned
 *   - Broadside quadrant = 4 mounts → ~26.67 projectiles/s at max rate
 *   - 5 s of sustained broadside fire should therefore produce
 *     ~0.25 heat (133 projectiles × 0.001875 ≈ 0.25)
 *   - HEAT_DECAY_PER_SECOND = 0.08 → ~0.24 heat drop over 3 s of idle
 *
 * The test picks whichever quadrant the camera-cursor fallback picks by
 * default (Playwright leaves the cursor at (0, 0) which produces a
 * broadside quadrant) and fires with the test bridge; it does not drive
 * the camera. Tolerances absorb per-frame jitter, queue-drain scheduling
 * and camera settling.
 */

import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

interface WeaponsSnapshot {
  heat: number;
  heatLockout: boolean;
  activeQuadrant: 'fore' | 'aft' | 'port' | 'starboard';
}

async function readWeaponsSnapshot(page: Page): Promise<WeaponsSnapshot> {
  return page.evaluate<WeaponsSnapshot>(() => {
    type S = {
      getState: () => {
        player: { weapons: { heat: number; heatLockout: boolean } } | null;
        activeQuadrant: 'fore' | 'aft' | 'port' | 'starboard';
      };
    };
    const w = window as unknown as { __ZUSTAND_STORE__?: S };
    const state = w.__ZUSTAND_STORE__?.getState();
    return {
      heat: state?.player?.weapons.heat ?? -1,
      heatLockout: state?.player?.weapons.heatLockout ?? false,
      activeQuadrant: state?.activeQuadrant ?? 'fore',
    };
  });
}

async function startPlaying(page: Page): Promise<void> {
  await startGame(page);
  await waitForPhase(page, 'title', 20_000);

  const startButton = page.locator('[data-testid="start-button"]');
  await expect(startButton).toBeVisible({ timeout: 15_000 });
  await startButton.click();

  await waitForPhase(page, 'playing', 15_000);

  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __GET_PLAYER_BODY_STATE__?: () => unknown;
      };
      return w.__GET_PLAYER_BODY_STATE__?.() !== null;
    },
    undefined,
    { timeout: 15_000 },
  );
}

test.describe('Weapon overheat', () => {
  test.describe.configure({ timeout: 60_000 });

  test('sustained fire accumulates heat; idle decays it', async ({ page }) => {
    await startPlaying(page);
    // Let Rapier settle and shader compile.
    await page.waitForTimeout(3_000);

    // Baseline: no fire yet → heat should be ~0.
    const baseline = await readWeaponsSnapshot(page);
    expect(
      baseline.heat,
      'Baseline heat should be near zero before any firing',
    ).toBeLessThanOrEqual(0.02);
    expect(baseline.heatLockout).toBe(false);

    // Pin the active quadrant to starboard so we fire the full 4-mount
    // broadside (max heat rate). The camera system only pushes its own
    // quadrant when its internal computed value changes, so a one-shot
    // store override sticks as long as the cursor/boat yaw don't move
    // (neither does in this test).
    await page.evaluate(() => {
      type Store = {
        getState: () => { setActiveQuadrant: (q: 'starboard') => void };
      };
      const w = window as unknown as { __ZUSTAND_STORE__?: Store };
      w.__ZUSTAND_STORE__?.getState().setActiveQuadrant('starboard');
    });
    await page.waitForTimeout(100);

    // Sanity check: fire a quick burst of 5 broadside clicks and
    // confirm the weapon system is actually honoring test-bridge
    // requests. A single starboard click adds 4 × HEAT_PER_SHOT ≈ 0.019
    // heat, which the passive decay (0.08/s) chews through in ~240 ms,
    // so a single-click check would be racy. A 5-click burst over
    // ~200 ms fires 20 projectiles = ~0.097 heat before decay, which is
    // clearly above zero even after the first few hundred ms of decay.
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const w = window as unknown as { __TEST_REQUEST_FIRE__?: () => void };
        w.__TEST_REQUEST_FIRE__?.();
      });
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(100);
    const afterSingleShot = await readWeaponsSnapshot(page);
    expect(
      afterSingleShot.heat,
      `Sanity check: heat should be > 0 after a 5-click broadside burst. ` +
        `activeQuadrant=${afterSingleShot.activeQuadrant}. ` +
        `If this is 0, the fire bridge or pool manager is not working in headless.`,
    ).toBeGreaterThan(0);
    expect(
      afterSingleShot.activeQuadrant,
      `Active quadrant should still be starboard (test override) — ` +
        `got ${afterSingleShot.activeQuadrant}. Camera system may have clobbered the override.`,
    ).toBe('starboard');

    // Fire continuously for ~5 real seconds. We poke the test bridge
    // faster than the per-quadrant cooldown (150 ms) so the pending-fire
    // queue stays saturated and the weapon system fires every cooldown
    // tick it can. The fire intent is consumed one per frame; using a
    // 30 ms poll keeps the queue from draining to zero while the test
    // browser is busy. Re-assert the starboard override on every poll
    // so CameraSystemR3F can't drift the quadrant back.
    const FIRE_DURATION_MS = 5_000;
    const FIRE_POLL_MS = 30;
    const startTime = Date.now();
    while (Date.now() - startTime < FIRE_DURATION_MS) {
      await page.evaluate(() => {
        type Store = {
          getState: () => { setActiveQuadrant: (q: 'starboard') => void };
        };
        const w = window as unknown as {
          __TEST_REQUEST_FIRE__?: () => void;
          __ZUSTAND_STORE__?: Store;
        };
        w.__ZUSTAND_STORE__?.getState().setActiveQuadrant('starboard');
        w.__TEST_REQUEST_FIRE__?.();
      });
      await page.waitForTimeout(FIRE_POLL_MS);
    }

    const afterFire = await readWeaponsSnapshot(page);

    // Expected heat at 5 s of starboard broadside fire at 60 fps:
    //
    //   At the production cadence the cooldown gate fires every
    //   ceil(0.15 / (1/60)) = 10 frames → 6 clicks/s × 4 mounts = 24
    //   projectiles/s, not the theoretical 26.67. Steady-state net
    //   growth is therefore:
    //     24 × HEAT_PER_SHOT − HEAT_DECAY_PER_SECOND
    //     ≈ 24 × 0.00487 − 0.08 ≈ 0.037 heat/s
    //   After 5 s: ~0.185 heat, plus a small startup bonus from the
    //   first shot being non-decayed.
    //
    // The 0.15 ceiling is deliberately wide: Playwright's render loop
    // doesn't always hit 60 fps, the pending-fire queue takes a few
    // frames to saturate at the start, and the test bridge consume is
    // not atomic with the weapon tick.
    expect(
      afterFire.heat,
      `Expected heat in [0.12, 0.32] after 5 s sustained broadside fire on ` +
        `quadrant=${afterFire.activeQuadrant}, got ${String(afterFire.heat)}`,
    ).toBeGreaterThanOrEqual(0.12);
    expect(
      afterFire.heat,
      `Expected heat ≤ 0.32 after 5 s sustained broadside fire on ` +
        `quadrant=${afterFire.activeQuadrant}, got ${String(afterFire.heat)}`,
    ).toBeLessThanOrEqual(0.32);
    expect(afterFire.heatLockout, 'Should not be locked out at ~20% heat').toBe(false);

    // Idle for 3 s — heat should drop noticeably via decayHeat.
    // Expected drop: HEAT_DECAY_PER_SECOND (0.08) × 3 s = 0.24, which at
    // ~0.18 starting heat clamps to zero (full recovery within the
    // window). We assert a lower-bound drop rather than an exact value
    // so the test stays robust to the starting-heat variance above.
    await page.waitForTimeout(3_000);

    const afterIdle = await readWeaponsSnapshot(page);
    const dropped = afterFire.heat - afterIdle.heat;

    // At afterFire ≈ 0.18, a 3-s idle with decay 0.08/s overshoots the
    // starting value → heat clamps to 0 → full drop. Require at least
    // half the starting heat as a safety margin for any residual queued
    // fire that might drain in the first idle frame.
    const MIN_DROP = Math.max(0.08, afterFire.heat * 0.5);
    expect(
      dropped,
      `Expected heat to decay ≥ ${String(MIN_DROP)} over 3 s idle; got drop=${String(dropped)} ` +
        `(from ${String(afterFire.heat)} to ${String(afterIdle.heat)})`,
    ).toBeGreaterThanOrEqual(MIN_DROP);
    expect(
      afterIdle.heat,
      `Heat should decay but remain non-negative; got ${String(afterIdle.heat)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(afterIdle.heatLockout, 'Lockout should remain false throughout the test').toBe(false);
  });
});
