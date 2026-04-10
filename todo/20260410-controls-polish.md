# Controls not yet polished — need fine tuning

## Description

Controls are slightly improved after the speedboat feel fixes (commit 06a7b18) but still not fully polished. User reports "controls feel slightly faster but far from polished."

Remaining polish work:

- Fine-tune acceleration curve for satisfying speedboat feel
- Tune turning rate so it feels natural, not too snappy or too sluggish
- Camera follow should feel smooth and predictable
- Input response should be immediate (no perceptible lag)

## Context

User feedback 2026-04-10 end of day: "The controls are slightly more fluid, but it's far from polished."

Previous changes:

- turnTorque 400 → 2000 (commit 06a7b18)
- thrustForce 6000 → 8000 (commit 06a7b18)
- linearDamping 0.15 (commit 06a7b18)
- Nose-up planing via addForceAtPoint (commit 06a7b18)

## Acceptance Criteria

- [ ] Accelerating from standstill feels punchy — noticeable speed build within 1 second
- [ ] Top speed reached within ~3 seconds
- [ ] Turning rate feels natural (not twitchy, not sluggish)
- [ ] Camera follow is smooth with slight inertia
- [ ] Stopping (releasing W) has natural drag, not harsh braking
- [ ] Reverse is weaker than forward (matches real boats)
- [ ] A/D while moving forward produces smooth arc, not sudden rotation
- [ ] Manual playtest rates feel as "polished" (subjective but the user is the judge)

## Relevant Files

- `src/utils/boatStats.ts` — player thrustForce, turnTorque, reverseForce, maxSpeed
- `src/entities/PlayerBoat.tsx` — linearDamping, angularDamping, mass
- `src/systems/MovementSystemR3F.tsx` — force application (nose-up planing at point)
- `src/systems/MovementSystem.ts` — pure movement math
- `src/systems/CameraSystemR3F.tsx` — camera follow smoothing
- `src/utils/constants.ts` — BOAT_MASS, physics tuning

## Notes

- Consider adding throttle ramp-up/down (analog feel) instead of binary on/off
- Consider camera look-ahead based on velocity
- Consider subtle FOV change at high speed for sense of speed
- Consider bow-wake VFX when moving fast
- User is the ultimate judge of "polished" — iterate based on playtest feedback
