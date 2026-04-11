/**
 * ControlsOverlay — in-game help panel.
 *
 * A compact side panel listing the player keybindings. Hidden by
 * default and toggled by pressing `H` or `?`. Closes on Escape or on
 * click outside the panel. The overlay is cosmetic only and does not
 * pause or otherwise affect the game loop — Escape closes the panel
 * but its propagation is stopped so the same event never reaches the
 * pause system.
 *
 * ### R17 revisions
 *
 * - Keybinding data comes from `src/ui/keybindings.ts`, shared with
 *   the future SettingsModal so the two surfaces never drift.
 * - The document-level keydown listener is guarded against events
 *   coming from `<input>` / `<textarea>` targets, so typing "h" or
 *   "?" into a settings field never toggles the overlay.
 *
 * ### File layout
 *
 * - `ControlsOverlayPanel` — a pure presentational component that
 *   renders the panel content. Always renders (no internal phase/open
 *   gating), which makes it trivially testable via `react-dom/server`.
 * - `ControlsOverlay` — the stateful wrapper that owns `open` state,
 *   wires up the document keydown listener, self-gates on phase, and
 *   delegates rendering to `ControlsOverlayPanel`. This is the
 *   component that HUD consumers should mount.
 *
 * Keeping the two exports in the same file is fine under
 * `react-refresh/only-export-components` because both are React
 * components (PascalCase function components). Non-component helpers
 * live in `ControlsOverlay.helpers.ts` where they belong.
 *
 * All visual values (colors, spacing, motion) flow through
 * `./tokens.ts` via the style recipes in `ControlsOverlay.helpers.ts`.
 * No hardcoded hexes, durations, or magic numbers live in this file.
 */

import { useCallback, useEffect, useState, type MouseEvent } from 'react';

import { useGamePhase } from '../store/selectors';
import {
  CONTROLS_QUADRANT_CAPTION,
  CONTROLS_QUADRANT_DIAGRAM,
  controlsActionLabelStyle,
  controlsBackdropStyle,
  controlsCloseButtonStyle,
  controlsHeaderStyle,
  controlsKeyPillStyle,
  controlsKeyframes,
  controlsPanelStyle,
  controlsQuadrantCaptionStyle,
  controlsQuadrantDiagramStyle,
  controlsRowStyle,
  controlsSectionHeadingStyle,
  controlsSectionStyle,
  controlsTitleStyle,
  isCloseKey,
  isToggleKey,
  shouldIgnoreKeyEvent,
  shouldRenderControlsOverlay,
} from './ControlsOverlay.helpers';
import { KEYBINDINGS } from './keybindings';

// ---------------------------------------------------------------------------
// Presentational panel — no state, no effects, always renders.
// ---------------------------------------------------------------------------

/** Props for the pure presentational panel. */
export interface ControlsOverlayPanelProps {
  /** Called when the backdrop or the close button is clicked. */
  readonly onClose: () => void;
  /**
   * Called when a mouse click lands inside the panel. The caller
   * should `event.stopPropagation()` so the click does not bubble
   * up to the backdrop's close handler.
   */
  readonly onPanelClick: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Pure, always-rendered overlay markup. Unit-tested via
 * `react-dom/server`. Does NOT consult the store or local state — the
 * stateful `ControlsOverlay` wrapper decides when to mount this.
 */
export function ControlsOverlayPanel({ onClose, onPanelClick }: ControlsOverlayPanelProps) {
  return (
    <>
      <style>{controlsKeyframes()}</style>
      <div
        style={controlsBackdropStyle}
        onClick={onClose}
        data-testid="controls-overlay"
        role="dialog"
        aria-label="Keyboard controls"
      >
        <div style={controlsPanelStyle} onClick={onPanelClick} data-testid="controls-overlay-panel">
          <div style={controlsHeaderStyle}>
            <h2 style={controlsTitleStyle}>CONTROLS</h2>
            <button
              type="button"
              style={controlsCloseButtonStyle}
              onClick={onClose}
              aria-label="Close controls overlay"
              data-testid="controls-close"
            >
              ×
            </button>
          </div>

          {KEYBINDINGS.map((category) => (
            <section
              key={category.id}
              style={controlsSectionStyle}
              data-testid={`controls-section-${category.id}`}
            >
              <h3 style={controlsSectionHeadingStyle}>{category.title}</h3>
              {category.bindings.map((binding) => (
                <div
                  key={`${category.id}-${binding.key}`}
                  style={controlsRowStyle}
                  data-testid={`controls-row-${category.id}-${binding.key}`}
                >
                  <span style={controlsKeyPillStyle}>{binding.key}</span>
                  <span style={controlsActionLabelStyle}>{binding.action}</span>
                </div>
              ))}
            </section>
          ))}

          <pre style={controlsQuadrantDiagramStyle} data-testid="controls-quadrant-diagram">
            {CONTROLS_QUADRANT_DIAGRAM}
          </pre>
          <p style={controlsQuadrantCaptionStyle}>{CONTROLS_QUADRANT_CAPTION}</p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stateful wrapper — owns `open`, phase gating, and keydown handling.
// ---------------------------------------------------------------------------

export function ControlsOverlay() {
  const phase = useGamePhase();
  const [open, setOpen] = useState<boolean>(false);

  // Document-level keydown handler. Installed once and survives
  // re-renders — the component's local `open` state flips through
  // the functional updater so we don't need to re-bind when `open`
  // changes.
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      // Brief R17 revision: never react to keys typed into text inputs.
      if (shouldIgnoreKeyEvent(event)) return;

      if (isToggleKey(event)) {
        setOpen((previous) => !previous);
        return;
      }

      if (isCloseKey(event)) {
        // Only consume Escape while the overlay is actually open —
        // otherwise we must let it fall through so PauseMenu /
        // pointer-lock systems still see it.
        setOpen((previous) => {
          if (!previous) return previous;
          // Swallow this Escape so it does not simultaneously pause
          // the game.
          event.stopPropagation();
          event.preventDefault();
          return false;
        });
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, []);

  // Close when the phase transitions out of the allowed gameplay
  // phases — e.g. when a wave-clear modal appears or the player
  // quits to the main menu. This avoids an orphan panel hanging
  // around behind a modal.
  useEffect(() => {
    if (!shouldRenderControlsOverlay(phase)) {
      setOpen(false);
    }
  }, [phase]);

  const handleClose = useCallback((): void => {
    setOpen(false);
  }, []);

  const handlePanelClick = useCallback((event: MouseEvent<HTMLDivElement>): void => {
    // Swallow panel clicks so the backdrop click handler never fires.
    event.stopPropagation();
  }, []);

  if (!shouldRenderControlsOverlay(phase)) return null;
  if (!open) return null;

  return <ControlsOverlayPanel onClose={handleClose} onPanelClick={handlePanelClick} />;
}
