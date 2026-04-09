import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { BOAT_STATS } from '../utils/boatStats';

// ---- Entity Types ----

export type EntityId = string;

export type EntityType = 'player' | 'enemy' | 'projectile' | 'rock';

export type FiringQuadrant = 'fore' | 'aft' | 'port' | 'starboard';

export type EnemyType = 'skiff' | 'barge';

export type AIState =
  | 'spawning'
  | 'approaching'
  | 'positioning'
  | 'broadside'
  | 'fleeing'
  | 'sinking';

export type GamePhase = 'title' | 'playing' | 'wave-clear' | 'game-over';

// ---- Component Data ----

export interface HealthComponent {
  armor: number;
  armorMax: number;
  armorRegenRate: number; // points per second
  hull: number;
  hullMax: number;
}

export interface WeaponMount {
  quadrant: FiringQuadrant;
  localOffset: [number, number, number];
  localDirection: [number, number, number];
}

export interface WeaponComponent {
  mounts: readonly WeaponMount[];
  cooldown: number; // seconds between shots per quadrant
  cooldownRemaining: Record<FiringQuadrant, number>;
  damage: number;
  splashDamage: number;
  splashRadius: number;
  muzzleVelocity: number;
  elevationAngle: number; // radians
}

export interface MovementComponent {
  thrustForce: number;
  reverseForce: number;
  turnTorque: number;
  maxSpeed: number;
}

export interface AIComponent {
  type: EnemyType;
  state: AIState;
  targetId: EntityId | null;
  stateTimer: number;
  preferredRange: number;
  detectionRange: number;
}

export interface BoatEntity {
  id: EntityId;
  type: 'player' | 'enemy';
  enemyType?: EnemyType;
  health: HealthComponent;
  weapons: WeaponComponent;
  movement: MovementComponent;
  ai?: AIComponent;
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion xyzw
  isSinking: boolean;
}

export interface ProjectileEntity {
  id: EntityId;
  ownerId: EntityId;
  ownerType: 'player' | 'enemy';
  damage: number;
  splashDamage: number;
  splashRadius: number;
  spawnTime: number;
  maxLifetime: number; // seconds
}

export interface WaveConfig {
  waveNumber: number;
  enemies: Array<{
    type: EnemyType;
    count: number;
    spawnDelay: number; // seconds after wave start
  }>;
}

// ---- Initial default cooldowns ----

function makeDefaultCooldowns(): Record<FiringQuadrant, number> {
  return { fore: 0, aft: 0, port: 0, starboard: 0 };
}

// ---- Store Shape ----

export interface GameState {
  phase: GamePhase;
  wave: number;
  score: number;
  enemiesRemaining: number;
  enemiesSunkTotal: number;

  player: BoatEntity | null;
  enemies: Map<EntityId, BoatEntity>;
  projectiles: Map<EntityId, ProjectileEntity>;

  activeQuadrant: FiringQuadrant;
  cameraAngle: number; // radians, relative to world

  // Actions
  spawnPlayer: () => void;
  spawnEnemy: (type: EnemyType, position: [number, number, number]) => EntityId;
  removeEnemy: (id: EntityId) => void;
  spawnProjectile: (config: Omit<ProjectileEntity, 'id'>) => EntityId;
  removeProjectile: (id: EntityId) => void;
  applyDamage: (targetId: EntityId, damage: number) => void;
  setActiveQuadrant: (quadrant: FiringQuadrant) => void;
  advanceWave: () => void;
  addScore: (points: number) => void;
  setPhase: (phase: GamePhase) => void;
  resetGame: () => void;
}

// ---- Initial State ----

const INITIAL_STATE = {
  phase: 'title' as GamePhase,
  wave: 0,
  score: 0,
  enemiesRemaining: 0,
  enemiesSunkTotal: 0,
  player: null,
  enemies: new Map<EntityId, BoatEntity>(),
  projectiles: new Map<EntityId, ProjectileEntity>(),
  activeQuadrant: 'fore' as FiringQuadrant,
  cameraAngle: 0,
};

