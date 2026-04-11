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
