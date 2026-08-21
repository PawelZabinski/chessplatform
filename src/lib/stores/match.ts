import { writable, get } from 'svelte/store';
import { matchClient, type MatchClientStatus } from '$game/multiplayer/MatchClient';
import {
	SEATS,
	type ClimberPose,
	type GameStart,
	type MatchConfig,
	type Seat,
	type ServerMessage
} from '$game/multiplayer/protocol';
import { log } from '$lib/diagnostics';

/**
 * The live match, as the UI sees it.
 *
 * One store owns the connection for the whole app, because a match outlives the
 * screen that started it: you join in the lobby and then navigate to the climb,
 * and the socket must not be torn down and rebuilt in between. The lobby and the
 * play screen both read this; neither talks to the socket directly.
 *
 * Everything here is a mirror of what the server said. Nothing in this file
 * decides anything about the match — that is the server's job, and duplicating
 * any of it here would just be a second implementation to disagree with.
 */

export interface MatchPlayer {
	seat: Seat;
	displayName: string;
	ready: boolean;
	/**
	 * Palette index assigned by the server.
	 *
	 * Assigned randomly and uniquely by the server when the player enters a lobby.
	 */
	colour: number;
}

export interface MatchState {
	status: MatchClientStatus;
	detail?: string;
	/** Room code, once the server has assigned or confirmed one. */
	code?: string;
	seat?: Seat;
	hostSeat?: Seat;
	players: MatchPlayer[];
	config?: MatchConfig;
	/** Seed shared by every client for identical procedural platforms. */
	worldSeed?: number;
	started: boolean;
	/** Set when the match is over; the play screen reads it and shows the result. */
	ended?: { winner: Seat | null; reason: string; heights: Record<Seat, number> };
	/** The game currently on the board. */
	game?: GameStart;
	heights: Record<Seat, number>;
	positions: Partial<Record<Seat, ClimberPose>>;
	streaks: Record<Seat, number>;
	endRunVote?: { requestedBy: Seat; acceptedBy: Seat[] };
	/** Last error the server sent, for the lobby to surface. */
	error?: string;
}

/**
 * Every seat present and zeroed.
 *
 * Not `{ a: 0, b: 0 }`: a room of five reports heights for seats c–e, and a
 * lookup that returned undefined for them turned into NaN one multiplication
 * later, which is an unrenderable climber rather than a visible bug.
 */
function zeroed(): Record<Seat, number> {
	const out = {} as Record<Seat, number>;
	for (const seat of SEATS) out[seat] = 0;
	return out;
}

const EMPTY: MatchState = {
	status: 'idle',
	players: [],
	started: false,
	heights: zeroed(),
	positions: {},
	streaks: zeroed()
};

const state = writable<MatchState>({ ...EMPTY });

/**
 * Server messages that the climb needs to act on rather than merely display.
 *
 * The play screen subscribes to this instead of to the store, because these are
 * events, not state: a move has to be applied to the board exactly once, and a
 * store that happens to hold the last move would replay it on every unrelated
 * update.
 */
type EventListener = (message: ServerMessage) => void;
const eventListeners = new Set<EventListener>();

export function onMatchEvent(listener: EventListener) {
	eventListeners.add(listener);
	return () => eventListeners.delete(listener);
}

matchClient.onStatus((status, detail) =>
	state.update((s) => ({ ...s, status, detail }))
);

matchClient.onMessage((message) => {
	state.update((s) => reduce(s, message));
	for (const listener of eventListeners) listener(message);
});

function reduce(s: MatchState, message: ServerMessage): MatchState {
	switch (message.t) {
		case 'lobby':
			return {
				...s,
				code: message.lobbyCode,
				seat: message.seat,
				hostSeat: message.hostSeat,
				players: message.players,
				config: message.config,
				error: undefined
			};

		case 'start':
			log.info('net', 'Match started', { config: message.config });
			return {
				...s,
				started: true,
				config: message.config,
				worldSeed: message.worldSeed,
				game: message.firstGame,
				endRunVote: undefined
			};

		case 'gameStart':
			return { ...s, game: message };

		case 'gameEnded':
			return { ...s, streaks: message.streaks };

		case 'positions':
			return {
				...s,
				heights: { ...zeroed(), ...message.heights },
				positions: message.positions
			};

		case 'endRunVote':
			return {
				...s,
				endRunVote: message.requestedBy
					? { requestedBy: message.requestedBy, acceptedBy: message.acceptedBy }
					: undefined
			};

		case 'matchEnded':
			log.info('net', 'Match ended', { winner: message.winner, reason: message.reason });
			return {
				...s,
				ended: {
					winner: message.winner,
					reason: message.reason,
					heights: message.finalHeights
				},
				endRunVote: undefined
			};

		case 'snapshot':
			return {
				...s,
				started: true,
				seat: message.seat,
				config: message.config,
				worldSeed: message.worldSeed,
				positions: message.positions,
				heights: message.heights,
				streaks: message.streaks,
				game: {
					t: 'gameStart',
					gameIndex: message.gameIndex,
					fen: message.fen,
					youPlay: message.youPlay,
					shared: message.shared
				}
			};

		case 'error':
			// A rejected move is handled by the board, not shown as a lobby error.
			if (message.code === 'badMove' || message.code === 'cooldown') return s;
			return { ...s, error: message.message };

		default:
			return s;
	}
}

export const matchState = {
	subscribe: state.subscribe,

	get current() {
		return get(state);
	},

	/** Opens a new room. The server assigns the code. */
	async host(displayName: string) {
		state.set({ ...EMPTY, status: 'connecting' });
		await matchClient.connect({ displayName });
	},

	/** Joins an existing room by code. */
	async join(displayName: string, code: string) {
		state.set({ ...EMPTY, status: 'connecting' });
		await matchClient.connect({ displayName, lobbyCode: code });
	},

	setConfig(config: Partial<MatchConfig>) {
		matchClient.sendConfig(config);
	},

	setReady(ready: boolean) {
		matchClient.send({ t: 'ready', ready });
	},

	sendMove(lan: string, gameIndex: number, expectedFen: string) {
		matchClient.send({ t: 'move', lan, gameIndex, expectedFen });
	},

	reportPosition(bands: number, pose: ClimberPose) {
		matchClient.send({ t: 'position', bands, ...pose });
	},

	resign() {
		matchClient.send({ t: 'resign' });
	},

	requestEndRun() {
		matchClient.send({ t: 'requestEndRun' });
	},

	respondEndRun(accept: boolean) {
		matchClient.send({ t: 'respondEndRun', accept });
	},

	leave() {
		matchClient.disconnect();
		state.set({ ...EMPTY });
	}
};

export const isMultiplayerAvailable = matchClient.isAvailable;
