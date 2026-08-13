import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { matchClient } from '../multiplayer/MatchClient';
import {
	COOLDOWN_OPTIONS,
	GAME_SPEED_OPTIONS,
	LAVA_OPTIONS,
	TARGET_HEIGHT_OPTIONS,
	loadDraftConfig,
	nextOption,
	optionFor,
	saveDraftConfig,
	summarise,
	type ConfigOption
} from '../multiplayer/matchConfig';
import type { MatchConfig } from '../multiplayer/protocol';
import {
	ROOM_CODE_LENGTH,
	formatRoomCode,
	generateRoomCode,
	isCompleteRoomCode,
	normaliseRoomCode
} from '../multiplayer/roomCode';
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

type Phase = 'choose' | 'host-config' | 'host-room' | 'join';

/**
 * Multiplayer lobby.
 *
 * The full client-side flow is here and working: pick host or join, set the
 * match up, generate a room code, and enter one. Match settings live in this
 * flow rather than in a global settings screen because they belong to the
 * MATCH — both players run under the same values, and the host chooses them
 * immediately before the room is created.
 *
 * ⚠️ Only the network step is missing. Creating a room and joining one both stop
 * at MatchClient.connect(), which is the single place to implement (see
 * MatchClient.ts). Until a server is configured, matchClient.isAvailable is
 * false and those actions show their Coming Soon state instead.
 */
export class MultiplayerLobby extends Scene {
	private phase: Phase = 'choose';
	private config!: MatchConfig;
	private roomCode = '';
	private joinCode = '';
	private keyHandler?: (event: KeyboardEvent) => void;

	constructor() {
		super('MultiplayerLobby');
	}

	create() {
		this.config = loadDraftConfig();
		this.phase = 'choose';
		this.roomCode = '';
		this.joinCode = '';
		this.render();

		this.events.once('shutdown', () => this.detachKeyboard());
	}

	private goto(phase: Phase) {
		this.phase = phase;
		this.render();
	}

	private render() {
		this.detachKeyboard();
		this.children.removeAll();
		this.tweens.killAll();
		drawBackdrop(this);

		switch (this.phase) {
			case 'choose':
				this.renderChoose();
				break;
			case 'host-config':
				this.renderHostConfig();
				break;
			case 'host-room':
				this.renderHostRoom();
				break;
			case 'join':
				this.renderJoin();
				break;
		}

		EventBus.emit('current-scene-ready', this);
	}

	// ── Phase: choose ──────────────────────────────────────────────────────

	private renderChoose() {
		const centerX = this.scale.width / 2;
		const width = Math.min(400, this.scale.width - 80);

		new Column(this)
			.add(58, (y) => bannerHeading(this, centerX, y, 'Two Climbers', 46), 24)
			.add(
				this.measure(INTRO, 16, 560),
				(y) => caption(this, centerX, y, INTRO, { size: 16, color: GOLD, wrapWidth: 560 }),
				38
			)
			.add(62, (y) =>
				ornateButton(this, centerX, y, 'Host a Match', () => this.goto('host-config'), {
					width,
					fontSize: 26
				}), 18
			)
			.add(62, (y) =>
				ornateButton(this, centerX, y, 'Join with a Code', () => this.goto('join'), {
					fill: PALETTE.royal,
					fillHover: PALETTE.royalLight,
					width,
					fontSize: 26
				}), 26
			)
			.add(56, (y) =>
				ornateButton(this, centerX, y, 'Return to Gate', () => this.scene.start('StartMenu'), {
					fill: PALETTE.crimson,
					fillHover: PALETTE.crimsonLight,
					width,
					height: 56,
					fontSize: 22
				})
			)
			.flush(30, this.scale.height - 30);
	}

	// ── Phase: host config ─────────────────────────────────────────────────

