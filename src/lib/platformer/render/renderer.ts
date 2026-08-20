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
	/** Rival climbers in a race, drawn as coloured ghosts. */
	rivals?: RivalClimber[];
	/** Headband colour for the local climber, assigned in the lobby. */
	playerColour?: string;
}

/** Another player's climber, as last reported. */
export interface RivalClimber {
	name: string;
	css: string;
	/** World position, already smoothed by the caller. */
	x: number;
	y: number;
	facing: 1 | -1;
	anim: 'idle' | 'run' | 'jump' | 'double';
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

	const groundScreenY = toScreenY(world.ground.y);

	drawSky(ctx, width, height, state);
	drawParallax(ctx, width, height, state, camY, groundScreenY);
	drawWalls(ctx, width, height, state, camY);
	drawGround(ctx, width, height, world, groundScreenY);

	drawPlatforms(ctx, world, height, toScreenY);
	drawHazards(ctx, world, height, state.simTime, toScreenY, sprites);

	// Rivals go behind the local climber, so your own frog is never hidden by
	// somebody passing through you.
	if (state.rivals?.length) drawRivals(ctx, state.rivals, width, height, toScreenY, sprites, state);

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
		player.facing,
		state.playerColour
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

/**
 * The floor of the tower.
 *
 * Tiled all the way to the bottom of the viewport rather than one tile deep —
 * a single tile left a gap underneath, so the ground appeared to hover with the
 * backdrop showing through below it.
 */
function drawGround(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	world: World,
	groundScreenY: number
) {
	if (groundScreenY >= height) return;

	const textures = texturesFor(world.ground.theme);
	const tex = textures.ground;
	const tileW = tex.width * 2;
	const tileH = tex.height * 2;
	// Integer destinations only. The camera eases in fractions of a pixel, and
	// with smoothing disabled a fractional drawImage drops or doubles a column,
	// which is what made the brickwork crawl and shimmer as the view moved.
	const top = Math.round(groundScreenY);

	for (let y = top; y < height; y += tileH) {
		for (let x = 0; x < width; x += tileW) {
			ctx.drawImage(tex, Math.round(x), y, tileW, tileH);
		}
	}

	// The mossy lip belongs to the top edge alone, so it is drawn after the body
	// rather than baked into a tile that repeats downward.
	const cap = textures.groundCap;
	const capH = cap.height * 2;
	for (let x = 0; x < width; x += tileW) {
		ctx.drawImage(cap, Math.round(x), top, tileW, capH);
	}
}

function drawParallax(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	state: RenderState,
	camY: number,
	groundScreenY: number
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

	// Distant town, standing on the horizon: its base sits at the ground line so
	// the towers rise from behind the floor rather than under it.
	const town = skyline();
	const townAlpha = 0.75 * (1 - state.altitude);
	if (townAlpha > 0.01) {
		const baseY = Math.min(groundScreenY, height);
		ctx.save();
		ctx.globalAlpha = townAlpha;
		for (let x = 0; x < width; x += town.width) {
			ctx.drawImage(town, Math.round(x), Math.round(baseY - town.height));
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

/**
 * Other players' climbers.
 *
 * Each keeps the authored green body but wears its lobby colour as a headband,
 * at reduced opacity so it reads as somebody else's climber. A rival who has
 * climbed off the top of the view is pinned to the edge with an arrow instead of
 * being dropped — knowing how far ahead somebody is *is* the race, and a rival
 * you cannot see is exactly the one you most want to know about.
 */
function drawRivals(
	ctx: CanvasRenderingContext2D,
	rivals: RivalClimber[],
	width: number,
	height: number,
	toScreenY: (y: number) => number,
	sprites: NinjaSprites,
	state: RenderState
) {
	for (const rival of rivals) {
		const screenY = toScreenY(rival.y);
		const offTop = screenY < 8;
		const offBottom = screenY > height - 8;

		ctx.save();
		ctx.globalAlpha = 0.72;

		if (offTop || offBottom) {
			// Edge marker: a chevron and a name, at the rival's horizontal position.
			const y = offTop ? 14 : height - 14;
			const x = Math.max(20, Math.min(width - 20, rival.x));
			ctx.fillStyle = rival.css;
			ctx.beginPath();
			ctx.moveTo(x, offTop ? y - 8 : y + 8);
			ctx.lineTo(x - 7, offTop ? y + 4 : y - 4);
			ctx.lineTo(x + 7, offTop ? y + 4 : y - 4);
			ctx.closePath();
			ctx.fill();

			ctx.font = '10px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(rival.name, x, offTop ? y + 16 : y - 10);
		} else {
			sprites.draw(
				ctx,
				rival.anim,
				state.simTime,
				rival.x,
				screenY,
				34,
				44,
				rival.facing,
				rival.css
			);

			ctx.font = '10px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillStyle = rival.css;
			ctx.fillText(rival.name, rival.x + 17, screenY - 6);
		}

		ctx.restore();
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
