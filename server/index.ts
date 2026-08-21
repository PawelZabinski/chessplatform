import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Match, type Outbound } from './match.ts';
import { generateRoomCode, normaliseRoomCode } from '../src/game/multiplayer/roomCode.ts';
import type { ClientMessage, Seat, ServerMessage } from '../src/game/multiplayer/protocol.ts';

/**
 * The match server.
 *
 * A single Node process holding matches in memory, speaking the JSON protocol in
 * src/game/multiplayer/protocol.ts over a plain WebSocket. Deliberately small:
 * all the rules live in match.ts, and this file only moves bytes and owns the
 * room registry.
 *
 * No database and no persistence — a match is a live conversation between two
 * sockets, and when both are gone there is nothing worth keeping. That also
 * means the process can be restarted freely between matches.
 *
 * Run it with `npm run server`. The client points at it through
 * PUBLIC_MATCH_SERVER (see src/game/multiplayer/MatchClient.ts); with no such
 * URL configured the game simply reports multiplayer as unavailable, which is
 * what makes the static build still deployable on its own.
 */

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';

/** Idle rooms are swept so a crashed client cannot pin memory forever. */
const ROOM_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
/** A socket that has not answered two pings in a row is gone. */
const HEARTBEAT_MS = 30 * 1000;

interface Room {
	match: Match;
	sockets: Map<Seat, WebSocket>;
	lastActivity: number;
}

const rooms = new Map<string, Room>();

interface Session {
	room?: Room;
	seat?: Seat;
	alive: boolean;
}

const sessions = new WeakMap<WebSocket, Session>();

// ── Logging ───────────────────────────────────────────────────────────────

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? LEVELS.info;

/**
 * Structured, one line per event, machine-parseable.
 *
 * JSON rather than prose because these lines are meant to be grepped and fed to
 * a log aggregator, and because a match is diagnosed by reconstructing a
 * sequence — which is far easier when every line carries the room code.
 */
function logLine(level: Level, event: string, fields: Record<string, unknown> = {}) {
	if (LEVELS[level] < threshold) return;
	const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
	if (level === 'error') console.error(line);
	else if (level === 'warn') console.warn(line);
	else console.log(line);
}

// ── Transport ─────────────────────────────────────────────────────────────

