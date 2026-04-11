import { useGamePhase } from '../store/selectors';
import { HealthBar } from './HealthBar';
import { WaveCounter } from './WaveCounter';
import { ScoreDisplay } from './ScoreDisplay';
import { EnemiesRemainingCounter } from './EnemiesRemainingCounter';
import { WeaponHeatBar } from './WeaponHeatBar';
import { LowHullWarning } from './LowHullWarning';
import { WaveAnnouncement } from './WaveAnnouncement';
import { ControlsOverlay } from './ControlsOverlay';
import { PauseMenu } from './PauseMenu';

const hudStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 10,
  overflow: 'hidden',
};

/**
 * HUD — composition root for every in-game UI surface.
 *
 * Mounted once by `App.tsx` as a sibling of the R3F canvas. The HUD is
 * phase-gated at the root: it unmounts entirely outside of active
 * gameplay (`mainMenu`, `briefing`, `game-over`), so MainMenuScene,
 * LevelBriefingModal, and GameOverScreen own their own full-screen
 * layouts without any HUD chrome bleeding through.
 *
 * Every child self-gates on its own phase/state so the order here is
 * purely for DOM stacking. The list below is intentionally ordered
 * back-to-front:
 *
 *   1. HealthBar               — top-left readout
 *   2. WaveCounter             — top-right readout
 *   3. ScoreDisplay            — below WaveCounter
 *   4. EnemiesRemainingCounter — below WaveCounter / ScoreDisplay
 *   5. WeaponHeatBar           — bottom-center readout
 *   6. LowHullWarning          — full-viewport danger vignette
 *   7. WaveAnnouncement        — full-viewport wave-clear overlay
 *   8. ControlsOverlay         — side help panel (H / ?)
 *   9. PauseMenu               — full-viewport pause overlay (topmost)
 *
 * The PauseMenu is rendered last so its backdrop stacks above every
 * other HUD child when `phase === 'paused'`. Individual HUD readouts
 * remain visible underneath the pause overlay — this is the intended
 * Harbour Dawn look per the UI spec.
 */
export function HUD() {
  const phase = useGamePhase();

  if (phase !== 'playing' && phase !== 'wave-clear' && phase !== 'paused') return null;

  return (
    <div style={hudStyle} data-testid="hud">
      <HealthBar />
      <WaveCounter />
      <ScoreDisplay />
      <EnemiesRemainingCounter />
      <WeaponHeatBar />
      <LowHullWarning />
      <WaveAnnouncement />
      <ControlsOverlay />
      <PauseMenu />
    </div>
  );
}
