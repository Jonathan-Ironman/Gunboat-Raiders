# Freer camera — allow looking above horizon

## Description

Camera feels restrictive during play. The user cannot look above the horizon; vertical pitch appears clamped at or near the horizon line. Loosen pitch limits so the sky is visible, but keep a safe lower clamp so the camera never dips underwater.

## Acceptance Criteria

- [ ] Player can pitch the camera up into the sky (e.g., up to ~60° above horizon)
- [ ] Camera never goes below the water surface under any conditions
- [ ] Horizontal rotation still smooth and responsive
- [ ] Scenario test asserts camera Y never < waterY + epsilon across a simulated pan

## Relevant Files

- `src/systems/CameraSystemR3F.tsx`
- `src/utils/constants.ts` — camera clamps
