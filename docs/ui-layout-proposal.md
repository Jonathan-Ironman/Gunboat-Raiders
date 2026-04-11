# UI Layout Proposal — Gunboat Raiders

**Status:** Discussion artifact. Not final. Requires user + orchestrator approval before any implementation begins.

**Scope:** Content and layout only. No colors, fonts, or visual styling — those are covered by `docs/art-direction/harbour-dawn.html`.

**Based on:** Codebase audit of `src/store/gameStore.ts`, all `src/ui/` components, `docs/GAME-DESIGN.md`, `docs/UI-UX-DESIGN.md`, `todo/20260411-pause-menu.md`, and `docs/phases/phase-6-waves.md` / `phase-7-ui.md`.

---

## Layout Grid Reference

All positions below use this 9-zone grid:

```
+-------------+-------------+-------------+
|  TOP-LEFT   |  TOP-CENTER | TOP-RIGHT   |
+-------------+-------------+-------------+
| CENTER-LEFT |   CENTER    | CENTER-RIGHT|
+-------------+-------------+-------------+
| BOTTOM-LEFT |BOTTOM-CENTER| BOTTOM-RIGHT|
+-------------+-------------+-------------+
```

Viewport units used throughout (1vw = 1% of viewport width, 1vh = 1% of viewport height).

---

## Screen 1 — Title Screen

**When shown:** `phase === 'title'` — the initial game entry point.

**Purpose:** Orient the player, communicate the game's identity, and provide a single clear action to begin play. The live 3D ocean renders behind the overlay, showing off the water immediately.

### Elements

**1. Game Title**

- Name: Game Title
- Priority: MUST
- Position: CENTER — horizontally centered, vertically at approximately 38vh from top
- Data shown: Static text "GUNBOAT RAIDERS"
- Update frequency: Static (never changes)
- Rationale: Primary identity signal; large display text establishes tone before the player touches anything

**2. Subtitle / Tagline**

- Name: Tagline
- Priority: MUST
- Position: CENTER — horizontally centered, approximately 48vh from top (just below title)
- Data shown: Static text "Survive the waves. Sink the rest."
- Update frequency: Static
- Rationale: One-line premise summary so first-time players immediately understand the loop

**3. Start Button**

- Name: Start Button
- Priority: MUST
- Position: CENTER — horizontally centered, approximately 58vh from top
- Data shown: Label "START GAME"
- Update frequency: Static label; hover state responds to pointer
- Rationale: Single primary CTA; no ambiguity about what to do next

**4. Settings Button**

- Name: Settings Button
- Priority: SHOULD
- Position: CENTER — horizontally centered, approximately 66vh from top (below Start)
- Data shown: Label "SETTINGS"
- Update frequency: Static
- Rationale: Audio volume and key rebinds need to be accessible without starting the game; placed below Start so it does not compete

**5. Controls / Help Shortcut**

- Name: Controls Hint
- Priority: SHOULD
- Position: BOTTOM-CENTER — horizontally centered, approximately 92vh from top (bottom edge, unobtrusive)
- Data shown: Static text "Press [?] or [H] for controls"
- Update frequency: Static
- Rationale: Surfaces the controls overlay for first-time players without cluttering the main composition

**6. Version / Competition Credit**

- Name: Version Tag
- Priority: NICE
- Position: BOTTOM-RIGHT — right edge, 95vh from top, right: 1.5vw
- Data shown: Static build identifier or "Three.js Water Pro Giveaway 2026"
- Update frequency: Static
- Rationale: Competition context; minimal footprint in the corner

### Interactions

- Click "START GAME" — calls `store.startGame()`, transitions to In-Game HUD
- Click "SETTINGS" — transitions to Settings Screen (or opens inline modal)
- Hover on Start/Settings — scale + glow feedback
- Press Enter / Space — activates Start Button (keyboard shortcut)
- Press H or ? — opens Controls Overlay

### Transitions

