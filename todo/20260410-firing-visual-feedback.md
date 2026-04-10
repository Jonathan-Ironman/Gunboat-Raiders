# Firing visually broken — no visible cannonball/explosion storm on broadside

## Description

**TOP PRIORITY.** When firing a broadside (4 port or 4 starboard cannons) or the fore cannons, the user expected to see lots of cannonballs flying and explosions, but it does not visually work. This is the single most important thing to fix — without satisfying firing feedback, the game is not fun.

What should happen on a broadside fire:

- 4 muzzle flashes (one per cannon) clearly visible at each cannon position
- 4 cannonballs visibly launched from the cannon muzzles along their aim direction
- Cannonballs arc through the air under gravity
- Cannonballs create water splash VFX on water impact, or explosion VFX on enemy impact
- Clear audio on fire + impact
- Cooldown is per-quadrant (4 cannons fire simultaneously, then 2s cooldown for that quadrant)

What user observes:

- Firing feels inconsistent
- Expected "lots of cannonballs and explosions" but does not see them
- Combat not confirmed visually

## Context

User feedback 2026-04-10 end of day: "Shooting doesn't work well yet. I expected lots of cannonballs and explosions when we fire broadsides or forward, but that really doesn't seem to work well yet."

We already fixed:

- Cannonballs now glowing emissive spheres (commit 943425b)
- Muzzle flash brightened/enlarged (commit 943425b)
- Firing 1-frame quadrant lag (commit 06a7b18)
- Scenario 9 "all four firing quadrants produce projectiles" passes in automated tests

But the user still doesn't see satisfying visual combat. So automated tests pass but the integrated feel is wrong.

## Acceptance Criteria

- [ ] Clicking once fires ALL cannons in the active quadrant simultaneously (4 cannonballs from a broadside click)
- [ ] All 4 muzzle flashes are clearly visible at their cannon positions
- [ ] All 4 cannonballs are clearly visible arcing through the air (no invisible/hidden projectiles)
- [ ] Water splash VFX visible when projectiles hit the ocean
- [ ] Explosion VFX visible when projectiles hit enemies
- [ ] Audio plays reliably on fire and impact
- [ ] Cooldown is per-quadrant so alternating broadsides is possible
- [ ] Manual playtest confirms "satisfying combat feel"

## Relevant Files

- `src/entities/ProjectilePool.tsx` — projectile rendering and activation
- `src/systems/WeaponSystemR3F.tsx` — fire trigger, per-quadrant firing
- `src/systems/WeaponSystem.ts` — cooldown + computeFireData
- `src/effects/MuzzleFlash.tsx` — muzzle flash VFX
- `src/effects/Explosion.tsx` — explosion VFX
- `src/effects/WaterSplash.tsx` — splash VFX
- `src/effects/ParticleManager.tsx` — VFX event subscription
- `src/utils/boatStats.ts` — weapon mount definitions

## Notes

- Scenario test 9 in `tests/smoke/scenarios.spec.ts` technically passes — so the projectiles ARE being created. The issue is visual/perceptual.
- Possibly: projectile mesh scale still too small despite 0.35 radius upgrade, or they fly out of view too fast to see
- Possibly: muzzle flash lifetime too short to register visually
- Possibly: only 1 cannon per quadrant actually fires due to a loop bug (should be 4 per broadside)
- Recommend: manual playtest with screen recording + frame-by-frame analysis
- This is THE most important remaining fix. Without it, the game is not a game.
