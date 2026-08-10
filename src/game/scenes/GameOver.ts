import { Scene } from 'phaser';
import { leaderboard } from '$lib/stores/chess';
import { towerProgress } from '$lib/stores/progress';
import { ChessEvents, EventBus } from '../EventBus';
import { TOTAL_FLOORS, floorByNumber } from '../levels';
import type { RunOutcome } from './Game';
import {
	FONT_BODY,
	FONT_DISPLAY,
	GOLD,
	INK,
	INK_SOFT,
	PALETTE,
	bannerHeading,
	drawBackdrop,
	ornateButton,
	parchmentPanel
} from '../theme';

export class GameOver extends Scene {
	private outcome!: RunOutcome;
	private hasSaved = false;
	private saveButtonText?: Phaser.GameObjects.Text;

	constructor() {
		super('GameOver');
	}

	init(data: RunOutcome) {
		this.outcome = data;
		this.hasSaved = false;

		// A tower floor counts as cleared on a win or a draw — on the Spire
		// floors you are losing, so holding the draw is the objective.
		if (data.mode === 'tower' && data.floor && data.result >= 0.5) {
			towerProgress.record(
				data.floor,
				data.result === 1 ? 'won' : 'drawn',
				data.movesPlayed,
				data.score
			);
		}
	}

	create() {
		const centerX = this.scale.width / 2;
		drawBackdrop(this);

		const cleared = this.outcome.mode === 'tower' && this.outcome.result >= 0.5;
		const won = this.outcome.result === 1;

		bannerHeading(
			this,
			centerX,
			92,
			this.outcome.mode === 'tower'
				? cleared
					? 'Floor Cleared'
					: 'Floor Failed'
				: won
					? 'Victory'
					: 'The Climb Ends',
			50
		);

		this.drawScroll(centerX, 292, won, cleared);
		this.drawButtons(centerX, cleared);

		EventBus.emit('current-scene-ready', this);
	}

	private drawScroll(centerX: number, panelY: number, won: boolean, cleared: boolean) {
		const panelHeight = 240;
		parchmentPanel(this, centerX, panelY, 640, panelHeight);

		const headline =
			this.outcome.result === 1
				? 'The board is yours'
				: this.outcome.result === 0.5
					? 'A drawn game'
					: 'The board is lost';

		this.add
			.text(centerX, panelY - 86, headline, {
				fontFamily: FONT_DISPLAY,
				fontSize: 30,
				color: INK
			})
			.setOrigin(0.5);

		this.add
			.text(centerX, panelY - 48, this.outcome.reason, {
				fontFamily: FONT_BODY,
				fontSize: 18,
				color: INK_SOFT,
				align: 'center',
				wordWrap: { width: 580 }
			})
			.setOrigin(0.5);

		this.add.rectangle(centerX, panelY - 16, 540, 1, PALETTE.parchmentEdge, 0.6);

		this.add
			.text(centerX, panelY + 26, this.outcome.score.toLocaleString(), {
				fontFamily: FONT_DISPLAY,
				fontSize: 52,
				color: '#7b2230'
			})
			.setOrigin(0.5);

		this.add
			.text(centerX, panelY + 62, 'CLIMB SCORE', {
				fontFamily: FONT_BODY,
				fontSize: 14,
				color: INK_SOFT
			})
			.setOrigin(0.5);

		const detail =
			this.outcome.mode === 'tower'
				? `${this.outcome.movesPlayed} move${this.outcome.movesPlayed === 1 ? '' : 's'} played`
				: `Reached ${this.outcome.stageName} · ${this.outcome.stagesCleared} stage${this.outcome.stagesCleared === 1 ? '' : 's'} cleared`;

		this.add
			.text(centerX, panelY + 90, won ? `${detail}  ·  score doubled` : detail, {
				fontFamily: FONT_BODY,
				fontSize: 15,
				color: cleared || won ? '#2f4a32' : INK_SOFT
			})
			.setOrigin(0.5);
	}

	private drawButtons(centerX: number, cleared: boolean) {
		if (this.outcome.mode === 'tower') {
			this.drawTowerButtons(centerX, cleared);
			return;
		}

		ornateButton(this, centerX, 496, 'Climb Again', () => this.restartEndless(), { fontSize: 27 });

		const save = ornateButton(this, centerX, 568, 'Record in the Hall', () => this.saveScore(), {
			fill: PALETTE.royal,
			fillHover: PALETTE.royalLight
		});
		this.saveButtonText = save.text;

		ornateButton(this, centerX, 640, 'Return to Gate', () => this.toMenu(), {
			fill: PALETTE.crimson,
			fillHover: PALETTE.crimsonLight
		});
	}

	private drawTowerButtons(centerX: number, cleared: boolean) {
		const floor = this.outcome.floor ?? 1;
		const nextFloor = floor + 1;
		const hasNext = nextFloor <= TOTAL_FLOORS;

		if (cleared && hasNext) {
			const next = floorByNumber(nextFloor);
			ornateButton(
				this,
				centerX,
				496,
				`Next Floor  ·  ${next?.name ?? nextFloor}`,
				() => this.scene.start('Game', { mode: 'tower', floor: nextFloor }),
				{ fontSize: 26, width: 380 }
			);
		} else if (cleared) {
			this.add
				.text(centerX, 496, 'You have reached the crown of the tower.', {
					fontFamily: FONT_DISPLAY,
					fontSize: 24,
					color: GOLD,
					stroke: '#140d06',
					strokeThickness: 4
				})
				.setOrigin(0.5);
		}

		ornateButton(
			this,
			centerX,
			cleared ? 568 : 496,
			'Retry Floor',
			() => this.scene.start('Game', { mode: 'tower', floor }),
			{ fill: PALETTE.royal, fillHover: PALETTE.royalLight, width: 380 }
		);

		ornateButton(
			this,
			centerX,
			cleared ? 640 : 568,
			'The Tower',
			() => {
				EventBus.emit(ChessEvents.resetBoard);
				this.scene.start('LevelSelect');
			},
			{ fill: PALETTE.crimson, fillHover: PALETTE.crimsonLight, width: 380 }
		);
	}

	private restartEndless() {
		EventBus.emit(ChessEvents.resetBoard);
		this.scene.start('Game', { mode: 'endless', difficulty: this.outcome.difficulty });
	}

	private toMenu() {
		EventBus.emit(ChessEvents.resetBoard);
		this.scene.start('StartMenu');
	}

	private saveScore() {
		if (this.hasSaved) return;

		const name = prompt('By what name shall you be recorded?');
		leaderboard.add({
			name: name ? name : 'Anonymous',
			score: this.outcome.score,
			difficulty: this.outcome.difficulty ?? 'Intermediate',
			stage: this.outcome.stageName
		});

		this.hasSaved = true;
		this.saveButtonText?.setText('Recorded ✓');
	}
}
