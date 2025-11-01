<script>
    import { Chess } from 'svelte-chess';
    import { Engine } from "$lib/engine.js";
    import { moves } from '$lib/stores/chess';
    
    function handleMove(event) {
        moves.add(event.detail)
    }

    function handleGameOver(event) {

    }
</script>    
<Chess 
    on:move={handleMove} on:gameOver={handleGameOver}
    engine={new Engine({depth: 20, moveTime: 1500, color: 'b'})}
/>