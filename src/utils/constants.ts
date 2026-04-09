// ---- Physics ----

/** Gravity constant (m/s²) */
export const GRAVITY = 9.81;

/**
 * Buoyancy force multiplier.
 * Per-point force = submersion * BUOYANCY_STRENGTH / numPoints.
 * At equilibrium with 8 sample points ~0.5m submerged:
 * total_buoyancy = 0.5 * BUOYANCY_STRENGTH = BOAT_MASS * GRAVITY
 * => BUOYANCY_STRENGTH = BOAT_MASS * GRAVITY / 0.5 = 1000 * 9.81 / 0.5 = 19620
 */
export const BUOYANCY_STRENGTH = 19620;

/** Velocity-proportional vertical damping to prevent oscillation (multiplied by mass).
 *  Higher values = more critically damped = less bouncing. Range 4-12 typical. */
export const BUOYANCY_VERTICAL_DAMPING = 8.0;

/** Angular velocity damping for rotational stability (multiplied by mass).
 *  Stacks with Rapier's angularDamping on the RigidBody. */
export const BUOYANCY_ANGULAR_DAMPING = 8.0;

/** Maximum submersion depth (meters) to clamp force spikes from deep wave troughs.
 *  Lower = more stable on tall waves, but reduces buoyancy recovery from deep submersion. */
export const BUOYANCY_MAX_SUBMERSION = 1.2;

/** Scale factor for self-righting torque (reduces raw torque to prevent rotational instability).
 *  Higher = boat follows wave slope more aggressively. 0.2-0.4 is a good range. */
export const BUOYANCY_TORQUE_SCALE = 0.25;

/** Water drag coefficient (linear velocity damping) */
export const WATER_LINEAR_DRAG = 0.4;

/** Water angular drag coefficient */
export const WATER_ANGULAR_DRAG = 0.6;

/** Boat rigid body mass (kg) */
export const BOAT_MASS = 1000;

/** Number of buoyancy sample points per boat */
export const BUOYANCY_SAMPLE_COUNT = 8;

// ---- World ----

/** Playable arena radius (meters) */
export const ARENA_RADIUS = 200;

/** Water level Y position */
export const WATER_LEVEL = 0;

/** Rock count in arena */
export const ROCK_COUNT = 12;

// ---- Gameplay ----

/** Base score per enemy sunk */
export const SCORE_PER_KILL = 100;

/** Wave clear bonus score */
export const SCORE_WAVE_BONUS = 250;

/** Seconds between waves */
export const WAVE_INTERMISSION = 5;

/** Enemy spawn distance from arena center */
export const ENEMY_SPAWN_RADIUS = 150;

// ---- Rendering ----

/** Target physics fixed step rate (Hz) */
export const PHYSICS_RATE = 60;

/** Number of Gerstner waves in the wave set */
export const WAVE_COUNT = 4;
