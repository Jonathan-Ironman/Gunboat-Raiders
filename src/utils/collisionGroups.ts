/**
 * Rapier collision group indices (bit positions).
 * Use with react-three-rapier's interactionGroups(membership, filter) helper.
 *
 * Collision matrix:
 * - Player           <-> Enemy, EnemyProjectile, Environment
 * - Enemy            <-> Player, PlayerProjectile, Environment, Enemy
 * - PlayerProjectile <-> Enemy, Environment
 * - EnemyProjectile  <-> Player, Environment
 * - Environment      <-> Player, Enemy, PlayerProjectile, EnemyProjectile
 */
export const COLLISION_GROUPS = {
  PLAYER: 0,
  ENEMY: 1,
  PLAYER_PROJECTILE: 2,
  ENEMY_PROJECTILE: 3,
  ENVIRONMENT: 4,
} as const;

export type CollisionGroup = (typeof COLLISION_GROUPS)[keyof typeof COLLISION_GROUPS];
