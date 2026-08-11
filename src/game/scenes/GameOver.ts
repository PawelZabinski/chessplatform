import { Scene } from 'phaser';
import { leaderboard } from '$lib/stores/chess';
import { towerProgress } from '$lib/stores/progress';
import { ChessEvents, EventBus } from '../EventBus';
import { TOTAL_FLOORS, floorByNumber } from '../levels';
import { tierLabel } from '../difficulty';
import type { RunOutcome } from './Game';
import {
	Column,
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

		const title =
			this.outcome.mode === 'tower'
				? cleared
					? 'Floor Cleared'
					: 'Floor Failed'
				: won
					? 'Victory'
					: 'The Climb Ends';

		const buttons = this.buttonPlan(cleared);
		const panelHeight = 240;

		const column = new Column(this)
			.add(60, (y) => bannerHeading(this, centerX, y, title, 48), 40)
			.add(panelHeight, (y) => this.drawScroll(centerX, y, won, cleared), 40);

		buttons.forEach((button, i) =>
			column.add(62, (y) => button(y), i === buttons.length - 1 ? 0 : 18)
		);

		column.flush(30, this.scale.height - 30);

		EventBus.emit('current-scene-ready', this);
	}

	private drawScroll(centerX: number, panelY: number, won: boolean, cleared: boolean) {
		const panelWidth = Math.min(640, this.scale.width - 60);
		parchmentPanel(this, centerX, panelY, panelWidth, 240);

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
				wordWrap: { width: panelWidth - 60 }
			})
			.setOrigin(0.5);

		this.add.rectangle(centerX, panelY - 16, panelWidth - 100, 1, PALETTE.parchmentEdge, 0.6);

		this.add
			.text(centerX, panelY + 20, this.outcome.score.toLocaleString(), {
				fontFamily: FONT_DISPLAY,
				fontSize: 52,
				color: '#7b2230'
			})
			.setOrigin(0.5);

		this.add
			.text(centerX, panelY + 70, 'CLIMB SCORE', {
				fontFamily: FONT_BODY,
				fontSize: 14,
				color: INK_SOFT
			})
			.setOrigin(0.5);

		const detail =
			this.outcome.mode === 'tower'
				? `${this.outcome.movesPlayed} move${this.outcome.movesPlayed === 1 ? '' : 's'} played${won ? '  ·  score doubled' : ''}`
				: `${this.outcome.gamesWon} game${this.outcome.gamesWon === 1 ? '' : 's'} won  ·  reached ${this.outcome.stageName}  ·  engine ${tierLabel(this.outcome.tier).toLowerCase()}`;

		this.add
			.text(centerX, panelY + 97, detail, {
				fontFamily: FONT_BODY,
				fontSize: 15,
				color: cleared || won ? '#2f4a32' : INK_SOFT
			})
			.setOrigin(0.5);
	}

	/**
	 * The buttons this outcome needs, as placers the column positions. Returning
	 * a list rather than drawing at fixed offsets keeps the spacing correct
	 * whether there are two buttons or three.
	 */
	private buttonPlan(cleared: boolean): ((y: number) => void)[] {
		const centerX = this.scale.width / 2;
		const width = Math.min(400, this.scale.width - 80);

		if (this.outcome.mode !== 'tower') {
			return [
				(y) =>
					ornateButton(this, centerX, y, 'Climb Again', () => this.restartEndless(), {
						fontSize: 27,
						width
					}),
				(y) => {
					const save = ornateButton(this, centerX, y, 'Record in the Hall', () => this.saveScore(), {
						fill: PALETTE.royal,
						fillHover: PALETTE.royalLight,
						width
					});
					this.saveButtonText = save.text;
				},
				(y) =>
					ornateButton(this, centerX, y, 'Return to Gate', () => this.toMenu(), {
						fill: PALETTE.crimson,
						fillHover: PALETTE.crimsonLight,
						width
					})
			];
		}

		const floor = this.outcome.floor ?? 1;
		const nextFloor = floor + 1;
		const plan: ((y: number) => void)[] = [];

		if (cleared && nextFloor <= TOTAL_FLOORS) {
			const next = floorByNumber(nextFloor);
			plan.push((y) =>
				ornateButton(
					this,
					centerX,
					y,
					`Next Floor  ·  ${next?.name ?? nextFloor}`,
					() => this.scene.start('Game', { mode: 'tower', floor: nextFloor }),
					{ fontSize: 25, width }
				)
			);
		} else if (cleared) {
			plan.push((y) =>
				this.add
					.text(centerX, y, 'You have reached the crown of the tower.', {
						fontFamily: FONT_DISPLAY,
						fontSize: 24,
						color: GOLD,
						stroke: '#140d06',
						strokeThickness: 4,
						align: 'center',
						wordWrap: { width: this.scale.width - 80 }
					})
					.setOrigin(0.5)
			);
		}

		plan.push((y) =>
			ornateButton(this, centerX, y, 'Retry Floor', () => this.scene.start('Game', { mode: 'tower', floor }), {
				fill: PALETTE.royal,
				fillHover: PALETTE.royalLight,
				width
			})
		);
		plan.push((y) =>
			ornateButton(
				this,
				centerX,
				y,
				'The Tower',
				() => {
					EventBus.emit(ChessEvents.resetBoard);
					this.scene.start('LevelSelect');
				},
				{ fill: PALETTE.crimson, fillHover: PALETTE.crimsonLight, width }
			)
		);

		return plan;
	}

	private restartEndless() {
		EventBus.emit(ChessEvents.resetBoard);
		this.scene.start('Game', { mode: 'endless' });
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
			stage: this.outcome.stageName,
			gamesWon: this.outcome.gamesWon
		});

		this.hasSaved = true;
		this.saveButtonText?.setText('Recorded ✓');
	}
}
