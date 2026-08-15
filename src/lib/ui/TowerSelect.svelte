<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { TOTAL_FLOORS, TOWER, type TowerFloor } from '$game/levels';
	import { themeForWing } from '$game/world/themes';
	import { towerProgress } from '$lib/stores/progress';
	import { goto } from '$lib/stores/app';
	import Modal from './Modal.svelte';

	/**
	 * The tower, drawn as a tower.
	 *
	 * Floors are stacked in a single scrolling shaft with floor 1 at the bottom
	 * and the crown at the top, so climbing it means scrolling up — the same
	 * gesture as the game itself. Each storey is a slab of its wing's masonry,
	 * which makes the four wings read as bands of different stone rather than as
	 * four separate lists.
	 */
	const floors = [...TOWER].reverse(); // top of the tower first in the DOM
	let shaft: HTMLDivElement;
	let hovered: TowerFloor | null = null;
	let showKey = false;

	$: progress = $towerProgress;
	$: cleared = Object.keys(progress).length;
	$: nextFloor = towerProgress.highestUnlocked();

	function open(floor: TowerFloor) {
		if (!towerProgress.isUnlocked(floor.floor)) return;
		goto({ name: 'play', mode: 'tower', floor: floor.floor });
	}

	/** Wing colours come from the same theme table the game builds from. */
	function wingTint(floor: TowerFloor) {
		const theme = themeForWing(floor.wing);
		return `${theme.stone.base}`;
	}

	function wingEdge(floor: TowerFloor) {
		return themeForWing(floor.wing).stone.dark;
	}

	// Open on the floor you are actually up to, rather than at the crown.
	onMount(async () => {
		await tick();
		const target = shaft?.querySelector<HTMLElement>(`[data-floor="${nextFloor}"]`);
		target?.scrollIntoView({ block: 'center' });
	});
</script>

