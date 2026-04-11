/**
 * Showcase (main menu background) scene presets.
 *
 * Three deterministic, hand-tuned compositions that frame a single
 * peaceful player boat against the water + sky. The scene picks one
 * preset uniformly at random on mount (see `pickShowcasePreset`).
 *
 * The module is intentionally pure data + one pure helper so it can
 * be unit-tested without React, Three, or Rapier.
 */

/** Path the showcase boat follows while the main menu is visible. */
export type ShowcaseBoatPath = 'straight' | 'circle' | 'stationary';

/** Camera composition mode for the showcase scene. */
export type ShowcaseCameraMode = 'cinematic-side' | 'orbit-slow' | 'pan-slow';

export interface ShowcaseBoatConfig {
  /** World-space spawn position (x, y, z). */
  readonly startPos: readonly [number, number, number];
  /** Path shape. */
  readonly path: ShowcaseBoatPath;
  /** Forward speed in metres / second. `0` for `'stationary'`. */
  readonly speed: number;
  /** Radius for the `'circle'` path. Ignored otherwise. */
  readonly radius?: number;
}

export interface ShowcaseCameraConfig {
  readonly mode: ShowcaseCameraMode;
  /** Orbit / offset distance from the boat centre. */
  readonly distance: number;
  /** Height above the water surface (metres). */
  readonly height: number;
}

export interface ShowcasePreset {
  readonly name: string;
  readonly boat: ShowcaseBoatConfig;
  readonly camera: ShowcaseCameraConfig;
}

/**
 * Canonical set of showcase presets. `readonly` on every layer so the
 * linter / compiler catches any accidental mutation from consumers.
 */
export const SHOWCASE_PRESETS: readonly ShowcasePreset[] = [
  {
    name: 'Calm Heading Out',
    boat: {
      startPos: [0, 0, 0],
      path: 'straight',
      speed: 4,
    },
    camera: {
      mode: 'cinematic-side',
      distance: 22,
      height: 8,
    },
  },
  {
    name: 'Lazy Circle',
    boat: {
      startPos: [-15, 0, 0],
      path: 'circle',
      radius: 18,
      speed: 3,
    },
    camera: {
      mode: 'orbit-slow',
      distance: 28,
      height: 12,
    },
  },
  {
    name: 'Anchored at Dawn',
    boat: {
      startPos: [10, 0, 5],
      path: 'stationary',
      speed: 0,
    },
    camera: {
      mode: 'pan-slow',
      distance: 18,
      height: 6,
    },
  },
] as const;

/**
 * Pure, dependency-injected preset picker. Accepts any `() => number`
 * RNG so tests can feed a deterministic sequence. Out-of-range and
 * `NaN` values are clamped into a safe index instead of throwing —
 * the caller always gets back a valid preset so the scene never
 * fails to mount.
 *
 * @param rng Function returning a number in `[0, 1)` (e.g. `Math.random`).
 * @returns A preset from `SHOWCASE_PRESETS`.
 */
export function pickShowcasePreset(rng: () => number = Math.random): ShowcasePreset {
  const total = SHOWCASE_PRESETS.length;
  // `noUncheckedIndexedAccess` makes direct indexing possibly-undefined;
  // we guarantee a hit by clamping into `[0, total - 1]`.
  if (total === 0) {
    throw new Error('SHOWCASE_PRESETS must contain at least one entry');
  }
  const raw = rng();
  const safe = Number.isFinite(raw) ? raw : 0;
  const clamped = Math.min(Math.max(safe, 0), 0.9999999);
  const index = Math.floor(clamped * total);
  const preset = SHOWCASE_PRESETS[index];
  // Belt-and-braces for the type checker — `index` is always in range.
  if (preset === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return SHOWCASE_PRESETS[0]!;
  }
  return preset;
}
