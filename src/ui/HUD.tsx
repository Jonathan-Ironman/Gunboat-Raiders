import { useGamePhase } from '../store/selectors';
import { HealthBar } from './HealthBar';
import { WaveCounter } from './WaveCounter';
import { ScoreDisplay } from './ScoreDisplay';
import { PauseOverlayPlaceholder } from './PauseOverlayPlaceholder';

const hudStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 10,
  overflow: 'hidden',
};

export function HUD() {
  const phase = useGamePhase();

  // R4: `'paused'` is now included in the gate so the PauseOverlayPlaceholder
  // can render. The individual HUD children (HealthBar etc.) keep rendering
  // underneath the semi-transparent pause overlay, which is the intended
  // Harbour Dawn look per the UI spec.
  if (phase !== 'playing' && phase !== 'wave-clear' && phase !== 'paused') return null;

  return (
    <div style={hudStyle} data-testid="hud">
      <HealthBar />
      <WaveCounter />
      <ScoreDisplay />
      <PauseOverlayPlaceholder />
    </div>
  );
}
