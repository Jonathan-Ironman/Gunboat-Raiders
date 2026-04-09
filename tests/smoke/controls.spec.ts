import { test, expect } from '@playwright/test';

/**
 * Smoke test for WASD keyboard controls.
 *
 * Verifies that pressing 'W' after starting the game causes the player boat
 * to move forward (Z position changes). Reads body position from the
 * dev-only __GET_PLAYER_BODY_STATE__ accessor exposed on window.
 */
test.describe('WASD controls', () => {
  test('pressing W moves the boat forward', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click START GAME
    const startButton = page.getByTestId('start-button');
    await expect(startButton).toBeVisible({ timeout: 15_000 });
    await startButton.click();

    // Wait for physics to initialize and boat to register
    await page.waitForFunction(
      () => {
        const getState = (window as unknown as { __GET_PLAYER_BODY_STATE__?: () => unknown })
          .__GET_PLAYER_BODY_STATE__;
        return getState && getState() !== null;
      },
      { timeout: 10_000 },
    );

    // Wait for buoyancy to stabilize (boat settling on water)
    await page.waitForTimeout(2000);

    // Read initial position
    const before = await page.evaluate(() => {
      type BodyState = {
        position: { x: number; y: number; z: number };
      };
      const getState = (window as unknown as { __GET_PLAYER_BODY_STATE__: () => BodyState | null })
        .__GET_PLAYER_BODY_STATE__;
      const state = getState();
      if (!state) throw new Error('Player body state is null');
      return { x: state.position.x, y: state.position.y, z: state.position.z };
    });

    // Hold W for 2 seconds
    await page.keyboard.down('w');
    await page.waitForTimeout(2000);
    await page.keyboard.up('w');
    await page.waitForTimeout(200);

    // Read final position
    const after = await page.evaluate(() => {
      type BodyState = {
        position: { x: number; y: number; z: number };
      };
      const getState = (window as unknown as { __GET_PLAYER_BODY_STATE__: () => BodyState | null })
        .__GET_PLAYER_BODY_STATE__;
      const state = getState();
      if (!state) throw new Error('Player body state is null');
      return { x: state.position.x, y: state.position.y, z: state.position.z };
    });

    // The boat's position should have changed (it moved forward)
    const dx = Math.abs(after.x - before.x);
    const dz = Math.abs(after.z - before.z);
    const totalMovement = Math.sqrt(dx * dx + dz * dz);

    // Expect at least some horizontal movement (> 0.05 units in 2 seconds)
    expect(totalMovement).toBeGreaterThan(0.05);
  });
});
