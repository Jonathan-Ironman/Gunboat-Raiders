/**
 * Tabs — reusable token-styled tabbed interface.
 *
 * Renders a horizontal row of tab buttons with a single underline
 * indicator on the active tab. Disabled tabs render in `TEXT_DIM` with
 * `cursor: not-allowed` and never fire `onChange`.
 *
 * ### Shape
 *
 * ```ts
 * interface TabsProps {
 *   tabs: ReadonlyArray<{ id: string; label: string; disabled?: boolean }>;
 *   activeId: string;
 *   onChange: (id: string) => void;
 * }
 * ```
 *
 * The component is deliberately controlled — it does NOT own the
 * active tab state. That way callers can compose it into any larger
 * layout and persist / reset the active tab based on their own logic
 * (route state, local state, url hash, etc.).
 *
 * All visual styling flows through `settingsModal.helpers.ts`, which
 * pulls from `tokens.ts`. No hardcoded values live here.
 */

import type { CSSProperties } from 'react';

import {
  tabItemActiveStyle,
  tabItemBaseStyle,
  tabItemDisabledStyle,
  tabsContainerStyle,
} from './settingsModal.helpers';

/** One entry in the Tabs row. */
export interface TabDefinition {
  /** Stable identifier — surfaced in ARIA, testIds, and `onChange`. */
  readonly id: string;
  /** Human-readable label rendered inside the button. */
  readonly label: string;
  /**
   * When `true`, the tab is rendered in the dim/disabled variant and
   * cannot become active. Defaults to `false`.
   */
  readonly disabled?: boolean;
}

/** Public props for the `Tabs` component. */
export interface TabsProps {
  /** Ordered list of tab entries to render. */
  readonly tabs: ReadonlyArray<TabDefinition>;
  /** Id of the currently active tab. */
  readonly activeId: string;
  /**
   * Called when the user activates a non-disabled tab. The handler
   * receives the tab's `id`. Disabled tabs never fire this callback.
   */
  readonly onChange: (id: string) => void;
}

function buildTabStyle(isActive: boolean, isDisabled: boolean): CSSProperties {
  return {
    ...tabItemBaseStyle,
    ...(isActive ? tabItemActiveStyle : {}),
    ...(isDisabled ? tabItemDisabledStyle : {}),
  };
}

/**
 * Controlled tabbed interface. Renders as an ARIA `tablist` with each
 * entry as an individual `tab` button, giving screen readers the
 * correct semantics without any extra wiring.
 */
export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  return (
    <div role="tablist" style={tabsContainerStyle} data-testid="settings-tabs">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const isDisabled = tab.disabled === true;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            data-testid={`settings-tab-${tab.id}`}
            style={buildTabStyle(isActive, isDisabled)}
            onClick={() => {
              if (isDisabled) return;
              if (isActive) return;
              onChange(tab.id);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
