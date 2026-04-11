/**
 * Pause-flow smoke — end-to-end verification of R4 pause wiring.
 *
 * Verifies that:
 *   1. Calling `pauseGame()` (the store action the pointer-lock-loss
 *      listener will invoke in production) transitions phase to
 *      `'paused'`.
 *   2. While paused, `<Physics paused>` actually freezes the world —
 *      enemy positions must not change over a real wall-clock second.
 *   3. Clicking the `PauseOverlayPlaceholder` resumes the game and
 *      enemies start moving again.
 *
 * Why we don't drive the real `pointerlockchange` event:
 *
 *   Headless Chromium in Playwright doesn't reliably grant pointer
 *   lock — the `requestPointerLock()` call silently resolves without
 *   actually engaging lock, so there is no lock to lose and the
 *   `pointerlockchange` listener never fires. The unit of code we
 *   actually care about is the pause transition and its downstream
 *   effects (physics halt, system guards, overlay mount). We call
 *   `pauseGame()` directly to test that pipeline; a separate unit
 *   test covers the lock-loss listener on its own.
 *
 * Tolerance reasoning:
 *
 *   "Frozen" is not perfectly zero: Rapier interpolates mesh positions
 *   over the last accumulator delta, and store state is mutated by
 *   AISystem from cached body state on the frame the pause is
 *   entered. We assert position drift < 0.05 world units per axis
 *   across a 1 s window, which is ~50× tighter than a moving enemy
 *   (~3-5 units/s at cruising speed) and easily distinguishable.
 */

import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

interface EnemyPositionSnapshot {
  readonly id: string;
  readonly position: readonly [number, number, number];
}

/**
 * Reads enemy positions directly from the Zustand store. The store
 * mirrors physics body state via AISystem; when the world is frozen,
 * `ai.position` stops updating.
 */
async function readEnemyPositions(page: Page): Promise<EnemyPositionSnapshot[]> {
  return page.evaluate<EnemyPositionSnapshot[]>(() => {
    interface Enemy {
      id: string;
      position: [number, number, number];
    }
    interface Store {
      getState: () => { enemies: Map<string, Enemy> };
    }
    const w = window as unknown as { __ZUSTAND_STORE__?: Store };
    const enemies = w.__ZUSTAND_STORE__?.getState().enemies;
    if (enemies === undefined) return [];
    return Array.from(enemies.values()).map((e) => ({
      id: e.id,
      position: [e.position[0], e.position[1], e.position[2]] as [number, number, number],
    }));
  });
}

