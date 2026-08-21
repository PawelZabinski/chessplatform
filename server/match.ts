import { Chess } from 'chess.js';
import { liftForMove } from '../src/game/lift.ts';
import {
	DEFAULT_MATCH_CONFIG,
	MAX_PLAYERS,
	SEATS,
	type ClimberPose,
	type GameStart,
	type MatchConfig,
	type Seat,
	type ServerMessage
} from '../src/game/multiplayer/protocol.ts';
import { randomBackRankFen } from '../src/game/multiplayer/openings.ts';
import { randomWorldSeed } from '../src/game/worldSeed.ts';

/**
 * A match, and every rule that decides one.
 *
 * This is the authority. Clients render and send intents; nothing here trusts a
 * client for anything that decides the match — legality, lift, cooldowns and
 * height are all settled on this side. That is not paranoia about cheating so
 * much as a consequence of the mode: altitude is the win condition and altitude
 * comes from chess, so a client-authoritative height would be a client-authored
 * victory.
 *
 * Deliberately transport-free: it takes intents and returns messages to send.
 * That keeps the whole rule set testable without a socket, and it is why the
 * websocket layer in index.ts is as thin as it is.
 */

export interface Player {
	seat: Seat;
	displayName: string;
	ready: boolean;
	/** Bands climbed, as last reported and clamped. */
	height: number;
	/** Consecutive chess games won. */
	streak: number;
	/** Consecutive chess games lost, which drives the handicap ladder. */
	losses: number;
	/** Server time this player may next move. */
	nextMoveAt: number;
	connected: boolean;
	/** Index into the climber palette, so every rival is a different colour. */
	colour: number;
	/** Latest visual pose; advisory and never used to decide the winner. */
	pose: ClimberPose;
}

export type Outbound = { to: Seat | 'all'; message: ServerMessage };

/**
 * The largest height jump a single report may claim.
 *
 * Height is reported by the client roughly ten times a second, and the fastest
 * legitimate ascent is the victory fling. Anything beyond this in one step is
 * either a stall-then-catch-up or a forged report; clamping costs an honest
 * client nothing because the next report lands 200ms later.
 */
const MAX_HEIGHT_STEP = 10;

export class Match {
	readonly code: string;
	readonly worldSeed = randomWorldSeed();
	readonly players = new Map<Seat, Player>();
	config: MatchConfig = { ...DEFAULT_MATCH_CONFIG };
	hostSeat: Seat = 'a';

	started = false;
	ended = false;
	gameIndex = -1;

	private chess = new Chess();
	/** Which colour each seat plays in the current game. */
	private colours: Record<Seat, 'w' | 'b'> = { a: 'w', b: 'b', c: 'w', d: 'w', e: 'w' };

	constructor(code: string) {
		this.code = code;
	}

	get seats(): Seat[] {
		return [...this.players.keys()];
	}

	get isFull() {
		return this.players.size >= Math.min(this.config.maxPlayers, MAX_PLAYERS);
	}

	/** True when the chess is a duel on one board rather than a race of solos. */
	get isShared() {
		return this.config.chessMode === 'shared' && this.players.size === 2;
	}

	player(seat: Seat) {
		return this.players.get(seat);
	}

	opponentOf(seat: Seat): Player | undefined {
		return this.players.get(seat === 'a' ? 'b' : 'a');
	}

	// ── Lobby ──────────────────────────────────────────────────────────────

	join(displayName: string): Seat | null {
		const seat = SEATS.slice(0, this.config.maxPlayers).find((s) => !this.players.has(s));
		if (!seat) return null;

		const usedColours = new Set([...this.players.values()].map((player) => player.colour));
		const availableColours = SEATS.map((_, index) => index).filter(
			(index) => !usedColours.has(index)
		);
		const colour = availableColours[randomWorldSeed() % availableColours.length] ?? 0;

		this.players.set(seat, {
			seat,
			displayName: displayName.slice(0, 18) || `Climber ${seat.toUpperCase()}`,
			ready: false,
			height: 0,
			streak: 0,
			losses: 0,
			nextMoveAt: 0,
			connected: true,
			colour,
			pose: { x: 0.5, y: 48, vx: 0, vy: 0, facing: 1, anim: 'idle' }
		});

		if (this.players.size === 1) this.hostSeat = seat;
		return seat;
	}

