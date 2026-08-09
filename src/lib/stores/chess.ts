import { writable, type Readable } from 'svelte/store';
import { Chess, type Piece, type Square } from 'chess.js';
import type { Move } from 'svelte-chess';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type MovesStore = Readable<Move[]> & {
	add: (move: Move) => void;
	reset: () => void;
};

function createMovesStore(): MovesStore {
	const { subscribe, update, set } = writable<Move[]>([]);

	return {
		subscribe,
		add(move) {
			update((movesList) => [...movesList, move]);
		},
		reset() {
			set([]);
		}
	};
}

export const moves = createMovesStore();

type PieceColor = Piece['color'];

/** A piece removed by a spike, kept so a stage reward can put it back. */
export type FallenPiece = { square: Square; piece: Piece };

type ChessStateStore = Readable<string> & {
	addMove: (move: Move) => void;
	removeRandomPiece: (colour?: PieceColor, callback?: (newFen: string) => void) => void;
	restoreFallenPiece: (colour?: PieceColor, callback?: (newFen: string) => void) => FallenPiece | null;
	fallenCount: (colour?: PieceColor) => number;
	reset: (callback?: (newFen: string) => void, fen?: string) => void;
};

function createChessStateStore(): ChessStateStore {
	const { subscribe, update, set } = writable<string>(INITIAL_FEN);

	// Pieces knocked off by spikes, most recent last. Stage rewards pop from here.
	let fallen: FallenPiece[] = [];

	return {
		subscribe,
		addMove(move) {
			moves.add(move);
			set(move.after);
		},
		removeRandomPiece(colour: PieceColor = 'w', callback?: (newFen: string) => void) {
			update((fen) => {
				const chess = new Chess(fen);
				const removablePieces: FallenPiece[] = [];

				for (let file = 0; file < 8; file += 1) {
					for (let rank = 0; rank < 8; rank += 1) {
						const square = `${'abcdefgh'[file]}${rank + 1}` as Square;
						const piece = chess.get(square);
						if (piece && piece.color === colour && piece.type !== 'k') {
							removablePieces.push({ square, piece });
						}
					}
				}

				if (removablePieces.length > 0) {
					const toRemove = removablePieces[Math.floor(Math.random() * removablePieces.length)];
					chess.remove(toRemove.square);
					fallen.push(toRemove);
				}

				const newFen = chess.fen();
				callback?.(newFen);
				return newFen;
			});
		},
		/**
		 * Puts the most recently lost piece back on its original square, provided that
		 * square is still empty. Returns the piece restored, or null if there was
		 * nothing to restore (or its home square is now occupied).
		 */
		restoreFallenPiece(colour: PieceColor = 'w', callback?: (newFen: string) => void) {
			let restored: FallenPiece | null = null;

			update((fen) => {
				const candidateIndex = findLastIndex(fallen, (entry) => entry.piece.color === colour);
				if (candidateIndex === -1) {
					return fen;
				}

				const candidate = fallen[candidateIndex];
				const chess = new Chess(fen);
				if (chess.get(candidate.square)) {
					// Home square is taken; leave the piece in the fallen list for next time.
					return fen;
				}

				chess.put(candidate.piece, candidate.square);
				fallen = fallen.filter((_, i) => i !== candidateIndex);
				restored = candidate;

				const newFen = chess.fen();
				callback?.(newFen);
				return newFen;
			});

			// TS narrows `restored` to null because the assignment happens inside a callback.
			return restored as FallenPiece | null;
		},
		fallenCount(colour: PieceColor = 'w') {
			return fallen.filter((entry) => entry.piece.color === colour).length;
		},
		reset(callback = () => {}, fen = INITIAL_FEN) {
			moves.reset();
			fallen = [];
			set(fen);
			callback(fen);
		}
	};
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
	for (let i = items.length - 1; i >= 0; i -= 1) {
		if (predicate(items[i])) return i;
	}
	return -1;
}

export const chessState = createChessStateStore();

export type LeaderboardEntry = {
	name: string;
	score: number;
	difficulty: string;
	/** Furthest stage reached. Absent on entries saved before stages existed. */
	stage?: string;
};

const LEADERBOARD_STORAGE_KEY = 'chessplatform-leaderboard';

function createLeaderboardStore() {
	const { subscribe, set, update } = writable<LeaderboardEntry[]>([]);
	let hasHydrated = false;

	const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

	const loadFromStorage = (): LeaderboardEntry[] => {
		if (!canUseStorage()) {
			return [];
		}

		try {
			const stored = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
			if (!stored) {
				return [];
			}

			const parsed = JSON.parse(stored);
			if (!Array.isArray(parsed)) {
				return [];
			}

			return parsed.filter(
				(entry): entry is LeaderboardEntry =>
					typeof entry === 'object' &&
					entry !== null &&
					typeof entry.name === 'string' &&
					typeof entry.score === 'number' &&
					typeof entry.difficulty === 'string' &&
					(entry.stage === undefined || typeof entry.stage === 'string')
			);
		} catch (error) {
			console.warn('Failed to read leaderboard from storage', error);
			return [];
		}
	};

	const persist = (rows: LeaderboardEntry[]) => {
		if (!canUseStorage()) {
			return;
		}

		try {
			window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(rows));
		} catch (error) {
			console.warn('Failed to persist leaderboard to storage', error);
		}
	};

	const hydrateFromStorage = () => {
		if (hasHydrated) {
			return;
		}
		const hydrated = loadFromStorage();
		set(hydrated);
		hasHydrated = true;
	};

	if (canUseStorage()) {
		hydrateFromStorage();
	}

	return {
		subscribe,
		init() {
			if (!canUseStorage()) {
				return;
			}
			hydrateFromStorage();
		},
		add(row: LeaderboardEntry) {
			update((currentRows) => {
				const updated = [...currentRows, row];
				persist(updated);
				return updated;
			});
		}
	};
}

export const leaderboard = createLeaderboardStore();
