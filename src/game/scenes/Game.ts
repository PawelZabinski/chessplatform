import { Scene } from 'phaser';
import { ChessEvents, EventBus } from '../EventBus';
import { chessState, moves } from '$lib/stores/chess';
import {
	CONTROL_DURATION_MS,
	CONTROL_DOUBLE_JUMP_VELOCITY,
	CONTROL_JUMP_VELOCITY,
	CONTROL_MAX_MS,
	CONTROL_RUN_SPEED,
	LEVEL_HEIGHT,
	LEVELS_PER_COMBO_STEP,
	MAX_COMBO_MULTIPLIER,
	PLAYER_BOUNCE,
	PLAYER_GRAVITY_Y,
	PLAYER_MAX_VELOCITY_X,
	PLAYER_MAX_VELOCITY_Y,
	SLOWMO_CHARGE_PER_BAND,
	SLOWMO_DURATION_MS,
	SLOWMO_FACTOR,
	SLOWMO_MIN_CHARGE,
	STEER_PER_FILE,
	VICTORY_FLING_VELOCITY
} from '../config';
import { LEVELS_PER_STAGE, levelsUntilNextStage, stageForLevel, type StageConfig } from '../stages';
import { engineForTier, tierFor, tierLabel } from '../difficulty';
import { engineForFloor, floorByNumber, type TowerFloor } from '../levels';
import { liftForMove, type LiftMove } from '../lift';
import { Lava } from '../world/Lava';
import { PlatformField } from '../world/PlatformField';
import { createAllTerrainTextures, skyKey, wallKey, SKYLINE_KEY, STAR_KEY } from '../world/textures';
import { themeForStage, themeForWing, type TerrainTheme } from '../world/themes';
import { FONT_BODY, FONT_DISPLAY, GOLD_BRIGHT, INK, INK_SOFT, PALETTE, PARCHMENT } from '../theme';

export type GameMode = 'tower' | 'endless';

export interface GameSceneData {
	mode: GameMode;
	/** Tower mode only. */
	floor?: number;
}

/** How a run finished, handed to the GameOver scene. */
export interface RunOutcome {
	mode: GameMode;
	floor?: number;
	/** 1 = white wins, 0.5 = draw, 0 = white loses. */
	result: number;
	reason: string;
	score: number;
	stageName: string;
	stagesCleared: number;
	movesPlayed: number;
	/** Endless: chess games won before the run ended. */
	gamesWon: number;
	/** Endless: engine strength reached. */
	tier: number;
	/**
	 * The player left of their own accord. A tower floor abandoned this way must
	 * not be recorded as cleared, however far up the climb got.
	 */
	abandoned?: boolean;
}

export class Game extends Scene {
	private mode: GameMode = 'endless';
	private towerFloor?: TowerFloor;

	/** Endless: chess games won so far, and the engine tier that implies. */
	private gamesWon = 0;
	private tier = 1;
	private totalMovesPlayed = 0;

	private worldWidth = 1024;
	private worldHeight = 768;

	private field!: PlatformField;
	private lava!: Lava;
	private skyBackdrop!: Phaser.GameObjects.Image;
	private skyFade!: Phaser.GameObjects.Image;
	private starLayer!: Phaser.GameObjects.TileSprite;
	private skyline!: Phaser.GameObjects.TileSprite;
	private leftWall!: Phaser.GameObjects.TileSprite;
	private rightWall!: Phaser.GameObjects.TileSprite;
	private motes?: Phaser.GameObjects.Particles.ParticleEmitter;
	private theme!: TerrainTheme;
	private player!: Phaser.Physics.Arcade.Sprite;
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private wasd!: Record<'up' | 'left' | 'right' | 'down' | 'jump', Phaser.Input.Keyboard.Key>;
	/** Scene time until which the player falls through pass-through platforms. */
	private dropThroughUntil = 0;

	private currentLevel = 0;
	private maxLevel = 0;
	private highestLevelGenerated = 0;
	private hasDoubleJumped = false;
	private currentAnimKey: string | null = null;
	private runEnded = false;

	private stage!: StageConfig;
	private score = 0;
	private cleanLevelStreak = 0;
	private comboMultiplier = 1;
	private stagesCleared = 0;

	private controlUntil = 0;

	/**
	 * Current simulation speed. 1 normally, SLOWMO_FACTOR while the slow-motion
	 * ability is running. Scales the whole simulation rather than the visuals, so
	 * balance is untouched — a capture still lifts you the same number of bands.
	 */
	private gameSpeed = 1;

	/** Slow-motion ability: charge in 0..1, and how long it has left. */
	private slowCharge = 0;
	private slowMotionUntil = 0;
	private slowKey!: Phaser.Input.Keyboard.Key;
	private slowBar!: Phaser.GameObjects.Rectangle;
	private slowBarBg!: Phaser.GameObjects.Rectangle;
	private slowLabel!: Phaser.GameObjects.Text;
	private readonly slowBarWidth = 150;
	/**
	 * Simulated milliseconds elapsed. Phaser's clock keeps running in real time
	 * regardless of timeScale, so anything measured in game time (the rune timer,
	 * the drop-through window) has to be tracked against this instead.
	 */
	private simNow = 0;
	/** Simulated time of the last draw warning, to throttle repeats. */
	private lastDrawWarningAt = -Infinity;

	private scoreValueText!: Phaser.GameObjects.Text;
	private stageValueText!: Phaser.GameObjects.Text;
	private stageProgressBar!: Phaser.GameObjects.Rectangle;
	private comboText!: Phaser.GameObjects.Text;
	private gamesWonText?: Phaser.GameObjects.Text;
	private tierText?: Phaser.GameObjects.Text;
	private controlBar!: Phaser.GameObjects.Rectangle;
	private controlBarBg!: Phaser.GameObjects.Rectangle;
	private controlLabel!: Phaser.GameObjects.Text;
	private readonly stageProgressWidth = 240;
	private readonly controlBarWidth = 150;
	/** Y below which transient overlays may draw without hitting the HUD. */
	private hudBottom = 140;

