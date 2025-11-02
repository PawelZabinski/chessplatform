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

		// Check if move was an en passant
		if (move.flags.includes('e')) {
			EventBus.emit(ChessEvents.enPassant)
		}
	}

	function handleGameOver(event: GameOverEvent): void {
		EventBus.emit(ChessEvents.gameOver, event.detail);
	}

	function removeRandomPiece(colour: Color = 'w'): void {
		chessState.removeRandomPiece(colour, (newFen) => {
			chessboard?.load(newFen);
		});
	}

	onMount(() => {
		const removeListener = colour => removeRandomPiece(colour);
		EventBus.on(ChessEvents.removePiece, removeListener);

        const resetListener = () => chessState.reset(newFen => chessboard?.load(newFen))
        EventBus.on(ChessEvents.resetBoard, resetListener)

		return () => {
			EventBus.off(ChessEvents.removePiece, removeListener);
            EventBus.off(ChessEvents.resetBoard, resetListener)
		};
	});
</script>

<Chess 
	bind:this={chessboard}
	on:move={handleMove}
	on:gameOver={handleGameOver}
	engine={engine}
/>