- Entry: Overlay fades in from transparent over 0.4s after page load. Title animates in from 1.3x scale to 1x.
- Exit (to playing): Full-screen fade-to-black (0.4s), `startGame()` called at midpoint, fade back (0.4s). Prevents visual pop from title layout to HUD.

---

## Screen 2 — In-Game HUD

**When shown:** `phase === 'playing'` (and `phase === 'wave-clear'` — see note below). The primary play overlay rendered at all times during active gameplay.

**Purpose:** Give the player all the information they need to make decisions in combat, without occluding the ocean surface or the action. Every element must justify its screen real estate.

**Note on wave-clear:** The HUD persists during `wave-clear`. The Wave Announcement (Screen 3) layered on top of it — do not hide HUD during wave-clear.

### Elements

**1. Hull Health Bar**

- Name: Hull Bar
- Priority: MUST
- Position: BOTTOM-LEFT — left: 2rem (≈ 1.5vw), bottom: 2rem (≈ 3vh). The lower of the two stacked bars.
- Data shown: `player.health.hull` / `player.health.hullMax` as a filled bar and numeric label (e.g., "HULL 85 / 100")
- Width: 200px fixed (scales reasonably to 1080p and above)
- Update frequency: Every frame (direct DOM mutation, not React re-render)
- Rationale: Hull loss is irreversible and signals impending defeat — highest-priority combat information, placed where the eye naturally rests at the bottom of a 3D view

**2. Armor Health Bar**

- Name: Armor Bar
- Priority: MUST
- Position: BOTTOM-LEFT — same horizontal anchor as Hull Bar, stacked directly above it (bottom: ~5rem from bottom edge)
- Data shown: `player.health.armor` / `player.health.armorMax` as a filled bar and numeric label (e.g., "ARMOR 100 / 100")
- Width: 200px fixed
- Update frequency: Every frame (direct DOM mutation)
- Rationale: Armor is the first damage layer and regenerates — players need to know when it's depleted so they can disengage temporarily; placed above hull bar in reading order (armor is processed before hull)

**3. Wave Counter**

- Name: Wave Counter
- Priority: MUST
- Position: TOP-CENTER — horizontally centered (left: 50%, transform: translateX(-50%)), top: 1.5rem (≈ 2vh)
- Data shown: Current wave number as "WAVE 3"
- Update frequency: On event (when `store.wave` changes, once per wave transition)
- Rationale: Players need to know which wave they're in to assess escalating threat level; top-center is a natural focal point

**4. Enemies Remaining Counter**

- Name: Enemies Remaining
- Priority: MUST
- Position: TOP-CENTER — directly below Wave Counter, vertically offset by approximately 2rem
- Data shown: `store.enemiesRemaining` as "4 REMAINING" (hidden when count is 0, i.e., wave cleared)
- Update frequency: On event (each enemy sink)
- Rationale: The clearest signal that the player is making progress toward wave completion; suppressed when zero to avoid "0 remaining" confusion during wave-clear

**5. Score Display**

- Name: Score
- Priority: MUST
- Position: TOP-RIGHT — right: 2rem (≈ 1.5vw), top: 1.5rem (≈ 2vh)
- Data shown: `store.score` as a formatted integer with thousands separators (e.g., "12,450")
- Update frequency: On event (each `addScore()` call)
- Rationale: Arcade score is a motivational loop; top-right is the conventional game score position and does not conflict with wave info at top-center

**6. Active Quadrant Indicator**

- Name: Quadrant Indicator
- Priority: MUST
- Position: CENTER — horizontally and vertically centered (left: 50%, top: 50%, transform: translate(-50%, -50%)), or slightly above true center at ~46vh
- Data shown: Which of the four quadrants (FORE / PORT / STARBOARD / AFT) is currently active, based on `store.activeQuadrant`. Four arc/wedge segments arranged in a compass layout; active segment highlighted, others dimmed.
- No numeric data — purely directional
- Update frequency: Every frame (camera continuously updates active quadrant)
- Rationale: The quadrant system is the core aiming mechanic; without a persistent visual indicator players have no feedback on which cannons they are about to fire. Positioned at screen center where the camera naturally targets in a follow-cam game.

