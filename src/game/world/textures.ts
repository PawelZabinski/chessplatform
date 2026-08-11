import { ALL_THEMES, type TerrainTheme } from './themes';

/**
 * Procedurally drawn castle terrain, generated once per theme.
 *
 * The ninja and the spikes stay as authored sprites; everything else is drawn
 * here so each wing of the tower can be built from its own stone without adding
 * a single binary asset. Texture keys are suffixed with the theme id, so bands
 * generated under different themes coexist in one scene.
 */

type Ctx = CanvasRenderingContext2D;

export const skyKey = (t: TerrainTheme) => `sky_${t.id}`;
export const woodKey = (t: TerrainTheme) => `wood_${t.id}`;
export const stoneKey = (t: TerrainTheme) => `stone_${t.id}`;
export const groundKey = (t: TerrainTheme) => `ground_${t.id}`;
export const wallKey = (t: TerrainTheme) => `wall_${t.id}`;

export const STAR_KEY = 'stars';
export const SKYLINE_KEY = 'skyline';

function canvasTexture(
	scene: Phaser.Scene,
	key: string,
	width: number,
	height: number,
	draw: (ctx: Ctx, w: number, h: number) => void
) {
	if (scene.textures.exists(key)) return;
	const texture = scene.textures.createCanvas(key, width, height);
	if (!texture) return;
	draw(texture.getContext(), width, height);
	texture.refresh();
}

/** Deterministic PRNG so tiles look scattered but never reshuffle. */
function seeded(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
}

function skyTexture(scene: Phaser.Scene, theme: TerrainTheme) {
	canvasTexture(scene, skyKey(theme), 8, 512, (ctx, w, h) => {
		const gradient = ctx.createLinearGradient(0, 0, 0, h);
		theme.sky.forEach((stop, i) => gradient.addColorStop(i / (theme.sky.length - 1), stop));
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, w, h);
	});
}

/**
 * Wooden plank — the pass-through platform. Warm timber against cold stone is
 * the whole cue for "you can jump up through this one".
 */
function woodTexture(scene: Phaser.Scene, theme: TerrainTheme) {
	canvasTexture(scene, woodKey(theme), 84, 9, (ctx, w, h) => {
		const { base, light, highlight, dark, grain } = theme.wood;
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = light;
		ctx.fillRect(0, 0, w, 3);
		ctx.fillStyle = highlight;
		ctx.fillRect(0, 0, w, 1);
		ctx.fillStyle = dark;
		ctx.fillRect(0, h - 2, w, 2);

		ctx.fillStyle = grain;
		[9, 26, 44, 61, 74].forEach((x) => ctx.fillRect(x, 3, 1, h - 5));

		// Iron straps binding each end.
		ctx.fillStyle = theme.metal.dark;
		ctx.fillRect(0, 0, 4, h);
		ctx.fillRect(w - 4, 0, 4, h);
		ctx.fillStyle = theme.metal.light;
		ctx.fillRect(0, 1, 4, 1);
		ctx.fillRect(w - 4, 1, 4, 1);
	});
}

/** Cold banded masonry — the solid platform, impassable from below. */
function stoneTexture(scene: Phaser.Scene, theme: TerrainTheme) {
	canvasTexture(scene, stoneKey(theme), 84, 9, (ctx, w, h) => {
		const { base, light, highlight, dark, joint } = theme.stone;
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = light;
		ctx.fillRect(0, 0, w, 2);
		ctx.fillStyle = highlight;
		ctx.fillRect(0, 0, w, 1);
		ctx.fillStyle = dark;
		ctx.fillRect(0, h - 2, w, 2);

		ctx.fillStyle = joint;
		[20, 42, 64].forEach((x) => ctx.fillRect(x, 2, 1, h - 4));

		ctx.fillStyle = theme.metal.dark;
		ctx.fillRect(0, 0, 5, h);
		ctx.fillRect(w - 5, 0, 5, h);
		ctx.fillStyle = theme.metal.light;
		[1, w - 4].forEach((x) => ctx.fillRect(x, 2, 3, 1));
	});
}

/**
 * Brick floor of the tower, with moss along the top course.
 *
 * Deliberately tall: the tile is anchored by its top surface and hangs past the
 * bottom of the canvas, so no gap can show beneath it at any viewport height.
 */
