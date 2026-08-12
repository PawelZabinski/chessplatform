import { Chessground } from 'chessground';
import type { Api as CgApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess, SQUARES, type Move, type Square } from 'chess.js';

/**
 * The chess board.
 *
 * Rules come from chess.js; rendering and input come from chessground (the board
 * Lichess itself uses). Both are mainstream and maintained, and driving them
 * directly — rather than through a wrapper — is what this game needs, because it
 * has requirements an off-the-shelf wrapper does not serve:
 *
 *  - It reloads arbitrary positions mid-session (tower floors, and a fresh game
 *    dealt the instant one is won). The previous wrapper fired its game-over
 *    callback synchronously from inside its own post-move routine and then kept
 *    going, blanking the legal-move map that our reload had just installed. The
 *    result was a board that looked right but could not be moved. Here, game-over
 *    is reported *after* the board is fully settled, so a listener is free to
 *    load the next position immediately.
 *  - Engine strength changes between and during games.
 *  - Multiplayer will need to apply a remote opponent's move with no local engine
 *    involved at all (see src/game/multiplayer/protocol.ts).
 *
 * The controller owns no game rules of its own: it is a thin, predictable seam
 * between chess.js state and what is on screen.
 */

export type GameOverReason =
	| 'checkmate'
	| 'king captured'
	| 'stalemate'
	| 'insufficient material'
	| 'repetition'
	| 'fifty-move rule';

export interface GameOverDetail {
	reason: GameOverReason;
	/** From White's perspective: 1 win, 0.5 draw, 0 loss. */
	result: 1 | 0.5 | 0;
}

/** Warning that the current game is drifting towards a drawn result. */
export interface DrawRisk {
	kind: 'repetition' | 'fifty-move';
	/** How many more of the same before the draw triggers. */
	movesRemaining: number;
	message: string;
}

/** Supplies the opposing side's move. Absent in local two-player or multiplayer. */
export interface MoveProvider {
	/** Which colour this provider plays. */
	readonly colour: 'w' | 'b';
	/** Resolves to a move in long algebraic notation, e.g. "e2e4" or "e7e8q". */
	getMove(fen: string): Promise<string>;
	/** Called before the position changes underneath a search in progress. */
	abort?(): void;
}

export interface BoardCallbacks {
	onMove?(move: Move): void;
	onGameOver?(detail: GameOverDetail): void;
	onPositionChange?(fen: string): void;
	/** Fired when the game drifts towards a draw, while it is still avoidable. */
	onDrawRisk?(risk: DrawRisk): void;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Piece glide at normal speed, and the pause before the opponent replies. */
const NORMAL_ANIM_MS = 180;
const NORMAL_REPLY_DELAY_MS = 120;
/**
 * Under slow-motion the player's move takes a long, deliberate beat to resolve.
 * The opponent's reply is still instant — it simply waits for your move to
 * finish first, so the exchange reads as one slow beat then one snap.
 */
const SLOW_ANIM_MS = 900;
const SLOW_REPLY_DELAY_MS = 1500;

export class BoardController {
	private readonly chess = new Chess();
	private ground: CgApi;
	private opponent?: MoveProvider;
	private callbacks: BoardCallbacks;

	/**
	 * Incremented on every load. An engine reply that resolves after the position
	 * has moved on carries a stale token and is discarded, which is what stops a
	 * slow search from dropping a move onto a freshly dealt game.
	 */
	private positionToken = 0;
	private gameOver = false;

	/** Position sightings for the repetition warning, keyed by FEN prefix. */
	private positionCounts = new Map<string, number>();

	/** Slow-motion stretches the player's move, never the opponent's reply. */
	private slowMotion = false;
	private pendingReply?: ReturnType<typeof setTimeout>;

	constructor(element: HTMLElement, callbacks: BoardCallbacks = {}) {
		this.callbacks = callbacks;
		this.chess.load(START_FEN);

		this.ground = Chessground(element, {
			fen: this.chess.fen(),
			orientation: 'white',
			coordinates: true,
			animation: { enabled: true, duration: 180 },
			highlight: { lastMove: true, check: true },
			movable: {
				free: false,
				color: 'white',
				dests: this.legalDests(),
				showDests: true,
				events: { after: (orig, dest) => this.onUserMove(orig, dest) }
			},
			draggable: { enabled: true, showGhost: true }
		});
	}

	setOpponent(provider: MoveProvider | undefined) {
		this.opponent = provider;
	}

