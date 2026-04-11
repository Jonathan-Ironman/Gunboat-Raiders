# Session handoff — 2026-04-13 (next session)

**You are the orchestrator.** Two real game-blocking bugs are top of the list. Everything else waits.

---

## TOP PRIORITY 1 — Firing fails position-dependently in some quadrants

**File:** `todo/20260411-firing-bug-handoff.md` — read the WHOLE file. The "REOPENED 2026-04-12" note at the bottom explains why this is back on the list. The original symptom description in the body is still the canonical reproduction.

**Jonathan's words on 2026-04-12:**

> "Sommige kwadranten, als we op een bepaalde positie zijn, dan werkt het schieten niet."

This is the same position-dependent "aim line disappears, only points back to origin" symptom Jonathan described many times in the previous session. The 2026-04-11 "completed" status was wrong — the pointer-lock fix from `b613415` addressed a related issue but not the core bug. The 2026-04-12 pointer-lock startup gating fix (commit `12464ca`) fixed a DIFFERENT first-click stray-fire issue, not this one.

**Process discipline (non-negotiable):**

- Reproduction test FIRST. Write a failing test that captures what Jonathan describes (sail forward from origin, observe forward-quadrant fire fails) BEFORE attempting any fix. The existing `tests/smoke/firing-orientation.spec.ts` and `firing-position-drift.spec.ts` apparently do NOT capture the actual bug — they pass while the bug is present. Re-examine them as part of the reproduction work.
- Stop reinterpreting Jonathan's observations into different bugs. The "what this is NOT" rule-out list in the firing-bug handoff is canonical — do not waste time re-running those theories.
- The repo Playwright scenario tests are the verification mechanism. **Do NOT use MCP Playwright** — banned on this project.

---

## TOP PRIORITY 2 — Boat disappears under the waves

**File:** `todo/20260410-boat-wave-integration.md` — the original todo plus the "Update — 2026-04-12 playtest" section at the bottom.

**Jonathan's words on 2026-04-12:**

> "De hoogte van de golven. Het schip verdwijnt vaak onder de golven."

Concrete behaviour: while sailing, the deck regularly fully submerges so the camera ends up inside / behind a wave crest. This is a wave-amplitude vs buoyancy-restoring-force imbalance. The judge is a Three.js water expert — this is competition-critical.

**Investigation directions (in the todo):**

- `BUOYANCY_MAX_SUBMERSION` is at 3.0 — possibly too generous
- Wave amplitude in `gerstnerWaves.ts` may have grown without a corresponding buoyancy retune
- CPU `getWaveHeight` may be drifting from the GPU displacement (different y reads)
- HULL_SAMPLE_POINTS may not match the current player boat hull dimensions

Start with research → plan → user approval → execute. This is a visual / physical-feel bug that needs Jonathan's eyes on the result.

---

## What's queued after the two blockers

| File                                                                 | Type            | Effort                                                        |
| -------------------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| `todo/20260411-enemy-upside-down.md`                                 | game-blocker    | Medium-large, has spec                                        |
| `todo/20260411-object-lifetime-audit.md` (4 items still open)        | tech debt sweep | ~5h total                                                     |
| Testing pyramid research + plan + execute                            | architectural   | multi-phase, needs Jonathan green light                       |
| 7 smoke specs still reference deleted `[data-testid="start-button"]` | broken tests    | rewrite or delete in pyramid pass                             |
| `resetAimOffset()` not called in `CameraSystemR3F` cleanup           | minor           | ~5 min, same shape as `resetPointerLockRefs` fix in `b5b23f3` |

Lower-priority queue:

- `todo/20260411-audio-sources.md` — manifest + curated downloads never done
- `todo/20260411-camera-freedom.md`
- `todo/20260411-collision-damage.md`
- `todo/20260411-research-multiplayer.md` (research only, low priority)
- `todo/20260411-ad-same-direction.md` (flaky test, pre-existing)
- `todo/20260410-performance-sluggish.md`
- Splash font fallback verification (probably moot — `TitleScreen.tsx` was deleted)

---

## What landed on 2026-04-12 (this session)

Eight commits, all on `main`, working tree clean.

