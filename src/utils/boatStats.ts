import type { HealthComponent, MovementComponent, WeaponComponent } from '../store/gameStore';

interface BoatStatPreset {
  health: HealthComponent;
  movement: MovementComponent;
  weapons: Omit<WeaponComponent, 'cooldownRemaining'>;
}

export const BOAT_STATS = {
  player: {
    health: { armor: 100, armorMax: 100, armorRegenRate: 3, hull: 100, hullMax: 100 },
    movement: { thrustForce: 800, reverseForce: 300, turnTorque: 200, maxSpeed: 15 },
    weapons: {
      cooldown: 2.0,
      damage: 25,
      splashDamage: 10,
      splashRadius: 3,
      muzzleVelocity: 30,
      elevationAngle: 0.35, // ~20 degrees
      mounts: [
        // Fore (2 small)
        { quadrant: 'fore', localOffset: [0.4, 0.8, 2.0], localDirection: [0, 0.3, 1] },
        { quadrant: 'fore', localOffset: [-0.4, 0.8, 2.0], localDirection: [0, 0.3, 1] },
        // Port broadside (4)
        { quadrant: 'port', localOffset: [-1.2, 0.8, 1.0], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.2, 0.8, 0.0], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.2, 0.8, -0.5], localDirection: [-1, 0.3, 0] },
        { quadrant: 'port', localOffset: [-1.2, 0.8, -1.0], localDirection: [-1, 0.3, 0] },
        // Starboard broadside (4)
        { quadrant: 'starboard', localOffset: [1.2, 0.8, 1.0], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.2, 0.8, 0.0], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.2, 0.8, -0.5], localDirection: [1, 0.3, 0] },
        { quadrant: 'starboard', localOffset: [1.2, 0.8, -1.0], localDirection: [1, 0.3, 0] },
        // Aft (1 small)
        { quadrant: 'aft', localOffset: [0, 0.8, -2.0], localDirection: [0, 0.3, -1] },
      ],
    },
  },
  skiff: {
    health: { armor: 30, armorMax: 30, armorRegenRate: 1, hull: 40, hullMax: 40 },
    movement: { thrustForce: 600, reverseForce: 200, turnTorque: 250, maxSpeed: 18 },
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
    movement: { thrustForce: 400, reverseForce: 150, turnTorque: 100, maxSpeed: 8 },
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
