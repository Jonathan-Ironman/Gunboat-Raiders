# UI Overhaul Implementation Plan — Gunboat Raiders

**Created:** 2026-04-11
**Status:** Ready for agent dispatch. Work slices in dependency order.
**Ground truth:** `docs/art-direction/index.html` (Harbour Dawn design system) + `docs/ui-layout-proposal.md` (layout/content spec).
**Orchestrator decisions baked in:** See per-slice notes. Items marked `[pending user confirmation]` may be revised.

---

## Dependency Graph (read before dispatching)

```
Slice 1 (tokens) ──► ALL subsequent slices
Slice 2 (store)  ──► 7, 8, 9, 13
Slice 3 (fonts)  ──► 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16
Slice 4 (HealthBar) ──► 9 (low-hull warning reads same DOM node)
Slice 11 (TitleScreen) ──► 15 (Settings needs title to navigate from)
Slice 13 (PauseMenu) ──► 15 (Settings needs pause to navigate from)
Slices 2+3 must land before any visible screen work.
```

---

## Slice 1 — Design Tokens Module

**Priority:** MUST
**Complexity:** S
**Dependencies:** None

### Scope

**Create:** `src/ui/tokens.ts`

Single file exporting every Harbour Dawn value as a typed TypeScript constant. All other UI slices import from here — never hardcode a hex value or duration anywhere else.

### What to put in the file

**Colors (from `:root` in `docs/art-direction/index.html`):**

- `BG = '#0f1e36'`, `BG_DEEP = '#071120'`
- `SURFACE = '#152844'`, `SURFACE_EL = '#1c3556'`
- `BORDER = '#234870'`, `BORDER_SUB = '#1a3454'`
- `GOLD = '#f2b640'`, `GOLD_DARK = '#c8921a'`
- `TEAL = '#2dd4aa'`, `TEAL_DARK = '#1aaa84'`
- `RED = '#ff8080'`, `RED_DARK = '#cc3333'`
- `OCEAN = '#4a8ac4'`
- `TEXT_PRI = '#ffffff'`, `TEXT_SEC = '#c8dff0'`, `TEXT_MUTED = '#7aaac8'`, `TEXT_DIM = '#4a7090'`

**Spacing (from `--space-*` tokens):**

- `SP_1 = 4`, `SP_2 = 8`, `SP_3 = 12`, `SP_4 = 16`, `SP_5 = 20`, `SP_6 = 24`, `SP_8 = 32`, `SP_10 = 40`, `SP_12 = 48`, `SP_16 = 64`, `SP_20 = 80` (all in px as numbers, exported as `${n}px` template or raw numbers — choose raw numbers for flexibility)

**Border radii:**

- `RADIUS_SM = 4`, `RADIUS_MD = 8`, `RADIUS_LG = 12`, `RADIUS_XL = 16` (px)

**Shadows:**

- `SHADOW_SM`, `SHADOW_MD`, `SHADOW_LG`, `SHADOW_GOLD` — export as string literals matching the art direction values

**Motion durations (from `#motion` section):**

- `DUR_INSTANT = 80`, `DUR_FAST = 150`, `DUR_NORMAL = 200`, `DUR_MEDIUM = 300`, `DUR_SLOW = 500`, `DUR_DAMAGE_FLOAT = 1200` (all ms as numbers)

**Easing functions:**

- `EASE_OUT = 'ease-out'`, `EASE_IN = 'ease-in'`, `EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)'`, `EASE_LINEAR = 'linear'`

**Typography constants** (use as reference for inline styles, not as CSS classes):

- `FONT_DISPLAY = "'Baloo 2', sans-serif"` — for all headings and numeric displays
- `FONT_UI = "'Nunito', sans-serif"` — for all body, labels, captions

**Health bar gradient recipes:**

- `HEALTH_FULL_GRADIENT = 'linear-gradient(90deg, #2dd4aa, #22c4a0)'` (teal, armor)
- `HEALTH_DAMAGED_GRADIENT = 'linear-gradient(90deg, #e8b020, #c8920a)'` (amber, hull mid)
- `HEALTH_CRITICAL_GRADIENT = 'linear-gradient(90deg, #ff6060, #cc2828)'` (red, hull low)

**Semantic hull threshold:**

- `HULL_CRITICAL_THRESHOLD = 0.3` — hull/hullMax < this triggers danger state

**Button gradient recipes (primary / secondary):**

- `BTN_PRI_BG = 'linear-gradient(135deg, #f2b640, #d4920e)'`
- `BTN_PRI_SHADOW = '0 4px 0 #9a6808, 0 6px 18px rgba(210, 140, 20, 0.3)'`
- `BTN_PRI_COLOR = '#071120'` (text on primary button)

### Acceptance Criteria

- `src/ui/tokens.ts` exists and compiles with zero TypeScript errors
- All exports are `const` — no `any`, no implicit types
- `pnpm build` succeeds

### Test Plan

Write `src/ui/tokens.test.ts`:

- Import `HULL_CRITICAL_THRESHOLD` and assert it equals `0.3`
- Import `GOLD` and assert it equals `'#f2b640'`
- Import `DUR_INSTANT` and assert it equals `80`
- Import `FONT_DISPLAY` and assert it contains `'Baloo 2'`
- All tests are trivial value assertions — they fail if the file does not exist or a token is renamed/removed

---

## Slice 2 — Store Extensions

**Priority:** MUST
**Complexity:** S
**Dependencies:** None (parallel with Slice 1)

### Scope

**Modify:** `src/store/gameStore.ts`, `src/store/selectors.ts`

### Changes to `gameStore.ts`

1. **Add `'paused'` to `GamePhase`:** [pending user confirmation — orchestrator recommends yes]

   ```
   export type GamePhase = 'title' | 'playing' | 'wave-clear' | 'game-over' | 'paused';
   ```

2. **Add `pauseGame()` and `resumeGame()` actions** to `GameState` interface and store implementation:
   - `pauseGame()`: calls `setPhase('paused')`, releases pointer lock conceptually (actual lock release is handled by the browser on pointer lock change; no store action needed for that)
   - `resumeGame()`: calls `setPhase('playing')`

3. **Add settings slice** to `GameState`:

   ```typescript
   musicVolume: number;   // 0–1, default 1.0
   sfxVolume: number;     // 0–1, default 1.0
   setMusicVolume: (v: number) => void;
   setSfxVolume: (v: number) => void;
   ```

   - Both setters also call `localStorage.setItem('gr_musicVol', ...)` and `localStorage.setItem('gr_sfxVol', ...)` inside the setter body
   - Hydrate initial values from `localStorage.getItem(...)` at store creation time (fall back to `1.0` if absent or NaN)

4. **Add `waveSunkSnapshot: number` field** (not an action — just a plain field that the wave system will update):
   - Initial value: `0`
   - Set it via a new `snapshotWaveSunk()` action that copies `enemiesSunkTotal` into `waveSunkSnapshot`
   - This enables the wave-clear overlay to show per-wave enemies sunk without a High complexity kill-feed system

### Changes to `selectors.ts`

Add these four new selectors:

```typescript
/** Currently active firing quadrant. */
export const useActiveQuadrant = () => useGameStore((s) => s.activeQuadrant);

/** Player weapon state (cooldownRemaining + cooldown). Null when no player. */
export const useWeaponState = () => useGameStore((s) => s.player?.weapons ?? null);

/** Audio settings. */
export const useAudioSettings = () =>
  useGameStore((s) => ({ musicVolume: s.musicVolume, sfxVolume: s.sfxVolume }));

/** Enemies sunk in the current wave (derived from snapshot). */
export const useWaveEnemiesSunk = () =>
  useGameStore((s) => s.enemiesSunkTotal - s.waveSunkSnapshot);
```

