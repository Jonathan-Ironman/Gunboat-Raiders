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
