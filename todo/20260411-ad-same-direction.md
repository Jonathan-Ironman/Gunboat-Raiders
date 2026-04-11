# Bug: A and D rotate the boat in the same direction

## Description

Surfaced by a failing smoke test (`tests/smoke/scenarios.spec.ts:195` — "A and D keys rotate the boat in the same direction"). Steering input is miswired: left (A) and right (D) should yaw the boat in opposite directions, but currently produce rotation in the same direction.

User has not explicitly reported this, but it's a real regression and steering feel was a priority. Catch it now.

## Acceptance Criteria

- [ ] Pressing A yaws the boat counter-clockwise (left turn) at the configured turn rate
- [ ] Pressing D yaws the boat clockwise (right turn) at the same magnitude, opposite sign
- [ ] Neither key produces drift; both should scale with `thrust` direction (reverse steering is inverted in real boats — decide if we mirror that or keep forward-style always)
- [ ] Smoke test `scenarios.spec.ts:195` passes
- [ ] Unit test: given left input, torque sign is negative; given right input, positive (or vice versa — document convention)

## Relevant Files

- `src/systems/MovementSystem.ts` — pure movement math
- `src/systems/MovementSystemR3F.tsx` — R3F wrapper applying torque
- `src/systems/InputSystemR3F.tsx` or similar — where keyboard state maps to move commands

## Notes

- Research agent should first confirm the bug is real (run the failing test and capture error) before fixing
- Likely: torque sign uses `abs(input)` or `input*input` instead of signed `input`, OR A and D both map to the same key constant