**Data gap:** `useActiveQuadrant` selector is referenced in `phase-7-ui.md` but is NOT currently in `src/store/selectors.ts`. Needs to be added as `export const useActiveQuadrant = () => useGameStore(s => s.activeQuadrant)`.

**7. Weapon Cooldown Indicator**

- Name: Cooldown Indicator (per active quadrant)
- Priority: SHOULD
- Position: CENTER — integrated with or immediately adjacent to the Quadrant Indicator. For example, a radial fill arc around the active quadrant segment, or a thin bar below the indicator (CENTER, offset ≈ +4rem below center)
- Data shown: `player.weapons.cooldownRemaining[activeQuadrant]` / `player.weapons.cooldown` as a percentage fill. Displays only the cooldown for the currently active quadrant (not all four simultaneously — too noisy).
- Update frequency: Every frame (cooldown ticks each frame in WeaponSystemR3F)
- Rationale: The player needs to know whether they can fire right now. Without this, click timing is pure guesswork. Placing it adjacent to the quadrant indicator keeps fire-related information co-located.

**Data gap:** `player.weapons.cooldownRemaining` and `player.weapons.cooldown` are in the store but there is no selector for them. A new selector is needed: `export const useWeaponState = () => useGameStore(s => s.player?.weapons ?? null)`.

**8. Pointer Lock Hint**

- Name: Click-to-Aim Hint
- Priority: MUST (existing, already implemented)
- Position: CENTER — at approximately 62vh from top (below center), horizontally centered
- Data shown: Static text "Click to aim and fire" — shown only when pointer lock is NOT active
- Update frequency: On event (pointer lock change)
- Rationale: First-time players do not know they must click to acquire mouse look; without this hint the first click silently requests lock and produces no shot

**9. Low-Health Warning**

- Name: Low Hull Warning
- Priority: SHOULD
- Position: Full-screen edge — a vignette/screen-edge pulsing overlay (not a discrete positioned element), activated when `hull / hullMax < 0.3`
- Data shown: No text — purely a visual signal (edge glow or screen shake)
- Update frequency: Every frame while condition is true
- Rationale: Critical health needs an unmissable ambient signal; players in combat often do not read bar values

**Data gap:** This requires a derived selector or effect system triggered by `player.health.hull / player.health.hullMax < 0.3`. Not currently exposed. Could be implemented as a CSS class on the HUD root div, toggled by a React effect watching `usePlayerHealth()`.

**10. Kill Notification (Kill Feed)**

- Name: Kill Feed
- Priority: NICE
- Position: TOP-LEFT — left: 2rem, top: 4rem (below where a minimap would go if added, above health bars)
- Data shown: Transient text entries like "SUNK: THE RUSTED MERCY" — one entry per enemy sunk. Each entry visible for 3 seconds then fades out. Maximum 3 entries visible simultaneously; older entries pushed up.
- Update frequency: On event (each enemy sink)
- Rationale: The game design doc calls for enemy ship names from a named pool; this surfaces that narrative flavor and confirms kills in a combat-feedback way. It's a NICE because it requires implementing the ship naming system that does not yet exist.

**Data gap:** No enemy name system exists in the store. `enemies` Map in the store contains `BoatEntity` objects with no name field. Supporting a kill feed requires: (a) a ship name pool, (b) assigning a name on `spawnEnemy()`, (c) exposing it as an event (not just decrement of `enemiesRemaining`). This is a meaningful addition to the store.

**11. Enemy Health Bars (World-Space)**

- Name: Enemy Health Bars
- Priority: MUST (already implemented)
- Position: World-space, rendered as `<Billboard>` 3 units above each enemy entity. Not a screen-space HUD element.
- Data shown: `enemy.health.armor` / `enemy.health.armorMax` and `enemy.health.hull` / `enemy.health.hullMax` as two stacked thin bars. Hidden when enemy is at full health.
- Update frequency: Every frame (armor/hull change from projectile damage)
- Rationale: Players need to track which enemies are weakened without accessing a minimap or target lock system

