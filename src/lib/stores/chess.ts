import { writable } from 'svelte/store';
import type { Move } from 'svelte-chess';

type MovesStore = {
	subscribe: ReturnType<typeof writable<Move[]>>['subscribe'];
	add: (move: Move) => void;
	reset: () => void;
};

function createMovesStore(): MovesStore {
	const { subscribe, set, update } = writable<Move[]>([]);

	return {
		subscribe,
		add(move) {
			update((moves) => [...moves, move]);
		},
		reset() {
			set([]);
		}
	};
}

export const moves = createMovesStore();
