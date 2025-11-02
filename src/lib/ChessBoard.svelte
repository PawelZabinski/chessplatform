<script lang="ts">
	import { onMount } from 'svelte';
	import { Chess, type GameOverEvent, type MoveEvent } from 'svelte-chess';
	import { Engine } from '$lib/engine';
	import { chessState, handlePieceRemovalFunction } from '$lib/stores/chess';

	let chessboard: InstanceType<typeof Chess> | null = null;
	const engine = new Engine({ depth: 1, randomMoveProbability: 0.5 });

	function handleMove(event: MoveEvent): void {
        const move = event.detail;
		chessState.addMove(move);

        // Check if move was an en passant (TODO: Add extra score - maybe add 10 score)
        if (move.flags.includes("e")) {
            console.log("EN PASSANT")
        }
	}

	function handleGameOver(event: GameOverEvent): void {
		console.log('Game over');
		console.log(event.detail);
	}

	function removeRandomPiece(colour): void {
		chessState.removeRandomPiece(colour, (newFen) => {
			chessboard?.load(newFen);
		});
	}

	onMount(() => {
		handlePieceRemovalFunction.set(removeRandomPiece);
		return () => handlePieceRemovalFunction.clear();
	});
</script>

<Chess 
	bind:this={chessboard}
	on:move={handleMove}
	on:gameOver={handleGameOver}
	engine={engine}
/>