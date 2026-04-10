import { useGamePhase } from '../store/selectors';
import { HealthBar } from './HealthBar';
import { WaveCounter } from './WaveCounter';
import { ScoreDisplay } from './ScoreDisplay';
import { QuadrantIndicator } from './QuadrantIndicator';
import { Crosshair } from './Crosshair';
import { PointerLockHint } from './PointerLockHint';

const hudStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 10,
  overflow: 'hidden',
};

export function HUD() {
  const phase = useGamePhase();

  if (phase !== 'playing' && phase !== 'wave-clear') return null;

  return (
    <div style={hudStyle} data-testid="hud">
      <HealthBar />
      <WaveCounter />
      <ScoreDisplay />
      <QuadrantIndicator />
      <Crosshair />
      <PointerLockHint />
    </div>
  );
}