	/**
	 * Enters or leaves slow-motion on the board.
	 *
	 * Only the local player's move is slowed. The opponent's reply stays instant
	 * but is held back until your move has finished resolving, so slow-motion
	 * buys real thinking time rather than just looking different.
	 */
	setSlowMotion(active: boolean) {
		this.slowMotion = active;
		this.ground.set({
			animation: { enabled: true, duration: active ? SLOW_ANIM_MS : NORMAL_ANIM_MS }
		});
	}

	get fen() {
		return this.chess.fen();
	}

	get turn() {
		return this.chess.turn();
	}

	get isGameOver() {
		return this.gameOver;
	}

	/**
	 * Loads a position and hands control back to the player. Safe to call from
	 * inside an onGameOver handler — that is the whole point of this class.
	 */
	load(fen: string = START_FEN) {
		this.positionToken += 1;
		this.opponent?.abort?.();
		clearTimeout(this.pendingReply);

		this.chess.load(fen);
		this.gameOver = false;
		// Seed the tally with the starting position, so a shuffle back to it is
		// recognised as a repeat and the warning lands a full cycle earlier.
		this.positionCounts.clear();
		this.countPosition();

		this.ground.set({
			fen: this.chess.fen(),
			turnColor: this.colourName(this.chess.turn()),
			lastMove: undefined,
			selected: undefined,
			check: this.chess.inCheck() ? this.colourName(this.chess.turn()) : undefined,
			movable: { color: this.playerColour(), dests: this.legalDests() }
		});

		this.callbacks.onPositionChange?.(this.chess.fen());

		// A loaded position may already be decided, or may be the opponent's move.
		if (!this.reportGameOverIfFinished()) {
			this.maybePlayOpponent();
		}
	}

	reset() {
		this.load(START_FEN);
	}

	/** Applies a move made by the local player on the board. */
	private onUserMove(orig: Key, dest: Key) {
		const promotion = this.isPromotion(orig as Square, dest as Square) ? 'q' : undefined;

		let move: Move;
		try {
			move = this.chess.move({ from: orig as string, to: dest as string, promotion });
		} catch {
			// Illegal (shouldn't happen — dests are supplied) — resync and bail.
			this.syncGround();
			return;
		}

		this.afterMove(move);
	}

	/** Applies a move from a provider or a remote peer, in LAN form. */
	applyMove(lan: string): boolean {
		const from = lan.slice(0, 2);
		const to = lan.slice(2, 4);
		const promotion = lan.charAt(4) || undefined;

		let move: Move;
		try {
			move = this.chess.move({ from, to, promotion });
		} catch {
			return false;
		}

		this.ground.move(from as Key, to as Key);
		this.afterMove(move);
		return true;
	}

	/**
	 * Settle the board first, then report. Ordering matters: a listener reacting
	 * to game-over by loading the next position must be the last word, not have
	 * its work overwritten by the remainder of this method.
	 */
	private afterMove(move: Move) {
		this.syncGround();
		this.callbacks.onMove?.(move);
		this.callbacks.onPositionChange?.(this.chess.fen());

		if (this.reportGameOverIfFinished()) return;

		const risk = this.assessDrawRisk();
		if (risk) this.callbacks.onDrawRisk?.(risk);

		this.maybePlayOpponent();
	}

	private syncGround() {
		const turn = this.chess.turn();
		this.ground.set({
			fen: this.chess.fen(),
			turnColor: this.colourName(turn),
			check: this.chess.inCheck() ? this.colourName(turn) : undefined,
			movable: { color: this.playerColour(), dests: this.legalDests() }
		});
	}

	/** Returns true when the game is over (and the callback has been fired). */
	private reportGameOverIfFinished(): boolean {
		const detail = this.gameOverDetail();
		if (!detail) return false;

		this.gameOver = true;
		// No legal moves offered once the game is decided.
		this.ground.set({ movable: { dests: new Map() } });
		this.callbacks.onGameOver?.(detail);
		return true;
	}

	private gameOverDetail(): GameOverDetail | null {
		// A missing king has to be checked FIRST, and cannot be delegated to
		// chess.js.
		//
		// Spikes remove one of your own pieces, which can discover an attack from
		// your own slider onto the enemy king. That leaves a position chess.js
		// considers legal enough to offer the king capture — and once a king is
		// gone its predicates lie: a kingless board reports isStalemate (a draw we
		// would wrongly award) or reports nothing at all, in which case play
		// continued and the engine was handed a kingless FEN, which hung the game.
		//
		// Taking the king simply wins.
		const missing = this.missingKing();
		if (missing) {
			return { reason: 'king captured', result: missing === 'b' ? 1 : 0 };
		}

		if (this.chess.isCheckmate()) {
			// The side to move has been mated.
			return { reason: 'checkmate', result: this.chess.turn() === 'w' ? 0 : 1 };
		}
		if (this.chess.isStalemate()) return { reason: 'stalemate', result: 0.5 };
		if (this.chess.isInsufficientMaterial())
			return { reason: 'insufficient material', result: 0.5 };
		if (this.chess.isThreefoldRepetition()) return { reason: 'repetition', result: 0.5 };
		if (this.chess.isDraw()) return { reason: 'fifty-move rule', result: 0.5 };
		return null;
	}

