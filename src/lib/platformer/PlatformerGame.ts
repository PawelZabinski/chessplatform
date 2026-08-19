import {
	CAMERA_ANCHOR,
	CONTROL_DURATION_MS,
	CONTROL_MAX_MS,
	SLOWMO_CHARGE_PER_BAND,
	SLOWMO_DURATION_MS,
	SLOWMO_FACTOR,
	SLOWMO_MIN_CHARGE,
	STEER_PER_FILE
} from '$game/config';
import { engineForTier, tierFor, tierLabel } from '$game/difficulty';
import { engineForFloor, floorByNumber, type TowerFloor } from '$game/levels';
import { liftForMove, type LiftMove } from '$game/lift';
import { MAX_STARS, starsForHeight, summitFor, type Stars } from '$game/summit';
import {
	LEVELS_PER_STAGE,
	levelsUntilNextStage,
	stageForLevel,
	type StageConfig
} from '$game/stages';
import { themeForStage, themeForWing, type TerrainTheme } from '$game/world/themes';
import { LEVELS_PER_COMBO_STEP, MAX_COMBO_MULTIPLIER } from '$game/config';
import { log } from '$lib/diagnostics';
import { Input, isTouchDevice } from './engine/Input';
import { Loop } from './engine/Loop';
import { Surface } from './engine/Surface';
import { prewarmTextures } from './render/painters';
import { renderWorld } from './render/renderer';
import { NinjaSprites } from './render/sprites';
import { Lava } from './world/Lava';
import {
	DOUBLE_JUMP_VELOCITY,
	JUMP_VELOCITY,
	Player,
	PLAYER_HEIGHT,
	RUN_SPEED
} from './world/Player';
import type { RivalClimber } from './render/renderer';
import { BAND_HEIGHT, overlaps } from './world/types';

/** Acceleration towards, and away from, the run speed (px/s²). See handleMovement. */
const ACCEL_RUN = 2600;
const ACCEL_STOP = 4200;
import { GROUND_INSET, World } from './world/World';

export type GameMode = 'tower' | 'endless' | 'match';

export interface StartOptions {
	mode: GameMode;
	floor?: number;
}

/** Everything the UI needs to render the HUD, published every frame. */
export interface HudState {
	mode: GameMode;
	score: number;
	stageName: string;
	stageProgress: number;
	floorLabel: string | null;
	combo: number;
	gamesWon: number;
	tierLabel: string;
	controlRemaining: number;
	controlFraction: number;
	slowCharge: number;
	slowActive: boolean;
	slowRemaining: number;
	danger: number;
	altitude: number;
	/** Bands to take the floor by height alone. 0 outside the tower. */
	/** True while the climber is still on the starting ground. */
	onGround: boolean;
	summit: number;
	/** How far up the summit the climber is, 0–1. */
	summitProgress: number;
	/** Stars banked by height so far. */
	stars: Stars;
}

export interface RunOutcome {
	mode: GameMode;
	floor?: number;
	result: number;
	reason: string;
	score: number;
	stageName: string;
	stagesCleared: number;
	movesPlayed: number;
	gamesWon: number;
	tier: number;
	abandoned?: boolean;
	/** Stars earned on a tower floor, 0–3. */
	stars?: Stars;
	/** True when the floor was taken by reaching the summit rather than by chess. */
	bySummit?: boolean;
}

export interface Toast {
	id: number;
	text: string;
	tone: 'gold' | 'good' | 'bad' | 'cool';
}

export interface Banner {
	kicker: string;
	title: string;
	accent: string;
}

export interface GameCallbacks {
	onHud(state: HudState): void;
	onToast(toast: Toast): void;
	onBanner(banner: Banner | null): void;
	onEnd(outcome: RunOutcome): void;
	/** Ask the chess side to deal a position at a given engine strength. */
	loadPosition(detail: { fen?: string; engine?: unknown }): void;
	configureEngine(settings: unknown): void;
	removePiece(): void;
	restorePiece(): void;
	clearSpikesRequested(): void;
	setBoardSlowMotion(active: boolean): void;
	/** Tell the match server how high we are. Absent outside a race. */
	reportHeight?(bands: number): void;
}

