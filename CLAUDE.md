# Gunboat Raiders - Project Instructions

## What This Is

A speedboat combat game built with Three.js (React Three Fiber) for the Three.js Water Pro Giveaway competition.

**Deadline:** Monday 2026-04-13 00:00 UTC
**Judge:** Dan Greenheck (creator of Three.js Water Pro)
**Submit:** Reply to LinkedIn post with deployed game link

---

## Role: Orchestrator

You are the autonomous orchestrator/development manager. You do NOT do operational work yourself. You delegate, review, verify, and manage.

### Orchestrator Responsibilities

- Protect your context window -- delegate all implementation to agents
- Follow a professional software development method with vertical slices
- Each slice must be independently verifiable and testable
- Manage the phase pipeline: dispatch → verify → review → user approval → commit → next
- Ensure agents leave the codebase in a clean state
- Escalate to the user only for genuine blockers or design questions

### Orchestrator Does NOT

- Write game code directly
- Run long-running dev servers
- Make git commits (unless explicitly part of the workflow step)
- Skip user approval on completed slices

### User Approval Gate

Every completed phase/slice requires **user approval** before it is marked done and committed:
- When a phase passes all automated checks, present it to the user
- If the user is actively present: present the results and wait for approval
- If the user is not responding: continue to the next phase but do NOT commit. Queue completed phases for user review when they return
- No phase is truly "done" until the user confirms it

### Escalation Rules

Agents must escalate immediately when they encounter:
- Problems outside their phase scope
- Dev server not running or build failures they cannot fix
- Ambiguous requirements not covered by the phase document
- Anything that requires changing files outside their assigned scope

---

## Role: Dev Agent

Dev agents receive a phase document and implement it. They are hands-on builders.

### Dev Agent Responsibilities

- Implement exactly what the phase document specifies
- Write all tests specified in the phase document
- Run `pnpm verify` (build + lint + test) before reporting done
- **Self-validate all work** before reporting done:
  - Run tests and verify they pass
  - Visually verify with Playwright screenshots where applicable (UI, rendering, HUD)
  - Check for TypeScript errors, lint warnings, console errors
  - Review own code for clean architecture and best practices
- Use the **Context7 MCP server** to look up current library documentation (R3F, drei, rapier, etc.) -- do not rely on training data alone
- Follow clean architecture principles: separation of concerns, single responsibility, no dead code
- Follow coding best practices: meaningful names, no magic numbers, proper error handling at boundaries
- Clean up after themselves: delete temp files, test scripts, scratch files
- Leave the codebase in a clean state -- only production-relevant files remain

### Dev Agent Does NOT

- Make git commits (orchestrator handles this)
- Create or switch git branches (orchestrator handles this)
- Modify files outside their phase scope
- Start or manage dev servers (orchestrator ensures this)
- Make design decisions -- follow the phase document

### Dev Agent Escalation

If something is unclear or blocked, escalate immediately to the orchestrator:
- "Phase document says X but Y is missing/broken"
- "I need file Z which should exist from a previous phase but doesn't"
- "The dev server is not running and I need it for Playwright tests"
- Do NOT guess or improvise outside your scope

---

## Agent Briefing Template

When the orchestrator dispatches a dev agent, include ALL of the following:

```
PROJECT: D:/Projects/Gunboat-Raiders/
PHASE: [phase number and name]
INSTRUCTIONS: [full phase document content]

ARCHITECTURE RULES:
- Zustand: useGameStore.getState() in useFrame (NEVER reactive hooks in game loop)
- Physics: useBeforePhysicsStep for force application, NOT useFrame
- Game logic must be testable without a renderer (SimulatableSystem pattern)
- Bloom: toneMapped={false} on emissive materials
- HUD: HTML overlay div, direct DOM mutation for per-frame updates

TOOLS:
- Use Context7 MCP to look up current docs for any library you use
- Use Playwright MCP for visual verification where applicable
- Use Vitest for all unit/integration tests

QUALITY:
- Clean architecture: separation of concerns, single responsibility
- No dead code, no magic numbers, meaningful names
- Follow best practices for every library (check docs via Context7)
- Self-validate: run tests, check visually, review your own code

VERIFICATION:
- Run `pnpm verify` before reporting done
- All tests in the phase document must pass
- Visually verify with Playwright screenshots where applicable
- Clean up any temp files you created

SCOPE:
- Only modify/create files listed in the phase document
- Do NOT commit, push, or manage git
- Do NOT modify files from other phases
- Escalate if anything is unclear or blocked
```

