import { FONT_DISPLAY } from '../theme';

/**
 * The rising lava.
 *
 * This is the platformer's lose condition and, more importantly, its clock.
 * Because only chess moves lift the player, a rising floor means shuffling
 * pieces burns you — the player has to keep finding moves that actually achieve
 * something. Set `speed` to 0 to disable it (tutorial floors).
 */
export class Lava {
	private surfaceY: number;
	private body!: Phaser.GameObjects.Rectangle;
	private surface!: Phaser.GameObjects.Rectangle;
	private crust!: Phaser.GameObjects.Rectangle;
	private glow!: Phaser.GameObjects.Rectangle;
	private warning!: Phaser.GameObjects.Text;
	private embers?: Phaser.GameObjects.Particles.ParticleEmitter;
	private caught = false;

	constructor(
		private readonly scene: Phaser.Scene,
		private readonly worldWidth: number,
		worldHeight: number,
		/** Rise rate in px/s. 0 disables the lava entirely. */
		private readonly speed: number
	) {
		this.surfaceY = worldHeight + 140;
		if (this.speed > 0) this.draw(worldHeight);
	}

	private draw(worldHeight: number) {
		// Deep molten body, tall enough that its base never scrolls into view.
		this.body = this.scene.add
			.rectangle(this.worldWidth / 2, this.surfaceY, this.worldWidth, 60000, 0x7a1207, 0.95)
			.setOrigin(0.5, 0)
			.setDepth(40);

		// Hotter band just under the surface.
		this.surface = this.scene.add
			.rectangle(this.worldWidth / 2, this.surfaceY + 10, this.worldWidth, 26, 0xd6390b, 0.95)
			.setDepth(41);

		// Bright crust line, and a soft glow spilling above it.
		this.crust = this.scene.add
			.rectangle(this.worldWidth / 2, this.surfaceY, this.worldWidth, 5, 0xffb43c, 1)
			.setDepth(42);
		this.glow = this.scene.add
			.rectangle(this.worldWidth / 2, this.surfaceY - 26, this.worldWidth, 52, 0xff6a1f, 0.22)
			.setDepth(39);

		if (this.scene.textures.exists('mote')) {
			this.embers = this.scene.add.particles(0, 0, 'mote', {
				x: { min: 0, max: this.worldWidth },
				y: this.surfaceY,
				lifespan: 2200,
				speedY: { min: -110, max: -40 },
				speedX: { min: -18, max: 18 },
				scale: { start: 1.1, end: 0 },
				alpha: { start: 0.9, end: 0 },
				tint: [0xffd08a, 0xff8a3c, 0xff4d1a],
				frequency: 90,
				quantity: 2,
				blendMode: 'ADD'
			});
			this.embers.setDepth(43);
		}

		this.warning = this.scene.add
			.text(this.worldWidth / 2, worldHeight - 64, 'THE LAVA IS RISING', {
				fontFamily: FONT_DISPLAY,
				fontSize: '22px',
				color: '#ffd2a8',
				stroke: '#2a0a04',
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
	 * Advances the lava. Returns true on the frame it catches the player, once
	 * only — the caller ends the run.
	 */
	update(delta: number, playerY: number): boolean {
		if (this.speed <= 0 || this.caught) return false;

		this.surfaceY -= this.speed * (delta / 1000);

		this.body.y = this.surfaceY;
		this.surface.y = this.surfaceY + 10;
		this.glow.y = this.surfaceY - 26;
		// Slight swell so the crust reads as molten rather than a flat bar.
		this.crust.y = this.surfaceY + Math.sin(this.scene.time.now / 240) * 2;
		this.glow.setAlpha(0.18 + Math.sin(this.scene.time.now / 380) * 0.06);

		if (this.embers) this.embers.setY(this.surfaceY);

		const gap = this.surfaceY - playerY;
		this.warning.setAlpha(gap < 240 ? Phaser.Math.Clamp(1 - gap / 240, 0, 1) : 0);

		if (playerY >= this.surfaceY) {
			this.caught = true;
			return true;
		}
		return false;
	}
}
