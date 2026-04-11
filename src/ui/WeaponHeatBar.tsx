/**
 * WeaponHeatBar — player weapon overheat HUD readout.
 *
 * Slice R13 of the Gunboat Raiders UI overhaul. Visualizes the player's
 * weapon heat (`player.weapons.heat` in `[0, 1]`) as a centered, inverted
 * progress bar that drains as heat builds. Color brackets shift between
 * teal / gold / red at `0.5` and `0.75`, and the label flips from `HEAT`
 * to `OVERHEATED` (in red, pulsing) when heat exceeds `0.9`.
 *
 * The component is a pure readout — `pointer-events: none`, `aria-hidden`,
 * no interactive state. All state derivation lives in
 * `./weaponHeatBar.helpers.ts` so the mapping is unit-testable without a
 * renderer. All colors, fonts, and motion values come from `./tokens`.
 *
 * This slice intentionally does NOT mount itself in the HUD — the R19
 * HUD composition cleanup owns phase gating and placement. The component
 * still self-gates on phase for safety and so standalone mounting works
 * correctly during tests.
 */

import { useGamePhase, usePlayerWeaponHeat } from '../store/selectors';
import {
  buildContainerStyle,
  buildFillStyle,
  buildLabelStyle,
  buildTrackStyle,
  computeHeatBarState,
  OVERHEAT_PULSE_CLASS,
  weaponHeatBarKeyframes,
} from './weaponHeatBar.helpers';

export function WeaponHeatBar() {
  const phase = useGamePhase();
  const heat = usePlayerWeaponHeat();

  // Self-gate on phase — the heat bar is a gameplay readout and has no
  // meaning outside the active mission. R19 will also phase-gate the
  // whole HUD, but keeping this guard here makes the component safe to
  // mount anywhere in the tree.
  if (phase !== 'playing' && phase !== 'wave-clear' && phase !== 'paused') {
    return null;
  }

  const state = computeHeatBarState(heat);

  const containerStyle = buildContainerStyle();
  const labelStyle = buildLabelStyle(state.isOverheated);
  const trackStyle = buildTrackStyle();
  const fillStyle = buildFillStyle(state);

  return (
    <div
      style={containerStyle}
      data-testid="weapon-heat-bar"
      data-heat-bracket={state.heatBracket}
      data-overheated={state.isOverheated ? 'on' : 'off'}
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
        <div style={fillStyle} data-testid="weapon-heat-bar-fill" />
      </div>
    </div>
  );
}
