import { FONT_DISPLAY } from '../theme';

/**
 * The rising flood.
 *
 * This is the platformer's lose condition and, more importantly, its clock.
 * Because only chess moves lift the player, a rising floor means shuffling
 * pieces drowns you — the player has to keep finding moves that actually
 * achieve something. Set `speed` to 0 to disable it (tutorial floors).
 */
export class Flood {
	private surfaceY: number;
	private body!: Phaser.GameObjects.Rectangle;
	private surface!: Phaser.GameObjects.Rectangle;
	private crest!: Phaser.GameObjects.Rectangle;
	private warning!: Phaser.GameObjects.Text;
	private caught = false;

	constructor(
		private readonly scene: Phaser.Scene,
		private readonly worldWidth: number,
		worldHeight: number,
		/** Rise rate in px/s. 0 disables the flood entirely. */
		private readonly speed: number
	) {
		this.surfaceY = worldHeight + 140;

		if (this.speed > 0) {
			this.draw(worldHeight);
		}
	}

	private draw(worldHeight: number) {
		// Tall enough that its bottom edge never scrolls into view.
		this.body = this.scene.add
			.rectangle(this.worldWidth / 2, this.surfaceY, this.worldWidth, 60000, 0x1d2a4a, 0.82)
			.setOrigin(0.5, 0)
			.setDepth(40);

		this.surface = this.scene.add
			.rectangle(this.worldWidth / 2, this.surfaceY, this.worldWidth, 6, 0x6f9fd8, 0.95)
			.setDepth(41);

		this.crest = this.scene.add
			.rectangle(this.worldWidth / 2, this.surfaceY - 5, this.worldWidth, 2, 0xcfe4ff, 0.7)
			.setDepth(41);

		this.warning = this.scene.add
			.text(this.worldWidth / 2, worldHeight - 64, 'THE FLOOD IS RISING', {
				fontFamily: FONT_DISPLAY,
				fontSize: '22px',
				color: '#ffd9d9',
				stroke: '#140d06',
				strokeThickness: 5
			})
			.setOrigin(0.5)
			.setDepth(60)
			.setScrollFactor(0)
			.setAlpha(0);
	}

	get isActive() {
		return this.speed > 0;
	}

	get y() {
		return this.surfaceY;
	}

	/**
	 * Advances the flood. Returns true on the frame it catches the player, once
	 * only — the caller ends the run.
	 */
	update(delta: number, playerY: number): boolean {
		if (this.speed <= 0 || this.caught) {
			return false;
		}

		this.surfaceY -= this.speed * (delta / 1000);

		this.body.y = this.surfaceY;
		this.surface.y = this.surfaceY;
		// Slight swell, so the surface reads as water rather than a flat bar.
		this.crest.y = this.surfaceY - 5 + Math.sin(this.scene.time.now / 260) * 2;

		// Fade the warning in as the gap closes.
		const gap = this.surfaceY - playerY;
		this.warning.setAlpha(gap < 240 ? Phaser.Math.Clamp(1 - gap / 240, 0, 1) : 0);

		if (playerY >= this.surfaceY) {
			this.caught = true;
			return true;
		}

		return false;
	}
}
