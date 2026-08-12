import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { DEFAULT_MATCH_CONFIG } from '../multiplayer/protocol';
import {
	Column,
	FONT_BODY,
	FONT_DISPLAY,
	GOLD,
	INK,
	INK_SOFT,
	PALETTE,
	bannerHeading,
	caption,
	drawBackdrop,
	ornateButton,
	parchmentPanel
} from '../theme';

/**
 * Multiplayer lobby — UI scaffolding only.
 *
 * The screen is real and laid out, but no socket is opened and the match cannot
 * be started: the button is disabled and the panel is marked Coming Soon. It
 * exists so the shape of the mode is visible and so the wiring has somewhere to
 * land. The full design and wire protocol live in src/game/multiplayer/protocol.ts.
 *
 * To implement: replace the disabled button's handler with a connection to the
 * match server, and drive this scene from LobbyState / MatchStart messages.
 */
export class MultiplayerLobby extends Scene {
	constructor() {
		super('MultiplayerLobby');
	}

	create() {
		const centerX = this.scale.width / 2;
		drawBackdrop(this);

		const panelWidth = Math.min(660, this.scale.width - 60);
		const buttonWidth = Math.min(380, this.scale.width - 80);

		const rulesHeight = this.measureCaption(RULES, 16, panelWidth - 80);

		new Column(this)
			.add(58, (y) => bannerHeading(this, centerX, y, 'Two Climbers', 46), 26)
			.add(
				24,
				(y) =>
					caption(this, centerX, y, 'Race a rival up the same tower', {
						size: 17,
						color: GOLD
					}),
				30
			)
			.add(rulesHeight + 84, (y) => this.drawRulesPanel(centerX, y, panelWidth, rulesHeight), 30)
			.add(62, (y) => this.drawDisabledStart(centerX, y, buttonWidth), 18)
			.add(62, (y) =>
				ornateButton(this, centerX, y, 'Return to Gate', () => this.scene.start('StartMenu'), {
					fill: PALETTE.crimson,
					fillHover: PALETTE.crimsonLight,
					width: buttonWidth
				})
			)
			.flush(30, this.scale.height - 30);

		EventBus.emit('current-scene-ready', this);
	}

	private drawRulesPanel(centerX: number, y: number, width: number, rulesHeight: number) {
		const height = rulesHeight + 84;
		parchmentPanel(this, centerX, y, width, height);

		this.add
			.text(centerX, y - height / 2 + 30, 'COMING SOON', {
				fontFamily: FONT_DISPLAY,
				fontSize: 22,
				color: '#7b2230'
			})
			.setOrigin(0.5);

		this.add
			.text(centerX, y - height / 2 + 58, `${DEFAULT_MATCH_CONFIG.moveCooldownMs / 1000}s move cooldown  ·  target height ${DEFAULT_MATCH_CONFIG.targetHeight} bands  ·  both set before the match`, {
				fontFamily: FONT_BODY,
				fontSize: 13,
				color: INK_SOFT
			})
			.setOrigin(0.5);

		this.add
			.text(centerX, y + 18, RULES, {
				fontFamily: FONT_BODY,
				fontSize: 16,
				color: INK,
				align: 'center',
				lineSpacing: 8,
				wordWrap: { width: width - 80 }
			})
			.setOrigin(0.5);
	}

	/** Looks like a button, deliberately does nothing. */
	private drawDisabledStart(centerX: number, y: number, width: number) {
		const frame = this.add
			.rectangle(centerX, y, width + 10, 62 + 10, PALETTE.oak, 0.6)
			.setStrokeStyle(2, PALETTE.gold, 0.3);
		const face = this.add.rectangle(centerX, y, width, 62, PALETTE.royal, 0.35);
		this.add
			.text(centerX, y, 'Find a Match', {
				fontFamily: FONT_BODY,
				fontSize: '26px',
				color: 'rgba(239, 226, 192, 0.45)'
			})
			.setOrigin(0.5);

		return { frame, face };
	}

	private measureCaption(text: string, size: number, wrapWidth: number): number {
		const probe = caption(this, -9999, -9999, text, { size, wrapWidth });
		const height = probe.height;
		probe.destroy();
		return height;
	}
}

const RULES = [
	'Both climbers race the same tower on the same board — and nobody waits their turn.',
	'Play a move, wait out your one-second cooldown, play the next. Speed counts as much as accuracy.',
	'Win a game and you are flung far up, then a fresh game is dealt skewed in your rival’s favour so they can fight back.',
	'Win twice in a row and you are thrown to the very top: the match is yours.'
].join('\n');
