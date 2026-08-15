import type { TerrainTheme } from '$game/world/themes';

/** Vertical distance between generated platform bands. */
export const BAND_HEIGHT = 200;

export interface Platform {
	x: number;
	y: number;
	width: number;
	height: number;
	/** Solid platforms block from every side; wooden ones only from above. */
	solid: boolean;
	theme: TerrainTheme;
	/**
	 * The floor slab. It collides like a platform but is drawn by the ground
	 * painter, so the renderer skips it rather than stretching a plank over it.
	 */
	isGround?: boolean;
}

export interface Spike {
	x: number;
	y: number;
	size: number;
	/** Animation phase, so a field of spikes does not pulse in lockstep. */
	phase: number;
	alive: boolean;
}

export interface Rune {
	x: number;
	y: number;
	/** Base y, around which it bobs. */
	baseY: number;
	size: number;
	phase: number;
	alive: boolean;
}

export interface Ground {
	y: number;
	theme: TerrainTheme;
}

/** Axis-aligned box test, used for every collision in the game. */
export function overlaps(
	ax: number,
	ay: number,
	aw: number,
	ah: number,
	bx: number,
	by: number,
	bw: number,
	bh: number
): boolean {
	return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
