// ---- Physics ----

/** Gravity constant (m/s²) */
export const GRAVITY = 9.81;

/** Buoyancy force multiplier applied per sample point */
export const BUOYANCY_STRENGTH = 120;

/** Water drag coefficient (linear velocity damping) */
export const WATER_LINEAR_DRAG = 0.4;

/** Water angular drag coefficient */
export const WATER_ANGULAR_DRAG = 0.6;

/** Boat rigid body mass (kg) */
export const BOAT_MASS = 500;

/** Number of buoyancy sample points per boat */
export const BUOYANCY_SAMPLE_COUNT = 4;

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
