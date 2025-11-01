import { Scene } from 'phaser';

export class Game extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor() {
        super('Game');
    }

    preload() {
        this.load.image('sky', 'assets/sky.png');
        this.load.image('ground', 'assets/platform.png');
        this.load.image('star', 'assets/star.png');
        this.load.image('bomb', 'assets/bomb.png');
        this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });
    }

    create() {
        this.add.image(512, 384, 'sky').setDisplaySize(1024, 768);

        const platforms = this.physics.add.staticGroup();
        platforms.create(500, 580, 'ground').setScale(3).refreshBody();
        platforms.create(600, 450, 'ground');
        platforms.create(50, 250, 'ground');
        platforms.create(750, 220, 'ground');

        this.player = this.physics.add.sprite(100, 450, 'dude');
        this.player.setBounce(0.2);
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(300);

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

        this.physics.add.collider(this.player, platforms);

        this.cursors = this.input.keyboard.createCursorKeys();

        this.gameText = this.add.text(400, 100, 'Welcome to the Game!', {
            fontFamily: 'Arial', 
            fontSize: '32px', 
            color: '#ffffff', 
            align: 'center'
        }).setOrigin(0.5);

        EventBus.emit('current-scene-ready', this);

        let ix = 0;
        moves.subscribe(mv => {
            if (!mv.length) return

            const latestMove = mv[mv.length - 1]

            const newText = latestMove.piece + " (" + latestMove.color + ") moved from " + latestMove.from + " to " + latestMove.to


            if (latestMove.color === 'w') {
                let toPos = String(latestMove.to);
                let fromPos = String(latestMove.from);
                let fromLetter = fromPos.charAt(0);
                let fromNumber = fromPos.charAt(1);
                let toLetter = toPos.charAt(0);
                let toNumber = toPos.charAt(1);
                let dx = toLetter.charCodeAt(0) - fromLetter.charCodeAt(0);
                let dy = parseInt(toNumber) - parseInt(fromNumber);
                console.log(dx, dy);
                ix += dx;
                this.player.setVelocityY(Math.min((Math.pow(dy, 1/2)*4000/3), 2000));
                this.player.setVelocityX(dx * 50);
            }
            
            this.gameText.setText(newText)
        })
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

        // Intended logic is to prevent player from going off the screen
        // if (this.player.y > 580) {
        //     this.player.setPosition(this.player.x, 450)
        // }
    }

    changeScene() {
        this.scene.start('GameOver');
    }


}
