/**
 * GameOverScreen — R15 slice.
 *
 * Restyles the legacy "SUNK" overlay with Harbour Dawn tokens and
 * rewires its action buttons to the R2 phase-flow actions:
 *
 * - **PLAY AGAIN** — calls `startLevel(save?.currentLevelIndex ?? 0)`.
 *   Falls back to level 0 when no save is present so a fresh run that
 *   ends in game-over before the first checkpoint still has a valid
 *   restart path.
 * - **MAIN MENU** — calls `returnToMainMenu()` (transitions to
 *   `phase === 'mainMenu'`, NOT the legacy `'title'` phase). Does NOT
 *   clear the persistent save.
 *
 * A disclaimer line — `"This run did not save — you sank at Wave
 * {wave}."` — sits between the stat block and the button stack to
 * make the save semantics explicit. The save system (R18) only
 * checkpoints at level transitions, so a run that ends in game-over
 * legitimately did not persist any new progress.
 *
 * ### Keyboard
 *
 * - **Enter / Space** — activates PLAY AGAIN.
 * - **Escape** — activates MAIN MENU.
 *
 * Both listeners are only installed while the component is mounted
 * (i.e. only while `phase === 'game-over'`) so they can't leak into
 * other phases. The pause menu is INACCESSIBLE during game-over per
 * spec — Escape is the exit, not a pause trigger.
 *
 * Phase gate: the component returns `null` unless
 * `phase === 'game-over'`. `App.tsx` mounts it unconditionally.
 *
 * All visuals flow through `gameOverScreen.helpers.ts` → `tokens.ts`.
 */

import { useCallback, useEffect } from 'react';

import { useGameStore } from '../store/gameStore';
import { useEnemiesSunkTotal, useGamePhase, useScore, useWaveNumber } from '../store/selectors';
import {
  formatFinalScore,
  formatGameOverDisclaimer,
  gameOverBackdropStyle,
  gameOverButtonBaseStyle,
  gameOverButtonPrimaryStyle,
  gameOverButtonSecondaryStyle,
  gameOverButtonStackStyle,
  gameOverDisclaimerStyle,
  gameOverKeyframes,
  gameOverPanelStyle,
  gameOverStatLabelStyle,
  gameOverStatRowStyle,
  gameOverStatValueStyle,
  gameOverStatsStackStyle,
  gameOverTitleStyle,
  isGameOverMainMenuKey,
  isGameOverPlayAgainKey,
} from './gameOverScreen.helpers';

/**
 * PLAY AGAIN click handler. Reads the persisted save at call time so
 * we always restart at whichever level the player is currently
 * checkpointed on. Falls back to level 0 when no save exists (e.g.
 * player dies on the very first wave before any save has been
 * written).
 */
function handlePlayAgainClick(): void {
  const save = useGameStore.getState().save;
  const levelIndex = save?.currentLevelIndex ?? 0;
  useGameStore.getState().startLevel(levelIndex);
}

/**
 * MAIN MENU click handler. Tears down the current session and
 * returns to the Harbour Dawn main menu. Deliberately does NOT
 * clear the persistent save — progress through previous levels is
 * preserved across a game-over exit.
 */
function handleMainMenuClick(): void {
  useGameStore.getState().returnToMainMenu();
}

/**
 * Full-viewport game-over overlay. Self-gated on the `'game-over'`
 * game phase so `App.tsx` can mount it unconditionally.
 */
export function GameOverScreen() {
  const phase = useGamePhase();
  const wave = useWaveNumber();
  const score = useScore();
  const enemiesSunk = useEnemiesSunkTotal();

  const handlePlayAgain = useCallback((): void => {
    handlePlayAgainClick();
  }, []);

  const handleMainMenu = useCallback((): void => {
    handleMainMenuClick();
  }, []);

  // Keyboard accelerators — only listen while the game-over screen
  // is the active phase. The pause menu is INACCESSIBLE here (Escape
  // routes to MAIN MENU, not to `pauseGame`), so there is no
  // precedence race with other modal layers.
  useEffect(() => {
    if (phase !== 'game-over') return undefined;

    const handler = (event: KeyboardEvent): void => {
      if (isGameOverPlayAgainKey(event)) {
        event.preventDefault();
        handlePlayAgainClick();
        return;
      }
      if (isGameOverMainMenuKey(event)) {
        event.preventDefault();
        handleMainMenuClick();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [phase]);

  // Phase gate — `null` outside game-over keeps the main tree tidy.
  if (phase !== 'game-over') return null;

  const playAgainButtonStyle = {
    ...gameOverButtonBaseStyle,
    ...gameOverButtonPrimaryStyle,
  };
  const mainMenuButtonStyle = {
    ...gameOverButtonBaseStyle,
    ...gameOverButtonSecondaryStyle,
  };

  return (
    <>
      <style>{gameOverKeyframes()}</style>
      <div
        style={gameOverBackdropStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Game over"
        data-testid="game-over-screen"
      >
        <div style={gameOverPanelStyle} data-testid="game-over-panel">
          <h1 style={gameOverTitleStyle} data-testid="game-over-title">
            SUNK
          </h1>

          <div style={gameOverStatsStackStyle} data-testid="game-over-stats">
            <p style={gameOverStatRowStyle} data-testid="game-over-waves-survived">
              <span style={gameOverStatLabelStyle}>Waves Survived:</span>
              <span style={gameOverStatValueStyle}>{String(wave)}</span>
            </p>
            <p style={gameOverStatRowStyle} data-testid="game-over-enemies-sunk">
              <span style={gameOverStatLabelStyle}>Enemies Sunk:</span>
              <span style={gameOverStatValueStyle}>{String(enemiesSunk)}</span>
            </p>
            <p style={gameOverStatRowStyle} data-testid="game-over-final-score">
              <span style={gameOverStatLabelStyle}>Final Score:</span>
              <span style={gameOverStatValueStyle}>{formatFinalScore(score)}</span>
            </p>
          </div>

          <p style={gameOverDisclaimerStyle} data-testid="game-over-disclaimer">
            {formatGameOverDisclaimer(wave)}
          </p>

          <div style={gameOverButtonStackStyle} data-testid="game-over-button-stack">
            <button
              type="button"
              style={playAgainButtonStyle}
              onClick={handlePlayAgain}
              data-testid="play-again-button"
            >
              Play Again
            </button>
            <button
              type="button"
              style={mainMenuButtonStyle}
              onClick={handleMainMenu}
              data-testid="main-menu-button"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
