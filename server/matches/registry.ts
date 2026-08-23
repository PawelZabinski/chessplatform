import type { WebSocket } from 'ws';
import { generateRoomCode } from '../../src/game/multiplayer/roomCode.ts';
import type { Seat } from '../../src/game/multiplayer/protocol.ts';
import type { Logger } from '../logging.ts';
import { Match } from '../match.ts';

export interface MatchRoom {
	match: Match;
	sockets: Map<Seat, WebSocket>;
	lastActivity: number;
}

/** Owns live match rooms without coupling them to HTTP or process startup. */
export class MatchRegistry {
	private readonly rooms = new Map<string, MatchRoom>();
	private readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	get size() {
		return this.rooms.size;
	}

	get(code: string) {
		return this.rooms.get(code);
	}

	create(): MatchRoom {
		let code = generateRoomCode();
		while (this.rooms.has(code)) code = generateRoomCode();

		const room: MatchRoom = {
			match: new Match(code),
			sockets: new Map(),
			lastActivity: Date.now()
		};
		this.rooms.set(code, room);
		this.logger.info('lobby.created', { room: code, open: this.rooms.size });
		return room;
	}

	delete(room: MatchRoom) {
		if (!this.rooms.delete(room.match.code)) return;
		this.logger.info('lobby.closed', { room: room.match.code, open: this.rooms.size });
	}

	sweepOlderThan(cutoff: number) {
		for (const [code, room] of this.rooms) {
			if (room.lastActivity >= cutoff || room.sockets.size > 0) continue;
			this.rooms.delete(code);
			this.logger.info('lobby.swept', { room: code, open: this.rooms.size });
		}
	}
}
