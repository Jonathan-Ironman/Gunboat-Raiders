/**
 * Integration / scenario tests — verify full game systems work together
 * headlessly (no renderer, no physics engine).
 *
 * These tests exercise the store + pure system functions in combination,
 * simulating realistic game scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { computeMovement } from '@/systems/MovementSystem';
import { computeBuoyancy, HULL_SAMPLE_POINTS } from '@/systems/BuoyancySystem';
import type { BuoyancyConfig } from '@/systems/BuoyancySystem';
import { calculateDamage } from '@/systems/DamageSystem';
import { generateWaveConfig } from '@/systems/WaveSystem';
import { computeAIDecision } from '@/systems/AISystem';
import type { AIContext } from '@/systems/AISystem';
import { computeQuadrant } from '@/systems/CameraSystem';
import { BOAT_STATS } from '@/utils/boatStats';
import {
  BUOYANCY_STRENGTH,
  BOAT_MASS,
  GRAVITY,
  BUOYANCY_VERTICAL_DAMPING,
  BUOYANCY_ANGULAR_DAMPING,
  BUOYANCY_MAX_SUBMERSION,
  BUOYANCY_TORQUE_SCALE,
} from '@/utils/constants';

// ---- Shared fixtures ----

const DEFAULT_BUOYANCY_CONFIG: BuoyancyConfig = {
  buoyancyStrength: BUOYANCY_STRENGTH,
  boatMass: BOAT_MASS,
  gravity: GRAVITY,
  verticalDamping: BUOYANCY_VERTICAL_DAMPING,
  angularDamping: BUOYANCY_ANGULAR_DAMPING,
  maxSubmersion: BUOYANCY_MAX_SUBMERSION,
  torqueScale: BUOYANCY_TORQUE_SCALE,
};

const IDENTITY_QUAT: [number, number, number, number] = [0, 0, 0, 1];
const ZERO_VEL: [number, number, number] = [0, 0, 0];

function flatWater(
  _x: number,
  _z: number,
  _t: number,
): { height: number; normal: [number, number, number] } {
  return { height: 0, normal: [0, 1, 0] };
}

function makeAIContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    selfPosition: [0, 0, 0],
    selfHeading: 0,
    selfHealth: { armor: 30, hull: 40, hullMax: 40 },
    targetPosition: [50, 0, 0],
    distanceToTarget: 50,
    preferredRange: 15,
    detectionRange: 80,
    currentState: 'approaching',
    stateTimer: 0,
    weaponCooldownReady: true,
    ...overrides,
  };
}

beforeEach(() => {
  useGameStore.getState().resetGame();
});

// ---- Scenario 1: Forward movement ----

describe('Scenario: forward movement', () => {
  it('computeMovement with forward=true at heading=0 produces positive Z force', () => {
    const stats = BOAT_STATS.player.movement;
    const result = computeMovement(
      { forward: true, backward: false, left: false, right: false, boatHeading: 0 },
      stats,
    );

    // Heading=0: local +Z maps to world +Z
    expect(result.force[2]).toBeCloseTo(stats.thrustForce, 3);
    expect(result.force[0]).toBeCloseTo(0, 3);
    expect(result.force[1]).toBeCloseTo(0, 3);
  });

  it('simulated position advances forward over multiple steps', () => {
    const stats = BOAT_STATS.player.movement;
    const dt = 1 / 60; // 60 Hz physics

    // Simple Euler integration: v += F/m * dt, pos += v * dt
    // (ignoring damping for simplicity — we just verify direction)
    let vz = 0;
    let pz = 0;

    for (let i = 0; i < 60; i++) {
      const result = computeMovement(
        { forward: true, backward: false, left: false, right: false, boatHeading: 0 },
        stats,
      );
      vz += (result.force[2] / BOAT_MASS) * dt;
      pz += vz * dt;
    }

    // After 1 second of thrust, position should be clearly positive
    expect(pz).toBeGreaterThan(0);
  });
});

// ---- Scenario 2: Turn changes heading ----

describe('Scenario: turn changes heading', () => {
  it('computeMovement with left=true produces positive Y torque', () => {
    const stats = BOAT_STATS.player.movement;
    const result = computeMovement(
      { forward: false, backward: false, left: true, right: false, boatHeading: 0 },
      stats,
    );

    // Left (A key) = positive Y torque = turn port
    expect(result.torque[1]).toBeCloseTo(stats.turnTorque, 3);
    expect(result.torque[0]).toBeCloseTo(0, 3);
    expect(result.torque[2]).toBeCloseTo(0, 3);
  });

  it('positive Y torque applied over time increases heading angle', () => {
    // Simple heading integration: heading += (torque / inertia) * dt
    // We just verify the direction is positive
    const stats = BOAT_STATS.player.movement;
    const dt = 1 / 60;
    const inertia = BOAT_MASS; // approximate rotational inertia

    let heading = 0;
    let angularV = 0;

    for (let i = 0; i < 60; i++) {
      const result = computeMovement(
        { forward: false, backward: false, left: true, right: false, boatHeading: heading },
        stats,
      );
      angularV += (result.torque[1] / inertia) * dt;
      heading += angularV * dt;
    }

    expect(heading).toBeGreaterThan(0);
  });
});

// ---- Scenario 3: Buoyancy keeps boat near water ----

describe('Scenario: buoyancy behavior', () => {
  it('boat below water surface experiences net upward force', () => {
    // Position boat at y=-1 (all hull points submerged)
    const result = computeBuoyancy(
      {
        bodyPosition: [0, -1, 0],
        bodyRotation: IDENTITY_QUAT,
        bodyLinearVelocity: ZERO_VEL,
        bodyAngularVelocity: ZERO_VEL,
        hullSamplePoints: HULL_SAMPLE_POINTS,
      },
      flatWater,
      0,
      DEFAULT_BUOYANCY_CONFIG,
    );

    expect(result.force[1]).toBeGreaterThan(0);
  });

  it('boat high above water experiences net downward force (gravity only)', () => {
    // Position boat at y=10 (all hull points above water)
    const result = computeBuoyancy(
      {
        bodyPosition: [0, 10, 0],
        bodyRotation: IDENTITY_QUAT,
        bodyLinearVelocity: ZERO_VEL,
        bodyAngularVelocity: ZERO_VEL,
        hullSamplePoints: HULL_SAMPLE_POINTS,
      },
      flatWater,
      0,
      DEFAULT_BUOYANCY_CONFIG,
    );

    // Only gravity, no buoyancy — net force is strongly negative
    expect(result.force[1]).toBeLessThan(0);
    expect(result.force[1]).toBeCloseTo(
      -DEFAULT_BUOYANCY_CONFIG.boatMass * DEFAULT_BUOYANCY_CONFIG.gravity,
      1,
    );
  });
});

// ---- Scenario 4: Damage flows through armor then hull ----

describe('Scenario: damage flows through', () => {
  it('50 damage on entity with 30 armor depletes armor and reduces hull by 20', () => {
    const result = calculateDamage({
      currentArmor: 30,
      currentHull: 100,
      incomingDamage: 50,
    });

    expect(result.newArmor).toBe(0);
    expect(result.armorDamageDealt).toBe(30);
    expect(result.newHull).toBe(80);
    expect(result.hullDamageDealt).toBe(20);
    expect(result.isSunk).toBe(false);
  });

  it('damage calculation integrates correctly with store applyDamage', () => {
    // Set up a player in the store and verify store damage matches pure function
    useGameStore.getState().spawnPlayer();
    const beforeDamage = useGameStore.getState().player;
    if (!beforeDamage) throw new Error('Expected player to exist after spawnPlayer');

    useGameStore.getState().applyDamage('player', 50);
    const afterDamage = useGameStore.getState().player;
    if (!afterDamage) throw new Error('Expected player to exist after applyDamage');

    // Verify store result matches pure function result
    const pureResult = calculateDamage({
      currentArmor: beforeDamage.health.armor,
      currentHull: beforeDamage.health.hull,
      incomingDamage: 50,
    });

    expect(afterDamage.health.armor).toBe(pureResult.newArmor);
    expect(afterDamage.health.hull).toBe(pureResult.newHull);
  });
});

// ---- Scenario 5: Wave config scales with wave number ----

describe('Scenario: wave config scales with wave number', () => {
  it('wave 1 has 2 skiffs and no barges', () => {
    const config = generateWaveConfig(1);
    const skiffs = config.enemies.find((e) => e.type === 'skiff');
    const barges = config.enemies.find((e) => e.type === 'barge');

    expect(skiffs?.count).toBe(2);
    expect(barges).toBeUndefined();
  });

  it('wave 5 introduces barges (1 barge)', () => {
    const config = generateWaveConfig(5);
    const barges = config.enemies.find((e) => e.type === 'barge');

    expect(barges).toBeDefined();
    expect(barges?.count).toBe(1);
  });

  it('wave difficulty increases monotonically up to caps', () => {
    const wave3 = generateWaveConfig(3);
    const wave6 = generateWaveConfig(6);

    const skiffs3 = wave3.enemies.find((e) => e.type === 'skiff')?.count ?? 0;
    const skiffs6 = wave6.enemies.find((e) => e.type === 'skiff')?.count ?? 0;
    const barges6 = wave6.enemies.find((e) => e.type === 'barge')?.count ?? 0;

    expect(skiffs6).toBeGreaterThanOrEqual(skiffs3);
    expect(barges6).toBeGreaterThanOrEqual(1);
  });
});

// ---- Scenario 6: Quadrant detection ----

describe('Scenario: quadrant detection', () => {
  it('camera at 90 degrees right of boat heading returns starboard', () => {
    // Boat heading = 0, camera at PI/2 (90 degrees right)
    const quadrant = computeQuadrant(Math.PI / 2, 0);
    expect(quadrant).toBe('starboard');
  });

  it('camera aligned with boat heading returns fore', () => {
    const heading = Math.PI / 4;
    expect(computeQuadrant(heading, heading)).toBe('fore');
  });

  it('camera 90 degrees left of boat heading returns port', () => {
    expect(computeQuadrant(-Math.PI / 2, 0)).toBe('port');
  });

  it('camera behind boat returns aft', () => {
    expect(computeQuadrant(Math.PI, 0)).toBe('aft');
  });
});

// ---- Scenario 7: AI approaches target ----

describe('Scenario: AI approaching target', () => {
  it('APPROACHING state with target far away produces positive thrust', () => {
    const ctx = makeAIContext({
      currentState: 'approaching',
      distanceToTarget: 50,
      detectionRange: 80,
    });

    const decision = computeAIDecision(ctx, 0.016);

    expect(decision.newState).toBe('approaching');
    expect(decision.thrust).toBeGreaterThan(0);
  });

  it('APPROACHING state transitions to POSITIONING when within preferred range', () => {
    const ctx = makeAIContext({
      currentState: 'approaching',
      distanceToTarget: 10,
      preferredRange: 15,
    });

    const decision = computeAIDecision(ctx, 0.016);

    expect(decision.newState).toBe('positioning');
  });

  it('AI pursues unconditionally once in the approaching state', () => {
    // Regression: enemies spawn at 80-120m; if approaching ever gated on
    // distance they would freeze at the spawn ring and never engage.
    const ctx = makeAIContext({
      currentState: 'approaching',
      distanceToTarget: 150,
      detectionRange: 80,
    });

    const decision = computeAIDecision(ctx, 0.016);

    expect(decision.newState).toBe('approaching');
    expect(decision.thrust).toBeGreaterThan(0);
  });
});

// ---- Scenario 8: Full kill flow ----

describe('Scenario: full kill flow', () => {
  it('applying lethal damage marks entity as sunk with hull=0', () => {
    useGameStore.getState().spawnPlayer();
    // Skiff: armor=30, hull=40 → total 70 to kill
    const enemyId = useGameStore.getState().spawnEnemy('skiff', [0, 0, 50]);

    useGameStore.getState().applyDamage(enemyId, 9999);

    const enemy = useGameStore.getState().enemies.get(enemyId);
    expect(enemy?.isSinking).toBe(true);
    expect(enemy?.health.hull).toBe(0);
  });

  it('killing player sets isSinking=true and transitions to game-over', () => {
    useGameStore.getState().spawnPlayer();
    useGameStore.getState().applyDamage('player', 9999);

    const player = useGameStore.getState().player;
    expect(player?.isSinking).toBe(true);
    expect(player?.health.hull).toBe(0);
    expect(useGameStore.getState().phase).toBe('game-over');
  });

  it('sinking enemy decrements enemiesRemaining', () => {
    useGameStore.getState().spawnPlayer();
    const enemyId = useGameStore.getState().spawnEnemy('skiff', [0, 0, 50]);
    expect(useGameStore.getState().enemiesRemaining).toBe(1);

    useGameStore.getState().applyDamage(enemyId, 9999);

    expect(useGameStore.getState().enemiesRemaining).toBe(0);
  });
});

// ---- Scenario 9: Game restart resets state ----

describe('Scenario: game restart resets state', () => {
  it('resetGame after game-over clears enemies, score, and wave number', () => {
    // Set up a mid-game state
    useGameStore.getState().spawnPlayer();
    useGameStore.getState().spawnEnemy('skiff', [0, 0, 50]);
    useGameStore.getState().spawnEnemy('barge', [50, 0, 0]);
    useGameStore.getState().addScore(1500);
    useGameStore.getState().advanceWave();
    useGameStore.getState().advanceWave();
    useGameStore.getState().setPhase('game-over');

    // Verify pre-reset state
    expect(useGameStore.getState().enemies.size).toBe(2);
    expect(useGameStore.getState().score).toBe(1500);
    expect(useGameStore.getState().wave).toBe(2);

    // Reset
    useGameStore.getState().resetGame();

    const state = useGameStore.getState();
    expect(state.enemies.size).toBe(0);
    expect(state.score).toBe(0);
    expect(state.wave).toBe(0);
    expect(state.player).toBeNull();
    expect(state.phase).toBe('mainMenu');
    expect(state.enemiesRemaining).toBe(0);
    expect(state.enemiesSunkTotal).toBe(0);
  });

  it('startGame atomically resets state and sets phase to playing', () => {
    // Set up some game state first
    useGameStore.getState().spawnPlayer();
    useGameStore.getState().spawnEnemy('skiff', [0, 0, 50]);
    useGameStore.getState().addScore(999);
    useGameStore.getState().advanceWave();
    useGameStore.getState().setPhase('game-over');

    // Start a new game
    useGameStore.getState().startGame();

    const state = useGameStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.player).not.toBeNull();
    expect(state.enemies.size).toBe(0);
    expect(state.score).toBe(0);
    expect(state.wave).toBe(1);
  });

  it('startGame creates a player with full health stats matching player preset', () => {
    useGameStore.getState().startGame();

    const player = useGameStore.getState().player;
    const preset = BOAT_STATS.player;

    expect(player).not.toBeNull();
    expect(player?.health.armor).toBe(preset.health.armor);
    expect(player?.health.hull).toBe(preset.health.hull);
    expect(player?.movement.thrustForce).toBe(preset.movement.thrustForce);
  });
});
