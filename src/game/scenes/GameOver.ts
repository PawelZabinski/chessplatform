import { leaderboard } from '../../lib/stores/chess';
import { ChessEvents, EventBus } from '../EventBus';
import { Scene } from 'phaser';
import {
    PALETTE,
    INK,
    INK_SOFT,
    GOLD,
    FONT_BODY,
    FONT_DISPLAY,
    bannerHeading,
    drawBackdrop,
    ornateButton,
    parchmentPanel
} from '../theme';

export class GameOver extends Scene {
    private gameOverReason!: string;
    private winner!: string;
    private isVictory!: boolean;
    private maxScore!: number;
    private difficulty!: string;
    private stageName!: string;
    private stagesCleared!: number;
    private hasSavedToLeaderboard!: boolean;
    private saveButtonText!: Phaser.GameObjects.Text;

    constructor() {
        super('GameOver');
    }

    init(data: {
        reason: string;
        result: number;
        maxScore: number;
        difficulty: string;
        stageName?: string;
        stagesCleared?: number;
    }) {
        this.maxScore = data.maxScore;
        this.gameOverReason = data.reason;
        this.isVictory = data.result === 1;
        this.winner =
            data.result === 1
                ? 'The board is yours'
                : data.result === 0.5
                ? 'A drawn game'
                : 'The board is lost';
        this.difficulty = data.difficulty;
        this.stageName = data.stageName ?? 'Foothills';
        this.stagesCleared = data.stagesCleared ?? 0;
    }

    create() {
        const centerX = this.scale.width / 2;
        this.hasSavedToLeaderboard = false;

        drawBackdrop(this);

        bannerHeading(this, centerX, 96, this.isVictory ? 'Victory' : 'The Climb Ends', 54);

        // Scroll of results
        const panelHeight = 236;
        const panelY = 300;
        parchmentPanel(this, centerX, panelY, 620, panelHeight);

        this.add
            .text(centerX, panelY - 82, this.winner, {
                fontFamily: FONT_DISPLAY,
                fontSize: 32,
                color: INK
            })
            .setOrigin(0.5);

        this.add
            .text(centerX, panelY - 42, this.gameOverReason, {
                fontFamily: FONT_BODY,
                fontSize: 19,
                color: INK_SOFT,
                align: 'center',
                wordWrap: { width: 560 }
            })
            .setOrigin(0.5);

        this.add.rectangle(centerX, panelY - 8, 520, 1, PALETTE.parchmentEdge, 0.6);

        // Headline score, the one number that matters.
        this.add
            .text(centerX, panelY + 34, this.maxScore.toLocaleString(), {
                fontFamily: FONT_DISPLAY,
                fontSize: 56,
                color: '#7b2230'
            })
            .setOrigin(0.5);

        this.add
            .text(centerX, panelY + 72, 'FINAL SCORE', {
                fontFamily: FONT_BODY,
                fontSize: 15,
                color: INK_SOFT
            })
            .setOrigin(0.5);

        if (this.isVictory) {
            this.add
                .text(centerX, panelY + 96, 'chess victory — score doubled', {
                    fontFamily: FONT_BODY,
                    fontSize: 15,
                    color: '#2f4a32'
                })
                .setOrigin(0.5);
        }

        // Stage summary strip beneath the scroll.
        this.add
            .text(
                centerX,
                panelY + panelHeight / 2 + 34,
                `Reached ${this.stageName}   ·   ${this.stagesCleared} stage${this.stagesCleared === 1 ? '' : 's'} cleared   ·   ${this.difficulty}`,
                {
                    fontFamily: FONT_BODY,
                    fontSize: 19,
                    color: GOLD,
                    stroke: '#140d06',
                    strokeThickness: 3
                }
            )
            .setOrigin(0.5);

        ornateButton(this, centerX, 500, 'Climb Again', () => {
            EventBus.emit(ChessEvents.resetBoard);
            this.scene.start('Game', { difficulty: this.difficulty });
        }, { fontSize: 28 });

        const saveButton = ornateButton(
            this,
            centerX,
            574,
            'Record in the Hall',
            () => this.saveScore(),
            { fill: PALETTE.royal, fillHover: PALETTE.royalLight }
        );
        this.saveButtonText = saveButton.text;

        ornateButton(this, centerX, 648, 'Return to Gate', () => {
            EventBus.emit(ChessEvents.resetBoard);
            this.scene.start('StartMenu');
        }, { fill: PALETTE.crimson, fillHover: PALETTE.crimsonLight });

        EventBus.emit('current-scene-ready', this);
    }

    private saveScore() {
        if (this.hasSavedToLeaderboard) {
            return;
        }

        const name = prompt('By what name shall you be recorded?');
        leaderboard.add({
            name: name ? name : 'Anonymous',
            score: this.maxScore,
            difficulty: this.difficulty,
            stage: this.stageName
        });

        this.hasSavedToLeaderboard = true;
        this.saveButtonText.setText('Recorded ✓');
    }

    changeScene() {
        this.scene.start('Game');
    }
}
