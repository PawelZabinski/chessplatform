import { Scene } from 'phaser';
import { ChessEvents, EventBus } from '../EventBus';
import { moves } from '$lib/stores/chess';

const SCREEN_DIMENSIONS = [1024, 768];
const LEVEL_HEIGHT = 150;
const INITIAL_GROUND_POSITION = [500, 650];
const PLAYER_Y_GRAVITY = 350;
const PLAYER_COLLISION_BOUNCE = 0.2;
const PLAYER_MAX_VELOCITY = 800;

const X_VELOCITY_MULTIPLIER = 50;
const Y_VELOCITY_MULTIPLIER = 400;

export class Game extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private currentLevel = 0;
    private maxLevel = 0;
    private highestLevelGenerated = 0;

    constructor() {
        super('Game');
    }


    createLevel(level) {
        const y = SCREEN_DIMENSIONS[1] - level * LEVEL_HEIGHT
        const rand = Math.random()
        const numberPlatforms = rand < 0.1 ? 1 : (rand < 0.75 ? 1 : 2)
        for (let i = 0; i < numberPlatforms; i++) {
            const x = Math.random() * SCREEN_DIMENSIONS[0]
            // we now have (x, y) for this platform
            this.platforms.create(x, y, 'ground')
        }
    }

    preload() {
        this.load.image('sky', 'assets/sky.png');
        this.load.image('ground', 'assets/platform.png');
        this.load.image('star', 'assets/star.png');
        this.load.image('bomb', 'assets/bomb.png');
        this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });
    }

    create() {
        // Repeating alternating (light blue, dark blue) sky pattern
        const skyHeight = SCREEN_DIMENSIONS[1];
        let yPosition = 0;
        for (let i = 0; i < 1e3; i++) {
            let sky = this.add.image(0, yPosition, 'sky')
                .setOrigin(0, 0)
                .setDisplaySize(this.scale.width, skyHeight);  // this.scale.height does not work
             sky.flipY = (i % 2 === 0);  // Flip every other sky
            yPosition -= skyHeight;
        }

        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(INITIAL_GROUND_POSITION[0], INITIAL_GROUND_POSITION[1], 'ground').setScale(3).refreshBody();
        for (let i = 1; i <= 10; i++) {
            this.createLevel(i)
        }

        this.highestLevelGenerated = 10;

        this.player = this.physics.add.sprite(INITIAL_GROUND_POSITION[0], INITIAL_GROUND_POSITION[1] - 100, 'dude');
        this.player.setBounce(PLAYER_COLLISION_BOUNCE);
        this.player.body.setGravityY(PLAYER_Y_GRAVITY);
        this.player.body.setMaxVelocity(PLAYER_MAX_VELOCITY);
        this.player.setCollideWorldBounds(true);


        let camera = this.cameras.main;
        camera.startFollow(this.player); 
        camera.setBounds(0, -10e6, SCREEN_DIMENSIONS[0], 10e6+SCREEN_DIMENSIONS[1]); // Only follows player in y direction

        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'turn',
            frames: [{ key: 'dude', frame: 4 }],
            frameRate: 20
        });

        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
            frameRate: 10,
            repeat: -1
        });

        this.physics.world.setBoundsCollision(true, true, false, true);
        this.physics.add.collider(
            this.player,
            this.platforms,
            undefined, // optional collide callback
            (player, platform) => { 
                const p = player as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
                const plat = platform as Phaser.Physics.Arcade.Image;

                // only collide if player is falling and above the platform
                return p.body.velocity.y >= 0 && p.body.bottom <= plat.body.top + 10;
            },
            this
        );
        this.cursors = this.input.keyboard.createCursorKeys();

        this.gameText = this.add.text(400, 100, 'Welcome to the Game!', {
            fontFamily: 'Arial', 
            fontSize: '32px', 
            color: '#ffffff', 
            align: 'center'
        }).setOrigin(0.5);

        EventBus.emit('current-scene-ready', this);

        const handleGameOver = (detail) => {
            this.scene.start("GameOver", { reason: detail.reason, result: detail.result })
        }
        EventBus.on(ChessEvents.gameOver, handleGameOver);

        const unsubscribe = moves.subscribe(mv => {
            if (!mv.length) return;
            const latestMove = mv[mv.length - 1];
            const newText = latestMove.piece + " (" + latestMove.color + ") moved from " + latestMove.from + " to " + latestMove.to;

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
                if (this.player.body.velocity.y > desiredVy) {
                    this.player.setVelocityY(desiredVy);
                }

                this.player.setVelocityX(dx * X_VELOCITY_MULTIPLIER);
            }
            
            this.gameText.setText(newText);
        })

        this.events.once('shutdown', () => {
            EventBus.off(ChessEvents.gameOver, handleGameOver);
            unsubscribe();
        });
    }


    update() {
        // Control left and right movement
        // if (this.cursors.left.isDown) {
        //     this.player.setVelocityX(-260);
        //     this.player.anims.play('left', true);
        // }
        // else if (this.cursors.right.isDown) {
        //     this.player.setVelocityX(260);
        //     this.player.anims.play('right', true);
        // }
        // else {
        //     this.player.setVelocityX(0);
        //     this.player.anims.play('turn');
        // }

        // Handle jumping (only if the player is touching the ground)
        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-530);
        }

        // If player is directly under a platform and is moving upwards fast enough, the player should automatically move onto the platform.
        // values to be adjusted

        // Create level

        this.currentLevel = Math.floor((SCREEN_DIMENSIONS[1] - this.player.y) / LEVEL_HEIGHT)
        console.log(this.currentLevel)

        if (this.currentLevel > this.maxLevel) {
            console.log("NEW BEST")
            // 7 -> 9
            // 17 -> 18 and 19
            this.maxLevel = this.currentLevel
            console.log(this.highestLevelGenerated + 1, this.maxLevel + 10)
            for (let i = this.highestLevelGenerated + 1; i <= this.maxLevel + 10; i++) {
                console.log("new level")
                this.createLevel(i)
            }

            this.highestLevelGenerated = this.maxLevel + 10
        }
    }

    changeScene() {
        this.scene.start('GameOver');
    }
}
