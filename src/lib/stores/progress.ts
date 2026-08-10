import { writable, get, type Readable } from 'svelte/store';
import { TOTAL_FLOORS } from '../../game/levels';

/**
 * Tower progress, persisted to localStorage.
 *
 * A floor is unlocked once the floor below it has been cleared, so the ladder
 * is strictly sequential. Floor 1 is always unlocked.
 */

const STORAGE_KEY = 'chessplatform-tower-progress';

export type FloorResult = 'won' | 'drawn';

export interface FloorRecord {
	result: FloorResult;
	/** Best (lowest) number of moves used to clear it. */
	bestMoves: number;
	/** Best climb score recorded on this floor. */
	bestScore: number;
}

export type ProgressState = Record<number, FloorRecord>;

type ProgressStore = Readable<ProgressState> & {
	record: (floor: number, result: FloorResult, moves: number, score: number) => void;
	isUnlocked: (floor: number) => boolean;
	isCleared: (floor: number) => boolean;
	highestUnlocked: () => number;
	reset: () => void;
};

const canUseStorage = () =>
	typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function load(): ProgressState {
	if (!canUseStorage()) return {};

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};

		const parsed = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return {};

		const state: ProgressState = {};
		for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
			const floor = Number(key);
			const rec = value as Partial<FloorRecord>;
			if (
				Number.isInteger(floor) &&
				floor >= 1 &&
				floor <= TOTAL_FLOORS &&
				(rec?.result === 'won' || rec?.result === 'drawn') &&
				typeof rec.bestMoves === 'number' &&
				typeof rec.bestScore === 'number'
			) {
				state[floor] = { result: rec.result, bestMoves: rec.bestMoves, bestScore: rec.bestScore };
			}
		}
		return state;
	} catch {
		return {};
	}
}

function persist(state: ProgressState) {
	if (!canUseStorage()) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Storage full or blocked; progress is a nicety, not worth throwing over.
	}
}

function createProgressStore(): ProgressStore {
	const { subscribe, update, set } = writable<ProgressState>(load());

	const store: ProgressStore = {
		subscribe,
		record(floor, result, moves, score) {
			update((state) => {
				const existing = state[floor];
				// A win always supersedes a draw; otherwise keep the better attempt.
				const better =
					!existing ||
					(existing.result === 'drawn' && result === 'won') ||
					(existing.result === result && moves < existing.bestMoves);

				const next: ProgressState = {
					...state,
					[floor]: {
						result: better ? result : existing.result,
						bestMoves: better ? moves : Math.min(existing.bestMoves, moves),
						bestScore: Math.max(existing?.bestScore ?? 0, score)
					}
				};
				persist(next);
				return next;
			});
		},
		isUnlocked(floor) {
			if (floor <= 1) return true;
			return get({ subscribe })[floor - 1] !== undefined;
		},
		isCleared(floor) {
			return get({ subscribe })[floor] !== undefined;
		},
		/**
		 * The lowest floor not yet cleared — where "continue" should send you.
		 * Deliberately the first gap, not the highest clear: a floor skipped via
		 * an earlier build (or a cleared-out save) must not be treated as done.
		 */
		highestUnlocked() {
			const state = get({ subscribe });
			for (let f = 1; f <= TOTAL_FLOORS; f++) {
				if (state[f] === undefined) return f;
			}
			return TOTAL_FLOORS;
		},
		reset() {
			set({});
			persist({});
		}
	};

	return store;
}

export const towerProgress = createProgressStore();
