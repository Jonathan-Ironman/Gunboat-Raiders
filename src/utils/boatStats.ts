import type { HealthComponent, MovementComponent, WeaponComponent } from '../store/gameStore';

interface BoatStatPreset {
  health: HealthComponent;
  movement: MovementComponent;
  /**
   * Boat preset omits per-entity runtime state (`cooldownRemaining`,
   * `heat`, `heatLockout`) — those are initialised to zero when a boat
   * is spawned from the preset.
   */
  weapons: Omit<WeaponComponent, 'cooldownRemaining' | 'heat' | 'heatLockout'>;
}

export const BOAT_STATS = {
  player: {
    health: { armor: 100, armorMax: 100, armorRegenRate: 3, hull: 100, hullMax: 100 },
    // Powerboat feel: high thrust for punchy acceleration, high turn torque so
    // A/D produce clearly visible yaw within ~0.5s. With Rapier angularDamping
    // = 0.8 and yaw moment of inertia ~2560 kg·m², turnTorque of 2000 N·m
    // yields a terminal yaw rate of ~0.98 rad/s (~56 deg/s) — comfortably
    // above the 45 deg/s target, with the first-order response feeling
    // responsive from the very first frame.
    // Power bumped ~25% per playtest feedback (felt sluggish).
    movement: { thrustForce: 10000, reverseForce: 3000, turnTorque: 2000, maxSpeed: 28 },
    weapons: {
      cooldown: 0.15,
      damage: 25,
      splashDamage: 10,
      // Splash radius tuned so a near-miss (ball striking water within ~5m of
      // an enemy) still chips hull — important for the combat loop because
      // the player's muzzle velocity and elevation produce a fairly flat arc
      // that lands projectiles close to, not exactly on, the target.
      splashRadius: 5,
      muzzleVelocity: 60,
      // ~5.7° elevation plus 60 m/s gives a more pronounced arc with a
      // sweet-spot hit around 55–70 m and a ballistic range under 85 m.
      // This matches the game's intended combat envelope while making shots
      // feel like they loft naturally rather than flying flat.
      // Max total elevation (baseline + MAX_PITCH_OFFSET_UP) = 5.7° + 8° ≈ 13.7°,
      // well within a safe arc and under any elevation cap.
      elevationAngle: 0.1,
      mounts: [
        // Fore (2 small) — pulled inward (x: ±0.4→±0.2) and lowered (y: 0.8→0.4)
        { quadrant: 'fore', localOffset: [0.2, 0.4, 2.0], localDirection: [0, 0.3, 1] },
        { quadrant: 'fore', localOffset: [-0.2, 0.4, 2.0], localDirection: [0, 0.3, 1] },
        // Port broadside (4) — evenly spaced at Z: 0.5, 0.0, -0.5, -1.0 (0.5 gap each)
        { quadrant: 'port', localOffset: [-0.6, 0.4, 0.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-0.6, 0.4, 0.0], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-0.6, 0.4, -0.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-0.6, 0.4, -1.0], localDirection: [-1, 0.3, 0] },
        // Starboard broadside (4) — evenly spaced at Z: 0.5, 0.0, -0.5, -1.0 (0.5 gap each)
        { quadrant: 'starboard', localOffset: [0.6, 0.4, 0.5], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [0.6, 0.4, 0.0], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [0.6, 0.4, -0.5], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [0.6, 0.4, -1.0], localDirection: [1, 0.3, 0] },
        // Aft (1 small) — lowered (y: 0.8→0.4), x stays 0
        { quadrant: 'aft', localOffset: [0, 0.4, -2.0], localDirection: [0, 0.3, -1] },
      ],
    },
  },
  skiff: {
    health: { armor: 30, armorMax: 30, armorRegenRate: 1, hull: 40, hullMax: 40 },
    // thrustForce must overcome linearDamping (0.8) on a 1000kg boat to
    // achieve any meaningful pursuit speed. Terminal velocity is roughly
    // F / (m * damping) = 3500 / (1000 * 0.8) = 4.375 m/s — fast enough to
    // actually close on and threaten the player.
    // Power bumped ~75% per playtest feedback (enemies were in slow motion).
    movement: { thrustForce: 3500, reverseForce: 1400, turnTorque: 350, maxSpeed: 32 },
    weapons: {
      cooldown: 3.0,
      damage: 15,
      splashDamage: 5,
      splashRadius: 2,
      muzzleVelocity: 25,
      elevationAngle: 0.35,
      mounts: [
        { quadrant: 'port', localOffset: [-0.8, 0.6, 0.0], localDirection: [-1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [0.8, 0.6, 0.0], localDirection: [1, 0.3, 0] },
      ],
    },
  },
  barge: {
    health: { armor: 80, armorMax: 80, armorRegenRate: 2, hull: 120, hullMax: 120 },
    // Slower and heavier-feeling than a skiff but still capable of pursuit.
    // Terminal velocity ~= 1800 / (1000 * 0.8) = 2.25 m/s.
    // Power bumped ~50% per playtest feedback (enemies were in slow motion).
    movement: { thrustForce: 1800, reverseForce: 750, turnTorque: 150, maxSpeed: 12 },
    weapons: {
      cooldown: 2.5,
      damage: 20,
      splashDamage: 12,
      splashRadius: 4,
      muzzleVelocity: 28,
      elevationAngle: 0.35,
      mounts: [
        { quadrant: 'port', localOffset: [-1.5, 0.8, 1.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.5, 0.8, 0.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.5, 0.8, -0.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.5, 0.8, 1.5], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.5, 0.8, 0.5], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.5, 0.8, -0.5], localDirection: [1, 0.3, 0] },
      ],
    },
  },
} as const satisfies Record<string, BoatStatPreset>;

export type BoatStatKey = keyof typeof BOAT_STATS;
