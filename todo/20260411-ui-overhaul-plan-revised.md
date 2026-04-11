# UI Overhaul — Revised Plan (2026-04-11)

**Supersedes:** selected slices of `20260411-ui-overhaul-plan.md` (the original 18-slice plan stays as reference for visual specs; this file owns execution).
**Source:** produced by planning agent 2026-04-11 after Jonathan locked the full UI vision; Firefly project (`D:/Projects/Firefly`) studied as reference.

## Autonomous design decisions (orchestrator, 2026-04-11)

Jonathan authorized full autonomy. The 8 open design questions from the planning agent are auto-resolved per its recommendations:

1. **Heat bar shape:** shared, single bar (not per-mount) for V1. Refactor later if needed.
2. **Exit confirmation buttons:** Cancel on left (default focus), Confirm on right. Destructive red on confirm.
3. **Canvas lifecycle:** single persistent R3F `<Canvas>`, gated entity tree by phase (`<ShowcaseScene>` for `mainMenu`, `<GameEntities>` for `playing`).
4. **Level 1 briefing text:** use placeholder from R9 spec below (`First Light` + mission/controls/mechanics paragraphs). Jonathan can edit later; not blocking execution.
5. **Continue semantics with single level:** enabled-but-restarts-at-current-level. Exercises save plumbing.
6. **Music slider with no music:** visible DISABLED slider with "(coming soon)" caption. Locks in layout.
7. **Settings persist key:** single JSON blob `gr_state_v1` (settings + save together).
8. **Pause menu on game-over:** disabled (only Play Again / Main Menu work).

## Slice index

| ID  | Name                                                                     | Priority | Complexity | Depends on              |
| --- | ------------------------------------------------------------------------ | -------- | ---------- | ----------------------- |
| R1  | Design tokens                                                            | MUST     | S          | —                       |
| R2  | Store + persistence extensions                                           | MUST     | M          | —                       |
| R3  | Font loading                                                             | MUST     | S          | —                       |
| R4  | Pause-on-pointer-lock-loss + `<Physics paused>` + delete PointerLockHint | MUST     | M          | R1, R2                  |
| R5  | PauseMenu UI + reusable ConfirmDialog                                    | MUST     | M          | R1, R2, R3, R4          |
| R6  | SettingsModal (Audio / Controls / Performance tabs)                      | MUST     | M          | R1, R2, R3              |
| R7  | MainMenuScene (replaces TitleScreen)                                     | MUST     | M          | R1, R2, R3, R6, R8, R18 |
| R8  | ShowcaseBackgroundScene (calm running game as menu bg)                   | MUST     | M          | R2                      |
| R9  | LevelBriefingModal                                                       | MUST     | M          | R1, R2, R3              |
| R10 | GameBootstrap rework (delete click-to-start)                             | MUST     | S          | R4, R7, R9              |
| R11 | HealthBar Harbour Dawn rework + Armor regen shimmer                      | MUST     | M          | R1, R3                  |
| R12 | WaveCounter / ScoreDisplay / EnemiesRemainingCounter restyle             | MUST     | S          | R1, R3                  |
| R13 | WeaponHeatBar UI (reads store heat selector)                             | MUST     | M          | R1, R2, R3              |
| R14 | LowHullWarning vignette                                                  | SHOULD   | S          | R1                      |
| R15 | GameOverScreen rework + Main Menu route                                  | MUST     | M          | R1, R3, R7              |
| R16 | WaveAnnouncement overlay                                                 | MUST     | M          | R1, R3                  |
| R17 | ControlsOverlay + shared keybindings module                              | SHOULD   | S          | R1                      |
| R18 | SaveSystem (level-transition save points)                                | MUST     | S          | R2, R7                  |
| R19 | HUD composition cleanup                                                  | MUST     | S          | R11–R17                 |
| R20 | Motion polish                                                            | NICE     | M          | all visual slices       |

## Execution waves

