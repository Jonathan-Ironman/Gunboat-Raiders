/**
 * Shared keybinding catalogue.
 *
 * Single source of truth for every player-facing keybinding hint rendered
 * by the UI. Owned by R17 (ControlsOverlay) and consumed by:
 *
 * - `ControlsOverlay.tsx` — the in-game H/? help panel.
 * - `SettingsModal.tsx` (R6, pending) — the read-only Controls tab.
 *
 * Keeping the list here means both surfaces display the same bindings
 * without risk of drift, and the data is plain TypeScript — no React,
 * no tokens, no store. That makes it trivially unit-testable and safe
 * to import from anywhere in the UI layer.
 *
 * ### Not a rebinding module
 *
 * V1 does not support custom rebinding (see "Out-of-scope" in
 * `todo/20260411-ui-overhaul-plan-revised.md`). If / when that lands,
 * the shape below should grow into a store-backed map; until then it is
 * deliberately static, typed as `readonly`, and frozen at the module
 * boundary so consumers can treat it as immutable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Top-level grouping for the controls overlay. Each category maps to a
 * visually separated section (heading + bindings rows) in the rendered
 * panel.
 */
export type KeybindingCategoryId = 'movement' | 'camera' | 'ui';

/**
 * A single row in the controls overlay: a key label shown as a small
 * monospace pill, and a short human-readable action label.
 *
 * `key` is the *display* string (e.g. `"W"`, `"Mouse"`, `"H / ?"`), not
 * the `KeyboardEvent.key` value. That separation is important: a
 * display label like `"H / ?"` is a summary of multiple `KeyboardEvent`
 * keys, and the actual event-matching logic lives in
 * `ControlsOverlay.helpers.ts::isToggleKey`.
 */
export interface Keybinding {
  readonly key: string;
  readonly action: string;
}

/**
 * A named group of keybindings. The `title` is the visible section
 * header rendered above its `bindings` list.
 */
export interface KeybindingCategory {
  readonly id: KeybindingCategoryId;
  readonly title: string;
  readonly bindings: readonly Keybinding[];
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/**
 * The full, ordered catalogue of keybindings surfaced to the player.
 *
 * Order is significant — rendered top-to-bottom in ControlsOverlay and
 * in the Settings Controls tab. Keep the three sections in the same
 * order (movement → camera → ui) across both surfaces for consistency.
 *
 * `as const` + `readonly` types give us compile-time narrowing (so the
 * test suite can assert exact values) AND runtime immutability after
 * `Object.freeze` at the bottom of the file.
 */
export const KEYBINDINGS: readonly KeybindingCategory[] = [
  {
    id: 'movement',
    title: 'Movement',
    bindings: [
      { key: 'W', action: 'Forward thrust' },
      { key: 'S', action: 'Reverse' },
      { key: 'A', action: 'Turn port (left)' },
      { key: 'D', action: 'Turn starboard (right)' },
    ],
  },
  {
    id: 'camera',
    title: 'Camera / Aiming',
    bindings: [
      { key: 'Mouse', action: 'Rotate camera / aim' },
      { key: 'Click', action: 'Fire active quadrant' },
    ],
  },
  {
    id: 'ui',
    title: 'UI',
    bindings: [
      { key: 'Esc', action: 'Pause / resume' },
      { key: 'H / ?', action: 'Toggle controls' },
    ],
  },
] as const;

// Deep-freeze the published constant so consumers cannot mutate it at
// runtime. TypeScript enforces the `readonly` shape at compile time;
// this belt-and-braces call guards against mistakes in non-TS callers
// (tests that might accidentally push into a bindings array, etc.).
Object.freeze(KEYBINDINGS);
for (const category of KEYBINDINGS) {
  Object.freeze(category);
  Object.freeze(category.bindings);
  for (const binding of category.bindings) {
    Object.freeze(binding);
  }
}

// ---------------------------------------------------------------------------
// Derived constants — keep in sync with `KEYBINDINGS` via tests
// ---------------------------------------------------------------------------

/**
 * Number of top-level categories in the catalogue. Exposed as a named
 * constant so tests can pin the expected shape in one place and so a
 * future contributor who adds a category is forced to update the test.
 */
export const KEYBINDING_CATEGORY_COUNT = KEYBINDINGS.length;
