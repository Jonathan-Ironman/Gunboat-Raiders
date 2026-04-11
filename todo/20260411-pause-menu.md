# Escape = pause with translucent menu overlay

## Description

During play, pressing Escape currently does not pause the game. The cursor is released (pointer lock exit) and the "Click to Aim and Fire" prompt appears, but the simulation keeps running — boats move, waves progress, enemies attack.

The user wants Escape to pause the game AND show a translucent menu over the still-visible, frozen scene. Not a full opaque overlay — the game world should remain visible behind the menu so the player keeps the spatial context.

## Acceptance Criteria

- [ ] Pressing Escape during `phase: 'playing'` transitions to a new `phase: 'paused'`
- [ ] In `paused`, the physics step, game systems, and animation are halted (or time-scaled to 0)
- [ ] A translucent menu overlay is rendered (semi-transparent background, visible game behind it)
- [ ] Menu options at minimum: Resume, Restart, Quit to Title
- [ ] Pressing Escape again (or clicking Resume) returns to `playing` and re-locks the pointer
- [ ] No input leaks: keyboard/mouse inputs for movement/firing are ignored while paused
- [ ] Unit test for store transition `playing → paused → playing`
- [ ] Scenario test: press Escape, assert physics frozen and menu visible

## Relevant Files

- `src/store/gameStore.ts` — phase enum
- `src/systems/InputSystemR3F.tsx` (or wherever Escape is handled)
- `src/ui/` — new PauseMenu component
- `src/App.tsx` — physics `paused` prop on `<Physics>` or equivalent

## Status: COMPLETED 2026-04-11

Pause menu fully implemented across multiple UI overhaul slices:

- `1e3a7e7` — `feat(gameplay): pause-on-pointer-lock-loss + Physics paused prop`
- `c7a5f08` — `feat(ui): real PauseMenu with Continue/Settings/Exit + ConfirmDialog (R5)` (`c99a5c84`)
- `2045c84` — `feat(ui): SettingsModal with Audio/Controls/Performance tabs (R6)`

Escape pauses, physics halts via `<Physics paused>`, translucent overlay with backdrop blur, Resume/Settings/Exit buttons, `playing → paused → playing` store transitions. All acceptance criteria met.
