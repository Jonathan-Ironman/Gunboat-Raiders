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
