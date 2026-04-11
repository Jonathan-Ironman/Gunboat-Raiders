/**
 * PauseMenu — R5 slice.
 *
 * Replaces the temporary `PauseOverlayPlaceholder` shipped with R4
 * with the real Harbour Dawn pause menu: full-viewport blurred
 * backdrop, centred 440px panel with CONTINUE / SETTINGS / EXIT
 * buttons, and a "Wave X · Score Y" run-summary line.
 *
 * ### Interactions
 *
 * - **CONTINUE** — atomically re-acquires pointer lock on the
 *   `<canvas>` and calls `resumeGame()` in the same user gesture.
 *   Pointer lock MUST be requested inside the click handler or the
 *   browser rejects it as non-user-triggered.
 * - **SETTINGS** — mounts the `SettingsModal` inline via a local
 *   `view` state flag. The SettingsModal owns its own Escape handler
 *   (which `stopPropagation()`s) so it wins the Escape race while
 *   open.
 * - **EXIT** — opens a destructive `ConfirmDialog`. Confirming calls
 *   `returnToMainMenu()` on the store. Cancelling returns to the
 *   pause menu.
 * - **Escape** — triggers CONTINUE whenever the pause menu is the
 *   top-most modal (i.e. SettingsModal and ConfirmDialog are not
 *   open). The ConfirmDialog's own Escape handler uses the capture
 *   phase + `stopPropagation()` to preempt this one.
 *
 * ### Z-index budget
 *
 * - HUD:            10
 * - PauseMenu:      31
 * - SettingsModal:  32
 * - ConfirmDialog:  33
 *
 * Phase gate: the component returns `null` unless
 * `phase === 'paused'`. HUD.tsx is responsible for mounting it.
 *
 * All visuals flow through `pauseMenu.helpers.ts` → `tokens.ts`.
 */

import { useCallback, useEffect, useState } from 'react';

import { useGameStore } from '../store/gameStore';
import { useGamePhase, useHasSave, useScore, useWaveNumber } from '../store/selectors';
import { Button } from './Button';
import { useFullscreen } from './useFullscreen';
import { ConfirmDialog } from './ConfirmDialog';
import {
  formatRunSummary,
  getExitDialogMessage,
  isPauseEscapeKey,
  pauseBackdropStyle,
  pauseButtonStackStyle,
  pauseKeyframes,
  pausePanelStyle,
  pauseSummaryStyle,
  pauseTitleStyle,
} from './pauseMenu.helpers';
import { SettingsModal } from './SettingsModal';

/** Local view state for the pause menu — controls SettingsModal mounting. */
type PauseView = 'menu' | 'settings';

/**
 * Atomically re-acquire pointer lock and resume the game. Both
 * actions MUST fire inside this click handler so the browser
 * recognises the pointer-lock request as user-triggered — calling
 * `requestPointerLock()` from a stale promise or a `setTimeout`
 * silently fails with a security error.
 */
function handleContinueClick(): void {
  const canvas = document.querySelector('canvas');
  if (canvas !== null) {
    // `requestPointerLock` returns a promise in modern browsers; we
    // intentionally discard it — failures surface as a browser
    // console warning and must not block the resume.
    void canvas.requestPointerLock();
  }
  useGameStore.getState().resumeGame();
}

/**
 * Commit to leaving the run: release pointer lock (paranoid — we
 * probably don't own it anymore while paused), then transition to
 * the main menu via the store action.
 */
function handleExitConfirm(): void {
  if (typeof document !== 'undefined' && document.pointerLockElement !== null) {
    document.exitPointerLock();
  }
  useGameStore.getState().returnToMainMenu();
}

export function PauseMenu() {
  const phase = useGamePhase();
  const wave = useWaveNumber();
  const score = useScore();
  const hasSave = useHasSave();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const [view, setView] = useState<PauseView>('menu');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // When the pause phase exits (e.g. resumeGame, returnToMainMenu),
  // reset the child-modal flags so re-entering the pause menu starts
  // on a clean slate. Avoids a stale `showExitConfirm` from a
  // previous pause session.
  useEffect(() => {
    if (phase !== 'paused') {
      setView('menu');
      setShowExitConfirm(false);
    }
  }, [phase]);

  // Escape-to-continue. Only active when the pause menu is the
  // top-most modal — the SettingsModal and ConfirmDialog install
  // their own Escape handlers that `stopPropagation()`, so they win
  // the race when mounted. We additionally guard here for defense in
  // depth.
  useEffect(() => {
    if (phase !== 'paused') return;
    if (view === 'settings') return;
    if (showExitConfirm) return;

    const handler = (event: KeyboardEvent): void => {
      if (!isPauseEscapeKey(event)) return;
      event.preventDefault();
      handleContinueClick();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [phase, view, showExitConfirm]);

  const handleSettingsClick = useCallback((): void => {
    setView('settings');
  }, []);

  const handleSettingsClose = useCallback((): void => {
    setView('menu');
  }, []);

  const handleExitClick = useCallback((): void => {
    setShowExitConfirm(true);
  }, []);

  const handleExitCancel = useCallback((): void => {
    setShowExitConfirm(false);
  }, []);

  // Phase gate — PauseMenu is a no-op outside `paused`.
  if (phase !== 'paused') return null;

  return (
    <>
      <style>{pauseKeyframes()}</style>
      <div
        style={pauseBackdropStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Paused"
        data-testid="pause-menu"
      >
        <div style={pausePanelStyle} data-testid="pause-menu-panel">
          <h1 style={pauseTitleStyle}>PAUSED</h1>
          <div style={pauseButtonStackStyle}>
            <Button
              variant="primary"
              onClick={handleContinueClick}
              data-testid="pause-continue-btn"
            >
              Continue
            </Button>
            <Button
              variant="secondary"
              onClick={toggleFullscreen}
              data-testid="pause-menu-fullscreen-btn"
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleSettingsClick}
              data-testid="pause-settings-btn"
            >
              Settings
            </Button>
            <Button variant="destructive" onClick={handleExitClick} data-testid="pause-exit-btn">
              Exit
            </Button>
          </div>
          <p style={pauseSummaryStyle} data-testid="pause-run-summary">
            {formatRunSummary(wave, score)}
          </p>
        </div>
      </div>

      {view === 'settings' ? <SettingsModal onClose={handleSettingsClose} /> : null}

      {showExitConfirm ? (
        <ConfirmDialog
          title="Exit to Main Menu?"
          message={getExitDialogMessage(hasSave)}
          confirmLabel="Exit"
          cancelLabel="Cancel"
          onConfirm={handleExitConfirm}
          onCancel={handleExitCancel}
          destructive
        />
      ) : null}
    </>
  );
}
