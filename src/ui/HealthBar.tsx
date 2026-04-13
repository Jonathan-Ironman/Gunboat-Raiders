/**
 * HealthBar — player armor + hull HUD component.
 *
 * Visual spec: Harbour Dawn (see `docs/art-direction/index.html`, the
 * `.health-wrap` / `.health-track` / `.health-fill` pattern) adapted for
 * Gunboat Raiders' dual-bar (armor + hull) model with per-bar color
 * families:
 *
 * - Hull: green/teal → gold → red (HULL_*_GRADIENT recipes)
 * - Armor: blue → purple → red (ARMOR_*_GRADIENT recipes)
 *
 * Both bars share the same three-state ramp: `full` above 60%, `damaged`
 * between 30% and 60%, `critical` at or below 30%. Thresholds live in
 * exported constants so unit tests and any future damage-vignette can
 * reference the same numbers.
 *
 * Layout (post playtest 2026-04-11): HUD bars are stacked bottom-left with
 * hull at the bottom, then armor, then heat bar above. The HealthBar
 * anchors itself at a fixed `bottom` offset so HUD.tsx does not need to
 * know about sibling heights.
 *
 * Design lock (R11): player armor slowly auto-regenerates at
 * `armorRegenRate` points/sec while the boat is alive. The hull does NOT
 * regenerate. Whenever armor is below max AND the boat is not sinking, a
 * slow horizontal shimmer animates across the armor fill to communicate
 * "armor is repairing itself". Hull never shimmers; only the critical
 * pulse + red outline from the original Slice 4 spec remain for hull.
 *
 * Number readouts (`52 / 100`) were removed after the 2026-04-11 playtest
 * — the bars alone are the single source of health information.
 *
 * All colors, fonts, spacing, motion values MUST come from `./tokens`.
 * No hardcoded hex literals are permitted in this file.
 */

import { useGameStore } from '../store/gameStore';
import { usePlayerHealth } from '../store/selectors';
import { ARMOR_SHIMMER_CLASS, computeHealthBarState, HULL_PULSE_CLASS } from './HealthBar.helpers';
import {
  BG_DEEP,
  BORDER_SUB,
  DUR_NORMAL,
  EASE_OUT,
  FONT_UI,
  RED,
  SP_1,
  SP_2,
  TEXT_MUTED,
} from './tokens';

/**
 * Keyframes + classes scoped to HealthBar. Injected once via a `<style>`
 * element inside the component subtree so this file stays self-contained
 * (the R11 slice explicitly forbids touching HUD.tsx or other files).
 */
const KEYFRAMES_CSS = `
@keyframes gbr-armor-shimmer-kf {
  0%   { background-position: 0% 50%, 0 0; }
  100% { background-position: 200% 50%, 0 0; }
}
@keyframes gbr-hull-pulse-kf {
  from { opacity: 0.6; }
  to   { opacity: 1; }
}
.${ARMOR_SHIMMER_CLASS} {
  background-size: 200% 100%, 100% 100%;
  animation: gbr-armor-shimmer-kf 2s linear infinite;
}
.${HULL_PULSE_CLASS} {
  animation: gbr-hull-pulse-kf 0.5s ease-in-out infinite alternate;
}
`;

// ---------------------------------------------------------------------------
// Static style objects (derived from tokens, no runtime branching).
// ---------------------------------------------------------------------------

const BAR_WIDTH_PX = 200;
const BAR_HEIGHT_PX = 14;
const BAR_RADIUS_PX = 7;
const FILL_RADIUS_PX = 6;
const LABEL_FONT_SIZE_PX = 10;
const LABEL_LETTER_SPACING_EM = 0.08;
const ROW_GAP_PX = SP_1;
const STACK_GAP_PX = SP_2;
/**
 * Bottom offset of the HealthBar container. The stack is anchored to the
 * bottom-left of the viewport at `bottom: 2rem`; the heat bar sits above
 * this stack with a gap (see `BAR_BOTTOM_CSS` in weaponHeatBar.helpers.ts).
 */
const CONTAINER_BOTTOM_REM = 2;
const CONTAINER_LEFT_REM = 2;

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: `${String(CONTAINER_BOTTOM_REM)}rem`,
  left: `${String(CONTAINER_LEFT_REM)}rem`,
  display: 'flex',
  flexDirection: 'column',
  gap: `${String(STACK_GAP_PX)}px`,
  width: `${String(BAR_WIDTH_PX)}px`,
  fontFamily: FONT_UI,
  userSelect: 'none',
  pointerEvents: 'none',
};

