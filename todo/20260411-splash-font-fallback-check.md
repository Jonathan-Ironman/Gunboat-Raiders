# Splash Screen Font Fallback Check

**Created:** 2026-04-11
**Priority:** Verify after all current agents land
**Reporter:** Jonathan (visual observation)

## Observation

The **in-game UI** (HUD, counters, etc.) renders with the correct Harbour Dawn font (Nunito/Baloo 2 as loaded by R3 in `index.html`).

The **splash screen / title screen / start screen** renders with what looks like **Comic Sans**. This is different from the in-game font.

## Jonathan's hypothesis

The splash screen probably uses a hardcoded `font-family` that references a font no longer loaded (e.g. `'Black Ops One'`, `'Rajdhani'` from the old plan — R3 swapped the Google Fonts `<link>` to Baloo 2 + Nunito and those removed references are now broken). When the browser can't resolve the primary font, it falls back to a system default that renders Comic-Sans-esque on Jonathan's machine.

## Plausible causes

1. **`src/ui/TitleScreen.tsx`** — likely has hardcoded `font-family: 'Black Ops One'` or similar. R3 didn't touch this file. Will be replaced by `MainMenuScene.tsx` in R7 anyway, but until then the broken splash stays.
2. **`src/ui/PointerLockHint.tsx`** — the "Click to aim and fire" overlay. Will be DELETED in R4. If this is the "splash" Jonathan sees, R4 resolves it.
3. **A CSS file** (`src/App.css`, `src/index.css`, or similar) might declare `@font-face` or `body { font-family }` referencing an old font name.
4. **Any other component** with hardcoded font-family strings (grep for `Black Ops`, `Rajdhani`, or non-token font references).

## Action after all current agents land

1. Grep the codebase for hardcoded `font-family` strings not using tokens.
2. Grep for `'Black Ops One'`, `'Rajdhani'` — anything referencing fonts that are no longer in index.html.
3. Inspect TitleScreen.tsx specifically.
4. Fix the broken reference(s). Either:
   - Update to use tokens (preferred for long-lived components)
   - Delete if the component is scheduled for deletion by R4/R7 anyway
5. Visual verify with Playwright screenshot of the splash screen — font should match in-game fonts.
6. If R4 (pause flow) + R7 (main menu) both land before this check, the issue probably self-resolves. Still verify.

## Important

The R3 agent only touched `index.html` (font loading). It did NOT modify any component's `font-family`. So any hardcoded fonts that the old `index.html` used to load will now be broken. This is the most likely root cause.

## Status: COMPLETED 2026-04-11

TitleScreen.tsx was deleted in commit `9294af1` (`feat(ui): MainMenuScene replaces TitleScreen`) as part of R7 of the UI overhaul. The broken font-family reference in TitleScreen no longer exists. The new MainMenuScene uses Harbour Dawn tokens and Baloo 2 / Nunito fonts loaded correctly in `index.html`. PointerLockHint.tsx was also deleted. The Comic Sans fallback issue self-resolved when the offending components were replaced. No separate font-family fix was needed.
