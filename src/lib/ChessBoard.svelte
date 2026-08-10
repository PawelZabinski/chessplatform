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

	type EngineConfig = { randomMoveProbability?: number; depth?: number; moveTime?: number };

	/**
	 * Deals a position at a given engine strength. Tower floors pass their own
	 * FEN; Endless omits it to start a fresh standard game at the run's current
	 * difficulty tier.
	 */
	function loadPosition(detail: { fen?: string; engine?: EngineConfig }): void {
		if (detail?.engine) {
			engine.configure(detail.engine);
		}
		chessState.reset((newFen) => chessboard?.load(newFen), detail?.fen);
	}

	onMount(() => {
		const removeListener = (colour: Color) => removeRandomPiece(colour);
		const restoreListener = (colour: Color) => restoreFallenPiece(colour);
		const resetListener = () => chessState.reset((newFen) => chessboard?.load(newFen));
		const loadListener = (detail: Parameters<typeof loadPosition>[0]) => loadPosition(detail);
		const configureListener = (settings: EngineConfig) => engine.configure(settings);

		EventBus.on(ChessEvents.removePiece, removeListener);
		EventBus.on(ChessEvents.restorePiece, restoreListener);
		EventBus.on(ChessEvents.resetBoard, resetListener);
		EventBus.on(ChessEvents.loadPosition, loadListener);
		EventBus.on(ChessEvents.configureEngine, configureListener);

		return () => {
			EventBus.off(ChessEvents.removePiece, removeListener);
			EventBus.off(ChessEvents.restorePiece, restoreListener);
			EventBus.off(ChessEvents.resetBoard, resetListener);
			EventBus.off(ChessEvents.loadPosition, loadListener);
			EventBus.off(ChessEvents.configureEngine, configureListener);
		};
	});
</script>

<Chess bind:this={chessboard} on:move={handleMove} on:gameOver={handleGameOver} {engine} />
