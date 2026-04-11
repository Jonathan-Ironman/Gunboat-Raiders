import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { BOAT_STATS } from '../utils/boatStats';
import {
  loadPersisted,
  savePersisted,
  clearPersisted,
  type PersistedSave,
  type PersistedSettings,
  type PersistedState,
} from '../utils/persistence';
import { AudioManager } from '../audio/AudioManager';

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

/**
 * Top-level game phases.
 *
 * Slice R2 renamed the legacy `'title'` phase to `'mainMenu'` and added
 * `'briefing'` (level intro modal) and `'paused'` (pause menu). The full
 * loop is: `mainMenu → briefing → playing → wave-clear → playing → ... →
 * game-over` with `paused` as an orthogonal state reachable from
 * `playing`/`wave-clear`.
 */
export type GamePhase = 'mainMenu' | 'briefing' | 'playing' | 'wave-clear' | 'paused' | 'game-over';

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
  /**
   * Shared overheat value in [0, 1]. Accumulates when a shot actually
   * fires and decays when the weapon is idle. See
   * `src/utils/overheatConstants.ts` for tuning and
   * `WeaponSystem.ts` for the pure heat helpers.
   */
  heat: number;
  /**
   * Sticky lockout flag. `true` once `heat` hits 1.0, and stays `true`
   * until `heat` drops below `HEAT_LOCKOUT_RECOVERY_THRESHOLD`. Firing
   * is blocked while this flag is set.
   */
  heatLockout: boolean;
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

// ---- Settings / Save slices ----

/** Settings slice — exported from persistence types. */
export type SettingsSlice = PersistedSettings;

/** Save slice — exported from persistence types. May be `null`. */
export type SaveSlice = PersistedSave | null;

/** Default settings used when no persisted blob is present. */
const DEFAULT_SETTINGS: SettingsSlice = {
  sfxVolume: 1,
  musicVolume: 1,
};

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

  // R2 — UI meta-state
  /** Which level the briefing modal is currently configured for. */
  briefingLevelIndex: number;

  // R2 — persisted slices
  settings: SettingsSlice;
  save: SaveSlice;

  // Entity actions
  spawnPlayer: () => void;
  spawnEnemy: (type: EnemyType, position: [number, number, number]) => EntityId;
  removeEnemy: (id: EntityId) => void;
  spawnProjectile: (config: Omit<ProjectileEntity, 'id'>) => EntityId;
  removeProjectile: (id: EntityId) => void;
  applyDamage: (targetId: EntityId, damage: number) => void;

  // Gameplay state actions
  setActiveQuadrant: (quadrant: FiringQuadrant) => void;
  advanceWave: () => void;
  addScore: (points: number) => void;
  setPhase: (phase: GamePhase) => void;
  resetGame: () => void;
  /**
   * Atomically reset all game state and start a new game session.
   * Use this instead of resetGame() + spawnPlayer() to avoid an intermediate
   * phase='mainMenu' render that would unmount all game entities.
   */
  startGame: () => void;

  // R2 — phase flow actions
  /** Freeze the game. No-op outside `playing`/`wave-clear`. */
  pauseGame: () => void;
  /** Resume from `paused` back into `playing`. No-op in other phases. */
  resumeGame: () => void;
  /** Stash `levelIndex` and transition to the briefing modal. */
  openBriefing: (levelIndex: number) => void;
  /**
   * Atomic level start: reset game state, spawn the player, and enter
   * `playing`. Replaces the legacy `startGame()` when the caller knows
   * which level is being loaded.
   */
  startLevel: (levelIndex: number) => void;
  /**
   * Tear down the running session and return to the main menu. Clears
   * entities but deliberately does NOT clear the persistent save.
   */
  returnToMainMenu: () => void;

  // R2 — settings actions (persisted)
  /** Update SFX volume, persist it, and push the new value into Howler. */
  setSfxVolume: (v: number) => void;
  /** Update music volume and persist. Music playback not wired yet. */
  setMusicVolume: (v: number) => void;

  // R2 — save actions (persisted)
  /** Checkpoint at the given level index. Rolls best wave / score forward. */
  saveAtLevel: (levelIndex: number) => void;
  /** Remove the persistent save entirely. Settings remain intact. */
  clearSave: () => void;
}