/**
 * A run of the platformer.
 *
 * Replaces the old engine-framework scene. Everything the UI shows is pushed out
 * through callbacks as plain data, so the HUD, banners and results are Svelte
 * components rather than hand-positioned canvas text — which is what makes the
 * whole thing responsive without any layout auditing.
 */
export class PlatformerGame {
	private surface: Surface;
	private input: Input;
	private loop: Loop;
	private sprites = new NinjaSprites();

	private world!: World;
	private player!: Player;
	private lava!: Lava;

	private mode: GameMode = 'endless';
	private floor?: TowerFloor;

	private stage: StageConfig = stageForLevel(0);
	private theme: TerrainTheme = themeForStage(1);

	private score = 0;
	private maxBand = 0;
	private cleanStreak = 0;
	private combo = 1;
	private stagesCleared = 0;
	private gamesWon = 0;
	private tier = 1;
	private movesBanked = 0;
	/** Bands to the summit of the current floor; 0 when there is no summit. */
	private summit = 0;
	/** Highest star mark already announced, so each is celebrated once. */
	private starsShown = 0;

	/**
	 * Rivals in a race, keyed by seat.
	 *
	 * Their heights arrive a few times a second, so the drawn position is eased
	 * towards the reported one rather than snapped to it — at five updates a
	 * second a snap reads as teleporting, and the race is about relative
	 * position, which smoothing preserves exactly.
	 */
	private rivals = new Map<string, RivalClimber & { targetY: number }>();
	/** How often to tell the server where we are, in simulated milliseconds. */
	private lastHeightReport = 0;
	/** Hue for our own climber in a race; 0 leaves the sprite's own green. */
	private playerHue = 0;

	private controlUntil = 0;
	private slowCharge = 0;
	private slowUntil = 0;

	/** How to tell the player to spend slow motion, in their own input language. */
	private readonly slowHint = isTouchDevice() ? 'tap ◑' : 'Q';

	private cameraY = 0;
	private ended = false;
	private completing = false;
	private toastId = 0;
	private lastDrawWarning = -Infinity;

	constructor(
		private readonly container: HTMLElement,
		private readonly callbacks: GameCallbacks
	) {
		this.surface = new Surface(container, (w, h) => this.onResize(w, h));
		this.input = new Input(container);
		this.loop = new Loop({
			update: (step) => this.update(step),
			render: (alpha) => this.render(alpha)
		});
		prewarmTextures();
	}

	get inputHandle() {
		return this.input;
	}

	async start(options: StartOptions) {
		await this.sprites.load();

		this.mode = options.mode;
		this.floor = options.floor ? floorByNumber(options.floor) : undefined;

		this.score = 0;
		this.maxBand = 0;
		this.cleanStreak = 0;
		this.combo = 1;
		this.stagesCleared = 0;
		this.gamesWon = 0;
		this.tier = 1;
		this.movesBanked = 0;
		this.controlUntil = 0;
		this.slowCharge = 0;
		this.slowUntil = 0;
		this.ended = false;
		this.completing = false;
		this.loop.timeScale = 1;
		this.loop.simTime = 0;

		this.stage = stageForLevel(0);
		this.theme = this.themeForLevel(0);
		this.summit = this.floor ? summitFor(this.floor) : 0;
		this.starsShown = 0;

		const { width, height } = this.surface;
		const baseline = height;

		this.world = new World(width, baseline, this.floor?.rules ?? {}, (level) =>
			this.themeForLevel(level)
		);
		this.world.ensureGenerated(0);

		this.player = new Player(width / 2 - 17, baseline - GROUND_INSET - PLAYER_HEIGHT - 4);
		this.lava = new Lava(this.floor ? this.floor.lavaSpeed : 10, baseline, height);
		this.cameraY = this.player.y - height * CAMERA_ANCHOR;

		if (this.floor) {
			this.callbacks.loadPosition({ fen: this.floor.fen, engine: engineForFloor(this.floor) });
			this.callbacks.onBanner({
				kicker: `FLOOR ${this.floor.floor}`,
				title: this.floor.name,
				accent: '#f6e2a0'
			});
			setTimeout(() => this.callbacks.onBanner(null), 2200);
		} else {
			this.tier = tierFor(this.stage.index, this.gamesWon);
			this.callbacks.loadPosition({ engine: engineForTier(this.tier) });
		}

		log.info('run', `Run started: ${this.mode}`, {
			floor: this.floor?.floor,
			floorName: this.floor?.name,
			view: `${Math.round(width)}x${Math.round(height)}`
		});

		this.loop.start();
		this.publishHud();
	}

