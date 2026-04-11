import { useWaveNumber } from '../store/selectors';
import {
  formatWaveLabel,
  shouldRenderWaveCounter,
  waveCounterContainerStyle,
  waveCounterTextStyle,
} from './WaveCounter.styles';

/**
 * Wave counter HUD element.
 *
 * Displays the current wave as `WAVE {n}` centred near the top of the HUD.
 * The enemies-remaining readout lives in its own component
 * (`EnemiesRemainingCounter`) so that WaveCounter has a single concern.
 *
 * Visibility: hidden (returns `null`) while `wave <= 0` — i.e. before the
 * first wave has started. This matches the legacy HUD behaviour.
 *
 * Style tokens and pure helpers live in `WaveCounter.styles.ts`.
 */
export function WaveCounter() {
  const wave = useWaveNumber();

  if (!shouldRenderWaveCounter(wave)) return null;

  return (
    <div style={waveCounterContainerStyle} data-testid="wave-counter">
      <p style={waveCounterTextStyle}>{formatWaveLabel(wave)}</p>
    </div>
  );
}