	leave(seat: Seat) {
		this.players.delete(seat);
	}

	lobbyState(seat: Seat): ServerMessage {
		return {
			t: 'lobby',
			lobbyCode: this.code,
			seat,
			players: [...this.players.values()].map((p) => ({
				seat: p.seat,
				displayName: p.displayName,
				ready: p.ready,
				colour: p.colour
			})),
			config: this.config,
			hostSeat: this.hostSeat
		};
	}

	/**
	 * Applies host settings, clamped.
	 *
	 * Every one of these is a number a client sent, so every one is a lever for
	 * breaking the match — a zero cooldown removes the mode's whole constraint, a
	 * target height of one ends the match instantly. Clamping here rather than
	 * trusting the lobby UI means the UI is a convenience, not a security
	 * boundary.
	 */
	applyConfig(patch: Partial<MatchConfig>) {
		const next = { ...this.config };
		if (typeof patch.targetHeight === 'number')
			next.targetHeight = clamp(Math.round(patch.targetHeight), 10, 1000);
		if (typeof patch.moveCooldownMs === 'number')
			next.moveCooldownMs = clamp(Math.round(patch.moveCooldownMs), 0, 10000);
		if (typeof patch.gameSpeed === 'number') next.gameSpeed = clamp(patch.gameSpeed, 0.25, 1);
		if (typeof patch.lavaSpeed === 'number') next.lavaSpeed = clamp(patch.lavaSpeed, 0, 60);
		if (typeof patch.winStreakForInstantWin === 'number')
			next.winStreakForInstantWin = clamp(Math.round(patch.winStreakForInstantWin), 1, 10);
		if (typeof patch.maxPlayers === 'number')
			// Never below the number already seated, or somebody would be evicted
			// by a setting change.
			next.maxPlayers = clamp(
				Math.round(patch.maxPlayers),
				Math.max(2, this.players.size),
				MAX_PLAYERS
			);
		if (patch.opening) next.opening = patch.opening;
		if (typeof patch.customFen === 'string') next.customFen = patch.customFen.slice(0, 120);
		if (patch.chessMode) next.chessMode = patch.chessMode;

		// A duel needs exactly two people. Any larger room races instead, and
		// saying so here means the lobby cannot present an impossible combination.
		if (next.chessMode === 'shared' && next.maxPlayers !== 2) next.chessMode = 'solo';

		this.config = next;
	}

	setReady(seat: Seat, ready: boolean) {
		const player = this.players.get(seat);
		if (player) player.ready = ready;
	}

	get everyoneReady() {
		return this.players.size >= 2 && [...this.players.values()].every((p) => p.ready);
	}

	// ── Games ──────────────────────────────────────────────────────────────

	/** Starts the match and deals the first game. */
	start(): Outbound[] {
		this.started = true;
		const first = this.dealGame();
		const out: Outbound[] = [];

		for (const seat of this.seats) {
			out.push({
				to: seat,
				message: {
					t: 'start',
					config: this.config,
					worldSeed: this.worldSeed,
					firstGame: this.gameStartFor(seat, first)
				}
			});
		}
		return out;
	}

