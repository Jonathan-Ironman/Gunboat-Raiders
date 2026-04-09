import { Billboard, Html } from '@react-three/drei';
import type { HealthComponent } from '../store/gameStore';

interface EnemyHealthBarProps {
  health: HealthComponent;
}

const containerStyle: React.CSSProperties = {
  width: '60px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  pointerEvents: 'none',
  userSelect: 'none',
};

const barOuterStyle: React.CSSProperties = {
  width: '100%',
  height: '4px',
  background: 'rgba(0, 0, 0, 0.5)',
  borderRadius: '1px',
  overflow: 'hidden',
};

function barFillStyle(color: string, pct: number): React.CSSProperties {
  return {
    width: `${String(pct)}%`,
    height: '100%',
    background: color,
    transition: 'width 0.2s ease-out',
  };
}

export function EnemyHealthBar({ health }: EnemyHealthBarProps) {
  const armorPct = (health.armor / health.armorMax) * 100;
  const hullPct = (health.hull / health.hullMax) * 100;

  // Only show when enemy has taken damage
  const isFullHealth = health.armor >= health.armorMax && health.hull >= health.hullMax;
  if (isFullHealth) return null;

  return (
    <Billboard position={[0, 3, 0]} follow lockX={false} lockY={false} lockZ={false}>
      <Html center style={{ pointerEvents: 'none' }}>
        <div style={containerStyle}>
          {health.armorMax > 0 && (
            <div style={barOuterStyle}>
              <div style={barFillStyle('#0695b4', armorPct)} />
            </div>
          )}
          <div style={barOuterStyle}>
            <div style={barFillStyle(hullPct <= 30 ? '#ef4444' : '#f97316', hullPct)} />
          </div>
        </div>
      </Html>
    </Billboard>
  );
}
