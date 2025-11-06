import { leaderboard } from '../../lib/stores/chess';
import { ChessEvents, EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class GameOver extends Scene {
    private background!: Phaser.GameObjects.Image;
    private gameOverReason!: string;
    private winner!: string;
    private maxScore!: number;
    private difficulty!: string;
    private hasSavedToLeaderboard = false;

    constructor() {
        super('GameOver');
    }

    init(data: { reason: string; result: number; maxScore: number, difficulty: string }) {
        this.maxScore = data.maxScore;
        this.gameOverReason = data.reason;
        this.winner =
            data.result === 1
                ? "You've won the chess game!"
                : data.result === 0.5
                ? 'Stalemate!'
                : "You've lost the chess game!";
        this.difficulty = data.difficulty
    }

    create() {
        // background
        const camera = this.cameras.main 
        camera.setBackgroundColor(0xff0000);

        const bgKey = this.textures.exists('background') ? 'background' : 'sky';
        const bgSource = this.textures.get(bgKey).getSourceImage() as HTMLImageElement;
        const bgScale = Math.max(
            1,
            Math.ceil(
                Math.max(
                    this.scale.width / bgSource.width,
                    this.scale.height / bgSource.height
                )
            )
        );
        const bgWidth = bgSource.width * bgScale;
        const bgHeight = bgSource.height * bgScale;
        const bgOffsetX = (this.scale.width - bgWidth) / 2;
        const bgOffsetY = (this.scale.height - bgHeight) / 2;

        this.background = this.add
            .image(bgOffsetX, bgOffsetY, bgKey)
            .setOrigin(0, 0)
            .setScale(bgScale)
            .setAlpha(0.3);

        // main title
        this.add
            .text(this.scale.width / 2, 120, 'Game Over', {
                fontFamily: 'Arial Black',
                fontSize: 64,
                color: '#f0cfcfff',
                stroke: '#000000',
                strokeThickness: 8,
                align: 'center',
            })
            .setOrigin(0.5);

        // reason
        this.add
            .text(this.scale.width / 2, 290, this.gameOverReason, {
                fontFamily: 'Arial Black',
                fontSize: 36,
                color: '#e9c3c2ff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center',
                wordWrap: { width: 800 },
            })
            .setOrigin(0.5);

        // result text
        this.add
            .text(this.scale.width / 2, 220, this.winner, {
                fontFamily: 'Arial Black',
                fontSize: 40,
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center',
            })
            .setOrigin(0.5);

        // score text
        this.add
            .text(
                this.scale.width / 2,
                360,
                `Max Score: ${this.maxScore}`,
                {
                    fontFamily: 'Arial Black',
                    fontSize: 36,
                    color: '#66ff66',
                    stroke: '#000000',
                    strokeThickness: 6,
                    align: 'center',
                }
            )
            .setOrigin(0.5);

        // reusable button builder
        const makeButton = (
            label: string,
            y: number,
            color: number,
            hoverColor: number,
            onClick: () => void
        ) => {
            const x = this.scale.width / 2;
            const rect = this.add
                .rectangle(x, y, 300, 60, color)
                .setStrokeStyle(3, 0xffffff)
                .setInteractive({ useHandCursor: true });

            const text = this.add
                .text(x, y, label, {
                    fontFamily: 'Arial',
                    fontSize: '28px',
                    color: '#ffffff',
                })
                .setOrigin(0.5);

            rect.on('pointerover', () => rect.setFillStyle(hoverColor));
            rect.on('pointerout', () => rect.setFillStyle(color));
            rect.on('pointerdown', onClick);
        };

        // buttons
        makeButton('Play Again', 460, 0x004400, 0x002200, () => {
            EventBus.emit(ChessEvents.resetBoard)
            this.scene.start('Game', { difficulty: this.difficulty });
        });

        makeButton('Save to Leaderboard', 540, 0x333377, 0x111155, () => {
            EventBus.emit(ChessEvents.resetBoard)

            if (this.hasSavedToLeaderboard) return alert("You've already saved your score!")

            const name = prompt("What is your name? ")
            
            leaderboard.add({ name: name ? name : "Anonymous", score: this.maxScore, difficulty: this.difficulty })
            this.hasSavedToLeaderboard = true
        });

        makeButton('Return to Menu', 620, 0x006666, 0x003333, () => {
            EventBus.emit(ChessEvents.resetBoard)
            this.scene.start('StartMenu');
        });

        EventBus.emit('current-scene-ready', this);
    }

    changeScene() {
        this.scene.start('Game');
    }
}
