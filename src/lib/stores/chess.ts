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
	removeRandomPiece: (colour?: PieceColor, handleNewFen?: (newFen: string) => void) => void;
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
		removeRandomPiece(colour: PieceColor = 'w', handleNewFen?: (newFen: string) => void) {
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
				handleNewFen?.(newFen);
				return newFen;
			});
		},
		reset(fen = INITIAL_FEN) {
			moves.reset();
			set(fen);
		}
	};
}

export const chessState = createChessStateStore();
