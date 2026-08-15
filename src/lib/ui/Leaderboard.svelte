<script lang="ts">
	import { leaderboard } from '$lib/stores/chess';
	import { goto } from '$lib/stores/app';
	import Shell from './Shell.svelte';

	const MAX_ROWS = 10;
	const MEDALS = ['#a8801f', '#6f6f78', '#8a5a2b'];

	$: rows = [...$leaderboard].sort((a, b) => b.score - a.score).slice(0, MAX_ROWS);
</script>

<Shell title="Hall of Champions" wide>
	<div class="mv-panel table">
		{#if rows.length === 0}
			<p class="empty">No champions yet. Be the first to climb.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th class="rank">#</th>
						<th>Champion</th>
						<th class="num">Score</th>
						<th>Stage</th>
						<th class="num">Won</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, i}
						<tr>
							<td class="rank" style:color={MEDALS[i] ?? 'var(--ink-soft)'}>{i + 1}</td>
							<td class="name">{row.name}</td>
							<td class="num score">{row.score.toLocaleString()}</td>
							<!-- Entries saved before stages existed show a dash. -->
							<td class="stage">{row.stage ?? '—'}</td>
							<td class="num">{row.gamesWon ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<button class="mv-button crimson" on:click={() => goto({ name: 'menu' })}>Return to Gate</button>
</Shell>

<style>
	.table {
		padding: 14px 16px;
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-body);
		color: var(--ink);
	}

	th {
		font-family: var(--font-display);
		font-size: 13px;
		text-align: left;
		padding: 6px 8px;
		border-bottom: 1px solid var(--parchment-edge);
		white-space: nowrap;
	}

	td {
		padding: 9px 8px;
		font-size: 15px;
		border-bottom: 1px solid rgba(138, 111, 71, 0.25);
	}

	tbody tr:nth-child(even) {
		background: rgba(210, 190, 145, 0.4);
	}

	.rank {
		font-family: var(--font-display);
		width: 2.5em;
	}

	.num {
		text-align: right;
	}

	.score {
		font-family: var(--font-display);
		color: var(--crimson);
	}

	.stage {
		color: var(--ink-soft);
	}

	.name {
		max-width: 12em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty {
		text-align: center;
		font-family: var(--font-body);
		color: var(--ink-soft);
		margin: 20px 0;
	}
</style>