	destroy() {
		this.loop.stop();
		this.input.destroy();
		this.surface.destroy();
	}

	private themeForLevel(level: number): TerrainTheme {
		if (this.floor) return themeForWing(this.floor.wing);
		return themeForStage(stageForLevel(level).index);
	}

	private onResize(width: number, height: number) {
		if (!this.world) return;
		this.world.resize(width);
		this.lava.setViewHeight(height);
	}

	// ── Simulation ─────────────────────────────────────────────────────────

	private update(step: number) {
		if (this.ended) return;

		if (this.completing) {
			this.input.endStep();
			return;
		}

		this.handleAbilities();
		this.handleMovement(step);

		this.player.step(step, this.world.platforms, this.surface.width);
		this.player.updateAnimation();

		this.collectRunes();
		this.checkSpikes();
		this.updateClimb();

		if (this.lava.step(step, this.player.feetY)) {
			this.endRun('The lava took you.', 0);
			return;
		}

		this.updateSlowMotion();
		this.updateRivals(step);
		this.updateCamera();
		this.input.endStep();
		this.publishHud();
	}

	private handleAbilities() {
		if (this.input.consume('slow')) this.triggerSlowMotion();
	}

	private get controlActive() {
		return this.controlUntil > this.loop.simTime;
	}

	/**
	 * Keyboard and touch steering is entirely a gift of the control rune. Without
	 * one, the only input that does anything is the brake.
	 */
	private handleMovement(step: number) {
		if (!this.controlActive) {
			if (this.input.consume('brake')) this.player.vx = 0;
			// Drop-through stays available: it only ever moves you toward the lava.
			if (this.input.consume('drop') && this.player.onGround) {
				this.player.dropThroughMs = 260;
				this.player.vy = Math.max(this.player.vy, 70);
			}
			return;
		}

		const left = this.input.isHeld('left');
		const right = this.input.isHeld('right');
		const target = left && !right ? -RUN_SPEED : right && !left ? RUN_SPEED : 0;

		// Ease towards the target speed instead of snapping to it. A thumb drag is
		// a continuous gesture, and a climber that jumped instantly between full
		// speed and a dead stop read as jittery against it — the finger moves
		// smoothly, so the frog should too. Stopping is quicker than starting, so
		// letting go still feels like a brake rather than a coast.
		const rate = target === 0 ? ACCEL_STOP : ACCEL_RUN;
		const delta = target - this.player.vx;
		const maxChange = rate * step;
		this.player.vx += Math.abs(delta) <= maxChange ? delta : Math.sign(delta) * maxChange;

		if (this.input.consume('jump')) {
			if (this.player.onGround) {
				this.player.launch(JUMP_VELOCITY);
			} else if (!this.player.hasDoubleJumped) {
				this.player.hasDoubleJumped = true;
				this.player.launch(DOUBLE_JUMP_VELOCITY);
			}
		}

		if (this.input.consume('drop') && this.player.onGround) {
			this.player.dropThroughMs = 260;
			this.player.vy = Math.max(this.player.vy, 70);
		}
	}

