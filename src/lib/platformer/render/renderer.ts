import type { TerrainTheme } from '$game/world/themes';
import type { Lava } from '../world/Lava';
import type { Player } from '../world/Player';
import type { World } from '../world/World';
import { drawRune, drawSpike, skyline, starfield, texturesFor } from './painters';
import type { NinjaSprites } from './sprites';

const WALL_WIDTH = 74;

export interface RenderState {
	cameraY: number;
	theme: TerrainTheme;
	/** 0..1, how high the climb has gone — drives the dusk-to-night shift. */
	altitude: number;
	simTime: number;
	/** 0..1 lava proximity, drives the warning glow. */
	danger: number;
	slowMotion: boolean;
}

/**
 * Draws a frame.
 *
 * Layers back to front: sky gradient, stars, distant skyline, tower walls,
 * platforms, hazards, the climber, lava, and finally the danger vignette. All
 * positions are in world space and shifted by the camera; nothing is retained
 * between frames, so a resize needs no rebuilding.
 */
export function renderWorld(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	world: World,
	player: Player,
	lava: Lava,
	sprites: NinjaSprites,
	state: RenderState,
	alpha: number
) {
	const camY = state.cameraY;
	const toScreenY = (worldY: number) => worldY - camY;

	drawSky(ctx, width, height, state);
	drawParallax(ctx, width, height, state, camY);
	drawWalls(ctx, width, height, state, camY);

	// Ground slab, drawn tall enough that it never shows a gap at the bottom.
	const groundScreenY = toScreenY(world.ground.y);
	if (groundScreenY < height) {
		const tex = texturesFor(world.ground.theme).ground;
		const tileW = tex.width * 2;
		const tileH = tex.height * 2;
		for (let x = 0; x < width + tileW; x += tileW) {
			ctx.drawImage(tex, Math.round(x), Math.round(groundScreenY), tileW, tileH);
		}
	}

	drawPlatforms(ctx, world, height, toScreenY);
	drawHazards(ctx, world, height, state.simTime, toScreenY, sprites);

	// The climber, interpolated between fixed steps so motion stays smooth.
	const px = player.prevX + (player.x - player.prevX) * alpha;
	const py = player.prevY + (player.y - player.prevY) * alpha;
	sprites.draw(
		ctx,
		player.anim,
		player.animTime,
		px,
		toScreenY(py),
		player.width,
		player.height,
		player.facing
	);

	drawLava(ctx, width, height, lava, toScreenY, state.simTime, alpha);
	if (state.danger > 0) drawDangerVignette(ctx, width, height, state.danger);
	if (state.slowMotion) drawSlowMotionTint(ctx, width, height);
}

function drawSky(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	state: RenderState
) {
	const stops = texturesFor(state.theme).skyStops;
	const gradient = ctx.createLinearGradient(0, 0, 0, height);
	stops.forEach((stop, i) => gradient.addColorStop(i / (stops.length - 1), stop));
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
}

function drawParallax(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	state: RenderState,
	camY: number
) {
	// Stars fade in with altitude; the distant town sinks away as you climb.
	const stars = starfield();
	const starAlpha = Math.max(state.theme.starAlpha, state.altitude);
	if (starAlpha > 0.01) {
		ctx.save();
		ctx.globalAlpha = starAlpha;
		const offset = ((-camY * 0.12) % stars.height) - stars.height;
		for (let y = offset; y < height; y += stars.height) {
			for (let x = 0; x < width; x += stars.width) {
				ctx.drawImage(stars, Math.round(x), Math.round(y));
			}
		}
		ctx.restore();
	}

	const town = skyline();
	const townAlpha = 0.75 * (1 - state.altitude);
	if (townAlpha > 0.01) {
		ctx.save();
		ctx.globalAlpha = townAlpha;
		const y = height - town.height + Math.max(0, -camY * 0.04);
		for (let x = 0; x < width; x += town.width) {
			ctx.drawImage(town, Math.round(x), Math.round(y));
		}
		ctx.restore();
	}
}

function drawWalls(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	state: RenderState,
	camY: number
) {
	const wall = texturesFor(state.theme).wall;
	// Walls scroll close to 1:1 with the camera, which is what makes the climb
	// read as the inside of a shaft rather than open sky.
	const offset = ((-camY * 0.85) % wall.height) - wall.height;

	for (let y = offset; y < height; y += wall.height) {
		ctx.drawImage(wall, 0, Math.round(y), WALL_WIDTH, wall.height);

		ctx.save();
		ctx.translate(width, 0);
		ctx.scale(-1, 1);
		ctx.drawImage(wall, 0, Math.round(y), WALL_WIDTH, wall.height);
		ctx.restore();
	}

	// Inner edge shadow, so the play area sits inside the shaft.
	const shade = ctx.createLinearGradient(0, 0, WALL_WIDTH + 40, 0);
	shade.addColorStop(0, 'rgba(0,0,0,0.55)');
	shade.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = shade;
	ctx.fillRect(0, 0, WALL_WIDTH + 40, height);

	ctx.save();
	ctx.translate(width, 0);
	ctx.scale(-1, 1);
	ctx.fillRect(0, 0, WALL_WIDTH + 40, height);
	ctx.restore();
}

