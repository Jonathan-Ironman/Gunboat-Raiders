import { useEnemiesRemaining } from '../store/selectors';
import {
  enemiesRemainingContainerStyle,
  enemiesRemainingTextStyle,
  formatEnemiesRemaining,
  getEnemiesRemainingOpacity,
} from './EnemiesRemainingCounter.styles';

/**
 * EnemiesRemainingCounter HUD element.
 *
 * A small secondary readout positioned directly below the WaveCounter
 * showing how many enemies are still alive in the current wave. Rendered
 * as a separate component (rather than inside WaveCounter) so that each
 * HUD element has a single concern.
 *
 * Visibility: the element is always mounted during play, but its opacity
 * animates to 0 when `enemiesRemaining === 0` (wave-clear). Keeping the
 * element mounted prevents layout shift when the count hits zero and
 * provides a smooth fade instead of a hard unmount.
 *
 * Style tokens and pure helpers live in `EnemiesRemainingCounter.styles.ts`.
 */
export function EnemiesRemainingCounter() {
  const remaining = useEnemiesRemaining();
  const opacity = getEnemiesRemainingOpacity(remaining);

  return (
    <div style={{ ...enemiesRemainingContainerStyle, opacity }} data-testid="enemies-remaining">
      <p style={enemiesRemainingTextStyle}>{formatEnemiesRemaining(remaining)}</p>
    </div>
  );
}