	/**
	 * Everything pinned to the viewport lives here, so a resize can rebuild the
	 * whole HUD in one go rather than repositioning each piece.
	 */
	private hudLayer!: Phaser.GameObjects.Container;
	/** On-screen controls, built only when the device is touch-driven. */
	private touchLayer?: Phaser.GameObjects.Container;
	private touchState = { left: false, right: false, jump: false, down: false };

	constructor() {
		super('Game');
	}

	init(data: GameSceneData) {
		this.mode = data.mode ?? 'endless';
		this.towerFloor = data.floor ? floorByNumber(data.floor) : undefined;
	}

	preload() {
		// Only the authored sprites are loaded; terrain and sky are drawn in code.
		this.load.spritesheet('spike', 'assets/Spike.png', { frameWidth: 54, frameHeight: 52 });
		this.load.spritesheet('ninjaIdle', 'assets/IdleNinja.png', { frameWidth: 32, frameHeight: 32 });
		this.load.spritesheet('ninjaRun', 'assets/RunNinja.png', { frameWidth: 32, frameHeight: 32 });
		this.load.spritesheet('ninjaJump', 'assets/JumpNinja.png', { frameWidth: 32, frameHeight: 32 });
		this.load.spritesheet('ninjaDouble', 'assets/DoubleJumpNinja.png', {
			frameWidth: 32,
			frameHeight: 32
		});
	}

