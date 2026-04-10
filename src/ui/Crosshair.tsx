/**
 * Centered crosshair overlay for aiming cannons.
 *
 * Rendered as part of the HUD while the game is playing. Purely decorative —
 * firing is still resolved by the active quadrant, not screen position.
 */

const CROSSHAIR_SIZE = 22;
const CROSSHAIR_THICKNESS = 2;
const CROSSHAIR_GAP = 6;
const CROSSHAIR_COLOR = 'rgba(248, 250, 252, 0.85)';
const CROSSHAIR_SHADOW = '0 0 4px rgba(0, 0, 0, 0.8)';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: `${String(CROSSHAIR_SIZE)}px`,
  height: `${String(CROSSHAIR_SIZE)}px`,
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
  userSelect: 'none',
};

const barBaseStyle: React.CSSProperties = {
  position: 'absolute',
  background: CROSSHAIR_COLOR,
  boxShadow: CROSSHAIR_SHADOW,
  borderRadius: '1px',
};

const horizontalLeftStyle: React.CSSProperties = {
  ...barBaseStyle,
  top: '50%',
  left: 0,
  width: `${String(CROSSHAIR_SIZE / 2 - CROSSHAIR_GAP)}px`,
  height: `${String(CROSSHAIR_THICKNESS)}px`,
  transform: 'translateY(-50%)',
};

const horizontalRightStyle: React.CSSProperties = {
  ...barBaseStyle,
  top: '50%',
  right: 0,
  width: `${String(CROSSHAIR_SIZE / 2 - CROSSHAIR_GAP)}px`,
  height: `${String(CROSSHAIR_THICKNESS)}px`,
  transform: 'translateY(-50%)',
};

const verticalTopStyle: React.CSSProperties = {
  ...barBaseStyle,
  left: '50%',
  top: 0,
  width: `${String(CROSSHAIR_THICKNESS)}px`,
  height: `${String(CROSSHAIR_SIZE / 2 - CROSSHAIR_GAP)}px`,
  transform: 'translateX(-50%)',
};

const verticalBottomStyle: React.CSSProperties = {
  ...barBaseStyle,
  left: '50%',
  bottom: 0,
  width: `${String(CROSSHAIR_THICKNESS)}px`,
  height: `${String(CROSSHAIR_SIZE / 2 - CROSSHAIR_GAP)}px`,
  transform: 'translateX(-50%)',
};

const centerDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '3px',
  height: '3px',
  background: CROSSHAIR_COLOR,
  borderRadius: '50%',
  transform: 'translate(-50%, -50%)',
  boxShadow: CROSSHAIR_SHADOW,
};

export function Crosshair() {
  return (
    <div style={containerStyle} data-testid="crosshair" aria-hidden="true">
      <div style={horizontalLeftStyle} />
      <div style={horizontalRightStyle} />
      <div style={verticalTopStyle} />
      <div style={verticalBottomStyle} />
      <div style={centerDotStyle} />
    </div>
  );
}
