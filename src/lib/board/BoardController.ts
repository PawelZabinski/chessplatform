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
	| 'stalemate'
	| 'insufficient material'
	| 'repetition'
	| 'fifty-move rule';

export interface GameOverDetail {
	reason: GameOverReason;
	/** From White's perspective: 1 win, 0.5 draw, 0 loss. */
	result: 1 | 0.5 | 0;
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
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

		this.chess.load(fen);
		this.gameOver = false;

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

	private maybePlayOpponent() {
		if (!this.opponent || this.gameOver) return;
		if (this.chess.turn() !== this.opponent.colour) return;

		const token = this.positionToken;
		const fen = this.chess.fen();

		this.opponent.getMove(fen).then((lan) => {
			// Discard a reply that arrived after the position moved on.
			if (token !== this.positionToken || this.gameOver) return;
			if (lan) this.applyMove(lan);
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
		this.opponent?.abort?.();
		this.ground.destroy();
	}
}
