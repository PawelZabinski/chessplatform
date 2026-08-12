/** Shared tuning constants for the platformer half of the game. */

/** Vertical distance between generated platform bands. */
export const LEVEL_HEIGHT = 200;

export const PLAYER_GRAVITY_Y = 350;
export const PLAYER_BOUNCE = 0.2;
/**
 * Horizontal cap only needs to cover chess steering (7 files x 50) and the
 * rune run speed. Vertical needs headroom above MAX_LIFT and above the
 * victory fling, or the biggest launches get clamped flat.
 */
export const PLAYER_MAX_VELOCITY_X = 400;
export const PLAYER_MAX_VELOCITY_Y = 2200;

/** Upward launch awarded for winning a chess game in Endless Ascent. */
export const VICTORY_FLING_VELOCITY = -2000;

/** File delta of a chess move multiplied by this to steer left/right. */
export const STEER_PER_FILE = 50;

/** Control rune: time granted per pickup, and the cap when stacking. */
export const CONTROL_DURATION_MS = 5000;
export const CONTROL_MAX_MS = 10000;
export const CONTROL_RUN_SPEED = 260;
export const CONTROL_JUMP_VELOCITY = -530;
export const CONTROL_DOUBLE_JUMP_VELOCITY = -500;

/** Clean levels per combo step, and the ceiling. */
export const LEVELS_PER_COMBO_STEP = 5;
export const MAX_COMBO_MULTIPLIER = 4;

/**
 * Slow-motion is an earned ability, not a setting: it charges as you climb and
 * is spent to buy thinking time. Because it also stretches how long your chess
 * move takes to resolve, it is genuinely a trade — the lava keeps rising in
 * simulated time, so a long slow-motion costs you altitude.
 */
export const SLOWMO_FACTOR = 0.35;
/** Charge earned per platform band climbed, as a fraction of a full meter. */
export const SLOWMO_CHARGE_PER_BAND = 0.055;
/** Full meter lasts this long in real seconds when spent in one go. */
export const SLOWMO_DURATION_MS = 6000;
/** Minimum charge before it can be triggered at all. */
export const SLOWMO_MIN_CHARGE = 0.35;