// ---- Store ----

export const useGameStore = create<GameState>()((set, get) => ({
  ...INITIAL_STATE,

  spawnPlayer: () => {
    const preset = BOAT_STATS.player;
    const player: BoatEntity = {
      id: 'player',
      type: 'player',
      health: { ...preset.health },
      movement: { ...preset.movement },
      weapons: {
        ...preset.weapons,
        mounts: [...preset.weapons.mounts],
        cooldownRemaining: makeDefaultCooldowns(),
      },
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      isSinking: false,
    };
    set({ player, phase: 'playing' });
  },

  spawnEnemy: (type, position) => {
    const id = nanoid();
    const preset = BOAT_STATS[type];
    const enemy: BoatEntity = {
      id,
      type: 'enemy',
      enemyType: type,
      health: { ...preset.health },
      movement: { ...preset.movement },
      weapons: {
        ...preset.weapons,
        mounts: [...preset.weapons.mounts],
        cooldownRemaining: makeDefaultCooldowns(),
      },
      ai: {
        type,
        state: 'spawning',
        targetId: 'player',
        stateTimer: 0,
        preferredRange: type === 'skiff' ? 15 : 25,
        detectionRange: type === 'skiff' ? 80 : 60,
      },
      position,
      rotation: [0, 0, 0, 1],
      isSinking: false,
    };
    const enemies = new Map(get().enemies);
    enemies.set(id, enemy);
    set({ enemies, enemiesRemaining: get().enemiesRemaining + 1 });
    return id;
  },

  removeEnemy: (id) => {
    const enemies = new Map(get().enemies);
    if (enemies.has(id)) {
      enemies.delete(id);
      set({ enemies });
    }
  },

  spawnProjectile: (config) => {
    const id = nanoid();
    const projectiles = new Map(get().projectiles);
    projectiles.set(id, { ...config, id });
    set({ projectiles });
    return id;
  },

  removeProjectile: (id) => {
    const projectiles = new Map(get().projectiles);
    projectiles.delete(id);
    set({ projectiles });
  },

  applyDamage: (targetId, damage) => {
    const { player, enemies } = get();

    if (targetId === 'player' && player) {
      const health = { ...player.health };
      const armorAbsorb = Math.min(health.armor, damage);
      const overflow = damage - armorAbsorb;
      const hullDamage = Math.min(health.hull, overflow);
      health.armor -= armorAbsorb;
      health.hull -= hullDamage;
      const isSinking = health.hull <= 0;
      set({ player: { ...player, health, isSinking } });
      if (isSinking) get().setPhase('game-over');
      return;
    }

    const enemy = enemies.get(targetId);
    if (enemy) {
      const health = { ...enemy.health };
      const armorAbsorb = Math.min(health.armor, damage);
      const overflow = damage - armorAbsorb;
      const hullDamage = Math.min(health.hull, overflow);
      health.armor -= armorAbsorb;
      health.hull -= hullDamage;
      const isSinking = health.hull <= 0;
      const updatedEnemy = { ...enemy, health, isSinking };
      const updatedEnemies = new Map(enemies);
      updatedEnemies.set(targetId, updatedEnemy);

      if (isSinking && !enemy.isSinking) {
        // Enemy just sunk: decrement remaining, increment total
        set({
          enemies: updatedEnemies,
          enemiesRemaining: Math.max(0, get().enemiesRemaining - 1),
          enemiesSunkTotal: get().enemiesSunkTotal + 1,
        });
      } else {
        set({ enemies: updatedEnemies });
      }
    }
  },

  setActiveQuadrant: (quadrant) => {
    set({ activeQuadrant: quadrant });
  },

  advanceWave: () => {
    set((state) => ({ wave: state.wave + 1, enemiesRemaining: 0 }));
  },

  addScore: (points) => {
    set((state) => ({ score: state.score + points }));
  },

  setPhase: (phase) => {
    set({ phase });
  },

  resetGame: () => {
    set({
      ...INITIAL_STATE,
      enemies: new Map(),
      projectiles: new Map(),
    });
  },
}));
