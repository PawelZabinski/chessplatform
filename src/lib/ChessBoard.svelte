<script>
    import { Chess } from 'svelte-chess';
    import { Engine } from "$lib/engine.js";
    import { moves } from '$lib/stores/chess';
    
    function handleMove(event) {
        moves.add(event.detail)
    }

    function handleGameOver(event) {
        console.log("Game over")
        console.log(event.detail)
    }
</script>    
<Chess 
    on:move={handleMove} on:gameOver={handleGameOver}
    engine={new Engine({ depth: 1, randomMoveProbability: 0.4 })}
/>