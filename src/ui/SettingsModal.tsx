/**
 * SettingsModal — R6 slice.
 *
 * Full-viewport overlay with a centered Harbour Dawn panel that
 * surfaces three tabs: Audio / Controls / Performance. Mounted inline
 * by its parents (PauseMenu / MainMenuScene) via a local toggle. The
 * modal itself is NOT phase-gated — its visibility is controlled by
 * the parent's own `useState`.
 *
 * ### Tab contents
 *
 * - **Audio** — Music slider (disabled, "coming soon" caption) + SFX
 *   slider wired to `setSfxVolume` from the store. The SFX slider
 *   writes through to Howler via the store action, which also
 *   persists to localStorage (see R2).
 * - **Controls** — read-only keybinding list sourced from the shared
 *   `KEYBINDINGS` module so it never drifts from `ControlsOverlay`.
 * - **Performance** — a single stubbed line ("coming soon") per spec.
 *
 * ### Keyboard
 *
 * - Escape closes the modal (calls `onClose`).
 * - Number-hotkey tab switching was flagged as NICE in the spec and is
 *   deliberately not implemented in this slice.
 *
 * All visuals flow through `settingsModal.helpers.ts` → `tokens.ts`.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { useGameStore } from '../store/gameStore';
import { useSettings } from '../store/selectors';
import { Button } from './Button';
import { KEYBINDINGS } from './keybindings';
import {
  isSettingsCloseKey,
  settingsAudioGroupStyle,
  settingsBackdropStyle,
  settingsControlsActionStyle,
  settingsControlsFootnoteStyle,
  settingsControlsKeyPillStyle,
  settingsControlsRowStyle,
  settingsControlsSectionHeadingStyle,
  settingsControlsSectionStyle,
  SETTINGS_DEFAULT_TAB,
  settingsFieldCaptionStyle,
  settingsFieldLabelStyle,
  settingsFooterStyle,
  settingsKeyframes,
  settingsPanelStyle,
  settingsPerformanceStyle,
  settingsTabBodyStyle,
  settingsTitleStyle,
  sliderValueFromVolume,
  volumeFromSliderValue,
  type SettingsTabId,
} from './settingsModal.helpers';
import { Slider } from './Slider';
import { Tabs, type TabDefinition } from './Tabs';

/** Props for the `SettingsModal` component. */
export interface SettingsModalProps {
  /**
   * Called when the user closes the modal — either by clicking BACK,
   * pressing Escape, or any other close affordance a future slice may
   * add. Parents are responsible for unmounting the modal in response.
   */
  readonly onClose: () => void;
}

/** Ordered tab definitions. Audio is the default active tab. */
const SETTINGS_TABS: ReadonlyArray<TabDefinition> = [
  { id: 'audio', label: 'Audio' },
  { id: 'controls', label: 'Controls' },
  { id: 'performance', label: 'Performance' },
];

/**
 * Narrow a generic string id coming from the `Tabs` component back
 * into the `SettingsTabId` union. Falls back to the default tab for
 * any unexpected input so callers can never land on an invalid tab.
 */
function asTabId(raw: string): SettingsTabId {
  if (raw === 'audio' || raw === 'controls' || raw === 'performance') {
    return raw;
  }
  return SETTINGS_DEFAULT_TAB;
}

// ---------------------------------------------------------------------------
// Tab body components — pure presentational, no internal state
// ---------------------------------------------------------------------------

function AudioTab() {
  const settings = useSettings();
  const setSfxVolume = useGameStore((s) => s.setSfxVolume);

  return (
    <div style={settingsTabBodyStyle} data-testid="settings-audio-tab">
      <div style={settingsAudioGroupStyle}>
        <label style={settingsFieldLabelStyle} htmlFor="settings-music-slider-input">
          Music
        </label>
        <Slider
          value={sliderValueFromVolume(1)}
          disabled
          ariaLabel="Music volume (coming soon)"
          testId="settings-music-slider"
        />
        <p style={settingsFieldCaptionStyle}>Music coming soon</p>
      </div>

      <div style={settingsAudioGroupStyle}>
        <label style={settingsFieldLabelStyle} htmlFor="settings-sfx-slider-input">
          SFX
        </label>
        <Slider
          value={sliderValueFromVolume(settings.sfxVolume)}
          onChange={(v) => {
            setSfxVolume(volumeFromSliderValue(v));
          }}
          ariaLabel="Sound effects volume"
          testId="settings-sfx-slider"
        />
      </div>
    </div>
  );
}

function ControlsTab() {
  return (
    <div style={settingsTabBodyStyle} data-testid="settings-controls-tab">
      {KEYBINDINGS.map((category) => (
        <section
          key={category.id}
          style={settingsControlsSectionStyle}
          data-testid={`settings-controls-section-${category.id}`}
        >
          <h3 style={settingsControlsSectionHeadingStyle}>{category.title}</h3>
          {category.bindings.map((binding) => (
            <div
              key={`${category.id}-${binding.key}`}
              style={settingsControlsRowStyle}
              data-testid={`settings-controls-row-${category.id}-${binding.key}`}
            >
              <span style={settingsControlsKeyPillStyle}>{binding.key}</span>
              <span style={settingsControlsActionStyle}>{binding.action}</span>
            </div>
          ))}
        </section>
      ))}
      <p style={settingsControlsFootnoteStyle}>Key rebinding coming in a future update</p>
    </div>
  );
}

function PerformanceTab() {
  return (
    <div style={settingsTabBodyStyle} data-testid="settings-performance-tab">
      <p style={settingsPerformanceStyle}>Performance options coming soon</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Full-viewport SettingsModal overlay. Owns its own active-tab state
 * and the Escape-to-close document listener. Mount / unmount is
 * controlled by the parent.
 */
export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(SETTINGS_DEFAULT_TAB);

  const handleTabChange = useCallback((id: string): void => {
    setActiveTab(asTabId(id));
  }, []);

  // Document-level Escape handler. Captures the event at the document
  // level so the modal wins against any underlying menu that may also
  // listen for Escape — callers mount this modal on top of either the
  // PauseMenu or the MainMenuScene, and both of those should stop
  // handling Escape while the modal is open.
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (!isSettingsCloseKey(event)) return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  return (
    <>
      <style>{settingsKeyframes()}</style>
      <div
        style={settingsBackdropStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-testid="settings-modal"
      >
        <div style={settingsPanelStyle} data-testid="settings-modal-panel">
          <h2 style={settingsTitleStyle}>SETTINGS</h2>

          <Tabs tabs={SETTINGS_TABS} activeId={activeTab} onChange={handleTabChange} />

          {activeTab === 'audio' ? <AudioTab /> : null}
          {activeTab === 'controls' ? <ControlsTab /> : null}
          {activeTab === 'performance' ? <PerformanceTab /> : null}

          <div style={settingsFooterStyle}>
            <Button
              variant="secondary"
              onClick={onClose}
              style={{ width: 'auto', padding: '12px 32px' } as React.CSSProperties}
              data-testid="settings-back-button"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
