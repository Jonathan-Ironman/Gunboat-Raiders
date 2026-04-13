import {
  ARMOR_CRITICAL_GRADIENT,
  ARMOR_DAMAGED_GRADIENT,
  ARMOR_FULL_GRADIENT,
  HULL_CRITICAL_GRADIENT,
  HULL_CRITICAL_THRESHOLD,
  HULL_DAMAGED_GRADIENT,
  HULL_FULL_GRADIENT,
} from './tokens';

/** Armor bar visual states. Same three-band ramp as the hull. */
export type ArmorState = 'full' | 'damaged' | 'critical';

/** Hull bar visual states. Teal > 60%; amber 30–60%; critical red ≤ 30%. */
export type HullState = 'full' | 'damaged' | 'critical';

/** Width above which both armor and hull render in the `full` color. */
export const BAR_HEALTHY_THRESHOLD = 0.6;

/** Alias retained for call-sites / tests that spoke in hull-specific terms. */
export const HULL_HEALTHY_THRESHOLD = BAR_HEALTHY_THRESHOLD;

/**
 * Width at or below which both armor and hull render in the `critical`
 * color. Points to the same token as `HULL_CRITICAL_THRESHOLD`.
 */
export const BAR_CRITICAL_THRESHOLD = HULL_CRITICAL_THRESHOLD;

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
 * Shared three-band ramp used by both armor and hull. Kept as a local
 * helper instead of inlining twice so the state machine has a single
 * source of truth for thresholds.
 */
function bandFor(pctRaw: number): ArmorState | HullState {
  if (pctRaw <= BAR_CRITICAL_THRESHOLD) return 'critical';
  if (pctRaw <= BAR_HEALTHY_THRESHOLD) return 'damaged';
  return 'full';
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

  const armorState: ArmorState = bandFor(armorPctRaw);
  const hullState: HullState = bandFor(hullPctRaw);

  let armorFillGradient: string;
  if (armorState === 'critical') {
    armorFillGradient = ARMOR_CRITICAL_GRADIENT;
  } else if (armorState === 'damaged') {
    armorFillGradient = ARMOR_DAMAGED_GRADIENT;
  } else {
    armorFillGradient = ARMOR_FULL_GRADIENT;
  }

  let hullFillGradient: string;
  if (hullState === 'critical') {
    hullFillGradient = HULL_CRITICAL_GRADIENT;
  } else if (hullState === 'damaged') {
    hullFillGradient = HULL_DAMAGED_GRADIENT;
  } else {
    hullFillGradient = HULL_FULL_GRADIENT;
  }

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
