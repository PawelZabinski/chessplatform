import { pickPlatformCount, runeChance, stageForLevel } from '$game/stages';
import { seededRandom } from '$game/worldSeed';
import type { TerrainTheme } from '$game/world/themes';
import { BAND_HEIGHT, type Ground, type Platform, type Rune, type Spike } from './types';

/** Hazard rates can be overridden per tower floor; endless uses the stage. */
export interface FieldRules {
	spikeChance?: number;
	runeChance?: number;
	blockedChance?: number;
}

const PLATFORM_WIDTH = 168;
const PLATFORM_HEIGHT = 18;
const SPIKE_SIZE = 26;
const RUNE_SIZE = 30;
/** Top of the walkable ground, measured up from the bottom of the view. */
export const GROUND_INSET = 70;

/**
 * The climbable tower: bands of platforms with the spikes and runes on them.
 *
 * Generation rules come either from a hand-tuned tower floor or from the endless
 * stage table, and each band remembers the theme it was built under so a long
 * climb leaves visible strata rather than one repeated tile.
 */
export class World {
	readonly platforms: Platform[] = [];
	readonly spikes: Spike[] = [];
	readonly runes: Rune[] = [];
	ground: Ground;

	/** Highest band generated so far. */
	private highestBand = 0;
	/** Set when a floor is cleared: nothing more is built above the climber. */
	private sealed = false;

	constructor(
		private readonly width: number,
		private readonly baseline: number,
		private readonly rules: FieldRules,
		private readonly themeForLevel: (level: number) => TerrainTheme,
		private readonly seed: number
	) {
		this.ground = { y: baseline - GROUND_INSET, theme: themeForLevel(0) };

		// The ground is a real collider, not just something drawn. Without this
		// the climber falls straight through the floor at the start of a run and
		// the lava takes them before they can play a move.
		this.platforms.push({
			x: -width,
			y: this.ground.y,
			width: width * 3,
			height: GROUND_INSET + 400,
			solid: true,
			theme: this.ground.theme,
			isGround: true
		});
	}

	/** The floor slab, which must survive pruning and never be swept away. */
	private get groundPlatform() {
		return this.platforms[0];
	}

	get highestGenerated() {
		return this.highestBand;
	}

	/** Generates every band up to `level + lookahead`. */
	ensureGenerated(level: number, lookahead = 10) {
		if (this.sealed) return;
		const target = level + lookahead;
		while (this.highestBand < target) {
			this.highestBand += 1;
			this.buildBand(this.highestBand);
		}
	}

	/** Stops further generation and clears everything above `y`. */
	seal(aboveY: number) {
		this.sealed = true;
		for (let i = this.platforms.length - 1; i >= 0; i--) {
			if (this.platforms[i] === this.groundPlatform) continue;
			if (this.platforms[i].y < aboveY) this.platforms.splice(i, 1);
		}
		for (const s of this.spikes) if (s.y < aboveY) s.alive = false;
		for (const r of this.runes) if (r.y < aboveY) r.alive = false;
	}

	private buildBand(level: number) {
		const stream = level * 16;
		const countRandom = seededRandom(this.seed, stream);
		const stage = stageForLevel(level);
		const theme = this.themeForLevel(level);
		const spikeRate = this.rules.spikeChance ?? stage.spikeChance;
		const runeRate = this.rules.runeChance ?? runeChance(stage);
		const blockedRate = this.rules.blockedChance ?? stage.blockedChance;

		const y = this.baseline - level * BAND_HEIGHT;
		const count = pickPlatformCount(stage, countRandom());

		const half = PLATFORM_WIDTH / 2;
		const spacing = PLATFORM_WIDTH + 40;
		const placed: number[] = [];

		for (let i = 0; i < count; i++) {
			// Slot retries must not alter hazard rolls. Keeping independent streams
			// also makes a seed reproduce the whole course on every device.
			const slotRandom = seededRandom(this.seed, stream + i * 2 + 1);
			const featureRandom = seededRandom(this.seed, stream + i * 2 + 2);
			const centre = this.findSlot(half, this.width - half, spacing, placed, slotRandom);
			if (centre === null) continue;
			placed.push(centre);

			const solid = featureRandom() < blockedRate;
			this.platforms.push({
				x: centre - half,
				y,
				width: PLATFORM_WIDTH,
				height: PLATFORM_HEIGHT,
				solid,
				theme
			});

			// One roll picks spike, rune or nothing, so a platform never carries
			// both and runes stay exactly half as common as spikes.
			const roll = featureRandom();
			if (roll < spikeRate) {
				this.spikes.push({
					x:
						centre -
						SPIKE_SIZE / 2 +
						(featureRandom() - 0.5) * (PLATFORM_WIDTH - SPIKE_SIZE),
					y: y - SPIKE_SIZE,
					size: SPIKE_SIZE,
					phase: featureRandom() * Math.PI * 2,
					alive: true
				});
			} else if (roll < spikeRate + runeRate) {
				const runeY = y - RUNE_SIZE - 20;
				this.runes.push({
					x: centre - RUNE_SIZE / 2,
					y: runeY,
					baseY: runeY,
					size: RUNE_SIZE,
					phase: featureRandom() * Math.PI * 2,
					alive: true
				});
			}
		}
	}

	private findSlot(
		min: number,
		max: number,
		spacing: number,
		placed: number[],
		random: () => number
	): number | null {
		if (max <= min) return this.width / 2;
		for (let attempt = 0; attempt < 20; attempt++) {
			const candidate = min + random() * (max - min);
			if (!placed.some((p) => Math.abs(p - candidate) < spacing)) return candidate;
		}
		return null;
	}

	/** Destroys every spike currently on screen. Returns how many. */
	clearSpikesInView(top: number, bottom: number): number {
		let cleared = 0;
		for (const spike of this.spikes) {
			if (spike.alive && spike.y >= top && spike.y <= bottom) {
				spike.alive = false;
				cleared++;
			}
		}
		return cleared;
	}

	/** Drops references to anything far below the climber, to bound memory. */
	prune(belowY: number) {
		const keep = (y: number) => y < belowY;
		for (let i = this.platforms.length - 1; i >= 0; i--) {
			// The floor is never pruned: a climber who falls back must still land.
			if (this.platforms[i] === this.groundPlatform) continue;
			if (!keep(this.platforms[i].y)) this.platforms.splice(i, 1);
		}
		for (let i = this.spikes.length - 1; i >= 0; i--) {
			if (!this.spikes[i].alive || !keep(this.spikes[i].y)) this.spikes.splice(i, 1);
		}
		for (let i = this.runes.length - 1; i >= 0; i--) {
			if (!this.runes[i].alive || !keep(this.runes[i].y)) this.runes.splice(i, 1);
		}
	}
}
