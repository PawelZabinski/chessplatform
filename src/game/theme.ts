import { createAllTerrainTextures, skyKey } from './world/textures';
import { THEMES } from './world/themes';

/**
 * Shared medieval UI kit.
 *
 * Every menu scene draws from the same palette and the same small set of
 * builders (parchment panels, ornate buttons, banner headings) so the game
 * reads as one artefact rather than four differently-styled screens.
 *
 * Everything here is drawn with Phaser primitives — no extra image assets — so
 * the theme stays editable in code.
 */

export const PALETTE = {
	/** Aged parchment, for panel fills and body text backgrounds. */
	parchment: 0xe8d8b0,
	parchmentDark: 0xd2be91,
	parchmentEdge: 0x8a6f47,

	/** Dark oak, for frames and inset panels. */
	oak: 0x3b2a1c,
	oakLight: 0x5a412c,

	/** Tarnished gold, for rules, headings and emphasis. */
	gold: 0xc9a227,
	goldBright: 0xf0d264,

	/** Deep heraldic tones for buttons. */
	crimson: 0x7b2230,
	crimsonLight: 0xa33042,
	forest: 0x2f4a32,
	forestLight: 0x436b48,
	royal: 0x2a3560,
	royalLight: 0x3d4c85,

	ink: 0x2b1f14,
	shadow: 0x0b0704
} as const;

/** CSS-string mirrors of the palette, for Phaser text styles. */
export const INK = '#2b1f14';
export const INK_SOFT = '#57432e';
export const GOLD = '#e3c05c';
export const GOLD_BRIGHT = '#f6e2a0';
export const PARCHMENT = '#efe2c0';

export const FONT_DISPLAY = '"Cinzel Decorative", "Cinzel", Georgia, serif';
export const FONT_BODY = '"Cinzel", Georgia, "Times New Roman", serif';

/**
 * Full-screen backdrop: darkened sky, a vignette, and a subtle gold border,
 * so every menu sits in the same "inside a keep" space.
 */
export function drawBackdrop(scene: Phaser.Scene) {
	const { width, height } = scene.scale;

	// Menus share the in-game sky art rather than a placeholder tile.
	createAllTerrainTextures(scene);
	const bgKey = skyKey(THEMES.spire);

	if (scene.textures.exists(bgKey)) {
		scene.add
			.image(0, 0, bgKey)
			.setOrigin(0, 0)
			.setDisplaySize(width, height)
			.setAlpha(0.9);
	}

	// Dark wash so parchment and gold stay legible over any sky tile.
	scene.add.rectangle(0, 0, width, height, PALETTE.shadow, 0.62).setOrigin(0, 0);

	// Vignette: a few stacked translucent frames, cheaper than a gradient texture.
	for (let i = 0; i < 6; i++) {
		const inset = i * 26;
		scene.add
			.rectangle(width / 2, height / 2, width - inset * 2, height - inset * 2)
			.setStrokeStyle(26, PALETTE.shadow, 0.05 + i * 0.015);
	}

	// Gold inner rule framing the whole screen.
	scene.add
		.rectangle(width / 2, height / 2, width - 40, height - 40)
		.setStrokeStyle(2, PALETTE.gold, 0.55);
	scene.add
		.rectangle(width / 2, height / 2, width - 52, height - 52)
		.setStrokeStyle(1, PALETTE.gold, 0.3);
}

/** A parchment panel with an oak frame and gold inner rule. */
export function parchmentPanel(
	scene: Phaser.Scene,
	x: number,
	y: number,
	width: number,
	height: number,
	alpha = 0.95
) {
	const frame = scene.add.rectangle(x, y, width + 14, height + 14, PALETTE.oak, alpha)
		.setStrokeStyle(3, PALETTE.parchmentEdge, 1);
	const panel = scene.add.rectangle(x, y, width, height, PALETTE.parchment, alpha)
		.setStrokeStyle(2, PALETTE.gold, 0.8);
	const rule = scene.add.rectangle(x, y, width - 12, height - 12)
		.setStrokeStyle(1, PALETTE.parchmentEdge, 0.55);

	return { frame, panel, rule };
}

