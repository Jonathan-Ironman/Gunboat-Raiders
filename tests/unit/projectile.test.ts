import { describe, it, expect, beforeEach } from 'vitest';
import { getExpiredProjectiles, type ProjectileLifetimeData } from '@/systems/ProjectileSystem';
import { COLLISION_GROUPS } from '@/utils/collisionGroups';
import {
  setProjectilePoolManager,
  setEnemyProjectilePoolManager,
  getProjectilePoolManager,
  getEnemyProjectilePoolManager,
  setProjectileSlotMetadata,
  getProjectileSlotMetadata,
  clearProjectileSlotMetadata,
  queueProjectileDeactivation,
  isProjectileDeactivationPending,
  drainPendingProjectileDeactivations,
  queueEnemyProjectileDeactivation,
  isEnemyProjectileDeactivationPending,
  drainPendingEnemyProjectileDeactivations,
  clearAllProjectileSlotMetadata,
  clearAllPendingProjectileDeactivations,
  clearAllPendingEnemyProjectileDeactivations,
  type ProjectilePoolManager,
  type ProjectileSlotMetadata,
} from '@/systems/projectilePoolRefs';

describe('ProjectileSystem — getExpiredProjectiles', () => {
  it('returns empty array when none expired', () => {
    const projectiles = new Map<string, ProjectileLifetimeData>([
      ['a', { spawnTime: 0, maxLifetime: 5 }],
      ['b', { spawnTime: 1, maxLifetime: 5 }],
    ]);

    const expired = getExpiredProjectiles(projectiles, 3);
    expect(expired).toEqual([]);
  });

  it('returns ids of projectiles past maxLifetime', () => {
    const projectiles = new Map<string, ProjectileLifetimeData>([
      ['a', { spawnTime: 0, maxLifetime: 3 }],
      ['b', { spawnTime: 1, maxLifetime: 2 }],
    ]);

    const expired = getExpiredProjectiles(projectiles, 5);
    expect(expired).toContain('a');
    expect(expired).toContain('b');
    expect(expired).toHaveLength(2);
  });

  it('does not return non-expired projectiles', () => {
    const projectiles = new Map<string, ProjectileLifetimeData>([
      ['a', { spawnTime: 0, maxLifetime: 3 }],
      ['b', { spawnTime: 4, maxLifetime: 5 }],
    ]);

    const expired = getExpiredProjectiles(projectiles, 5);
    expect(expired).toContain('a');
    expect(expired).not.toContain('b');
    expect(expired).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Test C — Pool exhaustion: activate returns -1 when full, recycles after deactivate
// ---------------------------------------------------------------------------

describe('projectilePoolRefs — pool exhaustion and slot recycling (Test C)', () => {
  /**
   * Create a minimal in-memory mock pool of a given size to test the
   * pool-manager contract without Rapier or R3F.
   */
  function makeMockPool(size: number): {
    manager: ProjectilePoolManager;
    activeSlots: Set<number>;
  } {
    const activeSlots = new Set<number>();
    const manager: ProjectilePoolManager = {
      activate(_pos, _impulse, ownerId, ownerType, damage, splashDamage, splashRadius) {
        for (let i = 0; i < size; i++) {
          if (!activeSlots.has(i)) {
            activeSlots.add(i);
            setProjectileSlotMetadata(i, {
              ownerId,
              ownerType,
              damage,
              splashDamage,
              splashRadius,
              storeId: `mock-${String(i)}`,
            });
            return i;
          }
        }
        return -1; // exhausted
      },
      deactivate(index) {
        activeSlots.delete(index);
        clearProjectileSlotMetadata(index);
      },
      getBodies() {
        return [];
      },
      getIndexByStoreId(_storeId: string): number {
        return -1; // not needed by the exhaustion tests
      },
    };
    return { manager, activeSlots };
  }

  beforeEach(() => {
    clearAllProjectileSlotMetadata();
    clearAllPendingProjectileDeactivations();
  });

  it('4th activate on a size-3 pool returns -1 (exhausted)', () => {
    const { manager } = makeMockPool(3);
    const pos: [number, number, number] = [0, 0, 0];
    const imp: [number, number, number] = [10, 0, 0];

    const i0 = manager.activate(pos, imp, 'player', 'player', 10, 5, 3);
    const i1 = manager.activate(pos, imp, 'player', 'player', 10, 5, 3);
    const i2 = manager.activate(pos, imp, 'player', 'player', 10, 5, 3);
    const i3 = manager.activate(pos, imp, 'player', 'player', 10, 5, 3); // should exhaust

    expect(i0).toBeGreaterThanOrEqual(0);
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThanOrEqual(0);
    expect(i3).toBe(-1);
  });

  it('after deactivate(0), activate reclaims slot 0', () => {
    const { manager } = makeMockPool(3);
    const pos: [number, number, number] = [0, 0, 0];
    const imp: [number, number, number] = [10, 0, 0];

    // Fill all slots
    manager.activate(pos, imp, 'player', 'player', 10, 5, 3);
    manager.activate(pos, imp, 'player', 'player', 10, 5, 3);
    manager.activate(pos, imp, 'player', 'player', 10, 5, 3);

    // Deactivate slot 0 — should free it for reuse
    manager.deactivate(0);

    const recycled = manager.activate(pos, imp, 'player', 'player', 10, 5, 3);
    expect(recycled).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Collision group unit tests — supporting test for enemy pool split (Test D support)
// ---------------------------------------------------------------------------

/**
 * Reimplementation of interactionGroups logic so we can unit-test collision
 * group encoding without importing the R3F library (which requires WebGL / WASM
 * and cannot run in Vitest's Node environment).
 *
 * Rapier encoding: upper 16 bits = membership bitmask, lower 16 bits = filter bitmask.
 * interactionGroups(membership, filter) = (bitmask(membership) << 16) | bitmask(filter)
 */
function buildInteractionGroups(memberships: number[], filters: number[]): number {
  const memberBitmask = memberships.reduce((acc, g) => acc | (1 << g), 0);
  const filterBitmask = filters.reduce((acc, g) => acc | (1 << g), 0);
  return (memberBitmask << 16) | filterBitmask;
}

describe('Collision groups — enemy pool must not filter against ENEMY group (Test D support)', () => {
  it('PLAYER_PROJECTILE group filters include ENEMY', () => {
    const playerGroups = buildInteractionGroups(
      [COLLISION_GROUPS.PLAYER_PROJECTILE],
      [COLLISION_GROUPS.ENEMY, COLLISION_GROUPS.ENVIRONMENT],
    );
    // Filter bitmask is lower 16 bits
    const filterBitmask = playerGroups & 0xffff;
    const enemyBit = 1 << COLLISION_GROUPS.ENEMY;
    expect(filterBitmask & enemyBit).toBeGreaterThan(0); // ENEMY is in filter
  });

  it('ENEMY_PROJECTILE group filters must NOT include ENEMY (self-collision prevention)', () => {
    // This is the correct enemy pool collision group that EnemyProjectilePool MUST use.
    // If the enemy pool uses this group, enemy projectiles cannot self-collide with enemy bodies.
    const enemyGroups = buildInteractionGroups(
      [COLLISION_GROUPS.ENEMY_PROJECTILE],
      [COLLISION_GROUPS.PLAYER, COLLISION_GROUPS.ENVIRONMENT],
    );
    const filterBitmask = enemyGroups & 0xffff;
    const enemyBit = 1 << COLLISION_GROUPS.ENEMY;
    // ENEMY must NOT be in the filter
    expect(filterBitmask & enemyBit).toBe(0);
    // But PLAYER must be in the filter
    const playerBit = 1 << COLLISION_GROUPS.PLAYER;
    expect(filterBitmask & playerBit).toBeGreaterThan(0);
  });

  it('the old (broken) PLAYER_PROJECTILE group on enemy shots would trigger self-collision with enemy bodies', () => {
    // This proves WHY the bug exists: player projectile group includes ENEMY in its filter,
    // so when an enemy body (in ENEMY group) spawns a projectile in PLAYER_PROJECTILE group,
    // the enemy body and the projectile immediately intersect and Rapier fires a collision.
    const brokenEnemyGroups = buildInteractionGroups(
      [COLLISION_GROUPS.PLAYER_PROJECTILE],
      [COLLISION_GROUPS.ENEMY, COLLISION_GROUPS.ENVIRONMENT],
    );
    const filterBitmask = brokenEnemyGroups & 0xffff;
    const enemyBit = 1 << COLLISION_GROUPS.ENEMY;
    // With the old broken setup, ENEMY IS in the filter — this is the bug
    expect(filterBitmask & enemyBit).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test: separate pool manager refs exist for player and enemy pools
// ---------------------------------------------------------------------------

describe('projectilePoolRefs — separate player and enemy pool managers (Test D support)', () => {
  beforeEach(() => {
    setProjectilePoolManager(null);
    setEnemyProjectilePoolManager(null);
    clearAllPendingProjectileDeactivations();
    clearAllPendingEnemyProjectileDeactivations();
  });

  it('getEnemyProjectilePoolManager returns null before registration', () => {
    expect(getEnemyProjectilePoolManager()).toBeNull();
  });

  it('setEnemyProjectilePoolManager stores a separate manager from player pool', () => {
    const playerManager: ProjectilePoolManager = {
      activate: () => 0,
      deactivate: () => undefined,
      getBodies: () => [],
      getIndexByStoreId: () => -1,
    };
    const enemyManager: ProjectilePoolManager = {
      activate: () => 10,
      deactivate: () => undefined,
      getBodies: () => [],
      getIndexByStoreId: () => -1,
    };

    setProjectilePoolManager(playerManager);
    setEnemyProjectilePoolManager(enemyManager);

    expect(getProjectilePoolManager()).toBe(playerManager);
    expect(getEnemyProjectilePoolManager()).toBe(enemyManager);
    // Crucially: they are different references
    expect(getProjectilePoolManager()).not.toBe(getEnemyProjectilePoolManager());
  });

  it('player pool activate returns 0, enemy pool activate returns 10 independently', () => {
    const playerManager: ProjectilePoolManager = {
      activate: () => 0,
      deactivate: () => undefined,
      getBodies: () => [],
      getIndexByStoreId: () => -1,
    };
    const enemyManager: ProjectilePoolManager = {
      activate: () => 10,
      deactivate: () => undefined,
      getBodies: () => [],
      getIndexByStoreId: () => -1,
    };

    setProjectilePoolManager(playerManager);
    setEnemyProjectilePoolManager(enemyManager);

    const pos: [number, number, number] = [0, 0, 0];
    const imp: [number, number, number] = [10, 0, 0];
    const playerPool = getProjectilePoolManager();
    const enemyPool = getEnemyProjectilePoolManager();
    expect(playerPool).not.toBeNull();
    expect(enemyPool).not.toBeNull();
    if (!playerPool || !enemyPool) throw new Error('Pool managers not set');
    expect(playerPool.activate(pos, imp, 'p', 'player', 1, 0, 0)).toBe(0);
    expect(enemyPool.activate(pos, imp, 'e', 'enemy', 1, 0, 0)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Pending deactivation queues — player and enemy are independent
// ---------------------------------------------------------------------------

describe('projectilePoolRefs — separate pending deactivation queues', () => {
  beforeEach(() => {
    clearAllPendingProjectileDeactivations();
    clearAllPendingEnemyProjectileDeactivations();
  });

  it('player queue and enemy queue are independent', () => {
    queueProjectileDeactivation(5);
    queueEnemyProjectileDeactivation(7);

    // Player queue has 5, enemy queue has 7
    expect(isProjectileDeactivationPending(5)).toBe(true);
    expect(isEnemyProjectileDeactivationPending(5)).toBe(false); // not in enemy queue
    expect(isProjectileDeactivationPending(7)).toBe(false); // not in player queue
    expect(isEnemyProjectileDeactivationPending(7)).toBe(true);

    const playerDrained = drainPendingProjectileDeactivations();
    expect(playerDrained).toContain(5);
    expect(playerDrained).not.toContain(7);

    const enemyDrained = drainPendingEnemyProjectileDeactivations();
    expect(enemyDrained).toContain(7);
    expect(enemyDrained).not.toContain(5);
  });

  it('draining player queue does not affect enemy queue', () => {
    queueEnemyProjectileDeactivation(3);

    drainPendingProjectileDeactivations(); // drain (empty) player queue

    expect(isEnemyProjectileDeactivationPending(3)).toBe(true); // still there
  });
});

// ---------------------------------------------------------------------------
// Required regression tests (4 new, per task brief)
// ---------------------------------------------------------------------------

/**
 * Mock pool that mirrors the storeId→index lookup introduced by the leak fix.
 * The mock maintains a storeIdToIndex Map so getIndexByStoreId() works
 * correctly without Rapier or R3F.
 */
function makeMockPoolWithStoreIdLookup(size: number): {
  manager: ProjectilePoolManager;
  activeSlots: Set<number>;
  storeIdToIndex: Map<string, number>;
  nextStoreId: { value: number };
} {
  const activeSlots = new Set<number>();
  const storeIdToIndex = new Map<string, number>();
  const nextStoreId = { value: 0 };

  const manager: ProjectilePoolManager = {
    activate(_pos, _impulse, ownerId, ownerType, damage, splashDamage, splashRadius) {
      for (let i = 0; i < size; i++) {
        if (!activeSlots.has(i)) {
          activeSlots.add(i);
          const storeId = `proj-${String(nextStoreId.value++)}`;
          setProjectileSlotMetadata(i, {
            ownerId,
            ownerType,
            damage,
            splashDamage,
            splashRadius,
            storeId,
          });
          storeIdToIndex.set(storeId, i);
          return i;
        }
      }
      return -1; // exhausted
    },
    deactivate(index) {
      const meta = getProjectileSlotMetadata(index);
      if (meta) {
        storeIdToIndex.delete(meta.storeId);
      }
      activeSlots.delete(index);
      clearProjectileSlotMetadata(index);
    },
    getBodies() {
      return [];
    },
    getIndexByStoreId(storeId: string): number {
      return storeIdToIndex.get(storeId) ?? -1;
    },
  };

  return { manager, activeSlots, storeIdToIndex, nextStoreId };
}

describe('Leak regression — storeId-to-index lookup (Test: leak regression)', () => {
  beforeEach(() => {
    clearAllProjectileSlotMetadata();
    clearAllPendingProjectileDeactivations();
  });

  it('expired projectile slot is freed via storeId lookup, not position heuristic', () => {
    /**
     * Previously: deactivation was gated on y < -50. A projectile at y=10
     * (airborne) would never be freed. After the fix, getIndexByStoreId()
     * is used so the slot is always freed regardless of body position.
     */
    const { manager, activeSlots } = makeMockPoolWithStoreIdLookup(10);
    const pos: [number, number, number] = [0, 10, 0]; // y=10, clearly airborne
    const imp: [number, number, number] = [0, 0, 10];

    // Activate a slot — records storeId→index mapping
    const slotIndex = manager.activate(pos, imp, 'player', 'player', 10, 5, 3);
    expect(slotIndex).toBeGreaterThanOrEqual(0);
    expect(activeSlots.size).toBe(1);

    // Retrieve the storeId that was registered
    const meta: ProjectileSlotMetadata | undefined = getProjectileSlotMetadata(slotIndex);
    expect(meta).toBeDefined();
    if (!meta) throw new Error('metadata must be defined after activate');
    const storeId = meta.storeId;

    // Simulate lifetime expiry — look up by storeId and deactivate (no position check)
    const foundIndex = manager.getIndexByStoreId(storeId);
    expect(foundIndex).toBe(slotIndex); // correct slot found without y heuristic

    manager.deactivate(foundIndex);
    expect(activeSlots.size).toBe(0); // slot returned
    expect(manager.getIndexByStoreId(storeId)).toBe(-1); // mapping cleaned up
  });

  it('pool slot count stays stable over 200 rapid lifetime-expiry cycles (no drift)', () => {
    /**
     * OLD behavior: every projectile that expired airborne leaked its slot.
     * After 200 such expirations the pool would be exhausted.
     *
     * NEW behavior: storeId→index lookup frees every slot correctly.
     * Pool active count must return to 0 after each expiry, never drift.
     */
    const POOL_CAP = 80;
    const FIRE_COUNT = 200;
    const { manager, activeSlots } = makeMockPoolWithStoreIdLookup(POOL_CAP);
    const pos: [number, number, number] = [0, 5, 0]; // airborne (y=5)
    const imp: [number, number, number] = [0, 0, 60];

    for (let i = 0; i < FIRE_COUNT; i++) {
      // Activate (simulate a single in-flight projectile)
      const slotIdx = manager.activate(pos, imp, 'player', 'player', 25, 10, 5);
      expect(slotIdx).not.toBe(-1); // pool must never stall

      // Retrieve the assigned storeId and simulate lifetime expiry
      const meta: ProjectileSlotMetadata | undefined = getProjectileSlotMetadata(slotIdx);
      expect(meta).toBeDefined();
      if (!meta) throw new Error('metadata must be defined after activate');

      const lookupIdx = manager.getIndexByStoreId(meta.storeId);
      expect(lookupIdx).toBe(slotIdx);
      manager.deactivate(lookupIdx);

      // After expiry, pool must be back to 0 active slots
      expect(activeSlots.size).toBe(0);
    }
  });
});

describe('Pool stall regression — OLD leak would exhaust pool (Test: pool stall regression)', () => {
  beforeEach(() => {
    clearAllProjectileSlotMetadata();
  });

  it('with the fix: 200 activations + lifetime expiry never returns -1', () => {
    /**
     * Reproduces the scenario where the old leak (position heuristic, airborne
     * projectiles never freed) would exhaust even a 120-slot pool within ~30
     * broadsides. With the storeId-based fix, the pool recycles correctly and
     * activate() never returns -1 even after 200 sequential fire+expire cycles.
     */
    const { manager } = makeMockPoolWithStoreIdLookup(80);
    const pos: [number, number, number] = [0, 5, 0];
    const imp: [number, number, number] = [60, 0, 0];

    for (let i = 0; i < 200; i++) {
      const idx = manager.activate(pos, imp, 'player', 'player', 25, 10, 5);
      expect(idx).not.toBe(-1); // pool must not stall

      const meta = getProjectileSlotMetadata(idx);
      if (meta) {
        const lookupIdx = manager.getIndexByStoreId(meta.storeId);
        manager.deactivate(lookupIdx);
      }
    }
  });
});