	private renderHostConfig() {
		const centerX = this.scale.width / 2;
		const rowWidth = Math.min(560, this.scale.width - 60);
		const buttonWidth = Math.min(400, this.scale.width - 80);

		const blurb = this.add
			.text(centerX, 0, '', {
				fontFamily: FONT_BODY,
				fontSize: '15px',
				color: GOLD,
				align: 'center'
			})
			.setOrigin(0.5);

		const column = new Column(this)
			.add(52, (y) => bannerHeading(this, centerX, y, 'Match Settings', 40), 14)
			.add(
				20,
				(y) =>
					caption(this, centerX, y, 'Both players climb under these. The host decides.', {
						size: 15
					}),
				24
			);

		// Each setting is a cycling row; the blurb underneath explains the choice.
		const row = <T,>(
			label: string,
			options: ConfigOption<T>[],
			get: () => T,
			set: (v: T) => void
		) => {
			column.add(
				52,
				(y) => this.drawConfigRow(centerX, y, rowWidth, label, options, get, set, blurb),
				12
			);
		};

		row('Move cooldown', COOLDOWN_OPTIONS, () => this.config.moveCooldownMs, (v) => {
			this.config.moveCooldownMs = v;
		});
		row('Climb to win', TARGET_HEIGHT_OPTIONS, () => this.config.targetHeight, (v) => {
			this.config.targetHeight = v;
		});
		row('Game speed', GAME_SPEED_OPTIONS, () => this.config.gameSpeed, (v) => {
			this.config.gameSpeed = v;
		});
		row('Lava', LAVA_OPTIONS, () => this.config.lavaSpeed, (v) => {
			this.config.lavaSpeed = v;
		});

		column
			.add(22, (y) => blurb.setY(y), 22)
			.add(62, (y) =>
				ornateButton(this, centerX, y, 'Create Room', () => this.createRoom(), {
					width: buttonWidth,
					fontSize: 26
				}), 16
			)
			.add(52, (y) =>
				ornateButton(this, centerX, y, 'Back', () => this.goto('choose'), {
					fill: PALETTE.crimson,
					fillHover: PALETTE.crimsonLight,
					width: buttonWidth,
					height: 52,
					fontSize: 21
				})
			)
			.flush(24, this.scale.height - 24);

		blurb.setText(optionFor(COOLDOWN_OPTIONS, this.config.moveCooldownMs).blurb);
	}

	private drawConfigRow<T>(
		centerX: number,
		y: number,
		width: number,
		label: string,
		options: ConfigOption<T>[],
		get: () => T,
		set: (value: T) => void,
		blurb: Phaser.GameObjects.Text
	) {
		const left = centerX - width / 2;

		this.add
			.text(left, y, label, {
				fontFamily: FONT_BODY,
				fontSize: '17px',
				color: PARCHMENT,
				stroke: '#140d06',
				strokeThickness: 3
			})
			.setOrigin(0, 0.5);

		const button = ornateButton(
			this,
			centerX + width / 2 - 105,
			y,
			optionFor(options, get()).label,
			() => {
				const next = nextOption(options, get());
				set(next);
				const option = optionFor(options, next);
				button.text.setText(option.label);
				blurb.setText(option.blurb);
			},
			{
				fill: PALETTE.royal,
				fillHover: PALETTE.royalLight,
				width: 200,
				height: 44,
				fontSize: 19
			}
		);
	}

	// ── Phase: host room ───────────────────────────────────────────────────

	private createRoom() {
		saveDraftConfig(this.config);
		// Locally generated for now; the server becomes authoritative once the
		// transport exists, since only it can reject a collision.
		this.roomCode = generateRoomCode();
		this.goto('host-room');
	}