function drawPlatforms(
	ctx: CanvasRenderingContext2D,
	world: World,
	height: number,
	toScreenY: (y: number) => number
) {
	for (const p of world.platforms) {
		// The floor is drawn by the ground painter, not as a plank.
		if (p.isGround) continue;
		const y = toScreenY(p.y);
		if (y < -p.height * 2 || y > height + p.height) continue;

		const tex = p.solid ? texturesFor(p.theme).stone : texturesFor(p.theme).wood;
		ctx.drawImage(tex, Math.round(p.x), Math.round(y), Math.round(p.width), Math.round(p.height));

		// A soft drop shadow gives the bands some separation from the backdrop.
		ctx.fillStyle = 'rgba(0,0,0,0.22)';
		ctx.fillRect(Math.round(p.x) + 3, Math.round(y + p.height), Math.round(p.width) - 6, 3);
	}
}

function drawHazards(
	ctx: CanvasRenderingContext2D,
	world: World,
	height: number,
	simTime: number,
	toScreenY: (y: number) => number,
	sprites: NinjaSprites
) {
	for (const spike of world.spikes) {
		if (!spike.alive) continue;
		const y = toScreenY(spike.y);
		if (y < -spike.size || y > height + spike.size) continue;
		// The authored spike art is kept; the drawn one is only a fallback.
		if (!sprites.drawSpike(ctx, spike.x, y, spike.size, simTime, spike.phase)) {
			drawSpike(ctx, spike.x, y, spike.size, Math.sin(simTime / 260 + spike.phase));
		}
	}

	for (const rune of world.runes) {
		if (!rune.alive) continue;
		const bob = Math.sin(simTime / 420 + rune.phase) * 6;
		const y = toScreenY(rune.baseY + bob);
		if (y < -rune.size || y > height + rune.size) continue;
		drawRune(ctx, rune.x, y, rune.size, 0.5 + Math.sin(simTime / 300 + rune.phase) * 0.5);
	}
}

function drawLava(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	lava: Lava,
	toScreenY: (y: number) => number,
	simTime: number,
	alpha: number
) {
	if (!lava.active) return;

	const worldY = lava.prevSurfaceY + (lava.surfaceY - lava.prevSurfaceY) * alpha;
	const y = toScreenY(worldY);
	if (y > height + 60) return;

	// Glow above the crust.
	const glow = ctx.createLinearGradient(0, y - 70, 0, y);
	glow.addColorStop(0, 'rgba(255,106,31,0)');
	glow.addColorStop(1, 'rgba(255,106,31,0.30)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, Math.round(y - 70), width, 70);

	// Molten body.
	ctx.fillStyle = '#7a1207';
	ctx.fillRect(0, Math.round(y), width, height - y + 80);

	const hot = ctx.createLinearGradient(0, y, 0, y + 40);
	hot.addColorStop(0, '#ffb43c');
	hot.addColorStop(0.35, '#d6390b');
	hot.addColorStop(1, 'rgba(122,18,7,0)');
	ctx.fillStyle = hot;
	ctx.fillRect(0, Math.round(y), width, 40);

	// Crust line with a slow swell.
	ctx.fillStyle = '#ffd98a';
	const wave = 3;
	ctx.beginPath();
	ctx.moveTo(0, y);
	for (let x = 0; x <= width; x += 12) {
		ctx.lineTo(x, y + Math.sin(simTime / 240 + x / 46) * wave);
	}
	ctx.lineTo(width, y + 5);
	ctx.lineTo(0, y + 5);
	ctx.closePath();
	ctx.fill();
}

function drawDangerVignette(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	danger: number
) {
	const gradient = ctx.createLinearGradient(0, height, 0, height * 0.45);
	gradient.addColorStop(0, `rgba(200,50,15,${0.42 * danger})`);
	gradient.addColorStop(1, 'rgba(200,50,15,0)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
}

function drawSlowMotionTint(ctx: CanvasRenderingContext2D, width: number, height: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'screen';
	ctx.fillStyle = 'rgba(90,140,200,0.10)';
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}