	private collectRunes() {
		for (const rune of this.world.runes) {
			if (!rune.alive) continue;
			if (
				!overlaps(
					this.player.x,
					this.player.y,
					this.player.width,
					this.player.height,
					rune.x,
					rune.baseY - 10,
					rune.size,
					rune.size + 20
				)
			)
				continue;

			rune.alive = false;

			const remaining = Math.max(0, this.controlUntil - this.loop.simTime);
			const banked = Math.min(remaining + CONTROL_DURATION_MS, CONTROL_MAX_MS);
			const gained = banked - remaining;
			this.controlUntil = this.loop.simTime + banked;

			const seconds = (banked / 1000).toFixed(0);
			this.toast(
				gained < CONTROL_DURATION_MS
					? `Control maxed — ${seconds}s`
					: remaining > 0
						? `Control +5s — ${seconds}s`
						: 'Control — 5s',
				'gold'
			);
		}
	}

	private checkSpikes() {
		for (const spike of this.world.spikes) {
			if (!spike.alive) continue;
			if (
				!overlaps(
					this.player.x,
					this.player.y,
					this.player.width,
					this.player.height,
					spike.x,
					spike.y,
					spike.size,
					spike.size
				)
			)
				continue;

			spike.alive = false;
			log.info('climb', 'Spike hit', {
				at: `${Math.round(spike.x)},${Math.round(spike.y)}`,
				band: this.maxBand
			});
			this.callbacks.removePiece();
			this.cleanStreak = 0;
			this.combo = 1;
			this.toast('-1 piece', 'bad');
		}
	}

	private updateClimb() {
		const band = Math.floor((this.surface.height - this.player.feetY) / BAND_HEIGHT);
		if (band <= this.maxBand) {
			this.world.ensureGenerated(this.maxBand);
			return;
		}

		const gained = band - this.maxBand;
		const previousStage = this.stage.index;
		this.maxBand = band;

		for (let i = 0; i < gained; i++) {
			this.score += this.stage.pointsPerLevel * this.combo;
			this.cleanStreak += 1;
			this.advanceCombo();
		}

		const wasReady = this.slowCharge >= SLOWMO_MIN_CHARGE;
		this.slowCharge = Math.min(1, this.slowCharge + gained * SLOWMO_CHARGE_PER_BAND);
		if (!wasReady && this.slowCharge >= SLOWMO_MIN_CHARGE && this.slowUntil === 0) {
			this.toast(`Slow motion ready — ${this.slowHint}`, 'cool');
		}

		this.checkSummit();

		this.stage = stageForLevel(this.maxBand);
		if (this.stage.index > previousStage) this.onStageCleared(previousStage);

		this.world.ensureGenerated(this.maxBand);
		this.world.prune(this.player.feetY + this.surface.height * 2.5);
	}

	/**
	 * Height as a route to victory.
	 *
	 * Reaching the summit takes the floor outright — the same result as a
	 * checkmate, because out-climbing the position is meant to be a real
	 * alternative to out-playing it rather than a consolation.
	 */
	private checkSummit() {
		if (!this.summit || this.ended || this.completing) return;

		const stars = starsForHeight(this.maxBand, this.summit);
		while (this.starsShown < stars) {
			this.starsShown += 1;
			this.toast(
				this.starsShown >= MAX_STARS ? 'Summit ★★★' : `★ ${this.starsShown} of ${MAX_STARS}`,
				'gold'
			);
		}

		if (this.maxBand >= this.summit) {
			this.playFloorCompletion('You reached the summit.', 1, 0, true);
		}
	}

	private advanceCombo() {
		const target = Math.min(
			MAX_COMBO_MULTIPLIER,
			1 + Math.floor(this.cleanStreak / LEVELS_PER_COMBO_STEP)
		);
		if (target > this.combo) {
			this.combo = target;
			this.toast(`Combo x${this.combo}`, 'gold');
		}
	}

