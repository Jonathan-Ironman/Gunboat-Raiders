# Enemy boat seen sailing upside down

## Description

During playtest 2026-04-11 the user observed at least one enemy boat traveling upside down. It must never happen — enemies should either self-right or respawn if flipped.

## Acceptance Criteria

- [ ] Enemy boats cannot sail upside down under any spawn conditions
- [ ] If rolled past a threshold, enemy self-rights (righting torque) or is destroyed
- [ ] Verified in a scenario test that spawns enemies and checks orientation over N seconds

## Notes

- Check EnemyBoat spawn rotation — possibly randomized
- Check buoyancy sample points for enemy hull (shared with player despite smaller hull)
- Consider adding a righting moment based on local up vs world up

## Update — playtest 2026-04-11 evening

**NEW SEVERITY: game-blocker, not just cosmetic.**

Jonathan was playing a wave, clearing enemies, getting score (score display is working nicely!). One enemy went missing — turned out to be **upside down AND partially submerged**, drifting under water. He could NOT hit it with cannons and got stuck "dead in the water" unable to clear the wave.

**Additional symptoms:**

- Not just flipped on the surface — actually drifts below the water line when flipped
- Hitbox appears to go with the boat (below water = unhittable by projectiles that hit water first?)
- Blocks wave completion because the wave counter waits for all enemies to die
- Can happen mid-combat, not just at spawn (so spawn rotation alone isn't the only fix)

**Additional acceptance criteria:**

- [ ] An enemy that flips mid-combat must either self-right or die-and-respawn within ~2s
- [ ] The wave-complete check must not wait on an unreachable / invalid enemy
- [ ] If an enemy's hitbox goes below water, treat the enemy as dead (drowned) and remove from wave count
- [ ] Add a deterministic test that spawns an enemy, manually flips it, and asserts it self-rights or gets cleaned up within N seconds
