<script lang="ts">
	import { onMount } from 'svelte';
	import { Chess, type GameOverEvent, type MoveEvent } from 'svelte-chess';
	import { Engine } from '$lib/engine';
	import type { Color } from 'svelte-chess';
	import { chessState } from '$lib/stores/chess';
	import { ChessEvents, EventBus } from '../game/EventBus';

	let chessboard: InstanceType<typeof Chess> | null = null;
	let engine = new Engine();

	function handleMove(event: MoveEvent): void {
		const move = event.detail;
		chessState.addMove(move);

		if (move.flags.includes('e')) {
			EventBus.emit(ChessEvents.enPassant);
		}
	}

	function handleGameOver(event: GameOverEvent): void {
		EventBus.emit(ChessEvents.gameOver, event.detail);
	}

	function removeRandomPiece(colour: Color = 'w'): void {
		chessState.removeRandomPiece(colour, (newFen) => chessboard?.load(newFen));
	}

	function restoreFallenPiece(colour: Color = 'w'): void {
		chessState.restoreFallenPiece(colour, (newFen) => chessboard?.load(newFen));
	}

	/**
	 * Tower floors drop the player into an existing position with their own
	 * engine strength, rather than a fresh game at a global difficulty.
	 */
	function loadPosition(detail: {
		fen: string;
		engine?: { randomMoveProbability?: number; depth?: number; moveTime?: number };
	}): void {
		if (detail?.engine) {
			engine.configure(detail.engine);
		}
		chessState.reset((newFen) => chessboard?.load(newFen), detail.fen);
	}

	onMount(() => {
		const removeListener = (colour: Color) => removeRandomPiece(colour);
		const restoreListener = (colour: Color) => restoreFallenPiece(colour);
		const resetListener = () => chessState.reset((newFen) => chessboard?.load(newFen));
		const loadListener = (detail: Parameters<typeof loadPosition>[0]) => loadPosition(detail);

		EventBus.on(ChessEvents.removePiece, removeListener);
		EventBus.on(ChessEvents.restorePiece, restoreListener);
		EventBus.on(ChessEvents.resetBoard, resetListener);
		EventBus.on(ChessEvents.loadPosition, loadListener);

		return () => {
			EventBus.off(ChessEvents.removePiece, removeListener);
			EventBus.off(ChessEvents.restorePiece, restoreListener);
			EventBus.off(ChessEvents.resetBoard, resetListener);
			EventBus.off(ChessEvents.loadPosition, loadListener);
		};
	});
</script>

<Chess bind:this={chessboard} on:move={handleMove} on:gameOver={handleGameOver} {engine} />