	private onStageCleared(previousStage: number) {
		this.stagesCleared += 1;
		this.theme = this.themeForLevel(this.maxBand);

		this.callbacks.onBanner({
			kicker: `STAGE ${this.stage.index}`,
			title: this.stage.name,
			accent: this.stage.accent
		});
		setTimeout(() => this.callbacks.onBanner(null), 1800);

		// The reward pays out on the chess board, not in the platformer.
		this.callbacks.restorePiece();

		const bonus = previousStage * 50 * this.combo;
		this.score += bonus;
		this.toast(`+${bonus} stage bonus`, 'good');

		if (this.mode === 'endless') this.refreshTier();
	}

	private refreshTier() {
		const next = tierFor(this.stage.index, this.gamesWon);
		if (next === this.tier) return;
		this.tier = next;
		this.callbacks.configureEngine(engineForTier(this.tier));
		this.toast(`The engine sharpens — ${tierLabel(this.tier)}`, 'cool');
	}

	private updateSlowMotion() {
		if (this.slowUntil === 0) return;
		if (this.slowUntil > this.loop.simTime) return;

		this.slowUntil = 0;
		this.loop.timeScale = 1;
		this.callbacks.setBoardSlowMotion(false);
		this.toast('Back to speed', 'cool');
	}

	private triggerSlowMotion() {
		if (this.slowUntil !== 0 || this.slowCharge < SLOWMO_MIN_CHARGE) return;

		this.slowUntil =
			this.loop.simTime + SLOWMO_DURATION_MS * this.slowCharge * SLOWMO_FACTOR;
		this.slowCharge = 0;
		this.loop.timeScale = SLOWMO_FACTOR;
		this.callbacks.setBoardSlowMotion(true);
		this.toast('Slow motion', 'cool');
	}

	/**
	 * Sets, or updates, where a rival is.
	 *
	 * Called from outside with a height in bands; the conversion to world space
	 * happens here because bands are the only unit the network layer knows.
	 */
	setRival(seat: string, name: string, hue: number, css: string, bands: number, lane: number) {
		// A height that is not a number would propagate through the eased position
		// as NaN and silently stop the climber drawing at all.
		const safeBands = Number.isFinite(bands) ? bands : 0;
		const y = this.surface.height - safeBands * BAND_HEIGHT;
		const existing = this.rivals.get(seat);
		// Lanes fan rivals out horizontally so five climbers at the same height do
		// not stack into one indistinguishable blob.
		const x = this.surface.width * (0.16 + 0.17 * (lane % 5));

		if (existing) {
			existing.targetY = y;
			existing.name = name;
			existing.x = x;
		} else {
			this.rivals.set(seat, { name, hue, css, x, y, targetY: y });
		}
	}

	/** Sets our own climber's colour, matching the seat the server gave us. */
	setPlayerColour(hue: number) {
		this.playerHue = hue;
	}

	removeRival(seat: string) {
		this.rivals.delete(seat);
	}

	private updateRivals(step: number) {
		for (const rival of this.rivals.values()) {
			// Ease towards the last reported height; see the field comment.
			rival.y += (rival.targetY - rival.y) * Math.min(1, step * 6);
		}

		if (this.loop.simTime - this.lastHeightReport >= 200) {
			this.lastHeightReport = this.loop.simTime;
			this.callbacks.reportHeight?.(this.maxBand);
		}
	}

	private updateCamera() {
		// Follows vertically only, easing so a big launch does not snap the view.
		const target = this.player.y - this.surface.height * CAMERA_ANCHOR;
		this.cameraY += (target - this.cameraY) * 0.12;
	}

	// ── Chess events ───────────────────────────────────────────────────────

	/** A move was played on the board: convert it into lift. */
	applyMove(move: LiftMove & { from: string; to: string; color: string }) {
		if (this.ended || this.completing) return;
		if (move.color !== 'w') return;

		const { lift, reasons } = liftForMove(move);
		if (this.player.vy > -lift) this.player.launch(-lift);

		const dx = String(move.to).charCodeAt(0) - String(move.from).charCodeAt(0);
		this.player.vx = dx * STEER_PER_FILE;

		if (reasons.length) this.toast(reasons.join(' · '), 'gold');
	}

