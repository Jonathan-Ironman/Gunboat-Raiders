/**
 * WaveAnnouncement — full-screen wave-clear overlay (Harbour Dawn — Slice R16).
 *
 * Announces the wave-clear beat with a two-sub-phase headline:
 *   1. "WAVE CLEARED"               (0 .. 1500ms after mount)
 *   2. "WAVE {n+1} INCOMING"         (1500 .. 3000ms after mount)
 *
 * Both sub-phases sit inside a letterboxed frame (top + bottom bars slide
 * in on mount and retract on exit). After the incoming beat, the overlay
 * fades out over `DUR_NORMAL` and unmounts — regardless of whether the
 * store has already transitioned back to `playing`.
 *
 * The sub-phase state machine and ALL timing/styling constants live in
 * `waveAnnouncement.helpers.ts` so the visual logic is unit-testable in a
 * headless node environment without mounting React.
 *
 * The component is self-gated on `phase === 'wave-clear'`: outside of
 * that phase it returns null and discards any in-flight timers. Re-
 * entering `wave-clear` resets the local state machine from scratch.
 *
 * All colors, fonts, and motion values flow through `src/ui/tokens.ts`.
 */

import { useEffect, useState } from 'react';

import { useGamePhase, useWaveNumber } from '../store/selectors';
import {
  WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS,
  WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS,
  WAVE_ANNOUNCEMENT_TOTAL_MS,
  WAVE_CLEARED_HEADLINE,
  formatIncomingHeadline,
  headlineStyle,
  letterboxBottomStyle,
  letterboxTopStyle,
  shouldRenderWaveAnnouncement,
  waveAnnouncementRootStyle,
  type WaveAnnouncementSubPhase,
} from './waveAnnouncement.helpers';

export function WaveAnnouncement() {
  const phase = useGamePhase();
  const wave = useWaveNumber();

  // Local visual sub-phase. Starts as 'clear' on each fresh mount and
  // progresses via two setTimeouts below. Using local state (rather than
  // deriving from the store phase) isolates the overlay animation from
  // the actual `wave-clear` -> `playing` store transition, which may end
  // slightly sooner or later than the overlay's 3-second beat.
  const [subPhase, setSubPhase] = useState<WaveAnnouncementSubPhase>('clear');

  // Wave number captured when the overlay mounts, so the "INCOMING"
  // headline keeps showing the correct next-wave number even if the
  // store ticks the wave counter forward mid-animation. Defaults to the
  // live wave value on every fresh mount (triggered by the phase gate
  // below remounting the component).
  const [announcedWave] = useState(wave);

  useEffect(() => {
    // Only arm timers when the overlay is actually visible. Outside of
    // 'wave-clear' the early return below bails before we ever render.
    if (!shouldRenderWaveAnnouncement(phase)) return undefined;

    const toIncoming = window.setTimeout(() => {
      setSubPhase('incoming');
    }, WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS);

    const toExit = window.setTimeout(() => {
      setSubPhase('exit');
    }, WAVE_ANNOUNCEMENT_CLEAR_HOLD_MS + WAVE_ANNOUNCEMENT_INCOMING_HOLD_MS);

    const toDone = window.setTimeout(() => {
      setSubPhase('done');
    }, WAVE_ANNOUNCEMENT_TOTAL_MS);

    return () => {
      window.clearTimeout(toIncoming);
      window.clearTimeout(toExit);
      window.clearTimeout(toDone);
    };
  }, [phase]);

  if (!shouldRenderWaveAnnouncement(phase)) return null;
  if (subPhase === 'done') return null;

  const letterboxVisible = subPhase !== 'exit';
  const overlayOpacity = subPhase === 'exit' ? 0 : 1;
  const showClearHeadline = subPhase === 'clear';
  const showIncomingHeadline = subPhase === 'incoming';

  return (
    <div
      style={waveAnnouncementRootStyle(overlayOpacity)}
      data-testid="wave-announcement"
      data-sub-phase={subPhase}
      aria-live="polite"
    >
      <div
        style={letterboxTopStyle(letterboxVisible)}
        data-testid="wave-announcement-letterbox-top"
      />
      <div
        style={letterboxBottomStyle(letterboxVisible)}
        data-testid="wave-announcement-letterbox-bottom"
      />
      <h1 style={headlineStyle('clear', showClearHeadline)} data-testid="wave-announcement-cleared">
        {WAVE_CLEARED_HEADLINE}
      </h1>
      <h1
        style={headlineStyle('incoming', showIncomingHeadline)}
        data-testid="wave-announcement-incoming"
      >
        {formatIncomingHeadline(announcedWave)}
      </h1>
    </div>
  );
}
