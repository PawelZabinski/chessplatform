import type { Platform } from './types';

/**
 * The climber.
 *
 * Swept AABB against static platforms, resolved on one axis at a time. Because
 * the loop is fixed-step, a big launch (a queen capture, or the victory fling)
 * can no longer tunnel through a platform the way a variable-delta step could.
 *
 * Wooden platforms are one-way: they only stop a downward move that began above
 * them. Stone stops everything. Holding drop briefly disables the one-way
 * surfaces so the player can fall through wood but never through stone.
 */

export const PLAYER_WIDTH = 34;
export const PLAYER_HEIGHT = 44;

/**
 * Gravity must match what src/game/lift.ts was tuned against, or every leap
 * comes out the wrong size. At 550 px/s² the documented table holds: a quiet
 * move clears roughly one 200px band (450² / 1100 ≈ 184px) and a queen capture
 * about three and a half.
 */
export const GRAVITY = 550;
export const MAX_FALL_SPEED = 1400;
export const MAX_RISE_SPEED = 2200;
export const RUN_SPEED = 260;
export const JUMP_VELOCITY = -530;
export const DOUBLE_JUMP_VELOCITY = -500;

export type Facing = 1 | -1;
export type PlayerAnim = 'idle' | 'run' | 'jump' | 'double';

export class Player {
	x: number;
	y: number;
	vx = 0;
	vy = 0;

	/** Previous position, for interpolated rendering between fixed steps. */
	prevX: number;
	prevY: number;

	onGround = false;
	hasDoubleJumped = false;
	facing: Facing = 1;
	anim: PlayerAnim = 'idle';
	animTime = 0;

	/** While positive, wooden platforms are ignored so the player drops through. */
	dropThroughMs = 0;
	/** Set during the floor-cleared send-off: physics is off, position is driven. */
	scripted = false;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
		this.prevX = x;
		this.prevY = y;
	}

	get width() {
		return PLAYER_WIDTH;
	}

	get height() {
		return PLAYER_HEIGHT;
	}

	get centreX() {
		return this.x + PLAYER_WIDTH / 2;
	}

	/** Feet position — what altitude is measured from. */
	get feetY() {
		return this.y + PLAYER_HEIGHT;
	}

	launch(vy: number) {
		this.vy = Math.max(vy, -MAX_RISE_SPEED);
		this.onGround = false;
	}

	step(stepMs: number, platforms: Platform[], worldWidth: number) {
		this.prevX = this.x;
		this.prevY = this.y;

		if (this.scripted) return;

		const dt = stepMs / 1000;
		if (this.dropThroughMs > 0) this.dropThroughMs -= stepMs;

		this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL_SPEED);

		// Horizontal first, then vertical: resolving one axis at a time avoids
		// the corner cases where a diagonal move resolves the wrong way.
		this.x += this.vx * dt;
		this.resolveHorizontal(platforms);
		this.x = Math.max(0, Math.min(worldWidth - PLAYER_WIDTH, this.x));

		const previousBottom = this.prevY + PLAYER_HEIGHT;
		this.y += this.vy * dt;
		this.onGround = false;
		this.resolveVertical(platforms, previousBottom);

		if (this.onGround) this.hasDoubleJumped = false;
		this.animTime += stepMs;
	}

	private resolveHorizontal(platforms: Platform[]) {
		for (const p of platforms) {
			// Only stone blocks sideways; wood is a floor, not a wall.
			if (!p.solid) continue;
			if (!this.hits(p)) continue;

			if (this.vx > 0) this.x = p.x - PLAYER_WIDTH;
			else if (this.vx < 0) this.x = p.x + p.width;
			this.vx = 0;
		}
	}

	private resolveVertical(platforms: Platform[], previousBottom: number) {
		for (const p of platforms) {
			if (!this.hits(p)) continue;

			if (!p.solid) {
				// One-way: must be falling, and must have been above it last step.
				if (this.vy < 0) continue;
				if (previousBottom > p.y + 1) continue;
				if (this.dropThroughMs > 0) continue;
			}

			if (this.vy >= 0) {
				this.y = p.y - PLAYER_HEIGHT;
				this.vy = 0;
				this.onGround = true;
			} else if (p.solid) {
				this.y = p.y + p.height;
				this.vy = 0;
			}
		}
	}

	private hits(p: Platform): boolean {
		return (
			this.x < p.x + p.width &&
			this.x + PLAYER_WIDTH > p.x &&
			this.y < p.y + p.height &&
			this.y + PLAYER_HEIGHT > p.y
		);
	}

	/** Chooses the animation from the current motion. */
	updateAnimation() {
		let next: PlayerAnim;
		if (!this.onGround) next = this.hasDoubleJumped ? 'double' : 'jump';
		else if (Math.abs(this.vx) > 12) next = 'run';
		else next = 'idle';

		if (next !== this.anim) {
			this.anim = next;
			this.animTime = 0;
		}
		if (this.vx > 12) this.facing = 1;
		else if (this.vx < -12) this.facing = -1;
	}
}