const http = createServer((req, res) => {
	// A health endpoint, so a platform's readiness check does not need a socket.
	if (req.url === '/health') {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ ok: true, rooms: rooms.size, uptime: process.uptime() }));
		return;
	}
	res.writeHead(404).end();
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (socket, req) => {
	sessions.set(socket, { alive: true });
	logLine('debug', 'socket.open', { peer: req.socket.remoteAddress });

	socket.on('pong', () => {
		const session = sessions.get(socket);
		if (session) session.alive = true;
	});

	socket.on('message', (raw) => {
		let message: ClientMessage;
		try {
			message = JSON.parse(String(raw)) as ClientMessage;
		} catch {
			logLine('warn', 'message.unparseable', { bytes: String(raw).length });
			return;
		}

		try {
			handle(socket, message);
		} catch (error) {
			// One malformed message must never take the process — and therefore
			// everybody else's match — down with it.
			logLine('error', 'handler.threw', {
				type: (message as { t?: string })?.t,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	socket.on('close', () => {
		const session = sessions.get(socket);
		if (session?.room && session.seat) dropPlayer(session.room, session.seat);
		logLine('debug', 'socket.close', {});
	});

	socket.on('error', (error) => logLine('warn', 'socket.error', { error: error.message }));
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
		case 'config': {
			if (seat !== room.match.hostSeat) {
				send(socket, { t: 'error', code: 'notHost', message: 'Only the host sets the rules.' });
				return;
			}
			room.match.applyConfig(message.config);
			logLine('info', 'lobby.config', { room: room.match.code, config: room.match.config });
			broadcastLobby(room);
			return;
		}

		case 'ready': {
			room.match.setReady(seat, message.ready);
			broadcastLobby(room);
			if (room.match.everyoneReady && !room.match.started) {
				logLine('info', 'match.start', {
					room: room.match.code,
					config: room.match.config
				});
				dispatch(room, room.match.start());
			}
			return;
		}

		case 'move': {
			const before = Date.now();
			const out = room.match.move(seat, message.lan, message.gameIndex, before);
			logLine('debug', 'match.move', {
				room: room.match.code,
				seat,
				lan: message.lan,
				rejected: out.some((o) => o.message.t === 'error')
			});
			dispatch(room, out);
			return;
		}

		case 'position': {
			dispatch(room, room.match.reportPosition(seat, message.bands, message));
			return;
		}

		case 'resign': {
			const other: Seat = seat === 'a' ? 'b' : 'a';
			logLine('info', 'match.resigned', { room: room.match.code, seat });
			dispatch(room, room.match.endMatch(other, 'resigned'));
			return;
		}

		case 'requestEndRun': {
			logLine('info', 'match.end_run_requested', { room: room.match.code, seat });
			dispatch(room, room.match.requestEndRun(seat));
			return;
		}

		case 'respondEndRun': {
			logLine('info', 'match.end_run_response', {
				room: room.match.code,
				seat,
				accept: message.accept
			});
			dispatch(room, room.match.respondEndRun(seat, message.accept));
			return;
		}
	}
}

function joinRoom(socket: WebSocket, session: Session, displayName: string, code?: string) {
	const requested = code ? normaliseRoomCode(code) : '';

	let room: Room | undefined;
	if (requested) {
		room = rooms.get(requested);
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
		room = createRoom();
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

	logLine('info', 'lobby.join', {
		room: room.match.code,
		seat,
		name: displayName,
		players: room.match.players.size
	});

	broadcastLobby(room);

	// Rejoining a match already in progress rebuilds rather than restarts.
	if (room.match.started && !room.match.ended) {
		send(socket, room.match.snapshot(seat));
	}
}

function createRoom(): Room {
	let code = generateRoomCode();
	// Codes are short enough that a collision is possible; the server is the only
	// place that can actually rule one out.
	while (rooms.has(code)) code = generateRoomCode();

	const room: Room = { match: new Match(code), sockets: new Map(), lastActivity: Date.now() };
	rooms.set(code, room);
	logLine('info', 'lobby.created', { room: code, open: rooms.size });
	return room;
}

function dropPlayer(room: Room, seat: Seat) {
	room.sockets.delete(seat);
	const player = room.match.player(seat);
	logLine('info', 'lobby.leave', { room: room.match.code, seat, name: player?.displayName });

	if (room.match.started && !room.match.ended) {
		const other: Seat = seat === 'a' ? 'b' : 'a';
		dispatch(room, room.match.endMatch(other, 'disconnected'));
	}

	room.match.leave(seat);
	broadcastLobby(room);

	if (room.sockets.size === 0) {
		rooms.delete(room.match.code);
		logLine('info', 'lobby.closed', { room: room.match.code, open: rooms.size });
	}
}

// ── Sending ───────────────────────────────────────────────────────────────

function send(socket: WebSocket, message: ServerMessage) {
	if (socket.readyState !== socket.OPEN) return;
	socket.send(JSON.stringify(message));
}

function dispatch(room: Room, outbound: Outbound[]) {
	for (const { to, message } of outbound) {
		if (to === 'all') {
			for (const socket of room.sockets.values()) send(socket, message);
		} else {
			const socket = room.sockets.get(to);
			if (socket) send(socket, message);
		}
	}
}

/** The lobby view differs per seat (each client is told which seat it holds). */
function broadcastLobby(room: Room) {
	for (const [seat, socket] of room.sockets) {
		send(socket, room.match.lobbyState(seat));
	}
}

// ── Upkeep ────────────────────────────────────────────────────────────────

setInterval(() => {
	for (const socket of wss.clients) {
		const session = sessions.get(socket);
		if (!session) continue;
		if (!session.alive) {
			// Missed the previous ping: the socket is open in name only, which is
			// common on mobile networks after a sleep.
			socket.terminate();
			continue;
		}
		session.alive = false;
		socket.ping();
	}
}, HEARTBEAT_MS).unref();

setInterval(() => {
	const cutoff = Date.now() - ROOM_TTL_MS;
	for (const [code, room] of rooms) {
		if (room.lastActivity < cutoff && room.sockets.size === 0) {
			rooms.delete(code);
			logLine('info', 'lobby.swept', { room: code });
		}
	}
}, SWEEP_INTERVAL_MS).unref();

http.listen(PORT, HOST, () => {
	logLine('info', 'server.listening', { host: HOST, port: PORT });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		logLine('info', 'server.stopping', { signal });
		wss.close();
		http.close(() => process.exit(0));
	});
}
