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
	PLAYER_MAX_VELOCITY,
	STEER_PER_FILE
} from '../config';
import { LEVELS_PER_STAGE, levelsUntilNextStage, stageForLevel, type StageConfig } from '../stages';
import { floorByNumber, type TowerFloor } from '../levels';
import { liftForMove, type LiftMove } from '../lift';
import { Flood } from '../world/Flood';
import { PlatformField } from '../world/PlatformField';
import { FONT_BODY, FONT_DISPLAY, GOLD_BRIGHT, INK, INK_SOFT, PALETTE } from '../theme';

export type GameMode = 'tower' | 'endless';

export interface GameSceneData {
	mode: GameMode;
	/** Endless mode only. */
	difficulty?: string;
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
	difficulty?: string;
}

export class Game extends Scene {
	private mode: GameMode = 'endless';
	private towerFloor?: TowerFloor;
	private difficulty = 'Intermediate';

	private worldWidth = 1024;
	private worldHeight = 768;

	private field!: PlatformField;
	private flood!: Flood;
	private player!: Phaser.Physics.Arcade.Sprite;
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private wasd!: Record<'up' | 'left' | 'right' | 'jump', Phaser.Input.Keyboard.Key>;

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

	private scoreValueText!: Phaser.GameObjects.Text;
	private stageValueText!: Phaser.GameObjects.Text;
	private stageProgressBar!: Phaser.GameObjects.Rectangle;
	private comboText!: Phaser.GameObjects.Text;
	private controlBar!: Phaser.GameObjects.Rectangle;
	private controlBarBg!: Phaser.GameObjects.Rectangle;
	private controlLabel!: Phaser.GameObjects.Text;
	private readonly stageProgressWidth = 240;
	private readonly controlBarWidth = 150;

	constructor() {
		super('Game');
	}

	init(data: GameSceneData) {
		this.mode = data.mode ?? 'endless';
		this.difficulty = data.difficulty ?? 'Intermediate';
		this.towerFloor = data.floor ? floorByNumber(data.floor) : undefined;
	}

	preload() {
		this.load.image('sky', 'assets/sky.png');
		this.load.image('ground', 'assets/Ground.png');
		this.load.image('platform', 'assets/Platform.png');
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
		this.createAnimations();
		this.drawSky();

		this.field = new PlatformField(
			this,
			this.worldWidth,
			this.worldHeight,
			this.towerFloor?.rules ?? {}
		);
		for (let i = 1; i <= 10; i++) this.field.buildLevel(i);
		this.highestLevelGenerated = 10;

		this.createPlayer();
		this.flood = new Flood(
			this,
			this.worldWidth,
			this.worldHeight,
			this.towerFloor ? this.towerFloor.floodSpeed : 10
		);

		this.createInput();
		this.buildHud();

		if (this.towerFloor) {
			this.startTowerFloor(this.towerFloor);
		}

		this.bindChessEvents();
		EventBus.emit('current-scene-ready', this);
	}

	private resetRunState() {
		this.currentLevel = 0;
		this.maxLevel = 0;
		this.highestLevelGenerated = 0;
		this.hasDoubleJumped = false;
		this.currentAnimKey = null;
		this.runEnded = false;
		this.controlUntil = 0;
		this.stage = stageForLevel(0);
		this.score = 0;
		this.cleanLevelStreak = 0;
		this.comboMultiplier = 1;
		this.stagesCleared = 0;
	}

	/** Loads the floor's position and engine strength, then announces it. */
	private startTowerFloor(floor: TowerFloor) {
		EventBus.emit(ChessEvents.loadPosition, { fen: floor.fen, engine: floor.engine });

		this.showBanner(`FLOOR ${floor.floor}`, floor.name, GOLD_BRIGHT);

		if (floor.teaches) {
			this.time.delayedCall(1600, () => this.showTeachingCard(floor.teaches!));
		}
	}