	enPassant() {
		const cleared = this.world.clearSpikesInView(
			this.cameraY,
			this.cameraY + this.surface.height
		);
		if (cleared > 0) this.toast(`En passant — ${cleared} spike${cleared > 1 ? 's' : ''} cleared`, 'gold');
	}

	drawRisk(message: string) {
		if (this.loop.simTime - this.lastDrawWarning < 6000) return;
		this.lastDrawWarning = this.loop.simTime;
		this.toast(message, 'bad');
	}

	/** The chess game finished. */
	gameOver(detail: { reason: string; result: number }, movesPlayed: number) {
		if (this.ended || this.completing) return;

		// A duel's results belong to the server: it decides the fling, the
		// handicap and the next position, and a client dealing its own would put
		// the two boards out of step immediately.
		if (this.mode === 'match') {
			if (detail.result === 1) {
				this.gamesWon += 1;
				this.player.launch(-2000);
			}
			return;
		}

		if (this.mode === 'tower') {
			if (detail.result >= 0.5) this.playFloorCompletion(detail.reason, detail.result, movesPlayed);
			else this.endRun(detail.reason, detail.result, false, movesPlayed);
			return;
		}

		if (detail.result === 0) {
			this.endRun(detail.reason, 0, false, movesPlayed);
			return;
		}

		this.movesBanked += movesPlayed;

		if (detail.result === 1) {
			this.gamesWon += 1;
			this.player.launch(-2000);
			this.callbacks.onBanner({
				kicker: 'CHECKMATE',
				title: `Game ${this.gamesWon} won`,
				accent: '#f6e2a0'
			});
			setTimeout(() => this.callbacks.onBanner(null), 1800);

			const bonus = 500 * this.gamesWon;
			this.score += bonus;
			this.toast(`+${bonus} victory bonus`, 'good');
		} else {
			this.toast('Drawn — a new game is dealt', 'cool');
		}

		this.tier = tierFor(this.stage.index, this.gamesWon);
		this.callbacks.loadPosition({ engine: engineForTier(this.tier) });
	}

	/**
	 * The server dealt a new game.
	 *
	 * In a duel the board is reloaded by the match wiring, not by us — this only
	 * needs to keep the climb's own bookkeeping in step.
	 */
	matchGameDealt() {
		this.gamesWon += 0; // bookkeeping only; the climb itself never resets
		this.callbacks.onBanner({ kicker: 'NEW GAME', title: 'The board is reset', accent: '#f6e2a0' });
		setTimeout(() => this.callbacks.onBanner(null), 1500);
	}

	/** The server ended the match. Its word is final, whatever the local climb thinks. */
	matchOver(reason: string, result: number) {
		if (this.ended) return;
		this.endRun(reason, result, false, 0);
	}

	/** Player pressed the exit. */
	leave(movesPlayed: number) {
		this.endRun(
			this.floor ? 'You left the floor unfinished.' : 'You left the climb of your own accord.',
			0.5,
			true,
			movesPlayed
		);
	}

	/**
	 * The send-off when a tower floor is cleared: the tower opens up above the
	 * climber and carries them into the next floor, rather than cutting straight
	 * to a results screen.
	 */
	private playFloorCompletion(
		reason: string,
		result: number,
		movesPlayed: number,
		bySummit = false
	) {
		this.completing = true;
		this.world.seal(this.player.y + 40);
		this.player.scripted = true;
		this.player.vx = 0;
		this.player.vy = 0;

		this.callbacks.onBanner({
			kicker: bySummit ? 'SUMMIT REACHED' : 'FLOOR CLEARED',
			title: this.floor?.name ?? '',
			accent: '#f6e2a0'
		});

		const startY = this.player.y;
		const rise = this.surface.height * 1.6;
		const durationMs = 2200;
		const startedAt = performance.now();

		const lift = () => {
			const t = Math.min(1, (performance.now() - startedAt) / durationMs);
			// Ease in: a slow lift that gathers pace as the tower opens up.
			const eased = t * t;
			this.player.prevY = this.player.y;
			this.player.y = startY - rise * eased;
			this.cameraY = this.player.y - this.surface.height * CAMERA_ANCHOR;

			if (t < 1) {
				requestAnimationFrame(lift);
			} else {
				this.callbacks.onBanner(null);
				this.endRun(reason, result, false, movesPlayed, bySummit);
			}
		};
		requestAnimationFrame(lift);
	}

