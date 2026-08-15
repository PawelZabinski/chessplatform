import { writable } from 'svelte/store';
import type { RunOutcome } from '$lib/platformer/PlatformerGame';

/**
 * Which screen the app is showing.
 *
 * The chess board and the climb are two independent parts — neither imports the
 * other — and this store is the only thing that knows about both. It is what
 * lets them be assembled into a single site rather than one being embedded in
 * the other.
 */
export type Screen =
	| { name: 'menu' }
	| { name: 'tower' }
	| { name: 'leaderboard' }
	| { name: 'lobby' }
	| { name: 'play'; mode: 'tower' | 'endless'; floor?: number }
	| { name: 'results'; outcome: RunOutcome };

export const screen = writable<Screen>({ name: 'menu' });

export function goto(next: Screen) {
	screen.set(next);
}