- **`b5b23f3`** `refactor: bundled review fix-up across recent commits` — 12 fixes from a 5-agent parallel review: `useFullscreen` Node guard for `useEffect`, stable `toggleFullscreen` callback ref, magic hex hover gradients moved into new `tokens.ts` constants (`GOLD_LIGHT/GOLD_MID/RED_LIGHT/RED_MID`), `resetPointerLockRefs()` wired into `CameraSystemR3F` cleanup, `console.warn` on fullscreen rejection, drain-gate clear-on-lock-loss test, six comment cleanups
- **`bf9e1ac`** `feat(ui): fullscreen toggle button in pause + main menu` — new shared `useFullscreen` hook + button in both menus, label reflects state, fails silently on browser rejection
- **`8affa82`** `tune(combat): trajectory ribbon — narrower, more transparent, white` — `HALF_WIDTH_PER_MOUNT` 0.4 → 0.28, `RIBBON_COLOR` gold → white, `RIBBON_OPACITY` 0.4 → 0.3
- **`12464ca`** `fix(input): gate firing + aim ribbon on actual pointer lock acquisition` — new `pointerLockRefs` shared module, `WeaponSystemR3F.onMouseDown` requires `getIsPointerLocked() === true`, queue cleared on lock loss, `TrajectoryPreview` hidden during unlocked window. Eliminates stray cannon shot on first canvas click after Continue / New Game
- **`569ac09`** `fix(ui): unify button shadows + match secondary hover to destructive` — removed `embossShadowWithAccent` + per-variant accent glows, `SHARED_DROP_SHADOW` 0.6 → 0.35, secondary `:hover` background now matches destructive's red gradient (Settings turns red on hover the same way Exit does), purged 6 dead style helper exports
- **`20c9faf`** `docs(todo): mark completed items from 2026-04-11 evening session` — audit pass over 28 todo files

936 / 936 unit tests green at session end.

**Important context for new agents:** the prior session's `20260411-session-handoff.md` has been DELETED (it was correctly marked superseded — its job was done). The firing-bug handoff (`20260411-firing-bug-handoff.md`) has been REOPENED with a note at the bottom — read it.

---

## Repo state

- Branch: `main`
- Local is **~70 commits ahead of `origin/main`**, never pushed. Cloudflare Pages config (`wrangler.toml`) is in place but `wrangler` is not installed as a devDep yet. Phase 10 (deploy) has not been executed. Push when Jonathan gives the explicit go-ahead.
- Working tree: clean
- 936 / 936 unit tests passing
- Dev server runs on `http://localhost:5173` — do not spawn a second one if one is already running
- `pnpm verify` is the canonical pre-commit gate (build + lint + test)

---

## Memory to load

Global memory index at `C:\Users\jona8\.claude\projects\D--Projects-Gunboat-Raiders\memory\MEMORY.md`. Particularly load these for tomorrow's bug-hunt work:

- **Deterministic test first** — reproduction test must fail on the bug before any fix
- **Honest progress** — unit tests ≠ working game; integrated playtest is the truth
- **Match orchestrator overhead to task size** — small fixes go to a single Sonnet end-to-end; only complex/architectural work warrants multi-phase delegation
- **Always use repo Playwright scenario tests, never MCP Playwright** — absolute on this project
- **Compact manager comms** — one urgent question at a time, no walls of text
- **Plain-language status** — never use `R[n]` slice IDs; describe what was built
- **Voice updates** — `/speak heart` for in-earshot questions, otherwise chat
- **Technical autonomy** — autonomous on technical fixes, Jonathan owns visual / mechanical verdicts
- **Protect context window** — delegate liberally, never read large files yourself

---

## Process reminders

- Orchestrator owns git: commits, branches, integration. Agents must NOT commit, push, or manage git.
- Orchestrator owns dev-server lifecycle. Agents should not spawn long-running servers.
- All agent dispatch is `run_in_background=true` by default so chat stays unblocked.
- Default to Sonnet for execution; reserve Opus for architectural / design-open work.
- Run review agents (code-reviewer, type-design-analyzer, silent-failure-hunter, comment-analyzer, pr-test-analyzer) liberally in parallel after substantive work.
- Voice-report proactively before stopping each turn.
- **Testing pyramid initiative is queued but not started.** Until it lands, the existing Vitest unit tests + the spotty `tests/smoke/*.spec.ts` files are the only verification surface. Do not write new MCP-Playwright-driven verification — only repo-based scenario tests, ideally inside the upcoming pyramid plan.
