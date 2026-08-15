<script lang="ts" context="module">
	import type { DrawRisk, GameOverDetail } from '$lib/board/BoardController';
	import type { Move } from 'chess.js';

	/**
	 * What the rest of the app may ask of the board.
	 *
	 * The board is one of the two halves of the game and knows nothing about the
	 * climb: no lava, no platforms, no score. Everything flows through this
	 * handle and the callback props, which is what keeps the two parts genuinely
	 * separable — and is the same seam a networked opponent will plug into.
	 */
	export interface BoardHandle {
		loadPosition(detail: { fen?: string; engine?: unknown }): void;
		configureEngine(settings: unknown): void;
		removePiece(colour?: 'w' | 'b'): void;
		restorePiece(colour?: 'w' | 'b'): void;
		setSlowMotion(active: boolean): void;
		reset(): void;
	}

	export type { Move, DrawRisk, GameOverDetail };
</script>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { BoardController, type MoveProvider } from '$lib/board/BoardController';
	import { Engine } from '$lib/engine';
	import { chessState } from '$lib/stores/chess';

	// Board layout and the cburnett piece set come from chessground itself.
	// The square pattern must come from the library: it ships as a pixel-exact
	// embedded SVG, and hand-rolling it with CSS gradients produced squares that
	// did not line up with the pieces. Only interaction colours are overridden,
	// which is safe because those tint individual squares, not board geometry.
	import 'chessground-assets/chessground.base.css';
	import 'chessground-assets/chessground.brown.css';
	import 'chessground-assets/chessground.cburnett.css';

	export let onMove: (move: Move) => void = () => {};
	export let onGameOver: (detail: GameOverDetail) => void = () => {};
	export let onDrawRisk: (risk: DrawRisk) => void = () => {};
	export let onEnPassant: () => void = () => {};
	export let handle: BoardHandle | null = null;

	type EngineConfig = {
		randomMoveProbability?: number;
		depth?: number;
		moveTime?: number;
		skillLevel?: number;
	};

	let boardElement: HTMLDivElement;
	let controller: BoardController | null = null;

	const engine = new Engine();

	const engineOpponent: MoveProvider = {
		colour: 'b',
		getMove: (fen) => engine.getMove(fen),
		abort: () => {
			if (engine.isSearching()) void engine.stopSearch();
		}
	};

	onMount(() => {
		controller = new BoardController(boardElement, {
			onMove: (move) => {
				chessState.addMove(move);
				if (move.flags.includes('e')) onEnPassant();
				onMove(move);
			},
			onPositionChange: (fen) => chessState.setFen(fen),
			onGameOver: (detail) => onGameOver(detail),
			onDrawRisk: (risk) => onDrawRisk(risk)
		});
		controller.setOpponent(engineOpponent);

		handle = {
			loadPosition: (detail) => {
				if (detail?.engine) engine.configure(detail.engine as EngineConfig);
				chessState.clearHistory();
				// Safe to call from a game-over handler: BoardController reports
				// game-over only once the board has fully settled.
				controller?.load(detail?.fen);
			},
			configureEngine: (settings) => engine.configure(settings as EngineConfig),
			removePiece: (colour = 'w') =>
				chessState.removeRandomPiece(colour, (fen) => controller?.setFenSilently(fen)),
			restorePiece: (colour = 'w') => {
				chessState.restoreFallenPiece(colour, (fen) => controller?.setFenSilently(fen));
			},
			setSlowMotion: (active) => controller?.setSlowMotion(active),
			reset: () => {
				chessState.clearHistory();
				controller?.reset();
			}
		};

		void engine.init().then(() => controller?.load());
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
		background: radial-gradient(
			rgba(201, 162, 39, 0.65) 22%,
			#c9a227 0,
			rgba(0, 0, 0, 0.25) 0,
			transparent 0
		);
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

	.board :global(.cg-wrap coords coord) {
		font-family: 'Cinzel', Georgia, serif;
		font-size: 9px;
	}
</style>
