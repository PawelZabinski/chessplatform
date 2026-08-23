import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { normaliseRoomCode } from '../../src/game/multiplayer/roomCode.ts';
import type { ClientMessage, Seat, ServerMessage } from '../../src/game/multiplayer/protocol.ts';
import type { Logger } from '../logging.ts';
import type { Outbound } from '../match.ts';
import { MatchRegistry, type MatchRoom } from './registry.ts';

const ROOM_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

interface Session {
	room?: MatchRoom;
	seat?: Seat;
	alive: boolean;
}

interface MatchWebSocketOptions {
	server: Server;
	path: string;
	registry: MatchRegistry;
	logger: Logger;
}

/** Attaches the match protocol to one explicit WebSocket endpoint. */
export function attachMatchWebSocket({
	server,
	path,
	registry,
	logger
}: MatchWebSocketOptions) {
	const sockets = new WebSocketServer({ server, path });
	const sessions = new WeakMap<WebSocket, Session>();

	sockets.on('connection', (socket, request) => {
		sessions.set(socket, { alive: true });
		logger.debug('socket.open', { peer: request.socket.remoteAddress, path });

		socket.on('pong', () => {
			const session = sessions.get(socket);
			if (session) session.alive = true;
		});

		socket.on('message', (raw) => {
			let message: ClientMessage;
			try {
				message = JSON.parse(String(raw)) as ClientMessage;
			} catch {
				logger.warn('message.unparseable', { bytes: String(raw).length });
				return;
			}

			try {
				handle(socket, message);
			} catch (error) {
				logger.error('handler.threw', {
					type: (message as { t?: string })?.t,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		});

		socket.on('close', () => {
			const session = sessions.get(socket);
			if (session?.room && session.seat) dropPlayer(session.room, session.seat);
			logger.debug('socket.close');
		});

		socket.on('error', (error) => logger.warn('socket.error', { error: error.message }));
	});

	function handle(socket: WebSocket, message: ClientMessage) {
		const session = sessions.get(socket);
		if (!session) return;

		if (message.t === 'join') {
			joinRoom(socket, session, message.displayName, message.lobbyCode);
			return;
		}

		const { room, seat } = session;
		if (!room || !seat) {
			send(socket, {
				t: 'error',
				code: 'unknownLobby',
				message: 'Join a lobby before sending anything else.'
			});
			return;
		}

		room.lastActivity = Date.now();

		switch (message.t) {
			case 'config':
				if (seat !== room.match.hostSeat) {
					send(socket, { t: 'error', code: 'notHost', message: 'Only the host sets the rules.' });
					return;
				}
				room.match.applyConfig(message.config);
				logger.info('lobby.config', { room: room.match.code, config: room.match.config });
				broadcastLobby(room);
				return;

			case 'ready':
				room.match.setReady(seat, message.ready);
				broadcastLobby(room);
				if (room.match.everyoneReady && !room.match.started) {
					logger.info('match.start', { room: room.match.code, config: room.match.config });
					dispatch(room, room.match.start());
				}
				return;

			case 'move': {
				const out = room.match.move(seat, message.lan, message.gameIndex, Date.now());
				logger.debug('match.move', {
					room: room.match.code,
					seat,
					lan: message.lan,
					rejected: out.some((entry) => entry.message.t === 'error')
				});
				dispatch(room, out);
				return;
			}

			case 'position':
				dispatch(room, room.match.reportPosition(seat, message.bands, message));
				return;

			case 'resign': {
				const other: Seat = seat === 'a' ? 'b' : 'a';
				logger.info('match.resigned', { room: room.match.code, seat });
				dispatch(room, room.match.endMatch(other, 'resigned'));
				return;
			}

			case 'requestEndRun':
				logger.info('match.end_run_requested', { room: room.match.code, seat });
				dispatch(room, room.match.requestEndRun(seat));
				return;

			case 'respondEndRun':
				logger.info('match.end_run_response', {
					room: room.match.code,
					seat,
					accept: message.accept
				});
				dispatch(room, room.match.respondEndRun(seat, message.accept));
				return;
		}
	}

	function joinRoom(socket: WebSocket, session: Session, displayName: string, code?: string) {
		const requested = code ? normaliseRoomCode(code) : '';
		let room: MatchRoom | undefined;

		if (requested) {
			room = registry.get(requested);
			if (!room) {
				send(socket, {
					t: 'error',
					code: 'unknownLobby',
					message: `No lobby with code ${requested}.`
				});
				return;
			}
			if (room.match.isFull) {
				send(socket, { t: 'error', code: 'lobbyFull', message: 'That lobby is already full.' });
				return;
			}
		} else {
			room = registry.create();
		}

		const seat = room.match.join(displayName);
		if (!seat) {
			send(socket, { t: 'error', code: 'lobbyFull', message: 'That lobby is already full.' });
			return;
		}

		session.room = room;
		session.seat = seat;
		room.sockets.set(seat, socket);
		room.lastActivity = Date.now();

		logger.info('lobby.join', {
			room: room.match.code,
			seat,
			name: displayName,
			players: room.match.players.size
		});

		broadcastLobby(room);
		if (room.match.started && !room.match.ended) send(socket, room.match.snapshot(seat));
	}

	function dropPlayer(room: MatchRoom, seat: Seat) {
		room.sockets.delete(seat);
		const player = room.match.player(seat);
		logger.info('lobby.leave', { room: room.match.code, seat, name: player?.displayName });

		if (room.match.started && !room.match.ended) {
			const other: Seat = seat === 'a' ? 'b' : 'a';
			dispatch(room, room.match.endMatch(other, 'disconnected'));
		}

		room.match.leave(seat);
		broadcastLobby(room);
		if (room.sockets.size === 0) registry.delete(room);
	}

	function send(socket: WebSocket, message: ServerMessage) {
		if (socket.readyState !== socket.OPEN) return;
		socket.send(JSON.stringify(message));
	}

	function dispatch(room: MatchRoom, outbound: Outbound[]) {
		for (const { to, message } of outbound) {
			if (to === 'all') {
				for (const socket of room.sockets.values()) send(socket, message);
			} else {
				const socket = room.sockets.get(to);
				if (socket) send(socket, message);
			}
		}
	}

	function broadcastLobby(room: MatchRoom) {
		for (const [seat, socket] of room.sockets) send(socket, room.match.lobbyState(seat));
	}

	const heartbeat = setInterval(() => {
		for (const socket of sockets.clients) {
			const session = sessions.get(socket);
			if (!session) continue;
			if (!session.alive) {
				socket.terminate();
				continue;
			}
			session.alive = false;
			socket.ping();
		}
	}, HEARTBEAT_MS);
	heartbeat.unref();

	const sweeper = setInterval(
		() => registry.sweepOlderThan(Date.now() - ROOM_TTL_MS),
		SWEEP_INTERVAL_MS
	);
	sweeper.unref();

	return {
		close(callback?: (error?: Error) => void) {
			clearInterval(heartbeat);
			clearInterval(sweeper);
			sockets.close(callback);
		}
	};
}