	create() {
		this.worldWidth = this.scale.width;
		this.worldHeight = this.scale.height;

		this.resetRunState();
		this.theme = this.themeForLevel(0);
		this.createAnimations();
		this.drawSky();

		this.field = new PlatformField(
			this,
			this.worldWidth,
			this.worldHeight,
			this.towerFloor?.rules ?? {},
			(level) => this.themeForLevel(level)
		);
		for (let i = 1; i <= 10; i++) this.field.buildLevel(i);
		this.highestLevelGenerated = 10;

		this.createPlayer();
		this.lava = new Lava(
			this,
			this.worldWidth,
			this.worldHeight,
			this.towerFloor ? this.towerFloor.lavaSpeed : 10
		);

		this.createInput();
		this.buildHud();
		this.buildTouchControls();

		// Orientation changes and window resizes must not leave the HUD stranded.
		this.scale.on('resize', this.onResize, this);
		this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));

		if (this.towerFloor) {
			this.startTowerFloor(this.towerFloor);
		} else {
			this.startEndlessRun();
		}

		this.bindChessEvents();
		EventBus.emit('current-scene-ready', this);
	}

	/**
	 * Applies a simulation speed to the whole scene.
	 *
	 * Arcade physics reads timeScale inversely — larger means slower — while
	 * tweens and animations take the fraction directly. Our own systems are fed a
	 * scaled delta in update(), which covers the lava and the climb.
	 */
	private applyGameSpeed(speed: number) {
		this.gameSpeed = speed;

		this.physics.world.timeScale = 1 / speed;
		this.tweens.timeScale = speed;
		this.time.timeScale = speed;
		this.anims.globalTimeScale = speed;
	}

	private get slowMotionActive() {
		return this.slowMotionUntil > this.simNow;
	}

	/**
	 * Spends the charge meter to enter slow-motion. The board slows with the
	 * world: the player's move takes a long beat to resolve, and the opponent
	 * only replies once it has, which is where the thinking time comes from.
	 */
	private triggerSlowMotion() {
		if (this.slowMotionActive || this.slowCharge < SLOWMO_MIN_CHARGE) return;

		this.slowMotionUntil = this.simNow + SLOWMO_DURATION_MS * this.slowCharge * SLOWMO_FACTOR;
		this.slowCharge = 0;

		this.applyGameSpeed(SLOWMO_FACTOR);
		EventBus.emit(ChessEvents.slowMotion, true);
		this.cameras.main.flash(260, 150, 190, 240, false);
		this.flashMessage('SLOW MOTION', '#a9d4f5');
	}

	private endSlowMotion() {
		this.slowMotionUntil = 0;
		this.applyGameSpeed(1);
		EventBus.emit(ChessEvents.slowMotion, false);
		this.flashMessage('BACK TO SPEED', '#8fa8c8');
	}

	private resetRunState() {
		this.currentLevel = 0;
		this.maxLevel = 0;
		this.highestLevelGenerated = 0;
		this.hasDoubleJumped = false;
		this.currentAnimKey = null;
		this.runEnded = false;
		this.controlUntil = 0;
		this.dropThroughUntil = 0;
		this.simNow = 0;
		this.lastDrawWarningAt = -Infinity;
		this.slowCharge = 0;
		this.slowMotionUntil = 0;
		this.applyGameSpeed(1);
		this.stage = stageForLevel(0);
		this.score = 0;
		this.cleanLevelStreak = 0;
		this.comboMultiplier = 1;
		this.stagesCleared = 0;
		this.gamesWon = 0;
		this.tier = 1;
		this.totalMovesPlayed = 0;
	}

	/** Endless starts at the gentlest engine tier and sharpens as you climb. */
	private startEndlessRun() {
		this.tier = tierFor(this.stage.index, this.gamesWon);
		EventBus.emit(ChessEvents.loadPosition, { engine: engineForTier(this.tier) });
	}

	/**
	 * Endless difficulty tracks both altitude and games won, so it is re-evaluated
	 * whenever either changes. Only the engine is reconfigured — the position in
	 * progress is left alone.
	 */
	private refreshEndlessTier() {
		if (this.mode !== 'endless') return;

		const next = tierFor(this.stage.index, this.gamesWon);
		if (next === this.tier) return;

		this.tier = next;
		EventBus.emit(ChessEvents.configureEngine, engineForTier(this.tier));
		this.flashMessage(`THE ENGINE SHARPENS — ${tierLabel(this.tier).toUpperCase()}`, '#c9a7f0');
	}

	/** Loads the floor's position and engine strength, then announces it. */
	private startTowerFloor(floor: TowerFloor) {
		EventBus.emit(ChessEvents.loadPosition, { fen: floor.fen, engine: engineForFloor(floor) });

		this.showBanner(`FLOOR ${floor.floor}`, floor.name, GOLD_BRIGHT);

		if (floor.teaches) {
			this.time.delayedCall(1600, () => this.showTeachingCard(floor.teaches!));
		}
	}

	/**
	 * Which stone a given altitude band is built from. The Tower uses its wing's
	 * theme throughout; Endless cycles themes with the stages, so a long run keeps
	 * changing character and the boundaries show as seams in the masonry.
	 */
	private themeForLevel(level: number): TerrainTheme {
		if (this.towerFloor) return themeForWing(this.towerFloor.wing);
		return themeForStage(stageForLevel(level).index);
	}

	/**
	 * Backdrop: themed gradient, star and skyline parallax, and the tower's own
	 * side walls. The walls are what make the climb read as the inside of a
	 * shaft rather than open sky.
	 *
	 * `skyFade` sits over `skyBackdrop` and is cross-faded when the theme
	 * changes, so Endless slides between sections instead of cutting.
	 */
	private drawSky() {
		createAllTerrainTextures(this);

		const sky = skyKey(this.theme);
		this.skyBackdrop = this.add
			.image(0, 0, sky)
			.setOrigin(0, 0)
			.setDisplaySize(this.worldWidth, this.worldHeight)
			.setScrollFactor(0)
			.setDepth(-30);
		this.skyFade = this.add
			.image(0, 0, sky)
			.setOrigin(0, 0)
			.setDisplaySize(this.worldWidth, this.worldHeight)
			.setScrollFactor(0)
			.setDepth(-29)
			.setAlpha(0);

		this.starLayer = this.add
			.tileSprite(0, 0, this.worldWidth, this.worldHeight, STAR_KEY)
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(-28)
			.setAlpha(0);

		this.skyline = this.add
			.tileSprite(0, this.worldHeight - 210, this.worldWidth, 180, SKYLINE_KEY)
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(-27)
			.setAlpha(0.75);

		// Side walls of the shaft. Their tile offset follows the camera, so the
		// masonry streams past as the player climbs.
		const wall = wallKey(this.theme);
		const wallWidth = 96;
		this.leftWall = this.add
			.tileSprite(0, 0, wallWidth, this.worldHeight, wall)
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(-20);
		this.rightWall = this.add
			.tileSprite(this.worldWidth - wallWidth, 0, wallWidth, this.worldHeight, wall)
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(-20)
			.setFlipX(true);

		// Slow drift of dust or embers, tinted per theme.
		if (this.textures.exists('mote')) {
			this.motes = this.add.particles(0, 0, 'mote', {
				x: { min: 0, max: this.worldWidth },
				y: { min: 0, max: this.worldHeight },
				lifespan: 6000,
				speedY: { min: -26, max: -8 },
				speedX: { min: -12, max: 12 },
				scale: { start: 0.9, end: 0 },
				alpha: { start: 0.5, end: 0 },
				frequency: 260,
				quantity: 1,
				blendMode: 'ADD'
			});
			this.motes.setScrollFactor(0).setDepth(-15);
			this.motes.setParticleTint(
				Phaser.Display.Color.HexStringToColor(this.theme.mote).color
			);
		}
	}

	/** Parallax, altitude tinting, and the cross-fade between themes. */
	private updateSky() {
		const scrollY = this.cameras.main.scrollY;

		this.starLayer.tilePositionY = scrollY * 0.12;
		this.skyline.tilePositionX = scrollY * 0.02;
		// Walls scroll close to 1:1 so the shaft feels solid around the player.
		this.leftWall.tilePositionY = scrollY * 0.85;
		this.rightWall.tilePositionY = scrollY * 0.85;

		const altitude = Phaser.Math.Clamp(this.maxLevel / 45, 0, 1);
		this.starLayer.setAlpha(Math.max(this.theme.starAlpha, altitude));
		this.skyline.setAlpha(0.75 * (1 - altitude));
		this.skyline.y = this.worldHeight - 210 + Math.max(0, scrollY * 0.04);
	}

	/**
	 * Swaps the terrain theme when Endless enters a new stage. The sky and walls
	 * cross-fade; already-generated bands keep the stone they were built from.
	 */
	private applyTheme(next: TerrainTheme) {
		if (next.id === this.theme.id) return;
		this.theme = next;

		this.skyFade.setTexture(skyKey(next)).setAlpha(0);
		this.tweens.add({
			targets: this.skyFade,
			alpha: 1,
			duration: 1200,
			onComplete: () => {
				this.skyBackdrop.setTexture(skyKey(next));
				this.skyFade.setAlpha(0);
			}
		});

		[this.leftWall, this.rightWall].forEach((wall) => {
			this.tweens.add({
				targets: wall,
				alpha: 0,
				duration: 500,
				yoyo: true,
				onYoyo: () => wall.setTexture(wallKey(next))
			});
		});

		this.motes?.setParticleTint(Phaser.Display.Color.HexStringToColor(next.mote).color);
	}
	private createAnimations() {
		const define = (key: string, texture: string, end: number, frameRate: number) => {
			if (this.anims.exists(key)) return;
			this.anims.create({
				key,
				frames: this.anims.generateFrameNumbers(texture, { start: 0, end }),
				frameRate,
				repeat: -1
			});
		};

		define('ninja-idle', 'ninjaIdle', 10, 8);
		define('ninja-run', 'ninjaRun', 11, 14);
		define('ninja-jump', 'ninjaJump', 0, 1);
		define('ninja-double', 'ninjaDouble', 5, 16);
		define('spike-idle', 'spike', 3, 6);
	}

	private createPlayer() {
		this.player = this.physics.add.sprite(
			this.worldWidth / 2,
			this.worldHeight - 200,
			'ninjaIdle',
			0
		);
		this.player.setDisplaySize(64, 64);
		this.player.setBounce(PLAYER_BOUNCE);
		this.player.body.setGravityY(PLAYER_GRAVITY_Y);
		this.player.body.setMaxVelocity(PLAYER_MAX_VELOCITY_X, PLAYER_MAX_VELOCITY_Y);
		this.player.setCollideWorldBounds(true);
		this.player.body.setSize(20, 28);
		this.player.body.setOffset(6, 4);
		this.playAnimation('ninja-idle', false);

		const camera = this.cameras.main;
		camera.startFollow(this.player);
		// Only follow vertically; horizontal stays fixed to the play area.
		camera.setBounds(0, -10e6, this.worldWidth, 10e6 + this.worldHeight);

		this.physics.world.setBoundsCollision(true, true, false, true);
		this.physics.add.collider(
			this.player,
			this.field.platforms,
			undefined,
			(player, platform) => {
				const p = player as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
				const plat = platform as Phaser.Physics.Arcade.Image;

				// Stone is solid from every direction, including to a drop-through.
				if (plat.getData('blocked') === true) return true;

				// Holding down drops the player through wooden planks only.
				if (this.simNow < this.dropThroughUntil) return false;

				// Otherwise pass-through: only land when falling onto the top face.
				return p.body.velocity.y >= 0 && p.body.bottom <= plat.body.top + 10;
			},
			this
		);

		this.physics.add.overlap(this.player, this.field.spikes, this.onSpikeHit, undefined, this);
		this.physics.add.overlap(this.player, this.field.runes, this.onRunePickup, undefined, this);
	}

	private createInput() {
		this.cursors = this.input.keyboard!.createCursorKeys();
		const Key = Phaser.Input.Keyboard.KeyCodes;
		this.wasd = {
			up: this.input.keyboard!.addKey(Key.W),
			left: this.input.keyboard!.addKey(Key.A),
			right: this.input.keyboard!.addKey(Key.D),
			down: this.input.keyboard!.addKey(Key.S),
			jump: this.input.keyboard!.addKey(Key.SPACE)
		};
		// Q spends the slow-motion charge. Deliberately not shift: the board is a
		// DOM element outside the canvas, and a shift held over it used to be
		// doing double duty as both a board gesture and a game input.
		this.slowKey = this.input.keyboard!.addKey(Key.Q);
	}

	/**
	 * Down or S drops the player through a wooden plank. Unlike jumping this is
	 * not gated behind a control rune: it only ever moves you downward, toward
	 * the lava, so it is a corrective move rather than a climbing advantage.
	 */
	private updateDropThrough() {
		const pressed =
			Phaser.Input.Keyboard.JustDown(this.cursors.down) ||
			Phaser.Input.Keyboard.JustDown(this.wasd.down) ||
			this.consumeTouchDown();
		if (!pressed) return;

		const onGround = this.player.body.blocked.down || this.player.body.touching.down;
		if (!onGround) return;

		this.dropThroughUntil = this.simNow + 260;
		// A small nudge so the player actually separates from the platform.
		this.player.setVelocityY(Math.max(this.player.body.velocity.y, 70));
	}

	private bindChessEvents() {
		const onGameOver = (detail: { reason: string; result: number }) => {
			// A tower floor is a single position, so any result ends it.
			if (this.mode === 'tower') {
				this.endRun(detail.reason, detail.result);
				return;
			}

			// Endless only ends on a loss (or the End Run button). Winning flings
			// you skyward and deals a fresh game immediately.
			if (detail.result === 0) {
				this.endRun(detail.reason, 0);
				return;
			}

			this.onEndlessGameFinished(detail.result === 1);
		};
		const onDrawRisk = (risk: { kind: string; message: string }) => {
			// Throttled: a repetitive sequence would otherwise warn every move.
			if (this.simNow - this.lastDrawWarningAt < 6000) return;
			this.lastDrawWarningAt = this.simNow;
			this.flashMessage(risk.message.toUpperCase(), '#e0b0d8');
		};
		EventBus.on(ChessEvents.drawRisk, onDrawRisk);

		const onEnPassant = () => {
			const cleared = this.field.clearVisibleSpikes(this.cameras.main);
			if (cleared > 0) {
				this.flashMessage(`EN PASSANT — ${cleared} SPIKE${cleared > 1 ? 'S' : ''} CLEARED`, GOLD_BRIGHT);
			}
		};

		EventBus.on(ChessEvents.gameOver, onGameOver);
		EventBus.on(ChessEvents.enPassant, onEnPassant);

		const unsubscribe = moves.subscribe((list) => {
			if (!list.length) return;
			const move = list[list.length - 1];
			if (move.color !== 'w') return;
			this.applyMoveLift(move as LiftMove & { from: string; to: string });
		});

		this.events.once('shutdown', () => {
			EventBus.off(ChessEvents.gameOver, onGameOver);
			EventBus.off(ChessEvents.enPassant, onEnPassant);
			EventBus.off(ChessEvents.drawRisk, onDrawRisk);
			unsubscribe();
		});
	}

	/**
	 * Lift comes from what a move achieves, not how far up the board it travelled.
	 * Files still steer left and right.
	 */
	private applyMoveLift(move: LiftMove & { from: string; to: string }) {
		const { lift, reasons } = liftForMove(move);
		const desiredVy = -lift;

		const onGround = this.player.body.blocked.down || this.player.body.touching.down;
		if (this.player.body.velocity.y > desiredVy) {
			this.player.setVelocityY(desiredVy);
			if (onGround) {
				this.playAnimation('ninja-jump', false);
			} else {
				this.triggerDoubleJump();
			}
		}

		const dx = String(move.to).charCodeAt(0) - String(move.from).charCodeAt(0);
		this.player.setVelocityX(dx * STEER_PER_FILE);

		if (reasons.length > 0) {
			this.flashMessage(reasons.join('  ·  ').toUpperCase(), GOLD_BRIGHT);
		}
	}

	/**
	 * A chess game finished in Endless without losing. Winning launches the
	 * climber far up the tower and pays a bonus; a draw just resets the board.
	 * Either way a new game is dealt straight away and the run continues.
	 */
	private onEndlessGameFinished(won: boolean) {
		this.totalMovesPlayed += chessState.moveCount();

		if (won) {
			this.gamesWon += 1;

			this.player.setVelocityY(VICTORY_FLING_VELOCITY);
			this.triggerDoubleJump();
			this.cameras.main.flash(500, 255, 240, 190, false);
			this.showBanner('CHECKMATE', `Game ${this.gamesWon} won`, GOLD_BRIGHT);

			const bonus = 500 * this.gamesWon;
			this.score += bonus;
			this.time.delayedCall(700, () => this.flashMessage(`+${bonus} VICTORY BONUS`, '#7dd3a0'));
		} else {
			this.showBanner('DRAWN', 'A new game is dealt', '#c9a7f0');
		}

		this.tier = tierFor(this.stage.index, this.gamesWon);
		// Fresh standard position at the run's current engine strength.
		EventBus.emit(ChessEvents.loadPosition, { engine: engineForTier(this.tier) });
	}

	private onSpikeHit(_player: unknown, spike: unknown) {
		(spike as Phaser.Physics.Arcade.Sprite).destroy();
		EventBus.emit(ChessEvents.removePiece, 'w');

		this.cleanLevelStreak = 0;
		this.comboMultiplier = 1;
		this.cameras.main.shake(180, 0.006);
		this.flashMessage('-1 PIECE', '#ff8080');
	}

	/** Runes stack onto whatever time is left, capped at CONTROL_MAX_MS. */
	private onRunePickup(_player: unknown, rune: unknown) {
		(rune as Phaser.Physics.Arcade.Sprite).destroy();

		const remaining = Math.max(0, this.controlUntil - this.simNow);
		const banked = Math.min(remaining + CONTROL_DURATION_MS, CONTROL_MAX_MS);
		const gained = banked - remaining;
		this.controlUntil = this.simNow + banked;

		const seconds = (banked / 1000).toFixed(0);
		const label =
			gained < CONTROL_DURATION_MS
				? `CONTROL MAXED — ${seconds}s`
				: remaining > 0
					? `CONTROL +5s — ${seconds}s`
					: 'CONTROL — 5s';

		this.flashMessage(label, GOLD_BRIGHT);
		this.cameras.main.flash(180, 240, 210, 100, false);
	}

	private isControlActive() {
		return this.controlUntil > this.simNow;
	}

	update(_time: number, delta: number) {
		if (this.runEnded) return;

		// Everything downstream works in simulated time.
		const dt = delta * this.gameSpeed;
		this.simNow += dt;

		const onGround = this.player.body.blocked.down || this.player.body.touching.down;
		if (onGround) this.hasDoubleJumped = false;

		if (Phaser.Input.Keyboard.JustDown(this.slowKey)) this.triggerSlowMotion();
		if (this.slowMotionUntil !== 0 && !this.slowMotionActive) this.endSlowMotion();

		this.updateDropThrough();
		this.updateDirectControl(onGround);
		this.updateAnimation(onGround);
		this.updateClimb();
		this.updateSky();

		if (this.lava.update(dt, this.player.y)) {
			this.cameras.main.shake(400, 0.01);
			this.endRun('The lava took you.', 0);
			return;
		}

		this.updateHud();
	}

	/**
	 * Keyboard movement is entirely a gift of the control rune. Unpowered, the
	 * climb is driven by the chess board alone and the only key that does
	 * anything is space, which brakes to a horizontal stop.
	 */
	private updateDirectControl(onGround: boolean) {
		if (!this.isControlActive()) {
			if (this.controlUntil !== 0) {
				// Control just lapsed — stop dead rather than sliding off an edge.
				this.controlUntil = 0;
				this.player.setVelocityX(0);
				this.flashMessage('CONTROL LOST', '#c98a8a');
			}
			if (Phaser.Input.Keyboard.JustDown(this.wasd.jump)) {
				this.player.setVelocityX(0);
			}
			return;
		}

		const jumped =
			Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
			Phaser.Input.Keyboard.JustDown(this.wasd.up) ||
			Phaser.Input.Keyboard.JustDown(this.wasd.jump) ||
			this.consumeTouchJump();

		if (jumped) {
			if (onGround) {
				this.player.setVelocityY(CONTROL_JUMP_VELOCITY);
				this.playAnimation('ninja-jump', false);
			} else if (!this.hasDoubleJumped) {
				this.player.setVelocityY(CONTROL_DOUBLE_JUMP_VELOCITY);
				this.triggerDoubleJump();
			}
		}

		const left = this.cursors.left.isDown || this.wasd.left.isDown || this.touchState.left;
		const right = this.cursors.right.isDown || this.wasd.right.isDown || this.touchState.right;

		if (left && !right) {
			this.player.setVelocityX(-CONTROL_RUN_SPEED);
			this.player.setFlipX(true);
		} else if (right && !left) {
			this.player.setVelocityX(CONTROL_RUN_SPEED);
			this.player.setFlipX(false);
		} else {
			this.player.setVelocityX(0);
		}
	}

	private updateAnimation(onGround: boolean) {
		if (!onGround) {
			this.playAnimation(this.hasDoubleJumped ? 'ninja-double' : 'ninja-jump');
		} else if (Math.abs(this.player.body.velocity.x) > 10) {
			this.playAnimation('ninja-run');
		} else {
			this.playAnimation('ninja-idle');
		}
	}

	private updateClimb() {
		this.currentLevel = Math.floor((this.worldHeight - this.player.y) / LEVEL_HEIGHT);
		if (this.currentLevel <= this.maxLevel) return;

		const gained = this.currentLevel - this.maxLevel;
		const previousStage = this.stage.index;
		this.maxLevel = this.currentLevel;

		for (let i = 0; i < gained; i++) {
			this.score += this.stage.pointsPerLevel * this.comboMultiplier;
			this.cleanLevelStreak += 1;
			this.advanceCombo();
		}

		// Climbing is what charges the ability.
		const wasReady = this.slowCharge >= SLOWMO_MIN_CHARGE;
		this.slowCharge = Math.min(1, this.slowCharge + gained * SLOWMO_CHARGE_PER_BAND);
		if (!wasReady && this.slowCharge >= SLOWMO_MIN_CHARGE && !this.slowMotionActive) {
			this.flashMessage('SLOW MOTION READY — Q', '#a9d4f5');
		}

		this.stage = stageForLevel(this.maxLevel);
		if (this.stage.index > previousStage) {
			this.onStageCleared(previousStage);
			this.refreshEndlessTier();
			this.applyTheme(this.themeForLevel(this.maxLevel));
		}

		for (let i = this.highestLevelGenerated + 1; i <= this.maxLevel + 10; i++) {
			this.field.buildLevel(i);
		}
		this.highestLevelGenerated = this.maxLevel + 10;
	}

	private advanceCombo() {
		const target = Math.min(
			MAX_COMBO_MULTIPLIER,
			1 + Math.floor(this.cleanLevelStreak / LEVELS_PER_COMBO_STEP)
		);
		if (target > this.comboMultiplier) {
			this.comboMultiplier = target;
			this.flashMessage(`COMBO x${this.comboMultiplier}`, '#ffb020');
		}
	}

	/**
	 * Stage rewards deliberately pay out on the chess board rather than in the
	 * platformer: a piece lost to a spike comes back, so climbing well repairs a
	 * losing position.
	 */
	private onStageCleared(previousStageIndex: number) {
		this.stagesCleared += 1;
		this.showBanner(`STAGE ${this.stage.index}`, this.stage.name, this.stage.accent);
		this.stageValueText.setText(this.stage.name);
		this.cameras.main.flash(320, 233, 216, 176, false);

		EventBus.emit(ChessEvents.restorePiece, 'w');

		const bonus = previousStageIndex * 50 * this.comboMultiplier;
		this.score += bonus;
		this.time.delayedCall(600, () => this.flashMessage(`+${bonus} STAGE BONUS`, '#7dd3a0'));
	}

	private endRun(reason: string, result: number, abandoned = false) {
		if (this.runEnded) return;
		this.runEnded = true;

		// Tower floors double the score for a win; endless already paid a bonus
		// per game won, so its score stands as accumulated.
		const score =
			this.mode === 'tower' && result === 1 ? Math.round(this.score * 2) : Math.round(this.score);

		const outcome: RunOutcome = {
			mode: this.mode,
			floor: this.towerFloor?.floor,
			result,
			reason,
			score,
			stageName: this.stage.name,
			stagesCleared: this.stagesCleared,
			movesPlayed: this.totalMovesPlayed + chessState.moveCount(),
			gamesWon: this.gamesWon,
			tier: this.tier,
			abandoned
		};

		this.scene.start('GameOver', outcome);
	}

	private triggerDoubleJump() {
		if (this.hasDoubleJumped) return;
		this.hasDoubleJumped = true;
		this.playAnimation('ninja-double', false);
	}

	private playAnimation(key: string, ignoreIfSame = true) {
		if (ignoreIfSame && this.currentAnimKey === key) return;
		this.player.anims.play(key, true);
		this.currentAnimKey = key;
	}

	// ── HUD ────────────────────────────────────────────────────────────────

	// ── HUD ────────────────────────────────────────────────────────────────
	//
	// Laid out as a single top bar divided into fixed cells with generous
	// padding, rather than text placed at hand-picked offsets. Cell boundaries
	// are computed from the bar, so nothing can drift into anything else, and
	// the two transient readouts (combo, control timer) sit on their own row
	// underneath instead of hanging off the sides.

	/**
	 * Rebuilds everything that is pinned to the viewport at the new size.
	 *
	 * Only the HUD and the backdrop are rebuilt; platforms keep the world
	 * coordinates they were generated at, so an orientation change mid-climb
	 * shifts the framing without disturbing the run.
	 */
	private onResize(size: Phaser.Structs.Size) {
		if (this.runEnded) return;

		const width = Math.round(size.width);
		const height = Math.round(size.height);
		if (width < 2 || height < 2) return;
		if (width === this.worldWidth && height === this.worldHeight) return;

		this.worldWidth = width;
		this.worldHeight = height;

		this.skyBackdrop.setDisplaySize(width, height);
		this.skyFade.setDisplaySize(width, height);
		this.starLayer.setSize(width, height);
		this.skyline.setSize(width, 180);
		this.leftWall.setSize(96, height);
		this.rightWall.setSize(96, height).setPosition(width - 96, 0);
		this.lava.resize(width);

		this.cameras.main.setBounds(0, -10e6, width, 10e6 + height);
		this.physics.world.setBounds(0, -10e6, width, 10e6 + height + 400);

		this.buildHud();
		this.buildTouchControls();
	}

	private buildHud() {
		this.hudLayer?.destroy(true);
		// Everything created below is swept into the layer at the end, so a
		// rebuild disposes of the previous HUD wholesale.
		const firstIndex = this.children.list.length;

		const margin = 22;
		const barX = margin;
		const barY = 16;
		const barWidth = this.worldWidth - margin * 2;
		const barHeight = 78;
		const pad = 22;

		this.add
			.rectangle(barX, barY, barWidth, barHeight, PALETTE.oak, 0.92)
			.setOrigin(0, 0)
			.setStrokeStyle(2, PALETTE.gold, 0.75)
			.setDepth(44)
			.setScrollFactor(0);
		this.add
			.rectangle(barX + 5, barY + 5, barWidth - 10, barHeight - 10, PALETTE.parchment, 0.93)
			.setOrigin(0, 0)
			.setStrokeStyle(1, PALETTE.parchmentEdge, 0.7)
			.setDepth(45)
			.setScrollFactor(0);

		const innerLeft = barX + pad;
		const innerRight = barX + barWidth - pad;
		const midY = barY + barHeight / 2;

		const smallLabel = (x: number, y: number, text: string, origin = 0) =>
			this.add
				.text(x, y, text, {
					fontFamily: FONT_BODY,
					fontSize: '13px',
					color: INK_SOFT
				})
				.setOrigin(origin, 0.5)
				.setDepth(50)
				.setScrollFactor(0);

		// Cell 1 — score.
		smallLabel(innerLeft, midY - 16, 'SCORE');
		this.scoreValueText = this.add
			.text(innerLeft, midY + 12, '0', {
				fontFamily: FONT_DISPLAY,
				fontSize: '30px',
				color: '#7b2230'
			})
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0);

		const divider = (x: number) =>
			this.add
				.rectangle(x, midY, 1, barHeight - 30, PALETTE.parchmentEdge, 0.7)
				.setDepth(46)
				.setScrollFactor(0);

		// Cell 2 — floor or stage, with its progress bar.
		const cell2 = innerLeft + 190;
		divider(cell2 - 26);

		smallLabel(cell2, midY - 20, this.towerFloor ? 'FLOOR' : 'STAGE');
		this.stageValueText = this.add
			.text(
				cell2,
				midY + 2,
				this.towerFloor ? `${this.towerFloor.floor} · ${this.towerFloor.name}` : this.stage.name,
				{ fontFamily: FONT_DISPLAY, fontSize: '20px', color: INK }
			)
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0);

		this.add
			.rectangle(cell2, midY + 24, this.stageProgressWidth, 7, PALETTE.oak, 0.3)
			.setOrigin(0, 0.5)
			.setDepth(48)
			.setScrollFactor(0);
		this.stageProgressBar = this.add
			.rectangle(cell2, midY + 24, 0, 7, PALETTE.gold, 1)
			.setOrigin(0, 0.5)
			.setDepth(49)
			.setScrollFactor(0);

		// Cell 3 — right-aligned run state, kept clear of the End Run button.
		// Every mode gets a way out, tower floors included.
		const endRunWidth = 150;
		const cell3Right = innerRight - endRunWidth;
		divider(cell3Right + 18);

		if (this.mode === 'endless') {
			smallLabel(cell3Right, midY - 20, 'GAMES WON', 1);
			this.gamesWonText = this.add
				.text(cell3Right, midY + 3, '0', {
					fontFamily: FONT_DISPLAY,
					fontSize: '22px',
					color: '#2f6b34'
				})
				.setOrigin(1, 0.5)
				.setDepth(50)
				.setScrollFactor(0);

			this.tierText = this.add
				.text(cell3Right, midY + 29, '', {
					fontFamily: FONT_BODY,
					fontSize: '13px',
					color: '#5a4a7a'
				})
				.setOrigin(1, 0.5)
				.setDepth(50)
				.setScrollFactor(0);

		}

		this.buildEndRunButton(innerRight - endRunWidth / 2 + 6, midY);

		// Transient row, below the bar. Combo on the left, control timer centred,
		// so a long control label can never collide with the combo badge.
		const belowY = barY + barHeight + 22;

		this.comboText = this.add
			.text(innerLeft, belowY, '', {
				fontFamily: FONT_DISPLAY,
				fontSize: '26px',
				color: GOLD_BRIGHT,
				stroke: '#140d06',
				strokeThickness: 4
			})
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0);

		const centreX = this.worldWidth / 2;
		this.controlLabel = this.add
			.text(centreX, belowY - 11, 'CONTROL', {
				fontFamily: FONT_BODY,
				fontSize: '14px',
				color: GOLD_BRIGHT,
				stroke: '#140d06',
				strokeThickness: 3
			})
			.setOrigin(0.5)
			.setDepth(50)
			.setScrollFactor(0)
			.setVisible(false);
		this.controlBarBg = this.add
			.rectangle(centreX, belowY + 10, this.controlBarWidth + 6, 13, PALETTE.oak, 0.9)
			.setStrokeStyle(1, PALETTE.gold, 0.8)
			.setDepth(49)
			.setScrollFactor(0)
			.setVisible(false);
		this.controlBar = this.add
			.rectangle(
				centreX - this.controlBarWidth / 2,
				belowY + 10,
				this.controlBarWidth,
				9,
				PALETTE.goldBright,
				1
			)
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0)
			.setVisible(false);

		// Slow-motion charge, right-aligned on the transient row.
		this.slowLabel = this.add
			.text(innerRight, belowY - 11, '', {
				fontFamily: FONT_BODY,
				fontSize: '13px',
				color: '#a9d4f5',
				stroke: '#140d06',
				strokeThickness: 3
			})
			.setOrigin(1, 0.5)
			.setDepth(50)
			.setScrollFactor(0);

		this.slowBarBg = this.add
			.rectangle(innerRight, belowY + 10, this.slowBarWidth + 6, 13, PALETTE.oak, 0.9)
			.setOrigin(1, 0.5)
			.setStrokeStyle(1, 0x6f9fd8, 0.8)
			.setDepth(49)
			.setScrollFactor(0);

		this.slowBar = this.add
			.rectangle(innerRight - this.slowBarWidth - 3, belowY + 10, 0, 9, 0x9ecbf0, 1)
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0);

		this.hudBottom = belowY + 24;

		const created = this.children.list.slice(firstIndex);
		this.hudLayer = this.add.container(0, 0).setDepth(44).setScrollFactor(0);
		this.hudLayer.add(created);
	}

	/**
	 * A way out of any run. Endless has no natural end so it needs one to bank a
	 * score; a tower floor needs one so a hopeless position is not a dead end.
	 */
	private buildEndRunButton(x: number, y: number) {
		const label = this.towerFloor ? 'Leave Floor' : 'End Run';
		const container = this.add.container(x, y).setScrollFactor(0).setDepth(52);
		const frame = this.add
			.rectangle(0, 0, 128, 42, PALETTE.oak, 0.95)
			.setStrokeStyle(2, PALETTE.gold, 0.8);
		const face = this.add.rectangle(0, 0, 118, 32, PALETTE.crimson, 0.95);
		const text = this.add
			.text(0, 0, label, {
				fontFamily: FONT_BODY,
				fontSize: '17px',
				color: PARCHMENT
			})
			.setOrigin(0.5);

		container.add([frame, face, text]);
		container.setSize(128, 42);
		container.setInteractive({ useHandCursor: true });

		container.on('pointerover', () => {
			face.setFillStyle(PALETTE.crimsonLight, 1);
			text.setColor(GOLD_BRIGHT);
		});
		container.on('pointerout', () => {
			face.setFillStyle(PALETTE.crimson, 0.95);
			text.setColor(PARCHMENT);
		});
		container.on('pointerdown', () => {
			// Leaving is neither a win nor a loss, and never clears a floor.
			this.endRun(
				this.towerFloor
					? 'You left the floor unfinished.'
					: 'You left the climb of your own accord.',
				0.5,
				true
			);
		});
	}

	private updateHud() {
		this.scoreValueText.setText(Math.round(this.score).toString());

		const progress = 1 - levelsUntilNextStage(this.maxLevel) / LEVELS_PER_STAGE;
		this.stageProgressBar.width = this.stageProgressWidth * Phaser.Math.Clamp(progress, 0, 1);

		this.comboText.setText(this.comboMultiplier > 1 ? `x${this.comboMultiplier}` : '');

		this.gamesWonText?.setText(`${this.gamesWon}`);
		this.tierText?.setText(tierLabel(this.tier));

		if (this.slowMotionActive) {
			const left = (this.slowMotionUntil - this.simNow) / 1000;
			this.slowLabel.setText(`SLOW MOTION  ${left.toFixed(1)}s`);
			this.slowBar.width = this.slowBarWidth * Phaser.Math.Clamp(
				(this.slowMotionUntil - this.simNow) / (SLOWMO_DURATION_MS * SLOWMO_FACTOR),
				0,
				1
			);
			this.slowBar.setFillStyle(0x6f9fd8, 1);
		} else {
			const ready = this.slowCharge >= SLOWMO_MIN_CHARGE;
			this.slowLabel.setText(ready ? 'SLOW MOTION — Q' : 'CHARGING');
			this.slowLabel.setColor(ready ? '#a9d4f5' : '#7d8ea3');
			this.slowBar.width = this.slowBarWidth * this.slowCharge;
			this.slowBar.setFillStyle(ready ? 0x9ecbf0 : 0x5d7285, 1);
		}

		const remaining = Math.max(0, this.controlUntil - this.simNow);
		const show = remaining > 0;
		this.controlLabel.setVisible(show);
		this.controlBarBg.setVisible(show);
		this.controlBar.setVisible(show);
		if (show) {
			// Scaled against the cap so a stacked rune visibly extends the bar.
			this.controlBar.width = this.controlBarWidth * (remaining / CONTROL_MAX_MS);
			this.controlLabel.setText(`CONTROL  ${(remaining / 1000).toFixed(1)}s`);
		}
	}

	private flashMessage(text: string, color: string) {
		// Starts clear of the HUD and rises, so it never crosses the status bar.
		const startY = this.hudBottom + 46;
		const message = this.add
			.text(this.worldWidth / 2, startY, text, {
				fontFamily: FONT_DISPLAY,
				fontSize: '25px',
				color,
				stroke: '#140d06',
				strokeThickness: 5,
				align: 'center',
				wordWrap: { width: this.worldWidth - 120 }
			})
			.setOrigin(0.5)
			.setDepth(60)
			.setScrollFactor(0);

		this.tweens.add({
			targets: message,
			y: startY - 30,
			alpha: 0,
			duration: 1300,
			ease: 'Cubic.easeOut',
			onComplete: () => message.destroy()
		});
	}

	/** Full-width heraldic banner, used for floor and stage announcements. */
	private showBanner(kicker: string, title: string, accent: string) {
		const centerX = this.worldWidth / 2;
		const centerY = this.worldHeight / 2 - 60;

		const parts: Phaser.GameObjects.GameObject[] = [
			this.add.rectangle(centerX, centerY, this.worldWidth, 116, PALETTE.oak, 0.88).setDepth(58),
			this.add.rectangle(centerX, centerY - 56, this.worldWidth, 2, PALETTE.gold, 0.9).setDepth(59),
			this.add.rectangle(centerX, centerY + 56, this.worldWidth, 2, PALETTE.gold, 0.9).setDepth(59),
			this.add
				.text(centerX, centerY - 22, kicker, {
					fontFamily: FONT_BODY,
					fontSize: '16px',
					color: '#e8d8b0'
				})
				.setOrigin(0.5)
				.setDepth(60),
			this.add
				.text(centerX, centerY + 14, title, {
					fontFamily: FONT_DISPLAY,
					fontSize: '38px',
					color: accent,
					stroke: '#140d06',
					strokeThickness: 5
				})
				.setOrigin(0.5)
				.setDepth(60)
		];

		parts.forEach((part) => {
			(part as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
			(part as Phaser.GameObjects.Components.Alpha).setAlpha(0);
		});

		this.tweens.add({
			targets: parts,
			alpha: 1,
			duration: 260,
			ease: 'Quad.easeOut',
			onComplete: () => {
				this.tweens.add({
					targets: parts,
					alpha: 0,
					delay: 1000,
					duration: 420,
					onComplete: () => parts.forEach((part) => part.destroy())
				});
			}
		});
	}

	/** Parchment card explaining the mechanic a tower floor introduces. */
	private showTeachingCard(text: string) {
		const centerX = this.worldWidth / 2;
		const y = this.worldHeight - 135;

		const panel = this.add
			.rectangle(centerX, y, 760, 92, PALETTE.parchment, 0.95)
			.setStrokeStyle(2, PALETTE.gold, 0.9)
			.setDepth(58)
			.setScrollFactor(0);
		const label = this.add
			.text(centerX, y, text, {
				fontFamily: FONT_BODY,
				fontSize: '19px',
				color: INK,
				align: 'center',
				lineSpacing: 6,
				wordWrap: { width: 690 }
			})
			.setOrigin(0.5)
			.setDepth(59)
			.setScrollFactor(0);

		const parts = [panel, label];
		parts.forEach((p) => p.setAlpha(0));

		this.tweens.add({
			targets: parts,
			alpha: 1,
			duration: 300,
			onComplete: () => {
				this.tweens.add({
					targets: parts,
					alpha: 0,
					delay: 4200,
					duration: 500,
					onComplete: () => parts.forEach((p) => p.destroy())
				});
			}
		});
	}
}
