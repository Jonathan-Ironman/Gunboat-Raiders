# Collision damage: boat-boat and boat-rock

## Description

Boats currently pass through each other and through rocks without consequence (other than physics bounce). We need collision damage so ramming is meaningful — both as an offensive tactic against enemies and as a penalty for crashing into rocks.

## Acceptance Criteria

- [ ] Boat-boat collision deals damage to both boats proportional to relative impact velocity
- [ ] Boat-rock collision deals damage to the boat proportional to impact velocity
- [ ] Damage scales: glancing contact ≈ light damage, full-speed ram ≈ heavy damage but not instant death
- [ ] Brief invulnerability window after a collision damage tick to avoid double-counting the same contact
- [ ] VFX: impact particles / screen shake on player collisions
- [ ] Audio: impact thud sound
- [ ] Unit test for the collision damage calculation (relative velocity → damage curve)
- [ ] Scenario test: spawn two boats on a collision course, assert both take damage

## Relevant Files

- `src/systems/DamageSystemR3F.tsx` — currently handles projectile damage
- `src/entities/PlayerBoat.tsx` / `EnemyBoat.tsx` — collider setup
- `src/environment/Rocks.tsx` — rock colliders
- `src/utils/constants.ts` — damage tuning constants
