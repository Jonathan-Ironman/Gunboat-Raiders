/**
 * Level configuration catalogue — R9 slice of the UI overhaul.
 *
 * Each entry drives the `LevelBriefingModal` content for a single
 * mission. Kept as a plain data module with no React / DOM imports so
 * it can be consumed headlessly by tests, tools, and future save /
 * pipeline code without pulling in the UI layer.
 *
 * V1 ships with a single level (`First Light`). Additional levels will
 * be appended to `LEVELS` in later slices; `LEVELS[n]` is the
 * authoritative source for `briefingLevelIndex === n`.
 */

/**
 * Shape of a level as consumed by `LevelBriefingModal`. All fields are
 * mandatory and must be non-empty strings — the modal renders each
 * section unconditionally (with the Controls section only being
 * omitted for `index > 0`).
 */
export interface LevelConfig {
  /**
   * Zero-based position in the `LEVELS` array. Mirrors
   * `briefingLevelIndex` in the game store so selectors can round-trip
   * from the store into the config without extra bookkeeping.
   */
  readonly index: number;
  /** Short mission name, rendered as the large display title. */
  readonly name: string;
  /** Single-sentence mission objective, rendered in the MISSION section. */
  readonly missionStatement: string;
  /** One-line controls reminder, rendered in the CONTROLS section (level 0 only). */
  readonly controlsSummary: string;
  /** Paragraph explaining the mechanic twist for this level. */
  readonly mechanicsExplanation: string;
}

/**
 * Ordered list of levels currently available in the game. Frozen via
 * `as const` so callers cannot accidentally mutate it — the modal reads
 * `LEVELS[briefingLevelIndex]` directly and should never be handed a
 * tampered array. V1 contains only `First Light`; later slices will
 * append entries here.
 */
export const LEVELS: readonly LevelConfig[] = [
  {
    index: 0,
    name: 'First Light',
    missionStatement:
      'Sink every raider that crosses your path. Hold the line until the seas are calm.',
    controlsSummary:
      'WASD to steer. Mouse to aim. Click to fire the active quadrant. Esc to pause.',
    mechanicsExplanation:
      'Your armor slowly auto-repairs over time, but your hull does not. Pick your fights — and stay out of broadsides.',
  },
] as const;
