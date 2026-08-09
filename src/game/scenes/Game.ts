import { Scene } from 'phaser';
import { ChessEvents, EventBus } from '../EventBus';
import { moves } from '$lib/stores/chess';
import {
    LEVELS_PER_STAGE,
    levelsUntilNextStage,
    pickPlatformCount,
    stageForLevel,
    type StageConfig
} from '../stages';
import { PALETTE, INK, INK_SOFT, GOLD_BRIGHT, FONT_BODY, FONT_DISPLAY } from '../theme';

let SCREEN_DIMENSIONS = [1024, 768]; // THESE ARE ORIGINAL VALUES, THEY WILL CHANGE TO MATCH ACTUAL SCREEN WIDTH AND HEIGHT

const LEVEL_HEIGHT = 200;
const PLAYER_Y_GRAVITY = 350;
const PLAYER_COLLISION_BOUNCE = 0.2;
const PLAYER_MAX_VELOCITY = 800;

const X_VELOCITY_MULTIPLIER = 50;
const Y_VELOCITY_MULTIPLIER = 400;

/** Levels climbed without touching a spike before the combo multiplier steps up. */
const LEVELS_PER_COMBO_STEP = 5;
const MAX_COMBO_MULTIPLIER = 4;

export class Game extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private currentLevel!: number;
    private maxLevel!: number;
    private highestLevelGenerated!: number;
    private difficulty!: string;
    private hasDoubleJumped = false;
    private currentAnimKey: string | null = null;
    private readonly platformScale = 3.5;
    private readonly groundScale = 2;
    private readonly spikeScale = 0.3;
    private platformHalfWidth = 0;
    private platformHeight = 0;
    private spikeHalfWidth = 0;
    private spikeHeight = 0;
    private groundTileWidth = 0;
    private skyScale = 1;

    // Stage + scoring state
    private stage!: StageConfig;
    private score!: number;
    private cleanLevelStreak!: number;
    private comboMultiplier!: number;
    private stagesCleared!: number;

    // HUD
    private hudBackground!: Phaser.GameObjects.Rectangle;
    private scoreLabel!: Phaser.GameObjects.Text;
    private scoreValueText!: Phaser.GameObjects.Text;
    private stageLabel!: Phaser.GameObjects.Text;
    private stageValueText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private stageProgressBar!: Phaser.GameObjects.Rectangle;
    private stageProgressWidth = 240;

    constructor() {
        super('Game');
    }

    init(data: { difficulty }) {
        this.difficulty = data.difficulty;
    }

    createLevel(level) {
        // Generation is driven by the stage the band belongs to, not by the
        // player's current stage, so pre-generated bands stay consistent.
        const stage = stageForLevel(level);
        const y = SCREEN_DIMENSIONS[1] - level * LEVEL_HEIGHT;
        const numberPlatforms = pickPlatformCount(stage, Math.random());
        const halfWidth = this.platformHalfWidth || 0;
        const minX = Math.max(halfWidth, 0);
        const maxX = SCREEN_DIMENSIONS[0] - halfWidth;
        const availableWidth = maxX - minX;
        const placements: number[] = [];
        const spacing = this.platformHalfWidth * 2 + 40;
        for (let i = 0; i < numberPlatforms; i++) {
            let attempts = 0;
            let x = 0;
            let placed = false;
            while (attempts < 20 && !placed) {
                const candidate =
                    availableWidth <= 0
                        ? SCREEN_DIMENSIONS[0] / 2
                        : Phaser.Math.Clamp(
                              Phaser.Math.Between(Math.round(minX), Math.round(maxX)),
                              minX,
                              maxX
                          );
                const overlaps = placements.some((existing) => Math.abs(existing - candidate) < spacing);
                if (!overlaps) {
                    x = candidate;
                    placements.push(candidate);
                    placed = true;
                }
                attempts++;
            }
            if (!placed) {
                continue;
            }
            const isBlocked = Math.random() < stage.blockedChance;
            const platform = this.platforms.create(x, y, 'platform') as Phaser.Physics.Arcade.Image;
            platform.setScale(this.platformScale);
            platform.refreshBody();
            platform.setData('blocked', isBlocked);
            if (isBlocked) {
                platform.setTint(0x333333)
            } else {
                platform.clearTint();
            }
            const platformHeight = this.platformHeight;

            const randChance = Math.random();
            if (randChance < stage.spikeChance) {
                const maxOffset = Math.max(0, Math.floor(this.platformHalfWidth - this.spikeHalfWidth));
                const randPos = Phaser.Math.Between(-maxOffset, maxOffset);
                const spikeX = Phaser.Math.Clamp(
                    x + randPos,
                    this.spikeHalfWidth,
                    SCREEN_DIMENSIONS[0] - this.spikeHalfWidth
                );
                const spikeY = y - platformHeight / 2 - this.spikeHeight / 2 - 20;
                const spike = this.spikes.create(spikeX, spikeY, 'spike', 0) as Phaser.Physics.Arcade.Sprite;
                spike.setDepth(5);
                spike.play('spike-idle');
                spike.body.setAllowGravity(false);
                spike.body.setImmovable(true);
                spike.body.moves = false;
                const bodyWidth = this.spikeHalfWidth * 2;
                const bodyHeight = this.spikeHeight;
                spike.body.setSize(bodyWidth, bodyHeight, true);
            }
        }
    }

    handleSpikeCollision(player, spike) {
        spike.destroy();
        EventBus.emit(ChessEvents.removePiece, 'w');

        // Losing a piece breaks the clean-climb streak.
        this.cleanLevelStreak = 0;
        this.comboMultiplier = 1;
        this.cameras.main.shake(180, 0.006);
        this.flashMessage('-1 PIECE', '#ff8080');
    }

    /**
     * En passant is the one chess move with no direct platformer analogue, so it
     * gets its own reward: every spike currently on screen is destroyed.
     */
    private handleEnPassant() {
        const camera = this.cameras.main;
        const top = camera.scrollY;
        const bottom = top + camera.height;

        let cleared = 0;
        (this.spikes.getChildren() as Phaser.Physics.Arcade.Sprite[])
            .filter((spike) => spike.y >= top && spike.y <= bottom)
            .forEach((spike) => {
                spike.destroy();
                cleared += 1;
            });

        if (cleared > 0) {
            this.flashMessage(`EN PASSANT — ${cleared} SPIKE${cleared > 1 ? 'S' : ''} CLEARED`, '#ffe680');
        }
    }

    /** Short-lived centred toast, used for combo/stage/hazard feedback. */
    private flashMessage(text: string, color: string) {
        const message = this.add
            .text(this.scale.width / 2, 120, text, {
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

    /** Full-width heraldic banner announcing a new stage. */
    private showStageBanner(stage: StageConfig) {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2 - 60;

        const backing = this.add
            .rectangle(centerX, centerY, this.scale.width, 96, PALETTE.oak, 0.85)
            .setDepth(58)
            .setScrollFactor(0);

        const rules = [
            this.add.rectangle(centerX, centerY - 46, this.scale.width, 2, PALETTE.gold, 0.9),
            this.add.rectangle(centerX, centerY + 46, this.scale.width, 2, PALETTE.gold, 0.9)
        ].map((rule) => rule.setDepth(59).setScrollFactor(0));

        const title = this.add
            .text(centerX, centerY - 10, `STAGE ${stage.index}`, {
                fontFamily: FONT_BODY,
                fontSize: '16px',
                color: '#e8d8b0'
            })
            .setOrigin(0.5)
            .setDepth(60)
            .setScrollFactor(0);

        const name = this.add
            .text(centerX, centerY + 16, stage.name, {
                fontFamily: FONT_DISPLAY,
                fontSize: '38px',
                color: stage.accent,
                stroke: '#140d06',
                strokeThickness: 5
            })
            .setOrigin(0.5)
            .setDepth(60)
            .setScrollFactor(0);

        const parts = [backing, ...rules, title, name];
        parts.forEach((part) => part.setAlpha(0));

        this.tweens.add({
            targets: parts,
            alpha: 1,
            duration: 260,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: parts,
                    alpha: 0,
                    delay: 900,
                    duration: 420,
                    onComplete: () => parts.forEach((part) => part.destroy())
                });
            }
        });
    }

    private createGroundTiles() {
        if (!this.groundTileWidth) {
            return;
        }
        const tilesNeeded = Math.ceil(SCREEN_DIMENSIONS[0] / this.groundTileWidth) + 3;
        const startX = -this.groundTileWidth;
        for (let i = 0; i < tilesNeeded; i++) {
            const x = startX + i * this.groundTileWidth + this.groundTileWidth / 2;
            const ground = this.platforms.create(x, SCREEN_DIMENSIONS[1] - 45, 'ground') as Phaser.Physics.Arcade.Image;
            ground.setData('blocked', true)
            ground.setScale(this.groundScale);
            ground.refreshBody();
        }
    }

    preload() {
        this.load.image('sky', 'assets/sky.png');
        this.load.image('ground', 'assets/Ground.png');
        this.load.image('platform', 'assets/Platform.png');
        this.load.spritesheet('spike', 'assets/Spike.png', { frameWidth: 54, frameHeight: 52 });
        this.load.spritesheet('ninjaIdle', 'assets/IdleNinja.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('ninjaRun', 'assets/RunNinja.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('ninjaJump', 'assets/JumpNinja.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('ninjaDouble', 'assets/DoubleJumpNinja.png', { frameWidth: 32, frameHeight: 32 });
    }

    create() {
        SCREEN_DIMENSIONS = [this.scale.width, this.scale.height];

        this.currentLevel = 0;
        this.maxLevel = 0;
        this.highestLevelGenerated = 0;

        this.stage = stageForLevel(0);
        this.score = 0;
        this.cleanLevelStreak = 0;
        this.comboMultiplier = 1;
        this.stagesCleared = 0;

        const platformSource = this.textures.get('platform').getSourceImage() as HTMLImageElement;
        const platformWidth = platformSource.width * this.platformScale;
        const platformHeight = platformSource.height * this.platformScale;
        this.platformHalfWidth = platformWidth / 2;
        this.platformHeight = platformHeight;

        const spikeFrame = this.textures.get('spike').get(0);
        const spikeFrameWidth = spikeFrame?.width ?? 0;
        const spikeFrameHeight = spikeFrame?.height ?? 0;
        this.spikeHalfWidth = (spikeFrameWidth * this.spikeScale) / 2;
        this.spikeHeight = spikeFrameHeight * this.spikeScale;

        const groundSource = this.textures.get('ground').getSourceImage() as HTMLImageElement;
        this.groundTileWidth = groundSource.width * this.groundScale;

        const skySource = this.textures.get('sky').getSourceImage() as HTMLImageElement;
        const skyWidthRatio = this.scale.width / skySource.width;
        const skyHeightRatio = this.scale.height / skySource.height;
        this.skyScale = Math.max(1, Math.ceil(Math.max(skyWidthRatio, skyHeightRatio)));
        const skyHeight = skySource.height * this.skyScale;
        const skyWidth = skySource.width * this.skyScale;


        // Repeating alternating (light blue, dark blue) sky pattern
        let yPosition = 0;
        const columns = Math.ceil(SCREEN_DIMENSIONS[0] / skyWidth) + 1;
        for (let row = 0; row < 1e3; row++) {
            for (let col = 0; col < columns; col++) {
                let sky = this.add.image(col * skyWidth, yPosition, 'sky')
                    .setOrigin(0, 0)
                    .setScale(this.skyScale);
                sky.flipY = (row % 2 === 0);  // Flip every other sky
            }
            yPosition -= skyHeight * 14/15;
        }

        this.platforms = this.physics.add.staticGroup();
        this.spikes = this.physics.add.group({
            allowGravity: false,
            immovable: true
        });
        if (!this.anims.exists('ninja-idle')) {
            this.anims.create({
                key: 'ninja-idle',
                frames: this.anims.generateFrameNumbers('ninjaIdle', { start: 0, end: 10 }),
                frameRate: 8,
                repeat: -1
            });
            this.anims.create({
                key: 'ninja-run',
                frames: this.anims.generateFrameNumbers('ninjaRun', { start: 0, end: 11 }),
                frameRate: 14,
                repeat: -1
            });
            this.anims.create({
                key: 'ninja-jump',
                frames: this.anims.generateFrameNumbers('ninjaJump', { start: 0, end: 0 }),
                frameRate: 1,
                repeat: -1
            });
            this.anims.create({
                key: 'ninja-double',
                frames: this.anims.generateFrameNumbers('ninjaDouble', { start: 0, end: 5 }),
                frameRate: 16,
                repeat: -1
            });
        }
        if (!this.anims.exists('spike-idle')) {
            this.anims.create({
                key: 'spike-idle',
                frames: this.anims.generateFrameNumbers('spike', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            });
        }
        // console.log(this.scale.width, this.scale.height);
        // console.log(SCREEN_DIMENSIONS);
        this.createGroundTiles();
        for (let i = 1; i <= 10; i++) {
            this.createLevel(i);
        }

        this.highestLevelGenerated = 10;
        this.hasDoubleJumped = false;
        this.currentAnimKey = null;

        this.player = this.physics.add.sprite(SCREEN_DIMENSIONS[0]/2, SCREEN_DIMENSIONS[1] - 200, 'ninjaIdle', 0);
        this.player.setDisplaySize(64, 64)
        this.player.setBounce(PLAYER_COLLISION_BOUNCE);
        this.player.body.setGravityY(PLAYER_Y_GRAVITY);
        this.player.body.setMaxVelocity(PLAYER_MAX_VELOCITY);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(20, 28);
        this.player.body.setOffset(6, 4);


        let camera = this.cameras.main;
        camera.startFollow(this.player); 
        camera.setBounds(0, -10e6, SCREEN_DIMENSIONS[0], 10e6+SCREEN_DIMENSIONS[1]); // Only follows player in y direction

        this.playAnimation('ninja-idle', false);

        this.physics.world.setBoundsCollision(true, true, false, true);
        this.physics.add.collider(
            this.player,
            this.platforms,
            undefined, // optional collide callback
            (player, platform) => { 
                const p = player as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
                const plat = platform as Phaser.Physics.Arcade.Image;
                const isBlocked = plat.getData('blocked') === true;
                if (isBlocked) {
                    return true;
                }

                // only collide if player is falling and above the platform
                return p.body.velocity.y >= 0 && p.body.bottom <= plat.body.top + 10;
            },
            this
        );

        // Enable overlap detection for spikes with player
        this.physics.add.overlap(this.player, this.spikes, this.handleSpikeCollision, null, this);

        this.cursors = this.input.keyboard.createCursorKeys();

        this.buildHud();

        EventBus.emit('current-scene-ready', this);

        const handleEnPassant = () => this.handleEnPassant();
        EventBus.on(ChessEvents.enPassant, handleEnPassant);

        const handleGameOver = (detail) => {
            // Winning the chess game doubles the climb score.
            const finalScore = detail.result === 1 ? this.score * 2 : this.score;
            this.scene.start("GameOver", {
                reason: detail.reason,
                result: detail.result,
                maxScore: Math.round(finalScore),
                stageName: this.stage.name,
                stagesCleared: this.stagesCleared,
                difficulty: this.difficulty
            })
        }
        EventBus.on(ChessEvents.gameOver, handleGameOver);

        const unsubscribe = moves.subscribe(mv => {
            if (!mv.length) return;
            const latestMove = mv[mv.length - 1];
            const newText = latestMove.piece + " (" + latestMove.color + ") moved from " + latestMove.from + " to " + latestMove.to;
            // console.log(newText);
            if (latestMove.color === 'w') {
                let toPos = String(latestMove.to);
                let fromPos = String(latestMove.from);
                let fromLetter = fromPos.charAt(0);
                let fromNumber = fromPos.charAt(1);
                let toLetter = toPos.charAt(0);
                let toNumber = toPos.charAt(1);
                let dx = toLetter.charCodeAt(0) - fromLetter.charCodeAt(0);
                let dy = parseInt(toNumber) - parseInt(fromNumber);
                
                const desiredVy = -Math.sqrt(dy) * Y_VELOCITY_MULTIPLIER // negative = up
                // if player is already going up slower than desired, boost it
                const onGroundNow = this.player.body.blocked.down || this.player.body.touching.down;
                const shouldBoost = this.player.body.velocity.y > desiredVy;
                if (shouldBoost) {
                    this.player.setVelocityY(desiredVy);
                    if (!onGroundNow) {
                        this.triggerDoubleJump();
                    } else {
                        this.playAnimation('ninja-jump', false);
                    }
                }

                this.player.setVelocityX(dx * X_VELOCITY_MULTIPLIER);
            }
        })

        this.events.once('shutdown', () => {
            EventBus.off(ChessEvents.gameOver, handleGameOver);
            EventBus.off(ChessEvents.enPassant, handleEnPassant);
            unsubscribe();
        });
    }


    update() {
        const onGround = this.player.body.blocked.down || this.player.body.touching.down;
        if (onGround) {
            this.hasDoubleJumped = false;
        }

        if (this.cursors?.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            if (onGround) {
                this.player.setVelocityY(-530);
                this.playAnimation('ninja-jump', false);
            } else if (!this.hasDoubleJumped) {
                this.player.setVelocityY(-500);
                this.triggerDoubleJump();
            }
        }

        let desiredAnimation = this.currentAnimKey ?? 'ninja-idle';
        if (!onGround) {
            desiredAnimation = this.hasDoubleJumped ? 'ninja-double' : 'ninja-jump';
        } else if (Math.abs(this.player.body.velocity.x) > 10) {
            desiredAnimation = 'ninja-run';
        } else {
            desiredAnimation = 'ninja-idle';
        }
        this.playAnimation(desiredAnimation);

        // If player is directly under a platform and is moving upwards fast enough, the player should automatically move onto the platform.
        // values to be adjusted

        // Create level

        this.currentLevel = Math.floor((SCREEN_DIMENSIONS[1] - this.player.y) / LEVEL_HEIGHT);

        if (this.currentLevel > this.maxLevel) {
            const levelsGained = this.currentLevel - this.maxLevel;
            const previousStageIndex = this.stage.index;
            this.maxLevel = this.currentLevel;

            // Award points for each new level, then advance the combo.
            for (let i = 0; i < levelsGained; i++) {
                this.score += this.stage.pointsPerLevel * this.comboMultiplier;
                this.cleanLevelStreak += 1;
                this.advanceCombo();
            }

            this.stage = stageForLevel(this.maxLevel);
            if (this.stage.index > previousStageIndex) {
                this.onStageCleared(previousStageIndex);
            }

            for (let i = this.highestLevelGenerated + 1; i <= this.maxLevel + 10; i++) {
                this.createLevel(i);
            }

            this.highestLevelGenerated = this.maxLevel + 10;
        }

        this.updateHud();
    }

    /** Steps the multiplier up every LEVELS_PER_COMBO_STEP clean levels. */
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
     * Fired when the player crosses into a new stage. The reward deliberately
     * pays out on the chess board rather than in the platformer: a piece lost to
     * a spike comes back, so climbing well repairs a losing position.
     */
    private onStageCleared(previousStageIndex: number) {
        this.stagesCleared += 1;

        this.showStageBanner(this.stage);
        this.stageValueText.setText(this.stage.name);
        this.cameras.main.flash(320, 233, 216, 176, false);

        // Stage reward: recover a piece knocked off by a spike.
        EventBus.emit(ChessEvents.restorePiece, 'w');

        // Clearing a stage without losing the streak is worth a lump bonus.
        const bonus = previousStageIndex * 50 * this.comboMultiplier;
        this.score += bonus;
        this.time.delayedCall(600, () => this.flashMessage(`+${bonus} STAGE BONUS`, '#7dd3a0'));
    }

    /** Parchment-and-gold status bar, pinned to the top of the viewport. */
    private buildHud() {
        const centerX = this.scale.width / 2;
        const hudY = 34;
        const hudWidth = 430;
        const hudHeight = 60;

        this.add.rectangle(centerX, hudY, hudWidth + 12, hudHeight + 12, PALETTE.oak, 0.9)
            .setStrokeStyle(2, PALETTE.gold, 0.7)
            .setDepth(44)
            .setScrollFactor(0);

        this.hudBackground = this.add.rectangle(centerX, hudY, hudWidth, hudHeight, PALETTE.parchment, 0.92)
            .setStrokeStyle(1, PALETTE.parchmentEdge, 0.8)
            .setDepth(45)
            .setScrollFactor(0);

        const left = centerX - hudWidth / 2 + 18;

        this.scoreLabel = this.add.text(left, hudY - 12, 'SCORE', {
            fontFamily: FONT_BODY,
            fontSize: '13px',
            color: INK_SOFT
        }).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0);

        this.scoreValueText = this.add.text(left, hudY + 10, '0', {
            fontFamily: FONT_DISPLAY,
            fontSize: '28px',
            color: '#7b2230'
        }).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0);

        // Divider between score and stage.
        this.add.rectangle(left + 132, hudY, 1, hudHeight - 18, PALETTE.parchmentEdge, 0.7)
            .setDepth(46)
            .setScrollFactor(0);

        const stageX = left + 152;

        this.stageLabel = this.add.text(stageX, hudY - 16, 'STAGE', {
            fontFamily: FONT_BODY,
            fontSize: '13px',
            color: INK_SOFT
        }).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0);

        this.stageValueText = this.add.text(stageX, hudY + 3, this.stage.name, {
            fontFamily: FONT_DISPLAY,
            fontSize: '19px',
            color: INK
        }).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0);

        // Progress towards the next stage.
        this.add.rectangle(stageX, hudY + 20, this.stageProgressWidth, 6, PALETTE.oak, 0.3)
            .setOrigin(0, 0.5)
            .setDepth(48)
            .setScrollFactor(0);

        this.stageProgressBar = this.add.rectangle(stageX, hudY + 20, 0, 6, PALETTE.gold, 1)
            .setOrigin(0, 0.5)
            .setDepth(49)
            .setScrollFactor(0);

        // Combo badge, sits just outside the plaque so it can pulse freely.
        this.comboText = this.add.text(centerX + hudWidth / 2 + 26, hudY, '', {
            fontFamily: FONT_DISPLAY,
            fontSize: '26px',
            color: GOLD_BRIGHT,
            stroke: '#140d06',
            strokeThickness: 4
        }).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0);
    }

    private updateHud() {
        this.scoreValueText.setText(Math.round(this.score).toString());

        const progress = 1 - levelsUntilNextStage(this.maxLevel) / LEVELS_PER_STAGE;
        this.stageProgressBar.width = this.stageProgressWidth * Phaser.Math.Clamp(progress, 0, 1);

        this.comboText.setText(this.comboMultiplier > 1 ? `x${this.comboMultiplier}` : '');
    }

    changeScene() {
        this.scene.start('GameOver');
    }

    private triggerDoubleJump() {
        if (this.hasDoubleJumped) {
            return;
        }
        this.hasDoubleJumped = true;
        this.playAnimation('ninja-double', false);
    }

    private playAnimation(key: string, ignoreIfSame = true) {
        if (ignoreIfSame && this.currentAnimKey === key) {
            return;
        }
        this.player.anims.play(key, true);
        this.currentAnimKey = key;
    }
}
