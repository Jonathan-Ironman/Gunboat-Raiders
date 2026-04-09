import { useWaveNumber, useEnemiesRemaining } from '../store/selectors';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1.5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  textAlign: 'center',
  userSelect: 'none',
};

const waveStyle: React.CSSProperties = {
  fontFamily: "'Black Ops One', cursive",
  fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
  color: '#e2e8f0',
  textShadow: '0 0 16px rgba(245, 158, 11, 0.5), 0 2px 8px rgba(0, 0, 0, 0.7)',
  margin: 0,
  letterSpacing: '0.08em',
};

const remainingStyle: React.CSSProperties = {
  fontFamily: "'Rajdhani', sans-serif",
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#94a3b8',
  letterSpacing: '0.1em',
  marginTop: '2px',
};

export function WaveCounter() {
  const wave = useWaveNumber();
  const remaining = useEnemiesRemaining();

  if (wave <= 0) return null;

  return (
    <div style={containerStyle} data-testid="wave-counter">
      <p style={waveStyle}>WAVE {wave}</p>
      {remaining > 0 && <p style={remainingStyle}>{remaining} REMAINING</p>}
    </div>
  );
}
