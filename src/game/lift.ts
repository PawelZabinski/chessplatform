/**
 * How a chess move becomes upward momentum.
 *
 * The original mapping used the move's rank delta, which meant a pointless pawn
 * shove out-climbed a strong rook move — the platformer was rewarding bad chess.
 * Lift now comes from what the move *achieves*, so playing well is what keeps
 * you above the lava.
 */

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** Standard relative piece values, used to scale capture lift. */
export const PIECE_VALUE: Record<PieceType, number> = {
	p: 1,
	n: 3,
	b: 3,
	r: 5,
	q: 9,
	k: 0
};

/**
 * Tuning note: these are launch speeds in px/s, and what matters is the height
 * they buy against gravity (550) relative to the 200px gap between platform
 * bands. Height = v² / (2 * 550), so:
 *
 *   quiet move   450 -> ~184px  (~0.9 bands)
 *   takes pawn   578 -> ~304px  (~1.5 bands)
 *   takes knight 654 -> ~389px  (~1.9 bands)
 *   takes rook   730 -> ~484px  (~2.4 bands)
 *   takes queen  882 -> ~707px  (~3.5 bands)
 *
 * The base has to clear roughly one band on its own: most moves in a real game
 * are quiet, and if those barely lift you then normal play cannot outrun the
 * lava. Captures are the difference between climbing and climbing fast.
 */

/** Every legal move gives at least this much, so you are never fully stuck. */
export const BASE_LIFT = 450;
/** Flat bonus on top of the value-scaled component for any capture. */
const CAPTURE_BASE = 90;
const CAPTURE_PER_VALUE = 38;
const CHECK_BONUS = 90;
const PROMOTION_BONUS = 140;
const CASTLE_BONUS = 70;

/** Clamped below the body's max vertical velocity so lift stays predictable. */
export const MAX_LIFT = 1000;

export interface LiftMove {
	/** Piece type captured, if any. */
	captured?: string;
	/** chess.js flag string: 'c' capture, 'e' en passant, 'p' promotion, 'k'/'q' castle. */
	flags?: string;
	/** Standard algebraic notation, used to detect check and mate. */
	san?: string;
}

export interface LiftResult {
	/** Upward speed in px/s (positive number; the caller negates it). */
	lift: number;
	/** Short labels describing what earned the lift, for on-screen feedback. */
	reasons: string[];
}

/**
 * Scores a move's lift and explains it. The explanation matters as much as the
 * number — players need to see that the queen capture is what launched them.
 */
export function liftForMove(move: LiftMove): LiftResult {
	const flags = move.flags ?? '';
	const san = move.san ?? '';
	const reasons: string[] = [];
	let lift = BASE_LIFT;

	if (move.captured) {
		const value = PIECE_VALUE[move.captured as PieceType] ?? 0;
		lift += CAPTURE_BASE + value * CAPTURE_PER_VALUE;
		reasons.push(`took ${PIECE_NAME[move.captured as PieceType] ?? 'a piece'}`);
	}

	if (flags.includes('p')) {
		lift += PROMOTION_BONUS;
		reasons.push('promotion');
	}

	if (flags.includes('k') || flags.includes('q')) {
		lift += CASTLE_BONUS;
		reasons.push('castled');
	}

	// '#' is mate, which ends the game anyway, but still reads as a check.
	if (san.includes('+') || san.includes('#')) {
		lift += CHECK_BONUS;
		reasons.push('check');
	}

	return { lift: Math.min(lift, MAX_LIFT), reasons };
}

const PIECE_NAME: Record<PieceType, string> = {
	p: 'a pawn',
	n: 'a knight',
	b: 'a bishop',
	r: 'a rook',
	q: 'the queen',
	k: 'the king'
};
