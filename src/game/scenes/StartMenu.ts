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

const DIFFICULTIES = ['Novice', 'Intermediate', 'Expert'] as const;

const DIFFICULTY_BLURB: Record<string, string> = {
	Novice: 'The engine blunders often. A gentle climb.',
	Intermediate: 'The engine plays half its moves in earnest.',
	Expert: 'The engine shows little mercy. Climb fast.'
};

/**
 * Two modes.
 *
 * The Tower is the main game: hand-tuned positions with per-floor engine
 * strength, which is why it has no difficulty selector. Endless keeps the
 * original score-attack loop, the difficulty picker and the leaderboard.
 */
export class StartMenu extends Scene {
	private selectedDifficulty = 'Intermediate';
	private difficultyButton!: ReturnType<typeof ornateButton>;
	private blurb!: Phaser.GameObjects.Text;
	private endlessOpen = false;

	constructor() {
		super('StartMenu');
	}

	create() {
		const centerX = this.scale.width / 2;
		this.endlessOpen = false;
		drawBackdrop(this);

		bannerHeading(this, centerX, 104, 'ChessPlatform', 56);
		caption(
			this,
			centerX,
			178,
			'Your moves on the board are the climb. Captures launch you; stalling drowns you.',
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

		ornateButton(this, centerX, 396, 'Endless Ascent', () => this.toggleEndless(), {
			fill: PALETTE.royal,
			fillHover: PALETTE.royalLight,
			width: 400
		});

		ornateButton(this, centerX, 620, 'Hall of Champions', () => this.scene.start('Leaderboard'), {
			fill: PALETTE.crimson,
			fillHover: PALETTE.crimsonLight,
			width: 400
		});

		this.buildEndlessPanel(centerX);
		this.drawControlsPlaque(centerX, this.scale.height - 108);

		EventBus.emit('current-scene-ready', this);
	}

	/** Difficulty and the endless start live behind the Endless button. */
	private buildEndlessPanel(centerX: number) {
		let index = DIFFICULTIES.indexOf(this.selectedDifficulty as (typeof DIFFICULTIES)[number]);
		if (index === -1) index = 1;

		this.difficultyButton = ornateButton(
			this,
			centerX,
			462,
			`Difficulty  ·  ${DIFFICULTIES[index]}`,
			() => {
				index = (index + 1) % DIFFICULTIES.length;
				this.selectedDifficulty = DIFFICULTIES[index];
				this.difficultyButton.text.setText(`Difficulty  ·  ${this.selectedDifficulty}`);
				this.blurb.setText(DIFFICULTY_BLURB[this.selectedDifficulty]);
				EventBus.emit(ChessEvents.selectDifficulty, this.selectedDifficulty);
			},
			{ fill: PALETTE.royal, fillHover: PALETTE.royalLight, width: 340, height: 52, fontSize: 22 }
		);

		this.blurb = caption(this, centerX, 502, DIFFICULTY_BLURB[this.selectedDifficulty], 16);
		this.blurb.setColor(GOLD);

		const start = ornateButton(
			this,
			centerX,
			552,
			'Begin Endless Climb',
			() => {
				EventBus.emit(ChessEvents.resetBoard);
				EventBus.emit(ChessEvents.selectDifficulty, this.selectedDifficulty);
				this.scene.start('Game', { mode: 'endless', difficulty: this.selectedDifficulty });
			},
			{ width: 340, height: 52, fontSize: 22 }
		);

		this.endlessControls = [this.difficultyButton.container, this.blurb, start.container];
		this.setEndlessVisible(false);
	}

	private endlessControls: Phaser.GameObjects.GameObject[] = [];

	private setEndlessVisible(visible: boolean) {
		this.endlessControls.forEach((control) =>
			(control as Phaser.GameObjects.Components.Visible).setVisible(visible)
		);
	}

	private toggleEndless() {
		this.endlessOpen = !this.endlessOpen;
		this.setEndlessVisible(this.endlessOpen);
	}

	private drawControlsPlaque(x: number, y: number) {
		this.add.rectangle(x, y, 720, 2, PALETTE.gold, 0.5);

		const lines = [
			'captures lift you — the bigger the piece, the higher the leap',
			'files steer left and right  ·  space brakes you to a stop',
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
