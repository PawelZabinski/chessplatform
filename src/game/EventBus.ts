import { Events } from 'phaser';

/**
 * Shared event bus between Phaser scenes and Svelte components.
 */
export const EventBus = new Events.EventEmitter();

export const ChessEvents = {
	selectDifficulty: 'chess:select-difficulty',
	/** Load a specific starting position and engine strength (tower floors). */
	loadPosition: 'chess:load-position',
	enPassant: 'chess:en-passant',
	removePiece: 'chess:remove-piece',
	/** Stage reward: put the most recently lost piece back on the board. */
	restorePiece: 'chess:restore-piece',
	resetBoard: 'chess:reset-board',
	gameOver: 'chess:game-over'
} as const;

export type ChessEventKey = (typeof ChessEvents)[keyof typeof ChessEvents];
