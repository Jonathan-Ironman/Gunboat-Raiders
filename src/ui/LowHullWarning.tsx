/**
 * LowHullWarning — full-viewport danger vignette.
 *
 * Shown over the gameplay scene when the player's hull drops below the
 * Harbour Dawn critical threshold (`HULL_CRITICAL_THRESHOLD`, currently 30%).
 * A radial-gradient vignette fades in from the edges of the screen and
 * pulses on a token-driven interval to communicate imminent destruction.
 * Intensity scales with how deep into the critical band the hull is, so
 * a barely-critical hull (~29%) produces a subtle edge glow and a near-
 * death hull (~5%) produces a strong, saturated pulse.
 *
 * The overlay is purely cosmetic — `pointer-events: none`, no DOM footprint
 * inside the HUD flow. It self-gates on game phase and player-health
 * presence, so it is safe to mount anywhere in the tree (and remains
 * correct even if a future HUD layout moves it).
 *
 * All colors, thresholds, and motion values flow through `tokens.ts`.
 * The thresholding / styling logic lives in `lowHullWarning.helpers.ts`
 * so it can be unit-tested without React.
 */

import { useGamePhase, usePlayerHealth } from '../store/selectors';
import {
  computeLowHullIntensity,
  lowHullKeyframes,
  lowHullOverlayStyle,
  shouldShowLowHullWarning,
} from './lowHullWarning.helpers';

export function LowHullWarning() {
  const phase = useGamePhase();
  const health = usePlayerHealth();

  // Self-gate — the warning only makes sense while the player is actively
  // playing. Wave-clear is still in-game so we keep the vignette visible
  // until the next wave starts. Title / game-over suppress it entirely.
  if (phase !== 'playing' && phase !== 'wave-clear') return null;
  if (!health) return null;
  if (!shouldShowLowHullWarning(health.hull, health.hullMax)) return null;

  const intensity = computeLowHullIntensity(health.hull, health.hullMax);

  return (
    <>
      <style>{lowHullKeyframes()}</style>
      <div
        style={lowHullOverlayStyle(intensity)}
        data-testid="low-hull-warning"
        aria-hidden="true"
      />
    </>
  );
}
