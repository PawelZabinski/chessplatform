import { LEVEL_HEIGHT } from '../config';
import { PALETTE } from '../theme';
import { createAllTerrainTextures, groundKey, stoneKey, woodKey } from './textures';
import { THEMES, type TerrainTheme } from './themes';
import { pickPlatformCount, runeChance, stageForLevel } from '../stages';

/**
 * Top of the walkable ground, relative to the bottom of the canvas. Pinned to
 * the value the original short tile produced, so making the ground art taller
 * changed only how far it hangs below the screen, never where the player stands.
 */
const GROUND_SURFACE_Y_OFFSET = -70.6;

/** Hazard rates can be overridden per tower floor; endless mode uses the stage. */
export interface FieldRules {
	spikeChance?: number;
	runeChance?: number;
	blockedChance?: number;
}

/**
 * Procedural terrain: the bands of platforms the player climbs, plus the spikes
 * and control runes sitting on them.
 *
 * Pulled out of the Game scene so generation rules can be driven either by the
 * endless stage table or by a hand-tuned tower floor.
 */
export class PlatformField {
	readonly platforms: Phaser.Physics.Arcade.StaticGroup;
	readonly spikes: Phaser.Physics.Arcade.Group;
	readonly runes: Phaser.Physics.Arcade.Group;

	private platformHalfWidth = 0;
	private platformHeight = 0;
	private spikeHalfWidth = 0;
	private spikeHeight = 0;
	private groundTileWidth = 0;

	// Scales chosen so the drawn plank matches the original collision footprint
	// (168 x ~18) — the art changed, the physics deliberately did not.
	private readonly platformScale = 2;
	private readonly groundScale = 1.6;
	private readonly spikeScale = 0.3;

	constructor(
		private readonly scene: Phaser.Scene,
		private readonly worldWidth: number,
		private readonly worldHeight: number,
		private readonly rules: FieldRules = {},
		/** Which stone a given altitude band is built from. */
		private readonly themeForLevel: (level: number) => TerrainTheme = () => THEMES.undercroft
	) {
		this.platforms = scene.physics.add.staticGroup();
		this.spikes = scene.physics.add.group({ allowGravity: false, immovable: true });
		this.runes = scene.physics.add.group({ allowGravity: false, immovable: true });

		createAllTerrainTextures(scene);
		this.measureTextures();
		this.createRuneTexture();
		this.createGroundTiles();
	}

	private measureTextures() {
		// All themes share one geometry, so measuring any of them is enough.
		const reference = THEMES.undercroft;
		const platform = this.scene.textures
			.get(woodKey(reference))
			.getSourceImage() as HTMLImageElement;
		this.platformHalfWidth = (platform.width * this.platformScale) / 2;
		this.platformHeight = platform.height * this.platformScale;

		const spikeFrame = this.scene.textures.get('spike').get(0);
		this.spikeHalfWidth = ((spikeFrame?.width ?? 0) * this.spikeScale) / 2;
		this.spikeHeight = (spikeFrame?.height ?? 0) * this.spikeScale;

		const ground = this.scene.textures
			.get(groundKey(reference))
			.getSourceImage() as HTMLImageElement;
		this.groundTileWidth = ground.width * this.groundScale;
	}

	/** Rune texture is generated in code, so the powerup needs no new asset. */
	private createRuneTexture() {
		if (this.scene.textures.exists('rune')) return;

		const size = 34;
		const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

		g.fillStyle(PALETTE.gold, 0.25);
		g.fillCircle(size / 2, size / 2, size / 2);
		g.fillStyle(PALETTE.goldBright, 0.9);
		g.fillCircle(size / 2, size / 2, size / 2 - 5);

		const diamond = (inset: number, colour: number) => {
			g.fillStyle(colour, 1);
			g.beginPath();
			g.moveTo(size / 2, inset);
			g.lineTo(size - inset - 1, size / 2);
			g.lineTo(size / 2, size - inset);
			g.lineTo(inset + 1, size / 2);
			g.closePath();
			g.fillPath();
		};
		diamond(6, PALETTE.oak);
		diamond(12, PALETTE.goldBright);

		g.generateTexture('rune', size, size);
		g.destroy();
	}

