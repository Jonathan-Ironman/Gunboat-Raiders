/**
 * Weapon overheat constants (first-pass, intentionally conservative).
 *
 * Design intent (`todo/20260411-weapon-overheat-mechanic.md`):
 *
 *  - Player should be able to fire freely in short bursts without hitting
 *    overheat. Overheat should only punish sustained, non-stop fire.
 *  - 20 seconds of max-rate sustained fire (full broadside) reaches 100%
 *    heat. 10 seconds = ~50%. Heat accumulates per projectile spawned,
 *    so slower quadrants accumulate less heat in the same wall time.
 *  - Recovery: when not firing, heat fully drains in ~12.5 seconds.
 *  - Brackets introduce progressive fire-rate penalty so the player feels
 *    the gun "chugging" well before lockout; lockout at exactly 100% with
 *    a sticky recovery threshold prevents chatter when heat hovers at the
 *    cap.
 *
 * Model:
 *
 *  - Heat always decays at HEAT_DECAY_PER_SECOND × delta every frame,
 *    whether the player is firing or not. This keeps the model
 *    frame-rate independent and makes the tuning math a simple
 *    net-rate subtraction.
 *  - Firing adds HEAT_PER_SHOT per spawned projectile on the frame the
 *    shot is actually emitted.
 *  - At full broadside (26.67 shots/s) the net rate is
 *    `26.67 × HEAT_PER_SHOT − HEAT_DECAY_PER_SECOND ≈ +0.05 heat/s`,
 *    which linearly reaches heat = 1.0 in ~20 seconds.
 *  - Smaller quadrants (fore = 2 mounts, aft = 1 mount) have net
 *    negative rates and cannot overheat on their own — a deliberate
 *    softening so sustained strafing is only risky during broadside
 *    volleys, which is also the combat situation where overheat is the
 *    most interesting gameplay decision.
 *
 * These values are a balance stub — a dedicated tuning pass will revisit
 * them after the HUD bar is live and playtest feedback is collected.
 */

/**
 * Shots per second achievable at max fire rate with the largest quadrant
 * (port / starboard broadside = 4 mounts at 150 ms cooldown each).
 *
 *   4 mounts × (1 / 0.15 s) = 26.666... shots/s
 */
export const HEAT_MAX_SHOTS_PER_SECOND = 4 / 0.15;

/**
 * Target time (seconds) of uninterrupted max-rate sustained fire before
 * heat hits 1.0. Used together with `HEAT_DECAY_PER_SECOND` and
 * `HEAT_MAX_SHOTS_PER_SECOND` to calibrate `HEAT_PER_SHOT`.
 */
export const HEAT_MAX_SUSTAINED_SECONDS = 20;

/**
 * Passive heat decay per second. Always-on (frame-rate independent),
 * whether or not the player is firing. Tuned so a fully overheated
 * weapon that immediately stops firing fully recovers in
 * `1 / HEAT_DECAY_PER_SECOND` seconds (≈ 12.5 s at 0.08), which is
 * inside the design window of 10–15 s.
 */
export const HEAT_DECAY_PER_SECOND = 0.08;

/**
 * Heat added to the shared heat pool for every projectile actually
 * fired. Chosen so that at max-rate broadside fire the net growth
 * (accumulation minus always-on decay) reaches 1.0 in exactly
 * `HEAT_MAX_SUSTAINED_SECONDS` seconds:
 *
 *   (HEAT_MAX_SHOTS_PER_SECOND × HEAT_PER_SHOT) − HEAT_DECAY_PER_SECOND
 *     = 1 / HEAT_MAX_SUSTAINED_SECONDS
 *
 * Solving for HEAT_PER_SHOT at the defaults above:
 *   HEAT_PER_SHOT = (1/20 + 0.08) / 26.67 ≈ 0.00487
 */
export const HEAT_PER_SHOT =
  (1 / HEAT_MAX_SUSTAINED_SECONDS + HEAT_DECAY_PER_SECOND) / HEAT_MAX_SHOTS_PER_SECOND;

// ---------------------------------------------------------------------------
// Brackets
// ---------------------------------------------------------------------------

/** Upper bound of the "green" (normal fire rate) bracket. */
export const HEAT_GREEN_MAX = 0.5;

/** Upper bound of the "yellow" (slowed) bracket. */
export const HEAT_YELLOW_MAX = 0.9;

/** Cooldown multiplier applied to the base per-quadrant cooldown in the green bracket. */
export const HEAT_COOLDOWN_MULT_GREEN = 1.0;

/** Cooldown multiplier in the yellow bracket — ~1.8× slower fire. */
export const HEAT_COOLDOWN_MULT_YELLOW = 1.8;

/** Cooldown multiplier in the red bracket — ~3.5× slower fire. */
export const HEAT_COOLDOWN_MULT_RED = 3.5;

// ---------------------------------------------------------------------------
// Lockout
// ---------------------------------------------------------------------------

/** Heat value at or above which firing is completely blocked. */
export const HEAT_LOCKOUT_THRESHOLD = 1.0;

/**
 * Once locked out, firing remains blocked until heat drops back below this
 * value. A sticky lockout with a lower recovery threshold prevents chatter
 * at the cap (heat would otherwise fire, tick +0.0018, lock, decay, fire,
 * tick +0.0018, lock... every frame).
 */
export const HEAT_LOCKOUT_RECOVERY_THRESHOLD = 0.85;
