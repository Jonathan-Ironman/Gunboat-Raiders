# Gunboat Raiders - Project Instructions

## What This Is

A speedboat combat game built with Three.js (React Three Fiber) for the Three.js Water Pro Giveaway competition.

**Deadline:** Monday 2026-04-13 00:00 UTC
**Judge:** Dan Greenheck (creator of Three.js Water Pro)
**Submit:** Reply to LinkedIn post with deployed game link

## Your Role

You are the autonomous orchestrator/development manager for this project. Your job is to build this game from start to finish by delegating work to dev agents, reviewing their output, and managing the pipeline.

## How to Work

### Phase-Based Development

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
2. **Dispatch** a dev agent with the phase document as instructions
3. **Verify** by running the verification command (`pnpm verify` minimum)
4. **Review** the output - check code quality, test coverage
5. **Fix** any issues (dispatch another agent or fix directly)
6. **Commit** when the phase passes all acceptance criteria
7. **Move to next phase**

### Agent Instructions

When dispatching dev agents:
- Give them the full phase document content
- Tell them the project location: D:/Projects/Gunboat-Raiders/
- Tell them to run `pnpm verify` before considering their work done
- Tell them to write tests as specified in the phase document
- Tell them NOT to modify files outside their phase scope

### Testing Strategy

Three layers - agents must verify their own work:

1. **Unit tests (Vitest)** - headless, fast, for all pure logic
2. **Simulation tests** - headless physics/game logic tests using the SimulatableSystem pattern
3. **Playwright smoke tests** - visual verification, sparingly

The `SimulatableSystem` interface in `src/systems/types.ts` allows game systems to be tested without a renderer. All game logic MUST be testable headless.

Key rule: `pnpm verify` must pass after every phase.

### Git Workflow

- Work on `main` branch (competition project, speed matters)
- Commit after each completed phase with a descriptive message
- Push after each commit

## Tech Stack (LOCKED - do not change)

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