### Acceptance Criteria

- `GamePhase` includes `'paused'`
- `useGameStore.getState().pauseGame()` transitions `phase` to `'paused'`
- `useGameStore.getState().resumeGame()` transitions `phase` to `'playing'`
- `setMusicVolume(0.5)` updates `store.musicVolume` to `0.5` AND writes to localStorage
- `useWeaponState`, `useActiveQuadrant`, `useAudioSettings`, `useWaveEnemiesSunk` all export without error
- `pnpm build` succeeds; `pnpm verify` passes

### Test Plan

Write `src/store/gameStore.extensions.test.ts` (new file, keep separate from existing store tests):

- `playing → paused`: call `startGame()`, then `pauseGame()`, assert `phase === 'paused'`
- `paused → playing`: call `resumeGame()`, assert `phase === 'playing'`
- `setMusicVolume(0.7)`: assert `store.musicVolume === 0.7`
- `setSfxVolume(0.3)`: assert `store.sfxVolume === 0.3`
- `snapshotWaveSunk()`: set `enemiesSunkTotal` via a direct `applyDamage` sequence that sinks an enemy, then snapshot, sink another, assert `waveSunkSnapshot < enemiesSunkTotal`
- `useWeaponState` returns non-null after `startGame()`
- All tests must fail before the changes and pass after

---

## Slice 3 — Font Loading

**Priority:** MUST
**Complexity:** S
**Dependencies:** None (parallel with 1 and 2)

### Scope

**Modify:** `index.html` only

### Changes

Replace the current `<link>` loading `Black+Ops+One` and `Rajdhani` (lines 17–20 of `index.html`) with the Harbour Dawn font stack:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap"
  rel="stylesheet"
/>
```

Note: The art direction HTML already has this exact link tag. The `crossorigin` attribute on the preconnect to `fonts.gstatic.com` is required for cross-origin font fetching. The `display=swap` ensures text remains visible during font load.

**Also update `<title>` tag** if not already set to `"Gunboat Raiders"`.

### Acceptance Criteria

- `index.html` contains `Baloo+2` and `Nunito` in the Google Fonts `<link>` href
- `index.html` does NOT contain `Black+Ops+One` or `Rajdhani` in the `<link>` href
- Both `<link rel="preconnect">` tags present with `crossorigin` on the gstatic one
- `pnpm build` succeeds

### Test Plan

No unit test needed — acceptance is verified via `pnpm build` success and Playwright visual check in the first screen slice that ships.

---

## Slice 4 — HealthBar Overhaul

**Priority:** MUST
**Complexity:** M
**Dependencies:** Slices 1, 3

### Scope

**Modify:** `src/ui/HealthBar.tsx`
**Do not modify:** `src/ui/HUD.tsx` (no structural change needed — `<HealthBar />` already rendered there)

### Implementation

Rewrite `HealthBar.tsx` to match the Harbour Dawn component spec from `docs/art-direction/index.html` (`.health-wrap`, `.health-track`, `.health-fill` pattern). All colors and dimensions MUST be imported from `src/ui/tokens.ts`.

**Layout:** Two stacked bars, armor on top, hull below. Position: `bottom: '2rem', left: '2rem'`, fixed width `200px`.

**Armor bar:**

- Label: `"ARMOR"` — `TEXT_MUTED` color, 10px, weight 800, letter-spacing 0.08em, uppercase
- Fill color: `TEAL` gradient (`HEALTH_FULL_GRADIENT`) at full; transition to `HEALTH_DAMAGED_GRADIENT` when `armor < armorMax * 0.5`
- Track: height 14px, background `BG_DEEP`, border-radius 7px, border `1px solid BORDER_SUB`, overflow hidden
- Numeric readout: `"armor / armorMax"` in 10px Courier New, `TEXT_MUTED`, rendered below the track

**Hull bar:**

- Label: `"HULL"` — same label style as armor
- Fill: `HEALTH_FULL_GRADIENT` (teal) when `hullPct > 0.6`; `HEALTH_DAMAGED_GRADIENT` (amber) when `0.3 < hullPct <= 0.6`; `HEALTH_CRITICAL_GRADIENT` (red) with `hpflash` animation when `hullPct <= HULL_CRITICAL_THRESHOLD`
- Apply `outline: '2px solid #ff8080', outlineOffset: '1px'` to the track div when hull is critical (`.health-flash` pattern from art direction)
- Numeric readout below track

**Per-frame update pattern:** The existing `HealthBar.tsx` uses React state (re-renders on selector change). This is acceptable since health updates are event-driven (not every-frame). Do NOT switch to direct DOM mutation — that adds complexity without benefit here. Keep the `usePlayerHealth()` selector.

**Remove all references to:**

- `'Rajdhani'`, `'Black Ops One'` fonts — use `FONT_UI` or `FONT_DISPLAY` from tokens
- Hardcoded hex colors `'#0695b4'`, `'#ef4444'`, `'#f97316'`, `'#94a3b8'`, `'#e2e8f0'` — use token constants

### Acceptance Criteria

- `HealthBar.tsx` imports only from `../ui/tokens` for all color/font/spacing values (no raw hex strings in the file body)
- Armor bar uses teal gradient (`TEAL` family) at full health
- Hull bar fill is red with `hpflash` animation when `hullPct <= 0.3`
- Critical hull state adds `outline: '2px solid #ff8080'` on the track element
- No `'Rajdhani'` or `'Black Ops One'` font references remain in the file
- `pnpm verify` passes

### Test Plan

Write `src/ui/HealthBar.test.tsx`:

- Render with `armor=100, armorMax=100, hull=100, hullMax=100` — assert armor fill uses teal gradient class/style
- Render with `armor=0, armorMax=100, hull=25, hullMax=100` — assert hull fill uses critical red gradient; assert outline is applied on the hull track
- Render with `armor=0, armorMax=100, hull=60, hullMax=100` — assert hull fill uses amber gradient
- Assert no raw hex string `'#0695b4'` appears in rendered output
- Use `@testing-library/react` with jsdom (already in project)

---

## Slice 5 — WaveCounter Overhaul

**Priority:** MUST
**Complexity:** S
**Dependencies:** Slices 1, 3

### Scope

**Modify:** `src/ui/WaveCounter.tsx` only

### Implementation

Restyle to Harbour Dawn typography. The wave number is a large display element; enemies remaining is a smaller secondary line.

**Wave number display:**

- Font: `FONT_DISPLAY` (`'Baloo 2', sans-serif`), weight 800, size `clamp(1.4rem, 3.5vw, 2.2rem)`
- Color: `TEXT_PRI` (`#ffffff`)
- Text shadow: `0 2px 0 ${BG_DEEP}` (subtle depth lift from art direction `.wave-number` pattern)
- Letter spacing: 0.02em

**"WAVE" label above the number:**

- Currently `"WAVE 3"` is a single string. Keep as `"WAVE {wave}"` single string — the Harbour Dawn `.wave-label` style uses gold for the label, but since this is a combined string in a single `<p>`, apply gold color (`GOLD`) to the whole element. This matches the wave indicator pattern.

**Enemies remaining line:**

