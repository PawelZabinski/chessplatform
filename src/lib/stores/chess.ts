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

type ChessStateStore = Readable<string> & {
	addMove: (move: Move) => void;
	removeRandomPiece: (colour?: PieceColor, callback?: (newFen: string) => void) => void;
	reset: (fen?: string) => void;
};

function createChessStateStore(): ChessStateStore {
	const { subscribe, update, set } = writable<string>(INITIAL_FEN);

	return {
		subscribe,
		addMove(move) {
			moves.add(move);
			set(move.after);
		},
		removeRandomPiece(colour: PieceColor = 'w', callback?: (newFen: string) => void) {
			update((fen) => {
				const chess = new Chess(fen);
				const removablePieces: Array<{ square: Square; piece: Piece }> = [];

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
				}

				const newFen = chess.fen();
				callback?.(newFen);
				return newFen;
			});
		},
		reset(callback = () => {}, fen = INITIAL_FEN) {
			moves.reset();
			set(fen);
			callback(fen);
		}
	};
}

export const chessState = createChessStateStore();

export type LeaderboardEntry = {
	name: string;
	score: number;
	difficulty: string;
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
					typeof entry.difficulty === 'string'
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
