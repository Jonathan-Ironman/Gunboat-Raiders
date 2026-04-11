# Rocks: level horizontal, seed-based variation, no wave-tilt

## Description

Current state: the 40 placed rocks use a random full-3D rotation that looks like they are "oriented to a wave" — pitched and rolled. The rock assets were not designed for this; they are intended to sit flat on the ground (or in this case, the seabed / water line). Random pitch/roll makes them look wrong because rocks don't float, they're grounded.

What we want instead:

- **Perfectly level** horizontally (roll = 0, pitch = 0)
- **Random rotation only around the Y axis** (yaw) — free 0–2π
- **Seed-based scale variation** — some a bit larger, some a bit smaller, subtle (e.g. 0.7×–1.4×)
- **Seed-based clustering** — rocks should sometimes cluster together instead of being perfectly spread, making the ocean feel more natural
- **Deterministic from a world seed** — same seed = same layout every time

## Reference implementation

Seed-based placement + scale + cluster logic already exists in the **Firefly** project in the same parent directory (`D:/Projects/Firefly/`). Agents implementing this should look there for:

- The PRNG / hash pattern for deterministic placement
- The clustering algorithm (likely Poisson-disk-with-bias, Voronoi, or weighted random)
- The scale distribution curve

Do not copy blindly — adapt to this project's conventions — but reuse the tested math.

## Acceptance Criteria

- [ ] Every rock has roll = 0, pitch = 0 (level) in its transform
- [ ] Every rock has a seed-based Y-axis rotation
- [ ] Rocks have seed-based scale variation in [0.7, 1.4]
- [ ] Some rocks form small clusters (2–4 rocks close together)
- [ ] Layout is deterministic from a single world seed
- [ ] Unit test: given a seed, asserts stable rock transforms across runs
- [ ] Unit test: rock roll and pitch are exactly 0 for every placed rock
- [ ] Visual sanity: rocks all look upright, none tilted

## Relevant Files

- `src/environment/Rocks.tsx` — rock placement / rendering
- `src/utils/rockPlacement.ts` (if it exists) — placement math
- `tests/unit/rockPlacement.test.ts` — existing unit tests for rock placement
- Reference: `D:/Projects/Firefly/` — seed-based placement + cluster code
