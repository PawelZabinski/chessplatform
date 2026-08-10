/** Shared tuning constants for the platformer half of the game. */

/** Vertical distance between generated platform bands. */
export const LEVEL_HEIGHT = 200;

export const PLAYER_GRAVITY_Y = 350;
export const PLAYER_BOUNCE = 0.2;
/** Headroom above MAX_LIFT, so the biggest captures are not clamped flat. */
export const PLAYER_MAX_VELOCITY = 900;

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
