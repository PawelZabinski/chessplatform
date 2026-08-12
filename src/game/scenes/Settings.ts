import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { GAME_SPEEDS, settings, speedBlurb } from '$lib/stores/settings';
import {
	Column,
	FONT_BODY,
	FONT_DISPLAY,
	GOLD,
	GOLD_BRIGHT,
	INK,
	INK_SOFT,
	PALETTE,
	PARCHMENT,
	bannerHeading,
	caption,
	drawBackdrop,
	ornateButton,
	parchmentPanel
} from '../theme';

/**
 * Player settings.
 *
 * Game speed is the pace a MULTIPLAYER match runs at — both players share it, so
 * this is the value carried into the lobby rather than something applied to your
 * own game. Single player deliberately has no speed setting: slow-motion there
 * is charged by climbing and spent with Shift, so it costs altitude.
 */
export class Settings extends Scene {
	private speedButton!: ReturnType<typeof ornateButton>;
	private blurb!: Phaser.GameObjects.Text;
	private markers: Phaser.GameObjects.Rectangle[] = [];

	constructor() {
		super('Settings');
	}

	create() {
		const centerX = this.scale.width / 2;
		drawBackdrop(this);

		const panelWidth = Math.min(620, this.scale.width - 60);
		const buttonWidth = Math.min(400, this.scale.width - 80);
		this.markers = [];

		new Column(this)
			.add(58, (y) => bannerHeading(this, centerX, y, 'Settings', 46), 40)
			.add(190, (y) => this.drawSpeedPanel(centerX, y, panelWidth), 34)
			.add(62, (y) =>
				ornateButton(this, centerX, y, 'Return to Gate', () => this.scene.start('StartMenu'), {
					fill: PALETTE.crimson,
					fillHover: PALETTE.crimsonLight,
					width: buttonWidth
				})
			)
			.flush(40, this.scale.height - 40);

		EventBus.emit('current-scene-ready', this);
	}

	private drawSpeedPanel(centerX: number, y: number, width: number) {
		const height = 190;
		parchmentPanel(this, centerX, y, width, height);

		this.add
			.text(centerX, y - height / 2 + 30, 'GAME SPEED', {
				fontFamily: FONT_BODY,
				fontSize: 14,
				color: INK_SOFT
			})
			.setOrigin(0.5);

		this.add
			.text(centerX, y - height / 2 + 56, 'Multiplayer matches only — solo play earns slow-motion instead.', {
				fontFamily: FONT_BODY,
				fontSize: 13,
				color: INK_SOFT
			})
			.setOrigin(0.5);

		const current = settings.current().gameSpeed;

		this.speedButton = ornateButton(
			this,
			centerX,
			y + 2,
			this.speedLabelFor(current),
			() => {
				const next = settings.cycleGameSpeed();
				this.speedButton.text.setText(this.speedLabelFor(next));
				this.blurb.setText(speedBlurb(next));
				this.paintMarkers(next);
			},
			{
				fill: PALETTE.royal,
				fillHover: PALETTE.royalLight,
				width: Math.min(340, width - 60),
				height: 54,
				fontSize: 23
			}
		);

		// A row of pips showing where the current speed sits in the range.
		const pipY = y + 44;
		const pipGap = 26;
		const startX = centerX - ((GAME_SPEEDS.length - 1) * pipGap) / 2;
		this.markers = GAME_SPEEDS.map((_, i) =>
			this.add.rectangle(startX + i * pipGap, pipY, 10, 10, PALETTE.oak, 0.4).setAngle(45)
		);
		this.paintMarkers(current);

		this.blurb = this.add
			.text(centerX, y + height / 2 - 24, speedBlurb(current), {
				fontFamily: FONT_BODY,
				fontSize: 15,
				color: INK
			})
			.setOrigin(0.5);
	}

	private speedLabelFor(value: number): string {
		const entry = GAME_SPEEDS.find((s) => s.value === value);
		return `${entry?.label ?? 'Normal'}  ·  ${value}x`;
	}

	private paintMarkers(value: number) {
		const index = GAME_SPEEDS.findIndex((s) => s.value === value);
		this.markers.forEach((pip, i) => {
			pip.setFillStyle(i <= index ? PALETTE.gold : PALETTE.oak, i <= index ? 0.95 : 0.35);
		});
	}
}