### Interactions

- Mouse movement — rotates camera, updates active quadrant, updates cooldown indicator
- Left click — fires active quadrant (if not on cooldown and pointer lock active)
- WASD — boat movement (no HUD interaction)
- Escape — transitions to Pause Menu (phase: 'paused')
- H or ? — opens Controls Overlay (non-pausing, ESC or click to dismiss)

### Transitions

- Entry: HUD fades in over 0.3s when `startGame()` is called (from title or game-over)
- Exit to pause: Escape key pressed — HUD remains visible behind Pause Menu overlay
- Exit to wave-clear: HUD persists; Wave Announcement layer appears on top
- Exit to game-over: HUD fades out as Game Over screen fades in

---

## Screen 3 — Wave Announcement

**When shown:** Immediately on `phase === 'wave-clear'` and also briefly at the start of each new wave on re-entry to `phase === 'playing'`. Two distinct moments:

1. Wave-Clear Celebration — shown for ~3 seconds at end of a wave
2. Next-Wave Announcement — shown for ~2.5 seconds at the start of the following wave

The In-Game HUD remains visible underneath both.

**Purpose:** Punctuate the wave loop with a moment of drama. Reward the player for clearing a wave. Prime them for the next threat.

### Elements (Wave-Clear moment)

**1. Wave-Clear Message**

- Name: Wave Clear Headline
- Priority: MUST
- Position: CENTER — horizontally centered, vertically at approximately 40vh (slightly above true center, cinematic framing)
- Data shown: "WAVE CLEARED" or the narrative wave name if the name system is implemented (e.g., "THE FIRST TIDE — CLEARED")
- Update frequency: Once on entry
- Rationale: Definitive confirmation that the wave is over; combat-paced players may not notice enemy count reaching zero

**2. Wave Score Bonus**

- Name: Wave Bonus Readout
- Priority: SHOULD
- Position: CENTER — approximately 48vh, centered below the headline
- Data shown: "+500" (the `SCORE.WAVE_SURVIVED` constant value = 500 points) in large text
- Update frequency: Once on entry, with a brief tick animation
- Rationale: Rewards the player with a tangible score moment; teaches the scoring system

**3. Next Wave Preview**

- Name: Next Wave Preview
- Priority: SHOULD
- Position: CENTER — approximately 56vh
- Data shown: "WAVE [N+1] BEGINS IN [countdown]s" OR "PREPARE FOR WAVE [N+1]" if no countdown UI is implemented
- Update frequency: Countdown ticks each second
- Rationale: Tells the player to prepare; 3 seconds is short enough to feel fast-paced

**4. Enemies-Sunk-This-Wave Stat**

- Name: Wave Stat
- Priority: NICE
- Position: CENTER — below Next Wave Preview, approximately 62vh
- Data shown: "ENEMIES SUNK: [n]" — enemies sunk during this specific wave (not total)
- Update frequency: Static when shown
- Rationale: Per-wave performance stat adds replay motivation; nice to have but not critical at MVP

**Data gap:** The store tracks `enemiesSunkTotal` but not per-wave sunk count. To support the per-wave stat, the wave system would need to snapshot `enemiesSunkTotal` at wave start and subtract on display. This is a minor computation, not a store change.

### Interactions

- No player interactions required (screen auto-advances)
- NICE: clicking or pressing Space/Enter could skip the countdown and start the next wave immediately

### Transitions

- Entry: Letterbox bars animate in from top and bottom edges (CSS transform from off-screen). Wave Clear Headline scales from 1.3x to 1x with fade-in over 300ms.
- Exit: Letterbox bars retract. Overlay fades to transparent. Phase transitions to 'playing'.

---

## Screen 4 — Pause Menu

**When shown:** `phase === 'paused'` — triggered by pressing Escape during `phase === 'playing'`. See `todo/20260411-pause-menu.md`.

