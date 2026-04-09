import { useActiveQuadrant } from '../store/selectors';
import type { FiringQuadrant } from '../store/gameStore';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80px',
  height: '80px',
  userSelect: 'none',
};

interface SegmentProps {
  quadrant: FiringQuadrant;
  label: string;
  active: boolean;
  style: React.CSSProperties;
}

const ACTIVE_COLOR = '#f59e0b';
const INACTIVE_COLOR = 'rgba(148, 163, 184, 0.25)';

function segmentStyle(active: boolean, extra: React.CSSProperties): React.CSSProperties {
  return {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    fontSize: active ? '0.85rem' : '0.75rem',
    color: active ? ACTIVE_COLOR : '#94a3b8',
    textShadow: active ? `0 0 12px ${ACTIVE_COLOR}80` : 'none',
    transition: 'all 0.15s ease',
    opacity: active ? 1 : 0.4,
    ...extra,
  };
}

/** Diamond/rhombus shape for each segment. */
function diamondStyle(active: boolean): React.CSSProperties {
  return {
    width: active ? '18px' : '14px',
    height: active ? '18px' : '14px',
    background: active ? ACTIVE_COLOR : INACTIVE_COLOR,
    transform: 'rotate(45deg)',
    boxShadow: active ? `0 0 10px ${ACTIVE_COLOR}60` : 'none',
    transition: 'all 0.15s ease',
    borderRadius: '2px',
  };
}

function Segment({ label, active, style: posStyle }: SegmentProps) {
  return (
    <div style={segmentStyle(active, posStyle)} data-testid={`quadrant-${label.toLowerCase()}`}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        <div style={diamondStyle(active)} />
        <span style={{ fontSize: '0.6rem', letterSpacing: '0.1em' }}>{label}</span>
      </div>
    </div>
  );
}

const SEGMENTS: Array<{
  quadrant: FiringQuadrant;
  label: string;
  position: React.CSSProperties;
}> = [
  {
    quadrant: 'fore',
    label: 'F',
    position: { top: 0, left: '50%', transform: 'translateX(-50%)' },
  },
  {
    quadrant: 'aft',
    label: 'A',
    position: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
  },
  {
    quadrant: 'port',
    label: 'P',
    position: { left: 0, top: '50%', transform: 'translateY(-50%)' },
  },
  {
    quadrant: 'starboard',
    label: 'S',
    position: { right: 0, top: '50%', transform: 'translateY(-50%)' },
  },
];

export function QuadrantIndicator() {
  const active = useActiveQuadrant();

  return (
    <div style={containerStyle} data-testid="quadrant-indicator">
      {SEGMENTS.map((seg) => (
        <Segment
          key={seg.quadrant}
          quadrant={seg.quadrant}
          label={seg.label}
          active={active === seg.quadrant}
          style={seg.position}
        />
      ))}
    </div>
  );
}
