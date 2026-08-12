import { writable, get, type Readable } from 'svelte/store';

/**
 * Player settings, persisted to localStorage.
 *
 * Game speed is a permanent slow-motion: it scales the whole simulation, not
 * just the visuals. Physics, tweens, sprite animation, the lava and the control
 * rune timer all run at the same fraction, so slowing the game down buys real
 * thinking time per simulated second without changing any of the balance — a
 * capture still lifts you the same number of platform bands.
 *
 * It is deliberately a comfort/accessibility setting rather than a difficulty
 * one, which is why it lives here and not in the difficulty ramp.
 */

export const GAME_SPEEDS = [
	{ value: 1, label: 'Normal', blurb: 'Full speed.' },
	{ value: 0.75, label: 'Measured', blurb: 'A little more room to think.' },
	{ value: 0.5, label: 'Slow', blurb: 'Half speed. Everything, permanently.' },
	{ value: 0.35, label: 'Glacial', blurb: 'For picking the climb apart.' }
] as const;

export type GameSpeed = (typeof GAME_SPEEDS)[number]['value'];

export interface Settings {
	gameSpeed: GameSpeed;
}

const DEFAULTS: Settings = { gameSpeed: 1 };
const STORAGE_KEY = 'chessplatform-settings';

const canUseStorage = () =>
	typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function load(): Settings {
	if (!canUseStorage()) return { ...DEFAULTS };

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };

		const parsed = JSON.parse(raw) as Partial<Settings>;
		const speed = GAME_SPEEDS.find((s) => s.value === parsed?.gameSpeed)?.value;
		return { gameSpeed: speed ?? DEFAULTS.gameSpeed };
	} catch {
		return { ...DEFAULTS };
	}
}

function persist(settings: Settings) {
	if (!canUseStorage()) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Settings are a nicety; never throw over storage being unavailable.
	}
}

type SettingsStore = Readable<Settings> & {
	setGameSpeed: (speed: GameSpeed) => void;
	/** Advances to the next speed in the list, for a cycling button. */
	cycleGameSpeed: () => GameSpeed;
	current: () => Settings;
	reset: () => void;
};

function createSettingsStore(): SettingsStore {
	const { subscribe, set, update } = writable<Settings>(load());

	const store: SettingsStore = {
		subscribe,
		setGameSpeed(speed) {
			update((s) => {
				const next = { ...s, gameSpeed: speed };
				persist(next);
				return next;
			});
		},
		cycleGameSpeed() {
			const currentValue = get({ subscribe }).gameSpeed;
			const index = GAME_SPEEDS.findIndex((s) => s.value === currentValue);
			const next = GAME_SPEEDS[(index + 1) % GAME_SPEEDS.length].value;
			store.setGameSpeed(next);
			return next;
		},
		current() {
			return get({ subscribe });
		},
		reset() {
			set({ ...DEFAULTS });
			persist({ ...DEFAULTS });
		}
	};

	return store;
}

export const settings = createSettingsStore();

export function speedLabel(value: number): string {
	return GAME_SPEEDS.find((s) => s.value === value)?.label ?? 'Normal';
}

export function speedBlurb(value: number): string {
	return GAME_SPEEDS.find((s) => s.value === value)?.blurb ?? '';
}
