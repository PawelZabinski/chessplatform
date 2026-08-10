/**
 * Terrain themes.
 *
 * Every wing of the Tower — and every stage of the Endless Ascent — is built
 * from different stone. Because bands keep the theme they were generated with,
 * climbing past a boundary leaves a visible seam in the masonry, so the tower
 * reads as strata rather than one repeated tile.
 */

export interface TerrainTheme {
	id: string;
	name: string;
	/** Sky gradient, top (highest) to bottom (lowest). */
	sky: [string, string, string, string];
	stone: { base: string; light: string; highlight: string; dark: string; joint: string };
	wood: { base: string; light: string; highlight: string; dark: string; grain: string };
	ground: { courseA: string; courseB: string; joint: string; moss: string };
	metal: { dark: string; light: string };
	/** Tint for the tower's side walls. */
	wall: { base: string; light: string; dark: string };
	/** Colour of drifting motes in this section. */
	mote: string;
	/** How strongly stars show through. */
	starAlpha: number;
}

const UNDERCROFT: TerrainTheme = {
	id: 'undercroft',
	name: 'Undercroft',
	sky: ['#0d1017', '#141a24', '#26202a', '#3d2a24'],
	stone: {
		base: '#4c5058',
		light: '#6d737d',
		highlight: '#98a1ad',
		dark: '#2b2e34',
		joint: '#24272c'
	},
	wood: {
		base: '#6b4126',
		light: '#96612f',
		highlight: '#b8813f',
		dark: '#3f2615',
		grain: 'rgba(58, 33, 16, 0.6)'
	},
	ground: { courseA: '#4a4238', courseB: '#443c34', joint: '#282219', moss: 'rgba(84, 108, 60, 0.6)' },
	metal: { dark: '#33373e', light: '#6c7480' },
	wall: { base: '#2a2d34', light: '#3a3f48', dark: '#1a1c21' },
	mote: '#7fa06a',
	starAlpha: 0
};

const STAIR: TerrainTheme = {
	id: 'stair',
	name: 'Stair',
	sky: ['#131624', '#233049', '#4a4a5e', '#8a6a4c'],
	stone: {
		base: '#8a7a5e',
		light: '#a8967a',
		highlight: '#d8c79c',
		dark: '#584c38',
		joint: '#463b2b'
	},
	wood: {
		base: '#7d5330',
		light: '#a97640',
		highlight: '#cb9a58',
		dark: '#4c3119',
		grain: 'rgba(66, 41, 20, 0.55)'
	},
	ground: { courseA: '#6f6248', courseB: '#665a42', joint: '#3d3527', moss: 'rgba(120, 132, 74, 0.45)' },
	metal: { dark: '#4a3f2e', light: '#8d7c5c' },
	wall: { base: '#453c2c', light: '#5b503b', dark: '#2b2519' },
	mote: '#d8c79c',
	starAlpha: 0.35
};

const GALLERY: TerrainTheme = {
	id: 'gallery',
	name: 'Gallery',
	sky: ['#0b1020', '#152341', '#2c3a63', '#4d5b86'],
	stone: {
		base: '#6f7a92',
		light: '#93a0b8',
		highlight: '#c6d2e6',
		dark: '#3f4759',
		joint: '#333a49'
	},
	wood: {
		base: '#5f4a6b',
		light: '#836797',
		highlight: '#a888bd',
		dark: '#392b41',
		grain: 'rgba(45, 32, 52, 0.55)'
	},
	ground: { courseA: '#5a6076', courseB: '#52586c', joint: '#313644', moss: 'rgba(96, 122, 150, 0.4)' },
	metal: { dark: '#3a4152', light: '#8f9bb4' },
	wall: { base: '#333a4c', light: '#464f66', dark: '#20252f' },
	mote: '#c6d2e6',
	starAlpha: 0.7
};

const SPIRE: TerrainTheme = {
	id: 'spire',
	name: 'Spire',
	sky: ['#08070d', '#170d18', '#341425', '#6d2320'],
	stone: {
		base: '#3b3138',
		light: '#57474f',
		highlight: '#8d6a6a',
		dark: '#221c21',
		joint: '#181316'
	},
	wood: {
		base: '#5e2f28',
		light: '#8a4535',
		highlight: '#b96547',
		dark: '#361813',
		grain: 'rgba(40, 18, 14, 0.6)'
	},
	ground: { courseA: '#3a2f31', courseB: '#342a2c', joint: '#1d1719', moss: 'rgba(150, 60, 40, 0.35)' },
	metal: { dark: '#2b2226', light: '#7a5a58' },
	wall: { base: '#241d22', light: '#342930', dark: '#150f13' },
	mote: '#ff9159',
	starAlpha: 0.9
};

const VERDANT: TerrainTheme = {
	id: 'verdant',
	name: 'Verdant',
	sky: ['#0e1a1c', '#173033', '#2b4a44', '#6d7a4a'],
	stone: {
		base: '#5a6a5c',
		light: '#7b8d7c',
		highlight: '#a9bda6',
		dark: '#334035',
		joint: '#28322a'
	},
	wood: {
		base: '#6d5a2c',
		light: '#937c3c',
		highlight: '#b89c4e',
		dark: '#40341a',
		grain: 'rgba(52, 42, 20, 0.55)'
	},
	ground: { courseA: '#4d5646', courseB: '#454e40', joint: '#28302a', moss: 'rgba(104, 140, 70, 0.65)' },
	metal: { dark: '#39412f', light: '#7d8a63' },
	wall: { base: '#2c3730', light: '#3d4a40', dark: '#1a221d' },
	mote: '#9fd07a',
	starAlpha: 0.15
};

export const THEMES: Record<string, TerrainTheme> = {
	undercroft: UNDERCROFT,
	stair: STAIR,
	gallery: GALLERY,
	spire: SPIRE,
	verdant: VERDANT
};

/** Tower wings map one-to-one onto themes. */
export function themeForWing(wing: string): TerrainTheme {
	switch (wing) {
		case 'The Undercroft':
			return UNDERCROFT;
		case 'The Stair':
			return STAIR;
		case 'The Gallery':
			return GALLERY;
		default:
			return SPIRE;
	}
}

/**
 * Endless cycles through every theme as the stages advance, so a long run keeps
 * changing character instead of settling into one look.
 */
const ENDLESS_ORDER = [VERDANT, UNDERCROFT, STAIR, GALLERY, SPIRE];

export function themeForStage(stageIndex: number): TerrainTheme {
	const i = Math.max(0, stageIndex - 1);
	return ENDLESS_ORDER[i % ENDLESS_ORDER.length];
}

export const ALL_THEMES = Object.values(THEMES);
