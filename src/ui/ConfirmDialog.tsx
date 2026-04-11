/**
 * ConfirmDialog — reusable confirmation modal shipped with R5.
 *
 * A small centred modal that asks the user to confirm a destructive
 * or otherwise irreversible action. Used by the PauseMenu for the
 * "Exit to Main Menu?" flow, and re-used by later slices (main menu
 * new-game overwrite confirm, game-over restart confirm, etc.).
 *
 * ### Visual
 *
 * - Centred `max-width: 380px` Harbour Dawn panel with the same
 *   surface / border / shadow tokens as the PauseMenu and
 *   SettingsModal, but a smaller padding budget.
 * - Title in `FONT_DISPLAY` 22px, message in `FONT_UI` 14px
 *   `line-height: 1.5`, two side-by-side buttons.
 * - Cancel sits on the left (default focus, secondary), Confirm on
 *   the right (primary — red gradient when `destructive === true`).
 *
 * ### Keyboard
 *
 * - **Enter** triggers `onConfirm`.
 * - **Escape** triggers `onCancel` AND `stopPropagation()`s so the
 *   underlying PauseMenu / MainMenu does not also react to the same
 *   Escape press and drop its own Continue handler.
 *
 * All visuals flow through `pauseMenu.helpers.ts` → `tokens.ts`.
 */

import React, { useEffect, useRef } from 'react';

import { Button } from './Button';
import {
  confirmBackdropStyle,
  confirmButtonRowStyle,
  confirmMessageStyle,
  confirmPanelStyle,
  confirmTitleStyle,
  isConfirmEnterKey,
  isConfirmEscapeKey,
  pauseKeyframes,
} from './pauseMenu.helpers';

/** Props for the `ConfirmDialog` component. */
export interface ConfirmDialogProps {
  /** Title line — shown in FONT_DISPLAY at the top of the panel. */
  readonly title: string;
  /** Body copy — shown in FONT_UI below the title. */
  readonly message: string;
  /** Label for the primary (right-hand) action button. */
  readonly confirmLabel: string;
  /** Label for the secondary (left-hand) cancel button. */
  readonly cancelLabel: string;
  /** Invoked when the user accepts — Enter key or Confirm click. */
  readonly onConfirm: () => void;
  /** Invoked when the user dismisses — Escape or Cancel click. */
  readonly onCancel: () => void;
  /** When `true`, the Confirm button uses the red destructive style. */
  readonly destructive?: boolean;
}

/**
 * Reusable confirmation modal. Parents control visibility by mounting
 * / unmounting the component — there is no internal `open` prop.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  // Default focus on the Cancel button per spec. Caught via ref +
  // single-shot effect on mount so the user can press Escape / Enter
  // immediately without tabbing.
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  // Document-level keyboard handler — captures Enter / Escape and
  // calls `stopPropagation()` so a stacked PauseMenu or MainMenu does
  // NOT also react to the same key press (the PauseMenu listens for
  // Escape to trigger Continue; we must win that race).
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (isConfirmEscapeKey(event)) {
        event.stopPropagation();
        event.preventDefault();
        onCancel();
        return;
      }
      if (isConfirmEnterKey(event)) {
        event.stopPropagation();
        event.preventDefault();
        onConfirm();
      }
    };
    // Capture phase so we run BEFORE any bubble-phase listeners that a
    // parent menu may have registered. Matches the pattern used by
    // SettingsModal's Escape handler.
    document.addEventListener('keydown', handler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
    };
  }, [onConfirm, onCancel]);

  // Clicking on the backdrop (outside the panel) cancels — matches
  // the Harbour Dawn modal convention. The panel swallows its own
  // clicks so a click inside the panel doesn't fall through.
  const handleBackdropClick = (): void => {
    onCancel();
  };

  const handlePanelClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.stopPropagation();
  };

  // Layout overrides: the confirm-dialog button row sizes buttons by
  // flex ratio (equal halves), so each button must opt out of the
  // recipe's default `width: '100%'` and accept `flex: 1` instead.
  const dialogButtonLayoutStyle: React.CSSProperties = { width: 'auto', flex: 1 };

  return (
    <>
      <style>{pauseKeyframes()}</style>
      <div
        style={confirmBackdropStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gbr-confirm-dialog-title"
        aria-describedby="gbr-confirm-dialog-message"
        data-testid="confirm-dialog"
        onClick={handleBackdropClick}
      >
        <div
          style={confirmPanelStyle}
          data-testid="confirm-dialog-panel"
          onClick={handlePanelClick}
        >
          <h2 id="gbr-confirm-dialog-title" style={confirmTitleStyle}>
            {title}
          </h2>
          <p id="gbr-confirm-dialog-message" style={confirmMessageStyle}>
            {message}
          </p>
          <div style={confirmButtonRowStyle}>
            <Button
              ref={cancelButtonRef}
              variant="secondary"
              onClick={onCancel}
              style={dialogButtonLayoutStyle}
              data-testid="confirm-dialog-cancel"
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              onClick={onConfirm}
              style={dialogButtonLayoutStyle}
              data-testid="confirm-dialog-confirm"
              data-destructive={destructive ? 'true' : 'false'}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
