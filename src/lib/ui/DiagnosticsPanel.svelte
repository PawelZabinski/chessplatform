<script lang="ts">
	import { onDestroy } from 'svelte';
	import { log, type LogEntry } from '$lib/diagnostics';

	export let onClose: () => void;

	let entries: LogEntry[] = [];
	let copied = false;
	let onlyProblems = false;

	// The buffer is mutated in place, so take a copy to make Svelte notice.
	const unsubscribe = log.subscribe((next) => (entries = [...next]));
	onDestroy(unsubscribe);

	$: shown = (onlyProblems ? entries.filter((e) => e.level === 'warn' || e.level === 'error') : entries)
		.slice()
		.reverse();
	$: problemCount = entries.filter((e) => e.level === 'warn' || e.level === 'error').length;

	async function copy() {
		try {
			await navigator.clipboard.writeText(log.asText());
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			// Clipboard is blocked outside a secure context; selecting the text by
			// hand still works, so this is not worth an error state.
			copied = false;
		}
	}
</script>

<div class="scrim" role="dialog" aria-label="Diagnostics">
	<div class="panel">
		<header>
			<h2>Diagnostics</h2>
			<button class="close" type="button" on:click={onClose} aria-label="Close">×</button>
		</header>

		<div class="controls">
			<label>
				<input type="checkbox" bind:checked={onlyProblems} />
				Problems only{problemCount ? ` (${problemCount})` : ''}
			</label>
			<button type="button" on:click={copy}>{copied ? 'Copied' : 'Copy all'}</button>
			<button type="button" on:click={() => log.clear()}>Clear</button>
		</div>

		<ol class="lines">
			{#each shown as entry (entry.seq)}
				<li class={entry.level}>
					<span class="at">{(entry.at / 1000).toFixed(2)}s</span>
					<span class="area">{entry.area}</span>
					<span class="msg">
						{entry.message}
						{#if entry.data}
							<span class="data">{JSON.stringify(entry.data)}</span>
						{/if}
					</span>
				</li>
			{:else}
				<li class="empty">Nothing recorded yet.</li>
			{/each}
		</ol>

		<p class="foot">Newest first. Also on the console as <code>chessplatformLog</code>.</p>
	</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: 12px;
		background: rgba(11, 7, 4, 0.85);
	}

	.panel {
		width: min(760px, 100%);
		max-height: min(78dvh, 100%);
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		background: var(--parchment);
		color: var(--ink);
		border: var(--rule);
		box-shadow: 0 18px 40px -16px #000;
		font-family: var(--font-body);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-bottom: 1px solid rgba(138, 111, 71, 0.5);
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 18px;
		color: var(--crimson);
	}

	.close {
		border: 0;
		background: none;
		font-size: 24px;
		line-height: 1;
		cursor: pointer;
		color: var(--ink);
		padding: 0 4px;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 14px;
		border-bottom: 1px solid rgba(138, 111, 71, 0.35);
		font-size: 13px;
		flex-wrap: wrap;
	}

	.controls label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.controls button {
		padding: 5px 12px;
		border: 1px solid var(--oak-light);
		background: rgba(59, 42, 28, 0.08);
		font-family: var(--font-body);
		font-size: 12px;
		cursor: pointer;
		color: var(--ink);
	}

	/* Monospace: these lines are read by scanning for the odd one out. */
	.lines {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		margin: 0;
		padding: 6px 0;
		list-style: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 11.5px;
		line-height: 1.5;
	}

	.lines li {
		display: grid;
		grid-template-columns: 54px 52px 1fr;
		gap: 8px;
		padding: 2px 14px;
		border-left: 3px solid transparent;
		word-break: break-word;
	}

	.lines li.warn {
		background: rgba(201, 162, 39, 0.18);
		border-left-color: var(--gold);
	}

	.lines li.error {
		background: rgba(180, 40, 30, 0.16);
		border-left-color: var(--crimson);
		font-weight: 600;
	}

	.lines li.empty {
		display: block;
		color: var(--ink-soft);
		padding: 14px;
	}

	.at {
		color: var(--ink-soft);
		text-align: right;
	}

	.area {
		color: var(--crimson);
	}

	.data {
		color: var(--ink-soft);
	}

	.foot {
		margin: 0;
		padding: 8px 14px;
		border-top: 1px solid rgba(138, 111, 71, 0.35);
		font-size: 11px;
		color: var(--ink-soft);
	}
</style>
