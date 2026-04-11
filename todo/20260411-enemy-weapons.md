# Enemy weapons: match player loadout + actually fire

## Description

Two issues combined:

1. **Loadout parity** — enemy boats must carry the same loadout as the player: 2 broadsides (port + starboard) + 1 frontside. Currently they do not.
2. **Enemies never fire** — the user has never seen an enemy projectile fly toward the player. AI firing is either not triggering or projectiles are not visible.

## Acceptance Criteria

- [ ] Enemy boats have 2 broadsides + 1 frontside cannon mounts (parity with player)
- [ ] Scenario test: start game, wait 10s, assert at least one enemy-owned projectile was spawned
- [ ] Enemy projectiles visibly travel toward the player (not stuck at spawn)
- [ ] Enemy projectiles damage the player on hit
- [ ] Enemy cannons on the barge/skiff models placed at sensible positions (broadside along length)

## Relevant Files

- `src/utils/boatStats.ts` — weapon mounts per boat type
- `src/entities/EnemyBoat.tsx` — enemy rendering
- `src/systems/AISystemR3F.tsx` — AI firing trigger
- `src/systems/WeaponSystemR3F.tsx` — firing pipeline

## Status: PARTIALLY COMPLETE 2026-04-11

**Landed (commit `b613415`):**

- Enemy projectiles now travel and damage the player — the "enemies never fire" issue is resolved. The `EnemyProjectilePool` split fixed the self-collision bug that was killing shots immediately.

**Still open:**

- Loadout parity: enemy boats do not yet have 2 broadsides + 1 frontside (player-equivalent) mount configuration. Current enemy mounts in `boatStats.ts` are a smaller set. This acceptance criterion was not addressed this session.
- The scenario test for "at least one enemy-owned projectile spawned within 10s" is now more likely to pass but was not explicitly updated/verified for this criterion.