- **Wave A (foundation, small, low risk):** R1 → R2 → R3 (or R1+R3 parallel, R2 after overheat mechanic lands).
- **Wave B (first visible win):** R4. Pause-on-lock-loss + `<Physics paused>`. Demoable: press Escape → world freezes → placeholder overlay → click to resume.
- **Wave C (post-R4):** R5, then R6 (R6 reuses R5's modal pattern).
- **Wave D (post-R6):** R7 + R8 + R9 parallel-able.
- **Wave E:** R10 (bootstrap cleanup). Full loop works: mainMenu → briefing → play → pause → exit → mainMenu.
- **Wave F (visual restyle, parallel):** R11, R12, R13, R14, R15, R16, R17.
- **Wave G (close):** R18, R19, R20.

## Key spec notes (summaries — full content preserved in planning agent output)

### R2 — Store + Persistence

- Phase enum: `'mainMenu' | 'briefing' | 'playing' | 'wave-clear' | 'paused' | 'game-over'`. Renames old `'title'` → `'mainMenu'`.
- New actions: `pauseGame`, `resumeGame`, `openBriefing(levelIndex)`, `startLevel(levelIndex)`, `returnToMainMenu`.
- Settings slice: `{ sfxVolume, musicVolume }` persisted to `gr_state_v1` localStorage.
- Save slice: `{ currentLevelIndex, bestWave, bestScore } | null`.
- Persistence utility: `src/utils/persistence.ts` with `loadPersisted`, `savePersisted`, `clearPersisted`, shape-validated.
- Selectors: `useSettings`, `useSave`, `useHasSave`, `useBriefingLevelIndex`, `usePlayerWeaponHeat`.
- **NOTE on collision with overheat mechanic:** the dev agent currently implementing the overheat mechanic will add a `weaponHeat` field to the weapon store. R2 must READ what the overheat agent decided and align (do not duplicate, do not overwrite).

### R4 — Pause on pointer-lock loss

- Firefly pattern: `pointerlockchange` listener in `CameraSystemR3F` checks `wasLocked && !nowLocked && phase === 'playing'` → `pauseGame()`.
- No Escape key handler — browser natively releases lock on Escape, the lock-loss listener catches it.
- Resume: `handleContinue` in pause menu (onClick) → `canvas.requestPointerLock()` + `resumeGame()` in the same user gesture.
- `<Physics paused={phase === 'paused'}>` prop added in `App.tsx`.
- Every `useFrame` body in `src/systems/*R3F.tsx` gains `if (useGameStore.getState().phase === 'paused') return;`.
- Weapon click handler gains `if (phase !== 'playing') return;`.
- `src/ui/PointerLockHint.tsx` is DELETED.
- Temporary `PauseOverlayPlaceholder.tsx` for the demoable moment before R5 lands.
- **De-risk first:** 5-minute spike confirming `<Physics paused>` actually halts rapier in this project before wiring everything else. Fallback: zero velocities each frame.

### R5 — PauseMenu UI + ConfirmDialog

- Full-viewport overlay with `backdropFilter: blur(8px)`, center panel.
- Title: `PAUSED`.
- Buttons: `CONTINUE` (primary) → `SETTINGS` → `EXIT` (with destructive hover).
- **No restart button** — Jonathan's spec. Mid-mission progress is intentionally lost.
- Run summary line below: `"Wave {wave} · Score {score}"`.
- `ConfirmDialog` is reusable (also used by MainMenu new-game overwrite confirm and GameOverScreen if needed).
- Exit dialog text: `"Exit to Main Menu?"` / `"Your game is saved at this level — but mission progress will be lost."` / `Cancel` / `Exit`.
- Keyboard: Escape-in-menu = Continue; Enter-in-dialog = Confirm; Escape-in-dialog = Cancel.

### R6 — SettingsModal

- Tabs: `Audio` / `Controls` / `Performance`.
- **Audio:** Music slider DISABLED + "Music coming soon" caption. SFX slider live, wires to `Howler.volume(v)` + persists to localStorage.
- **Controls:** read-only keybind list (same data as `ControlsOverlay`, extract shared `src/ui/keybindings.ts` module).
- **Performance:** stub "Coming soon".
- Mounted inline by both `PauseMenu` and `MainMenuScene` via local `useState<'menu'|'settings'>`.
- Keyboard: Escape closes; 1/2/3 switches tabs (NICE).

### R7 — MainMenuScene (replaces TitleScreen)

- Full-viewport overlay with gradient fade, NO backdrop blur — water visible behind.
- Title: `GUNBOAT RAIDERS`, tagline `Survive the waves. Sink the rest.`
- Buttons branched on `useHasSave()`:
  - `hasSave === true`: `CONTINUE GAME` primary → `openBriefing(save.currentLevelIndex)`. `NEW GAME` secondary with overwrite confirm dialog.
  - `hasSave === false`: `CONTINUE GAME` rendered but DISABLED (greyed, `aria-disabled`, `cursor: not-allowed`). `NEW GAME` primary → `openBriefing(0)`.
  - `SETTINGS` secondary → mounts `SettingsModal` inline.
- DELETE `src/ui/TitleScreen.tsx`. Replace with `src/ui/MainMenuScene.tsx`.
- In `App.tsx`: `{phase === 'mainMenu' ? <ShowcaseScene /> : <GameEntities />}`.

### R8 — ShowcaseBackgroundScene

- Runs a calm, no-combat game instance behind the main menu.
- 3 presets: `Calm Heading Out` / `Lazy Circle` / `Anchored at Dawn`. Random pick on mount.
- `ShowcasePlayerBoat` — ignores input, follows preset path.
- `ShowcaseCameraSystem` — slow cinematic orbit/pan/side, no mouse look, NO pointer lock request.
- HUD must NOT mount during `mainMenu` (phase gate).

### R9 — LevelBriefingModal

- Create `src/config/levels.ts` with `LevelConfig` array.
- Level 1 placeholder:
  - `name`: "First Light"
  - `missionStatement`: "Sink every raider that crosses your path. Hold the line until the seas are calm."
  - `controlsSummary`: "WASD to steer. Mouse to aim. Click to fire the active quadrant. Esc to pause."
  - `mechanicsExplanation`: "Your armor slowly auto-repairs over time, but your hull does not. Pick your fights — and stay out of broadsides."
- Full-viewport opaque overlay (not blurred — reading focus).
- Sections: `MISSION 1` kicker / title / horizontal rule / Mission statement / Controls / Briefing / Back+Start buttons row.
- For levels > 1, omit the Controls section.
- Keyboard: Enter = Start, Backspace/Escape = Back.

### R10 — GameBootstrap Rework

- Boot lands on `phase='mainMenu'`, NOT `playing`.
- Player not spawned until briefing → Start.
- `GameEntities` only mounts when `phase !== 'mainMenu' && phase !== 'briefing'`.
- Pointer lock only requested during `playing`.
- Playwright integration test: full happy path.
- Cleanup: delete `TitleScreen.tsx`, any `'title'` phase references, any auto-spawn-on-load logic.

### R11 — HealthBar + Armor/Hull design lock

- Visual spec: preserved from original Slice 4.
- **Design lock:** armor slowly auto-repairs (existing `armorRegenRate: 3` on player boat, DamageSystemR3F already ticks it). Hull does NOT regen.
- **New visual:** when `armor < armorMax`, the armor bar shows a slow horizontal shimmer/glow via CSS `linear-gradient` animated `background-position` over 2s linear infinite. Remove animation when armor is full or boat sinking.

### R13 — WeaponHeatBar

- Horizontal bar at `bottom: 6.5rem`, centered. 240×12px.
- **Inverted fill:** width = `(1 - heat) * 100%` (drains as heat builds).
- Color bracket: `heat <= 0.5` green, `0.5 < heat <= 0.75` yellow, `heat > 0.75` red.
- Label: `HEAT`; when `heat > 0.9` becomes `OVERHEATED` in red with 0.6s pulse.
- Smooth lerp: width transitions over 200ms ease-out.
- Reads `usePlayerWeaponHeat()` selector (produced by overheat mechanic task).
- HUD-gated: visible in `playing` / `wave-clear` / `paused`.

### R15 — GameOverScreen

- Visual: preserved from original Slice 14.
- Route changes: `MAIN MENU` → `returnToMainMenu()` (phase=`mainMenu`, not `title`). `PLAY AGAIN` → `startLevel(currentLevelIndex)`.
- Add disclaimer line: `"This run did not save — you sank at Wave {wave}."`
- Pause menu is INACCESSIBLE during game-over (Escape is a no-op).

### R18 — SaveSystem

- Save point: level transitions only. For V1 single level: call `saveAtLevel(0)` when player completes the level OR when player explicitly exits via pause menu.
- LocalStorage hydration already wired by R2.
- V1 acceptance: Continue enabled after first save; survives reload.

### R19 — HUD composition cleanup

- Phase gate: `if (phase !== 'playing' && phase !== 'wave-clear' && phase !== 'paused') return null;`
- Mounted children: HealthBar, WaveCounter, ScoreDisplay, EnemiesRemainingCounter, WeaponHeatBar, LowHullWarning, WaveAnnouncement, PauseMenu, ControlsOverlay.
- Removed: PointerLockHint (deleted in R4).

### R20 — Motion polish

- Audit every transition/animation across new components. All durations/easings from tokens. Consistent hover/focus states.

## Firefly reference pointers (read-only)

- `D:/Projects/Firefly/src/scenes/GameScene.ts` — pointer-lock-loss → pause pattern (primary reference for R4).
- `D:/Projects/Firefly/src/scenes/PauseScene.ts` — pause menu button layout (R5).
- `D:/Projects/Firefly/src/scenes/MainMenuScene.ts` — main menu button branching on save state (R7).
- `D:/Projects/Firefly/src/scenes/BriefingScene.ts` — briefing modal structure (R9).
- `D:/Projects/Firefly/src/game/PlayerState.ts` — shape-validated save/load pattern (R2/R18).

## Out-of-scope (deferred)

- Music system (slot reserved only).
- Per-mount heat bars (shared only).
- Weapon overheat mechanic tuning beyond conservative spec.
- Performance settings (tab stub).
- Key rebinding.
- Multiple save slots.
- Level 2+.
- Kill feed, ship naming, quadrant indicator.
