/**
 * LevelBriefingModal — R9 slice.
 *
 * Full-viewport opaque overlay shown between the main menu and the
 * game. Presents the mission-statement / controls / briefing copy for
 * the currently staged level and exposes two actions:
 *
 * - `BACK TO MENU` — returns to the main menu (phase `mainMenu`).
 * - `START` — boots the selected level (phase `playing`).
 *
 * The modal self-gates on `useGamePhase() === 'briefing'`, so it can
 * be mounted unconditionally from `App.tsx` alongside the other
 * phase-gated overlays (`MainMenuScene`, `GameOverScreen`) without
 * needing any parent conditional.
 *
 * Keyboard:
 *
 * - Enter / Space → Start the staged level.
 * - Escape / Backspace → Return to the main menu.
 *
 * All visuals flow through `levelBriefingModal.helpers.ts` → `tokens.ts`.
 */

import { useCallback, useEffect } from 'react';

import { LEVELS, type LevelConfig } from '../config/levels';
import { useGameStore } from '../store/gameStore';
import { useBriefingLevelIndex, useGamePhase } from '../store/selectors';
import {
  briefingBackdropStyle,
  briefingBodyStyle,
  briefingButtonRowStyle,
  briefingKeyframes,
  briefingKickerStyle,
  briefingMissionBodyStyle,
  briefingPanelStyle,
  briefingPrimaryButtonStyle,
  briefingSecondaryButtonStyle,
  briefingSectionLabelStyle,
  briefingSectionStyle,
  briefingSeparatorStyle,
  briefingTitleStyle,
  formatMissionKicker,
  isBriefingBackKey,
  isBriefingStartKey,
} from './levelBriefingModal.helpers';

/**
 * Resolve the `LevelConfig` entry for the given index, falling back to
 * the first level when the store is in an unexpected state (e.g. a
 * future level index survived a reload while the LEVELS array was
 * shortened). Returning a valid entry instead of `null` keeps the
 * render path simple and prevents an ugly "mission data missing" flash
 * if save data ever drifts.
 */
function resolveLevel(levelIndex: number): LevelConfig {
  const clamped = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(levelIndex)));
  const fallback = LEVELS[0];
  const resolved = LEVELS[clamped] ?? fallback;
  // `resolved` is guaranteed to be defined because LEVELS has at least
  // one entry (asserted by the companion levels.test.ts). The explicit
  // non-null check keeps `strict` / `noUncheckedIndexedAccess` happy.
  if (resolved === undefined) {
    throw new Error('LEVELS catalogue is empty — expected at least one entry');
  }
  return resolved;
}

/**
 * Full-viewport briefing overlay. Self-gated on the `'briefing'` game
 * phase — mounts unconditionally from `App.tsx`.
 */
export function LevelBriefingModal() {
  const phase = useGamePhase();
  const briefingLevelIndex = useBriefingLevelIndex();

  const handleStart = useCallback((): void => {
    useGameStore.getState().startLevel(briefingLevelIndex);
  }, [briefingLevelIndex]);

  const handleBack = useCallback((): void => {
    useGameStore.getState().returnToMainMenu();
  }, []);

  // Document-level keydown listener. Installs only while the modal is
  // actually visible so we never intercept keys during `playing` /
  // `paused` / `mainMenu`. The effect re-runs on phase change, so the
  // listener is automatically removed as soon as the user leaves the
  // briefing phase.
  useEffect(() => {
    if (phase !== 'briefing') return undefined;

    const handler = (event: KeyboardEvent): void => {
      if (isBriefingStartKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        handleStart();
        return;
      }
      if (isBriefingBackKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        handleBack();
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [phase, handleStart, handleBack]);

  if (phase !== 'briefing') return null;

  const level = resolveLevel(briefingLevelIndex);
  const showControls = level.index === 0;

  return (
    <>
      <style>{briefingKeyframes()}</style>
      <div
        style={briefingBackdropStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`Level briefing: ${level.name}`}
        data-testid="level-briefing-modal"
      >
        <div style={briefingPanelStyle} data-testid="level-briefing-panel">
          <p style={briefingKickerStyle} data-testid="briefing-kicker">
            {formatMissionKicker(level.index)}
          </p>
          <h1 style={briefingTitleStyle} data-testid="briefing-level-name">
            {level.name}
          </h1>
          <hr style={briefingSeparatorStyle} aria-hidden="true" />

          <section style={briefingSectionStyle} data-testid="briefing-mission-section">
            <p style={briefingSectionLabelStyle}>MISSION</p>
            <p style={briefingMissionBodyStyle}>{level.missionStatement}</p>
          </section>

          {showControls ? (
            <section style={briefingSectionStyle} data-testid="briefing-controls-section">
              <p style={briefingSectionLabelStyle}>CONTROLS</p>
              <p style={briefingBodyStyle}>{level.controlsSummary}</p>
            </section>
          ) : null}

          <section style={briefingSectionStyle} data-testid="briefing-briefing-section">
            <p style={briefingSectionLabelStyle}>BRIEFING</p>
            <p style={briefingBodyStyle}>{level.mechanicsExplanation}</p>
          </section>

          <div style={briefingButtonRowStyle}>
            <button
              type="button"
              style={briefingSecondaryButtonStyle}
              onClick={handleBack}
              data-testid="briefing-back-btn"
            >
              Back to Menu
            </button>
            <button
              type="button"
              style={briefingPrimaryButtonStyle}
              onClick={handleStart}
              data-testid="briefing-start-btn"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
