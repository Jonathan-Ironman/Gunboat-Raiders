/**
 * MainMenuScene — R7 slice.
 *
 * Replaces the legacy `TitleScreen.tsx` with the full Harbour Dawn
 * main menu. Renders as a full-viewport overlay on top of the
 * `ShowcaseScene` (which is already mounted behind the overlay when
 * `phase === 'mainMenu'`) so the water stays visible at the top of
 * the screen and darkens toward the button stack at the bottom.
 *
 * ### Structure
 *
 * - **Title block** (~22vh) — `GUNBOAT RAIDERS` display title + the
 *   "Survive the waves. Sink the rest." tagline.
 * - **Button stack** (~55vh) — vertical column of buttons branched on
 *   `useHasSave()`:
 *   - `hasSave === true`: CONTINUE GAME primary, NEW GAME secondary
 *     (with destructive overwrite-confirm dialog), SETTINGS secondary.
 *   - `hasSave === false`: CONTINUE GAME rendered but DISABLED,
 *     NEW GAME primary (no confirm), SETTINGS secondary.
 * - **Footer** (~92vh) — submission credit on the left, version on the
 *   right.
 *
 * ### Modal layering
 *
 * The main menu owns a local `useState<'menu' | 'settings'>` flag for
 * in-place SettingsModal mounting (matching the PauseMenu pattern).
 * The ConfirmDialog for the overwrite flow is gated on a second local
 * `showOverwriteConfirm` flag.
 *
 * ### Keyboard
 *
 * - **Enter / Space** — activates the topmost enabled button. With a
 *   save, that's CONTINUE GAME. Without, that's NEW GAME.
 * - **Escape** — no-op on the main menu itself (there is no parent to
 *   return to). When the SettingsModal or ConfirmDialog is open, each
 *   of those installs its own capture-phase Escape handler so this
 *   layer never has to distinguish between "menu open" and "modal
 *   stacked".
 *
 * All visuals flow through `mainMenuScene.helpers.ts` → `tokens.ts`.
 *
 * Phase gate: the component returns `null` unless
 * `phase === 'mainMenu'`. `App.tsx` mounts it unconditionally.
 */

import { useCallback, useEffect, useState } from 'react';

import { useGameStore } from '../store/gameStore';
import { useGamePhase, useHasSave } from '../store/selectors';
import { ConfirmDialog } from './ConfirmDialog';
import {
  MAIN_MENU_FOOTER_CREDIT,
  MAIN_MENU_NEW_GAME_CONFIRM_MESSAGE,
  MAIN_MENU_NEW_GAME_CONFIRM_TITLE,
  MAIN_MENU_VERSION,
  isMainMenuActivateKey,
  mainMenuBackdropStyle,
  mainMenuButtonBaseStyle,
  mainMenuButtonDisabledStyle,
  mainMenuButtonPrimaryStyle,
  mainMenuButtonSecondaryStyle,
  mainMenuButtonStackStyle,
  mainMenuFooterStyle,
  mainMenuFooterTextStyle,
  mainMenuKeyframes,
  mainMenuTaglineStyle,
  mainMenuTitleBlockStyle,
  mainMenuTitleStyle,
} from './mainMenuScene.helpers';
import { SettingsModal } from './SettingsModal';

/** Local view state — controls SettingsModal mounting. */
type MainMenuView = 'menu' | 'settings';

/**
 * Full-viewport main menu overlay. Self-gated on the `'mainMenu'`
 * game phase so `App.tsx` can mount it unconditionally.
 */
