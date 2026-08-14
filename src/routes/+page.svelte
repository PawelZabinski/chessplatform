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

    // On small screens the title and hints are dropped entirely — screen space
    // goes to the board and the climb. They live behind this instead.
    let showInfo = false;
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

        <button
            class="info-toggle"
            type="button"
            aria-label="How to play"
            aria-expanded={showInfo}
            on:click={() => (showInfo = !showInfo)}
        >
            {showInfo ? '\u00d7' : 'i'}
        </button>
    </section>

    {#if showInfo}
        <button class="info-scrim" type="button" aria-label="Close" on:click={() => (showInfo = false)}
        ></button>
        <aside class="info-panel" role="dialog" aria-label="How to play">
            <h2>ChessPlatform</h2>
            <p class="lede">Your moves on the board are the climb.</p>
            <ul>
                <li><b>Captures lift you</b> — the bigger the piece, the higher the leap.</li>
                <li><b>Files steer</b> you left and right; ranks are irrelevant.</li>
                <li><b>Gold runes</b> grant 5s of direct control, stacking to 10s.</li>
                <li><b>Wooden planks</b> can be jumped through; grey stone cannot.</li>
                <li><b>Climbing charges slow-motion</b> — spend it to buy thinking time.</li>
                <li><b>Stalling burns you.</b> The lava never stops rising.</li>
            </ul>
            <button type="button" class="info-close" on:click={() => (showInfo = false)}>Close</button>
        </aside>
    {/if}

    <div id="phaser-game">
        <PhaserGame bind:phaserRef={phaserRef} currentActiveScene={currentScene} />
    </div>
</div>

<style>
	/*
	 * Responsive layout.
	 *
	 * Desktop and landscape tablets read left-to-right: board beside the climb.
	 * Portrait and phones stack instead, with the PLATFORMER ON TOP and the board
	 * beneath — the board is what you touch, so it belongs under your thumbs,
	 * and the climb is what you watch, so it belongs where your eyes are.
	 *
	 * `dvh` rather than `vh` because mobile browser chrome slides in and out; vh
	 * would leave the board cropped behind the address bar.
	 */
	#app {
		display: flex;
		height: 100dvh;
		width: 100vw;
		align-items: stretch;
		overflow: hidden;
	}

	.info-toggle {
		display: none;
	}

	#chessboard-section {
		position: relative;
		flex: 0 0 clamp(300px, 30vw, 440px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(8px, 2vh, 22px);
		padding: clamp(10px, 2vh, 24px) clamp(10px, 1.5vw, 20px);
		box-sizing: border-box;
		background:
			linear-gradient(180deg, rgba(59, 42, 28, 0.55) 0%, rgba(11, 7, 4, 0.9) 100%),
			var(--shadow);
		border-right: 2px solid var(--gold);
		box-shadow: inset -18px 0 40px -20px #000, 6px 0 30px -8px #000;
		min-width: 0;
	}

	.board-header {
		text-align: center;
	}

	.board-header h1 {
		margin: 0;
		font-family: 'Cinzel Decorative', 'Cinzel', Georgia, serif;
		font-weight: 900;
		font-size: clamp(18px, 2.2vw, 30px);
		letter-spacing: 0.04em;
		color: var(--gold-bright);
		text-shadow: 0 2px 0 #1a1109, 0 0 22px rgba(201, 162, 39, 0.35);
	}

	.board-header p {
		margin: 6px 0 0;
		font-size: clamp(10px, 1vw, 13px);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgba(232, 216, 176, 0.62);
	}

	/* Oak frame with a gold inner rule, matching the Phaser panels. */
	#chessboard {
		width: 100%;
		max-width: min(100%, 78dvh);
		padding: clamp(5px, 1vw, 12px);
		box-sizing: border-box;
		background: linear-gradient(160deg, var(--oak-light), var(--oak));
		border: 2px solid var(--gold);
		border-radius: 3px;
		box-shadow:
			inset 0 0 0 1px rgba(240, 210, 100, 0.35),
			0 18px 40px -16px #000,
			0 0 60px -18px rgba(201, 162, 39, 0.5);
		/* The board handles its own gestures; stop the page panning under them. */
		touch-action: none;
	}

	.board-footer {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: clamp(10px, 1vw, 13px);
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
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: none;
	}

	/*
	 * Portrait and phones: stack, climb on top, board underneath.
	 * column-reverse keeps the board first in the DOM (so it stays the primary
	 * content for assistive tech) while drawing it last.
	 */
	@media (orientation: portrait), (max-width: 820px) {
		#app {
			flex-direction: column-reverse;
		}

		#chessboard-section {
			flex: 0 0 auto;
			border-right: none;
			border-top: 2px solid var(--gold);
			box-shadow: inset 0 18px 40px -22px #000, 0 -6px 30px -8px #000;
			padding: clamp(6px, 1.2vh, 14px) 10px calc(clamp(6px, 1.2vh, 14px) + env(safe-area-inset-bottom));
			gap: clamp(4px, 1vh, 10px);
		}

		/* The board is the touch target, so it gets the space it needs — but
		   never more than half the screen, or there is nothing left to climb. */
		#chessboard {
			max-width: min(100%, 46dvh);
		}

		/* Screen space is scarce: the title and hint lines go entirely, and the
		   info button carries them instead. */
		.board-header,
		.board-footer {
			display: none;
		}

		.info-toggle {
			display: grid;
			place-items: center;
			position: absolute;
			top: 8px;
			right: 8px;
			z-index: 3;
			width: 30px;
			height: 30px;
			border-radius: 50%;
			border: 1px solid var(--gold);
			background: rgba(59, 42, 28, 0.85);
			color: var(--gold-bright);
			font-family: 'Cinzel', Georgia, serif;
			font-size: 15px;
			line-height: 1;
			cursor: pointer;
			padding: 0;
		}

		#phaser-game {
			flex: 1 1 auto;
		}
	}

	/* Landscape phones are just as tight vertically. */
	@media (orientation: landscape) and (max-height: 520px) {
		.info-toggle {
			display: grid;
			place-items: center;
			position: absolute;
			top: 6px;
			right: 6px;
			z-index: 3;
			width: 28px;
			height: 28px;
			border-radius: 50%;
			border: 1px solid var(--gold);
			background: rgba(59, 42, 28, 0.85);
			color: var(--gold-bright);
			font-family: 'Cinzel', Georgia, serif;
			font-size: 14px;
			line-height: 1;
			cursor: pointer;
			padding: 0;
		}
	}

	.info-scrim {
		position: fixed;
		inset: 0;
		z-index: 8;
		border: 0;
		padding: 0;
		background: rgba(11, 7, 4, 0.72);
		cursor: pointer;
	}

	.info-panel {
		position: fixed;
		z-index: 9;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(420px, calc(100vw - 40px));
		max-height: min(78dvh, 560px);
		overflow-y: auto;
		box-sizing: border-box;
		padding: 20px 22px 18px;
		background: linear-gradient(160deg, #efe2c0, #e0cfa6);
		border: 2px solid var(--gold);
		box-shadow: 0 24px 60px -20px #000;
		color: var(--ink);
		font-family: 'Cinzel', Georgia, serif;
	}

	.info-panel h2 {
		margin: 0 0 4px;
		font-family: 'Cinzel Decorative', 'Cinzel', Georgia, serif;
		font-size: 22px;
		color: #7b2230;
	}

	.info-panel .lede {
		margin: 0 0 14px;
		font-size: 14px;
		color: #57432e;
	}

	.info-panel ul {
		margin: 0;
		padding-left: 18px;
		font-size: 14px;
		line-height: 1.65;
	}

	.info-panel li {
		margin-bottom: 4px;
	}

	.info-close {
		margin-top: 18px;
		width: 100%;
		padding: 10px;
		border: 2px solid var(--gold);
		background: #7b2230;
		color: #efe2c0;
		font-family: 'Cinzel', Georgia, serif;
		font-size: 15px;
		cursor: pointer;
	}

	/* Very short landscape (phones turned sideways): trim the board chrome. */
	@media (orientation: landscape) and (max-height: 520px) {
		.board-header p,
		.board-footer {
			display: none;
		}

		#chessboard-section {
			flex: 0 0 clamp(200px, 34vw, 320px);
		}
	}
</style>
