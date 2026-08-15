<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ChessBoard from '$lib/ChessBoard.svelte';
	import Hud from '$lib/ui/Hud.svelte';
	import TouchControls from '$lib/ui/TouchControls.svelte';
	import { isTouchDevice } from '$lib/platformer/engine/Input';
	import {
		PlatformerGame,
		type Banner,
		type HudState,
		type RunOutcome,
		type Toast
	} from '$lib/platformer/PlatformerGame';
	import type { BoardHandle } from '$lib/ChessBoard.svelte';
	import { chessState } from '$lib/stores/chess';

	export let mode: 'tower' | 'endless';
	export let floor: number | undefined = undefined;
	export let onEnd: (outcome: RunOutcome) => void;

	let stage: HTMLDivElement;
	let game: PlatformerGame | null = null;
	let board: BoardHandle | null = null;

	let hud: HudState | null = null;
	let banner: Banner | null = null;
	let toasts: Toast[] = [];
	let touch = false;

	/**
	 * The two halves talk only through this object.
	 *
	 * The platformer knows nothing about chess.js or the board, and the board
	 * knows nothing about lava or platforms. This screen is the seam — which is
	 * what will let a multiplayer opponent replace the engine later without the
	 * climb noticing.
	 */
	function makeCallbacks() {
		return {
			onHud: (state: HudState) => (hud = state),
			onBanner: (next: Banner | null) => (banner = next),
			onToast: (toast: Toast) => {
				toasts = [...toasts, toast];
				setTimeout(() => (toasts = toasts.filter((t) => t.id !== toast.id)), 1400);
			},
			onEnd,
			loadPosition: (detail: { fen?: string; engine?: unknown }) => board?.loadPosition(detail),
			configureEngine: (settings: unknown) => board?.configureEngine(settings),
			removePiece: () => board?.removePiece(),
			restorePiece: () => board?.restorePiece(),
			clearSpikesRequested: () => {},
			setBoardSlowMotion: (active: boolean) => board?.setSlowMotion(active)
		};
	}

	onMount(async () => {
		touch = isTouchDevice();
		game = new PlatformerGame(stage, makeCallbacks());
		await game.start({ mode, floor });
	});

	onDestroy(() => game?.destroy());

	function leave() {
		game?.leave(chessState.moveCount());
	}
</script>

<!--
	One page, two parts.

	The climb and the board are siblings, not one embedded in the other: each is
	a self-contained region with its own frame, sharing the same medieval
	furniture so the whole thing reads as a single game. On a phone they stack,
	climb above board, because the board is what you touch.
-->
<div class="play">
	<section class="climb" aria-label="The climb">
		<div class="stage" bind:this={stage}></div>
		<Hud {hud} {toasts} {banner} onLeave={leave} />
		{#if touch}
			<TouchControls input={game?.inputHandle ?? null} />
		{/if}
	</section>

	<section class="board-side" aria-label="The board">
		<div class="board-frame">
			<ChessBoard
				bind:handle={board}
				onMove={(move) => game?.applyMove(move)}
				onEnPassant={() => game?.enPassant()}
				onDrawRisk={(risk) => game?.drawRisk(risk.message)}
				onGameOver={(detail) => game?.gameOver(detail, chessState.moveCount())}
			/>
		</div>
	</section>
</div>

<style>
	.play {
		display: flex;
		height: 100dvh;
		width: 100vw;
		overflow: hidden;
		background: var(--shadow);
	}

	.climb {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.stage {
		position: absolute;
		inset: 0;
		touch-action: none;
	}

	.board-side {
		flex: 0 0 clamp(300px, 30vw, 440px);
		display: grid;
		place-items: center;
		padding: clamp(10px, 2vh, 24px) clamp(10px, 1.5vw, 20px);
		box-sizing: border-box;
		background:
			linear-gradient(180deg, rgba(59, 42, 28, 0.5) 0%, rgba(11, 7, 4, 0.92) 100%),
			var(--shadow);
		border-left: var(--rule);
		box-shadow: inset 18px 0 40px -20px #000;
		min-width: 0;
	}

	.board-frame {
		width: 100%;
		max-width: min(100%, 78dvh);
		padding: clamp(5px, 1vw, 12px);
		box-sizing: border-box;
		background: linear-gradient(160deg, var(--oak-light), var(--oak));
		border: var(--rule);
		box-shadow:
			inset 0 0 0 1px rgba(240, 210, 100, 0.35),
			0 18px 40px -16px #000,
			0 0 60px -18px rgba(201, 162, 39, 0.45);
		touch-action: none;
	}

	@media (orientation: portrait), (max-width: 820px) {
		.play {
			flex-direction: column;
		}

		.climb {
			flex: 1 1 auto;
		}

		.board-side {
			flex: 0 0 auto;
			border-left: none;
			border-top: var(--rule);
			box-shadow: inset 0 18px 40px -22px #000;
			padding: clamp(6px, 1.2vh, 12px) 10px calc(clamp(6px, 1.2vh, 12px) + env(safe-area-inset-bottom));
		}

		.board-frame {
			max-width: min(100%, 46dvh);
		}
	}
</style>