**Purpose:** Let the player pause without losing spatial context. The game world remains frozen and visible behind the overlay. Pointer lock is released. Three actions available: resume, restart, or quit to title.

**Important:** A new `'paused'` phase value needs to be added to the `GamePhase` union type in `gameStore.ts`. This is the primary store gap for this screen.

**Data gap — Store:** `GamePhase` is currently `'title' | 'playing' | 'wave-clear' | 'game-over'`. It needs `'paused'` added. No other store changes required.

### Elements

**1. Pause Title**

- Name: Pause Label
- Priority: MUST
- Position: CENTER — horizontally centered, approximately 35vh from top
- Data shown: Static text "PAUSED"
- Update frequency: Static
- Rationale: Explicit state confirmation — players need to know the simulation is frozen

**2. Resume Button**

- Name: Resume
- Priority: MUST
- Position: CENTER — horizontally centered, approximately 45vh
- Data shown: Label "RESUME"
- Update frequency: Static
- Rationale: Primary action; returning to play is always the first option

**3. Restart Button**

- Name: Restart
- Priority: MUST
- Position: CENTER — horizontally centered, approximately 53vh
- Data shown: Label "RESTART"
- Update frequency: Static
- Rationale: Common desire when a run is going badly; avoids requiring game-over to restart

**4. Quit to Title Button**

- Name: Quit to Title
- Priority: MUST
- Position: CENTER — horizontally centered, approximately 61vh
- Data shown: Label "QUIT TO TITLE"
- Update frequency: Static
- Rationale: Exit path without page reload; returns to the title screen so players can access settings

**5. Current Wave and Score (contextual)**

- Name: Run Summary
- Priority: NICE
- Position: CENTER — small secondary text below the button group, approximately 70vh
- Data shown: "Wave [N] — Score [X,XXX]" — the player's current run stats so they can see what they'd be giving up if they restart/quit
- Update frequency: Static when shown (values frozen at pause time)
- Rationale: Adds mild loss-aversion friction before restart/quit; prevents accidental ruin of a good run

### Interactions

- Click Resume OR press Escape — returns to `phase: 'playing'`, re-requests pointer lock
- Click Restart — calls `store.startGame()`, transitions to `phase: 'playing'` wave 1
- Click Quit to Title — calls `store.resetGame()`, transitions to `phase: 'title'`
- Hover on buttons — scale / highlight feedback
- Clicking on the background (blurred game world) — no action (prevents accidental dismiss)

### Transitions

- Entry: Pressed Escape during playing. Overlay fades in (0.25s). Physics step is halted (paused prop on `<Physics>`).
- Exit to playing: Overlay fades out (0.25s). Pointer lock re-requested. Physics resumes.
- Exit to title: Fade to black, reset, fade back.

---

## Screen 5 — Game Over Screen

**When shown:** `phase === 'game-over'` — triggered when `player.health.hull <= 0`. Already partially implemented in `src/ui/GameOverScreen.tsx`.

**Purpose:** Deliver the run's final score with weight. Give the player a clear next action. Do not bury them in menus — they want to play again immediately.

### Elements

**1. Death Headline**

- Name: Game Over Headline
- Priority: MUST (existing)
- Position: CENTER — horizontally centered, approximately 30vh from top
- Data shown: Static text "SUNK"
- Update frequency: Static
- Rationale: Definitive single-word confirmation; matches the game's nautical theme and gritty tone

**2. Waves Survived**

- Name: Waves Survived Stat
- Priority: MUST (existing)
- Position: CENTER — approximately 45vh, centered
- Data shown: "Waves Survived: [wave number]" from `store.wave`
- Update frequency: Static when shown
- Rationale: Top-level performance metric; the primary difficulty axis

**3. Enemies Sunk**

- Name: Enemies Sunk Stat
- Priority: MUST (existing)
- Position: CENTER — approximately 51vh
- Data shown: "Enemies Sunk: [enemiesSunkTotal]" from `store.enemiesSunkTotal`
- Update frequency: Static when shown
- Rationale: Secondary performance metric; tells the player how aggressive their run was

**4. Final Score**

