import { Scene } from 'phaser';
import { get } from 'svelte/store';
import { ChessEvents, EventBus } from '../EventBus';
import { TOTAL_FLOORS } from '../levels';
import { towerProgress } from '$lib/stores/progress';
import {
	FONT_BODY,
	GOLD,
	PALETTE,
	PARCHMENT,
	bannerHeading,
	caption,
	drawBackdrop,
	ornateButton
} from '../theme';

/**
 * Two modes, neither with a difficulty selector.
 *
 * The Tower tunes engine strength per floor. Endless starts gentle and sharpens
 * as you climb and as you win games, so a run is its own difficulty curve.
 */
export class StartMenu extends Scene {
	constructor() {
		super('StartMenu');
	}

	create() {
		const centerX = this.scale.width / 2;
		drawBackdrop(this);

		bannerHeading(this, centerX, 104, 'ChessPlatform', 56);
		caption(
			this,
			centerX,
			178,
			'Your moves on the board are the climb. Captures launch you; stalling burns you.',
			19
		);

		const cleared = Object.keys(get(towerProgress)).length;
		const next = towerProgress.highestUnlocked();

		ornateButton(
			this,
			centerX,
			278,
			cleared === 0 ? 'Enter the Tower' : `Climb the Tower  ·  Floor ${next}`,
			() => this.scene.start('LevelSelect'),
			{ fontSize: 29, width: 400 }
		);

		caption(this, centerX, 328, `${cleared} of ${TOTAL_FLOORS} floors cleared`, 15).setColor(GOLD);

		ornateButton(
			this,
			centerX,
			406,
			'Endless Ascent',
			() => {
				EventBus.emit(ChessEvents.resetBoard);
				this.scene.start('Game', { mode: 'endless' });
			},
			{ fill: PALETTE.royal, fillHover: PALETTE.royalLight, width: 400, fontSize: 27 }
		);

		caption(
			this,
			centerX,
			456,
			'Beat a game and you are flung skyward into the next. The engine sharpens as you climb; the run ends only when you lose.',
			15
		).setColor(GOLD);

		ornateButton(this, centerX, 536, 'Hall of Champions', () => this.scene.start('Leaderboard'), {
			fill: PALETTE.crimson,
			fillHover: PALETTE.crimsonLight,
			width: 400
		});

		this.drawControlsPlaque(centerX, this.scale.height - 116);

		EventBus.emit('current-scene-ready', this);
	}

	private drawControlsPlaque(x: number, y: number) {
		this.add.rectangle(x, y, 720, 2, PALETTE.gold, 0.5);

		const lines = [
			'captures lift you — the bigger the piece, the higher the leap',
			'files steer left and right  ·  space brakes you to a stop',
			'↓ or S drops you through a wooden plank — never through stone',
			'gold runes grant 5s of ← → / A D control and jumps, stacking to 10s',
			'wooden planks can be jumped through — grey stone cannot'
		];

		lines.forEach((line, i) => {
			this.add
				.text(x, y + 20 + i * 21, line, {
					fontFamily: FONT_BODY,
					fontSize: '15px',
					color: PARCHMENT,
					stroke: '#140d06',
					strokeThickness: 3
				})
				.setOrigin(0.5)
				.setAlpha(0.85);
		});
	}
}