/**
 * Heading with a gold rule and diamond flourish either side — the recurring
 * "banner" motif used for scene titles.
 */
export function bannerHeading(scene: Phaser.Scene, x: number, y: number, label: string, size = 52) {
	const text = scene.add
		.text(x, y, label, {
			fontFamily: FONT_DISPLAY,
			fontSize: size,
			color: GOLD_BRIGHT,
			stroke: '#1a1109',
			strokeThickness: 7,
			align: 'center'
		})
		.setOrigin(0.5);

	const ruleWidth = Math.max(text.width * 0.75, 160);
	const ruleY = y + size * 0.72;

	scene.add.rectangle(x, ruleY, ruleWidth, 2, PALETTE.gold, 0.85);
	scene.add.rectangle(x, ruleY + 5, ruleWidth * 0.6, 1, PALETTE.gold, 0.45);

	// Diamond flourishes at each end of the rule.
	[x - ruleWidth / 2 - 14, x + ruleWidth / 2 + 14].forEach((dx) => {
		scene.add.rectangle(dx, ruleY, 9, 9, PALETTE.gold, 0.9).setAngle(45);
	});

	return text;
}

export interface OrnateButtonOptions {
	width?: number;
	height?: number;
	fill?: number;
	fillHover?: number;
	fontSize?: number;
}

/**
 * Oak-framed button with a heraldic fill, gold rule, and a lift-on-hover tween.
 * Returns the text object so callers can relabel it (e.g. the difficulty cycler).
 */
export function ornateButton(
	scene: Phaser.Scene,
	x: number,
	y: number,
	label: string,
	onClick: () => void,
	options: OrnateButtonOptions = {}
) {
	const width = options.width ?? 340;
	const height = options.height ?? 62;
	const fill = options.fill ?? PALETTE.forest;
	const fillHover = options.fillHover ?? PALETTE.forestLight;

	const container = scene.add.container(x, y);

	const frame = scene.add.rectangle(0, 0, width + 10, height + 10, PALETTE.oak, 0.95)
		.setStrokeStyle(2, PALETTE.gold, 0.75);
	const face = scene.add.rectangle(0, 0, width, height, fill, 0.95)
		.setStrokeStyle(1, PALETTE.goldBright, 0.5);

	const text = scene.add
		.text(0, 0, label, {
			fontFamily: FONT_BODY,
			fontSize: `${options.fontSize ?? 26}px`,
			color: PARCHMENT,
			stroke: '#140d06',
			strokeThickness: 3
		})
		.setOrigin(0.5);

	// Corner studs, a cheap way to read as metal-bound woodwork.
	const studs = [
		[-width / 2 + 10, -height / 2 + 10],
		[width / 2 - 10, -height / 2 + 10],
		[-width / 2 + 10, height / 2 - 10],
		[width / 2 - 10, height / 2 - 10]
	].map(([sx, sy]) => scene.add.circle(sx, sy, 3, PALETTE.goldBright, 0.85));

	container.add([frame, face, ...studs, text]);
	container.setSize(width + 10, height + 10);
	container.setInteractive({ useHandCursor: true });

	container.on('pointerover', () => {
		face.setFillStyle(fillHover, 1);
		text.setColor(GOLD_BRIGHT);
		scene.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 120 });
	});
	container.on('pointerout', () => {
		face.setFillStyle(fill, 0.95);
		text.setColor(PARCHMENT);
		scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 });
	});
	container.on('pointerdown', () => {
		scene.tweens.add({
			targets: container,
			scaleX: 0.97,
			scaleY: 0.97,
			duration: 80,
			yoyo: true,
			onComplete: onClick
		});
	});

	return { container, text, face };
}

/** Small centred caption in muted ink, for hints and subtitles. */
export function caption(scene: Phaser.Scene, x: number, y: number, label: string, size = 18) {
	return scene.add
		.text(x, y, label, {
			fontFamily: FONT_BODY,
			fontSize: `${size}px`,
			color: PARCHMENT,
			stroke: '#140d06',
			strokeThickness: 3,
			align: 'center',
			wordWrap: { width: scene.scale.width * 0.7 }
		})
		.setOrigin(0.5);
}
