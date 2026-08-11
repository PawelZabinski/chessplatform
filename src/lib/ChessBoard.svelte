<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { BoardController, type MoveProvider } from '$lib/board/BoardController';
	import { Engine } from '$lib/engine';
	import { chessState } from '$lib/stores/chess';
	import { ChessEvents, EventBus } from '../game/EventBus';

	// All three stylesheets come from chessground itself (aliased in vite config —
	// see the note there): structural layout, the brown board, and the cburnett
	// piece set.
	//
	// The board pattern in particular must come from the library. It ships as a
	// pixel-exact embedded SVG; an earlier attempt to hand-roll the checkerboard
	// with CSS gradients produced squares that did not line up with the pieces.
	// Only interaction colours are overridden below, which is safe because they
	// tint individual <square> elements rather than the board geometry.
	import 'chessground-assets/chessground.base.css';
	import 'chessground-assets/chessground.brown.css';
	import 'chessground-assets/chessground.cburnett.css';

	type EngineConfig = {
		randomMoveProbability?: number;
		depth?: number;
		moveTime?: number;
		skillLevel?: number;
	};

	let boardElement: HTMLDivElement;
	let controller: BoardController | null = null;

	const engine = new Engine();

	/** Adapts the Stockfish engine to the board's opponent interface. */
	const engineOpponent: MoveProvider = {
		colour: 'b',
		getMove: (fen) => engine.getMove(fen),
		abort: () => {
			if (engine.isSearching()) void engine.stopSearch();
		}
	};

	function loadPosition(detail: { fen?: string; engine?: EngineConfig }) {
		if (detail?.engine) engine.configure(detail.engine);
		// Safe to call straight from a game-over handler: BoardController reports
		// game-over only once the board has been fully settled.
		controller?.load(detail?.fen);
	}

	onMount(() => {
		controller = new BoardController(boardElement, {
			onMove: (move) => {
				chessState.addMove(move);
				if (move.flags.includes('e')) EventBus.emit(ChessEvents.enPassant);
			},
			onPositionChange: (fen) => chessState.setFen(fen),
			onGameOver: (detail) => EventBus.emit(ChessEvents.gameOver, detail)
		});
		controller.setOpponent(engineOpponent);

		void engine.init().then(() => controller?.load());

		const removeListener = (colour: 'w' | 'b' = 'w') =>
			chessState.removeRandomPiece(colour, (fen) => controller?.setFenSilently(fen));
		const restoreListener = (colour: 'w' | 'b' = 'w') =>
			chessState.restoreFallenPiece(colour, (fen) => controller?.setFenSilently(fen));
		const resetListener = () => {
			chessState.clearHistory();
			controller?.reset();
		};
		const loadListener = (detail: Parameters<typeof loadPosition>[0]) => {
			chessState.clearHistory();
			loadPosition(detail);
		};
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

	onDestroy(() => controller?.destroy());
</script>

<div class="board" bind:this={boardElement}></div>

<style>
	/* chessground sizes itself to its container and requires a square box. */
	.board {
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	/* Gold for anything the player can act on. */
	.board :global(cg-board square.move-dest) {
		background: radial-gradient(rgba(201, 162, 39, 0.65) 22%, #c9a227 0, rgba(0, 0, 0, 0.25) 0, transparent 0);
	}
	.board :global(cg-board square.oc.move-dest) {
		background: radial-gradient(transparent 0%, transparent 80%, rgba(201, 162, 39, 0.5) 80%);
	}
	.board :global(cg-board square.move-dest:hover) {
		background: rgba(201, 162, 39, 0.35);
	}
	.board :global(cg-board square.selected) {
		background-color: rgba(201, 162, 39, 0.5);
	}
	.board :global(cg-board square.last-move) {
		background-color: rgba(240, 210, 100, 0.35);
	}
	.board :global(cg-board square.check) {
		background: radial-gradient(
			ellipse at center,
			rgba(200, 40, 30, 0.95) 0%,
			rgba(160, 25, 20, 0.75) 30%,
			transparent 80%
		);
	}

	/* Coordinates in the game's serif; chessground supplies their colours. */
	.board :global(.cg-wrap coords coord) {
		font-family: 'Cinzel', Georgia, serif;
		font-size: 9px;
	}
</style>
