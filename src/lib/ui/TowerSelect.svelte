<script lang="ts">
	import { TOTAL_FLOORS, floorsByWing, type TowerFloor } from '$game/levels';
	import { towerProgress } from '$lib/stores/progress';
	import { goto } from '$lib/stores/app';
	import Shell from './Shell.svelte';

	// Wings run bottom-up in fiction, so the highest is drawn first.
	const wings = floorsByWing().reverse();

	let hovered: TowerFloor | null = null;

	$: progress = $towerProgress;
	$: cleared = Object.keys(progress).length;

	function open(floor: TowerFloor) {
		if (!towerProgress.isUnlocked(floor.floor)) return;
		goto({ name: 'play', mode: 'tower', floor: floor.floor });
	}
</script>

<Shell title="The Tower" subtitle={`${cleared} of ${TOTAL_FLOORS} floors cleared`} wide>
	{#each wings as wing}
		<section class="wing">
			<h2>{wing.wing}</h2>
			<div class="row">
				{#each wing.floors as floor}
					{@const record = progress[floor.floor]}
					{@const unlocked = towerProgress.isUnlocked(floor.floor)}
					<button
						class="tile"
						class:cleared={!!record}
						class:locked={!unlocked}
						disabled={!unlocked}
						on:click={() => open(floor)}
						on:mouseenter={() => (hovered = floor)}
						on:focus={() => (hovered = floor)}
						on:mouseleave={() => (hovered = null)}
						title={unlocked ? `${floor.name} — ${floor.brief}` : 'Locked'}
					>
						<span class="num">{floor.floor}</span>
						{#if record}
							<span class="mark">{record.result === 'won' ? '★' : '½'}</span>
						{:else if !unlocked}
							<span class="mark lock">·</span>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/each}

	<p class="tip mv-caption">
		{#if hovered}
			<b class="mv-gold">{hovered.name}</b> — {hovered.brief}
		{:else}
			Pick a floor. Each drops you into a real position.
		{/if}
	</p>

	<button class="mv-button crimson" on:click={() => goto({ name: 'menu' })}>Return to Gate</button>
</Shell>

<style>
	.wing h2 {
		font-family: var(--font-body);
		font-size: 12px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--gold);
		margin: 0 0 6px;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: clamp(4px, 1vw, 10px);
		border-top: 1px solid rgba(201, 162, 39, 0.35);
		padding-top: 10px;
	}

	.tile {
		position: relative;
		aspect-ratio: 1 / 1;
		display: grid;
		place-items: center;
		border: 2px solid var(--gold);
		background: var(--royal);
		color: var(--parchment);
		font-family: var(--font-display);
		font-size: clamp(12px, 2vw, 20px);
		cursor: pointer;
		box-shadow: 0 0 0 2px var(--oak);
		transition: transform 0.1s ease;
	}

	.tile:hover:not(:disabled) {
		transform: scale(1.07);
		background: var(--royal-light);
		color: var(--gold-bright);
	}

	.tile.cleared {
		background: var(--forest);
	}

	.tile.locked {
		background: var(--oak);
		border-color: rgba(138, 111, 71, 0.5);
		color: #6b5c48;
		cursor: not-allowed;
	}

	.num {
		line-height: 1;
	}

	.mark {
		position: absolute;
		bottom: 2px;
		font-size: 10px;
		color: var(--gold-bright);
	}

	.mark.lock {
		color: #6b5c48;
	}

	.tip {
		text-align: center;
		min-height: 2.6em;
	}

	/* Phones: four across reads better than eight squeezed. */
	@media (max-width: 560px) {
		.row {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
