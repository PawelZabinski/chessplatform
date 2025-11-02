import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

export class GameOver extends Scene {
    private camera!: Phaser.Cameras.Scene2D.Camera;
    private background!: Phaser.GameObjects.Image;
    private gameOverText!: Phaser.GameObjects.Text;
    private gameOverReasonText!: Phaser.GameObjects.Text;
    private maxScoreText!: Phaser.GameObjects.Text;
    private winnerText!: Phaser.GameObjects.Text;
    private playAgainButton!: Phaser.GameObjects.Text;

    private gameOverReason!: string;
    private winner!: string;
    private maxScore!: number;

    constructor ()
    {
        super('GameOver');
    }

    init(data: { reason: string, result: number, maxScore: number }) {
        this.maxScore = data.maxScore;
        this.gameOverReason = data.reason;
        this.winner = data.result == 1 ? ("You've won the chess game!") : (data.result == 0.5 ? "Stalemate!" : ("You've lost the chess game!"));
    }

    create ()
    {
        this.camera = this.cameras.main
        this.camera.setBackgroundColor(0xff0000);

        this.background = this.add.image(0, 0, 'background')
            .setOrigin(0, 0)
            .setDisplaySize(this.scale.width, this.scale.height)
        this.background.setAlpha(0.3);

        this.gameOverText = this.add.text(512, 50, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#cc6969ff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        this.gameOverReasonText = this.add.text(512, 150, this.gameOverReason, {
            fontFamily: 'Arial Black', fontSize: 64, color: '#f1cd62ff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        this.winnerText = this.add.text(512, 250, this.winner, {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        this.maxScoreText = this.add.text(512, 350, `Max Score in Game: ${this.maxScore}`, {
            fontFamily: 'Arial Black', fontSize: 64, color: '#62f167ff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        this.playAgainButton = this.add.text(512, 450, 'Play Again', {
            fontSize: '32px',
            color: '#00ff00'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {}); // A play again function needs to be called here
        
        EventBus.emit('current-scene-ready', this);
    }

    changeScene ()
    {
        this.scene.start('Game');
    }
}
