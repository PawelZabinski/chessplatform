/**
 * Multiplayer — design and wire protocol.
 *
 * ⚠️ NOT IMPLEMENTED. This file is the design record and the type surface only.
 * Nothing here opens a socket. The lobby UI ships as "Coming Soon" and the mode
 * is not selectable. Implement against these types when you pick this up.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE MODE
 *
 * Two players climb the same tower side by side. As in single player, the climb
 * is driven by chess: your own moves lift your own climber, and the goal is
 * altitude. Winning a chess game is the big accelerator, not the objective.
 *
 * A match is a sequence of chess games:
 *
 *  1. Both players start from the standard position and climb as they play.
 *  2. When a game ends, the winner is flung a long way up the tower and a new
 *     game is dealt immediately — the climb never resets, only the board does.
 *  3. The new game is handicapped in the LOSER's favour. The intent is that a
 *     player who is behind is not buried: they get a materially better position
 *     each time they lose, so the match stays live. See HandicapLadder below.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REAL-TIME CHESS — THE MOVE COOLDOWN
 *
 * Multiplayer is NOT turn-based. Neither player ever waits for the other.
 *
 * Each player has their own cooldown (MatchConfig.moveCooldownMs, default 1000).
 * You play a move, wait out your cooldown, play the next — regardless of whether
 * your opponent has replied. Both sides act on the same board simultaneously,
 * so the game is decided as much by speed as by accuracy. It is very rapid
 * chess, closer to a real-time strategy game than to blitz.
 *
 * Consequences the implementation has to respect:
 *
 *  - MOVE ORDER IS DECIDED BY THE SERVER, by arrival time. Two moves can be in
 *    flight at once; whichever lands first is applied, and the second is
 *    re-validated against the resulting position. A move that has become illegal
 *    is rejected with ServerError 'badMove' and the client resyncs from the FEN
 *    in the rejection. Clients must therefore treat their own move as pending
 *    until MoveApplied confirms it — optimistic local application is fine for
 *    animation, but the server's FEN always wins.
 *  - chess.js turn order cannot be used to gate input, because "whose turn it is"
 *    stops being meaningful. The server validates a move as legal-for-that-colour
 *    in the current position, and enforces the cooldown per player.
 *  - The cooldown is enforced SERVER-SIDE (a client-side timer alone is trivially
 *    bypassed). The client shows its own cooldown as a sweep on the board so the
 *    player can time the next move; the server rejects anything early with the
 *    remaining milliseconds so the two stay in step.
 *  - A player who is checkmated does not end the match — that is a game result,
 *    which triggers the fling and the re-deal as above.
 *
 * Interaction with game speed: MatchConfig.gameSpeed is shared by both clients
 * and set by the host. Player-local slow-motion (src/lib/stores/settings.ts) must
 * be IGNORED in multiplayer — in a real-time race, a player running at 0.35x
 * would get nearly three times the thinking time per simulated second, which is
 * decisive. The lobby should say so plainly when a guest has a non-default speed.
 *
 * ENDING A MATCH — three ways:
 *
 *  a. Someone reaches the top of the tower. The height that counts as "the top"
 *     is configured before the match starts (MatchConfig.targetHeight), so a
 *     lobby can pick a short or a long match.
 *  b. A player wins TWO CHESS GAMES IN A ROW. That player's climber is flung
 *     all the way to the top of the tower — an instant win. This is the comeback
 *     stopper: the handicap ladder makes losing survivable, and back-to-back
 *     wins are how a genuinely stronger player closes the match out.
 *  c. A player disconnects or resigns.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE
 *
 * Authority: the SERVER is authoritative for chess state and match state. The
 * client renders and sends intents. This matters because altitude drives the win
 * condition, and altitude is derived from chess moves — a client-authoritative
 * height is trivially forged.
 *
 * The platformer is deliberately NOT lockstep-simulated across clients. Each
 * client simulates its own climber locally and reports its height on a timer
 * (HeightReport, ~5/sec). The server keeps the canonical height for win checks;
 * the opponent's climber is drawn as a smoothed ghost. Physics divergence
 * between clients therefore does not desync the match — only chess does, and
 * chess is turn-based and cheap to validate server-side.
 *
 * Reconnection: MatchSnapshot carries everything needed to rebuild a client
 * mid-match, so a dropped socket resumes rather than forfeits.
 *
 * Transport: a plain WebSocket carrying JSON. Every message is tagged with `t`.
 * Client→server messages are intents; server→client messages are facts.
 */

