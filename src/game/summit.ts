import type { TowerFloor } from './levels';

/**
 * Height as a way to win a floor.
 *
 * Climbing used to be worth nothing on its own: the only way off a floor was to
 * checkmate or hold a draw, so the tower — the thing the mode is named after —
 * was scenery. A floor now has a summit, and reaching it takes the floor
 * outright. That gives the two halves of the game two genuine routes to the same
 * result: out-play the engine, or out-climb it.
 *
 * Stars mark the way up rather than rating the finish. You can see the next one
 * coming, and a floor abandoned near the top still banks what it reached — which
 * is the point of having them: a partial climb should be worth something, or
 * there is no reason to keep climbing once the position is winning.
 *
 * Checkmate awards all three regardless of height, because the victory fling
 * launches you to the top anyway; making the player wait out an animation to
 * collect stars they have already earned would be pure ceremony.
 */

/** Fractions of the summit at which each star is awarded. */
export const STAR_MARKS = [0.4, 0.7, 1] as const;
export const MAX_STARS = 3;

export type Stars = 0 | 1 | 2 | 3;

/**
 * Bands to the summit of a floor.
 *
 * Grows with the floor number so the climb stays roughly as demanding as the
 * chess beside it: the Undercroft is a short hop while you learn the controls,
 * the Spire is a real ascent. An explicit `summit` on a floor overrides this
 * whenever a particular position wants a different balance.
 */
export function summitFor(floor: TowerFloor): number {
	return floor.summit ?? 10 + floor.floor;
}

/** Stars earned by height alone. */
export function starsForHeight(bands: number, summit: number): Stars {
	if (summit <= 0) return 0;
	const fraction = bands / summit;
	let stars = 0;
	for (const mark of STAR_MARKS) if (fraction >= mark) stars += 1;
	return stars as Stars;
}

/** Height of the next star, or null once all three are held. */
export function nextStarBand(bands: number, summit: number): number | null {
	for (const mark of STAR_MARKS) {
		const at = summit * mark;
		if (bands < at) return at;
	}
	return null;
}
