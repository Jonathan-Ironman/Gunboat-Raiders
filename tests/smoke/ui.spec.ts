import { test, expect } from '@playwright/test';

test.describe('UI smoke tests', () => {
  test('title screen is visible on page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const titleScreen = page.locator('[data-testid="title-screen"]');
    await expect(titleScreen).toBeVisible({ timeout: 15_000 });
  });

  test('title screen shows "GUNBOAT RAIDERS" text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const titleScreen = page.locator('[data-testid="title-screen"]');
    await expect(titleScreen).toBeVisible({ timeout: 15_000 });
    await expect(titleScreen).toContainText('GUNBOAT RAIDERS');
  });

  test('clicking start game hides title screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const startButton = page.locator('[data-testid="start-button"]');
    await expect(startButton).toBeVisible({ timeout: 15_000 });
    await startButton.click();

    const titleScreen = page.locator('[data-testid="title-screen"]');
    await expect(titleScreen).not.toBeVisible({ timeout: 5_000 });
  });

  test('HUD elements appear after starting game', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const startButton = page.locator('[data-testid="start-button"]');
    await expect(startButton).toBeVisible({ timeout: 15_000 });
    await startButton.click();

    const hud = page.locator('[data-testid="hud"]');
    await expect(hud).toBeVisible({ timeout: 5_000 });

    const healthBar = page.locator('[data-testid="health-bar"]');
    await expect(healthBar).toBeVisible({ timeout: 5_000 });

    const scoreDisplay = page.locator('[data-testid="score-display"]');
    await expect(scoreDisplay).toBeVisible({ timeout: 5_000 });
  });

  test('quadrant indicator has 4 directional segments', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const startButton = page.locator('[data-testid="start-button"]');
    await expect(startButton).toBeVisible({ timeout: 15_000 });
    await startButton.click();

    const quadrant = page.locator('[data-testid="quadrant-indicator"]');
    await expect(quadrant).toBeVisible({ timeout: 5_000 });

    // Check all 4 segments exist
    await expect(page.locator('[data-testid="quadrant-f"]')).toBeVisible();
    await expect(page.locator('[data-testid="quadrant-a"]')).toBeVisible();
    await expect(page.locator('[data-testid="quadrant-p"]')).toBeVisible();
    await expect(page.locator('[data-testid="quadrant-s"]')).toBeVisible();
  });
});