	/**
	 * Chooses the next position and who plays which colour.
	 *
	 * The handicap ladder is the reason a match between mismatched players stays
	 * worth playing: each consecutive loss hands the trailing player a materially
	 * better position. The ladder FENs are all "White is down material", so the
	 * player who is behind is seated as Black and the leader takes the weakened
	 * White side. A level game just alternates colours by game index, so neither
	 * seat accumulates the first-move edge.
	 */
	private dealGame(freshPieces = false): { fen: string; note?: string } {
		this.gameIndex += 1;

		// A dead position is replaced with an ordinary new chess game. In
		// particular, do not reapply a custom king-only opening or a handicap rung,
		// or the replacement would immediately be dead as well.
		if (freshPieces) {
			const fen = this.config.handicap.level;
			const aIsWhite = this.gameIndex % 2 === 0;
			for (const seat of SEATS) this.colours[seat] = 'w';
			const [first, second] = [...this.players.keys()];
			if (first && second) {
				this.colours[first] = aIsWhite ? 'w' : 'b';
				this.colours[second] = aIsWhite ? 'b' : 'w';
			}
			this.chess.load(fen);
			return { fen, note: 'Insufficient material — fresh pieces dealt' };
		}

		const trailing = [...this.players.values()]
			.filter((p) => p.losses > 0)
			.sort((a, b) => b.losses - a.losses)[0];

		if (!trailing) {
			const fen = this.openingFen();
			const aIsWhite = this.gameIndex % 2 === 0;
			for (const seat of SEATS) this.colours[seat] = 'w';
			const [first, second] = [...this.players.keys()];
			if (first && second) {
				this.colours[first] = aIsWhite ? 'w' : 'b';
				this.colours[second] = aIsWhite ? 'b' : 'w';
			}
			this.chess.load(fen);
			return { fen };
		}

		const steps = this.config.handicap.steps;
		const rung = Math.min(trailing.losses, steps.length) - 1;
		const fen = rung >= 0 ? steps[rung] : this.openingFen();

		// Trailing player takes Black, the side the ladder favours.
		this.colours = { ...this.colours, [trailing.seat]: 'b' };
		for (const seat of this.players.keys()) {
			if (seat !== trailing.seat) this.colours[seat] = 'w';
		}
		this.chess.load(fen);

		const note =
			rung >= 0
				? `${trailing.displayName} is handed the advantage (${rung + 1} loss${rung ? 'es' : ''} running)`
				: undefined;
		return { fen, note };
	}

	/**
	 * The position a level game opens from.
	 *
	 * A custom FEN is validated before use: the host typed or pasted it, and a
	 * position chess.js cannot load would otherwise take the match down at the
	 * moment it starts.
	 */
	private openingFen(): string {
		if (this.config.opening === 'random') return randomBackRankFen();
		if (this.config.opening === 'custom' && this.config.customFen) {
			try {
				new Chess(this.config.customFen);
				return this.config.customFen;
			} catch {
				return this.config.handicap.level;
			}
		}
		return this.config.handicap.level;
	}

	private gameStartFor(seat: Seat, game: { fen: string; note?: string }): GameStart {
		return {
			t: 'gameStart',
			gameIndex: this.gameIndex,
			fen: game.fen,
			// In a race each client runs its own game, so nobody is assigned a
			// colour by the server and every board starts as White.
			youPlay: this.isShared ? this.colours[seat] : 'w',
			shared: this.isShared,
			handicapNote: game.note
		};
	}

	colourOf(seat: Seat) {
		return this.colours[seat];
	}

	// ── Moves ──────────────────────────────────────────────────────────────

