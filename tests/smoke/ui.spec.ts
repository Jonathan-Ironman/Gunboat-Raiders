import { test, expect } from '@playwright/test';
import { startPlayingFromMenu, startGame, waitForPhase } from '../helpers/gameTestUtils';

test.describe('UI smoke tests', () => {
  test('main menu is visible on page load', async ({ page }) => {
    await startGame(page);
    await waitForPhase(page, 'mainMenu', 20_000);

    const mainMenu = page.locator('[data-testid="main-menu-scene"]');
    await expect(mainMenu).toBeVisible({ timeout: 15_000 });
  });

  test('main menu shows "GUNBOAT RAIDERS" text', async ({ page }) => {
    await startGame(page);
    await waitForPhase(page, 'mainMenu', 20_000);

    const mainMenu = page.locator('[data-testid="main-menu-scene"]');
    await expect(mainMenu).toBeVisible({ timeout: 15_000 });
    await expect(mainMenu).toContainText('GUNBOAT RAIDERS');
  });

  test('clicking New Game hides the main menu', async ({ page }) => {
    await startGame(page);
    await waitForPhase(page, 'mainMenu', 20_000);

    const newGameButton = page.locator('[data-testid="main-menu-new-game-btn"]');
    await expect(newGameButton).toBeVisible({ timeout: 15_000 });
    await newGameButton.click();
    await waitForPhase(page, 'briefing', 15_000);

    const mainMenu = page.locator('[data-testid="main-menu-scene"]');
    await expect(mainMenu).toHaveCount(0);
  });

  test('HUD elements appear after starting game', async ({ page }) => {
    await startPlayingFromMenu(page);

    const hud = page.locator('[data-testid="hud"]');
    await expect(hud).toBeVisible({ timeout: 15_000 });

    const healthBar = page.locator('[data-testid="health-bar"]');
    await expect(healthBar).toBeVisible({ timeout: 15_000 });

    const scoreDisplay = page.locator('[data-testid="score-display"]');
    await expect(scoreDisplay).toBeVisible({ timeout: 15_000 });
  });

  test('crosshair is not rendered during gameplay', async ({ page }) => {
    await startPlayingFromMenu(page);

    const hud = page.locator('[data-testid="hud"]');
    await expect(hud).toBeVisible({ timeout: 15_000 });

    // Crosshair must be absent — trajectory lines serve as the aiming cue
    await expect(page.locator('[data-testid="crosshair"]')).toHaveCount(0);
  });

  test('quadrant indicator is not rendered during gameplay', async ({ page }) => {
    await startPlayingFromMenu(page);

    const hud = page.locator('[data-testid="hud"]');
    await expect(hud).toBeVisible({ timeout: 15_000 });

    // Quadrant indicator diamonds must be absent
    await expect(page.locator('[data-testid="quadrant-indicator"]')).toHaveCount(0);
  });
});
