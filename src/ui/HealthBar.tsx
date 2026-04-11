/**
 * HealthBar — player armor + hull HUD component.
 *
 * Visual spec: Harbour Dawn (see `docs/art-direction/index.html`, the
 * `.health-wrap` / `.health-track` / `.health-fill` pattern) adapted for
 * Gunboat Raiders' dual-bar (armor + hull) model.
 *
 * Design lock (R11): player armor slowly auto-regenerates at
 * `armorRegenRate` points/sec while the boat is alive. The hull does NOT
 * regenerate. Whenever armor is below max AND the boat is not sinking, a
 * slow horizontal shimmer animates across the armor fill to communicate
 * "armor is repairing itself". Hull never shimmers; only the critical
 * pulse + red outline from the original Slice 4 spec remain for hull.
 *
 * All colors, fonts, spacing, motion values MUST come from `./tokens`.
 * No hardcoded hex literals are permitted in this file.
 */

import { useGameStore } from '../store/gameStore';
import { usePlayerHealth } from '../store/selectors';
import {
  BG_DEEP,
  BORDER_SUB,
  DUR_NORMAL,
  EASE_OUT,
  FONT_UI,
  HEALTH_CRITICAL_GRADIENT,
  HEALTH_DAMAGED_GRADIENT,
  HEALTH_FULL_GRADIENT,
  HULL_CRITICAL_THRESHOLD,
  RED,
  TEXT_MUTED,
} from './tokens';

// ---------------------------------------------------------------------------
// Pure state derivation helpers — unit-testable without a renderer.
// ---------------------------------------------------------------------------

/** Armor bar visual states. Teal when full or mostly full; amber below 50%. */
export type ArmorState = 'full' | 'damaged';

/** Hull bar visual states. Teal > 60%; amber 30–60%; critical red ≤ 30%. */
export type HullState = 'full' | 'damaged' | 'critical';

/** Width below which the armor fill darkens to amber. */
export const ARMOR_DAMAGED_THRESHOLD = 0.5;

/** Width above which the hull stays teal. */
export const HULL_HEALTHY_THRESHOLD = 0.6;

/** Full shape of the health-bar visual state, derived from store fields. */
export interface HealthBarVisualState {
  armorPct: number; // 0..100
  hullPct: number; // 0..100
  armorState: ArmorState;
  hullState: HullState;
  /** Linear gradient string applied as the armor fill background. */
  armorFillGradient: string;
  /** Linear gradient string applied as the hull fill background. */
  hullFillGradient: string;
  /** Whether the armor shimmer animation should be running. */
  armorShimmerActive: boolean;
  /** Whether the hull critical pulse (`hpflash`) should be running. */
  hullPulseActive: boolean;
  /** Whether the hull track should render the red outline. */
  hullOutlineActive: boolean;
}

/**
 * Pure function that maps a health snapshot + sinking flag into the exact
 * visual state the HealthBar will render. This is the single source of
 * truth for the state machine, and is exported so unit tests can exercise
 * it without mounting React.
 */
export function computeHealthBarState(input: {
  armor: number;
  armorMax: number;
  hull: number;
  hullMax: number;
  isSinking: boolean;
}): HealthBarVisualState {
  const { armor, armorMax, hull, hullMax, isSinking } = input;

  const armorPctRaw = armorMax > 0 ? armor / armorMax : 0;
  const hullPctRaw = hullMax > 0 ? hull / hullMax : 0;

  const armorState: ArmorState = armorPctRaw < ARMOR_DAMAGED_THRESHOLD ? 'damaged' : 'full';

  let hullState: HullState;
  if (hullPctRaw <= HULL_CRITICAL_THRESHOLD) {
    hullState = 'critical';
  } else if (hullPctRaw <= HULL_HEALTHY_THRESHOLD) {
    hullState = 'damaged';
  } else {
    hullState = 'full';
  }

  const armorFillGradient = armorState === 'full' ? HEALTH_FULL_GRADIENT : HEALTH_DAMAGED_GRADIENT;

  let hullFillGradient: string;
  if (hullState === 'critical') {
    hullFillGradient = HEALTH_CRITICAL_GRADIENT;
  } else if (hullState === 'damaged') {
    hullFillGradient = HEALTH_DAMAGED_GRADIENT;
  } else {
    hullFillGradient = HEALTH_FULL_GRADIENT;
  }

  // Shimmer only runs while the player is actively regenerating armor.
  // When armor is full, there's nothing to repair; when the boat is
  // sinking, armor regen is disabled upstream (see `DamageSystemR3F`).
  const armorShimmerActive = !isSinking && armor < armorMax;
  const hullPulseActive = hullState === 'critical';
  const hullOutlineActive = hullState === 'critical';

  return {
    armorPct: Math.max(0, Math.min(100, armorPctRaw * 100)),
    hullPct: Math.max(0, Math.min(100, hullPctRaw * 100)),
    armorState,
    hullState,
    armorFillGradient,
    hullFillGradient,
    armorShimmerActive,
    hullPulseActive,
    hullOutlineActive,
  };
}

// ---------------------------------------------------------------------------
// Animation keyframes — injected once per mount via a scoped <style> tag.
// ---------------------------------------------------------------------------

/**
 * CSS class applied to the armor fill while the bar is regenerating.
 * The keyframe animates `background-position` across a layered gradient,
 * producing a slow horizontal shimmer/glow that reads as "repairing".
 */
export const ARMOR_SHIMMER_CLASS = 'gbr-armor-shimmer';

/**
 * CSS class applied to the hull fill while the hull is in the critical
 * state. Matches the `hpflash` animation from the Harbour Dawn reference.
 */
export const HULL_PULSE_CLASS = 'gbr-hull-pulse';

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
const READOUT_FONT_SIZE_PX = 10;
const LABEL_LETTER_SPACING_EM = 0.08;
const ROW_GAP_PX = 4;
const STACK_GAP_PX = 10;

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '2rem',
  left: '2rem',
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

const readoutStyle: React.CSSProperties = {
  color: TEXT_MUTED,
  fontFamily: "'Courier New', monospace",
  fontSize: `${String(READOUT_FONT_SIZE_PX)}px`,
  fontWeight: 700,
  marginTop: `3px`,
  fontVariantNumeric: 'tabular-nums',
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
        <div style={readoutStyle} data-testid="health-bar-armor-readout">
          {health.armor} / {health.armorMax}
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
        <div style={readoutStyle} data-testid="health-bar-hull-readout">
          {health.hull} / {health.hullMax}
        </div>
      </div>
    </div>
  );
}