async function startPlaying(page: Page): Promise<void> {
  await startGame(page);
  await waitForPhase(page, 'mainMenu', 20_000);

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

test.describe('Pause flow', () => {
  test.describe.configure({ timeout: 60_000 });

  test('pauseGame freezes enemies; clicking overlay resumes simulation', async ({ page }) => {
    await startPlaying(page);

    // Let Rapier settle and give the WaveSystem time to spawn enemies.
    // Wave 1 enemies spawn after INITIAL_SPAWN_DELAY (2 s) plus per-enemy
    // stagger, so ~4 s is enough for at least one enemy to be live.
    await page.waitForFunction(
      () => {
        interface Store {
          getState: () => { enemies: Map<string, unknown> };
        }
        const w = window as unknown as { __ZUSTAND_STORE__?: Store };
        const enemies = w.__ZUSTAND_STORE__?.getState().enemies;
        return enemies !== undefined && enemies.size > 0;
      },
      undefined,
      { timeout: 20_000 },
    );

    // Give enemies a moment of motion so we're not capturing a stationary
    // spawn pose that would also be "frozen" by coincidence.
    await page.waitForTimeout(500);

    // ---- Act: trigger pause ----
    //
    // Drive the store action directly. In production the
    // `pointerlockchange` listener in CameraSystemR3F fires this; headless
    // Chromium can't reliably reproduce that sequence (see file-level
    // comment) so we exercise the same code path via the exposed store.
    await page.evaluate(() => {
      interface Store {
        getState: () => { pauseGame: () => void };
      }
      const w = window as unknown as { __ZUSTAND_STORE__?: Store };
      w.__ZUSTAND_STORE__?.getState().pauseGame();
    });
    await waitForPhase(page, 'paused', 5_000);

    // The placeholder overlay must be mounted and clickable.
    const overlay = page.locator('[data-testid="pause-overlay-placeholder"]');
    await expect(overlay).toBeVisible({ timeout: 5_000 });

    // Capture a paused-state screenshot for the visual record. This is
    // the first user-facing evidence that R4 landed, so it's worth
    // keeping around locally.
    await page
      .screenshot({ path: 'test-results/pause-flow-paused.png', fullPage: false })
      .catch(() => {
        // Screenshot failures must not block the assertion chain.
      });

    // Snapshot enemy positions at the moment of pause.
    const before = await readEnemyPositions(page);
    expect(before.length, 'Test requires at least one live enemy to detect motion').toBeGreaterThan(
      0,
    );

    // Wait 1 full second of wall-clock time.
    await page.waitForTimeout(1_000);

    const afterHold = await readEnemyPositions(page);

    // Cross-check: for every enemy still alive, its store-mirrored
    // position must not have drifted more than the tolerance on any
    // axis. (Enemies that despawned during the hold are simply skipped;
    // that won't happen with physics frozen, but defensive skip keeps
    // the test resilient.)
    const DRIFT_TOLERANCE = 0.05;
    const beforeById = new Map(before.map((e) => [e.id, e.position]));
    let verified = 0;
    for (const after of afterHold) {
      const start = beforeById.get(after.id);
      if (start === undefined) continue;
      const dx = Math.abs(after.position[0] - start[0]);
      const dy = Math.abs(after.position[1] - start[1]);
      const dz = Math.abs(after.position[2] - start[2]);
      expect(
        dx,
        `Enemy ${after.id} X drifted ${String(dx)} during pause — physics not frozen?`,
      ).toBeLessThan(DRIFT_TOLERANCE);
      expect(
        dy,
        `Enemy ${after.id} Y drifted ${String(dy)} during pause — physics not frozen?`,
      ).toBeLessThan(DRIFT_TOLERANCE);
      expect(
        dz,
        `Enemy ${after.id} Z drifted ${String(dz)} during pause — physics not frozen?`,
      ).toBeLessThan(DRIFT_TOLERANCE);
      verified++;
    }
    expect(verified, 'At least one enemy must have survived the pause hold window').toBeGreaterThan(
      0,
    );

    // ---- Act: click placeholder to resume ----
    //
    // We cannot fully reproduce pointer lock in headless — the
    // `requestPointerLock()` call inside the click handler will silently
    // fail, but the `resumeGame()` call after it still runs (we verified
    // this by reading source of the handler). That's what we assert.
    await overlay.click();
    await waitForPhase(page, 'playing', 5_000);

    // ---- Assert: simulation is running again ----
    //
    // Give the world a full second to spin back up, then check enemies
    // have moved from their frozen positions. We use the snapshot taken
    // AT the pause moment as the reference — if the world resumed, at
    // least one enemy should have drifted beyond the tolerance.
    await page.waitForTimeout(1_000);
    const afterResume = await readEnemyPositions(page);
    const pausedPosById = new Map(afterHold.map((e) => [e.id, e.position]));
    let movedCount = 0;
    for (const after of afterResume) {
      const paused = pausedPosById.get(after.id);
      if (paused === undefined) continue;
      const dx = Math.abs(after.position[0] - paused[0]);
      const dy = Math.abs(after.position[1] - paused[1]);
      const dz = Math.abs(after.position[2] - paused[2]);
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance > DRIFT_TOLERANCE) movedCount++;
    }
    expect(
      movedCount,
      'Expected at least one enemy to move after resume — simulation did not restart?',
    ).toBeGreaterThan(0);

    // Take a screenshot of the paused state for visual record (non-blocking).
    // Not saved on success in CI, but useful for local debugging.
    await page.screenshot({
      path: 'test-results/pause-flow-after-resume.png',
      fullPage: false,
    });
  });
});
