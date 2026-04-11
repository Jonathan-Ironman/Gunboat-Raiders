import { useScore } from '../store/selectors';
import {
  formatScore,
  scoreDisplayContainerStyle,
  scoreDisplayLabelStyle,
  scoreDisplayValueStyle,
} from './ScoreDisplay.styles';

/**
 * ScoreDisplay HUD element.
 *
 * Top-right anchored readout showing the player's current score. Follows the
 * Harbour Dawn `.score-disp` pattern: a small muted "SCORE" label above a
 * large gold numeric value. Score is motivational, so gold (the brand
 * energy accent) is the correct visual weight.
 *
 * Style tokens and pure helpers live in `ScoreDisplay.styles.ts`.
 */
export function ScoreDisplay() {
  const score = useScore();

  return (
    <div style={scoreDisplayContainerStyle} data-testid="score-display">
      <p style={scoreDisplayLabelStyle}>SCORE</p>
      <p style={scoreDisplayValueStyle}>{formatScore(score)}</p>
    </div>
  );
}
