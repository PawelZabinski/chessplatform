import { log } from '$lib/diagnostics';
import type { ClientMessage, MatchConfig, ServerMessage } from './protocol';

/**
 * The websocket client for multiplayer.
 *
 * Written as an event-emitting client rather than a promise API because the
 * server pushes: a match is a stream of facts (opponent joined, move applied,
 * game ended), not a sequence of request/responses. The one place a promise
 * makes sense is `connect`, which resolves when the socket is open.
 *
 * It reconnects on its own. A phone that locks, a train that goes into a tunnel
 * — these drop the socket without ending the match, and the server keeps the
 * room alive for exactly this reason. Rejoining with the same lobby code returns
 * a MatchSnapshot, which is enough to rebuild the client mid-match, so a blip
 * costs a couple of seconds rather than the game.
 */

export type MatchClientStatus =
	| 'idle'
	| 'connecting'
	| 'connected'
	| 'reconnecting'
	| 'disconnected'
	| 'unavailable';

export type MatchClientListener = (message: ServerMessage) => void;
export type StatusListener = (status: MatchClientStatus, detail?: string) => void;

/** Backoff between reconnection attempts, in milliseconds. */
const RETRY_DELAYS = [500, 1000, 2000, 4000, 8000];

export class MatchClient {
	private socket?: WebSocket;
	private status: MatchClientStatus = 'idle';
	private readonly listeners = new Set<MatchClientListener>();
	private readonly statusListeners = new Set<StatusListener>();

	/** Remembered so a reconnect can rejoin the same room as the same player. */
	private displayName = '';
	private lobbyCode?: string;
	private attempt = 0;
	private retryTimer?: ReturnType<typeof setTimeout>;
	/** True once the caller has deliberately disconnected; stops all retries. */
	private closing = false;

	constructor(private readonly serverUrl?: string) {}

	get isAvailable() {
		return Boolean(this.serverUrl);
	}

	get currentStatus() {
		return this.status;
	}

	/** The room this client is in, once the server has told us. */
	get room() {
		return this.lobbyCode;
	}

	onMessage(listener: MatchClientListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	onStatus(listener: StatusListener): () => void {
		this.statusListeners.add(listener);
		listener(this.status);
		return () => this.statusListeners.delete(listener);
	}

	async connect(options: { displayName: string; lobbyCode?: string }): Promise<void> {
		if (!this.serverUrl) {
			this.setStatus('unavailable', 'No match server is configured.');
			throw new Error('Multiplayer is not configured for this build.');
		}

		this.displayName = options.displayName;
		this.lobbyCode = options.lobbyCode;
		this.closing = false;
		this.attempt = 0;

		return this.open();
	}

	private open(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

			let socket: WebSocket;
			try {
				socket = new WebSocket(this.serverUrl as string);
			} catch (error) {
				reject(error);
				this.scheduleRetry();
				return;
			}

			this.socket = socket;
			let settled = false;

			socket.onopen = () => {
				this.attempt = 0;
				this.setStatus('connected');
				log.info('net', 'Match socket open', { room: this.lobbyCode ?? '(new)' });
				// The join is what actually seats us; opening the socket alone does
				// nothing server-side.
				this.send({ t: 'join', displayName: this.displayName, lobbyCode: this.lobbyCode });
				settled = true;
				resolve();
			};

			socket.onmessage = (event) => {
				let message: ServerMessage;
				try {
					message = JSON.parse(String(event.data)) as ServerMessage;
				} catch {
					log.warn('net', 'Unparseable message from server');
					return;
				}

				// Learn our room code from the first lobby message, so a reconnect
				// rejoins this room rather than opening a new one.
				if (message.t === 'lobby') this.lobbyCode = message.lobbyCode;
				if (message.t === 'error') {
					log.warn('net', `Server rejected: ${message.code}`, { message: message.message });
				}

				this.emit(message);
			};

			socket.onerror = () => {
				if (!settled) {
					settled = true;
					reject(new Error('Could not reach the match server.'));
				}
			};

			socket.onclose = () => {
				this.socket = undefined;
				if (this.closing) {
					this.setStatus('idle');
					return;
				}
				log.warn('net', 'Match socket closed', { attempt: this.attempt });
				this.scheduleRetry();
			};
		});
	}

	private scheduleRetry() {
		if (this.closing) return;

		if (this.attempt >= RETRY_DELAYS.length) {
			this.setStatus('disconnected', 'Lost contact with the match server.');
			return;
		}

		const delay = RETRY_DELAYS[this.attempt];
		this.attempt += 1;
		this.setStatus('reconnecting', `Reconnecting in ${Math.round(delay / 1000)}s…`);

		clearTimeout(this.retryTimer);
		this.retryTimer = setTimeout(() => {
			// A rejected retry is not fatal: onclose schedules the next one.
			this.open().catch(() => {});
		}, delay);
	}

	send(message: ClientMessage): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			// Intents are not queued. A move sent while disconnected would land
			// after an unknown delay, in a position that has since moved on — far
			// worse than not arriving at all.
			log.warn('net', 'Dropped a message: socket not open', { type: message.t });
			return;
		}
		this.socket.send(JSON.stringify(message));
	}

	sendConfig(config: Partial<MatchConfig>): void {
		this.send({ t: 'config', config });
	}

	disconnect(): void {
		this.closing = true;
		clearTimeout(this.retryTimer);
		this.socket?.close();
		this.socket = undefined;
		this.lobbyCode = undefined;
		this.setStatus('idle');
	}

	protected emit(message: ServerMessage) {
		this.listeners.forEach((listener) => listener(message));
	}

	protected setStatus(status: MatchClientStatus, detail?: string) {
		this.status = status;
		this.statusListeners.forEach((listener) => listener(status, detail));
	}
}

/**
 * Where the match server lives.
 *
 * Read from the environment at build time so the static site can be pointed at
 * a server without a code change. When it is unset the client reports
 * multiplayer as unavailable and the lobby says so plainly — which is what keeps
 * the game deployable as a pure static bundle with no backend at all.
 */
function serverUrl(): string | undefined {
	const configured = import.meta.env.PUBLIC_MATCH_SERVER as string | undefined;
	if (configured) return configured;

	// In development the server runs alongside Vite on its default port; assuming
	// that saves configuring anything to try the mode locally.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		return `ws://${window.location.hostname}:8787`;
	}
	return undefined;
}

export const matchClient = new MatchClient(serverUrl());
