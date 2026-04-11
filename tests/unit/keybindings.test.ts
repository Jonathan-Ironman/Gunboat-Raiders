/**
 * Unit tests for `src/ui/keybindings.ts` — R17 slice.
 *
 * `keybindings.ts` is the single source of truth for every player-facing
 * keybinding hint rendered by the UI (ControlsOverlay now, SettingsModal
 * later). These tests pin:
 *
 * 1. **Shape** — types, required fields, three sections in the documented
 *    order (movement → camera → ui).
 * 2. **Contents** — the exact key/action rows spec'd by R17 are present
 *    so a regression in the catalogue breaks a test and not the game.
 * 3. **Immutability** — `Object.freeze` is applied end-to-end so a
 *    consumer accidentally mutating the shared list fails loudly.
 *
 * Keeping these assertions precise (not just "length > 0") is deliberate:
 * the future SettingsModal will import the same constant, and any drift
 * between the two surfaces would confuse players.
 */

import { describe, expect, it } from 'vitest';

import {
  KEYBINDINGS,
  KEYBINDING_CATEGORY_COUNT,
  type Keybinding,
  type KeybindingCategory,
  type KeybindingCategoryId,
} from '@/ui/keybindings';

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

describe('KEYBINDINGS — shape', () => {
  it('exposes exactly three top-level categories', () => {
    expect(KEYBINDINGS.length).toBe(3);
    expect(KEYBINDING_CATEGORY_COUNT).toBe(3);
  });

  it('orders the categories movement → camera → ui', () => {
    const ids: KeybindingCategoryId[] = KEYBINDINGS.map((c) => c.id);
    expect(ids).toEqual(['movement', 'camera', 'ui']);
  });

  it('every category has a non-empty title and at least one binding', () => {
    for (const category of KEYBINDINGS) {
      expect(typeof category.title).toBe('string');
      expect(category.title.length).toBeGreaterThan(0);
      expect(category.bindings.length).toBeGreaterThan(0);
    }
  });

  it('every binding has a non-empty key and action', () => {
    for (const category of KEYBINDINGS) {
      for (const binding of category.bindings) {
        expect(typeof binding.key).toBe('string');
        expect(binding.key.length).toBeGreaterThan(0);
        expect(typeof binding.action).toBe('string');
        expect(binding.action.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Contents — pin the exact spec rows
// ---------------------------------------------------------------------------

describe('KEYBINDINGS — movement section', () => {
  const movement = findCategory('movement');

  it('labels the section "Movement"', () => {
    expect(movement.title).toBe('Movement');
  });

  it('contains the four WASD rows in order', () => {
    expect(movement.bindings.map((b) => b.key)).toEqual(['W', 'S', 'A', 'D']);
  });

  it('binds W to forward thrust', () => {
    expect(findBinding(movement, 'W').action).toBe('Forward thrust');
  });

  it('binds S to reverse', () => {
    expect(findBinding(movement, 'S').action).toBe('Reverse');
  });

  it('binds A to port turn', () => {
    expect(findBinding(movement, 'A').action).toContain('port');
  });

  it('binds D to starboard turn', () => {
    expect(findBinding(movement, 'D').action).toContain('starboard');
  });
});

describe('KEYBINDINGS — camera / aiming section', () => {
  const camera = findCategory('camera');

  it('labels the section "Camera / Aiming"', () => {
    expect(camera.title).toBe('Camera / Aiming');
  });

  it('lists Mouse and Click rows', () => {
    const keys = camera.bindings.map((b) => b.key);
    expect(keys).toContain('Mouse');
    expect(keys).toContain('Click');
  });

  it('describes Click as firing the active quadrant', () => {
    expect(findBinding(camera, 'Click').action.toLowerCase()).toContain('fire');
    expect(findBinding(camera, 'Click').action.toLowerCase()).toContain('quadrant');
  });
});

describe('KEYBINDINGS — UI section', () => {
  const ui = findCategory('ui');

  it('labels the section "UI"', () => {
    expect(ui.title).toBe('UI');
  });

  it('lists Esc and H / ? rows', () => {
    const keys = ui.bindings.map((b) => b.key);
    expect(keys).toContain('Esc');
    expect(keys).toContain('H / ?');
  });

  it('binds Esc to pause/resume', () => {
    expect(findBinding(ui, 'Esc').action.toLowerCase()).toContain('pause');
  });

  it('binds H / ? to toggling controls', () => {
    expect(findBinding(ui, 'H / ?').action.toLowerCase()).toContain('toggle');
    expect(findBinding(ui, 'H / ?').action.toLowerCase()).toContain('control');
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('KEYBINDINGS — immutability', () => {
  it('the top-level array is frozen', () => {
    expect(Object.isFrozen(KEYBINDINGS)).toBe(true);
  });

  it('every category is frozen', () => {
    for (const category of KEYBINDINGS) {
      expect(Object.isFrozen(category)).toBe(true);
      expect(Object.isFrozen(category.bindings)).toBe(true);
    }
  });

  it('every binding row is frozen', () => {
    for (const category of KEYBINDINGS) {
      for (const binding of category.bindings) {
        expect(Object.isFrozen(binding)).toBe(true);
      }
    }
  });

  it('mutating a binding at runtime throws in strict mode', () => {
    const first = KEYBINDINGS[0]?.bindings[0];
    if (first === undefined) {
      throw new Error('unreachable: KEYBINDINGS must contain at least one row');
    }
    // ES module scope is always strict-mode — assigning to a frozen
    // object's property throws TypeError. We cast through `unknown` to
    // a mutable shape so the assignment type-checks; the runtime cast
    // is harmless because we expect the very next line to throw.
    const mutable = first as unknown as { key: string };
    expect(() => {
      mutable.key = 'ZZZ';
    }).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Shared lookup helpers — keep the assertions above readable
// ---------------------------------------------------------------------------

function findCategory(id: KeybindingCategoryId): KeybindingCategory {
  const category = KEYBINDINGS.find((c) => c.id === id);
  if (category === undefined) {
    throw new Error(`KEYBINDINGS is missing the "${id}" category`);
  }
  return category;
}

function findBinding(category: KeybindingCategory, key: string): Keybinding {
  const binding = category.bindings.find((b) => b.key === key);
  if (binding === undefined) {
    throw new Error(
      `Category "${category.id}" is missing the "${key}" binding (keys: ${category.bindings
        .map((b) => b.key)
        .join(', ')})`,
    );
  }
  return binding;
}