	/**
	 * Validates and applies one move.
	 *
	 * This is where real-time chess actually differs from chess. Both players act
	 * on the same board with no turn order, so "whose turn is it" cannot gate
	 * anything — a cooldown does, per player, and the server owns the clock. To
	 * validate a move for a colour whose turn it formally is not, the side-to-move
	 * field is forced to that colour before asking chess.js. Everything else about
	 * legality is ordinary chess, which keeps positions comprehensible: you still
	 * cannot leave your own king en prise or move through a piece.
	 *
	 * Two moves are frequently in flight at once. The first to arrive is applied
	 * and the second is re-validated against the board it actually lands on — so
	 * a move authored a moment ago may simply have become illegal, and is
	 * rejected with the authoritative FEN to resync from.
	 */
	move(seat: Seat, lan: string, gameIndex: number, now: number): Outbound[] {
		const player = this.players.get(seat);
		if (!player || this.ended || !this.started) return [];
		// In a race the chess is local to each client and none of the server's
		// business; only heights are shared.
		if (!this.isShared) return [];

		if (gameIndex !== this.gameIndex) {
			return [
				{
					to: seat,
					message: {
						t: 'error',
						code: 'badMove',
						message: 'That game has already finished.',
						fen: this.chess.fen()
					}
				}
			];
		}

		if (now < player.nextMoveAt) {
			return [
				{
					to: seat,
					message: {
						t: 'error',
						code: 'cooldown',
						message: 'Still on cooldown.',
						retryInMs: player.nextMoveAt - now
					}
				}
			];
		}

		const colour = this.colours[seat];
		const applied = this.applyForColour(lan, colour);
		if (!applied) {
			return [
				{
					to: seat,
					message: {
						t: 'error',
						code: 'badMove',
						message: 'That move is not legal in the current position.',
						fen: this.chess.fen()
					}
				}
			];
		}

		player.nextMoveAt = now + this.config.moveCooldownMs;

		const { lift, reasons } = liftForMove({
			captured: applied.captured,
			flags: applied.flags,
			san: applied.san
		});

		const out: Outbound[] = [
			{
				to: 'all',
				message: {
					t: 'moveApplied',
					gameIndex: this.gameIndex,
					lan,
					fen: this.chess.fen(),
					lift,
					reasons,
					enPassant: applied.flags.includes('e'),
					by: seat
				}
			}
		];

		const ending = this.detectGameEnd(colour);
		if (ending) out.push(...this.endGame(seat, ending));
		return out;
	}

	/**
	 * Applies a move as `colour`, whatever the FEN says the turn is.
	 * Returns the move on success, null if it was not legal.
	 */
	private applyForColour(lan: string, colour: 'w' | 'b') {
		const parts = this.chess.fen().split(' ');
		if (parts[1] !== colour) {
			parts[1] = colour;
			// A move by the other side clears any en-passant right, which belonged
			// to the colour that is no longer moving.
			parts[3] = '-';
			try {
				this.chess.load(parts.join(' '));
			} catch {
				return null;
			}
		}

		try {
			return this.chess.move({
				from: lan.slice(0, 2),
				to: lan.slice(2, 4),
				promotion: lan.charAt(4) || undefined
			});
		} catch {
			return null;
		}
	}

	/** Result of the game just played, from the point of view of the mover. */
	private detectGameEnd(mover: 'w' | 'b'): { winner: 'mover' | null; reason: string } | null {
		// Ask the question of the side that did NOT just move: can they reply?
		const parts = this.chess.fen().split(' ');
		const opponent = mover === 'w' ? 'b' : 'w';
		if (parts[1] !== opponent) {
			parts[1] = opponent;
			parts[3] = '-';
			try {
				this.chess.load(parts.join(' '));
			} catch {
				return null;
			}
		}

		if (this.chess.moves().length === 0) {
			return this.chess.inCheck()
				? { winner: 'mover', reason: 'checkmate' }
				: { winner: null, reason: 'stalemate' };
		}
		// Repetition is deliberately ignored. A dead position is different: deal a
		// complete new set of pieces so the climb can continue.
		if (this.chess.isInsufficientMaterial()) {
			return { winner: null, reason: 'insufficient material' };
		}
		// The fifty-move rule remains the backstop against an endless sequence with
		// no pawn move or capture.
		if (this.chess.isDrawByFiftyMoves()) {
			return { winner: null, reason: 'fifty-move rule' };
		}
		return null;
	}