- Font: `FONT_UI` (`'Nunito', sans-serif`), weight 700, size `0.85rem`
- Color: `TEXT_MUTED` (`#7aaac8`)
- Letter spacing: 0.1em, uppercase
- Text: `"{remaining} REMAINING"` — already implemented, just restyle
- Hidden when `remaining === 0` — already implemented, preserve

**Position:** Unchanged — `top: '1.5rem', left: '50%, transform: translateX(-50%)'`

**Remove:** `'Black Ops One'` font reference

### Acceptance Criteria

- Wave number uses `FONT_DISPLAY` and `TEXT_PRI`
- Enemies remaining uses `FONT_UI` and `TEXT_MUTED`
- No `'Black Ops One'` or `'Rajdhani'` font references remain
- Import all colors from `src/ui/tokens.ts`
- `pnpm verify` passes

### Test Plan

Write `src/ui/WaveCounter.test.tsx`:

- Render with `wave=3, enemiesRemaining=5` — assert text "WAVE 3" is present; "5 REMAINING" is present
- Render with `wave=3, enemiesRemaining=0` — assert "0 REMAINING" is NOT in the document
- Render with `wave=0` — assert component renders null (existing behavior, must be preserved)

---

## Slice 6 — ScoreDisplay Overhaul

**Priority:** MUST
**Complexity:** S
**Dependencies:** Slices 1, 3

### Scope

**Modify:** `src/ui/ScoreDisplay.tsx` only

### Implementation

Restyle to Harbour Dawn's `.score-disp` pattern.

**Score number:**

- Font: `FONT_DISPLAY`, weight 800, size `clamp(1.1rem, 2.8vw, 1.8rem)`
- Color: `GOLD` (`#f2b640`) — score is a motivational accent, gold is the energy color
- Line height: 1

**"SCORE" label** (add this — currently the component shows only the number):

- Font: `FONT_UI`, weight 700, size 10px, letter-spacing 0.06em, uppercase
- Color: `TEXT_MUTED`
- Position: Above the number (label-first layout)

**Position:** Unchanged — `top: '1.5rem', right: '2rem'`

**Remove:** `'Rajdhani'` font reference, hardcoded `'#e2e8f0'`

### Acceptance Criteria

- Score value uses `GOLD` and `FONT_DISPLAY`
- A "SCORE" label in `TEXT_MUTED` is rendered above or alongside the value
- `formatScore` still formats with locale thousands separators
- No raw hex or font references outside of tokens import
- `pnpm verify` passes

### Test Plan

Write `src/ui/ScoreDisplay.test.tsx`:

- Render with `score=12450` — assert `"12,450"` is in the document
- Render with `score=0` — assert `"0"` is in the document
- Assert a "SCORE" label element is rendered

---

## Slice 7 — EnemiesRemainingCounter (new component)

**Priority:** MUST
**Complexity:** S
**Dependencies:** Slices 1, 3

### Scope

**Create:** `src/ui/EnemiesRemainingCounter.tsx`
**Modify:** `src/ui/HUD.tsx` — add `<EnemiesRemainingCounter />` inside the HUD div
**Modify:** `src/ui/WaveCounter.tsx` — remove the enemies-remaining line from `WaveCounter.tsx` (it is now a separate component). This avoids a single component managing two concerns.

NOTE: The layout proposal shows enemies remaining directly below the wave counter (same top-center anchor). The separate component renders at `top: 'calc(1.5rem + 2.8rem)', left: '50%', transform: 'translateX(-50%)'` to position just below the wave counter.

### Implementation

- Reads `useEnemiesRemaining()` from selectors
- Renders `null` when `remaining === 0` (hidden on wave clear)
- Text: `"{remaining} REMAINING"`
- Font: `FONT_UI`, weight 700, 0.85rem, `TEXT_MUTED`, uppercase, letter-spacing 0.1em
- Smooth appearance: use CSS `opacity` transition 200ms for enter/exit (not unmount — keep mounted but opacity 0 when zero, so layout does not shift)

### Acceptance Criteria

- `EnemiesRemainingCounter` renders `"4 REMAINING"` when `enemiesRemaining === 4`
- When `enemiesRemaining === 0`, rendered element has `opacity: 0` (not unmounted)
- `WaveCounter.tsx` no longer renders the enemies-remaining line
- `HUD.tsx` imports and renders `EnemiesRemainingCounter`
- `pnpm verify` passes

### Test Plan

Write `src/ui/EnemiesRemainingCounter.test.tsx`:

- Render with `enemiesRemaining=3` — assert `"3 REMAINING"` in document
- Render with `enemiesRemaining=0` — assert the element has `opacity: 0` style (not absent from DOM)

---

## Slice 8 — WeaponCooldownIndicator (new component)

**Priority:** SHOULD
**Complexity:** M
**Dependencies:** Slices 1, 2, 3 (needs `useWeaponState` and `useActiveQuadrant` selectors from Slice 2)

### Scope

**Create:** `src/ui/WeaponCooldownIndicator.tsx`
**Modify:** `src/ui/HUD.tsx` — add `<WeaponCooldownIndicator />` inside the HUD div

### Design decision (orchestrator note — two options, dev agent to pick one)

**Option A — Reloading arc around cursor:**
A small circular arc SVG (32px) that follows the cursor position. Uses `pointer-events: none`. Draws from 0% to `cooldownPct` as a stroked arc. Color: `OCEAN` when reloading, `TEAL` when ready. Requires listening to `mousemove` in a `useEffect` and updating a `ref` position via direct DOM mutation (no React re-render on mouse move).

**Option B — Thin bar at the base of the active weapon context:**
A fixed-position bar (180px wide, 4px tall) at `bottom: '6.5rem', left: '2rem'` (just above the health bars). Label: `"RELOAD"` in 9px `TEXT_MUTED` above the bar. Fill: `OCEAN` gradient sweeping left to right as cooldown expires. Color snaps to `TEAL` when `cooldownRemaining === 0` (ready). No cursor tracking needed.

**Recommendation:** Option B is simpler to implement, test, and read at a glance. Option A is more arcade-feel and cursor-proximate. Choose whichever better fits the existing trajectory-line UI after inspecting it at runtime.

### Common implementation requirements (both options)

- Reads `useWeaponState()` and `useActiveQuadrant()` from selectors
- Computes `cooldownPct = cooldownRemaining[activeQuadrant] / cooldown` (0 = ready, 1 = full cooldown)
- When `cooldownPct === 0`, show a "READY" state (teal color, no fill or full fill depending on design)
- Update is event-driven (React re-render when store changes) — cooldown state updates happen on each physics step, which is fast but React batching handles it. Do NOT force every-frame DOM mutation for this element.
- Hidden entirely while `phase !== 'playing'`

### Acceptance Criteria

- Component renders during `phase === 'playing'`
- `cooldownPct > 0` → fill/arc uses `OCEAN` color
- `cooldownPct === 0` → ready state uses `TEAL` color
- No raw hex colors outside tokens import
- `pnpm verify` passes

### Test Plan

Write `src/ui/WeaponCooldownIndicator.test.tsx`:

- Render with mocked `weaponState.cooldown=2, cooldownRemaining={fore:1,...}` and `activeQuadrant='fore'` → assert element present with ocean-color indicator
- Render with `cooldownRemaining={fore:0,...}` → assert ready/teal state shown
- Render with `phase='title'` → assert component returns null

---

## Slice 9 — LowHullWarning

**Priority:** SHOULD
**Complexity:** S
**Dependencies:** Slices 1, 4 (conceptual dependency — should land after HealthBar so the critical threshold is consistent)