// ---- Persistence hydration ----

/**
 * Loads the persisted blob once at module evaluation time and folds it
 * into the initial store state. Falls back to defaults on missing /
 * corrupt data. Keeps tests deterministic by calling into the utility
 * rather than reaching into localStorage directly.
 */
function hydrateFromStorage(): { settings: SettingsSlice; save: SaveSlice } {
  const persisted = loadPersisted();
  if (persisted === null) {
    return { settings: { ...DEFAULT_SETTINGS }, save: null };
  }
  return {
    settings: { ...persisted.settings },
    save: persisted.save === null ? null : { ...persisted.save },
  };
}

const HYDRATED = hydrateFromStorage();

// Push the hydrated SFX volume into Howler at boot so the first sound
// plays at the user's remembered setting. Wrapped because AudioManager
// is designed to swallow audio errors — we don't want module evaluation
// to fail if the audio context isn't available yet.
try {
  AudioManager.setMasterVolume(HYDRATED.settings.sfxVolume);
} catch (err) {
  console.warn('[gameStore] initial volume sync failed:', err);
}

// ---- Initial State ----

const INITIAL_STATE = {
  phase: 'mainMenu' as GamePhase,
  wave: 0,
  score: 0,
  enemiesRemaining: 0,
  enemiesSunkTotal: 0,
  player: null,
  enemies: new Map<EntityId, BoatEntity>(),
  projectiles: new Map<EntityId, ProjectileEntity>(),
  activeQuadrant: 'fore' as FiringQuadrant,
  cameraAngle: 0,
  briefingLevelIndex: 0,
};

/**
 * Builds a fresh player BoatEntity from the configured preset. Extracted
 * so both `spawnPlayer()` and `startLevel()` can share the logic without
 * duplication.
 */
function buildPlayerEntity(): BoatEntity {
  const preset = BOAT_STATS.player;
  return {
    id: 'player',
    type: 'player',
    health: { ...preset.health },
    movement: { ...preset.movement },
    weapons: {
      ...preset.weapons,
      mounts: [...preset.weapons.mounts],
      cooldownRemaining: makeDefaultCooldowns(),
      heat: 0,
      heatLockout: false,
    },
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    isSinking: false,
  };
}

/** Clamp a volume into the valid [0, 1] range. NaN is coerced to 0. */
function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// ---- Store ----