	private endRun(
		reason: string,
		result: number,
		abandoned = false,
		movesPlayed = 0,
		bySummit = false
	) {
		if (this.ended) return;
		this.ended = true;
		this.loop.stop();
		this.callbacks.onBanner(null);

		const score =
			this.mode === 'tower' && result === 1 && !abandoned
				? Math.round(this.score * 2)
				: Math.round(this.score);

		this.callbacks.onEnd({
			mode: this.mode,
			floor: this.floor?.floor,
			result,
			reason,
			score,
			stageName: this.stage.name,
			stagesCleared: this.stagesCleared,
			movesPlayed: this.movesBanked + movesPlayed,
			gamesWon: this.gamesWon,
			tier: this.tier,
			abandoned,
			stars: this.awardedStars(result, abandoned, bySummit),
			bySummit
		});
	}

	/**
	 * Stars to bank for this attempt.
	 *
	 * A checkmate is worth all three whatever the altitude: the victory fling
	 * carries the climber to the top anyway, and making the player watch an
	 * animation to collect stars they have already earned is ceremony. Anything
	 * else — a draw, or walking away — banks the height actually reached, which
	 * is what makes climbing worth doing in a position that is already winning.
	 */
	private awardedStars(result: number, abandoned: boolean, bySummit: boolean): Stars {
		if (!this.summit) return 0;
		if (bySummit) return MAX_STARS as Stars;
		if (result === 1 && !abandoned) return MAX_STARS as Stars;
		return starsForHeight(this.maxBand, this.summit);
	}

	// ── Output ─────────────────────────────────────────────────────────────

	private toast(text: string, tone: Toast['tone']) {
		this.callbacks.onToast({ id: ++this.toastId, text, tone });
	}

	private publishHud() {
		const controlRemaining = Math.max(0, this.controlUntil - this.loop.simTime);
		const slowRemaining = Math.max(0, this.slowUntil - this.loop.simTime);

		this.callbacks.onHud({
			mode: this.mode,
			score: Math.round(this.score),
			stageName: this.stage.name,
			stageProgress: 1 - levelsUntilNextStage(this.maxBand) / LEVELS_PER_STAGE,
			floorLabel: this.floor ? `${this.floor.floor} · ${this.floor.name}` : null,
			combo: this.combo,
			gamesWon: this.gamesWon,
			tierLabel: tierLabel(this.tier),
			controlRemaining,
			controlFraction: controlRemaining / CONTROL_MAX_MS,
			slowCharge: this.slowCharge,
			slowActive: slowRemaining > 0,
			slowRemaining,
			danger: this.lava.proximity(this.player.feetY),
			altitude: Math.min(1, this.maxBand / 45),
			onGround: this.player.onGround && this.maxBand === 0,
			summit: this.summit,
			summitProgress: this.summit ? Math.min(1, this.maxBand / this.summit) : 0,
			stars: this.summit ? starsForHeight(this.maxBand, this.summit) : 0
		});
	}

	private render(alpha: number) {
		this.surface.beginFrame();
		renderWorld(
			this.surface.ctx,
			this.surface.width,
			this.surface.height,
			this.world,
			this.player,
			this.lava,
			this.sprites,
			{
				playerHue: this.playerHue,
				rivals: this.rivals.size ? [...this.rivals.values()] : undefined,
				cameraY: this.cameraY,
				theme: this.theme,
				altitude: Math.min(1, this.maxBand / 45),
				simTime: this.loop.simTime,
				danger: this.lava.proximity(this.player.feetY),
				slowMotion: this.slowUntil > 0
			},
			alpha
		);
	}
}
