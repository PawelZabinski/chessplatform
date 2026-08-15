import { ALL_THEMES, type TerrainTheme } from '$game/world/themes';

/**
 * Procedurally drawn castle terrain, baked once into offscreen canvases.
 *
 * Same medieval look as before, but painted with plain Canvas 2D instead of a
 * framework's texture manager. Each theme gets its own set, so a climb that
 * passes between wings shows the masonry change as a seam.
 *
 * These are drawn small and scaled up with smoothing off, which keeps the
 * chunky pixel feel and stays sharp on a high-DPR phone.
 */

export interface ThemeTextures {
	wood: HTMLCanvasElement;
	stone: HTMLCanvasElement;
	ground: HTMLCanvasElement;
	wall: HTMLCanvasElement;
	sky: CanvasGradient | null;
	skyStops: [string, string, string, string];
}

const cache = new Map<string, ThemeTextures>();
let starsCanvas: HTMLCanvasElement | null = null;
let skylineCanvas: HTMLCanvasElement | null = null;

function make(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (ctx) draw(ctx);
	return canvas;
}

/** Deterministic scatter, so tiles never reshuffle between reloads. */
function seeded(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
}

function woodPlank(theme: TerrainTheme) {
	return make(84, 9, (ctx) => {
		const { base, light, highlight, dark, grain } = theme.wood;
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, 84, 9);
		ctx.fillStyle = light;
		ctx.fillRect(0, 0, 84, 3);
		ctx.fillStyle = highlight;
		ctx.fillRect(0, 0, 84, 1);
		ctx.fillStyle = dark;
		ctx.fillRect(0, 7, 84, 2);

		ctx.fillStyle = grain;
		[9, 26, 44, 61, 74].forEach((x) => ctx.fillRect(x, 3, 1, 4));

		ctx.fillStyle = theme.metal.dark;
		ctx.fillRect(0, 0, 4, 9);
		ctx.fillRect(80, 0, 4, 9);
		ctx.fillStyle = theme.metal.light;
		ctx.fillRect(0, 1, 4, 1);
		ctx.fillRect(80, 1, 4, 1);
	});
}

function stoneSlab(theme: TerrainTheme) {
	return make(84, 9, (ctx) => {
		const { base, light, highlight, dark, joint } = theme.stone;
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, 84, 9);
		ctx.fillStyle = light;
		ctx.fillRect(0, 0, 84, 2);
		ctx.fillStyle = highlight;
		ctx.fillRect(0, 0, 84, 1);
		ctx.fillStyle = dark;
		ctx.fillRect(0, 7, 84, 2);

		ctx.fillStyle = joint;
		[20, 42, 64].forEach((x) => ctx.fillRect(x, 2, 1, 5));

		ctx.fillStyle = theme.metal.dark;
		ctx.fillRect(0, 0, 5, 9);
		ctx.fillRect(79, 0, 5, 9);
		ctx.fillStyle = theme.metal.light;
		[1, 80].forEach((x) => ctx.fillRect(x, 2, 3, 1));
	});
}

function groundBricks(theme: TerrainTheme) {
	return make(64, 112, (ctx) => {
		const { courseA, courseB, joint, moss } = theme.ground;
		const brickH = 8;
		ctx.strokeStyle = joint;
		ctx.lineWidth = 1;

		for (let row = 0; row * brickH < 112; row++) {
			const y = row * brickH;
			const offset = row % 2 === 0 ? 0 : 16;
			ctx.fillStyle = row % 2 === 0 ? courseA : courseB;
			ctx.fillRect(0, y, 64, brickH - 1);
			for (let x = offset; x <= 64; x += 32) {
				ctx.beginPath();
				ctx.moveTo(x + 0.5, y);
				ctx.lineTo(x + 0.5, y + brickH - 1);
				ctx.stroke();
			}
			ctx.fillStyle = 'rgba(0,0,0,0.35)';
			ctx.fillRect(0, y + brickH - 1, 64, 1);
		}

		ctx.fillStyle = moss;
		for (let x = 0; x < 64; x += 4) {
			if ((x / 4) % 3 !== 0) ctx.fillRect(x, 0, 3, 2);
		}
	});
}

