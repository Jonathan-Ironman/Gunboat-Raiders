import { useGamePhase } from '../store/selectors';
import { useGameStore } from '../store/gameStore';

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(5, 10, 20, 0.75)',
  backdropFilter: 'blur(4px)',
  fontFamily: "'Rajdhani', sans-serif",
  color: '#e2e8f0',
  userSelect: 'none',
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Black Ops One', cursive",
  fontSize: 'clamp(2.5rem, 7vw, 5rem)',
  letterSpacing: '0.08em',
  textShadow: '0 0 30px rgba(245, 158, 11, 0.6), 0 4px 12px rgba(0, 0, 0, 0.8)',
  color: '#e2e8f0',
  margin: 0,
  lineHeight: 1.1,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 'clamp(1rem, 2.5vw, 1.4rem)',
  fontWeight: 500,
  color: '#94a3b8',
  marginTop: '0.75rem',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
};

const buttonStyle: React.CSSProperties = {
  marginTop: '3rem',
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

function handleStart() {
  // Use startGame() for an atomic transition: single set() call avoids an
  // intermediate phase='mainMenu' render that would unmount game entities.
  useGameStore.getState().startGame();
}

export function TitleScreen() {
  const phase = useGamePhase();
  if (phase !== 'mainMenu') return null;

  return (
    <div style={overlayStyle} data-testid="title-screen">
      <h1 style={titleStyle}>GUNBOAT RAIDERS</h1>
      <p style={subtitleStyle}>Survive the waves. Sink the rest.</p>
      <button
        style={buttonStyle}
        onClick={handleStart}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow =
            '0 0 30px rgba(245, 158, 11, 0.6), 0 6px 16px rgba(0, 0, 0, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow =
            '0 0 20px rgba(245, 158, 11, 0.4), 0 4px 12px rgba(0, 0, 0, 0.5)';
        }}
        data-testid="start-button"
      >
        START GAME
      </button>
    </div>
  );
}
