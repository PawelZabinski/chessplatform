<script lang="ts">
	import { onMount } from 'svelte';
	import { installGlobalErrorLogging, log } from '$lib/diagnostics';

	// Installed once, at the root, so anything thrown anywhere in the app lands in
	// the same buffer the diagnostics panel reads.
	onMount(() => {
		installGlobalErrorLogging();
		log.info('app', 'Session started', {
			viewport: `${window.innerWidth}x${window.innerHeight}`,
			dpr: window.devicePixelRatio,
			touch: navigator.maxTouchPoints ?? 0
		});
	});
</script>

<svelte:head>
    <title>ChessPlatform — climb by playing chess</title>
</svelte:head>

<slot />

<style>
    :global(:root) {
        --oak: #3b2a1c;
        --oak-light: #5a412c;
        --gold: #c9a227;
        --gold-bright: #f0d264;
        --parchment: #e8d8b0;
        --ink: #2b1f14;
        --shadow: #0b0704;
    }

    :global(body) {
        margin: 0;
        padding: 0;
        color: var(--parchment);
        font-family: 'Cinzel', Georgia, 'Times New Roman', serif;
        /* Dark stone hall: a warm pool of light in the centre, near-black edges. */
        background:
            radial-gradient(circle at 50% 32%, #241a12 0%, #140e09 45%, var(--shadow) 100%),
            var(--shadow);
        overflow: hidden;
    }
</style>