	private createGroundTiles() {
		if (!this.groundTileWidth) return;

		const key = groundKey(this.themeForLevel(0));
		const source = this.scene.textures.get(key).getSourceImage() as HTMLImageElement;
		const tileHeight = source.height * this.groundScale;

		// Anchor by the walkable surface, not by the tile centre, so the block can
		// be as tall as it likes and still leave collision exactly where it was.
		const centreY = GROUND_SURFACE_Y_OFFSET + tileHeight / 2;

		const tilesNeeded = Math.ceil(this.worldWidth / this.groundTileWidth) + 3;
		for (let i = 0; i < tilesNeeded; i++) {
			const x = -this.groundTileWidth + i * this.groundTileWidth + this.groundTileWidth / 2;
			const ground = this.platforms.create(
				x,
				this.worldHeight + centreY,
				key
			) as Phaser.Physics.Arcade.Image;
			ground.setData('blocked', true);
			ground.setScale(this.groundScale);
			ground.refreshBody();
		}
	}

	/** Generates one band of platforms at the given altitude level. */
	buildLevel(level: number) {
		const stage = stageForLevel(level);
		const theme = this.themeForLevel(level);
		const spikeRate = this.rules.spikeChance ?? stage.spikeChance;
		const runeRate = this.rules.runeChance ?? runeChance(stage);
		const blockedRate = this.rules.blockedChance ?? stage.blockedChance;

		const y = this.worldHeight - level * LEVEL_HEIGHT;
		const count = pickPlatformCount(stage, Math.random());

		const minX = Math.max(this.platformHalfWidth, 0);
		const maxX = this.worldWidth - this.platformHalfWidth;
		const spacing = this.platformHalfWidth * 2 + 40;
		const placed: number[] = [];

		for (let i = 0; i < count; i++) {
			const x = this.findSlot(minX, maxX, spacing, placed);
			if (x === null) continue;
			placed.push(x);

			const isBlocked = Math.random() < blockedRate;
			const platform = this.platforms.create(
				x,
				y,
				isBlocked ? stoneKey(theme) : woodKey(theme)
			) as Phaser.Physics.Arcade.Image;
			platform.setScale(this.platformScale);
			platform.refreshBody();
			platform.setData('blocked', isBlocked);

			// One roll picks spike, rune or nothing, so a platform never carries
			// both and runes stay exactly half as common as spikes.
			const roll = Math.random();
			if (roll < spikeRate) {
				this.addSpike(x, y);
			} else if (roll < spikeRate + runeRate) {
				this.addRune(x, y - this.platformHeight / 2 - 34);
			}
		}
	}

	private findSlot(minX: number, maxX: number, spacing: number, placed: number[]): number | null {
		if (maxX - minX <= 0) return this.worldWidth / 2;

		for (let attempt = 0; attempt < 20; attempt++) {
			const candidate = Phaser.Math.Clamp(
				Phaser.Math.Between(Math.round(minX), Math.round(maxX)),
				minX,
				maxX
			);
			if (!placed.some((existing) => Math.abs(existing - candidate) < spacing)) {
				return candidate;
			}
		}
		return null;
	}

	private addSpike(platformX: number, platformY: number) {
		const maxOffset = Math.max(0, Math.floor(this.platformHalfWidth - this.spikeHalfWidth));
		const x = Phaser.Math.Clamp(
			platformX + Phaser.Math.Between(-maxOffset, maxOffset),
			this.spikeHalfWidth,
			this.worldWidth - this.spikeHalfWidth
		);
		const y = platformY - this.platformHeight / 2 - this.spikeHeight / 2 - 20;

		const spike = this.spikes.create(x, y, 'spike', 0) as Phaser.Physics.Arcade.Sprite;
		spike.setDepth(5);
		spike.play('spike-idle');
		spike.body.setAllowGravity(false);
		spike.body.setImmovable(true);
		spike.body.moves = false;
		spike.body.setSize(this.spikeHalfWidth * 2, this.spikeHeight, true);
	}

	private addRune(x: number, y: number) {
		const rune = this.runes.create(x, y, 'rune') as Phaser.Physics.Arcade.Sprite;
		rune.setDepth(6);
		rune.body.setAllowGravity(false);
		rune.body.setImmovable(true);
		rune.body.moves = false;

		this.scene.tweens.add({
			targets: rune,
			y: y - 10,
			duration: 1100,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut'
		});
	}

	/** Destroys every spike currently within the camera's view. Returns the count. */
	clearVisibleSpikes(camera: Phaser.Cameras.Scene2D.Camera): number {
		const top = camera.scrollY;
		const bottom = top + camera.height;
		let cleared = 0;

		(this.spikes.getChildren() as Phaser.Physics.Arcade.Sprite[])
			.filter((spike) => spike.y >= top && spike.y <= bottom)
			.forEach((spike) => {
				spike.destroy();
				cleared += 1;
			});

		return cleared;
	}
}
