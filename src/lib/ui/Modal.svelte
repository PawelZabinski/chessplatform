<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	export let title: string;
	export let onClose: () => void;

	let dialog: HTMLDivElement;

	/**
	 * A real dialog rather than text revealed inline: it sits above everything,
	 * dismisses on Escape or a click outside, and takes focus so keyboard users
	 * land inside it instead of somewhere behind the scrim.
	 */
	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}

	onMount(() => {
		window.addEventListener('keydown', onKey);
		dialog?.focus();
	});

	onDestroy(() => window.removeEventListener('keydown', onKey));
</script>

<div class="scrim" role="presentation" on:click={onClose}></div>

<div
	class="dialog mv-panel"
	role="dialog"
	aria-modal="true"
	aria-label={title}
	tabindex="-1"
	bind:this={dialog}
>
	<header>
		<h2>{title}</h2>
		<button class="x" type="button" aria-label="Close" on:click={onClose}>×</button>
	</header>

	<div class="body">
		<slot />
	</div>

	<button class="mv-button crimson" type="button" on:click={onClose}>Close</button>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgba(11, 7, 4, 0.78);
		backdrop-filter: blur(2px);
	}

	.dialog {
		position: fixed;
		z-index: 41;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(500px, calc(100vw - 32px));
		max-height: min(82dvh, 640px);
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 20px;
		box-sizing: border-box;
		outline: none;
		animation: pop 0.16s ease-out;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid var(--parchment-edge);
		padding-bottom: 10px;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(18px, 2.6vw, 24px);
		color: var(--crimson);
	}

	.x {
		border: 0;
		background: none;
		color: var(--ink-soft);
		font-size: 26px;
		line-height: 1;
		cursor: pointer;
		padding: 0 4px;
	}

	.x:hover {
		color: var(--crimson);
	}

	.body {
		overflow-y: auto;
		font-family: var(--font-body);
		color: var(--ink);
		font-size: 15px;
		line-height: 1.7;
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translate(-50%, -46%) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
</style>
