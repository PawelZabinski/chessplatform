// src/lib/stores/moves.js
import { writable } from 'svelte/store';

function createMovesStore() {
    const { subscribe, set, update } = writable([]);

    return {
        subscribe,
        add(move) {
            update(moves => [...moves, move]);
        },
        reset() {
            set([]);
        }
    };
}

export const moves = createMovesStore();
