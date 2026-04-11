import { useGamePhase, useScore, useWaveNumber, useEnemiesSunkTotal } from '../store/selectors';
import { useGameStore } from '../store/gameStore';

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(30, 5, 5, 0.8)',
  backdropFilter: 'blur(8px)',
  fontFamily: "'Rajdhani', sans-serif",
  color: '#e2e8f0',
  userSelect: 'none',
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Black Ops One', cursive",
  fontSize: 'clamp(3rem, 10vw, 7rem)',
  letterSpacing: '0.1em',
  textShadow: '0 0 40px rgba(220, 38, 38, 0.7), 0 4px 16px rgba(0, 0, 0, 0.9)',
  color: '#ef4444',
  margin: 0,
  lineHeight: 1,
};

const statsContainerStyle: React.CSSProperties = {
  marginTop: '2rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const statStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  color: '#94a3b8',
};

const statValueStyle: React.CSSProperties = {
  color: '#e2e8f0',
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700,
};

const buttonStyle: React.CSSProperties = {
  marginTop: '2.5rem',
  padding: '0.9rem 3rem',
  fontSize: '1.3rem',
  fontFamily: "'Black Ops One', cursive",
  fontWeight: 400,
  letterSpacing: '0.12em',
  color: '#0d1e35',
  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  boxShadow: '0 0 20px rgba(245, 158, 11, 0.4), 0 4px 12px rgba(0, 0, 0, 0.5)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  pointerEvents: 'auto',
};

function formatScore(value: number): string {
  return value.toLocaleString('en-US');
}

function handlePlayAgain() {
  // Use startGame() for an atomic transition: single set() call avoids an
  // intermediate phase='mainMenu' render that would unmount game entities.
  useGameStore.getState().startGame();
}

export function GameOverScreen() {
  const phase = useGamePhase();
  const score = useScore();
  const wave = useWaveNumber();
  const enemiesSunk = useEnemiesSunkTotal();

  if (phase !== 'game-over') return null;

  return (
    <div style={overlayStyle} data-testid="game-over-screen">
      <h1 style={titleStyle}>SUNK</h1>
      <div style={statsContainerStyle}>
        <p style={statStyle}>
          Waves Survived: <span style={statValueStyle}>{wave}</span>
        </p>
        <p style={statStyle}>
          Enemies Sunk: <span style={statValueStyle}>{enemiesSunk}</span>
        </p>
        <p style={statStyle}>
          Final Score: <span style={statValueStyle}>{formatScore(score)}</span>
        </p>
      </div>
      <button
        style={buttonStyle}
        onClick={handlePlayAgain}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        data-testid="play-again-button"
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