function groundTexture(scene: Phaser.Scene, theme: TerrainTheme) {
	canvasTexture(scene, groundKey(theme), 64, 112, (ctx, w, h) => {
		const { courseA, courseB, joint, moss } = theme.ground;
		const brickH = 8;

		ctx.strokeStyle = joint;
		ctx.lineWidth = 1;
		for (let row = 0; row * brickH < h; row++) {
			const y = row * brickH;
			const offset = row % 2 === 0 ? 0 : 16;
			ctx.fillStyle = row % 2 === 0 ? courseA : courseB;
			ctx.fillRect(0, y, w, brickH - 1);
			for (let x = offset; x <= w; x += 32) {
				ctx.beginPath();
				ctx.moveTo(x + 0.5, y);
				ctx.lineTo(x + 0.5, y + brickH - 1);
				ctx.stroke();
			}
			ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
			ctx.fillRect(0, y + brickH - 1, w, 1);
		}

		ctx.fillStyle = moss;
		for (let x = 0; x < w; x += 4) {
			if ((x / 4) % 3 !== 0) ctx.fillRect(x, 0, 3, 2);
		}
	});
}

/**
 * Tower wall for the left and right margins. Tiled vertically and scrolled with
 * the camera, this is what makes the climb read as the inside of a shaft rather
 * than open sky.
 */
function wallTexture(scene: Phaser.Scene, theme: TerrainTheme) {
	canvasTexture(scene, wallKey(theme), 96, 128, (ctx, w, h) => {
		const { base, light, dark } = theme.wall;
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, w, h);

		// Offset block courses.
		const bh = 16;
		for (let row = 0; row * bh < h; row++) {
			const y = row * bh;
			const offset = row % 2 === 0 ? 0 : 24;
			ctx.fillStyle = row % 2 === 0 ? base : light;
			ctx.fillRect(0, y, w, bh - 2);
			ctx.fillStyle = dark;
			ctx.fillRect(0, y + bh - 2, w, 2);
			for (let x = offset; x < w; x += 48) {
				ctx.fillRect(x, y, 2, bh - 2);
			}
		}

		// Arrow-slit niches, so the wall has some depth to it.
		const rand = seeded(7);
		for (let i = 0; i < 2; i++) {
			const nx = 20 + Math.floor(rand() * (w - 56));
			const ny = 16 + Math.floor(rand() * (h - 72));
			ctx.fillStyle = dark;
			ctx.fillRect(nx, ny, 14, 44);
			ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
			ctx.fillRect(nx + 4, ny + 4, 6, 36);
		}
	});
}

function starTexture(scene: Phaser.Scene) {
	canvasTexture(scene, STAR_KEY, 256, 256, (ctx, w, h) => {
		ctx.clearRect(0, 0, w, h);
		const rand = seeded(1337);
		for (let i = 0; i < 70; i++) {
			const x = rand() * w;
			const y = rand() * h;
			const r = rand() < 0.85 ? 1 : 1.6;
			ctx.fillStyle = `rgba(255, 246, 214, ${0.35 + rand() * 0.5})`;
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fill();
		}
	});
}

function skylineTexture(scene: Phaser.Scene) {
	canvasTexture(scene, SKYLINE_KEY, 512, 180, (ctx, w, h) => {
		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = 'rgba(16, 18, 27, 0.9)';

		const rand = seeded(99);
		let x = 0;
		while (x < w) {
			const towerW = 26 + Math.floor(rand() * 34);
			const towerH = 50 + Math.floor(rand() * 110);
			const y = h - towerH;
			ctx.fillRect(x, y, towerW, towerH);
			for (let cx = x; cx < x + towerW - 4; cx += 10) {
				ctx.fillRect(cx, y - 6, 6, 6);
			}
			// A lit window here and there.
			if (rand() < 0.5) {
				ctx.fillStyle = 'rgba(240, 190, 110, 0.5)';
				ctx.fillRect(x + towerW / 2 - 2, y + 14, 4, 6);
				ctx.fillStyle = 'rgba(16, 18, 27, 0.9)';
			}
			x += towerW + 8 + Math.floor(rand() * 16);
		}
	});
}

/** Small glowing mote used for the drifting ember/dust layer. */
export function createMoteTexture(scene: Phaser.Scene, key = 'mote') {
	canvasTexture(scene, key, 8, 8, (ctx, w, h) => {
		ctx.clearRect(0, 0, w, h);
		const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
		gradient.addColorStop(0, 'rgba(255,255,255,1)');
		gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
		gradient.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, w, h);
	});
}

/** Builds every theme's terrain up front; each is only a few small canvases. */
export function createAllTerrainTextures(scene: Phaser.Scene) {
	ALL_THEMES.forEach((theme) => {
		skyTexture(scene, theme);
		woodTexture(scene, theme);
		stoneTexture(scene, theme);
		groundTexture(scene, theme);
		wallTexture(scene, theme);
	});
	starTexture(scene);
	skylineTexture(scene);
	createMoteTexture(scene);
}
