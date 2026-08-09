import { ChessEvents, EventBus } from '../EventBus';
import { Scene } from 'phaser';
import {
    PALETTE,
    GOLD,
    PARCHMENT,
    FONT_BODY,
    bannerHeading,
    caption,
    drawBackdrop,
    ornateButton
} from '../theme';

const DIFFICULTIES = ['Novice', 'Intermediate', 'Expert'] as const;

const DIFFICULTY_BLURB: Record<string, string> = {
    Novice: 'The engine blunders often. A gentle climb.',
    Intermediate: 'The engine plays half its moves in earnest.',
    Expert: 'The engine shows little mercy. Climb fast.'
};

export class StartMenu extends Scene {
    private selectedDifficulty: string = 'Intermediate';
    private difficultyButton!: ReturnType<typeof ornateButton>;
    private blurb!: Phaser.GameObjects.Text;

    constructor() {
        super('StartMenu');
    }

    create() {
        const centerX = this.scale.width / 2;
        drawBackdrop(this);

        bannerHeading(this, centerX, 118, 'ChessPlatform', 58);
        caption(
            this,
            centerX,
            196,
            'Your moves on the board drive the climb. Every square you advance lifts the ninja higher.',
            19
        );

        // Difficulty is presented as a cycling plaque rather than a bare button.
        let currentIndex = DIFFICULTIES.indexOf(this.selectedDifficulty as typeof DIFFICULTIES[number]);
        if (currentIndex === -1) currentIndex = 1;

        this.difficultyButton = ornateButton(
            this,
            centerX,
            400,
            `Difficulty  ·  ${DIFFICULTIES[currentIndex]}`,
            () => {
                currentIndex = (currentIndex + 1) % DIFFICULTIES.length;
                this.selectedDifficulty = DIFFICULTIES[currentIndex];
                this.difficultyButton.text.setText(`Difficulty  ·  ${this.selectedDifficulty}`);
                this.blurb.setText(DIFFICULTY_BLURB[this.selectedDifficulty]);
                EventBus.emit(ChessEvents.selectDifficulty, this.selectedDifficulty);
            },
            { fill: PALETTE.royal, fillHover: PALETTE.royalLight }
        );

        this.blurb = caption(this, centerX, 452, DIFFICULTY_BLURB[this.selectedDifficulty], 17);
        this.blurb.setColor(GOLD);

        ornateButton(this, centerX, 310, 'Begin the Climb', () => {
            EventBus.emit(ChessEvents.resetBoard);
            this.scene.start('Game', { difficulty: this.selectedDifficulty });
        }, { fontSize: 30 });

        ornateButton(this, centerX, 530, 'Hall of Champions', () => {
            this.scene.start('Leaderboard');
        }, { fill: PALETTE.crimson, fillHover: PALETTE.crimsonLight });

        this.drawControlsPlaque(centerX, this.scale.height - 96);

        EventBus.emit('current-scene-ready', this);
    }

    /** Footer strip explaining the two-screen control scheme. */
    private drawControlsPlaque(x: number, y: number) {
        this.add.rectangle(x, y, 640, 2, PALETTE.gold, 0.5);

        const lines = [
            '↑  jump  ·  double-jump in mid-air',
            'a chess move launches the ninja — files steer, ranks lift',
            'spikes cost you a piece  ·  clearing a stage wins one back'
        ];

        lines.forEach((line, i) => {
            this.add
                .text(x, y + 22 + i * 22, line, {
                    fontFamily: FONT_BODY,
                    fontSize: '16px',
                    color: PARCHMENT,
                    stroke: '#140d06',
                    strokeThickness: 3
                })
                .setOrigin(0.5)
                .setAlpha(0.85);
        });
    }

    changeScene() {
        this.scene.start('Game');
    }
}
