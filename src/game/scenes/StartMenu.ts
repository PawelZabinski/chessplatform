import { Scene } from 'phaser';
import { get } from 'svelte/store';
import { ChessEvents, EventBus } from '../EventBus';
import { TOTAL_FLOORS } from '../levels';
import { towerProgress } from '$lib/stores/progress';
import {
	Column,
	FONT_BODY,
	GOLD,
	PALETTE,
	PARCHMENT,
	bannerHeading,
	caption,
	drawBackdrop,
	ornateButton
} from '../theme';

const CONTROLS = [
	'captures lift you — the bigger the piece, the higher the leap',
	'files steer left and right  ·  space brakes you to a stop',
	'↓ or S drops through a wooden plank, never through stone',
	'gold runes grant 5s of ← → / A D control and jumps, stacking to 10s',
	'climbing charges slow-motion — spend it with shift to slow the whole tower'
];

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
		const height = this.scale.height;
		drawBackdrop(this);

		// The controls plaque is laid out first so the menu column knows how much
		// room is left; otherwise a short canvas pushes it off the bottom edge.
		const plaqueTop = this.drawControlsPlaque(centerX, height);

		const cleared = Object.keys(get(towerProgress)).length;
		const next = towerProgress.highestUnlocked();
		const buttonWidth = Math.min(420, this.scale.width - 80);

		const tagline =
			'Your moves on the board are the climb. Captures launch you; stalling burns you.';
		const endlessBlurb =
			'Beat a game and you are flung skyward into the next. The engine sharpens as you climb; the run ends only when you lose.';
		const blurbWrap = Math.min(560, this.scale.width - 100);

		// Wrapped captions have to be measured before the column can place them.
		const taglineHeight = this.measureCaption(tagline, 19);
		const blurbHeight = this.measureCaption(endlessBlurb, 15, blurbWrap);

		new Column(this)
			.add(64, (y) => bannerHeading(this, centerX, y, 'ChessPlatform', 52), 34)
			.add(taglineHeight, (y) => caption(this, centerX, y, tagline, { size: 19 }), 40)
			.add(
				62,
				(y) =>
					ornateButton(
						this,
						centerX,
						y,
						cleared === 0 ? 'Enter the Tower' : `Climb the Tower  ·  Floor ${next}`,
						() => this.scene.start('LevelSelect'),
						{ fontSize: 28, width: buttonWidth }
					),
				14
			)
			.add(
				20,
				(y) =>
					caption(this, centerX, y, `${cleared} of ${TOTAL_FLOORS} floors cleared`, {
						size: 15,
						color: GOLD
					}),
				34
			)
			.add(
				62,
				(y) =>
					ornateButton(
						this,
						centerX,
						y,
						'Endless Ascent',
						() => {
							EventBus.emit(ChessEvents.resetBoard);
							this.scene.start('Game', { mode: 'endless' });
						},
						{
							fill: PALETTE.royal,
							fillHover: PALETTE.royalLight,
							width: buttonWidth,
							fontSize: 28
						}
					),
				16
			)
			.add(
				blurbHeight,
				(y) => caption(this, centerX, y, endlessBlurb, { size: 15, color: GOLD, wrapWidth: blurbWrap }),
				34
			)
			.add(
				62,
				(y) =>
					// Scaffolding only — the lobby itself is marked Coming Soon.
					ornateButton(
						this,
						centerX,
						y,
						'Two Climbers  ·  Soon',
						() => this.scene.start('MultiplayerLobby'),
						{ fill: PALETTE.oakLight, fillHover: PALETTE.oak, width: buttonWidth, fontSize: 24 }
					),
				24
			)
			.add(
				62,
				(y) =>
					ornateButton(this, centerX, y, 'Hall of Champions', () => this.scene.start('Leaderboard'), {
						fill: PALETTE.crimson,
						fillHover: PALETTE.crimsonLight,
						width: buttonWidth
					}),
				18
			)
			.add(56, (y) =>
				ornateButton(this, centerX, y, 'Settings', () => this.scene.start('Settings'), {
					fill: PALETTE.oakLight,
					fillHover: PALETTE.oak,
					width: buttonWidth,
					height: 56,
					fontSize: 22
				})
			)
			.flush(40, plaqueTop - 28);

		EventBus.emit('current-scene-ready', this);
	}

	/** Measures a wrapped caption without leaving it on screen. */
	private measureCaption(text: string, size: number, wrapWidth?: number): number {
		const probe = caption(this, -9999, -9999, text, { size, wrapWidth });
		const height = probe.height;
		probe.destroy();
		return height;
	}

	/**
	 * Footer plaque, anchored to the bottom of the canvas. Returns its top edge
	 * so the main column can lay itself out in the space above.
	 */
	private drawControlsPlaque(x: number, canvasHeight: number): number {
		const lineHeight = 23;
		const bottomPad = 27;
		const rulePad = 16;

		const blockHeight = CONTROLS.length * lineHeight;
		const firstLineY = canvasHeight - bottomPad - blockHeight + lineHeight / 2;
		const ruleY = firstLineY - lineHeight / 2 - rulePad;

		this.add.rectangle(x, ruleY, Math.min(760, this.scale.width - 60), 2, PALETTE.gold, 0.5);

		CONTROLS.forEach((line, i) => {
			this.add
				.text(x, firstLineY + i * lineHeight, line, {
					fontFamily: FONT_BODY,
					fontSize: '15px',
					color: PARCHMENT,
					stroke: '#140d06',
					strokeThickness: 3
				})
				.setOrigin(0.5)
				.setAlpha(0.85);
		});

		return ruleY;
	}
}