const labelStyle: React.CSSProperties = {
  color: TEXT_MUTED,
  fontFamily: FONT_UI,
  fontSize: `${String(LABEL_FONT_SIZE_PX)}px`,
  fontWeight: 800,
  letterSpacing: `${String(LABEL_LETTER_SPACING_EM)}em`,
  textTransform: 'uppercase',
  marginBottom: `${String(ROW_GAP_PX)}px`,
};

const trackBaseStyle: React.CSSProperties = {
  position: 'relative',
  width: `${String(BAR_WIDTH_PX)}px`,
  height: `${String(BAR_HEIGHT_PX)}px`,
  background: BG_DEEP,
  borderRadius: `${String(BAR_RADIUS_PX)}px`,
  border: `1px solid ${BORDER_SUB}`,
  overflow: 'hidden',
};

// Outline for the critical hull track. Uses token `RED` literally so we
// avoid hardcoding a second red hex.
const hullOutlineStyle: React.CSSProperties = {
  outline: `2px solid ${RED}`,
  outlineOffset: '1px',
};

/**
 * Builds the inline style for a health fill div. Keeps the transition
 * and gradient composition in one place.
 *
 * When `shimmer` is true, the background is layered: the gradient on top
 * (semi-transparent highlight band) and the solid health gradient below,
 * so animating `background-position` slides the highlight across the bar.
 */
function buildFillStyle(args: {
  pct: number;
  gradient: string;
  shimmer: boolean;
}): React.CSSProperties {
  const { pct, gradient, shimmer } = args;

  // Shimmer layer: a 25%-wide translucent white band that slides across
  // the base gradient. Colors are intentionally rgba (no brand hex needed)
  // and only the width/velocity are tunable via `KEYFRAMES_CSS`.
  const shimmerLayer =
    'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 100%)';

  return {
    width: `${String(pct)}%`,
    height: '100%',
    borderRadius: `${String(FILL_RADIUS_PX)}px`,
    background: shimmer ? `${shimmerLayer}, ${gradient}` : gradient,
    transition: `width ${String(DUR_NORMAL)}ms ${EASE_OUT}`,
    willChange: shimmer ? 'background-position' : undefined,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Player armor + hull HUD. Reads live state via selectors (event-driven,
 * not every-frame — re-rendering on health changes is cheap and correct
 * here).
 */
export function HealthBar() {
  const health = usePlayerHealth();
  const isSinking = useGameStore((s) => s.player?.isSinking ?? false);

  if (!health) return null;

  const state = computeHealthBarState({
    armor: health.armor,
    armorMax: health.armorMax,
    hull: health.hull,
    hullMax: health.hullMax,
    isSinking,
  });

  const armorFillStyle = buildFillStyle({
    pct: state.armorPct,
    gradient: state.armorFillGradient,
    shimmer: state.armorShimmerActive,
  });

  const hullFillStyle = buildFillStyle({
    pct: state.hullPct,
    gradient: state.hullFillGradient,
    shimmer: false,
  });

  const hullTrackStyle: React.CSSProperties = state.hullOutlineActive
    ? { ...trackBaseStyle, ...hullOutlineStyle }
    : trackBaseStyle;

  return (
    <div
      style={containerStyle}
      data-testid="health-bar"
      data-armor-state={state.armorState}
      data-hull-state={state.hullState}
      data-armor-shimmer={state.armorShimmerActive ? 'on' : 'off'}
      data-hull-pulse={state.hullPulseActive ? 'on' : 'off'}
    >
      <style>{KEYFRAMES_CSS}</style>

      {/* Armor */}
      <div data-testid="health-bar-armor">
        <div style={labelStyle}>ARMOR</div>
        <div style={trackBaseStyle} data-testid="health-bar-armor-track">
          <div
            style={armorFillStyle}
            data-testid="health-bar-armor-fill"
            className={state.armorShimmerActive ? ARMOR_SHIMMER_CLASS : undefined}
          />
        </div>
      </div>

      {/* Hull */}
      <div data-testid="health-bar-hull">
        <div style={labelStyle}>HULL</div>
        <div style={hullTrackStyle} data-testid="health-bar-hull-track">
          <div
            style={hullFillStyle}
            data-testid="health-bar-hull-fill"
            className={state.hullPulseActive ? HULL_PULSE_CLASS : undefined}
          />
        </div>
      </div>
    </div>
  );
}
