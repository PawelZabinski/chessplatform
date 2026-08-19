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
	import { matchState, onMatchEvent } from '$lib/stores/match';
	import { colourFor } from '$game/multiplayer/palette';
	import { goto } from '$lib/stores/app';
	import { log } from '$lib/diagnostics';

	export let mode: 'tower' | 'endless' | 'match';
	export let floor: number | undefined = undefined;
	export let onEnd: (outcome: RunOutcome) => void;

	let stage: HTMLDivElement;
	let game: PlatformerGame | null = null;
	let board: BoardHandle | null = null;

	let hud: HudState | null = null;
	let banner: Banner | null = null;
	let toasts: Toast[] = [];
	let touch = false;
	let stopMatch: (() => void) | null = null;
	let cooldownTimer: ReturnType<typeof setTimeout> | undefined;

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
			setBoardSlowMotion: (active: boolean) => board?.setSlowMotion(active),
			// Only a match cares where we are; single player has nobody to tell.
			reportHeight:
				mode === 'match' ? (bands: number) => matchState.reportHeight(bands, 0) : undefined
		};
	}

	/**
	 * Connects the running climb to the match.
	 *
	 * This is the piece that makes multiplayer actually multiplayer: without it
	 * the lobby seats everyone correctly, the server runs the match correctly,
	 * and each player then plays an ordinary single-player game in isolation —
	 * which is exactly what it looked like.
	 *
	 * Two quite different jobs, depending on the format. In a race everybody
	 * plays the engine and all that is shared is height, so the only wiring is
	 * rivals in and heights out. In a duel the board itself is shared: the local
	 * engine is removed entirely, our moves become intents, and the server's
	 * MoveApplied is what actually moves the pieces.
	 */
	function connectMatch() {
		const state = matchState.current;
		if (!state.game) {
			log.warn('net', 'Match screen opened with no game dealt');
			return () => {};
		}

		const seat = state.seat;
		const shared = state.game.shared === true;

		if (shared && seat) board?.setRealTime(state.game.youPlay);

		// Our own frog wears our seat's colour, so "everyone is a different
		// colour" is true of the climber you are actually looking at as well.
		const me = state.players.find((p) => p.seat === seat);
		if (me) game?.setPlayerColour(colourFor(me.colour).hue);

		// Everyone already in the room, drawn from the first frame rather than
		// waiting for their first height report.
		syncRivals();

		const off = onMatchEvent((message) => {
			switch (message.t) {
				case 'heights':
					syncRivals();
					break;

				case 'moveApplied': {
					if (!shared) break;
					if (message.by === seat) {
						// Our own move: already on the board optimistically. Trust the
						// server's position over ours and start the cooldown.
						board?.resync(message.fen);
						startCooldown();
					} else {
						// Read live, not from the capture above: a re-deal swaps
						// colours, and a stale copy would apply the opponent's move as
						// our own side.
						const mine = matchState.current.game?.youPlay ?? 'w';
						board?.applyRemote(message.lan, mine === 'w' ? 'b' : 'w');
					}
					break;
				}

				case 'error':
					// A rejected move leaves our optimistic board ahead of the server's.
					if (message.code === 'badMove' && message.fen) board?.resync(message.fen);
					if (message.code === 'cooldown') startCooldown(message.retryInMs);
					break;

				case 'gameStart':
					board?.loadPosition({ fen: message.fen });
					if (shared) board?.setRealTime(message.youPlay);
					game?.matchGameDealt();
					break;

				case 'matchEnded':
					game?.matchOver(
						message.winner === seat
							? 'You reached the crown first.'
							: message.winner
								? 'A rival reached the crown first.'
								: 'The match ended.',
						message.winner === seat ? 1 : 0
					);
					break;
			}
		});

		return () => {
			off();
			clearTimeout(cooldownTimer);
		};
	}

	/** Mirrors every other player's reported height into the climb. */
	function syncRivals() {
		const state = matchState.current;
		if (!game) return;
		for (const player of state.players) {
			if (player.seat === state.seat) continue;
			const palette = colourFor(player.colour);
			game.setRival(
				player.seat,
				player.displayName,
				palette.hue,
				palette.css,
				state.heights[player.seat] ?? 0,
				player.colour
			);
		}
	}

	/**
	 * Locks the board for the cooldown.
	 *
	 * Driven locally for responsiveness but never trusted: the server rejects an
	 * early move regardless, and its `retryInMs` re-arms this timer so the two
	 * cannot drift apart.
	 */
	function startCooldown(ms?: number) {
		const wait = ms ?? matchState.current.config?.moveCooldownMs ?? 0;
		clearTimeout(cooldownTimer);
		if (wait <= 0) return;
		board?.setCooling(true);
		cooldownTimer = setTimeout(() => board?.setCooling(false), wait);
	}

	function sendIntent(lan: string, fen: string) {
		const state = matchState.current;
		matchState.sendMove(lan, state.game?.gameIndex ?? 0, fen);
	}

	onMount(async () => {
		touch = isTouchDevice();
		game = new PlatformerGame(stage, makeCallbacks());
		await game.start({ mode, floor });
		if (mode === 'match') stopMatch = connectMatch();
	});

	onDestroy(() => {
		stopMatch?.();
		game?.destroy();
		if (mode === 'match') matchState.leave();
	});

	function leave() {
		if (mode === 'match') matchState.resign();
		game?.leave(chessState.moveCount());
	}

	// A match that ends while the lobby is gone still has to go somewhere.
	$: if (mode === 'match' && $matchState.status === 'disconnected') {
		goto({ name: 'menu' });
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
		<!-- Before the HUD, so the HUD's own buttons win the hit test. -->
		{#if touch}
			<TouchControls input={game?.inputHandle ?? null} {hud} />
		{/if}
		<Hud {hud} {toasts} {banner} {touch} onLeave={leave} />
	</section>

	<section class="board-side mv-backdrop" aria-label="The board">
		<div class="board-frame">
			<ChessBoard
				bind:handle={board}
				onMove={(move) => game?.applyMove(move)}
				onEnPassant={() => game?.enPassant()}
				onDrawRisk={(risk) => game?.drawRisk(risk.message)}
				onGameOver={(detail) => game?.gameOver(detail, chessState.moveCount())}
				onIntent={mode === 'match' ? sendIntent : null}
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
		/* A soft seam rather than a hard gold rule: the two halves are distinct
		   regions of one page, not two framed boxes. */
		border-left: 1px solid rgba(201, 162, 39, 0.28);
		box-shadow: inset 22px 0 46px -26px #000;
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
			border-top: 1px solid rgba(201, 162, 39, 0.28);
			box-shadow: inset 0 22px 46px -26px #000;
			padding: clamp(6px, 1.2vh, 12px) 10px calc(clamp(6px, 1.2vh, 12px) + env(safe-area-inset-bottom));
		}

		.board-frame {
			max-width: min(100%, 46dvh);
		}
	}
</style>