	/** Records a sighting of the current position, returning the running count. */
	private countPosition(): number {
		const [placement, turn, castling, ep] = this.chess.fen().split(' ');
		const key = `${placement} ${turn} ${castling} ${ep}`;
		const seen = (this.positionCounts.get(key) ?? 0) + 1;
		this.positionCounts.set(key, seen);
		return seen;
	}

	/** Colour whose king is absent from the board, if any. */
	private missingKing(): 'w' | 'b' | null {
		const placement = this.chess.fen().split(' ')[0];
		if (!placement.includes('k')) return 'b';
		if (!placement.includes('K')) return 'w';
		return null;
	}

	/**
	 * Warns while a draw is still avoidable, rather than announcing it after the
	 * fact. Repetition is counted here because chess.js only reports the third
	 * occurrence, by which point the game is already drawn.
	 */
	private assessDrawRisk(): DrawRisk | null {
		const [placement, turn, castling, ep, halfmove] = this.chess.fen().split(' ');

		// Fifty-move rule: 100 half-moves without a capture or pawn move.
		const halfmoveClock = Number(halfmove) || 0;
		if (halfmoveClock >= 80) {
			const movesRemaining = Math.ceil((100 - halfmoveClock) / 2);
			return {
				kind: 'fifty-move',
				movesRemaining,
				message: `${movesRemaining} move${movesRemaining === 1 ? '' : 's'} until a draw — capture or push a pawn`
			};
		}

		// Threefold repetition: warn on the second sighting, while there is still
		// a choice to be made.
		const seen = this.countPosition();

		if (seen === 2) {
			return {
				kind: 'repetition',
				movesRemaining: 1,
				message: 'Repeating — one more and the game is drawn'
			};
		}

		return null;
	}

	private maybePlayOpponent() {
		if (!this.opponent || this.gameOver) return;
		if (this.chess.turn() !== this.opponent.colour) return;
		// Belt and braces: an engine asked to search a kingless position hangs.
		if (this.missingKing()) return;

		const token = this.positionToken;
		const fen = this.chess.fen();
		// Wait out the player's move before replying. The search runs during the
		// wait, so the reply lands the moment the beat is over.
		const delay = this.slowMotion ? SLOW_REPLY_DELAY_MS : NORMAL_REPLY_DELAY_MS;

		const search = this.opponent.getMove(fen);
		const beat = new Promise<void>((resolve) => {
			clearTimeout(this.pendingReply);
			this.pendingReply = setTimeout(resolve, delay);
		});

		Promise.all([search, beat]).then(([lan]) => {
			if (token !== this.positionToken || this.gameOver) return;
			if (!lan) return;
			// The opponent's own move is always snappy, even in slow-motion.
			this.ground.set({ animation: { enabled: true, duration: NORMAL_ANIM_MS } });
			this.applyMove(lan);
			if (this.slowMotion) {
				this.ground.set({ animation: { enabled: true, duration: SLOW_ANIM_MS } });
			}
		});
	}

	/** Only the side the opponent is not playing may be dragged. */
	private playerColour(): 'white' | 'black' | 'both' {
		if (!this.opponent) return 'both';
		return this.opponent.colour === 'w' ? 'black' : 'white';
	}

	private legalDests(): Map<Key, Key[]> {
		const dests = new Map<Key, Key[]>();
		if (this.gameOverDetail()) return dests;

		for (const square of SQUARES) {
			const moves = this.chess.moves({ square, verbose: true }) as Move[];
			if (moves.length) {
				dests.set(
					square as Key,
					moves.map((m) => m.to as Key)
				);
			}
		}
		return dests;
	}

	private isPromotion(from: Square, to: Square): boolean {
		const piece = this.chess.get(from);
		if (!piece || piece.type !== 'p') return false;
		const rank = to.charAt(1);
		return rank === '1' || rank === '8';
	}

	private colourName(c: 'w' | 'b'): 'white' | 'black' {
		return c === 'w' ? 'white' : 'black';
	}

	/** Replaces the position without any game-over or opponent side effects. */
	setFenSilently(fen: string) {
		this.chess.load(fen);
		this.syncGround();
		this.callbacks.onPositionChange?.(this.chess.fen());
	}

	destroy() {
		clearTimeout(this.pendingReply);
		this.opponent?.abort?.();
		this.ground.destroy();
	}
}
