import { Events } from 'phaser';

/**
 * Shared event bus between Phaser scenes and Svelte components.
 */
export const EventBus = new Events.EventEmitter();

export const ChessEvents = {
	selectDifficulty: 'chess:select-difficulty',
	enPassant: 'chess:en-passant',
	removePiece: 'chess:remove-piece',
	resetBoard: 'chess:reset-board',
	gameOver: 'chess:game-over'
} as const;

export type ChessEventKey = (typeof ChessEvents)[keyof typeof ChessEvents];
