/**
 * Pointer-lock prompt overlay.
 *
 * Shown while the game is playing but the canvas has not yet acquired
 * pointer lock. Tells new players that they must click to start aiming
 * and firing — without this hint the first click silently requests
 * pointer lock and does not produce a shot, which is very confusing.
 *
 * The hint hides itself as soon as pointer lock is acquired and reappears
 * if lock is released (e.g. when the user presses Escape).
 */

import { useEffect, useState } from 'react';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '62%',
  left: '50%',
  transform: 'translate(-50%, 0)',
  padding: '14px 28px',
  background: 'rgba(15, 23, 42, 0.72)',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: '8px',
  color: '#f8fafc',
  fontFamily: "'Rajdhani', sans-serif",
  fontSize: '1.05rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.6)',
  pointerEvents: 'none',
  userSelect: 'none',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
  animation: 'pointer-lock-hint-pulse 2s ease-in-out infinite',
};

const keyframes = `
@keyframes pointer-lock-hint-pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
`;

export function PointerLockHint() {
  const [isLocked, setIsLocked] = useState<boolean>(
    typeof document !== 'undefined' && document.pointerLockElement !== null,
  );

  useEffect(() => {
    const handleChange = (): void => {
      setIsLocked(document.pointerLockElement !== null);
    };
    document.addEventListener('pointerlockchange', handleChange);
    // Sync once in case state changed between render and effect attach.
    handleChange();
    return () => {
      document.removeEventListener('pointerlockchange', handleChange);
    };
  }, []);

  if (isLocked) return null;

  return (
    <>
      <style>{keyframes}</style>
      <div style={containerStyle} data-testid="pointer-lock-hint">
        Click to aim and fire
      </div>
    </>
  );
}
