import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { leaderboard } from '$lib/stores/chess';
import { get } from 'svelte/store';

export class Leaderboard extends Scene {
    private background!: Phaser.GameObjects.Image;

    constructor() {
        super('Leaderboard');
    }

    create() {
        // background
        this.background = this.add.image(0, 0, 'background')
            .setOrigin(0, 0)
            .setDisplaySize(this.scale.width, this.scale.height)
            .setAlpha(0.5);

        // title
        this.add.text(this.scale.width / 2, 80, 'Leaderboard', {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

		const scores = get(leaderboard).sort((a, b) => b.score - a.score);

        // table layout
        const tableX = this.scale.width / 2;
        const tableY = 160;
        const tableWidth = 700;
        const rowHeight = 60;
        const numRows = scores.length + 1; // header + data

        // draw table background rectangle
        const tableHeight = rowHeight * numRows + 20;
        const tableRect = this.add.rectangle(tableX, tableY + tableHeight / 2, tableWidth, tableHeight, 0x000000, 0.5)
            .setStrokeStyle(3, 0xffffff);

        // header row
        const headers = ['Player', 'Score', 'Difficulty'];
        const columnX = [
            tableX - tableWidth / 3,
            tableX,
            tableX + tableWidth / 3
        ];

        headers.forEach((header, i) => {
            this.add.text(columnX[i], tableY + 30, header, {
                fontFamily: 'Arial',
                fontSize: '28px',
                color: '#ffffaa',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        });

        // rows
        scores.forEach((entry, index) => {
            const y = tableY + rowHeight * (index + 1.5);

            // alternating row background color
            const rowBg = this.add.rectangle(tableX, y, tableWidth - 20, rowHeight - 10, index % 2 ? 0x111111 : 0x222222, 0.6)
                .setStrokeStyle(1, 0x555555);

            // player name
            this.add.text(columnX[0], y, entry.name, {
                fontFamily: 'Arial',
                fontSize: '26px',
                color: '#ffffff'
            }).setOrigin(0.5);

            // score
            this.add.text(columnX[1], y, entry.score.toString(), {
                fontFamily: 'Arial',
                fontSize: '26px',
                color: '#ffffff'
            }).setOrigin(0.5);

			// difficulty
            const diffColor =
                entry.difficulty === 'Novice'
                    ? '#24d124ff'
                    : entry.difficulty === 'Intermediate'
                    ? '#2c9ed6ff'
                    : '#dc6565ff';
            this.add.text(columnX[2], y, entry.difficulty, {
                fontFamily: 'Arial',
                fontSize: '26px',
                color: diffColor
            }).setOrigin(0.5);
        });

        // back button
        const backRect = this.add.rectangle(tableX, tableY + tableHeight + 70, 220, 60, 0x003366)
            .setStrokeStyle(3, 0xffffff)
            .setInteractive({ useHandCursor: true });

        const backText = this.add.text(tableX, tableY + tableHeight + 70, 'Back to Menu', {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#ffffff'
        }).setOrigin(0.5);

        backRect.on('pointerover', () => backRect.setFillStyle(0x002244));
        backRect.on('pointerout', () => backRect.setFillStyle(0x003366));
        backRect.on('pointerdown', () => this.scene.start('StartMenu'));

        EventBus.emit('current-scene-ready', this);
    }
}
