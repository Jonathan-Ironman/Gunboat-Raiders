import { useScore } from '../store/selectors';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1.5rem',
  right: '2rem',
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700,
  fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
  color: '#e2e8f0',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.7)',
  letterSpacing: '0.05em',
  fontVariantNumeric: 'tabular-nums',
  userSelect: 'none',
};

function formatScore(value: number): string {
  return value.toLocaleString('en-US');
}

export function ScoreDisplay() {
  const score = useScore();

  return (
    <div style={containerStyle} data-testid="score-display">
      {formatScore(score)}
    </div>
  );
}