	private endGame(moverSeat: Seat, ending: { winner: 'mover' | null; reason: string }): Outbound[] {
		const winner = ending.winner === 'mover' ? moverSeat : null;
		const out: Outbound[] = [];

		for (const p of this.players.values()) {
			if (winner === null) {
				p.streak = 0;
				p.losses = 0; // A draw resets the ladder: nobody is "behind" on it.
			} else if (p.seat === winner) {
				p.streak += 1;
				p.losses = 0;
			} else {
				p.streak = 0;
				p.losses += 1;
			}
		}

		const streaks = this.streaks();
		// The fling is what makes winning a game worth chasing: a big, visible
		// jump up the tower rather than a scoreboard tick.
		const fling = winner ? Math.round(this.config.targetHeight * 0.18) : 0;
		if (winner) {
			const w = this.players.get(winner);
			if (w) w.height += fling;
		}

		out.push({
			to: 'all',
			message: {
				t: 'gameEnded',
				gameIndex: this.gameIndex,
				winner,
				reason: ending.reason,
				fling,
				streaks
			}
		});

		// Back-to-back wins close the match out: the handicap ladder makes losing
		// survivable, so a genuinely stronger player needs a way to actually finish.
		if (winner && streaks[winner] >= this.config.winStreakForInstantWin) {
			out.push(...this.endMatch(winner, 'winStreak'));
			return out;
		}

		const reachedTop = [...this.players.values()].find(
			(p) => p.height >= this.config.targetHeight
		);
		if (reachedTop) {
			out.push(...this.endMatch(reachedTop.seat, 'reachedTop'));
			return out;
		}

		const next = this.dealGame(ending.reason === 'insufficient material');
		for (const seat of this.seats) {
			out.push({ to: seat, message: this.gameStartFor(seat, next) });
		}
		// A fresh board means a fresh clock; nobody should start a game mid-cooldown.
		for (const p of this.players.values()) p.nextMoveAt = 0;

		return out;
	}

	// ── Climber position and match end ─────────────────────────────────────

	reportPosition(seat: Seat, bands: number, pose: ClimberPose): Outbound[] {
		const player = this.players.get(seat);
		if (!player || this.ended || !this.started) return [];

		const claimed = Number.isFinite(bands) ? Math.max(0, Math.floor(bands)) : 0;
		player.height = Math.min(claimed, player.height + MAX_HEIGHT_STEP);
		player.pose = {
			x: clamp(finiteOr(pose.x, 0.5), 0, 1),
			y: clamp(finiteOr(pose.y, 48), -200, this.config.targetHeight * 250 + 2000),
			vx: clamp(finiteOr(pose.vx, 0), -4, 4),
			vy: clamp(finiteOr(pose.vy, 0), -3000, 3000),
			facing: pose.facing === -1 ? -1 : 1,
			anim: ['idle', 'run', 'jump', 'double'].includes(pose.anim) ? pose.anim : 'idle'
		};

		const out: Outbound[] = [
			{
				to: 'all',
				message: { t: 'positions', positions: this.positions(), heights: this.heights() }
			}
		];

		if (player.height >= this.config.targetHeight) {
			out.push(...this.endMatch(seat, 'reachedTop'));
		}
		return out;
	}

	endMatch(winner: Seat | null, reason: 'reachedTop' | 'winStreak' | 'resigned' | 'disconnected'): Outbound[] {
		if (this.ended) return [];
		this.ended = true;
		return [
			{
				to: 'all',
				message: { t: 'matchEnded', winner, reason, finalHeights: this.heights() }
			}
		];
	}

	/** Everything a reconnecting client needs to rebuild itself. */
	snapshot(seat: Seat): ServerMessage {
		return {
			t: 'snapshot',
			config: this.config,
			worldSeed: this.worldSeed,
			seat,
			gameIndex: this.gameIndex,
			fen: this.chess.fen(),
			youPlay: this.colours[seat],
			shared: this.isShared,
			positions: this.positions(),
			heights: this.heights(),
			streaks: this.streaks()
		};
	}

	private positions(): Partial<Record<Seat, ClimberPose>> {
		const out: Partial<Record<Seat, ClimberPose>> = {};
		for (const [seat, player] of this.players) out[seat] = player.pose;
		return out;
	}

	private heights(): Record<Seat, number> {
		const out = {} as Record<Seat, number>;
		for (const seat of SEATS) out[seat] = this.players.get(seat)?.height ?? 0;
		return out;
	}

	private streaks(): Record<Seat, number> {
		const out = {} as Record<Seat, number>;
		for (const seat of SEATS) out[seat] = this.players.get(seat)?.streak ?? 0;
		return out;
	}
}

function clamp(value: number, min: number, max: number) {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number) {
	return Number.isFinite(value) ? value : fallback;
}
