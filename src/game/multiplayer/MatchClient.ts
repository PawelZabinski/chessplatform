import type { ClientMessage, MatchConfig, ServerMessage } from './protocol';

/**
 * The websocket seam for multiplayer.
 *
 * ⚠️ THE TRANSPORT IS NOT IMPLEMENTED. Everything around it is: the lobby drives
 * this class, the message types are complete (see protocol.ts), and the call
 * sites are real. `connect()` is the single method to fill in — it is the only
 * place that should ever touch a socket.
 *
 * It is written as an event-emitting client rather than a promise API because
 * the server pushes: a match is a stream of facts (opponent joined, move
 * applied, game ended), not a sequence of request/responses.
 */

export type MatchClientStatus =
	| 'idle'
	| 'connecting'
	| 'waiting-for-opponent'
	| 'in-match'
	| 'disconnected'
	| 'unavailable';

export type MatchClientListener = (message: ServerMessage) => void;
export type StatusListener = (status: MatchClientStatus, detail?: string) => void;

export class MatchNotImplementedError extends Error {
	constructor() {
		super('Multiplayer transport is not implemented yet.');
		this.name = 'MatchNotImplementedError';
	}
}

export class MatchClient {
	private socket?: WebSocket;
	private status: MatchClientStatus = 'idle';
	private readonly listeners = new Set<MatchClientListener>();
	private readonly statusListeners = new Set<StatusListener>();

	/** Set when a server is configured. Absent means multiplayer is unavailable. */
	constructor(private readonly serverUrl?: string) {}

	get isAvailable() {
		return Boolean(this.serverUrl);
	}

	get currentStatus() {
		return this.status;
	}

	onMessage(listener: MatchClientListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	onStatus(listener: StatusListener): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	/**
	 * TODO: implement. Open a socket to `serverUrl`, forward decoded
	 * ServerMessages to `emit`, and mirror connection state through `setStatus`.
	 *
	 * Expected shape once implemented:
	 *
	 *   this.socket = new WebSocket(this.serverUrl);
	 *   this.socket.onopen    = () => this.send({ t: 'join', displayName, lobbyCode });
	 *   this.socket.onmessage = (e) => this.emit(JSON.parse(e.data) as ServerMessage);
	 *   this.socket.onclose   = () => this.setStatus('disconnected');
	 *
	 * Reconnection should re-join with the same lobby code and rely on the
	 * server's MatchSnapshot to rebuild local state rather than resetting.
	 */
	async connect(_options: { displayName: string; lobbyCode?: string }): Promise<void> {
		if (!this.isAvailable) {
			this.setStatus('unavailable', 'No match server is configured yet.');
			throw new MatchNotImplementedError();
		}
		this.setStatus('unavailable', 'Multiplayer transport is not implemented yet.');
		throw new MatchNotImplementedError();
	}

	/** TODO: implement alongside connect(). */
	send(_message: ClientMessage): void {
		if (!this.socket) throw new MatchNotImplementedError();
		// this.socket.send(JSON.stringify(_message));
	}

	/** Host-side convenience: push the agreed settings before starting. */
	sendConfig(config: Partial<MatchConfig>): void {
		this.send({ t: 'config', config });
	}

	disconnect(): void {
		this.socket?.close();
		this.socket = undefined;
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
 * The app's single client. No server URL is configured, so `isAvailable` is
 * false and the lobby renders its Coming Soon state — that is the one switch
 * that turns multiplayer on once the server exists.
 */
export const matchClient = new MatchClient(undefined);
