/**
 * WeaponHeatBar — player weapon overheat HUD readout (segmented).
 *
 * Post playtest 2026-04-11: renders as a row of N discrete vertical
 * blocks (see `docs/art-direction/index.html` → `.ammo-slot` pattern)
 * instead of a continuous fill. Blocks fill from left to right as the
 * player's weapon heat (`player.weapons.heat` ∈ `[0, 1]`) accumulates.
 * Color bracket still shifts between teal / gold / red at 0.5 and 0.75,
 * and the label flips from `HEAT` to `OVERHEATED` (red, pulsing) when
 * heat > 0.9.
 *
 * The component is a pure readout — `pointer-events: none`, `aria-hidden`,
 * no interactive state. All state derivation lives in
 * `./weaponHeatBar.helpers.ts` so the mapping is unit-testable without a
 * renderer. All colors, fonts, and motion values come from `./tokens`.
 */

import { useGamePhase, usePlayerWeaponHeat } from '../store/selectors';
import {
  buildContainerStyle,
  buildLabelStyle,
  buildSegmentStyle,
  buildTrackStyle,
  computeHeatBarState,
  HEAT_SEGMENT_COUNT,
  OVERHEAT_PULSE_CLASS,
  weaponHeatBarKeyframes,
} from './weaponHeatBar.helpers';

export function WeaponHeatBar() {
  const phase = useGamePhase();
  const heat = usePlayerWeaponHeat();

  // Self-gate on phase — the heat bar is a gameplay readout and has no
  // meaning outside the active mission. The HUD root also phase-gates,
  // but keeping this guard here makes the component safe to mount
  // anywhere in the tree (including in tests).
  if (phase !== 'playing' && phase !== 'wave-clear' && phase !== 'paused') {
    return null;
  }

  const state = computeHeatBarState(heat);

  const containerStyle = buildContainerStyle();
  const labelStyle = buildLabelStyle(state.isOverheated);
  const trackStyle = buildTrackStyle();

  return (
    <div
      style={containerStyle}
      data-testid="weapon-heat-bar"
      data-heat-bracket={state.heatBracket}
      data-overheated={state.isOverheated ? 'on' : 'off'}
      data-filled-segments={String(state.filledSegments)}
      aria-hidden="true"
    >
      <style>{weaponHeatBarKeyframes()}</style>

      <div
        style={labelStyle}
        data-testid="weapon-heat-bar-label"
        className={state.isOverheated ? OVERHEAT_PULSE_CLASS : undefined}
      >
        {state.labelText}
      </div>

      <div style={trackStyle} data-testid="weapon-heat-bar-track">
        {Array.from({ length: HEAT_SEGMENT_COUNT }, (_, i) => {
          const filled = i < state.filledSegments;
          return (
            <div
              key={i}
              style={buildSegmentStyle({ filled, gradient: state.gradientCss })}
              data-testid="weapon-heat-bar-segment"
              data-segment-index={String(i)}
              data-segment-filled={filled ? 'on' : 'off'}
            />
          );
        })}
      </div>
    </div>
  );
}