export function MainMenuScene() {
  const phase = useGamePhase();
  const hasSave = useHasSave();

  const [view, setView] = useState<MainMenuView>('menu');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  // When the mainMenu phase exits (e.g. openBriefing, startLevel),
  // reset the child-modal flags so re-entering the main menu after
  // a run starts on a clean slate.
  useEffect(() => {
    if (phase !== 'mainMenu') {
      setView('menu');
      setShowOverwriteConfirm(false);
    }
  }, [phase]);

  // ----- Handlers -----

  /** CONTINUE GAME — opens the briefing at the saved level. */
  const handleContinue = useCallback((): void => {
    const currentSave = useGameStore.getState().save;
    if (currentSave === null) return;
    useGameStore.getState().openBriefing(currentSave.currentLevelIndex);
  }, []);

  /** NEW GAME with save — show overwrite confirm. */
  const handleNewGameWithSave = useCallback((): void => {
    setShowOverwriteConfirm(true);
  }, []);

  /** NEW GAME without save — go straight to briefing for level 0. */
  const handleNewGameNoSave = useCallback((): void => {
    useGameStore.getState().openBriefing(0);
  }, []);

  /** Overwrite confirmed — clear save then open briefing for level 0. */
  const handleOverwriteConfirm = useCallback((): void => {
    useGameStore.getState().clearSave();
    useGameStore.getState().openBriefing(0);
  }, []);

  /** Overwrite cancelled — dismiss the dialog. */
  const handleOverwriteCancel = useCallback((): void => {
    setShowOverwriteConfirm(false);
  }, []);

  /** SETTINGS — mount the SettingsModal inline. */
  const handleSettingsClick = useCallback((): void => {
    setView('settings');
  }, []);

  /** Close the SettingsModal — return to the menu view. */
  const handleSettingsClose = useCallback((): void => {
    setView('menu');
  }, []);

  // ----- Keyboard accelerator -----
  //
  // Enter / Space activate the topmost enabled button:
  //   - hasSave === true  → Continue
  //   - hasSave === false → New Game (no confirm)
  //
  // The listener is only installed when the menu is the top-most
  // layer (phase=mainMenu, no SettingsModal, no ConfirmDialog). Those
  // child modals install their own capture-phase listeners and
  // `stopPropagation()` so a stacked Enter / Space press targets
  // their own primary action, not ours.
  useEffect(() => {
    if (phase !== 'mainMenu') return undefined;
    if (view === 'settings') return undefined;
    if (showOverwriteConfirm) return undefined;

    const handler = (event: KeyboardEvent): void => {
      if (!isMainMenuActivateKey(event)) return;
      event.preventDefault();
      if (hasSave) {
        handleContinue();
      } else {
        handleNewGameNoSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [phase, view, showOverwriteConfirm, hasSave, handleContinue, handleNewGameNoSave]);

  // Phase gate — `null` outside mainMenu keeps the main tree tidy.
  if (phase !== 'mainMenu') return null;

  // ----- Composed styles (primary/secondary/disabled variants) -----

  const continueButtonStyle = hasSave
    ? { ...mainMenuButtonBaseStyle, ...mainMenuButtonPrimaryStyle }
    : { ...mainMenuButtonBaseStyle, ...mainMenuButtonDisabledStyle };

  const newGameButtonStyle = hasSave
    ? { ...mainMenuButtonBaseStyle, ...mainMenuButtonSecondaryStyle }
    : { ...mainMenuButtonBaseStyle, ...mainMenuButtonPrimaryStyle };

  const settingsButtonStyle = {
    ...mainMenuButtonBaseStyle,
    ...mainMenuButtonSecondaryStyle,
  };

  // Continue is only interactive when a save actually exists. Using
  // an explicit no-op rather than `undefined` keeps the disabled
  // branch's click handler type-stable.
  const continueClickHandler = hasSave ? handleContinue : undefined;
  const newGameClickHandler = hasSave ? handleNewGameWithSave : handleNewGameNoSave;

  return (
    <>
      <style>{mainMenuKeyframes()}</style>
      <div
        style={mainMenuBackdropStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        data-testid="main-menu-scene"
      >
        <div style={mainMenuTitleBlockStyle}>
          <h1 style={mainMenuTitleStyle} data-testid="main-menu-title">
            GUNBOAT RAIDERS
          </h1>
          <p style={mainMenuTaglineStyle} data-testid="main-menu-tagline">
            Survive the waves. Sink the rest.
          </p>
        </div>

        <div style={mainMenuButtonStackStyle} data-testid="main-menu-button-stack">
          <button
            type="button"
            style={continueButtonStyle}
            onClick={continueClickHandler}
            disabled={!hasSave}
            aria-disabled={!hasSave}
            data-testid="main-menu-continue-btn"
            data-primary={hasSave ? 'true' : 'false'}
          >
            Continue Game
          </button>

          <button
            type="button"
            style={newGameButtonStyle}
            onClick={newGameClickHandler}
            data-testid="main-menu-new-game-btn"
            data-primary={hasSave ? 'false' : 'true'}
          >
            New Game
          </button>

          <button
            type="button"
            style={settingsButtonStyle}
            onClick={handleSettingsClick}
            data-testid="main-menu-settings-btn"
          >
            Settings
          </button>
        </div>

        <div style={mainMenuFooterStyle} data-testid="main-menu-footer">
          <p style={mainMenuFooterTextStyle} data-testid="main-menu-footer-credit">
            {MAIN_MENU_FOOTER_CREDIT}
          </p>
          <p style={mainMenuFooterTextStyle} data-testid="main-menu-footer-version">
            {MAIN_MENU_VERSION}
          </p>
        </div>
      </div>

      {view === 'settings' ? <SettingsModal onClose={handleSettingsClose} /> : null}

      {showOverwriteConfirm ? (
        <ConfirmDialog
          title={MAIN_MENU_NEW_GAME_CONFIRM_TITLE}
          message={MAIN_MENU_NEW_GAME_CONFIRM_MESSAGE}
          confirmLabel="New Game"
          cancelLabel="Cancel"
          onConfirm={handleOverwriteConfirm}
          onCancel={handleOverwriteCancel}
          destructive
        />
      ) : null}
    </>
  );
}
