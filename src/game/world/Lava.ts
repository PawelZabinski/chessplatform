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

	/**
	 * How far below the player the lava is allowed to trail, as a fraction of the
	 * viewport height. The camera centres the player, so half a screen puts the
	 * crust right at the bottom edge of the view: close enough to be a constant
	 * visible threat, and it climbs into frame the moment the player stalls.
	 */
	private static readonly TRAIL_FRACTION = 0.5;
	/** Ceiling on the catch-up rate, so it glides up rather than teleporting. */
	private static readonly MAX_CATCH_UP = 700;

	private readonly worldHeight: number;

	constructor(
		private readonly scene: Phaser.Scene,
		private worldWidth: number,
		worldHeight: number,
		/** Base rise rate in px/s. 0 disables the lava entirely. */
		private readonly speed: number
	) {
		this.worldHeight = worldHeight;
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
				// Scales down on narrow screens so the warning never runs off the edge.
				fontSize: `${Math.max(15, Math.min(22, Math.round(this.worldWidth / 30)))}px`,
				color: '#ffd2a8',
				stroke: '#2a0a04',
				strokeThickness: 5,
				align: 'center',
				wordWrap: { width: Math.max(160, this.worldWidth - 48) }
			})
			.setOrigin(0.5)
			.setDepth(60)
			.setScrollFactor(0)
			.setAlpha(0);
	}

	/** Re-stretches the lava across a new viewport width after a resize. */
	resize(width: number) {
		if (this.speed <= 0) return;
		this.worldWidth = width;

		this.body.setSize(width, 60000).setPosition(width / 2, this.surfaceY);
		this.surface.setSize(width, 26).setPosition(width / 2, this.surfaceY + 10);
		this.crust.setSize(width, 5).setPosition(width / 2, this.surfaceY);
		this.glow.setSize(width, 52).setPosition(width / 2, this.surfaceY - 26);
		this.warning.setX(width / 2);
		this.warning.setWordWrapWidth(Math.max(160, width - 48));
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

		const seconds = delta / 1000;
		this.surfaceY -= this.speed * seconds;

		// A flat rise rate can never keep pace with a climbing player, so the
		// lava simply vanished below the world and stopped being a threat. It now
		// closes any excess gap, staying within a trail distance of the player.
		const target = playerY + this.worldHeight * Lava.TRAIL_FRACTION;
		const excess = this.surfaceY - target;
		if (excess > 0) {
			const catchUp = Math.min(excess * 1.4, Lava.MAX_CATCH_UP);
			this.surfaceY = Math.max(target, this.surfaceY - catchUp * seconds);
		}

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
