/**
 * HealthBar R11 visual smoke test.
 *
 * Verifies the actual rendered DOM for the two key R11 scenarios:
 *
 *   1. armor=50/100, hull=100/100 — armor bar should show the shimmer
 *      animation class and `data-armor-shimmer="on"`; hull should be in
 *      the teal "full" state with no pulse.
 *
 *   2. armor=100/100, hull=30/100 — armor should have no shimmer; hull
 *      should be in the "critical" state with the red outline and pulse.
 *
 * The test mutates the Zustand store directly via the dev-only
 * `window.__ZUSTAND_STORE__` handle so it doesn't depend on fragile gameplay
 * timing. It also captures one screenshot per scenario for visual QA. The
 * browser is closed automatically by the Playwright runner between tests.
 */

import { test, expect, type Page } from '@playwright/test';
import { startGame, waitForPhase } from '../helpers/gameTestUtils';

interface PlayerHealthSnapshot {
  armor: number;
  armorMax: number;
  hull: number;
  hullMax: number;
}

/**
 * Drive the store into `playing` phase and force the player's health to a
 * specific armor/hull snapshot, preserving armorRegenRate so the upstream
 * regen tick doesn't immediately pull armor back to max mid-assertion.
 *
 * We patch by calling `setState` on the Zustand store, since the game's
 * `applyDamageToPlayer` only handles damage, not "set to arbitrary value".
 */
async function forcePlayerHealth(page: Page, snapshot: PlayerHealthSnapshot): Promise<void> {
  await page.evaluate((snap: PlayerHealthSnapshot) => {
    type Store = {
      getState: () => {
        player: null | {
          health: {
            armor: number;
            armorMax: number;
            armorRegenRate: number;
            hull: number;
            hullMax: number;
          };
          isSinking: boolean;
          [key: string]: unknown;
        };
      };
      setState: (partial: { player: unknown }) => void;
    };
    const w = window as unknown as { __ZUSTAND_STORE__?: Store };
    const store = w.__ZUSTAND_STORE__;
    if (!store) throw new Error('Zustand store handle missing');
    const state = store.getState();
    if (!state.player) throw new Error('Player entity missing');
    // Temporarily zero out armorRegenRate so the DamageSystemR3F tick
    // doesn't immediately repair armor back to max and erase the shimmer
    // state we want to screenshot.
    store.setState({
      player: {
        ...state.player,
        isSinking: false,
        health: {
          ...state.player.health,
          armor: snap.armor,
          armorMax: snap.armorMax,
          armorRegenRate: 0,
          hull: snap.hull,
          hullMax: snap.hullMax,
        },
      },
    });
  }, snapshot);
}

/** Navigate, start a run, wait for the player + HUD to be ready. */
async function enterGameplay(page: Page): Promise<void> {
  await startGame(page);

  // Game boots on 'mainMenu'. Prefer the "New Game" button — the main
  // menu keeps the testid `main-menu-new-game-btn` even when the
  // persistence layer disables continue.
  const newGameBtn = page.locator('[data-testid="main-menu-new-game-btn"]');
  await expect(newGameBtn).toBeVisible({ timeout: 20_000 });
  await newGameBtn.click();

  // The briefing modal sits between mainMenu and playing; click through.
  const briefingStart = page.locator('[data-testid="briefing-start-btn"]');
  if (await briefingStart.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await briefingStart.click();
  }

  await waitForPhase(page, 'playing', 15_000);
  await expect(page.locator('[data-testid="health-bar"]')).toBeVisible({ timeout: 10_000 });
}

test.describe('HealthBar R11 visual', () => {
  test('armor=50/100 hull=100/100 shows shimmer on armor, no hull pulse', async ({
    page,
  }, testInfo) => {
    await enterGameplay(page);

    await forcePlayerHealth(page, { armor: 50, armorMax: 100, hull: 100, hullMax: 100 });

    // Re-render is synchronous after setState, but give React a frame.
    await page.waitForTimeout(100);

    const bar = page.locator('[data-testid="health-bar"]');
    // 2026-04-11 ramp: armor at 50% sits in the "damaged" band
    // (critical ≤ 30% < damaged ≤ 60% < full). Shimmer stays on because
    // armor is below max and the boat is alive.
    await expect(bar).toHaveAttribute('data-armor-state', 'damaged');
    await expect(bar).toHaveAttribute('data-armor-shimmer', 'on');
    await expect(bar).toHaveAttribute('data-hull-state', 'full');
    await expect(bar).toHaveAttribute('data-hull-pulse', 'off');

    // The armor fill div must carry the shimmer class.
    const armorFill = page.locator('[data-testid="health-bar-armor-fill"]');
    await expect(armorFill).toHaveClass(/gbr-armor-shimmer/);

    // Numeric readouts were removed on 2026-04-11 per playtest feedback —
    // the bars alone are the single source of health information now.
    await expect(page.locator('[data-testid="health-bar-armor-readout"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="health-bar-hull-readout"]')).toHaveCount(0);

    await testInfo.attach('armor-shimmer-50-100', {
      body: await bar.screenshot(),
      contentType: 'image/png',
    });
  });

  test('armor=100/100 hull=30/100 shows hull critical pulse, no armor shimmer', async ({
    page,
  }, testInfo) => {
    await enterGameplay(page);

    await forcePlayerHealth(page, { armor: 100, armorMax: 100, hull: 30, hullMax: 100 });

    await page.waitForTimeout(100);

    const bar = page.locator('[data-testid="health-bar"]');
    await expect(bar).toHaveAttribute('data-armor-state', 'full');
    await expect(bar).toHaveAttribute('data-armor-shimmer', 'off');
    await expect(bar).toHaveAttribute('data-hull-state', 'critical');
    await expect(bar).toHaveAttribute('data-hull-pulse', 'on');

    // Armor fill must NOT have the shimmer class.
    const armorFill = page.locator('[data-testid="health-bar-armor-fill"]');
    await expect(armorFill).not.toHaveClass(/gbr-armor-shimmer/);

    // Hull fill must have the pulse class.
    const hullFill = page.locator('[data-testid="health-bar-hull-fill"]');
    await expect(hullFill).toHaveClass(/gbr-hull-pulse/);

    // Hull track must render with the red outline.
    const hullTrackOutline = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="health-bar-hull-track"]');
      if (!el) return null;
      return getComputedStyle(el as HTMLElement).outlineColor;
    });
    expect(hullTrackOutline).not.toBeNull();
    // Browsers normalize `#ff8080` to `rgb(255, 128, 128)`.
    expect(hullTrackOutline).toContain('255');

    // Readouts were removed on 2026-04-11. Keep the assertion here so any
    // regression that reintroduces them is caught.
    await expect(page.locator('[data-testid="health-bar-hull-readout"]')).toHaveCount(0);

    await testInfo.attach('hull-critical-30-100', {
      body: await bar.screenshot(),
      contentType: 'image/png',
    });
  });
});
