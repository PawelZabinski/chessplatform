import { Scene } from 'phaser';
import { ChessEvents, EventBus } from '../EventBus';
import { moves } from '$lib/stores/chess';

export class Game extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor() {
        super('Game');
    }


    createLevel(level) {
        // const lowerLimit = 768 - level * 200 + 50
        // const upperLimit = lowerLimit + 200 - 50
        // const y = lowerLimit + Math.random() * (upperLimit - lowerLimit)
        const y = 768 - level * 200
        const rand = Math.random()
        const numberPlatforms = rand < 0.1 ? 1 : (rand < 0.75 ? 1 : 2)
        for (let i = 0; i < numberPlatforms; i++) {
            const x = Math.random() * 1024
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
        const skyHeight = 768;
        let yPosition = 0;
        for (let i = 0; i < 10; i++) {
            let sky = this.add.image(0, yPosition, 'sky')
                .setOrigin(0, 0)
                .setDisplaySize(this.scale.width, skyHeight);  // this.scale.height does not work
             sky.flipY = (i % 2 === 0);  // Flip every other sky
            yPosition -= skyHeight;
        }

        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(500, 650, 'ground').setScale(3).refreshBody();
        for (let i = 1; i <= 10; i++) {
            this.createLevel(i)
        }
        
        // function generateUniformDistribution(count) {
        //     let uniformNumbers = [];
        //     for (let i = 0; i < count; i++) {
        //         uniformNumbers.push(Math.floor(Math.random() * (1024 + 1)));
        //     }
        //     return uniformNumbers;
        // }

        // function generateIncrementingList(count) {
        //     let incrementingList = [400];
        //     let currentValue = 400;
            
        //     for (let i = 0; i < count - 1; i++) {
        //         let increment = Math.random() < 0.75 ? 0 : -150;
        //         currentValue += increment;
        //         incrementingList.push(currentValue);
        //     }
            
        //     return incrementingList;
        // }

        // let xs = generateUniformDistribution(10);
        // let ys = generateIncrementingList(10);

        // console.log('Uniform List:', xs);
        // console.log('Incrementing List:', ys);

        // for (let i = 0; i < xs.length; i++) {
        //     this.platforms.create(xs[i], ys[i], 'ground')
        //     console.log('x:', xs[i], 'y:', ys[i]);
        // }


        // let levels = [];
        // let startValue = 550;

        // for (let i = 1; i <= 10; i++) {
        //     let endValue = startValue + 200;
        //     let levelData = { level: i, range: [startValue, endValue], numbers: [] };

        //     // Randomly decide how many pairs (0, 1, or 2 pairs) to generate for this level
        //     let numCount = Math.floor(Math.random() * 3);  // 0, 1, or 2 pairs

        //     // Generate the pairs of random numbers
        //     for (let j = 0; j < numCount; j++) {
        //         let firstNumber = Math.floor(Math.random() * 769); // First random number between 0 and 768
        //         let secondNumber = Math.floor(Math.random() * (endValue - startValue + 1)) + startValue; // Second random number in range [startValue, endValue]
        //         levelData.numbers.push([firstNumber, secondNumber]);  // Pair the two numbers
        //     }

        //     levels.push(levelData);
        //     startValue = endValue - 400; // Move to the next starting value
        // }

        

        // console.log(levels);



        // this.platforms.create(600, 450, 'ground');
        // this.platforms.create(50, 350, 'ground');
        // this.platforms.create(750, 250, 'ground');

        this.player = this.physics.add.sprite(100, 550, 'dude');
        this.player.setBounce(0.2);
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(350);
        this.player.body.setMaxVelocity(800);

        let camera = this.cameras.main;
        camera.startFollow(this.player); 
        camera.setBounds(0, -1000000, 1024, 1000000+768); // Only follows player in y direction

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
                
                const desiredVy = -Math.sqrt(dy) * 400 // negative = up
                // if player is already going up slower than desired, boost it
                if (this.player.body.velocity.y > desiredVy) {
                    this.player.setVelocityY(desiredVy);
                }

                this.player.setVelocityX(dx * 50);
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
        //     this.player.setVelocityX(-160);
        //     this.player.anims.play('left', true);
        // }
        // else if (this.cursors.right.isDown) {
        //     this.player.setVelocityX(160);
        //     this.player.anims.play('right', true);
        // }
        // else {
        //     this.player.setVelocityX(0);
        //     this.player.anims.play('turn');
        // }

        // Handle jumping (only if the player is touching the ground)
        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-330);
        }

        // If player is directly under a platform and is moving upwards fast enough, the player should automatically move onto the platform.
        // values to be adjusted

        // Create level

    }

    changeScene() {
        this.scene.start('GameOver');
    }
}
