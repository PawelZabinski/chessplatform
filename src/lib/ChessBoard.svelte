<script lang="ts">
	import { Chess, type GameOverEvent, type MoveEvent } from 'svelte-chess';
	import { Engine } from '$lib/engine';
	import { moves } from '$lib/stores/chess';

	const engine = new Engine({ depth: 1, randomMoveProbability: 1 });

	function handleMove(event: MoveEvent) {
		moves.add(event.detail);
	}

	function handleGameOver(event: GameOverEvent) {
		console.log('Game over');
		console.log(event.detail);
	}
</script>

<Chess 
	on:move={handleMove}
	on:gameOver={handleGameOver}
	engine={engine}
/>