- Name: Final Score
- Priority: MUST (existing)
- Position: CENTER — approximately 57vh
- Data shown: "Final Score: [score]" from `store.score`, with thousands separators
- Update frequency: Static when shown; SHOULD animate as a counter tick from 0 up to final value over ~1.5 seconds
- Rationale: Score is the replay-motivation anchor; the tick animation creates a satisfying moment of revelation

**5. Play Again Button**

- Name: Play Again
- Priority: MUST (existing)
- Position: CENTER — approximately 67vh
- Data shown: Label "PLAY AGAIN"
- Update frequency: Static label; hover state responds to pointer
- Rationale: Highest-frequency action after game-over; must be prominent and immediately reachable

**6. Back to Title Button**

- Name: Back to Title
- Priority: SHOULD
- Position: CENTER — approximately 74vh (below Play Again)
- Data shown: Label "MAIN MENU"
- Update frequency: Static
- Rationale: Not currently present in the existing implementation. Players may want to access settings or read the controls before starting again.

### Interactions

- Click "PLAY AGAIN" OR press Enter/Space — calls `store.startGame()`, transitions to playing
- Click "MAIN MENU" — calls `store.resetGame()`, transitions to `phase: 'title'`
- Hover — scale feedback on buttons

### Transitions

- Entry: Canvas blur (CSS `filter: blur(8px)` on the canvas wrapper). 500ms pause. Then dark overlay fades in. Stats reveal sequentially with 150ms stagger. Score counter ticks up.
- Exit to playing: Overlay fades out. Canvas blur removed. New game starts.
- Exit to title: Fade to black, reset, fade back.

---

## Screen 6 — Settings Screen

**When shown:** Accessible from Title Screen (Settings button) and optionally from the Pause Menu. Can be implemented as a full-screen overlay or an inline modal on top of either.

**Purpose:** Let players adjust the few settings that matter for comfort: audio volume and possibly key remapping in a future version. Keep it simple at MVP.

**Note:** This screen is flagged as future-proof. At MVP, a minimal implementation is acceptable.

### Elements (MVP)

**1. Settings Title**

- Name: Settings Label
- Priority: MUST
- Position: CENTER — approximately 30vh from top
- Data shown: Static text "SETTINGS"
- Update frequency: Static

**2. Music Volume Slider**

- Name: Music Volume
- Priority: SHOULD
- Position: CENTER — approximately 42vh
- Data shown: A labeled range slider from 0–100. Label: "MUSIC". Current value shown numerically (e.g., "75").
- Update frequency: On drag (real-time preview)
- Rationale: Music can be fatiguing; players need control

**3. SFX Volume Slider**

- Name: SFX Volume
- Priority: SHOULD
- Position: CENTER — approximately 50vh
- Data shown: A labeled range slider from 0–100. Label: "SFX". Current value shown numerically.
- Update frequency: On drag
- Rationale: Cannon sound effects are loud and repetitive; some players will want to reduce SFX while keeping music

**4. Close / Back Button**

- Name: Back Button
- Priority: MUST
- Position: CENTER — approximately 62vh, OR top-left corner (top: 2rem, left: 2rem) as a persistent back arrow
- Data shown: Label "BACK" or a left-arrow icon
- Update frequency: Static
- Rationale: Unambiguous exit from settings

**Data gap:** No audio state exists in the store. Volume settings would need either: (a) a lightweight settings Zustand slice, or (b) direct `Howler.volume()` calls without persisting to store. LocalStorage persistence for volume is desirable but not required at MVP.

### Interactions

- Drag sliders — updates volume in real time
- Click Back — returns to previous screen (title or pause menu)
- Press Escape — same as Back

### Transitions

- Entry: Fade in over 0.3s from whatever screen invoked it
- Exit: Fade out back to caller

---

## Screen 7 — Controls Overlay

**When shown:** Triggered at any time by pressing H or ? during title or gameplay (non-pausing during gameplay). Dismissed by pressing H, ?, Escape, or clicking the close button.