### Scope

**Create:** `src/ui/LowHullWarning.tsx`
**Modify:** `src/ui/HUD.tsx` — add `<LowHullWarning />` inside the HUD div

### Implementation

A full-viewport danger overlay (no layout footprint — `position: fixed, inset: 0, pointer-events: none, z-index: 5`).

When `hull / hullMax < HULL_CRITICAL_THRESHOLD` (import from tokens):

- Renders a radial-gradient "vignette" element: `background: radial-gradient(ellipse at center, transparent 40%, rgba(204, 51, 51, 0.35) 100%)`
- Applies CSS `animation: lowHullPulse 0.8s ease-in-out infinite alternate`
- Animation: opacity 0.5 → 1.0 (creates pulsing edge glow)

When hull is above threshold: renders `null`.

Uses `usePlayerHealth()` selector directly (already in selectors.ts).

Inject the `@keyframes lowHullPulse` via a `<style>` tag (same pattern as the existing `PointerLockHint` — inject once, render alongside the overlay div).

### Acceptance Criteria

- `LowHullWarning` renders when `hull / hullMax < 0.3`
- It renders `null` when `hull / hullMax >= 0.3`
- It does not block pointer events (`pointer-events: none`)
- Vignette is a `radial-gradient` using `RED_DARK` or equivalent danger color from tokens
- `pnpm verify` passes

### Test Plan

Write `src/ui/LowHullWarning.test.tsx`:

- Render with `hull=25, hullMax=100` (25% — below threshold) → assert element is in the document
- Render with `hull=50, hullMax=100` (50% — above threshold) → assert element is null/absent
- Render with `hull=30, hullMax=100` (exactly at threshold, should NOT trigger — 30/100 = 0.3, not < 0.3) → assert element is null

---

## Slice 10 — PointerLockHint Autofade

**Priority:** MUST
**Complexity:** S
**Dependencies:** Slices 1, 3

### Scope

**Modify:** `src/ui/PointerLockHint.tsx` only

### Changes

Current behavior: hint shows whenever pointer lock is NOT active.
Required behavior:

1. On first pointer lock acquire (after page load), start a 4-second countdown
2. After 4 seconds, set `hasFaded = true` — hint will no longer auto-show even if lock is released
3. If pointer lock is released AFTER the 4-second fade, the hint reappears (user may have accidentally exited lock and needs the reminder)

Wait — re-reading the orchestrator note: "auto-fade after ~4s on first pointer lock acquire, and reappear if pointer lock is released." This means:

- The hint is visible when lock is NOT active (existing behavior)
- When lock IS first acquired, start a 4s timer — if the player holds lock for 4 seconds, the hint is considered "seen" and should fade away permanently for that session
- But if lock is released at ANY point, the hint should reappear (the release itself is the trigger — player needs to click again)
- So the "autofade after 4s" applies to a case where the hint would otherwise persist after releasing lock a second time: after the first successful 4s lock session, subsequent brief lock releases do NOT re-show the hint

Implementation simplification: The simplest correct behavior matching the intent:

- Track `hasHeldLockOnce: boolean` in component state (default false)
- When lock is acquired, start a `setTimeout(4000)` — if it fires while still locked, set `hasHeldLockOnce = true`
- Show hint only when: `!isLocked && !hasHeldLockOnce`
- When pointer lock is released after `hasHeldLockOnce`, DO reappear (since user explicitly left lock): clear `hasHeldLockOnce` reset — wait, this contradicts. Let's match the literal orchestrator instruction: "reappear if pointer lock is released." So the hint ALWAYS reappears when lock is released. The autofade is: after 4s with lock active, the hint fades away (but it was already hidden because `isLocked === true`). On next release, hint shows again.