<div class="screen">
	<header class="top">
		<h1 class="mv-title">The Tower</h1>
		<p class="mv-caption">{cleared} of {TOTAL_FLOORS} floors cleared</p>
		<div class="actions">
			<button class="chip" on:click={() => (showKey = true)}>What the marks mean</button>
			<button class="chip crimson" on:click={() => goto({ name: 'menu' })}>Return to Gate</button>
		</div>
	</header>

	<div class="shaft" bind:this={shaft}>
		<div class="crown">The Crown</div>

		{#each floors as floor (floor.floor)}
			{@const record = progress[floor.floor]}
			{@const unlocked = towerProgress.isUnlocked(floor.floor)}
			{@const isNext = floor.floor === nextFloor}

			{#if floor.floor === TOWER.filter((f) => f.wing === floor.wing).at(-1)?.floor}
				<div class="wing-label">{floor.wing}</div>
			{/if}

			<button
				class="storey"
				class:cleared={!!record}
				class:locked={!unlocked}
				class:next={isNext}
				data-floor={floor.floor}
				disabled={!unlocked}
				style:--stone={wingTint(floor)}
				style:--stone-dark={wingEdge(floor)}
				on:click={() => open(floor)}
				on:mouseenter={() => (hovered = floor)}
				on:focus={() => (hovered = floor)}
				on:mouseleave={() => (hovered = null)}
			>
				<span class="num">{floor.floor}</span>
				<span class="body">
					<span class="name">{unlocked ? floor.name : 'Sealed'}</span>
					<span class="brief">{unlocked ? floor.brief : 'Clear the floor below to open this one.'}</span>
				</span>
				<span class="mark" aria-hidden="true">
					{#if record}
						{record.result === 'won' ? '★' : '½'}
					{:else if unlocked}
						▸
					{:else}
						⊘
					{/if}
				</span>
			</button>
		{/each}

		<div class="base">The Gate</div>
	</div>

	<footer class="tip">
		{#if hovered}
			<b class="mv-gold">{hovered.name}</b> — {hovered.brief}
		{:else}
			Scroll the shaft. Floor {nextFloor} is where you are up to.
		{/if}
	</footer>
</div>

{#if showKey}
	<Modal title="Reading the tower" onClose={() => (showKey = false)}>
		<p class="lede">The shaft runs bottom to top: the Gate below, the Crown above.</p>
		<dl class="key">
			<dt><span class="swatch star">★</span></dt>
			<dd><b>Won.</b> You checkmated the position on this floor.</dd>

			<dt><span class="swatch half">½</span></dt>
			<dd>
				<b>Held a draw.</b> Also a clear. On the upper floors you start in a lost
				position, so surviving to a draw is the objective.
			</dd>

			<dt><span class="swatch open">▸</span></dt>
			<dd><b>Open.</b> Unlocked and not yet cleared.</dd>

			<dt><span class="swatch lock">⊘</span></dt>
			<dd><b>Sealed.</b> Clear the floor below to open it.</dd>
		</dl>

		<p class="lede">
			The masonry changes with each wing — the Undercroft hands you an overwhelming
			advantage, the Stair is real endgame technique, the Gallery is level, and on
			the Spire you are behind.
		</p>
	</Modal>
{/if}

<style>
	.screen {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		width: 100vw;
		box-sizing: border-box;
		background:
			radial-gradient(circle at 50% 20%, #241a12 0%, #140e09 50%, var(--shadow) 100%),
			var(--shadow);
		overflow: hidden;
	}

	.top {
		text-align: center;
		padding: clamp(10px, 2vh, 20px) 16px 10px;
		flex: 0 0 auto;
	}

	h1 {
		font-size: clamp(24px, 5vw, 40px);
	}

	.actions {
		display: flex;
		gap: 10px;
		justify-content: center;
		margin-top: 10px;
		flex-wrap: wrap;
	}

	.chip {
		padding: 7px 14px;
		border: 2px solid var(--gold);
		background: var(--oak-light);
		color: var(--parchment);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
	}

	.chip:hover {
		background: var(--oak);
		color: var(--gold-bright);
	}

	.chip.crimson {
		background: var(--crimson);
	}
	.chip.crimson:hover {
		background: var(--crimson-light);
	}

	/*
	 * The shaft: a scrolling column with stone walls either side, so the list of
	 * floors reads as the inside of a tower rather than a menu.
	 */
	.shaft {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 0 clamp(8px, 4vw, 40px) 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		scrollbar-width: thin;
		scrollbar-color: var(--gold) transparent;
	}

	.shaft::-webkit-scrollbar {
		width: 8px;
	}
	.shaft::-webkit-scrollbar-thumb {
		background: var(--oak-light);
		border: 1px solid var(--gold);
	}

	.crown,
	.base {
		width: min(620px, 100%);
		text-align: center;
		font-family: var(--font-display);
		font-size: 14px;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--gold);
		padding: 16px 0;
		flex: 0 0 auto;
	}

	.crown {
		border-bottom: 2px solid var(--gold);
		margin-bottom: 6px;
	}

	.base {
		border-top: 2px solid var(--gold);
		margin-top: 6px;
	}

	.wing-label {
		width: min(620px, 100%);
		font-family: var(--font-body);
		font-size: 11px;
		letter-spacing: 0.26em;
		text-transform: uppercase;
		color: var(--gold);
		padding: 14px 4px 6px;
		flex: 0 0 auto;
	}

	/* One storey of the tower. */
	.storey {
		position: relative;
		width: min(620px, 100%);
		flex: 0 0 auto;
		display: grid;
		grid-template-columns: 54px 1fr 34px;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		box-sizing: border-box;
		text-align: left;
		cursor: pointer;
		color: var(--parchment);
		font-family: var(--font-body);

		/* Masonry: courses of the wing's own stone, with a lit top edge. */
		background-color: var(--stone);
		background-image:
			/* lit top edge */
			linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0 2px, transparent 2px),
			/* shadowed base */
			linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0 3px, transparent 3px),
			/* two courses of block joints, offset like real masonry */
			repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 78px),
			repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 78px);
		background-size:
			100% 100%,
			100% 100%,
			100% 50%,
			100% 50%;
		background-position:
			0 0,
			0 100%,
			0 0,
			39px 100%;
		background-repeat: no-repeat, no-repeat, repeat-x, repeat-x;
		border: 2px solid var(--stone-dark);
		border-left: 6px solid var(--gold);
		box-shadow: 0 4px 10px -6px #000;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	.storey:hover:not(:disabled),
	.storey:focus-visible:not(:disabled) {
		transform: translateX(4px);
		filter: brightness(1.25);
	}

	.storey.cleared {
		border-left-color: var(--forest-light);
	}

	.storey.next {
		border-left-color: var(--gold-bright);
		box-shadow:
			0 0 0 2px rgba(240, 210, 100, 0.5),
			0 4px 10px -6px #000;
	}

	.storey.locked {
		cursor: not-allowed;
		filter: grayscale(0.7) brightness(0.55);
		border-left-color: rgba(138, 111, 71, 0.6);
	}

	.num {
		font-family: var(--font-display);
		font-size: clamp(20px, 3vw, 28px);
		text-align: center;
		color: var(--gold-bright);
		text-shadow: 0 2px 3px rgba(0, 0, 0, 0.8);
	}

	.body {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		font-family: var(--font-display);
		font-size: clamp(13px, 1.8vw, 17px);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	}

	.brief {
		font-size: clamp(10px, 1.3vw, 12.5px);
		color: rgba(232, 216, 176, 0.72);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mark {
		font-size: 18px;
		text-align: center;
		color: var(--gold-bright);
	}

	.storey.cleared .mark {
		color: #9ce0a8;
	}

	.tip {
		flex: 0 0 auto;
		text-align: center;
		padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
		font-family: var(--font-body);
		font-size: clamp(11px, 1.4vw, 14px);
		color: rgba(232, 216, 176, 0.8);
		border-top: 1px solid rgba(201, 162, 39, 0.35);
		min-height: 1.6em;
	}

	.lede {
		margin: 0 0 12px;
		color: var(--ink-soft);
	}

	.key {
		display: grid;
		grid-template-columns: 42px 1fr;
		gap: 8px 12px;
		margin: 0 0 14px;
		align-items: start;
	}

	.key dt {
		text-align: center;
	}

	.key dd {
		margin: 0;
	}

	.key b {
		color: var(--crimson);
	}

	.swatch {
		display: inline-grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 2px solid var(--parchment-edge);
		background: var(--oak);
		color: var(--gold-bright);
		font-size: 15px;
	}

	.swatch.star {
		background: var(--forest);
	}
	.swatch.half {
		background: var(--royal);
	}
	.swatch.open {
		background: var(--oak-light);
	}
	.swatch.lock {
		filter: grayscale(0.8) brightness(0.7);
	}

	/* Phones: the brief is the first thing to go. */
	@media (max-width: 520px) {
		.brief {
			display: none;
		}

		.storey {
			grid-template-columns: 42px 1fr 28px;
			padding: 10px;
		}
	}
</style>
