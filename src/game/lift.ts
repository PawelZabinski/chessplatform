/**
 * How a chess move becomes upward momentum.
 *
 * The original mapping used the move's rank delta, which meant a pointless pawn
 * shove out-climbed a strong rook move — the platformer was rewarding bad chess.
 * Lift now comes from what the move *achieves*, so playing well is what keeps
 * you above the flood.
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

/** Every legal move gives at least this much, so you are never fully stuck. */
export const BASE_LIFT = 170;
/** Flat bonus on top of the value-scaled component for any capture. */
const CAPTURE_BASE = 250;
const CAPTURE_PER_VALUE = 70;
const CHECK_BONUS = 190;
const PROMOTION_BONUS = 300;
const CASTLE_BONUS = 150;

/** Clamped below the body's max velocity so lift stays predictable. */
export const MAX_LIFT = 850;

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