	private drawSky() {
		const source = this.textures.get('sky').getSourceImage() as HTMLImageElement;
		const scale = Math.max(
			1,
			Math.ceil(Math.max(this.worldWidth / source.width, this.worldHeight / source.height))
		);
		const tileWidth = source.width * scale;
		const tileHeight = source.height * scale;
		const columns = Math.ceil(this.worldWidth / tileWidth) + 1;

		// Alternating flipped tiles, repeated far enough up to cover any climb.
		let y = 0;
		for (let row = 0; row < 400; row++) {
			for (let col = 0; col < columns; col++) {
				this.add
					.image(col * tileWidth, y, 'sky')
					.setOrigin(0, 0)
					.setScale(scale).flipY = row % 2 === 0;
			}
			y -= (tileHeight * 14) / 15;
		}
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
		this.player.body.setMaxVelocity(PLAYER_MAX_VELOCITY);
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
				if (plat.getData('blocked') === true) return true;
				// Pass-through: only land when falling onto the top face.
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
			jump: this.input.keyboard!.addKey(Key.SPACE)
		};
	}

	private bindChessEvents() {
		const onGameOver = (detail: { reason: string; result: number }) => {
			this.endRun(detail.reason, detail.result);
		};
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

		const remaining = Math.max(0, this.controlUntil - this.time.now);
		const banked = Math.min(remaining + CONTROL_DURATION_MS, CONTROL_MAX_MS);
		const gained = banked - remaining;
		this.controlUntil = this.time.now + banked;

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
		return this.controlUntil > this.time.now;
	}

	update(_time: number, delta: number) {
		if (this.runEnded) return;

		const onGround = this.player.body.blocked.down || this.player.body.touching.down;
		if (onGround) this.hasDoubleJumped = false;

		this.updateDirectControl(onGround);
		this.updateAnimation(onGround);
		this.updateClimb();

		if (this.flood.update(delta, this.player.y)) {
			this.cameras.main.shake(400, 0.01);
			this.endRun('The flood took you.', 0);
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
			Phaser.Input.Keyboard.JustDown(this.wasd.jump);

		if (jumped) {
			if (onGround) {
				this.player.setVelocityY(CONTROL_JUMP_VELOCITY);
				this.playAnimation('ninja-jump', false);
			} else if (!this.hasDoubleJumped) {
				this.player.setVelocityY(CONTROL_DOUBLE_JUMP_VELOCITY);
				this.triggerDoubleJump();
			}
		}

		const left = this.cursors.left.isDown || this.wasd.left.isDown;
		const right = this.cursors.right.isDown || this.wasd.right.isDown;

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

		this.stage = stageForLevel(this.maxLevel);
		if (this.stage.index > previousStage) {
			this.onStageCleared(previousStage);
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

	private endRun(reason: string, result: number) {
		if (this.runEnded) return;
		this.runEnded = true;

		const outcome: RunOutcome = {
			mode: this.mode,
			floor: this.towerFloor?.floor,
			result,
			reason,
			// Winning the chess game doubles the climb score.
			score: Math.round(result === 1 ? this.score * 2 : this.score),
			stageName: this.stage.name,
			stagesCleared: this.stagesCleared,
			movesPlayed: chessState.moveCount(),
			difficulty: this.difficulty
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

	private buildHud() {
		const centerX = this.worldWidth / 2;
		const hudY = 34;
		const hudWidth = 430;
		const hudHeight = 60;

		this.add
			.rectangle(centerX, hudY, hudWidth + 12, hudHeight + 12, PALETTE.oak, 0.9)
			.setStrokeStyle(2, PALETTE.gold, 0.7)
			.setDepth(44)
			.setScrollFactor(0);
		this.add
			.rectangle(centerX, hudY, hudWidth, hudHeight, PALETTE.parchment, 0.92)
			.setStrokeStyle(1, PALETTE.parchmentEdge, 0.8)
			.setDepth(45)
			.setScrollFactor(0);

		const left = centerX - hudWidth / 2 + 18;
		const label = (x: number, y: number, text: string) =>
			this.add
				.text(x, y, text, { fontFamily: FONT_BODY, fontSize: '13px', color: INK_SOFT })
				.setOrigin(0, 0.5)
				.setDepth(50)
				.setScrollFactor(0);

		label(left, hudY - 12, 'SCORE');
		this.scoreValueText = this.add
			.text(left, hudY + 10, '0', {
				fontFamily: FONT_DISPLAY,
				fontSize: '28px',
				color: '#7b2230'
			})
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0);

		this.add
			.rectangle(left + 132, hudY, 1, hudHeight - 18, PALETTE.parchmentEdge, 0.7)
			.setDepth(46)
			.setScrollFactor(0);

		const stageX = left + 152;
		// In the tower the right-hand slot shows the floor; endless shows the stage.
		label(stageX, hudY - 16, this.towerFloor ? 'FLOOR' : 'STAGE');
		this.stageValueText = this.add
			.text(
				stageX,
				hudY + 3,
				this.towerFloor ? `${this.towerFloor.floor} · ${this.towerFloor.name}` : this.stage.name,
				{ fontFamily: FONT_DISPLAY, fontSize: '19px', color: INK }
			)
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0);

		this.add
			.rectangle(stageX, hudY + 20, this.stageProgressWidth, 6, PALETTE.oak, 0.3)
			.setOrigin(0, 0.5)
			.setDepth(48)
			.setScrollFactor(0);
		this.stageProgressBar = this.add
			.rectangle(stageX, hudY + 20, 0, 6, PALETTE.gold, 1)
			.setOrigin(0, 0.5)
			.setDepth(49)
			.setScrollFactor(0);

		this.comboText = this.add
			.text(centerX + hudWidth / 2 + 26, hudY, '', {
				fontFamily: FONT_DISPLAY,
				fontSize: '26px',
				color: GOLD_BRIGHT,
				stroke: '#140d06',
				strokeThickness: 4
			})
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0);

		const controlY = hudY + hudHeight / 2 + 22;
		this.controlLabel = this.add
			.text(centerX, controlY - 12, 'CONTROL', {
				fontFamily: FONT_BODY,
				fontSize: '13px',
				color: GOLD_BRIGHT,
				stroke: '#140d06',
				strokeThickness: 3
			})
			.setOrigin(0.5)
			.setDepth(50)
			.setScrollFactor(0)
			.setVisible(false);
		this.controlBarBg = this.add
			.rectangle(centerX, controlY + 6, this.controlBarWidth + 4, 12, PALETTE.oak, 0.9)
			.setStrokeStyle(1, PALETTE.gold, 0.8)
			.setDepth(49)
			.setScrollFactor(0)
			.setVisible(false);
		this.controlBar = this.add
			.rectangle(
				centerX - this.controlBarWidth / 2,
				controlY + 6,
				this.controlBarWidth,
				8,
				PALETTE.goldBright,
				1
			)
			.setOrigin(0, 0.5)
			.setDepth(50)
			.setScrollFactor(0)
			.setVisible(false);
	}

	private updateHud() {
		this.scoreValueText.setText(Math.round(this.score).toString());

		const progress = 1 - levelsUntilNextStage(this.maxLevel) / LEVELS_PER_STAGE;
		this.stageProgressBar.width = this.stageProgressWidth * Phaser.Math.Clamp(progress, 0, 1);

		this.comboText.setText(this.comboMultiplier > 1 ? `x${this.comboMultiplier}` : '');

		const remaining = Math.max(0, this.controlUntil - this.time.now);
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

	// ── Transient overlays ────────────────────────────────────────────────

	private flashMessage(text: string, color: string) {
		const message = this.add
			.text(this.worldWidth / 2, 120, text, {
				fontFamily: FONT_DISPLAY,
				fontSize: '26px',
				color,
				stroke: '#140d06',
				strokeThickness: 5
			})
			.setOrigin(0.5)
			.setDepth(60)
			.setScrollFactor(0);

		this.tweens.add({
			targets: message,
			y: 92,
			alpha: 0,
			duration: 1200,
			ease: 'Cubic.easeOut',
			onComplete: () => message.destroy()
		});
	}

	/** Full-width heraldic banner, used for floor and stage announcements. */
	private showBanner(kicker: string, title: string, accent: string) {
		const centerX = this.worldWidth / 2;
		const centerY = this.worldHeight / 2 - 60;

		const parts: Phaser.GameObjects.GameObject[] = [
			this.add.rectangle(centerX, centerY, this.worldWidth, 96, PALETTE.oak, 0.85).setDepth(58),
			this.add.rectangle(centerX, centerY - 46, this.worldWidth, 2, PALETTE.gold, 0.9).setDepth(59),
			this.add.rectangle(centerX, centerY + 46, this.worldWidth, 2, PALETTE.gold, 0.9).setDepth(59),
			this.add
				.text(centerX, centerY - 10, kicker, {
					fontFamily: FONT_BODY,
					fontSize: '16px',
					color: '#e8d8b0'
				})
				.setOrigin(0.5)
				.setDepth(60),
			this.add
				.text(centerX, centerY + 16, title, {
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
		const y = this.worldHeight - 130;

		const panel = this.add
			.rectangle(centerX, y, 660, 74, PALETTE.parchment, 0.95)
			.setStrokeStyle(2, PALETTE.gold, 0.9)
			.setDepth(58)
			.setScrollFactor(0);
		const label = this.add
			.text(centerX, y, text, {
				fontFamily: FONT_BODY,
				fontSize: '19px',
				color: INK,
				align: 'center',
				wordWrap: { width: 610 }
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
