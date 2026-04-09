/**
 * R3F damage system -- per-frame armor regeneration for all boats.
 *
 * Collision-driven damage is handled separately via projectile pool
 * onCollisionEnter callbacks (see ProjectilePoolR3F / ProjectileSystemR3F).
 * This component handles:
 * - Armor regeneration each frame for player and enemies
 * - Sinking animation state (translate Y downward, slow roll, remove after 3s)
 */

import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import { regenArmor } from './DamageSystem';

/** Duration in seconds before a sinking entity is removed from the store. */
const SINK_REMOVE_DELAY = 3.0;

/** Tracks how long each entity has been sinking, keyed by entity ID. */
const sinkTimers = new Map<string, number>();

export function DamageSystemR3F() {
  useFrame((_state, delta) => {
    const store = useGameStore.getState();
    const { player, enemies } = store;

    // --- Armor Regeneration ---

    // Player armor regen
    if (player && !player.isSinking) {
      const { armor, armorMax, armorRegenRate } = player.health;
      if (armor < armorMax) {
        const newArmor = regenArmor(armor, armorMax, armorRegenRate, delta);
        if (newArmor !== armor) {
          useGameStore.setState({
            player: {
              ...player,
              health: { ...player.health, armor: newArmor },
            },
          });
        }
      }
    }

    // Enemy armor regen
    let enemiesUpdated = false;
    const updatedEnemies = new Map(enemies);
    for (const [id, enemy] of enemies) {
      if (enemy.isSinking) continue;
      const { armor, armorMax, armorRegenRate } = enemy.health;
      if (armor < armorMax) {
        const newArmor = regenArmor(armor, armorMax, armorRegenRate, delta);
        if (newArmor !== armor) {
          updatedEnemies.set(id, {
            ...enemy,
            health: { ...enemy.health, armor: newArmor },
          });
          enemiesUpdated = true;
        }
      }
    }
    if (enemiesUpdated) {
      useGameStore.setState({ enemies: updatedEnemies });
    }

    // --- Sinking Cleanup ---
    // Track sinking entities and remove them after SINK_REMOVE_DELAY

    // Check player sinking
    if (player?.isSinking) {
      const timer = (sinkTimers.get('player') ?? 0) + delta;
      sinkTimers.set('player', timer);
      // Player is not removed -- game-over phase handles it
    }

    // Check enemy sinking
    const enemiesToRemove: string[] = [];
    for (const [id, enemy] of enemies) {
      if (!enemy.isSinking) {
        sinkTimers.delete(id);
        continue;
      }
      const timer = (sinkTimers.get(id) ?? 0) + delta;
      sinkTimers.set(id, timer);
      if (timer >= SINK_REMOVE_DELAY) {
        enemiesToRemove.push(id);
      }
    }

    if (enemiesToRemove.length > 0) {
      for (const id of enemiesToRemove) {
        sinkTimers.delete(id);
        store.removeEnemy(id);
      }
    }
  });

  return null;
}
