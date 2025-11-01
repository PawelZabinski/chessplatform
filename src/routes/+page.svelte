<script lang="ts">

    import type { Scene } from "phaser";
    import ChessBoard from "$lib/ChessBoard.svelte";
    import PhaserGame, { type TPhaserRef } from "../PhaserGame.svelte";

    // The sprite can only be moved in the MainMenu Scene
    let canMoveSprite = false;

    //  References to the PhaserGame component (game and scene are exposed)
    let phaserRef: TPhaserRef = { game: null, scene: null};

    // Event emitted from the PhaserGame component
    const currentScene = (scene: Scene) => {
        canMoveSprite = (scene.scene.key !== "Main");
    }

</script>

<div id="app">
    <section id="chessboard-section">
        <div id="chessboard">
            <ChessBoard/>
        </div>
    </section>

    <div id="phaser-game">
        <PhaserGame bind:phaserRef={phaserRef} currentActiveScene={currentScene} />
    </div>
</div>

<style>
    #app {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        width: 100vw;
    }

    #chessboard-section {
        height: 100vh;
        width: 400px;
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(0, 0, 0, 0.87);
    }

    #chessboard {
        width: 100%;
    }

    #phaser-game {
        width: 70%;
    }
</style>