/** Player slot within a match. */
export type Seat = 'a' | 'b';

/**
 * How far behind the loser is allowed to fall before the next game is skewed in
 * their favour. Index = consecutive losses; value = the FEN handed to them.
 *
 * These are placeholders. When implementing, tune them the way the tower floors
 * were tuned: the loser should feel helped, not gifted a forced win.
 */
export interface HandicapLadder {
	/** FEN for a level game (first game of the match, or after a draw). */
	level: string;
	/**
	 * Positions favouring the player who is behind, escalating with each
	 * consecutive loss. The winner plays the mirrored side.
	 */
	steps: string[];
}

export interface MatchConfig {
	/**
	 * Altitude that ends the match, in platform bands. Chosen in the lobby before
	 * the match starts — this is the "score for the end" that makes a match
	 * short or long.
	 */
	targetHeight: number;
	/** Consecutive wins that fling a player to the top instantly. Default 2. */
	winStreakForInstantWin: number;
	/**
	 * Per-player cooldown between their own moves, in milliseconds. This is what
	 * makes the mode real-time: you wait out your own cooldown, never your
	 * opponent. Enforced server-side.
	 */
	moveCooldownMs: number;
	/**
	 * Simulation speed for the match, set by the host and shared by both clients.
	 * Player-local slow-motion is ignored in multiplayer — see the note above.
	 */
	gameSpeed: number;
	/** Lava rise rate, shared by both climbers so the pressure is symmetric. */
	lavaSpeed: number;
	handicap: HandicapLadder;
}

// ── Client → server ─────────────────────────────────────────────────────────

export interface JoinLobby {
	t: 'join';
	displayName: string;
	/** Omit to be matched into an open lobby. */
	lobbyCode?: string;
}

export interface SetConfig {
	t: 'config';
	/** Host only. Rejected from the non-host seat. */
	config: Partial<MatchConfig>;
}

export interface Ready {
	t: 'ready';
	ready: boolean;
}

/** A chess move intent, in long algebraic notation ("e2e4", "e7e8q"). */
export interface MoveIntent {
	t: 'move';
	lan: string;
	/** Server rejects moves for a game the client is no longer on. */
	gameIndex: number;
	/**
	 * Position the client believed it was moving in. The server uses this to spot
	 * a move authored against a board that has since changed under it — the
	 * normal case when both players move at once.
	 */
	expectedFen: string;
}

/** Periodic, low-frequency height report. Advisory: the server clamps it. */
export interface HeightReport {
	t: 'height';
	bands: number;
	gameIndex: number;
}

export interface Resign {
	t: 'resign';
}

export type ClientMessage = JoinLobby | SetConfig | Ready | MoveIntent | HeightReport | Resign;

// ── Server → client ─────────────────────────────────────────────────────────

export interface LobbyState {
	t: 'lobby';
	lobbyCode: string;
	seat: Seat;
	players: { seat: Seat; displayName: string; ready: boolean }[];
	config: MatchConfig;
	hostSeat: Seat;
}

export interface MatchStart {
	t: 'start';
	config: MatchConfig;
	firstGame: GameStart;
}

export interface GameStart {
	t: 'gameStart';
	gameIndex: number;
	fen: string;
	/** Which colour this client plays in this game. */
	youPlay: 'w' | 'b';
	/** Why this position was chosen, for the on-screen banner. */
	handicapNote?: string;
}

