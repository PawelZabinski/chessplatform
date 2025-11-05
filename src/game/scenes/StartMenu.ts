import { ChessEvents, EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class StartMenu extends Scene {
    private camera!: Phaser.Cameras.Scene2D.Camera;
    private background!: Phaser.GameObjects.Image;
    private selectedDifficulty: string = 'Normal';

    private difficultyButton;

    constructor() {
        super('StartMenu');
    }

    create() {
        this.camera = this.cameras.main;

        const skySource = this.textures.get('sky').getSourceImage() as HTMLImageElement;
        const skyScale = Math.max(
            1,
            Math.ceil(
                Math.max(
                    this.scale.width / skySource.width,
                    this.scale.height / skySource.height
                )
            )
        );
        const displayWidth = skySource.width * skyScale;
        const displayHeight = skySource.height * skyScale;
        const offsetX = (this.scale.width - displayWidth) / 2;
        const offsetY = (this.scale.height - displayHeight) / 2;

        this.background = this.add.image(offsetX, offsetY, 'sky')
            .setOrigin(0, 0)
            .setScale(skyScale)
            .setAlpha(0.5);

        this.add.text(this.scale.width / 2, 150, 'Welcome to ChessPlatform', {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#d0eeccff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        const makeButton = (
            label: string,
            y: number,
            onClick: () => void,
            color = 0x004400
        ) => {
            const width = 350;
            const height = 60;
            const x = this.scale.width / 2;

            const rect = this.add.rectangle(x, y, width, height, color, 0.8)
                .setStrokeStyle(3, 0xffffff)
                .setInteractive({ useHandCursor: true });

            const text = this.add.text(x, y, label, {
                fontFamily: 'Arial',
                fontSize: '28px',
                color: '#ffffff'
            }).setOrigin(0.5);

            rect.on('pointerover', () => rect.setFillStyle(0x228822, 1));
            rect.on('pointerout', () => rect.setFillStyle(color, 0.8));
            rect.on('pointerdown', onClick);

            return { rect, text };
        };

        // difficulty selector
        const difficulties = ['Novice', 'Intermediate', 'Expert'];
        let currentIndex = 1;

        this.difficultyButton = makeButton(
            `Difficulty: ${difficulties[currentIndex]}`,
            450,
            () => {
                currentIndex = (currentIndex + 1) % difficulties.length;
                this.selectedDifficulty = difficulties[currentIndex];
                this.difficultyButton.text.setText(`Difficulty: ${this.selectedDifficulty}`);
                EventBus.emit(ChessEvents.selectDifficulty, this.selectedDifficulty)
            },
            0x222266
        );

        makeButton('Start Game', 350, () => {
            EventBus.emit(ChessEvents.resetBoard)
            this.scene.start('Game', { difficulty: this.selectedDifficulty });
        });

        makeButton('Leaderboard', 550, () => {
            console.log('Opening Leaderboard scene');
            this.scene.start('Leaderboard');
        });

        EventBus.emit('current-scene-ready', this);
    }

    changeScene() {
        this.scene.start('Game');
    }
}
