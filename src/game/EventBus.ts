import { Events } from 'phaser';

/**
 * Shared event bus between Phaser scenes and Svelte components.
 */
export const EventBus = new Events.EventEmitter();

export const ChessEvents = {
	/** Load a starting position and engine strength, resetting the board. */
	loadPosition: 'chess:load-position',
	/** Adjust engine strength mid-game, without touching the position. */
	configureEngine: 'chess:configure-engine',
	enPassant: 'chess:en-passant',
	removePiece: 'chess:remove-piece',
	/** Stage reward: put the most recently lost piece back on the board. */
	restorePiece: 'chess:restore-piece',
	resetBoard: 'chess:reset-board',
	/** The game is drifting towards a draw, while it can still be avoided. */
	drawRisk: 'chess:draw-risk',
	/** Enter or leave slow-motion on the board (stretches the player's move). */
	slowMotion: 'chess:slow-motion',
	gameOver: 'chess:game-over'
} as const;

export type ChessEventKey = (typeof ChessEvents)[keyof typeof ChessEvents];