export const useGameStore = create<GameState>()((set, get) => {
  /**
   * Persists the current `settings` and `save` slices to localStorage.
   * Reads from `get()` so every caller writes a consistent snapshot even
   * when multiple slices change within a single action.
   */
  const persistNow = (): void => {
    const { settings, save } = get();
    const blob: PersistedState = {
      settings: { ...settings },
      save: save === null ? null : { ...save },
    };
    savePersisted(blob);
  };

  return {
    ...INITIAL_STATE,
    settings: HYDRATED.settings,
    save: HYDRATED.save,

    // ----- Entity actions -----

    spawnPlayer: () => {
      set({ player: buildPlayerEntity(), phase: 'playing' });
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
          heat: 0,
          heatLockout: false,
        },
        ai: {
          type,
          state: 'spawning',
          targetId: 'player',
          stateTimer: 0,
          preferredRange: type === 'skiff' ? 15 : 25,
          // detectionRange must exceed the spawn ring (80-120) so enemies
          // pursue from the moment they spawn. Once in the approaching state
          // pursuit is unconditional (see AISystem.ts).
          detectionRange: 200,
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

    // ----- Gameplay state actions -----

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

    startGame: () => {
      // Single atomic set: reset everything and start playing simultaneously.
      // This prevents the intermediate phase='mainMenu' state that would
      // unmount game entities and break physics body registration.
      set({
        ...INITIAL_STATE,
        phase: 'playing',
        wave: 1,
        player: buildPlayerEntity(),
        enemies: new Map(),
        projectiles: new Map(),
      });
    },

    // ----- R2 — phase flow -----

    pauseGame: () => {
      const { phase } = get();
      if (phase !== 'playing' && phase !== 'wave-clear') return;
      set({ phase: 'paused' });
    },

    resumeGame: () => {
      const { phase } = get();
      if (phase !== 'paused') return;
      set({ phase: 'playing' });
    },

    openBriefing: (levelIndex) => {
      set({ phase: 'briefing', briefingLevelIndex: levelIndex });
    },

    startLevel: (levelIndex) => {
      // Atomic transition: wipe transient state and spawn the player in
      // a single `set()` call so game entities mount exactly once.
      set({
        ...INITIAL_STATE,
        phase: 'playing',
        wave: 1,
        player: buildPlayerEntity(),
        enemies: new Map(),
        projectiles: new Map(),
        briefingLevelIndex: levelIndex,
      });
      // R18 — SaveSystem: checkpoint at the level the player just
      // entered. Putting the call here means Continue is enabled the
      // instant play begins, a reload or exit-to-main-menu always lands
      // the player back at the same level, and a replay (PLAY AGAIN →
      // same level) idempotently refreshes the save. `saveAtLevel`
      // uses `Math.max` on best-wave / best-score, so rewriting with
      // the freshly reset wave=1/score=0 never regresses records.
      get().saveAtLevel(levelIndex);
    },

    returnToMainMenu: () => {
      // Teardown: clear player / enemies / projectiles, reset counters,
      // return to the main menu. Do NOT touch `settings` or `save` —
      // those must survive across sessions.
      const { settings, save } = get();
      set({
        ...INITIAL_STATE,
        phase: 'mainMenu',
        enemies: new Map(),
        projectiles: new Map(),
        settings,
        save,
      });
    },

    // ----- R2 — settings -----

    setSfxVolume: (v) => {
      const clamped = clampVolume(v);
      const { settings } = get();
      const nextSettings: SettingsSlice = { ...settings, sfxVolume: clamped };
      set({ settings: nextSettings });
      persistNow();
      try {
        AudioManager.setMasterVolume(clamped);
      } catch (err) {
        console.warn('[gameStore] setSfxVolume Howler sync failed:', err);
      }
    },

    setMusicVolume: (v) => {
      const clamped = clampVolume(v);
      const { settings } = get();
      const nextSettings: SettingsSlice = { ...settings, musicVolume: clamped };
      set({ settings: nextSettings });
      persistNow();
      // Music playback not wired yet — reserved slot.
    },

    // ----- R2 — save -----

    saveAtLevel: (levelIndex) => {
      const { save, wave, score } = get();
      const nextSave: PersistedSave = {
        currentLevelIndex: levelIndex,
        bestWave: Math.max(save?.bestWave ?? 0, wave),
        bestScore: Math.max(save?.bestScore ?? 0, score),
      };
      set({ save: nextSave });
      persistNow();
    },

    clearSave: () => {
      set({ save: null });
      // Persist the resulting blob (settings-only, save=null) so a
      // subsequent load still honors settings but starts fresh.
      persistNow();
      // Also wipe the raw key for tests / tooling that inspect storage
      // directly. This is defensive — `persistNow()` above already
      // writes a consistent blob.
      clearPersisted();
      // Re-persist so settings survive the clear (clearPersisted()
      // removed the key; persistNow() writes it back with save=null).
      persistNow();
    },
  };
});

// Expose store on window for debugging in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__GAME_STORE__ = useGameStore;
}
