import { get, writable } from 'svelte/store';
import type { Move } from 'svelte-chess';
import { Chess } from "chess.js";

type MovesStore = {
	subscribe: ReturnType<typeof writable<Move[]>>['subscribe'];
	add: (move: Move) => void;
};

function createMovesStore(): MovesStore {
	const { subscribe, update } = writable<Move[]>([]);

	return {
		subscribe,
		add(move) {
			update((moves) => [...moves, move]);
		}
	};
}

export const moves = createMovesStore();

function createChessStateStore() {
	const { subscribe, update, set } = writable("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

	return {
		subscribe,
		addMove(move) {
			moves.add(move);
			set(move.after);
		},
		removeRandomPiece: (handleNewFen = (newFen) => {}) => update((fen: string) => {
			// Removes a random piece (except the king itself...)
			const chess = new Chess(fen)
			// get all pieces, filter to white ones
			const pieces = [];
			for (let file = 0; file < 8; file++) {
			for (let rank = 0; rank < 8; rank++) {
				const square = "abcdefgh"[file] + (rank + 1);
				const piece = chess.get(square);
				if (piece && piece.color === "w" && piece.type !== "k") pieces.push({ square, piece });
			}
			}

			// remove one at random
			if (pieces.length > 0) {
				const toRemove = pieces[Math.floor(Math.random() * pieces.length)];
				chess.remove(toRemove.square);
			}

			// generate new FEN
			const newFen = chess.fen();
			handleNewFen(newFen);
			return newFen;
		})
	};
}

export const chessState = createChessStateStore();

// This function should only be set by Chessboard.svelte and should only be used to remove random piece when player hits spike
export const handlePieceRemovalFunction = (() => {
	const {subscribe, set, update} = writable(() => {})

	return {
		set,
		execute: () => subscribe(f => f())()
	};
})()