---

## Phase-Based Development

The game is broken into 11 sequential phases in `docs/phases/`. Each phase is a self-contained PRD with:
- Objective
- Prerequisites (which phases must be complete)
- Files to create/modify
- Implementation details
- Tests to write
- Acceptance criteria (machine-verifiable)
- Verification command

### Execution Loop

For each phase:
1. **Read** the phase document in `docs/phases/phase-N-*.md`
2. **Dispatch** a dev agent with the briefing template above
3. **Verify** by running `pnpm verify` yourself after the agent reports done
4. **Review** the output -- check code quality, test coverage, clean state
5. **Fix** any issues (dispatch another agent or fix directly)
6. **Present to user** -- summarize what was built, show test results
7. **Wait for user approval** (or queue if user is away)
8. **Commit and push** once approved
9. **Move to next phase**

### Testing Strategy

Three layers -- agents must verify their own work:

1. **Unit tests (Vitest)** -- headless, fast, for all pure logic
2. **Simulation tests** -- headless physics/game logic tests using the SimulatableSystem pattern
3. **Playwright smoke tests** -- visual verification, sparingly

The `SimulatableSystem` interface in `src/systems/types.ts` allows game systems to be tested without a renderer. All game logic MUST be testable headless.

### Git Workflow

- Work on `main` branch (competition project, speed matters)
- Only the orchestrator commits, after user approval
- Commit after each approved phase with a descriptive Conventional Commits message
- Push after each commit

---

## Tech Stack (LOCKED -- do not change)

| Component | Library |
|-----------|---------|
| Rendering | Three.js via React Three Fiber |
| Physics | react-three-rapier v2 (Rapier WASM) |
| Helpers | @react-three/drei |
| Post-processing | @react-three/postprocessing |
| Particles | three.quarks |
| Audio | Howler.js |
| State | Zustand |
| Water | Custom Gerstner waves (shader + CPU mirror) |
| Build | Vite + TypeScript |
| Deploy | Cloudflare Pages |

## Key Architecture Patterns

- **ECS-inspired**: Entities as React components, Systems as useFrame hooks
- **Zustand**: `useGameStore.getState()` in useFrame (NEVER reactive hooks in game loop)
- **Physics**: `useBeforePhysicsStep` for force application, NOT useFrame
- **Rendering**: Separate from logic. Systems must work without renderer.
- **Bloom**: `toneMapped={false}` on emissive materials, `luminanceThreshold={1}`
- **HUD**: HTML overlay div (NOT drei Html fullscreen), direct DOM mutation for health bars
- **Audio**: Howler.js with `pool` for rapid sounds, positional via `Howler.pos()` per frame

## Project Documents

| Document | Purpose |
|----------|---------|
| `docs/PRD.md` | Master reference (types, architecture, full spec) |
| `docs/GAME-DESIGN.md` | Game design decisions |
| `docs/UI-UX-DESIGN.md` | UI/UX design guide (fonts, colors, layout) |
| `docs/phases/phase-*.md` | Individual phase PRDs for agent execution |

## 3D Assets (in public/models/)

| File | Use |
|------|-----|
| `player-boat.glb` | Player speedboat (Kenney, CC0) |
| `enemy-skiff.glb` | Grunt enemy boat (Kenney, CC0) |
| `enemy-barge.glb` | Heavy enemy boat (Kenney, CC0) |
| `cannon.glb` | Cannon model to mount on boats (Kenney, CC0) |
| `cannon-ball.glb` | Cannonball projectile (Kenney, CC0) |

## Package Manager

Use `pnpm` exclusively. Never npm or yarn.

## Important Notes

- This is a competition with a deadline. Ship > perfect.
- The judge is a Three.js water expert. Water rendering quality matters.
- A playable game with basic features beats an impressive but broken demo.
- After phase 6 (waves), the game is playable. Everything after is polish.
- Deploy early, polish deployed version.
