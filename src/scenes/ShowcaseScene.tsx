/**
 * ShowcaseScene — the peaceful, no-combat R3F tree used as the main
 * menu backdrop.
 *
 * Mount conditions:
 *
 * - Only mounted while `phase === 'mainMenu'` (see `App.tsx` — the
 *   scene is the `<GameEntities />` equivalent for the main menu).
 * - Must live inside `<Physics>` because it contains a `RigidBody`
 *   (the showcase boat) and registers with the buoyancy system.
 *
 * Intentionally excluded compared to `GameEntities`:
 *
 * - `EnemyFleet`, `ProjectilePool`, `EnemyProjectilePool`, `AISystemR3F`,
 *   `WeaponSystemR3F`, `ProjectileSystemR3F`, `DamageSystemR3F`,
 *   `WaveSystemR3F`, `TrajectoryPreview`. No combat, no enemies, no
 *   projectiles — the main menu is strictly water + sky + boat.
 *
 * Included:
 *
 * - `ShowcasePlayerBoat` — a dynamic rigid body registered with buoyancy,
 *   driven by a preset path.
 * - `BuoyancySystemR3F` — so the boat bobs on the Gerstner wave surface.
 * - `MovementSystemR3F` — harmless here because it short-circuits when
 *   `store.player` is `null` (which it is during `mainMenu`). Mounting
 *   it matches the spec in `todo/20260411-ui-overhaul-plan-revised.md`
 *   (R8) so anyone re-reading the scene file finds exactly the
 *   documented shape.
 * - `ShowcaseCameraSystem` — cinematic camera driver that takes over
 *   while the gameplay camera system is idling on a null player body.
 *
 * A random preset is picked once on mount via `pickShowcasePreset` so
 * re-entering the main menu after a game round cycles to a fresh shot.
 */

import { useMemo } from 'react';
import { BuoyancySystemR3F } from '@/systems/BuoyancySystemR3F';
import { MovementSystemR3F } from '@/systems/MovementSystemR3F';
import { ShowcasePlayerBoat } from './ShowcasePlayerBoat';
import { ShowcaseCameraSystem } from './ShowcaseCameraSystem';
import { pickShowcasePreset } from './showcasePresets';

export function ShowcaseScene() {
  const preset = useMemo(() => pickShowcasePreset(), []);

  return (
    <>
      <ShowcasePlayerBoat config={preset.boat} />
      <BuoyancySystemR3F />
      <MovementSystemR3F />
      <ShowcaseCameraSystem preset={preset.camera} />
    </>
  );
}