	private renderHostRoom() {
		const centerX = this.scale.width / 2;
		const panelWidth = Math.min(560, this.scale.width - 60);
		const buttonWidth = Math.min(400, this.scale.width - 80);

		new Column(this)
			.add(52, (y) => bannerHeading(this, centerX, y, 'Room Ready', 42), 26)
			.add(190, (y) => this.drawRoomCard(centerX, y, panelWidth), 22)
			.add(
				this.measure(summarise(this.config), 15, panelWidth - 40),
				(y) =>
					caption(this, centerX, y, summarise(this.config), {
						size: 15,
						color: GOLD,
						wrapWidth: panelWidth - 40
					}),
				26
			)
			.add(62, (y) => this.drawStartMatch(centerX, y, buttonWidth), 16)
			.add(52, (y) =>
				ornateButton(this, centerX, y, 'Change Settings', () => this.goto('host-config'), {
					fill: PALETTE.royal,
					fillHover: PALETTE.royalLight,
					width: buttonWidth,
					height: 52,
					fontSize: 21
				}), 14
			)
			.add(52, (y) =>
				ornateButton(this, centerX, y, 'Return to Gate', () => this.scene.start('StartMenu'), {
					fill: PALETTE.crimson,
					fillHover: PALETTE.crimsonLight,
					width: buttonWidth,
					height: 52,
					fontSize: 21
				})
			)
			.flush(24, this.scale.height - 24);
	}

	private drawRoomCard(centerX: number, y: number, width: number) {
		const height = 190;
		parchmentPanel(this, centerX, y, width, height);

		this.add
			.text(centerX, y - height / 2 + 32, 'GIVE THIS CODE TO YOUR RIVAL', {
				fontFamily: FONT_BODY,
				fontSize: 13,
				color: INK_SOFT
			})
			.setOrigin(0.5);

		const code = this.add
			.text(centerX, y + 2, formatRoomCode(this.roomCode), {
				fontFamily: FONT_DISPLAY,
				fontSize: 54,
				color: '#7b2230'
			})
			.setOrigin(0.5);

		// A gentle pulse, so the code reads as the live thing on this screen.
		this.tweens.add({
			targets: code,
			alpha: 0.75,
			duration: 1400,
			yoyo: true,
			repeat: -1,
			ease: 'Sine.easeInOut'
		});

		this.add
			.text(centerX, y + height / 2 - 30, 'They pick “Join with a Code” and enter it.', {
				fontFamily: FONT_BODY,
				fontSize: 14,
				color: INK
			})
			.setOrigin(0.5);
	}

	/** Start is live only once a match server exists. */
	private drawStartMatch(centerX: number, y: number, width: number) {
		if (matchClient.isAvailable) {
			ornateButton(this, centerX, y, 'Start Match', () => this.beginMatch(), {
				width,
				fontSize: 26
			});
			return;
		}

		this.add
			.rectangle(centerX, y, width + 10, 72, PALETTE.oak, 0.6)
			.setStrokeStyle(2, PALETTE.gold, 0.3);
		this.add.rectangle(centerX, y, width, 62, PALETTE.forest, 0.3);
		this.add
			.text(centerX, y - 9, 'Waiting for an opponent…', {
				fontFamily: FONT_BODY,
				fontSize: '22px',
				color: 'rgba(239, 226, 192, 0.5)'
			})
			.setOrigin(0.5);
		this.add
			.text(centerX, y + 15, 'COMING SOON — no match server yet', {
				fontFamily: FONT_BODY,
				fontSize: '13px',
				color: GOLD_BRIGHT
			})
			.setOrigin(0.5)
			.setAlpha(0.7);
	}

	/** The one call the transport work needs to make good on. */
	private beginMatch() {
		matchClient
			.connect({ displayName: 'Host', lobbyCode: this.roomCode })
			.then(() => matchClient.sendConfig(this.config))
			.catch(() => this.goto('host-room'));
	}

	// ── Phase: join ────────────────────────────────────────────────────────

	private renderJoin() {
		const centerX = this.scale.width / 2;
		const panelWidth = Math.min(520, this.scale.width - 60);
		const buttonWidth = Math.min(400, this.scale.width - 80);

		const boxes: Phaser.GameObjects.Text[] = [];
		let joinButton: ReturnType<typeof ornateButton> | undefined;

		const refresh = () => {
			for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
				boxes[i]?.setText(this.joinCode[i] ?? '');
			}
			const ready = isCompleteRoomCode(this.joinCode);
			joinButton?.text.setColor(ready ? GOLD_BRIGHT : 'rgba(239, 226, 192, 0.4)');
			joinButton?.face.setFillStyle(ready ? PALETTE.forest : PALETTE.oak, ready ? 0.95 : 0.5);
		};

