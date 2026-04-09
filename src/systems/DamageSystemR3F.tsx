/**
 * R3F damage system -- per-frame armor regeneration for all boats.
 *
 * Collision-driven damage is handled separately via projectile pool
 * onCollisionEnter callbacks (see ProjectilePoolR3F / ProjectileSystemR3F).
 * This component handles:
 * - Armor regeneration each frame for player and enemies
 * - Sinking animation state (translate Y downward, slow roll, remove after 3s)
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import { regenArmor } from './DamageSystem';
import { emitVfxEvent } from '@/effects/vfxEvents';

/** Duration in seconds before a sinking entity is removed from the store. */
const SINK_REMOVE_DELAY = 3.0;

/** Tracks how long each entity has been sinking, keyed by entity ID. */
const sinkTimers = new Map<string, number>();

/** Tracks previous total health (armor+hull) for damage detection. */
const prevHealthMap = new Map<string, number>();

export function DamageSystemR3F() {
  // Track if we've emitted an explosion VFX this frame to avoid duplicates
  const prevPlayerHealthRef = useRef<number | null>(null);

  useFrame((_state, delta) => {
    const store = useGameStore.getState();
    const { player, enemies } = store;

    // --- Damage VFX Detection ---
    // Detect health drops to trigger explosion VFX at entity positions

    if (player) {
      const currentHealth = player.health.armor + player.health.hull;
      if (prevPlayerHealthRef.current !== null && currentHealth < prevPlayerHealthRef.current) {
        emitVfxEvent({
          type: 'explosion',
          position: [...player.position],
          time: performance.now() / 1000,
        });
      }
      prevPlayerHealthRef.current = currentHealth;
    }

    for (const [id, enemy] of enemies) {
      const currentHealth = enemy.health.armor + enemy.health.hull;
      const prevHealth = prevHealthMap.get(id);
      if (prevHealth !== undefined && currentHealth < prevHealth) {
        emitVfxEvent({
          type: 'explosion',
          position: [...enemy.position],
          time: performance.now() / 1000,
        });
      }
      prevHealthMap.set(id, currentHealth);
    }

    // Clean up tracked enemies that no longer exist
    for (const id of prevHealthMap.keys()) {
      if (!enemies.has(id)) {
        prevHealthMap.delete(id);
      }
    }

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
