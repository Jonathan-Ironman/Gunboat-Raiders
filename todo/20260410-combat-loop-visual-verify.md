# Combat loop not visually confirmed end-to-end

## Description

The user has not yet seen a working combat loop in the browser. Automated tests pass (all 9 scenarios including "full combat loop: cannonballs damage enemies on impact"), but the integrated browser experience has not been visually confirmed by the user.

Expected:

- Enemies visibly approach the player boat
- Player can fire at them and hit them
- Enemies take damage (visible on their health bars)
- Enemies sink when hull reaches 0
- Enemies fire back at the player
- Player takes damage with visual feedback (screen shake, vignette flash, health bar)
- Wave clears after all enemies sunk
- Next wave starts with more enemies

## Context

User feedback 2026-04-10: "I haven't seen working combat yet." Multiple fixes were applied to enemy AI (detection range, torque sign, thrust force) and the damage pipeline (projectile collision → applyDamage) but user has not confirmed seeing combat working in their browser.

Tests that pass:

- scenario 5: "full combat loop: cannonballs damage enemies on impact"
- scenario 4: "enemies spawn and are positioned in the arena"
- scenario 9: "all four firing quadrants produce projectiles"

## Acceptance Criteria

- [ ] Start game, see 2 enemies approach within 10 seconds
- [ ] Aim at an enemy and fire — projectile visibly hits and damages the enemy
- [ ] Enemy health bar visibly decreases
- [ ] Continue firing until enemy sinks (visible sinking animation, then disappears)
- [ ] Enemies fire back at player, projectiles visible
- [ ] Player takes damage — health bar decreases, screen feedback visible
- [ ] After both enemies sink, wave-clear triggers
- [ ] Next wave spawns with more enemies
- [ ] Manual playtest confirms the full combat loop works

## Relevant Files

- `src/systems/AISystemR3F.tsx` — enemy AI state machine
- `src/entities/EnemyBoat.tsx` — enemy entity, health bar
- `src/ui/EnemyHealthBar.tsx` — floating health bar
- `src/systems/DamageSystemR3F.tsx` — collision damage
- `src/systems/WaveSystemR3F.tsx` — wave progression
- `tests/smoke/scenarios.spec.ts` — automated tests that pass but don't prove human experience

## Notes

- This overlaps with firing visual feedback todo — if firing works visually, combat confirmation should follow
- Recommended: add damage flash, hit markers, kill confirms for clarity
- Recommended: enemies should spawn closer or approach faster for quicker feedback loop
- Recommended: reduce initial enemy count to 1 for tutorial-like first wave

## Status: PARTIALLY COMPLETE 2026-04-11

The core combat loop is now visually working:

- Enemies approach and engage (confirmed working before this session)
- Player can fire with visible cannonballs, ribbon trajectory, muzzle flashes
- Enemy pool split fixed enemy projectiles — enemies now fire back with projectiles that travel and damage
- Damage pipeline is wired end-to-end

However, the acceptance criteria include "manual playtest confirms the full combat loop works" — Jonathan confirmed score display is working nicely and did observe combat, but the enemy-upside-down game-blocker (separate todo) means a wave can get stuck. Until that blocker is resolved, the loop cannot be called fully confirmed. Mark as partially complete pending enemy-upside-down fix.
