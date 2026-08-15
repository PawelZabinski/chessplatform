/**
 * The rising lava — the platformer's lose condition and its clock.
 *
 * Because only chess moves lift the climber, a rising floor means shuffling
 * pieces burns you. A flat rise rate can never keep pace with someone climbing
 * well, so it also closes any excess gap: it stays within a trail distance of
 * the player, which keeps it a visible threat instead of vanishing below the
 * world. Speed 0 disables it entirely (the tutorial floors).
 */
export class Lava {
	/** World Y of the surface. Lower is higher, as everywhere else. */
	surfaceY: number;
	prevSurfaceY: number;

	/** Set once it catches the player. */
	caught = false;

	/** How far below the player it may trail, as a fraction of view height. */
	private static readonly TRAIL_FRACTION = 0.5;
	private static readonly MAX_CATCH_UP = 700;

	constructor(
		private readonly speed: number,
		baseline: number,
		private viewHeight: number
	) {
		this.surfaceY = baseline + 140;
		this.prevSurfaceY = this.surfaceY;
	}

	get active() {
		return this.speed > 0;
	}

	setViewHeight(height: number) {
		this.viewHeight = height;
	}

	step(stepMs: number, playerFeetY: number): boolean {
		this.prevSurfaceY = this.surfaceY;
		if (!this.active || this.caught) return false;

		const seconds = stepMs / 1000;
		this.surfaceY -= this.speed * seconds;

		const target = playerFeetY + this.viewHeight * Lava.TRAIL_FRACTION;
		const excess = this.surfaceY - target;
		if (excess > 0) {
			const catchUp = Math.min(excess * 1.4, Lava.MAX_CATCH_UP);
			this.surfaceY = Math.max(target, this.surfaceY - catchUp * seconds);
		}

		if (playerFeetY >= this.surfaceY) {
			this.caught = true;
			return true;
		}
		return false;
	}

	/** 0 when far away, 1 when about to catch the player — drives the warning. */
	proximity(playerFeetY: number): number {
		if (!this.active) return 0;
		const gap = this.surfaceY - playerFeetY;
		if (gap > 260) return 0;
		return Math.max(0, Math.min(1, 1 - gap / 260));
	}
}
