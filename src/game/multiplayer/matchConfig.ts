import { DEFAULT_MATCH_CONFIG, type MatchConfig } from './protocol';

/**
 * The host's draft match settings, chosen in the lobby just before the room is
 * created. Persisted so a host who plays regularly does not re-pick every time.
 *
 * These live here rather than in a global settings screen because they are
 * properties of a MATCH, not of a player: both sides play under the same values,
 * and the host is the one who sets them. In particular, game speed is shared —
 * a real-time race where one side runs slower is not a fair race.
 */

const STORAGE_KEY = 'chessplatform-match-config';

/** Each option is a cycling choice in the lobby, with a label and a blurb. */
export interface ConfigOption<T> {
	value: T;
	label: string;
	blurb: string;
}

export const COOLDOWN_OPTIONS: ConfigOption<number>[] = [
	{ value: 500, label: '0.5s', blurb: 'Frantic. Barely time to look up.' },
	{ value: 1000, label: '1s', blurb: 'The standard. Rapid but readable.' },
	{ value: 1500, label: '1.5s', blurb: 'Room to actually calculate.' },
	{ value: 2500, label: '2.5s', blurb: 'Considered. Closer to real chess.' }
];

export const TARGET_HEIGHT_OPTIONS: ConfigOption<number>[] = [
	{ value: 60, label: '60 bands', blurb: 'A sprint. Over in a few minutes.' },
	{ value: 120, label: '120 bands', blurb: 'The standard climb.' },
	{ value: 200, label: '200 bands', blurb: 'Long. Expect several chess games.' },
	{ value: 320, label: '320 bands', blurb: 'A marathon to the crown.' }
];

export const GAME_SPEED_OPTIONS: ConfigOption<number>[] = [
	{ value: 1, label: 'Normal', blurb: 'Full speed for both players.' },
	{ value: 0.75, label: 'Measured', blurb: 'Slightly slowed, for both.' },
	{ value: 0.5, label: 'Slow', blurb: 'Half speed. A thinking match.' }
];

export const LAVA_OPTIONS: ConfigOption<number>[] = [
	{ value: 0, label: 'Off', blurb: 'No lava. The race is purely about climbing.' },
	{ value: 8, label: 'Gentle', blurb: 'The lava is a distant worry.' },
	{ value: 12, label: 'Standard', blurb: 'Keep climbing and you are fine.' },
	{ value: 18, label: 'Fierce', blurb: 'Stall and you burn.' }
];

const canUseStorage = () =>
	typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function sanitise(raw: Partial<MatchConfig> | null): MatchConfig {
	const pick = <T,>(options: ConfigOption<T>[], value: unknown, fallback: T): T =>
		options.find((o) => o.value === value)?.value ?? fallback;

	return {
		...DEFAULT_MATCH_CONFIG,
		moveCooldownMs: pick(COOLDOWN_OPTIONS, raw?.moveCooldownMs, DEFAULT_MATCH_CONFIG.moveCooldownMs),
		targetHeight: pick(TARGET_HEIGHT_OPTIONS, raw?.targetHeight, DEFAULT_MATCH_CONFIG.targetHeight),
		gameSpeed: pick(GAME_SPEED_OPTIONS, raw?.gameSpeed, DEFAULT_MATCH_CONFIG.gameSpeed),
		lavaSpeed: pick(LAVA_OPTIONS, raw?.lavaSpeed, DEFAULT_MATCH_CONFIG.lavaSpeed)
	};
}

export function loadDraftConfig(): MatchConfig {
	if (!canUseStorage()) return sanitise(null);
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return sanitise(raw ? (JSON.parse(raw) as Partial<MatchConfig>) : null);
	} catch {
		return sanitise(null);
	}
}

export function saveDraftConfig(config: MatchConfig) {
	if (!canUseStorage()) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {
		// Never throw over storage being unavailable.
	}
}

/** Advances a cycling option and returns the next value. */
export function nextOption<T>(options: ConfigOption<T>[], current: T): T {
	const index = options.findIndex((o) => o.value === current);
	return options[(index + 1) % options.length].value;
}

export function optionFor<T>(options: ConfigOption<T>[], value: T): ConfigOption<T> {
	return options.find((o) => o.value === value) ?? options[0];
}

/** One-line summary of a config, for the waiting-room card. */
export function summarise(config: MatchConfig): string {
	const lava = optionFor(LAVA_OPTIONS, config.lavaSpeed);
	return [
		`${config.moveCooldownMs / 1000}s cooldown`,
		`${config.targetHeight} bands`,
		optionFor(GAME_SPEED_OPTIONS, config.gameSpeed).label.toLowerCase(),
		lava.value === 0 ? 'no lava' : `${lava.label.toLowerCase()} lava`
	].join('  ·  ');
}
