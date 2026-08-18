import { Chess } from 'chess.js';

/**
 * Starting positions for a match.
 *
 * Two formats, because they are the two anybody exchanging chess positions
 * already has: FEN for a single position, PGN for a game. A PGN is played out
 * and reduced to the FEN of its final position — resuming from where a game got
 * to is the useful thing, and it means only one representation ever travels over
 * the wire or gets stored in a config.
 *
 * Parsing is deliberately forgiving about what a human pastes: surrounding
 * whitespace, a trailing result token, the wrapping quotes a chat client adds.
 * It is strict about the outcome, though — whatever comes back has been loaded
 * by chess.js, so a position that reaches the server is one the server can play.
 */

export type ParsedPosition = { ok: true; fen: string; from: 'fen' | 'pgn' } | { ok: false; error: string };

/** Accepts a FEN or a PGN and returns a position to start from. */
export function parsePosition(input: string): ParsedPosition {
	const text = input.trim().replace(/^["']|["']$/g, '');
	if (!text) return { ok: false, error: 'Paste a FEN or a PGN.' };

	// A PGN either carries tag pairs or move numbers; a FEN has neither and is
	// a single line of six space-separated fields.
	const looksLikePgn = text.includes('[') || /\b1\s*\./.test(text);

	if (!looksLikePgn) {
		try {
			const chess = new Chess(text);
			return { ok: true, fen: chess.fen(), from: 'fen' };
		} catch {
			return { ok: false, error: 'That is not a position chess.js can read.' };
		}
	}

	try {
		const chess = new Chess();
		chess.loadPgn(text);
		const fen = chess.fen();
		if (chess.isGameOver()) {
			return { ok: false, error: 'That game is already finished — pick an earlier position.' };
		}
		return { ok: true, fen, from: 'pgn' };
	} catch {
		return { ok: false, error: 'That PGN could not be read.' };
	}
}

/**
 * A Chess960-style shuffled back rank, mirrored for both sides.
 *
 * Randomising the opening keeps memorised theory out of a format that is meant
 * to be decided by speed, and mirroring keeps it fair — an asymmetric shuffle
 * would hand somebody an advantage before a move was played.
 *
 * The three constraints are the real ones: bishops on opposite colours, the king
 * between the rooks (so castling still means something), and nothing else.
 */
export function randomBackRankFen(): string {
	const rank = shuffledBackRank();
	const black = rank.join('').toLowerCase();
	const white = rank.join('').toUpperCase();
	return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${white} w KQkq - 0 1`;
}

function shuffledBackRank(): string[] {
	// Rejection sampling: the constraints are cheap to test and a valid layout
	// turns up within a handful of tries, which is far clearer than constructing
	// one placement rule at a time.
	for (let attempt = 0; attempt < 500; attempt++) {
		const pieces = shuffle(['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']);

		const bishops = indicesOf(pieces, 'b');
		if ((bishops[0] % 2) === (bishops[1] % 2)) continue;

		const rooks = indicesOf(pieces, 'r');
		const king = pieces.indexOf('k');
		if (king < rooks[0] || king > rooks[1]) continue;

		return pieces;
	}
	// Unreachable in practice; the standard array satisfies every constraint.
	return ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
}

function indicesOf(items: string[], value: string): number[] {
	const found: number[] = [];
	items.forEach((item, i) => {
		if (item === value) found.push(i);
	});
	return found;
}

function shuffle<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
