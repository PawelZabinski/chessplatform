import { Scene } from 'phaser';
import { PALETTE, GOLD_BRIGHT, PARCHMENT, FONT_BODY, FONT_DISPLAY, drawBackdrop } from '../theme';

/** Webfonts Phaser text depends on; canvas text won't reflow once drawn. */
const REQUIRED_FONTS = [
    '700 32px "Cinzel Decorative"',
    '900 32px "Cinzel Decorative"',
    '400 24px "Cinzel"',
    '600 24px "Cinzel"'
];

export class Preloader extends Scene {
    private bar!: Phaser.GameObjects.Rectangle;

    constructor() {
        super('Preloader');
    }

    init() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        drawBackdrop(this);

        this.add
            .text(centerX, centerY - 70, 'ChessPlatform', {
                fontFamily: FONT_DISPLAY,
                fontSize: 44,
                color: GOLD_BRIGHT,
                stroke: '#1a1109',
                strokeThickness: 6
            })
            .setOrigin(0.5);

        this.add
            .text(centerX, centerY - 20, 'preparing the climb…', {
                fontFamily: FONT_BODY,
                fontSize: 18,
                color: PARCHMENT
            })
            .setOrigin(0.5);

        const barWidth = 420;
        this.add
            .rectangle(centerX, centerY + 30, barWidth + 10, 26, PALETTE.oak, 0.9)
            .setStrokeStyle(2, PALETTE.gold, 0.8);

        this.bar = this.add
            .rectangle(centerX - barWidth / 2, centerY + 30, 4, 16, PALETTE.gold, 1)
            .setOrigin(0, 0.5);

        this.load.on('progress', (progress: number) => {
            this.bar.width = 4 + (barWidth - 8) * progress;
        });
    }

    preload() {
        this.load.setPath('assets');
    }

    async create() {
        // Phaser renders text to canvas once, so a font that arrives late would
        // leave every label in the fallback serif. Wait for them before the menu.
        await this.loadFonts();
        this.scene.start('StartMenu');
    }

    private async loadFonts() {
        if (typeof document === 'undefined' || !document.fonts) {
            return;
        }

        try {
            await Promise.all(REQUIRED_FONTS.map((font) => document.fonts.load(font)));
            await document.fonts.ready;
        } catch {
            // A font CDN failure shouldn't block the game; fall back to serif.
        }
    }
}
