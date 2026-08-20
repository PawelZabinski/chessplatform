/**
 * Climber colours.
 *
 * The server randomly assigns one unique colour per lobby. Only the ninja's
 * headband is recoloured; the frog itself stays the authored green.
 */

export interface ClimberColour {
	name: string;
	/** CSS colour for lobby chips and name tags. */
	css: string;
}

export const CLIMBER_COLOURS: ClimberColour[] = [
	{ name: 'Red', css: '#ef4444' },
	{ name: 'Green', css: '#22c55e' },
	{ name: 'Blue', css: '#3b82f6' },
	{ name: 'Yellow', css: '#facc15' },
	{ name: 'Purple', css: '#a855f7' }
];

export function colourFor(index: number): ClimberColour {
	// Never undefined: a bad index is a caller's bug, but it must not take the
	// renderer down with it mid-frame.
	const safe = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
	return CLIMBER_COLOURS[safe % CLIMBER_COLOURS.length];
}