		new Column(this)
			.add(52, (y) => bannerHeading(this, centerX, y, 'Join a Match', 42), 22)
			.add(
				20,
				(y) => caption(this, centerX, y, 'Type the code your host gave you.', { size: 16 }),
				26
			)
			.add(120, (y) => boxes.push(...this.drawCodeBoxes(centerX, y, panelWidth)), 26)
			.add(62, (y) => {
				joinButton = ornateButton(this, centerX, y, 'Join Match', () => this.joinMatch(), {
					width: buttonWidth,
					fontSize: 26
				});
			}, 16)
			.add(52, (y) =>
				ornateButton(this, centerX, y, 'Back', () => this.goto('choose'), {
					fill: PALETTE.crimson,
					fillHover: PALETTE.crimsonLight,
					width: buttonWidth,
					height: 52,
					fontSize: 21
				})
			)
			.flush(30, this.scale.height - 30);

		this.attachKeyboard(refresh);
		refresh();
	}

	private drawCodeBoxes(centerX: number, y: number, width: number): Phaser.GameObjects.Text[] {
		const slot = Math.min(64, (width - 40) / ROOM_CODE_LENGTH);
		const gap = 10;
		const total = ROOM_CODE_LENGTH * slot + (ROOM_CODE_LENGTH - 1) * gap;
		let x = centerX - total / 2 + slot / 2;

		const texts: Phaser.GameObjects.Text[] = [];
		for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
			this.add
				.rectangle(x, y, slot, slot + 8, PALETTE.oak, 0.9)
				.setStrokeStyle(2, PALETTE.gold, 0.75);
			this.add.rectangle(x, y, slot - 8, slot, PALETTE.parchment, 0.92);
			texts.push(
				this.add
					.text(x, y, '', { fontFamily: FONT_DISPLAY, fontSize: '30px', color: INK })
					.setOrigin(0.5)
			);
			x += slot + gap;
		}
		return texts;
	}

	/** Phaser has no text input, so the code is captured from raw key events. */
	private attachKeyboard(onChange: () => void) {
		this.detachKeyboard();

		this.keyHandler = (event: KeyboardEvent) => {
			if (event.key === 'Backspace') {
				this.joinCode = this.joinCode.slice(0, -1);
				onChange();
				event.preventDefault();
				return;
			}
			if (event.key === 'Enter') {
				if (isCompleteRoomCode(this.joinCode)) this.joinMatch();
				return;
			}
			if (event.key.length !== 1) return;

			const next = normaliseRoomCode(this.joinCode + event.key);
			if (next !== this.joinCode) {
				this.joinCode = next;
				onChange();
			}
		};

		window.addEventListener('keydown', this.keyHandler);
	}

	private detachKeyboard() {
		if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
		this.keyHandler = undefined;
	}

	private joinMatch() {
		if (!isCompleteRoomCode(this.joinCode)) return;

		if (!matchClient.isAvailable) {
			this.showUnavailableNotice();
			return;
		}

		matchClient
			.connect({ displayName: 'Guest', lobbyCode: this.joinCode })
			.catch(() => this.showUnavailableNotice());
	}

	private showUnavailableNotice() {
		const notice = this.add
			.text(this.scale.width / 2, this.scale.height - 64, 'COMING SOON — no match server yet', {
				fontFamily: FONT_BODY,
				fontSize: '16px',
				color: GOLD_BRIGHT,
				stroke: '#140d06',
				strokeThickness: 3
			})
			.setOrigin(0.5)
			.setAlpha(0);

		this.tweens.add({ targets: notice, alpha: 1, duration: 200, yoyo: true, hold: 1800 });
	}

	private measure(text: string, size: number, wrapWidth: number): number {
		const probe = caption(this, -9999, -9999, text, { size, wrapWidth });
		const height = probe.height;
		probe.destroy();
		return height;
	}
}

const INTRO =
	'Race a rival up the same tower. Nobody waits their turn — play a move, wait out your cooldown, play again. Win a game and you are flung skyward; win two in a row and you are thrown to the top.';
