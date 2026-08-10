import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { leaderboard } from '$lib/stores/chess';
import { get } from 'svelte/store';
import {
    PALETTE,
    INK,
    INK_SOFT,
    FONT_BODY,
    FONT_DISPLAY,
    bannerHeading,
    caption,
    drawBackdrop,
    ornateButton,
    parchmentPanel
} from '../theme';

const MAX_ROWS = 8;
const ROW_HEIGHT = 46;

/** Medal tints for the top three places. */
const RANK_COLOR = ['#a8801f', '#6f6f78', '#8a5a2b'];

export class Leaderboard extends Scene {
    constructor() {
        super('Leaderboard');
    }

    create() {
        const centerX = this.scale.width / 2;
        drawBackdrop(this);

        bannerHeading(this, centerX, 96, 'Hall of Champions', 50);

        const scores = get(leaderboard)
            .slice()
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_ROWS);

        const tableWidth = 860;
        const headerHeight = 46;
        const bodyHeight = Math.max(ROW_HEIGHT, scores.length * ROW_HEIGHT);
        const panelHeight = headerHeight + bodyHeight + 28;
        const panelY = 200 + panelHeight / 2;

        parchmentPanel(this, centerX, panelY, tableWidth, panelHeight);

        const top = panelY - panelHeight / 2;
        const columnX = [
            centerX - tableWidth * 0.44, // rank
            centerX - tableWidth * 0.34, // name
            centerX - tableWidth * 0.02, // score
            centerX + tableWidth * 0.16, // stage
            centerX + tableWidth * 0.36 // games won
        ];

        // Header
        const headers = ['#', 'Champion', 'Score', 'Stage', 'Games Won'];
        const headerOrigins = [0, 0, 1, 0.5, 0.5];
        headers.forEach((header, i) => {
            this.add
                .text(columnX[i], top + 28, header, {
                    fontFamily: FONT_DISPLAY,
                    fontSize: '19px',
                    color: INK
                })
                .setOrigin(headerOrigins[i], 0.5);
        });

        this.add.rectangle(centerX, top + headerHeight + 2, tableWidth - 40, 1, PALETTE.parchmentEdge, 0.8);

        if (scores.length === 0) {
            this.add
                .text(centerX, top + headerHeight + bodyHeight / 2, 'No champions yet. Be the first to climb.', {
                    fontFamily: FONT_BODY,
                    fontSize: '20px',
                    color: INK_SOFT
                })
                .setOrigin(0.5);
        }

        scores.forEach((entry, index) => {
            const y = top + headerHeight + 14 + index * ROW_HEIGHT + ROW_HEIGHT / 2;

            // Alternating banding, kept subtle so parchment still reads as paper.
            if (index % 2 === 1) {
                this.add.rectangle(centerX, y, tableWidth - 40, ROW_HEIGHT - 6, PALETTE.parchmentDark, 0.55);
            }

            const rankColor = RANK_COLOR[index] ?? INK_SOFT;
            this.add
                .text(columnX[0], y, `${index + 1}`, {
                    fontFamily: FONT_DISPLAY,
                    fontSize: '22px',
                    color: rankColor
                })
                .setOrigin(0, 0.5);

            this.add
                .text(columnX[1], y, entry.name, {
                    fontFamily: FONT_BODY,
                    fontSize: '22px',
                    color: INK
                })
                .setOrigin(0, 0.5);

            this.add
                .text(columnX[2], y, entry.score.toLocaleString(), {
                    fontFamily: FONT_DISPLAY,
                    fontSize: '24px',
                    color: '#7b2230'
                })
                .setOrigin(1, 0.5);

            // Entries saved before stages existed have no stage recorded.
            this.add
                .text(columnX[3], y, entry.stage ?? '—', {
                    fontFamily: FONT_BODY,
                    fontSize: '19px',
                    color: INK_SOFT
                })
                .setOrigin(0.5);

            // Older entries predate the games-won counter.
            this.add
                .text(columnX[4], y, entry.gamesWon === undefined ? '—' : `${entry.gamesWon}`, {
                    fontFamily: FONT_DISPLAY,
                    fontSize: '20px',
                    color: entry.gamesWon ? '#2f6b34' : INK_SOFT
                })
                .setOrigin(0.5);
        });

        if (get(leaderboard).length > MAX_ROWS) {
            caption(this, centerX, panelY + panelHeight / 2 + 26, `showing the top ${MAX_ROWS} of ${get(leaderboard).length}`, 15);
        }

        ornateButton(this, centerX, panelY + panelHeight / 2 + 82, 'Return to Gate', () => {
            this.scene.start('StartMenu');
        }, { fill: PALETTE.crimson, fillHover: PALETTE.crimsonLight });

        EventBus.emit('current-scene-ready', this);
    }
}
