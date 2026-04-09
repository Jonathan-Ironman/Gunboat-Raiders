import { usePlayerHealth } from '../store/selectors';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '2rem',
  left: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 600,
  fontSize: '0.75rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  userSelect: 'none',
};

const barOuterStyle: React.CSSProperties = {
  width: '200px',
  height: '14px',
  background: 'rgba(10, 15, 25, 0.6)',
  borderRadius: '2px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  overflow: 'hidden',
  position: 'relative',
};

const labelStyle: React.CSSProperties = {
  color: '#94a3b8',
  marginBottom: '2px',
  display: 'flex',
  justifyContent: 'space-between',
  width: '200px',
};

function barFillStyle(color: string, pct: number): React.CSSProperties {
  return {
    width: `${String(pct)}%`,
    height: '100%',
    background: color,
    transition: 'width 0.3s ease-out',
    boxShadow: `0 0 8px ${color}60`,
  };
}

export function HealthBar() {
  const health = usePlayerHealth();
  if (!health) return null;

  const armorPct = (health.armor / health.armorMax) * 100;
  const hullPct = (health.hull / health.hullMax) * 100;
  const hullColor = hullPct <= 30 ? '#ef4444' : '#f97316';

  return (
    <div style={containerStyle} data-testid="health-bar">
      <div>
        <div style={labelStyle}>
          <span style={{ color: '#0695b4' }}>ARMOR</span>
          <span style={{ color: '#e2e8f0' }}>
            {health.armor}/{health.armorMax}
          </span>
        </div>
        <div style={barOuterStyle}>
          <div style={barFillStyle('#0695b4', armorPct)} />
        </div>
      </div>
      <div>
        <div style={labelStyle}>
          <span style={{ color: hullColor }}>HULL</span>
          <span style={{ color: '#e2e8f0' }}>
            {health.hull}/{health.hullMax}
          </span>
        </div>
        <div style={barOuterStyle}>
          <div style={barFillStyle(hullColor, hullPct)} />
        </div>
      </div>
    </div>
  );
}
