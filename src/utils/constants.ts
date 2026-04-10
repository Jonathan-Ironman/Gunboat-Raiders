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
 *  Too high = boat feels stuck on a flat plane and cannot climb waves.
 *  Too low = boat bobs forever. ~3-4 gives a natural, lively float that rises
 *  and falls with the Gerstner surface. */
export const BUOYANCY_VERTICAL_DAMPING = 3.5;

/** Angular velocity damping for rotational stability (multiplied by mass).
 *  Stacks with Rapier's angularDamping on the RigidBody.
 *  Too high = boat refuses to tilt with wave slopes, which is the exact bug
 *  we are fixing: the boat must pitch and roll as waves pass under it. */
export const BUOYANCY_ANGULAR_DAMPING = 1.5;

/** Maximum submersion depth (meters) to clamp force spikes from deep wave troughs.
 *  Must exceed the tallest wave crest-to-trough amplitude so that a boat briefly
 *  caught under a crest still gets a strong upward restoring force and pops back
 *  to the surface. Combined Gerstner amplitude peaks around ~1.9m, so 3.0 gives
 *  enough headroom for deep-submersion recovery without unbounded force spikes. */
export const BUOYANCY_MAX_SUBMERSION = 3.0;

/** Scale factor for self-righting torque (1.0 = full physical torque from per-point forces).
 *  Values below 1.0 dampen tilt and make the boat glide flatly over waves —
 *  exactly the bug we are fixing. 1.0 gives the natural, physically-correct
 *  wave-following behaviour we want. */
export const BUOYANCY_TORQUE_SCALE = 1.0;

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
export const ROCK_COUNT = 40;

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