Correct interpretation: The current behavior (hide when locked, show when not) is correct for reappear-on-release. The "autofade" means: when lock is released AFTER the player has held it for > 4 seconds total, do NOT show the hint again (they've proven they know how to re-lock). But for MVP and given the deadline, the simpler interpretation is:

- Keep existing hide-when-locked / show-when-released behavior
- Add: CSS opacity transition so the hint fades in gracefully (0 → 1 over `DUR_MEDIUM = 300ms`) instead of appearing instantly
- Add: After lock is acquired for the first time and held 4s, set a sessionStorage flag `gr_hintSeen=1` — if this flag is set, do not show the hint again this session

Use `sessionStorage` (not localStorage) so it resets on new tab/page load.

### Acceptance Criteria

- Hint is hidden (`display: none` or `opacity: 0`) when pointer lock is active
- Hint appears (with fade-in CSS transition) when pointer lock is released
- After pointer lock is held for 4 continuous seconds, `sessionStorage.setItem('gr_hintSeen', '1')` is called
- If `sessionStorage.getItem('gr_hintSeen') === '1'`, hint does not render at all
- Remove `'Rajdhani'` font reference; use `FONT_UI` from tokens
- `pnpm verify` passes

### Test Plan

Write `src/ui/PointerLockHint.test.tsx`:

- Render when `document.pointerLockElement === null` (no lock) and `sessionStorage` empty — assert element is in document
- Render when `sessionStorage.getItem('gr_hintSeen') === '1'` — assert element is absent
- Simulate pointer lock change event to locked state — assert element becomes hidden
- The 4-second timer test: use `vi.useFakeTimers()`, simulate lock acquire, advance by 4001ms, assert `sessionStorage.getItem('gr_hintSeen')` equals `'1'`

---

## Slice 11 — TitleScreen Overhaul

**Priority:** MUST
**Complexity:** M
**Dependencies:** Slices 1, 2, 3

### Scope

**Modify:** `src/ui/TitleScreen.tsx`

### Implementation

Restyle and extend the existing `TitleScreen.tsx`. Do NOT restructure App.tsx or change how TitleScreen is mounted.

**Layout** (based on layout proposal Screen 1 + Harbour Dawn `.title-treatment` pattern):

- Overlay: `position: absolute, inset: 0, zIndex: 20`
- Background: `linear-gradient(150deg, #1a3e68 0%, ${BG} 55%, ${BG_DEEP} 100%)` with a subtle bottom glow div (`background: linear-gradient(0deg, rgba(242,182,64,0.07) 0%, transparent 100%), height: '40%', position: 'absolute', bottom: 0, left: 0, right: 0`)
- No `backdropFilter: blur` on the title overlay (the ocean behind should be visible and sharp — blur cheapens the effect)

**Title block** (CENTER, ~38vh):

- "GUNBOAT RAIDERS" in `FONT_DISPLAY`, weight 800, `clamp(52px, 8vw, 88px)`
- Color: `TEXT_PRI`, text-shadow: `0 3px 0 #04101e, 0 6px 28px rgba(0,0,0,0.5)`
- Letter spacing: 0.03em, line-height: 0.9

**Tagline** (~48vh, below title):

- "Survive the waves. Sink the rest." in `FONT_UI`, weight 700, 15px
- Color: `GOLD`, letter-spacing: 0.06em

**Start Button** (~58vh):

- Style using `BTN_PRI_BG`, `BTN_PRI_SHADOW`, `BTN_PRI_COLOR` from tokens
- Font: `FONT_DISPLAY`, weight 800, 17px, letter-spacing 0.04em, padding `13px 52px`
- Hover: `translateY(-1px)` + enhanced shadow (match art direction `.btn-pri:hover`)
- Active: `translateY(2px)` + reduced shadow

**Settings Button** (~66vh): [pending user confirmation — include per orchestrator default]

- Style: `.btn-sec` pattern — border `2px solid BORDER`, background `SURFACE`, color `TEXT_PRI`
- Font: `FONT_DISPLAY`, weight 700, 16px
- Hover: `border-color: GOLD, color: GOLD`
- On click: call `store.setPhase('settings')` — NOTE: this requires `'settings'` as a phase OR a local `showSettings` state. Since we are not adding a `'settings'` phase to the store (would need store coordination), use a local React `useState<'title' | 'settings'>('title')` inside TitleScreen to toggle between showing the title buttons and showing the inline SettingsScreen. This avoids a store phase change.

**Controls Hint** (~92vh, BOTTOM-CENTER):

- `"Press [H] for controls"` in `FONT_UI`, weight 700, 13px, `TEXT_MUTED`

**Version Tag** (~95vh, BOTTOM-RIGHT): [NICE — include only if not adding complexity]

- `"Three.js Water Pro Giveaway 2026"` or build date in `FONT_UI`, 11px, `TEXT_DIM`
- `position: absolute, bottom: '1rem', right: '1.5vw'`

**Keyboard shortcut:** Add `useEffect` that listens to `keydown` — `Enter` or `Space` triggers `startGame()`.

**Enter/exit animation:**

- Use CSS class toggling with a `<style>` tag injection for `@keyframes titleFadeIn { from { opacity: 0; transform: scale(1.05); } to { opacity: 1; transform: scale(1); } }`
- Apply `animation: titleFadeIn 0.4s ease-out forwards` on the overlay

**Remove:** All `'Black Ops One'`, `'Rajdhani'` font references; all hardcoded hex colors not from tokens

### Acceptance Criteria

- `data-testid="title-screen"` still present
- `data-testid="start-button"` still present and calls `startGame()`
- A Settings button is rendered with `data-testid="settings-button"`
- A controls hint text is rendered with `data-testid="controls-hint"`
- No `'Black Ops One'` or `'Rajdhani'` font references in the file
- All colors from `src/ui/tokens.ts`
- Clicking Start when `phase === 'title'` transitions to `phase === 'playing'`
- `pnpm verify` passes

### Test Plan

Extend or replace existing `TitleScreen` test (check for existing test file with `TitleScreen`):

- Render with `phase='title'` — assert title screen visible
- Render with `phase='playing'` — assert null returned
- Click `data-testid="start-button"` — assert `useGameStore.getState().phase === 'playing'`
- Assert `data-testid="settings-button"` present
- Assert `data-testid="controls-hint"` present
- Press `Enter` keydown event — assert `startGame()` was called (spy on store)

---

## Slice 12 — Wave-Clear / Wave-Announcement Overlay

**Priority:** MUST
**Complexity:** M
**Dependencies:** Slices 1, 2, 3

### Scope

**Create:** `src/ui/WaveAnnouncement.tsx`
**Modify:** `src/ui/HUD.tsx` — add `<WaveAnnouncement />` at the end of the HUD div (renders on top of other HUD elements when active)

### Implementation

Single component, two visual sub-phases driven by local `useState` timer within the 3-second `wave-clear` phase window. [pending user confirmation — orchestrator decision: one overlay, two sub-phases, no new store phase]

**Phase 1: WAVE CLEARED (0–1.5s)**

- Letterbox bars: two `position: absolute` divs, `height: '8vh'`, `background: BG_DEEP` — top one enters from `top: -8vh` to `top: 0`, bottom from `bottom: -8vh` to `bottom: 0`. Use CSS `transition: 0.3s ease-out` triggered by mounting.
- Headline "WAVE CLEARED": `FONT_DISPLAY`, weight 800, `clamp(48px, 8vw, 80px)`, `TEXT_PRI`, `text-shadow: 0 3px 0 ${BG_DEEP}`, centered, ~40vh. Animates in: `scale(1.3) opacity(0)` → `scale(1) opacity(1)` over 300ms.
- Wave score bonus "+500": `FONT_DISPLAY`, weight 800, `clamp(28px, 5vw, 48px)`, `GOLD`, centered, ~48vh. Appears 400ms after headline.
- Wave stat "ENEMIES SUNK: {n}": uses `useWaveEnemiesSunk()` selector from Slice 2. `FONT_UI`, weight 700, 16px, `TEXT_SEC`, centered, ~56vh. Appears 600ms after headline. [NICE — wrap in conditional: only render if `waveEnemiesSunk > 0`]

**Phase 2: NEXT WAVE INCOMING (1.5s–3.0s)** — swap headline

- Transition at 1.5s: fade headline out, fade new headline "WAVE {n+1} INCOMING" in
- New headline: same style as above but shows next wave number (`store.wave + 1`)
- Keep letterbox bars visible throughout both sub-phases
- Countdown: no numerical countdown timer — the prop "INCOMING" is sufficient given the short window

**Phase 3: Exit (at 3s)**

- Letterbox bars retract (CSS transition reverse)
- Overlay fades out (`opacity: 0` over 200ms)
- Component renders null after exit animation completes

**Implementation approach:**

- Mount when `phase === 'wave-clear'`
- Use `useEffect` with `setTimeout` to drive phase 1 → 2 → 3 transitions
- Do not depend on the store phase transitions for sub-phase timing — manage locally
- The existing game system handles transitioning the store from `wave-clear` back to `playing` at the ~3s mark; this component just reads the phase and animates accordingly

**HUD visibility note:** HUD persists during `wave-clear`. The WaveAnnouncement renders on top of it. The `HUD.tsx` already shows during `phase === 'wave-clear'` (existing code: `if (phase !== 'playing' && phase !== 'wave-clear') return null`). No change needed to HUD gate condition.

### Acceptance Criteria

- `WaveAnnouncement` renders when `phase === 'wave-clear'`
- `WaveAnnouncement` renders null when `phase === 'playing'`
- "WAVE CLEARED" text present in document during wave-clear phase
- "WAVE {n+1} INCOMING" text present in document 1.5s after mounting (use fake timers in test)
- Letterbox bars are rendered (two `div` elements with `position: absolute`, `top: 0` and `bottom: 0`)
- `pnpm verify` passes

### Test Plan

Write `src/ui/WaveAnnouncement.test.tsx` using `vi.useFakeTimers()`:

- Render with `phase='wave-clear', wave=2` — assert "WAVE CLEARED" in document
- Advance timers by 1500ms — assert "WAVE 3 INCOMING" in document (and "WAVE CLEARED" is gone or faded)
- Render with `phase='playing'` — assert null
- Assert two letterbox bar elements are present when `phase='wave-clear'`

---

## Slice 13 — PauseMenu

**Priority:** MUST [pending user confirmation — orchestrator recommends yes]
**Complexity:** M
**Dependencies:** Slices 1, 2, 3 (needs `'paused'` phase from Slice 2; needs `pauseGame()` / `resumeGame()` actions)

### Scope

**Create:** `src/ui/PauseMenu.tsx`
**Modify:** `src/ui/HUD.tsx` — add `<PauseMenu />` inside the HUD div (or as sibling — it must render when `phase === 'paused'`, which is outside the HUD gate condition currently; adjust HUD gate or render PauseMenu in App.tsx)

NOTE: `HUD.tsx` currently gates on `phase !== 'playing' && phase !== 'wave-clear'`. PauseMenu needs to show during `phase === 'paused'`. Options:

1. Add `'paused'` to the HUD gate condition (simplest)
2. Render PauseMenu separately in App.tsx alongside HUD

**Recommendation:** Option 1 — add `'paused'` to HUD gate: `if (phase !== 'playing' && phase !== 'wave-clear' && phase !== 'paused') return null`. This keeps all overlay components co-located in HUD.

**Also modify:** `src/systems/InputSystemR3F.tsx` (or wherever Escape is handled) — add Escape key handler that calls `pauseGame()` when `phase === 'playing'`, and `resumeGame()` when `phase === 'paused'`.

**Also modify:** `src/App.tsx` — add `paused={phase === 'paused'}` prop to `<Physics>` component (line ~93). This halts the physics simulation while paused. Check if `@react-three/rapier` `Physics` component accepts a `paused` prop — it does as of v2.

### PauseMenu component

Layout: full-viewport overlay (`position: absolute, inset: 0, zIndex: 30`). Background: `rgba(7,17,32,0.82)` with `backdropFilter: blur(8px)`. Game world visible behind (semi-transparent).

Center panel: `background: SURFACE, border: 1px solid BORDER, border-radius: RADIUS_XL, padding: SP_10, max-width: 440px` — use `.modal-overlay` pattern from art direction.

**"PAUSED" title:** `FONT_DISPLAY`, weight 800, 28px, `TEXT_PRI`

**Buttons (using `.menu-item` pattern):**

- Resume — `data-testid="pause-resume-btn"` — calls `resumeGame()` then re-requests pointer lock (call `document.getElementById('game-canvas')?.requestPointerLock()` or equivalent)
- Restart — `data-testid="pause-restart-btn"` — calls `startGame()`
- Quit to Title — `data-testid="pause-quit-btn"` — calls `resetGame()`
- Settings (SHOULD — same local state trick as TitleScreen) — shows inline SettingsScreen

Each button: `display: flex, align-items: center, gap: SP_3, padding: SP_3 SP_4, border-radius: RADIUS_MD, cursor: pointer, font-weight: 700, font-size: 16px, border: 1px solid transparent, color: TEXT_SEC`. Hover: `background: SURFACE_EL, border-color: BORDER, color: TEXT_PRI`.

**Run summary** (NICE — include if not adding complexity): Below buttons, `FONT_UI`, 13px, `TEXT_MUTED`: `"Wave {wave} — Score {score}"`

### Acceptance Criteria

- `data-testid="pause-menu"` is present when `phase === 'paused'`
- `data-testid="pause-menu"` is absent when `phase === 'playing'`
- Pressing Escape during `phase='playing'` → `phase` becomes `'paused'`
- Pressing Escape again during `phase='paused'` → `phase` becomes `'playing'`
- Clicking Resume → `phase` becomes `'playing'`
- Clicking Restart → `phase` becomes `'playing'` with `wave === 1`
- Clicking Quit to Title → `phase` becomes `'title'`
- `<Physics paused={phase === 'paused'}>` prop is wired in `App.tsx`
- `pnpm verify` passes

### Test Plan

Write `src/ui/PauseMenu.test.tsx` + extend `src/store/gameStore.extensions.test.ts`:

- Render with `phase='paused'` — assert `data-testid="pause-menu"` present
- Render with `phase='playing'` — assert element absent
- Click `data-testid="pause-resume-btn"` — assert `phase === 'playing'`
- Click `data-testid="pause-restart-btn"` — assert `phase === 'playing'` and `wave === 1`
- Click `data-testid="pause-quit-btn"` — assert `phase === 'title'`
- Store test: `playing → paused → playing` phase cycle via `pauseGame()` / `resumeGame()`

---

## Slice 14 — GameOverScreen Overhaul

**Priority:** MUST
**Complexity:** M
**Dependencies:** Slices 1, 3

### Scope

**Modify:** `src/ui/GameOverScreen.tsx`

### Implementation

**Background:** `background: rgba(7,17,32,0.88)`, `backdropFilter: blur(8px)` — matches `.modal-overlay` spirit but full-screen. Darker tone than pause (player is out of the run).

**"SUNK" headline (~30vh):**

- `FONT_DISPLAY`, weight 800, `clamp(56px, 12vw, 100px)`
- Color: `RED` (`#ff8080`)
- Text shadow: `0 0 40px rgba(255,128,128,0.5), 0 4px 16px rgba(0,0,0,0.9)`

**Stats (~45–57vh):**

- "Waves Survived" / "Enemies Sunk" / "Final Score" — sequential layout
- Label font: `FONT_UI`, weight 600, 1.2rem, letter-spacing 0.08em, `TEXT_SEC`
- Value font: `FONT_DISPLAY`, weight 700, same size, `TEXT_PRI`

**Score counter animation:**

- The "Final Score" value should count up from 0 to `score` over 1.5 seconds using a `useEffect` + `setInterval` inside the component (fire on mount)
- Interval ticks: approximately 60 ticks at 25ms each, incrementing by `score / 60` per tick
- Cancel interval when component unmounts

**Play Again button (~67vh):**

- Style with `BTN_PRI_BG`, `BTN_PRI_SHADOW`, `BTN_PRI_COLOR` — same as Start button

**"MAIN MENU" button (~74vh):** [SHOULD — include per proposal]

- Style: `.btn-sec` pattern — `border: 2px solid BORDER, background: SURFACE, color: TEXT_PRI`
- On click: calls `resetGame()`, transitions to `phase: 'title'`
- `data-testid="main-menu-button"`

**Keyboard shortcut:** `Enter` / `Space` → Play Again (add `useEffect` for keydown)

**Remove:** All `'Black Ops One'`, `'Rajdhani'` font references; hardcoded `'#ef4444'`, `'#94a3b8'`, `'#e2e8f0'`

### Acceptance Criteria

- `data-testid="game-over-screen"` present when `phase === 'game-over'`
- `data-testid="play-again-button"` present and calls `startGame()`
- `data-testid="main-menu-button"` present and calls `resetGame()`
- Final score displays with thousands-separator formatting
- Score counter starts at 0 on mount and increments to `score` value
- No `'Black Ops One'` or `'Rajdhani'` references
- All colors from tokens
- `pnpm verify` passes

### Test Plan

Extend existing GameOverScreen tests (find existing test file):

- `phase='game-over'` → assert screen visible
- `phase='playing'` → assert null
- Click `data-testid="play-again-button"` → `phase === 'playing'`
- Click `data-testid="main-menu-button"` → `phase === 'title'`
- Score counter: use `vi.useFakeTimers()`, render with `score=1000`, advance timers by 1500ms, assert displayed value is `"1,000"`

---

## Slice 15 — SettingsScreen MVP

**Priority:** SHOULD [pending user confirmation — orchestrator recommends volume-only]
**Complexity:** M
**Dependencies:** Slices 1, 2, 3, 11 (TitleScreen settings button), 13 (PauseMenu settings entry)

### Scope

**Create:** `src/ui/SettingsScreen.tsx`
**No new store changes** — `musicVolume`, `sfxVolume`, `setMusicVolume`, `setSfxVolume` were added in Slice 2

### Implementation

Inline component — rendered by TitleScreen (when its local state is `'settings'`) and by PauseMenu (when its local state is `'settings'`). Accepts a `onBack: () => void` prop.

**Layout:** Full-viewport overlay, same background as PauseMenu. Center panel same `.modal-overlay` pattern.

**"SETTINGS" title:** `FONT_DISPLAY`, weight 800, 28px, `TEXT_PRI`

**Music Volume slider:**

- Label: `"MUSIC"` in `FONT_UI`, 11px, weight 800, uppercase, letter-spacing 0.08em, `TEXT_MUTED`
- `<input type="range" min="0" max="100" value={Math.round(musicVolume * 100)}`
- On change: calls `setMusicVolume(value / 100)` AND `Howler.volume(value / 100)` for immediate audio effect
- Numeric readout: current value as integer percentage
- `data-testid="music-slider"`

**SFX Volume slider:**

- Same pattern, uses `sfxVolume` / `setSfxVolume`
- On change: affects Howler SFX pool — call `Howler.volume()` is global. For per-category SFX volume, this requires tagging Howl instances. At MVP, global `Howler.volume()` is acceptable for the SFX slider if separate music/SFX categories are not yet wired. Document this limitation in a TODO comment.
- `data-testid="sfx-slider"`

**Back button:**

- Calls `onBack()` prop
- `data-testid="settings-back-btn"`
- Style: `.btn-sec` pattern

**Persistence:** `setMusicVolume` and `setSfxVolume` already write to localStorage (from Slice 2 implementation). No additional persistence logic needed here.

**Hydration on load:** localStorage values are read at store creation time (Slice 2). No component-level hydration needed.

### Acceptance Criteria

- `data-testid="settings-screen"` visible when rendered
- Music slider range input present with `data-testid="music-slider"`
- SFX slider range input present with `data-testid="sfx-slider"`
- Changing music slider calls `setMusicVolume` with `value / 100`
- Clicking Back calls `onBack()`
- `pnpm verify` passes

### Test Plan

Write `src/ui/SettingsScreen.test.tsx`:

- Render with `musicVolume=1.0, sfxVolume=1.0` — assert both sliders present
- Fire `change` on music slider with value 50 — assert `setMusicVolume(0.5)` was called
- Fire `change` on sfx slider with value 30 — assert `setSfxVolume(0.3)` was called
- Click back button — assert `onBack` spy was called once

---

## Slice 16 — ControlsOverlay

**Priority:** SHOULD
**Complexity:** S
**Dependencies:** Slices 1, 3

### Scope

**Create:** `src/ui/ControlsOverlay.tsx`
**Modify:** `src/ui/HUD.tsx` — add `<ControlsOverlay />` inside the HUD div (visible during `phase === 'playing'`)
**Modify:** `src/ui/TitleScreen.tsx` — add `<ControlsOverlay />` rendering (visible during `phase === 'title'`)
**Modify:** Wherever keyboard input is handled — add H / ? key listeners to toggle controls overlay

### Implementation

A panel — NOT full-screen. Slides in from the right edge during gameplay. Uses `position: absolute, right: '3vw', top: '15vh'` during gameplay; centered during title screen (same position as other title overlays).

**Panel container:**

- `background: rgba(7,17,32,0.9)`, `border: 1px solid BORDER`, `border-radius: RADIUS_LG`, `padding: SP_6`
- Width: `min(280px, 35vw)`
- Slide-in animation: `transform: translateX(100%)` → `translateX(0)` over 200ms `EASE_OUT`

**"CONTROLS" header:** `FONT_DISPLAY`, weight 700, 22px, `TEXT_PRI`

**Close button (top-right corner):** "X", `btn-icon` pattern, calls `setOpen(false)`; `data-testid="controls-close"`

**Keybind sections** (each is a labeled group):

Movement:

```
W — Forward thrust
S — Reverse
A — Turn port (left)
D — Turn starboard (right)
```

Camera / Aiming:

```
Mouse — Rotate camera / aim
Click — Fire active quadrant
```

UI:

```
Escape — Pause / resume
H or ? — Toggle controls
```

Each row: `FONT_UI`, 14px. Key label: monospace pill (small `background: SURFACE_EL, border: 1px solid BORDER, border-radius: RADIUS_SM, padding: 1px 6px, font-size: 12px, FONT_DISPLAY`). Action label: `TEXT_SEC`.

**Quadrant diagram (SHOULD):**
Simple CSS-drawn diagram using `FONT_UI` monospace layout or a `<pre>` block:

```
     FORE (2)
PORT (4) ⊕ (4) STARBOARD
     AFT (1)
```

Color: `TEXT_MUTED`. Label: "Cannons per quadrant".

**State:** Local `useState<boolean>(false)` for open/closed. No store involvement.

**H / ? key listener:** `useEffect` with `document.addEventListener('keydown', handler)` — toggles open state. Handler checks `event.key === 'h' || event.key === 'H' || event.key === '?'`. Also Escape closes it (but does NOT pause game — that escape is handled by the pause system separately; prevent default only if overlay is open and phase is playing).

**Clicking outside panel:** Add `onClick` to full-screen backdrop `div` that closes the overlay (the panel's `onClick` must call `e.stopPropagation()`).

### Acceptance Criteria

- `data-testid="controls-overlay"` not in document when closed
- `data-testid="controls-overlay"` in document after H key press
- All movement, camera, and UI keybind rows are present
- Clicking `data-testid="controls-close"` closes the overlay
- Overlay does not pause the game (phase stays `'playing'`)
- `pnpm verify` passes

### Test Plan

Write `src/ui/ControlsOverlay.test.tsx`:

- Render; assert overlay not visible initially
- Press `H` key — assert `data-testid="controls-overlay"` in document
- Press `H` again — assert overlay is closed
- Press `?` key — assert overlay opens
- Click close button — assert overlay closes
- Assert movement keybind row "W" is present when open
- Assert quadrant diagram text is present when open

---

## Slice 17 — Motion Polish Pass

**Priority:** NICE
**Complexity:** M
**Dependencies:** All screen slices (1–16 must be complete)

### Scope

**Modify:** Any UI component that has transitions/animations hard-coded without using tokens

### What to audit and fix

After all slices 1–16 land, do a pass to ensure every CSS `transition`, `animation`, and `transform` property uses values from `src/ui/tokens.ts`:

- `DUR_FAST` (150ms) for hover state transitions on buttons
- `DUR_INSTANT` (80ms) for button active/press feedback (`transform: scale(0.98)` or `translateY(2px)`)
- `DUR_NORMAL` (200ms) for health bar fill width changes
- `DUR_MEDIUM` (300ms) for modal / wave announcement entrance
- `DUR_SLOW` (500ms) for score counter, wave-clear letterbox
- `EASE_OUT` for most transitions
- `EASE_IN` for exit/fade-out transitions
- `EASE_SPRING` for button press bounce and modal enter
- `EASE_LINEAR` for reload pulse animation only

**Also:** Ensure HealthBar uses `transition: width ${DUR_NORMAL}ms ${EASE_OUT}` (not `0.3s ease-out` hardcoded).

**Do NOT add transitions to:** HUD elements that update every frame (enemiesRemaining counter, score during active gameplay). These use direct DOM mutation or event-driven updates and transitions cause visual artifacts.

### Acceptance Criteria

- Grep for `transition:` and `animation:` in `src/ui/` — every duration value matches a token constant (no raw ms values except where calculated from token arithmetic)
- `pnpm verify` passes
- Playwright screenshot visual review shows smooth transitions (not a unit-testable criterion — dev agent should verify manually)

### Test Plan

- Automated: Write a small test that imports `tokens.ts` and verifies `DUR_NORMAL === 200` (sanity — tokens not accidentally changed)
- Manual: Playwright screenshot sequence for TitleScreen → Playing → PauseMenu → Settings → back to Playing

---

## Slice 18 — HUD.tsx Composition Cleanup

**Priority:** MUST (ensure this is done during or after the above slices, not a separate dispatch unless needed)
**Complexity:** S
**Dependencies:** All MUST slices (1–16 MUST items)

### Scope

**Modify:** `src/ui/HUD.tsx`

### What this slice does

As slices 4–16 land, `HUD.tsx` accumulates new `import` and `<Component />` entries. This final composition slice ensures:

1. The HUD phase gate is correct: `if (phase !== 'playing' && phase !== 'wave-clear' && phase !== 'paused') return null`
2. All new components are imported and rendered in the correct order (z-index layering):
   - Base: `HealthBar`, `WaveCounter`, `ScoreDisplay`, `EnemiesRemainingCounter`, `WeaponCooldownIndicator` (always visible during play)
   - Mid: `LowHullWarning`, `PointerLockHint` (conditional rendering internal to component)
   - Top: `WaveAnnouncement`, `PauseMenu`, `ControlsOverlay` (overlay layers)
3. `data-testid="hud"` still present
4. No orphaned import statements

### Acceptance Criteria

- All 10+ UI components are imported and rendered in HUD
- Phase gate condition includes `'paused'`
- `pnpm verify` passes

### Test Plan

Write `src/ui/HUD.test.tsx` (or extend existing):

- Render with `phase='playing'` — assert `data-testid="hud"` present
- Render with `phase='title'` — assert null returned
- Render with `phase='paused'` — assert HUD still mounted (pause menu overlays on top of it)

---

## Priority Summary

| Priority | Slices                                      | Count |
| -------- | ------------------------------------------- | ----- |
| MUST     | 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 18 | 13    |
| SHOULD   | 8, 9, 15, 16                                | 4     |
| NICE     | 17                                          | 1     |

**Total slices:** 18

---

## Complexity Summary

| Slice | Name                     | Complexity |
| ----- | ------------------------ | ---------- |
| 1     | Design Tokens            | S          |
| 2     | Store Extensions         | S          |
| 3     | Font Loading             | S          |
| 4     | HealthBar Overhaul       | M          |
| 5     | WaveCounter Overhaul     | S          |
| 6     | ScoreDisplay Overhaul    | S          |
| 7     | EnemiesRemainingCounter  | S          |
| 8     | WeaponCooldownIndicator  | M          |
| 9     | LowHullWarning           | S          |
| 10    | PointerLockHint Autofade | S          |
| 11    | TitleScreen Overhaul     | M          |
| 12    | Wave-Clear Overlay       | M          |
| 13    | PauseMenu                | M          |
| 14    | GameOverScreen Overhaul  | M          |
| 15    | SettingsScreen MVP       | M          |
| 16    | ControlsOverlay          | S          |
| 17    | Motion Polish Pass       | M          |
| 18    | HUD Composition Cleanup  | S          |

**Complexity totals:** S×10, M×8, L×0

---

## Cross-Cutting Concerns

### 1. Font stack migration

Slices 4–16 all touch components that currently reference `'Black Ops One'` or `'Rajdhani'`. Every overhaul slice must explicitly remove those font family strings and replace with `FONT_DISPLAY` or `FONT_UI` from tokens. This is a recurring concern across all screen slices — dev agents should grep their output file for old font names before marking done.

### 2. Pointer lock re-request after resume

When `PauseMenu` resumes the game (Slice 13), pointer lock needs to be re-acquired. The pointer lock API requires a user gesture. Clicking "Resume" IS a user gesture, so calling `canvas.requestPointerLock()` in the `onClick` handler of the Resume button is valid. The canvas element needs to be targetable — pass a ref from App.tsx or use `document.querySelector('canvas')` as a fallback. Dev agent should verify this works in Playwright after implementing.

### 3. Physics `paused` prop timing

`App.tsx` line ~93 has `<Physics>`. The `paused` prop needs to be `phase === 'paused'`. The `phase` value is read from `useGameStore`. The dev agent implementing Slice 13 must read this value reactively (not via `getState()` in a static expression) — use `const phase = useGameStore(s => s.phase)` in the App component and pass `paused={phase === 'paused'}`.

### 4. LocalStorage hydration for audio settings

Slice 2 adds localStorage read at store creation time. This runs in the browser (not during SSR/test). In tests, `localStorage` must be mocked or the `getItem` calls must safely handle `null` returns. The Slice 2 test file should include a test with a pre-seeded `localStorage.setItem` call before store initialization.

### 5. No Quadrant Indicator

The layout proposal (Element 6) included a Quadrant Indicator at screen center. This is EXPLICITLY EXCLUDED per orchestrator override. No slice implements it. The trajectory ribbon and weapon cooldown indicator (Slice 8) carry the aiming feedback.

### 6. Kill Feed deferred

Kill feed and enemy ship naming system (proposal Element 10) are explicitly DEFERRED post-competition. No slice implements them.

### 7. Existing EnemyHealthBar component

`src/ui/EnemyHealthBar.tsx` is world-space and already implemented. It is out of scope for this overhaul (no slice touches it). If it uses hardcoded colors, a future polish pass can migrate it, but it is not part of this plan.

### 8. Test isolation for store

Each test file that uses `useGameStore` must call `useGameStore.setState(INITIAL_STATE)` in a `beforeEach` to reset state between tests. Check whether this is already in the test setup — if not, every store-touching test suite needs it.

### 9. React import

Several existing components lack `import React from 'react'` (relying on the JSX transform). New components must follow the same convention already established in the codebase (check existing files — they omit the import). Do not add unnecessary React imports.

---

## Gaps Found

### Gap 1 — No `'settings'` store phase needed

The proposal and some early planning implied adding `'settings'` to `GamePhase`. The orchestrator decision to use local React state in TitleScreen and PauseMenu for settings navigation means NO `'settings'` phase is added to the store. This is the correct call — Settings is a UI navigation concern, not a game state concern. Dev agents must NOT add `'settings'` to `GamePhase`.

### Gap 2 — Weapon cooldown update frequency

The `useWeaponState` selector will cause React re-renders on every physics step (cooldown ticks every frame). This is performance-relevant. If re-render count becomes a concern, the `WeaponCooldownIndicator` (Slice 8) should switch to direct DOM mutation (read `useGameStore.getState()` in a `useFrame`-style RAF loop). Flag this as a known risk; implement with React state first and optimize only if Playwright shows frame drops.

### Gap 3 — Escape key conflict

Both PauseMenu (Escape = toggle pause) and ControlsOverlay (Escape = close overlay) listen to `keydown`. The ControlsOverlay must consume the Escape key event (call `event.stopPropagation()`) ONLY when the overlay is open, so Escape does not simultaneously pause the game while closing the overlay. Dev agent implementing Slice 16 must handle this event ordering explicitly.

### Gap 4 — WaveCounter / EnemiesRemainingCounter split (Slice 7)

Slice 7 moves the enemies-remaining display out of `WaveCounter.tsx`. This is a breaking change to `WaveCounter.tsx` — the `useEnemiesRemaining()` import can be removed after the split, reducing the component's selector dependencies. The dev agent must update `WaveCounter.tsx` accordingly.

### Gap 5 — Art direction motion tokens not in CSS custom properties

The tokens file (`src/ui/tokens.ts`) exports TypeScript constants, not CSS custom properties. Components use inline React styles (not stylesheet classes). This is consistent with the existing codebase pattern. The motion token values must be composed into CSS strings in the component inline style objects, e.g.:

```typescript
transition: `width ${DUR_NORMAL}ms ${EASE_OUT}`;
```

This is intentional and not a gap — just a dev agent instruction.
