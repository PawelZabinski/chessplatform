import type { FieldRules } from './world/PlatformField';

/**
 * The Tower — the main mode.
 *
 * Each floor drops you into an existing position rather than a fresh game. The
 * early floors hand you an overwhelming material advantage so the chess is a
 * formality, which leaves room to teach one platformer mechanic at a time. From
 * the Stair upward the positions get real, and by the Spire you are losing and
 * have to find the save.
 *
 * 32 floors, one for each piece on a full board.
 */

export interface EngineSettings {
	/** Chance the engine plays a random legal move instead of its best. */
	randomMoveProbability: number;
	depth: number;
	moveTime: number;
	/** Stockfish Skill Level, 0–20. Must rise with depth to matter. */
	skillLevel?: number;
}

export interface TowerFloor {
	floor: number;
	name: string;
	wing: string;
	/** Starting position. The player is always White, and always to move. */
	fen: string;
	/** One-line framing shown on the floor card. */
	brief: string;
	/** Mechanic this floor introduces, shown as a teaching banner. */
	teaches?: string;
	engine: EngineSettings;
	/** Lava rise rate in px/s. 0 disables it. */
	lavaSpeed: number;
	rules: FieldRules;
}

export const WINGS = ['The Undercroft', 'The Stair', 'The Gallery', 'The Spire'] as const;

/** Hazard-free, so the first floors are purely about learning the controls. */
const CALM: FieldRules = { spikeChance: 0, runeChance: 0, blockedChance: 0 };

