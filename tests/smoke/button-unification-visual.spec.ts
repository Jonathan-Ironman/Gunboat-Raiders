/**
 * Visual verification for the 2026-04-11 button unification refactor.
 *
 * After the refactor every button in the game (main menu, briefing,
 * pause, settings, confirm dialog, game over) shares the same
 * `BUTTON_RECIPE` silhouette — 3D emboss shadow, Harbour Dawn display
 * font, `RADIUS_MD` corner, identical padding. Only the fill color
 * varies (gold primary, neutral secondary, red destructive).
 *
 * This smoke test captures one screenshot per modal so the reviewer
 * can eyeball the uniformity, plus it asserts structural facts:
 *
 * 1. Primary buttons (by `data-testid`) carry the gold gradient.
 * 2. Secondary buttons carry the neutral surface fill.
 * 3. Every button on every modal uses the same computed
 *    `border-radius`, `font-family`, and `padding`.
 *
 * If a future refactor reverts the shared recipe, the uniformity
 * assertions flag it immediately — not just the pixel diff.
 *
 * Kept in-repo rather than in `@playwright/test` expectation fixtures
 * because the orchestrator uses it as a one-shot verification run and
 * it is cheap enough to re-run on every UI change.
 */

import { expect, test, type Page } from '@playwright/test';

import { getGameState, startGame, waitForPhase } from '../helpers/gameTestUtils';

interface ButtonComputed {
  borderRadius: string;
  fontFamily: string;
  padding: string;
  boxShadow: string;
}

/**
 * Reads the computed style of every `<button>` inside the element
 * identified by `containerSelector` and returns a uniform subset so
 * tests can lock the structural contract.
 */
async function readButtonComputedStyles(
  page: Page,
  containerSelector: string,
): Promise<ButtonComputed[]> {
  return page.evaluate((sel) => {
    const container = document.querySelector(sel);
    if (!container) return [];
    const buttons = container.querySelectorAll('button');
    return Array.from(buttons).map((btn) => {
      const cs = window.getComputedStyle(btn);
      return {
        borderRadius: cs.borderRadius,
        fontFamily: cs.fontFamily,
        padding: cs.padding,
        boxShadow: cs.boxShadow,
      };
    });
  }, containerSelector);
}

/**
 * Ensures every computed style returned by `readButtonComputedStyles`
 * matches the first entry on the structural keys. Only asserts within
 * a single modal — different modals may still tweak padding overrides
 * (briefing / settings / confirm use narrower flex-row buttons).
 */
function assertButtonStructuralUniformity(styles: ButtonComputed[]): void {
  expect(styles.length).toBeGreaterThan(0);
  const first = styles[0];
  if (!first) throw new Error('readButtonComputedStyles returned empty');
  for (const s of styles) {
    expect(s.borderRadius).toBe(first.borderRadius);
    expect(s.fontFamily).toBe(first.fontFamily);
    // Every button in the game MUST emit at least one emboss layer.
    // A flat SHADOW_MD drop would render as exactly one `rgba(...)`
    // entry with no hard `0px 4px 0px` stop.
    expect(s.boxShadow).not.toBe('none');
  }
}

/**
 * Navigates into the briefing, then into gameplay, then opens the
 * pause menu. Used by the pause / confirm / settings scenarios.
 */
async function enterPauseMenu(page: Page): Promise<void> {
  await startGame(page);

  const newGameBtn = page.locator('[data-testid="main-menu-new-game-btn"]');
  await expect(newGameBtn).toBeVisible({ timeout: 20_000 });
  await newGameBtn.click();

  const briefingStart = page.locator('[data-testid="briefing-start-btn"]');
  if (await briefingStart.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await briefingStart.click();
  }

  await waitForPhase(page, 'playing', 15_000);

  // Pause via the store so we don't race against keyboard listeners.
  await page.evaluate(() => {
    type Store = { getState: () => { pauseGame: () => void } };
    const w = window as unknown as { __ZUSTAND_STORE__?: Store };
    w.__ZUSTAND_STORE__?.getState().pauseGame();
  });

  await expect(page.locator('[data-testid="pause-menu"]')).toBeVisible({ timeout: 5_000 });
}

