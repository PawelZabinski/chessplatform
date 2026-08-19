/**
 * Climber colours.
 *
 * One hue per seat, far enough apart to tell instantly which frog is which at
 * the size these are drawn — that is the whole job, so they are chosen by
 * separation rather than by taste. The rotation is applied to the existing green
 * sprite, so every climber is recognisably the same character rather than a
 * separate set of art to keep in step.
 *
 * Index 0 is the sprite's own green and is left unrotated: the player who
 * joins first sees the frog they already know from single player.
 */

export interface ClimberColour {
	name: string;
	/** Degrees of hue rotation applied to the sprite. */
	hue: number;
	/** CSS colour for lobby chips and name tags. */
	css: string;
}

export const CLIMBER_COLOURS: ClimberColour[] = [
	{ name: 'Green', hue: 0, css: '#6fbf4a' },
	{ name: 'Crimson', hue: 250, css: '#d1495b' },
	{ name: 'Azure', hue: 165, css: '#4a8fd1' },
	{ name: 'Amber', hue: 300, css: '#e0a33a' },
	{ name: 'Violet', hue: 205, css: '#9b6fd1' }
];

export function colourFor(index: number): ClimberColour {
	// Never undefined: a bad index is a caller's bug, but it must not take the
	// renderer down with it mid-frame.
	const safe = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
	return CLIMBER_COLOURS[safe % CLIMBER_COLOURS.length];
}
