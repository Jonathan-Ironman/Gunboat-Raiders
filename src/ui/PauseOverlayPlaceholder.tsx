/**
 * PauseOverlayPlaceholder — temporary pause-state overlay shipped with R4.
 *
 * This is the minimal visible proof that pause-on-pointer-lock-loss is
 * working end-to-end. It mounts whenever `phase === 'paused'`, darkens
 * the viewport, and clicking anywhere on it both re-requests pointer
 * lock on the `<canvas>` and calls `resumeGame()` in the same user
 * gesture (pointer lock can only be acquired inside a user-triggered
 * event handler, so this single click has to do both things).
 *
 * R5 will replace this with a full `PauseMenu` (Continue / Settings /
 * Exit) but the phase wiring, physics pause, and system short-circuits
 * from R4 stay intact — R5 just swaps out the rendering.
 */

import { useGamePhase } from '../store/selectors';
import { useGameStore } from '../store/gameStore';

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 30,
  background: 'rgba(7, 17, 32, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'auto',
  cursor: 'pointer',
  // Placeholder-only typography. R5 will replace this whole component
  // with proper tokens-based styling.
  fontFamily: 'sans-serif',
  color: '#ffffff',
  fontSize: '24px',
  userSelect: 'none',
};

const labelStyle: React.CSSProperties = {
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

/**
 * Atomically re-acquire pointer lock and resume the game. Both actions
 * MUST fire inside this click handler so the browser recognises the
 * pointer-lock request as user-triggered — calling `requestPointerLock`
 * from a stale promise or a setTimeout silently fails with a security
 * error.
 */
function handleResumeClick(): void {
  const canvas = document.querySelector('canvas');
  if (canvas !== null) {
    // `requestPointerLock` returns a promise in modern browsers; we
    // intentionally discard it — failures surface as a console warning
    // from the browser and we don't want to block the resume on them.
    void canvas.requestPointerLock();
  }
  useGameStore.getState().resumeGame();
}

export function PauseOverlayPlaceholder() {
  const phase = useGamePhase();
  if (phase !== 'paused') return null;

  return (
    <div
      style={overlayStyle}
      onClick={handleResumeClick}
      data-testid="pause-overlay-placeholder"
      role="button"
      aria-label="Paused — click to resume"
    >
      <div style={labelStyle}>[PAUSED — click to resume]</div>
    </div>
  );
}
