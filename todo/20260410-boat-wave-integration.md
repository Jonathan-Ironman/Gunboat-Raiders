# Boat + wave interaction still not quite right

## Description

The wave-riding buoyancy fix (commit 0667baf) was a significant step forward — the boat now demonstrably rides the wave surface with natural tilt and rise/fall. However, the user reports that "the boat and the waves, that's also not quite what it should be yet."

This is the core premise of a Three.js water competition game, so it needs to be excellent, not just working.

## Context

User feedback 2026-04-10 end of day: "And that boat and those waves, that's also not quite what it should be yet."

Previous fix (commit 0667baf):

- BUOYANCY_VERTICAL_DAMPING 10 → 3.5
- BUOYANCY_ANGULAR_DAMPING 8 → 1.5
- BUOYANCY_MAX_SUBMERSION 1.2 → 3.0
- BUOYANCY_TORQUE_SCALE 0.25 → 1.0
- Rapier angularDamping 3 → 0.8

Measured: Y range 1.79m, max tilt 13.5°, std 4°/4.4°.

But the user's subjective impression is that it's not yet right.

## Acceptance Criteria

- [ ] Boat visibly rises and falls with every wave (no choppy stutter)
- [ ] Boat visibly tilts with wave slopes (bow up on rising wave, bow down on descending)
- [ ] Boat never clips through the water surface on big waves
- [ ] Boat never gets buried under a wave crest
- [ ] Wave-riding feels natural, like a real boat
- [ ] Tilt affects aiming (cannon mounts move with boat pitch/roll)
- [ ] Motion blur or spray/wake VFX sells the speed and water interaction
- [ ] Manual playtest rates boat-wave integration as "excellent"

## Relevant Files

- `src/systems/BuoyancySystem.ts` — pure buoyancy math, 8 hull sample points
- `src/systems/BuoyancySystemR3F.tsx` — R3F wrapper applying forces
- `src/environment/gerstnerWaves.ts` — wave height function
- `src/utils/constants.ts` — buoyancy tuning constants
- `src/entities/PlayerBoat.tsx` — rigid body config
- `src/environment/Water.tsx` — water mesh
- `src/environment/waterShader.ts` — water vertex displacement

## Notes

- HULL_SAMPLE_POINTS is shared across player and enemy boats but sized for player (5×2.4m). Enemy is 3.6×1.6m. Consider per-boat-type sample points.
- Consider visible bow wake (white foam particles) when boat is moving — sells the boat-water interaction
- Consider spray particles when boat hits a wave crest
- Consider boat model rotation could lag slightly behind physics for smooth visual (visual interpolation)
- Consider tuning sample points to be more accurate to boat shape (front-heavy, back-heavy for different feel)
- The water shader uses Gerstner waves; verify the CPU `getWaveHeight` exactly matches the GPU displacement at the same (x, z, time)
- Reference: real boats have distinct planing vs displacement modes — we're in the ballpark but could polish the transition

## Update — 2026-04-12 playtest

**Top symptom Jonathan flagged for tomorrow's session:**

> "De hoogte van de golven. Het schip verdwijnt vaak onder de golven."
> ("The wave height. The ship often disappears under the waves.")

Concrete behaviour: while sailing, the boat regularly drops below the wave surface — not just dipping, but fully submerging the deck so the camera ends up inside / behind a wave crest. Reads as a wave-amplitude vs buoyancy-restoring-force imbalance. Either the waves are too tall for the buoyancy to keep up, or the buoyancy max submersion floor is letting the hull go too deep before the restoring force fires.

Quick directions to investigate before doing anything dramatic:

- `BUOYANCY_MAX_SUBMERSION` is currently 3.0 (was bumped from 1.2 in the previous fix). That allows a 3-unit depth before clamping — possibly too generous for the current wave amplitude.
- Wave amplitude in `gerstnerWaves.ts` may have grown without a corresponding buoyancy retune.
- The CPU sample of `getWaveHeight` may be drifting from the GPU displacement at the same `(x, z, time)` — if the CPU sample reads a lower height than the GPU shows, the boat physically sits at the wrong y while the visible water rises higher.
- Verify HULL_SAMPLE_POINTS still match the player boat hull dimensions after the recent boat tuning.

**This is one of the two top blockers for the 2026-04-13 session.** It is a competition-critical visual — the judge is a Three.js water expert.

## Update - 2026-04-13 branch review and user verdict

What landed on PR #4 during the follow-up investigation:

- CPU/GPU wave sampling parity work, with shared wave config and explicit parity tests
- Whole-boat Playwright smoke coverage for visual waterline drift and phase-band widening after long drives and steering-heavy routes
- Buoyancy damping change so the boat damps relative to the local moving water surface instead of absolute world Y motion
- Player-side buoyancy tuning and render/debug bridges that made the problem measurably testable

Formal status on the branch:

- The automated parity, unit, and Playwright smoke checks now demonstrate a real improvement versus `main`
- The branch is worth keeping because it gives us much better instrumentation and catches regressions the old test suite could not see

User verdict on 2026-04-13 remains the authority:

> "Ik heb het idee dat het wel beter is, maar het is nog steeds niet helemaal opgelost."

What is still reported after the formal fixes:

- The player boat can still end up visibly under the waves in some locations
- The player boat can still end up visibly out of sync even after coming to rest
- Enemy boats can also still disappear under the waves

Current review conclusion:

- Treat PR #4 as a partial improvement, not as a full resolution of this todo
- If we merge PR #4, do it because the branch materially improves player-side behavior and adds much stronger regression coverage
- Do not mark this todo done on merge
- Manual playtest authority overrides the automated green signal when the two disagree

Most likely next follow-up work:

- Add enemy-specific visual reproduction and formal smoke coverage; the current smoke suite only exercises the player boat
- Compare enemy buoyancy registration/tuning with the newer player path; `src/entities/EnemyBoat.tsx` still registers through the generic buoyancy setup
- Keep investigating the remaining whole-boat phase drift cases that still appear after travel and at rest
