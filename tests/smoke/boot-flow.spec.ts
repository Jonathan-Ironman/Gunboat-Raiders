/**
 * Boot-flow smoke — R10 GameBootstrap rework verification.
 *
 * Proves the end-to-end happy path from a cold page load to actively
 * playing the level:
 *
 *   1. Page loads → phase is `'mainMenu'`
 *   2. Main menu overlay is visible (ShowcaseScene runs behind it)
 *   3. `New Game` click → phase is `'briefing'`
 *   4. Level briefing modal is visible
 *   5. `Start` click → phase is `'playing'`
 *   6. HUD is visible and the player RigidBody is registered
 *
 * This is the definitive "can the user get into the game" test. It
 * fails loudly on any regression that reintroduces a legacy
 * click-to-start overlay, an auto-spawn-on-load path, or a broken
 * briefing wiring.
 *
 * Every assertion reads a dev-mode window global or a
 * `data-testid` attribute that the production UI intentionally
 * exposes — no private test hooks.
 */

import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

/**
 * Wait until the player rigid body has been registered with the
 * physicsRefs cache. `startLevel()` sets the store's `player` entity
 * synchronously, but `<PlayerBoat>` doesn't register its Rapier body
 * with `physicsRefs` until its ref callback fires one render later.
 * The HUD + gameplay systems only become fully functional once that
 * registration completes, so the smoke test treats it as the
 * definitive "player is spawned" signal.
 */
async function waitForPlayerBody(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __GET_PLAYER_BODY_STATE__?: () => unknown;
        __GET_PLAYER_BODY__?: () => unknown;
      };
      return w.__GET_PLAYER_BODY_STATE__?.() !== null && w.__GET_PLAYER_BODY__?.() !== null;
    },
    undefined,
    { timeout: 15_000 },
  );
}

test.describe('Boot flow', () => {
  test.describe.configure({ timeout: 60_000 });

  test('cold boot → main menu → briefing → playing happy path', async ({ page }) => {
    // ----- 1. Cold boot lands on the main menu -----
    await startGame(page);
    await waitForPhase(page, 'mainMenu', 20_000);

    const mainMenu = page.locator('[data-testid="main-menu-scene"]');
    await expect(mainMenu).toBeVisible({ timeout: 15_000 });

    // The briefing modal must NOT be in the DOM while we're on the menu
    // — this also acts as a regression guard against any future code
    // path that eagerly mounts overlays outside their phase gate.
    const briefing = page.locator('[data-testid="level-briefing-modal"]');
    await expect(briefing).toHaveCount(0);

    // The HUD must NOT be mounted before the player is in the game.
    const hud = page.locator('[data-testid="hud"]');
    await expect(hud).toHaveCount(0);

    // ----- 2. Click `New Game` → briefing phase -----
    const newGameBtn = page.locator('[data-testid="main-menu-new-game-btn"]');
    await expect(newGameBtn).toBeVisible({ timeout: 10_000 });
    await newGameBtn.click();

    await waitForPhase(page, 'briefing', 10_000);
    await expect(briefing).toBeVisible({ timeout: 10_000 });
    // And the main menu should be gone now that the briefing owns the
    // foreground.
    await expect(mainMenu).toHaveCount(0);

    // ----- 3. Click `Start` → playing phase -----
    const briefingStartBtn = page.locator('[data-testid="briefing-start-btn"]');
    await expect(briefingStartBtn).toBeVisible({ timeout: 10_000 });
    await briefingStartBtn.click();

    await waitForPhase(page, 'playing', 15_000);

    // ----- 4. Player body is registered and the HUD has mounted -----
    await waitForPlayerBody(page);
    await expect(hud).toBeVisible({ timeout: 10_000 });
    await expect(briefing).toHaveCount(0);
  });
});