const floors: TowerFloor[] = [
	// ── The Undercroft — overwhelming material, one new mechanic per floor ──
	{
		floor: 1,
		name: 'First Steps',
		wing: 'The Undercroft',
		fen: '7k/8/8/8/8/8/4QR2/6K1 w - - 0 1',
		brief: 'A queen and rook against a bare king. You cannot lose this.',
		teaches: 'Every move you play lifts the climber. Just play chess.',
		engine: { randomMoveProbability: 1, depth: 1, moveTime: 400 },
		lavaSpeed: 0,
		rules: CALM
	},
	{
		floor: 2,
		name: 'The Feast',
		wing: 'The Undercroft',
		fen: '7k/8/8/3r4/3Q4/8/8/6K1 w - - 0 1',
		brief: 'That rook is hanging. Take it.',
		teaches: 'Captures lift you far higher — the bigger the piece, the bigger the leap.',
		engine: { randomMoveProbability: 1, depth: 1, moveTime: 400 },
		lavaSpeed: 0,
		rules: CALM
	},
	{
		floor: 3,
		name: 'Wood and Stone',
		wing: 'The Undercroft',
		fen: '6k1/8/8/8/8/8/3r4/R2Q2K1 w - - 0 1',
		brief: 'Another gift on the d-file.',
		teaches: 'Wooden planks can be jumped up through. Grey stone cannot.',
		engine: { randomMoveProbability: 1, depth: 1, moveTime: 400 },
		lavaSpeed: 0,
		rules: { spikeChance: 0, runeChance: 0, blockedChance: 0.35 }
	},
	{
		floor: 4,
		name: 'The Rune',
		wing: 'The Undercroft',
		fen: '6k1/5r2/8/8/8/8/8/Q5K1 w - - 0 1',
		brief: 'Queen against rook. Convert it.',
		teaches: 'Gold runes grant 5s of direct control — steer with ← → and jump.',
		engine: { randomMoveProbability: 0.9, depth: 1, moveTime: 400 },
		lavaSpeed: 0,
		rules: { spikeChance: 0, runeChance: 0.35, blockedChance: 0.15 }
	},
	{
		floor: 5,
		name: 'Iron Thorns',
		wing: 'The Undercroft',
		fen: '5rk1/8/6n1/8/8/8/8/1N1Q2K1 w - - 0 1',
		brief: 'You are a queen up. Mind the spikes.',
		teaches: 'Spikes cost you a piece off your own board. Avoid them.',
		engine: { randomMoveProbability: 0.85, depth: 2, moveTime: 500 },
		lavaSpeed: 0,
		rules: { spikeChance: 0.16, runeChance: 0.08, blockedChance: 0.2 }
	},
	{
		floor: 6,
		name: 'The Lava',
		wing: 'The Undercroft',
		fen: '6k1/8/8/3q4/8/8/8/3R2K1 w - - 0 1',
		brief: 'Her queen is loose on the d-file. Take it and climb.',
		teaches: 'The lava is rising. Only chess moves lift you — stalling burns you.',
		engine: { randomMoveProbability: 0.85, depth: 2, moveTime: 500 },
		lavaSpeed: 9,
		rules: { spikeChance: 0.12, runeChance: 0.06, blockedChance: 0.2 }
	},
	{
		floor: 7,
		name: 'Ladder',
		wing: 'The Undercroft',
		fen: '7k/8/8/8/8/8/R7/1R4K1 w - - 0 1',
		brief: 'Two rooks. Walk him to the edge.',
		engine: { randomMoveProbability: 0.8, depth: 2, moveTime: 500 },
		lavaSpeed: 11,
		rules: { spikeChance: 0.14, runeChance: 0.07, blockedChance: 0.22 }
	},
	{
		floor: 8,
		name: 'Undercroft Gate',
		wing: 'The Undercroft',
		fen: '5bk1/5r2/8/8/8/8/8/3Q2K1 w - - 0 1',
		brief: 'Queen against rook and bishop. Still yours.',
		engine: { randomMoveProbability: 0.7, depth: 3, moveTime: 600 },
		lavaSpeed: 12,
		rules: { spikeChance: 0.16, runeChance: 0.08, blockedChance: 0.24 }
	},

	// ── The Stair — real endgame technique, still winning ──
	{
		floor: 9,
		name: 'Opposition',
		wing: 'The Stair',
		fen: '8/8/8/4k3/8/4P3/8/4K3 w - - 0 1',
		brief: 'King and pawn. Take the opposition or it is a draw.',
		engine: { randomMoveProbability: 0.5, depth: 4, moveTime: 700 },
		lavaSpeed: 12,
		rules: { spikeChance: 0.16, runeChance: 0.08, blockedChance: 0.24 }
	},
	{
		floor: 10,
		name: 'Lucena',
		wing: 'The Stair',
		fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
		brief: 'The bridge. Build it.',
		engine: { randomMoveProbability: 0.45, depth: 4, moveTime: 700 },
		lavaSpeed: 13,
		rules: { spikeChance: 0.18, runeChance: 0.09, blockedChance: 0.26 }
	},
	{
		floor: 11,
		name: 'Two Bishops',
		wing: 'The Stair',
		fen: '7k/8/8/8/8/8/4BB2/6K1 w - - 0 1',
		brief: 'Two bishops mate a lone king. Drive him to the corner.',
		engine: { randomMoveProbability: 0.4, depth: 4, moveTime: 700 },
		lavaSpeed: 13,
		rules: { spikeChance: 0.18, runeChance: 0.09, blockedChance: 0.26 }
	},
	{
		floor: 12,
		name: 'Outside Passer',
		wing: 'The Stair',
		fen: '8/5ppp/8/8/8/8/P4PPP/4K1k1 w - - 0 1',
		brief: 'An extra pawn on the wing. Make it count.',
		engine: { randomMoveProbability: 0.4, depth: 5, moveTime: 800 },
		lavaSpeed: 14,
		rules: { spikeChance: 0.2, runeChance: 0.1, blockedChance: 0.28 }
	},
	{
		floor: 13,
		name: 'Rook and Pawn',
		wing: 'The Stair',
		fen: '8/8/8/8/8/1k6/1P6/1K1R4 w - - 0 1',
		brief: 'Rook and pawn. Escort it home.',
		engine: { randomMoveProbability: 0.35, depth: 5, moveTime: 800 },
		lavaSpeed: 14,
		rules: { spikeChance: 0.2, runeChance: 0.1, blockedChance: 0.28 }
	},
	{
		floor: 14,
		name: 'Knight and Bishop',
		wing: 'The Stair',
		fen: '7k/8/8/8/8/8/4NB2/6K1 w - - 0 1',
		brief: 'The hardest basic mate in chess. Corner of the bishop.',
		engine: { randomMoveProbability: 0.3, depth: 5, moveTime: 800 },
		lavaSpeed: 15,
		rules: { spikeChance: 0.22, runeChance: 0.11, blockedChance: 0.3 }
	},
	{
		floor: 15,
		name: 'The Open File',
		wing: 'The Stair',
		fen: '5rk1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
		brief: 'Level material, but the file is yours.',
		engine: { randomMoveProbability: 0.3, depth: 5, moveTime: 800 },
		lavaSpeed: 15,
		rules: { spikeChance: 0.22, runeChance: 0.11, blockedChance: 0.3 }
	},
	{
		floor: 16,
		name: 'Stairhead',
		wing: 'The Stair',
		fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1',
		brief: 'A whole queen for nothing. Do not let it slip.',
		engine: { randomMoveProbability: 0.25, depth: 6, moveTime: 900 },
		lavaSpeed: 16,
		rules: { spikeChance: 0.24, runeChance: 0.12, blockedChance: 0.32 }
	},

	// ── The Gallery — roughly equal, find the idea ──
	{
		floor: 17,
		name: 'Open Lines',
		wing: 'The Gallery',
		fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1',
		brief: 'Dead level. Seize a file before he does.',
		engine: { randomMoveProbability: 0.22, depth: 6, moveTime: 900 },
		lavaSpeed: 17,
		rules: { spikeChance: 0.24, runeChance: 0.12, blockedChance: 0.32 }
	},
	{
		floor: 18,
		name: 'Minor Pieces',
		wing: 'The Gallery',
		fen: 'r1b2rk1/pp3ppp/2n5/8/8/2N5/PP3PPP/R1B2RK1 w - - 0 1',
		brief: 'Symmetrical. The first inaccuracy decides it.',
		engine: { randomMoveProbability: 0.2, depth: 6, moveTime: 900 },
		lavaSpeed: 17,
		rules: { spikeChance: 0.26, runeChance: 0.13, blockedChance: 0.34 }
	},
	{
		floor: 19,
		name: 'The Pin',
		wing: 'The Gallery',
		fen: 'r2q1rk1/ppp2ppp/2n5/3b4/3B4/2N5/PPP2PPP/R2Q1RK1 w - - 0 1',
		brief: 'Everything is defended. For now.',
		engine: { randomMoveProbability: 0.18, depth: 7, moveTime: 1000 },
		lavaSpeed: 18,
		rules: { spikeChance: 0.26, runeChance: 0.13, blockedChance: 0.34 }
	},
	{
		floor: 20,
		name: 'Queens On',
		wing: 'The Gallery',
		fen: '3q1rk1/ppp2ppp/8/8/8/8/PPP2PPP/3Q1RK1 w - - 0 1',
		brief: 'Queens still on the board. Watch your back rank.',
		engine: { randomMoveProbability: 0.16, depth: 7, moveTime: 1000 },
		lavaSpeed: 18,
		rules: { spikeChance: 0.28, runeChance: 0.14, blockedChance: 0.36 }
	},
	{
		floor: 21,
		name: 'Bishop Pair',
		wing: 'The Gallery',
		fen: 'r4rk1/pp3ppp/8/8/8/8/PP3PPP/2B1KB2 w - - 0 1',
		brief: 'Two bishops against two rooks. Open it up.',
		engine: { randomMoveProbability: 0.14, depth: 7, moveTime: 1000 },
		lavaSpeed: 19,
		rules: { spikeChance: 0.28, runeChance: 0.14, blockedChance: 0.36 }
	},
	{
		floor: 22,
		name: 'Hanging Pawns',
		wing: 'The Gallery',
		fen: 'r2q1rk1/pp3ppp/8/2pp4/2P1P3/8/PP3PPP/R2Q1RK1 w - - 0 1',
		brief: 'His centre is loose. Prove it.',
		engine: { randomMoveProbability: 0.12, depth: 7, moveTime: 1100 },
		lavaSpeed: 19,
		rules: { spikeChance: 0.3, runeChance: 0.15, blockedChance: 0.38 }
	},
	{
		floor: 23,
		name: 'The Long Diagonal',
		wing: 'The Gallery',
		fen: 'r2q1rk1/pp2bppp/8/8/8/6P1/PP2PPBP/R2Q1RK1 w - - 0 1',
		brief: 'Your bishop stares at his king. Open the road.',
		engine: { randomMoveProbability: 0.1, depth: 8, moveTime: 1100 },
		lavaSpeed: 20,
		rules: { spikeChance: 0.3, runeChance: 0.15, blockedChance: 0.38 }
	},
	{
		floor: 24,
		name: 'Gallery End',
		wing: 'The Gallery',
		fen: 'r1bq1rk1/pp3ppp/2n5/8/8/2N5/PP3PPP/R1BQ1RK1 w - - 0 1',
		brief: 'The last level position. After this you are behind.',
		engine: { randomMoveProbability: 0.08, depth: 8, moveTime: 1200 },
		lavaSpeed: 20,
		rules: { spikeChance: 0.32, runeChance: 0.16, blockedChance: 0.4 }
	},

	// ── The Spire — you are losing. Find the save. ──
	{
		floor: 25,
		name: 'A Pawn Down',
		wing: 'The Spire',
		fen: '6k1/pp3ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
		brief: 'Down a pawn in a king ending. Hold the draw.',
		teaches: 'From here you are behind. A draw is a win.',
		engine: { randomMoveProbability: 0.08, depth: 8, moveTime: 1200 },
		lavaSpeed: 21,
		rules: { spikeChance: 0.32, runeChance: 0.16, blockedChance: 0.4 }
	},
	{
		floor: 26,
		name: 'The Exchange',
		wing: 'The Spire',
		fen: '5rk1/5ppp/8/8/8/8/5PPP/4B1K1 w - - 0 1',
		brief: 'Bishop against rook. Build a fortress.',
		engine: { randomMoveProbability: 0.06, depth: 8, moveTime: 1200 },
		lavaSpeed: 21,
		rules: { spikeChance: 0.34, runeChance: 0.17, blockedChance: 0.42 }
	},
	{
		floor: 27,
		name: 'Perpetual',
		wing: 'The Spire',
		fen: '3qr1k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1',
		brief: 'A rook down. Find the checks and never stop.',
		engine: { randomMoveProbability: 0.06, depth: 8, moveTime: 1200 },
		lavaSpeed: 22,
		rules: { spikeChance: 0.34, runeChance: 0.17, blockedChance: 0.42 }
	},
	{
		floor: 28,
		name: 'Down a Piece',
		wing: 'The Spire',
		fen: 'r4rk1/pp3ppp/2n5/8/8/8/PP3PPP/R4RK1 w - - 0 1',
		brief: 'A whole knight down. Complicate.',
		engine: { randomMoveProbability: 0.04, depth: 9, moveTime: 1300 },
		lavaSpeed: 22,
		rules: { spikeChance: 0.36, runeChance: 0.18, blockedChance: 0.44 }
	},
	{
		floor: 29,
		name: 'The Last Resource',
		wing: 'The Spire',
		fen: '6k1/5ppp/8/8/8/7q/5PPP/5RK1 w - - 0 1',
		brief: 'A queen down with her queen on your doorstep. Stalemate is a result.',
		engine: { randomMoveProbability: 0.04, depth: 9, moveTime: 1300 },
		lavaSpeed: 23,
		rules: { spikeChance: 0.36, runeChance: 0.18, blockedChance: 0.44 }
	},
	{
		floor: 30,
		name: 'The Rook Lift',
		wing: 'The Spire',
		fen: '3q1rk1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
		brief: 'Rook against queen. Perpetual or perish.',
		engine: { randomMoveProbability: 0.02, depth: 9, moveTime: 1400 },
		lavaSpeed: 23,
		rules: { spikeChance: 0.38, runeChance: 0.19, blockedChance: 0.46 }
	},
	{
		floor: 31,
		name: 'Last Defence',
		wing: 'The Spire',
		fen: '2r3k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
		brief: 'A rook down in a pawn ending. Almost nothing left.',
		engine: { randomMoveProbability: 0.02, depth: 10, moveTime: 1400 },
		lavaSpeed: 24,
		rules: { spikeChance: 0.38, runeChance: 0.19, blockedChance: 0.46 }
	},
	{
		floor: 32,
		name: 'The Crown',
		wing: 'The Spire',
		fen: '1r1q2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
		brief: 'Rook against rook and queen. The top of the tower.',
		engine: { randomMoveProbability: 0, depth: 10, moveTime: 1500 },
		lavaSpeed: 26,
		rules: { spikeChance: 0.4, runeChance: 0.2, blockedChance: 0.48 }
	}
];

export const TOWER: readonly TowerFloor[] = floors;

export const TOTAL_FLOORS = floors.length;

export function floorByNumber(n: number): TowerFloor | undefined {
	return floors.find((f) => f.floor === n);
}

/**
 * A floor's engine settings with Skill Level filled in from its search depth.
 * Depth alone does not make Stockfish strong — Skill Level has to rise with it.
 */
export function engineForFloor(floor: TowerFloor): EngineSettings {
	return {
		...floor.engine,
		skillLevel: floor.engine.skillLevel ?? Math.round((floor.engine.depth / 10) * 20)
	};
}

/** Floors grouped by wing, in order, for the level-select screen. */
export function floorsByWing(): { wing: string; floors: TowerFloor[] }[] {
	return WINGS.map((wing) => ({
		wing,
		floors: floors.filter((f) => f.wing === wing)
	}));
}
