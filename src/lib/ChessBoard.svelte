<script lang="ts">
    import { onMount } from 'svelte';
	import { Chess, type GameOverEvent, type MoveEvent } from 'svelte-chess';
	import { Engine } from '$lib/engine';
	import { moves, chessState, handlePieceRemovalFunction } from '$lib/stores/chess';

    let chessboard;
	const engine = new Engine({ depth: 1, randomMoveProbability: 0.5 });

	function handleMove(event: MoveEvent) {
		chessState.addMove(event.detail);
	}

	function handleGameOver(event: GameOverEvent) {
		console.log('Game over');
		console.log(event.detail);
	}

    function removeRandomPiece() {
        chessState.removeRandomPiece(newFen => chessboard.load(newFen))
    }

    onMount(() => handlePieceRemovalFunction.set(removeRandomPiece))
</script>

<Chess 
    bind:this={chessboard}
	on:move={handleMove}
	on:gameOver={handleGameOver}
	engine={engine}
/>