/** A move that has been validated and applied by the server. */
export interface MoveApplied {
	t: 'moveApplied';
	gameIndex: number;
	lan: string;
	/** Resulting position, so a client can resync without replaying. */
	fen: string;
	/** Lift the mover earns, computed server-side from src/game/lift.ts rules. */
	lift: number;
	by: Seat;
}

export interface GameEnded {
	t: 'gameEnded';
	gameIndex: number;
	/** null on a draw. */
	winner: Seat | null;
	reason: string;
	/** Bands the winner is flung upward. */
	fling: number;
	/** Consecutive-win counters after this game. */
	streaks: Record<Seat, number>;
}

/** Opponent height for the ghost climber. Sent at the report cadence. */
export interface HeightUpdate {
	t: 'heights';
	heights: Record<Seat, number>;
}

export interface MatchEnded {
	t: 'matchEnded';
	winner: Seat | null;
	reason: 'reachedTop' | 'winStreak' | 'resigned' | 'disconnected';
	finalHeights: Record<Seat, number>;
}

/** Full state for reconnection. */
export interface MatchSnapshot {
	t: 'snapshot';
	config: MatchConfig;
	seat: Seat;
	gameIndex: number;
	fen: string;
	youPlay: 'w' | 'b';
	heights: Record<Seat, number>;
	streaks: Record<Seat, number>;
}

export interface ServerError {
	t: 'error';
	code: 'lobbyFull' | 'badMove' | 'cooldown' | 'notHost' | 'unknownLobby';
	message: string;
	/** Authoritative position to resync to, sent with 'badMove'. */
	fen?: string;
	/** Milliseconds still to wait, sent with 'cooldown'. */
	retryInMs?: number;
}

export type ServerMessage =
	| LobbyState
	| MatchStart
	| GameStart
	| MoveApplied
	| GameEnded
	| HeightUpdate
	| MatchEnded
	| MatchSnapshot
	| ServerError;

/**
 * Defaults a lobby opens with. targetHeight is the knob players actually change.
 */
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
	targetHeight: 120,
	winStreakForInstantWin: 2,
	moveCooldownMs: 1000,
	gameSpeed: 1,
	lavaSpeed: 12,
	handicap: {
		level: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
		// Placeholder ladder: a pawn, then the exchange, then a piece.
		steps: [
			'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNR w KQkq - 0 1',
			'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1',
			'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKB1R w KQkq - 0 1'
		]
	}
};

/**
 * IMPLEMENTATION NOTES — where this plugs into the existing code.
 *
 * - BoardController (src/lib/board/BoardController.ts) already separates "the
 *   opponent supplies a move" from "the engine supplies a move" via MoveProvider.
 *   A multiplayer opponent is a MoveProvider whose getMove() resolves when a
 *   MoveApplied message arrives for the opponent's colour. No board changes are
 *   needed beyond constructing it with a different provider.
 *
 * - Lift is already a pure function (src/game/lift.ts). The server should import
 *   the same module so client and server agree on the reward for a move; that is
 *   why it has no Phaser dependency and takes a plain object.
 *
 * - Game scene: a 'multiplayer' GameMode alongside 'tower' and 'endless'. It
 *   differs from endless in three ways only — the opponent is remote, a second
 *   ghost climber is drawn, and the run ends on MatchEnded rather than on a loss.
 *
 * - The instant-win fling (two wins in a row) should reuse the existing victory
 *   fling, with the target height set to config.targetHeight rather than a fixed
 *   velocity, so the climber visibly rockets to the top.
 *
 * - Suggested server: a small Node process holding matches in memory. Chess
 *   validation is chess.js, the same library the client uses.
 *
 * - The move cooldown needs a small UI: a sweep or shrinking ring on the board
 *   while it runs. BoardController already gates input through the dests map, so
 *   the cleanest hook is to clear dests for the duration and restore them when
 *   the cooldown expires — the same mechanism that stops you moving the
 *   opponent's pieces.
 */