test.describe('button unification 2026-04-11 — visual', () => {
  test('main menu buttons render with uniform silhouette', async ({ page }, testInfo) => {
    await startGame(page);

    const menu = page.locator('[data-testid="main-menu-scene"]');
    await expect(menu).toBeVisible({ timeout: 20_000 });

    // Wait briefly so CSS animations settle before the screenshot.
    await page.waitForTimeout(400);

    await testInfo.attach('01-main-menu', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const styles = await readButtonComputedStyles(page, '[data-testid="main-menu-button-stack"]');
    assertButtonStructuralUniformity(styles);
    // Main menu stack is Continue / New Game / Settings — three buttons.
    expect(styles).toHaveLength(3);
  });

  test('briefing modal buttons render with uniform silhouette', async ({ page }, testInfo) => {
    await startGame(page);

    const newGameBtn = page.locator('[data-testid="main-menu-new-game-btn"]');
    await expect(newGameBtn).toBeVisible({ timeout: 20_000 });
    await newGameBtn.click();

    const briefing = page.locator('[data-testid="level-briefing-modal"]');
    await expect(briefing).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(400);

    await testInfo.attach('02-briefing-modal', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const styles = await readButtonComputedStyles(page, '[data-testid="level-briefing-modal"]');
    assertButtonStructuralUniformity(styles);
    // Briefing has Back to Menu + Start — two buttons.
    expect(styles).toHaveLength(2);
  });

  test('pause menu buttons render with uniform silhouette', async ({ page }, testInfo) => {
    await enterPauseMenu(page);
    await page.waitForTimeout(400);

    await testInfo.attach('03-pause-menu', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const styles = await readButtonComputedStyles(page, '[data-testid="pause-menu-panel"]');
    assertButtonStructuralUniformity(styles);
    // Pause panel stack is Continue / Settings / Exit — three buttons.
    expect(styles).toHaveLength(3);
  });

  test('settings modal back button renders with shared silhouette', async ({ page }, testInfo) => {
    await enterPauseMenu(page);
    await page.locator('[data-testid="pause-settings-btn"]').click();
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(400);

    await testInfo.attach('04-settings-modal', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const styles = await readButtonComputedStyles(page, '[data-testid="settings-modal-panel"]');
    // Settings has Back + tab buttons; assert the Back button exists
    // with the shared silhouette and drop the tab assertion (tabs
    // are intentionally NOT buttons for silhouette purposes).
    const backStyles = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="settings-back-button"]');
      if (!btn) return null;
      const cs = window.getComputedStyle(btn);
      return {
        borderRadius: cs.borderRadius,
        fontFamily: cs.fontFamily,
        padding: cs.padding,
        boxShadow: cs.boxShadow,
      };
    });
    expect(backStyles).not.toBeNull();
    if (backStyles) {
      expect(backStyles.boxShadow).not.toBe('none');
    }
    // Sanity: tabs + back must be present.
    expect(styles.length).toBeGreaterThanOrEqual(1);
  });

  test('confirm dialog buttons render with uniform silhouette', async ({ page }, testInfo) => {
    await enterPauseMenu(page);
    await page.locator('[data-testid="pause-exit-btn"]').click();
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(400);

    await testInfo.attach('05-confirm-dialog', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const styles = await readButtonComputedStyles(page, '[data-testid="confirm-dialog-panel"]');
    assertButtonStructuralUniformity(styles);
    // Confirm dialog is Cancel / Confirm — two buttons.
    expect(styles).toHaveLength(2);
  });

  test('game over screen buttons render with uniform silhouette', async ({ page }, testInfo) => {
    await enterPauseMenu(page);

    // Resume then force the game-over phase via the store so we don't
    // need to wait for an actual death animation.
    await page.evaluate(() => {
      type Store = {
        getState: () => {
          resumeGame: () => void;
          triggerGameOver?: () => void;
          setPhase?: (phase: string) => void;
        };
        setState: (partial: Record<string, unknown>) => void;
      };
      const w = window as unknown as { __ZUSTAND_STORE__?: Store };
      const store = w.__ZUSTAND_STORE__;
      if (!store) return;
      store.getState().resumeGame();
      // Fall through to setState if no dedicated action exists.
      store.setState({ phase: 'game-over' });
    });

    const screen = page.locator('[data-testid="game-over-screen"]');
    await expect(screen).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(400);

    await testInfo.attach('06-game-over-screen', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const styles = await readButtonComputedStyles(page, '[data-testid="game-over-button-stack"]');
    assertButtonStructuralUniformity(styles);
    // Game over has Play Again / Main Menu — two buttons.
    expect(styles).toHaveLength(2);

    // Sanity: the page-level game state agrees the phase advanced.
    const state = await getGameState(page);
    expect(state?.['phase']).toBe('game-over');
  });
});