**Purpose:** Allow players to reference keybindings without restarting. This is especially important for first sessions and after returning to the game.

**Note:** This is a lightweight overlay, not a full screen. It appears on top of whatever is currently showing (title, HUD, or pause menu) and dismisses back to it.

### Elements

**1. Controls Title**

- Name: Controls Header
- Priority: MUST
- Position: CENTER or CENTER-RIGHT — approximately 20vh from top. Can be anchored to right side of screen if shown during gameplay to leave the left (health) and top (wave/score) clear.
- Proposed position during gameplay: CENTER-RIGHT — right: 3vw, top: 15vh, contained panel
- Proposed position on title screen: CENTER — same as other title screen overlays
- Data shown: Static text "CONTROLS"
- Update frequency: Static

**2. Movement Keybinds**

- Name: Movement Controls List
- Priority: MUST
- Position: Inside the Controls panel, stacked list below the header
- Data shown:
  - W — Forward thrust
  - S — Reverse
  - A — Turn port (left)
  - D — Turn starboard (right)
- Update frequency: Static

**3. Camera / Aiming Keybinds**

- Name: Camera Controls List
- Priority: MUST
- Position: Inside the Controls panel, below Movement
- Data shown:
  - Mouse Move — Rotate camera / change firing quadrant
  - Left Click — Fire active quadrant
- Update frequency: Static

**4. UI Keybinds**

- Name: UI Controls List
- Priority: MUST
- Position: Inside the Controls panel, below Camera
- Data shown:
  - Escape — Pause / resume
  - H or ? — Toggle this panel
- Update frequency: Static

**5. Quadrant Diagram**

- Name: Quadrant Reference Diagram
- Priority: SHOULD
- Position: Inside the Controls panel, below keybind lists
- Data shown: A simple ASCII or CSS-drawn diagram showing the four quadrants relative to the boat shape:
  ```
       FORE (2)
  PORT (4) | (4) STARBOARD
       AFT (1)
  ```
  With the number of cannons per quadrant noted parenthetically.
- Update frequency: Static
- Rationale: The quadrant system is non-obvious to new players; a diagram is faster to parse than a text explanation

**6. Close Button**

- Name: Close
- Priority: MUST
- Position: Top-right corner of the Controls panel
- Data shown: "X" or "CLOSE"
- Update frequency: Static

### Interactions

- Press H, ?, or Escape — dismisses overlay
- Click Close — dismisses overlay
- Clicking outside the panel — dismisses overlay
- No gameplay inputs are blocked during this overlay (it is informational only, not a pause)

### Transitions

- Entry: Panel slides in from right edge (transform: translateX(100%) to translateX(0)) over 0.2s
- Exit: Slides back out to right

---

## Data Gaps Summary

The following store / selector additions are needed to fully support this proposal. None of these are implemented today.

| Gap                                                      | Required By        | Complexity                                                     |
| -------------------------------------------------------- | ------------------ | -------------------------------------------------------------- |
| `'paused'` added to `GamePhase` union                    | Pause Menu         | Low — one-line type change + store action                      |
| `useActiveQuadrant` selector in `selectors.ts`           | Quadrant Indicator | Low — already in store, selector missing                       |
| `useWeaponState` selector (cooldownRemaining + cooldown) | Cooldown Indicator | Low — data in store, selector missing                          |
| Per-wave enemies-sunk count (snapshot at wave start)     | Wave-Clear stat    | Low — derived from existing `enemiesSunkTotal`                 |
| Low-hull derived state (< 30%)                           | Low-Hull Warning   | Low — CSS class on HUD root based on existing health           |
| Audio volume settings (music + SFX)                      | Settings Screen    | Medium — new Zustand slice or Howler direct calls              |
| Enemy ship name system                                   | Kill Feed          | High — name pool, assign on spawn, event on sink               |
| Kill feed event stream                                   | Kill Feed          | High — requires event/notification system beyond Zustand state |

Items marked High are NICE-priority features that should not block other screens.

---

## Element Priority Summary

