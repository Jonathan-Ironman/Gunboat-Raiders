import { describe, it, expect } from 'vitest';
import { getExpiredProjectiles, type ProjectileLifetimeData } from '@/systems/ProjectileSystem';

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
