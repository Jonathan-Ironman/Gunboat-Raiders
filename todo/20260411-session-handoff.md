# Session handoff — 2026-04-11

**You are the orchestrator.** Work together with Jonathan. Before anything else:

1. **Resolve the firing bug.** Full description and process rules in `todo/20260411-firing-bug-handoff.md`. Read that first. Do not skip the reproduction-test-first discipline documented there.

## Memory to load

Global memory index at `C:\Users\jona8\.claude\projects\D--Projects-Gunboat-Raiders\memory\MEMORY.md` has accumulated feedback rules from this session. Particularly important ones for handling this bug:

- **Deterministic test first** — reproduction test must fail on the bug before any fix
- **Check before dispatching** — do not spawn follow-up agents on a topic that already has one running without asking
- **Compact manager comms** — one urgent question at a time, no walls of text
- **Voice call for testing** — Jonathan is within earshot, use voice when his eyes are needed
- **Technical autonomy / user owns design** — technical fixes autonomous, visual verdict always Jonathan's

## Repo state at handoff

After the git agent's housekeeping commit, the working tree contains **only firing-bug related code changes**. Everything else has been committed:

- Todos committed (including this handoff, the firing bug description, the audit, the UI overhaul plan, and the audio-sources todo)
- Harbour Dawn art direction document committed at `docs/art-direction/index.html`
- `.gitignore` and `parked/` committed

The following uncommitted files are the pending firing-bug work. They include both real improvements (pool leak fix, pool split, cooldown restoration) and the failed Opus chase-cam rework. See the firing-bug handoff todo for the full list and a recommendation on how to handle them.

## Other open work (lower priority than the firing bug)

- **Boat/wave sync** (#1 in the task list) — `parked/buoyancy-arch-b/` holds a failed Architecture B attempt. Do not resume this until the firing bug is fixed.
- **UI overhaul plan** (`todo/20260411-ui-overhaul-plan.md`) — 18 slices based on Harbour Dawn design. Jonathan wants ONE Opus agent to do it A-to-Z, but only AFTER the firing bug is fixed. Jonathan has explicitly said he wants to discuss the UI plan with the orchestrator before implementation begins.
- **A / D rotation bug** (#18) — sometimes rotates the boat in the same direction. Pre-existing, flaky test, not blocking.
- **Sound effect research** (#20) — agent should download CC0/CC-BY audio assets into `public/audio/` and write a manifest at `docs/audio-sources.md`.
- **Multiplayer research** (#11) — pure research, not in scope unless Jonathan revisits.
- **Collision damage, rock level fix, pause menu, enemy loadout parity, upside-down enemy, camera freedom, stronger braking** — all queued in individual todo files from the 2026-04-10 playtest.

## Process reminders

- Orchestrator owns git. Commits happen after Jonathan visually confirms a slice works.
- Agents must be dispatched in the background so chat stays unblocked.
- Run research ahead of execution to keep the pipeline full.
- Research agents write findings directly into the relevant todo markdown file, not only to chat.
- `pnpm.exe` is blocked on this machine by Device Guard. Use `node node_modules/.../bin.js` invocations instead when running tools directly.
- The dev server is running on `http://localhost:5173` by default. Do not spawn a second one.
