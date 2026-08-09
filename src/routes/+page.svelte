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
        <header class="board-header">
            <h1>ChessPlatform</h1>
            <p>your moves are the climb</p>
        </header>

        <div id="chessboard">
            <ChessBoard/>
        </div>

        <footer class="board-footer">
            <span><b>files</b> steer</span>
            <span class="sep">·</span>
            <span><b>ranks</b> lift</span>
        </footer>
    </section>

    <div id="phaser-game">
        <PhaserGame bind:phaserRef={phaserRef} currentActiveScene={currentScene} />
    </div>
</div>

<style>
    #app {
        display: flex;
        justify-content: center;
        align-items: stretch;
        height: 100vh;
        width: 100vw;
    }

    /* Left column: the board, presented as a lit alcove in a dark hall. */
    #chessboard-section {
        flex: 0 0 440px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        padding: 24px 20px;
        box-sizing: border-box;
        background:
            linear-gradient(180deg, rgba(59, 42, 28, 0.55) 0%, rgba(11, 7, 4, 0.9) 100%),
            var(--shadow);
        border-right: 2px solid var(--gold);
        box-shadow: inset -18px 0 40px -20px #000, 6px 0 30px -8px #000;
    }

    .board-header {
        text-align: center;
    }

    .board-header h1 {
        margin: 0;
        font-family: 'Cinzel Decorative', 'Cinzel', Georgia, serif;
        font-weight: 900;
        font-size: 30px;
        letter-spacing: 0.04em;
        color: var(--gold-bright);
        text-shadow: 0 2px 0 #1a1109, 0 0 22px rgba(201, 162, 39, 0.35);
    }

    .board-header p {
        margin: 6px 0 0;
        font-size: 13px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(232, 216, 176, 0.62);
    }

    /* Oak frame with a gold inner rule, matching the Phaser panels. */
    #chessboard {
        width: 100%;
        padding: 12px;
        box-sizing: border-box;
        background: linear-gradient(160deg, var(--oak-light), var(--oak));
        border: 2px solid var(--gold);
        border-radius: 3px;
        box-shadow:
            inset 0 0 0 1px rgba(240, 210, 100, 0.35),
            0 18px 40px -16px #000,
            0 0 60px -18px rgba(201, 162, 39, 0.5);
    }

    .board-footer {
        display: flex;
        gap: 10px;
        align-items: center;
        font-size: 13px;
        letter-spacing: 0.08em;
        color: rgba(232, 216, 176, 0.6);
    }

    .board-footer b {
        color: var(--gold-bright);
        font-weight: 600;
    }

    .board-footer .sep {
        color: rgba(201, 162, 39, 0.5);
    }

    #phaser-game {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
