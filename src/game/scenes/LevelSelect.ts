import { Scene } from 'phaser';
import { get } from 'svelte/store';
import { EventBus } from '../EventBus';
import { TOTAL_FLOORS, floorsByWing, type TowerFloor } from '../levels';
import { towerProgress } from '$lib/stores/progress';
import {
	FONT_BODY,
	FONT_DISPLAY,
	GOLD,
	GOLD_BRIGHT,
	INK,
	INK_SOFT,
	PALETTE,
	PARCHMENT,
	bannerHeading,
	drawBackdrop,
	ornateButton
} from '../theme';

/**
 * The tower floor picker.
 *
 * Floors are laid out bottom-up, one row per wing, so the screen reads as a
 * tower you are climbing rather than a grid of levels.
 */
export class LevelSelect extends Scene {
	constructor() {
		super('LevelSelect');
	}

	create() {
		const centerX = this.scale.width / 2;
		drawBackdrop(this);

		bannerHeading(this, centerX, 74, 'The Tower', 46);

		const progress = get(towerProgress);
		const cleared = Object.keys(progress).length;

		this.add
			.text(centerX, 126, `${cleared} of ${TOTAL_FLOORS} floors cleared`, {
				fontFamily: FONT_BODY,
				fontSize: '17px',
				color: PARCHMENT,
				stroke: '#140d06',
				strokeThickness: 3
			})
			.setOrigin(0.5);

		// Wings are drawn top-down on screen but numbered bottom-up in fiction,
		// so the highest wing sits at the top.
		const wings = floorsByWing().reverse();
		const rowHeight = 96;
		const top = 176;

		wings.forEach((wing, index) => {
			const y = top + index * rowHeight;
			this.drawWingRow(wing.wing, wing.floors, y, progress);
		});

		ornateButton(
			this,
			centerX,
			top + wings.length * rowHeight + 44,
			'Return to Gate',
			() => this.scene.start('StartMenu'),
			{ fill: PALETTE.crimson, fillHover: PALETTE.crimsonLight, width: 300 }
		);

		EventBus.emit('current-scene-ready', this);
	}

	/** Widest content strip that fits the canvas, with a margin either side. */
	private get contentWidth() {
		return Math.min(860, this.scale.width - 56);
	}

	private drawWingRow(
		wing: string,
		floors: TowerFloor[],
		y: number,
		progress: Record<number, { result: string }>
	) {
		const centerX = this.scale.width / 2;
		const width = this.contentWidth;
		const left = centerX - width / 2;

		this.add
			.text(left, y - 30, wing.toUpperCase(), {
				fontFamily: FONT_BODY,
				fontSize: '14px',
				color: GOLD
			})
			.setOrigin(0, 0.5);

		this.add.rectangle(centerX, y - 16, width, 1, PALETTE.gold, 0.35);

		// Tiles shrink to fit rather than spilling past the edge of the canvas.
		const gap = 14;
		const tileSize = Phaser.Math.Clamp(
			Math.floor((width - gap * (floors.length - 1)) / floors.length),
			30,
			58
		);
		const totalWidth = floors.length * tileSize + (floors.length - 1) * gap;
		let x = centerX - totalWidth / 2 + tileSize / 2;

		floors.forEach((floor) => {
			this.drawFloorTile(floor, x, y + 18, tileSize, progress);
			x += tileSize + gap;
		});
	}

	private drawFloorTile(
		floor: TowerFloor,
		x: number,
		y: number,
		size: number,
		progress: Record<number, { result: string }>
	) {
		const record = progress[floor.floor];
		const unlocked = towerProgress.isUnlocked(floor.floor);

		const fill = record ? PALETTE.forest : unlocked ? PALETTE.royal : PALETTE.oak;
		const container = this.add.container(x, y);

		const frame = this.add
			.rectangle(0, 0, size, size, PALETTE.oak, 0.95)
			.setStrokeStyle(2, unlocked ? PALETTE.gold : PALETTE.parchmentEdge, unlocked ? 0.9 : 0.4);
		const face = this.add
			.rectangle(0, 0, size - 8, size - 8, fill, unlocked ? 0.95 : 0.5)
			.setStrokeStyle(1, PALETTE.goldBright, unlocked ? 0.5 : 0.15);

		const number = this.add
			.text(0, -4, `${floor.floor}`, {
				fontFamily: FONT_DISPLAY,
				fontSize: '22px',
				color: unlocked ? PARCHMENT : '#6b5c48'
			})
			.setOrigin(0.5);

		container.add([frame, face, number]);

		// A drawn floor is marked differently from a won one.
		if (record) {
			container.add(
				this.add
					.text(0, 18, record.result === 'won' ? '★' : '½', {
						fontFamily: FONT_BODY,
						fontSize: '14px',
						color: GOLD_BRIGHT
					})
					.setOrigin(0.5)
			);
		} else if (!unlocked) {
			container.add(
				this.add
					.text(0, 18, 'locked', { fontFamily: FONT_BODY, fontSize: '10px', color: '#6b5c48' })
					.setOrigin(0.5)
			);
		}

		if (!unlocked) return;

		container.setSize(size, size);
		container.setInteractive({ useHandCursor: true });

		const tooltip = this.add
			.text(this.scale.width / 2, this.scale.height - 92, '', {
				fontFamily: FONT_BODY,
				fontSize: '17px',
				color: PARCHMENT,
				align: 'center',
				stroke: '#140d06',
				strokeThickness: 3,
				wordWrap: { width: Math.min(720, this.scale.width - 60) }
			})
			.setOrigin(0.5)
			.setAlpha(0);

		container.on('pointerover', () => {
			face.setFillStyle(record ? PALETTE.forestLight : PALETTE.royalLight, 1);
			number.setColor(GOLD_BRIGHT);
			tooltip.setText(`${floor.name} — ${floor.brief}`).setAlpha(1);
			this.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 110 });
		});
		container.on('pointerout', () => {
			face.setFillStyle(record ? PALETTE.forest : PALETTE.royal, 0.95);
			number.setColor(PARCHMENT);
			tooltip.setAlpha(0);
			this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 110 });
		});
		container.on('pointerdown', () => {
			this.scene.start('Game', { mode: 'tower', floor: floor.floor });
		});
	}
}