function towerWall(theme: TerrainTheme) {
	return make(96, 128, (ctx) => {
		const { base, light, dark } = theme.wall;
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, 96, 128);

		const bh = 16;
		for (let row = 0; row * bh < 128; row++) {
			const y = row * bh;
			const offset = row % 2 === 0 ? 0 : 24;
			ctx.fillStyle = row % 2 === 0 ? base : light;
			ctx.fillRect(0, y, 96, bh - 2);
			ctx.fillStyle = dark;
			ctx.fillRect(0, y + bh - 2, 96, 2);
			for (let x = offset; x < 96; x += 48) ctx.fillRect(x, y, 2, bh - 2);
		}

		// Arrow-slit niches, so the wall has some depth.
		const rand = seeded(7);
		for (let i = 0; i < 2; i++) {
			const nx = 20 + Math.floor(rand() * 40);
			const ny = 16 + Math.floor(rand() * 56);
			ctx.fillStyle = dark;
			ctx.fillRect(nx, ny, 14, 44);
			ctx.fillStyle = 'rgba(0,0,0,0.55)';
			ctx.fillRect(nx + 4, ny + 4, 6, 36);
		}
	});
}

export function starfield(): HTMLCanvasElement {
	if (starsCanvas) return starsCanvas;
	starsCanvas = make(256, 256, (ctx) => {
		const rand = seeded(1337);
		for (let i = 0; i < 70; i++) {
			const x = rand() * 256;
			const y = rand() * 256;
			const r = rand() < 0.85 ? 1 : 1.6;
			ctx.fillStyle = `rgba(255,246,214,${0.35 + rand() * 0.5})`;
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fill();
		}
	});
	return starsCanvas;
}

export function skyline(): HTMLCanvasElement {
	if (skylineCanvas) return skylineCanvas;
	skylineCanvas = make(512, 180, (ctx) => {
		const rand = seeded(99);
		let x = 0;
		while (x < 512) {
			const w = 26 + Math.floor(rand() * 34);
			const h = 50 + Math.floor(rand() * 110);
			const y = 180 - h;
			ctx.fillStyle = 'rgba(16,18,27,0.9)';
			ctx.fillRect(x, y, w, h);
			for (let cx = x; cx < x + w - 4; cx += 10) ctx.fillRect(cx, y - 6, 6, 6);
			if (rand() < 0.5) {
				ctx.fillStyle = 'rgba(240,190,110,0.5)';
				ctx.fillRect(x + w / 2 - 2, y + 14, 4, 6);
			}
			x += w + 8 + Math.floor(rand() * 16);
		}
	});
	return skylineCanvas;
}

export function texturesFor(theme: TerrainTheme): ThemeTextures {
	const existing = cache.get(theme.id);
	if (existing) return existing;

	const built: ThemeTextures = {
		wood: woodPlank(theme),
		stone: stoneSlab(theme),
		ground: groundBricks(theme),
		wall: towerWall(theme),
		sky: null,
		skyStops: theme.sky
	};
	cache.set(theme.id, built);
	return built;
}

/** Warms the cache so the first frame of a run never stalls painting tiles. */
export function prewarmTextures() {
	ALL_THEMES.forEach(texturesFor);
	starfield();
	skyline();
}

/** Draws the gold control rune. Small enough to paint directly each frame. */
export function drawRune(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	glow: number
) {
	const half = size / 2;
	const cx = x + half;
	const cy = y + half;

	ctx.save();
	ctx.globalAlpha = 0.25 + glow * 0.25;
	ctx.fillStyle = '#f0d264';
	ctx.beginPath();
	ctx.arc(cx, cy, half, 0, Math.PI * 2);
	ctx.fill();

	ctx.globalAlpha = 1;
	const diamond = (inset: number, colour: string) => {
		ctx.fillStyle = colour;
		ctx.beginPath();
		ctx.moveTo(cx, y + inset);
		ctx.lineTo(x + size - inset, cy);
		ctx.lineTo(cx, y + size - inset);
		ctx.lineTo(x + inset, cy);
		ctx.closePath();
		ctx.fill();
	};
	diamond(size * 0.16, '#3b2a1c');
	diamond(size * 0.32, '#f6e2a0');
	ctx.restore();
}

/** Draws an iron spike. */
export function drawSpike(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	wobble: number
) {
	const half = size / 2;
	ctx.save();
	ctx.translate(x + half, y + size);
	ctx.scale(1, 1 + wobble * 0.06);

	ctx.fillStyle = '#2f333a';
	ctx.beginPath();
	ctx.moveTo(-half, 0);
	ctx.lineTo(0, -size);
	ctx.lineTo(half, 0);
	ctx.closePath();
	ctx.fill();

	ctx.fillStyle = '#8d97a5';
	ctx.beginPath();
	ctx.moveTo(-half * 0.35, 0);
	ctx.lineTo(0, -size * 0.92);
	ctx.lineTo(half * 0.1, 0);
	ctx.closePath();
	ctx.fill();

	ctx.fillStyle = '#1c1f24';
	ctx.fillRect(-half, -3, size, 3);
	ctx.restore();
}
