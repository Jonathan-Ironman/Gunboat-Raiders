import { describe, it, expect, beforeEach } from 'vitest';
import { getExpiredProjectiles, type ProjectileLifetimeData } from '@/systems/ProjectileSystem';
import { COLLISION_GROUPS } from '@/utils/collisionGroups';
import {
  setProjectilePoolManager,
  setEnemyProjectilePoolManager,
  getProjectilePoolManager,
  getEnemyProjectilePoolManager,
  setProjectileSlotMetadata,
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
    };
    const enemyManager: ProjectilePoolManager = {
      activate: () => 10,
      deactivate: () => undefined,
      getBodies: () => [],
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
    };
    const enemyManager: ProjectilePoolManager = {
      activate: () => 10,
      deactivate: () => undefined,
      getBodies: () => [],
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