| Screen     | Element                         | Priority |
| ---------- | ------------------------------- | -------- |
| Title      | Game Title                      | MUST     |
| Title      | Tagline                         | MUST     |
| Title      | Start Button                    | MUST     |
| Title      | Settings Button                 | SHOULD   |
| Title      | Controls Hint                   | SHOULD   |
| Title      | Version Tag                     | NICE     |
| HUD        | Hull Bar                        | MUST     |
| HUD        | Armor Bar                       | MUST     |
| HUD        | Wave Counter                    | MUST     |
| HUD        | Enemies Remaining               | MUST     |
| HUD        | Score                           | MUST     |
| HUD        | Quadrant Indicator              | MUST     |
| HUD        | Cooldown Indicator              | SHOULD   |
| HUD        | Pointer Lock Hint               | MUST     |
| HUD        | Low-Hull Warning                | SHOULD   |
| HUD        | Kill Feed                       | NICE     |
| HUD        | Enemy Health Bars (world-space) | MUST     |
| Wave-Clear | Wave-Clear Headline             | MUST     |
| Wave-Clear | Wave Bonus Readout              | SHOULD   |
| Wave-Clear | Next Wave Preview               | SHOULD   |
| Wave-Clear | Per-Wave Enemies Sunk           | NICE     |
| Pause      | PAUSED Label                    | MUST     |
| Pause      | Resume Button                   | MUST     |
| Pause      | Restart Button                  | MUST     |
| Pause      | Quit to Title Button            | MUST     |
| Pause      | Run Summary                     | NICE     |
| Game Over  | SUNK Headline                   | MUST     |
| Game Over  | Waves Survived                  | MUST     |
| Game Over  | Enemies Sunk                    | MUST     |
| Game Over  | Final Score                     | MUST     |
| Game Over  | Play Again Button               | MUST     |
| Game Over  | Back to Title Button            | SHOULD   |
| Settings   | Settings Label                  | MUST     |
| Settings   | Music Volume                    | SHOULD   |
| Settings   | SFX Volume                      | SHOULD   |
| Settings   | Back Button                     | MUST     |
| Controls   | Controls Header                 | MUST     |
| Controls   | Movement Keybinds               | MUST     |
| Controls   | Camera Keybinds                 | MUST     |
| Controls   | UI Keybinds                     | MUST     |
| Controls   | Quadrant Diagram                | SHOULD   |
| Controls   | Close Button                    | MUST     |

---

## Open Questions for Discussion

1. **Wave-Clear vs. Wave-Announcement timing:** Should the "WAVE CLEARED" moment and the "WAVE [N+1] INCOMING" moment be separate overlays with distinct durations, or a single overlay that transitions through both phases? Currently the store has one `'wave-clear'` phase lasting ~3 seconds. Splitting into two distinct visual moments (clearing celebration, then new wave countdown) would be more cinematic but requires either a longer phase or a sub-phase timer.

2. **Pause menu existence:** The pause menu requires adding `'paused'` to `GamePhase`. This is a two-part change: store type + physics halting (`<Physics paused={phase === 'paused'} />`). Should this be implemented as part of the next dev pass, or is the current Escape-releases-pointer-lock behavior acceptable for the competition deadline?

3. **Settings screen scope:** For the competition deadline (2026-04-13), should Settings be limited to volume sliders only (no key rebinding), or omitted entirely in favor of sensible hardcoded defaults? Audio settings are the only thing players realistically need before the deadline.

4. **Kill Feed / enemy naming:** The game design doc specifies named enemy ships and kill notifications ("SUNK: THE RUSTED MERCY"). This is NICE-priority and requires meaningful store work (name pool, event system). Given the deadline, should this be in scope for the competition build or explicitly deferred to post-launch polish?

5. **Controls Overlay accessibility during gameplay:** Should the Controls overlay (H key) pause the game while it is open, or remain non-pausing (informational only)? Pausing is safer but adds complexity — it requires the pause system to be implemented first. Non-pausing is simpler but risks the player dying while reading controls.
