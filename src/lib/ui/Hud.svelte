<script lang="ts">
	import { onDestroy } from 'svelte';
	import DiagnosticsPanel from '$lib/ui/DiagnosticsPanel.svelte';
	import { log } from '$lib/diagnostics';
	import type { Banner, HudState, Toast } from '$lib/platformer/PlatformerGame';

	let showLog = false;
	let problems = 0;

	// The badge is the only reason the HUD watches the log: if something has gone
	// wrong the button should say so without being opened.
	const stopWatching = log.subscribe((entries) => {
		problems = entries.filter((e) => e.level === 'warn' || e.level === 'error').length;
	});

	export let hud: HudState | null = null;
	export let toasts: Toast[] = [];
	export let banner: Banner | null = null;
	export let onLeave: () => void;
	/** On touch the slow-motion orb carries its own charge meter and prompt. */
	export let touch = false;

	$: control = hud?.controlRemaining ?? 0;

	onDestroy(stopWatching);
</script>

<!--
	The HUD is DOM, not canvas.

	Everything here used to be text positioned by hand inside the renderer, which
	meant auditing for overlaps at every viewport size. As markup it simply
	reflows: flexbox handles the spacing, and the whole bar collapses to a
	compact form on a phone through one media query.
-->
<div class="hud" aria-live="polite">
	<div class="bar">
		<div class="cell score">
			<span class="label">Score</span>
			<strong class="value">{hud ? hud.score.toLocaleString() : '0'}</strong>
		</div>

		<div class="cell wide">
			<span class="label">{hud?.floorLabel ? 'Floor' : 'Stage'}</span>
			<strong class="name">{hud?.floorLabel ?? hud?.stageName ?? '—'}</strong>
			<div class="track" aria-hidden="true">
				<div class="fill" style:width="{Math.round((hud?.stageProgress ?? 0) * 100)}%"></div>
			</div>
		</div>

		{#if hud?.mode === 'endless'}
			<div class="cell right">
				<span class="label">Games won</span>
				<strong class="value small">{hud.gamesWon}</strong>
				<span class="tier">{hud.tierLabel}</span>
			</div>
		{/if}

		<button
			class="logs"
			class:alert={problems > 0}
			type="button"
			on:click={() => (showLog = true)}
			aria-label="Diagnostics"
			title="Diagnostics"
		>
			{problems > 0 ? `⚠ ${problems}` : 'ⓘ'}
		</button>

		<button class="leave" type="button" on:click={onLeave}>
			{hud?.floorLabel ? 'Leave Floor' : 'End Run'}
		</button>
	</div>

	<div class="meters">
		{#if (hud?.combo ?? 1) > 1}
			<span class="combo">x{hud?.combo}</span>
		{/if}

		{#if control > 0}
			<div class="meter control">
				<span>Control {(control / 1000).toFixed(1)}s</span>
				<div class="track"><div class="fill gold" style:width="{Math.round((hud?.controlFraction ?? 0) * 100)}%"></div></div>
			</div>
		{/if}

		{#if !touch}
			<div
				class="meter slow"
				class:ready={(hud?.slowCharge ?? 0) >= 0.35}
				class:active={hud?.slowActive}
			>
				<span>
					{#if hud?.slowActive}
						Slow motion {(hud.slowRemaining / 1000).toFixed(1)}s
					{:else if (hud?.slowCharge ?? 0) >= 0.35}
						Slow motion — Q
					{:else}
						Charging
					{/if}
				</span>
				<div class="track">
					<div
						class="fill cool"
						style:width="{Math.round((hud?.slowActive ? hud.slowRemaining / 2100 : (hud?.slowCharge ?? 0)) * 100)}%"
					></div>
				</div>
			</div>
		{/if}
	</div>

	{#if banner}
		<div class="banner">
			<span class="kicker">{banner.kicker}</span>
			<strong style:color={banner.accent}>{banner.title}</strong>
		</div>
	{/if}

	{#if showLog}
		<DiagnosticsPanel onClose={() => (showLog = false)} />
	{/if}

	<div class="toasts">
		{#each toasts as toast (toast.id)}
			<div class="toast {toast.tone}">{toast.text}</div>
		{/each}
	</div>
</div>

<style>
	.hud {
		position: absolute;
		inset: 0;
		pointer-events: none;
		font-family: var(--font-body);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10px;
		gap: 8px;
	}

	.bar {
		pointer-events: auto;
		display: flex;
		align-items: stretch;
		gap: 14px;
		width: 100%;
		max-width: 760px;
		padding: 8px 10px;
		box-sizing: border-box;
		background: linear-gradient(180deg, rgba(232, 216, 176, 0.95), rgba(210, 190, 145, 0.95));
		border: 2px solid var(--gold);
		box-shadow: 0 0 0 3px var(--oak), 0 12px 28px -18px #000;
		color: var(--ink);
	}

	.cell {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
	}

	.cell.wide {
		flex: 1 1 auto;
	}

	.cell.right {
		text-align: right;
		border-left: 1px solid rgba(138, 111, 71, 0.5);
		padding-left: 12px;
	}

	.label {
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.value {
		font-family: var(--font-display);
		font-size: clamp(18px, 2.4vw, 26px);
		color: var(--crimson);
		line-height: 1.1;
	}

	.value.small {
		font-size: clamp(15px, 1.8vw, 20px);
		color: var(--forest);
	}

	.name {
		font-family: var(--font-display);
		font-size: clamp(13px, 1.6vw, 18px);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tier {
		font-size: 11px;
		color: #5a4a7a;
	}

	.track {
		height: 6px;
		margin-top: 4px;
		background: rgba(59, 42, 28, 0.28);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--gold);
		transition: width 0.18s linear;
	}

	.fill.gold {
		background: var(--gold-bright);
	}
	.fill.cool {
		background: #9ecbf0;
	}

	.logs {
		pointer-events: auto;
		align-self: center;
		padding: 8px 10px;
		border: 2px solid var(--oak-light);
		background: transparent;
		color: var(--ink-soft);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		white-space: nowrap;
	}

	.logs:hover {
		border-color: var(--gold);
		color: var(--ink);
	}

	/* Something has been logged as wrong: say so on the bar, not just in the panel. */
	.logs.alert {
		border-color: var(--crimson);
		background: rgba(180, 40, 30, 0.12);
		color: var(--crimson);
		font-weight: 600;
	}

	.leave {
		pointer-events: auto;
		align-self: center;
		padding: 8px 14px;
		border: 2px solid var(--gold);
		background: var(--crimson);
		color: var(--parchment);
		font-family: var(--font-body);
		font-size: 14px;
		cursor: pointer;
		white-space: nowrap;
	}

	.leave:hover {
		background: var(--crimson-light);
		color: var(--gold-bright);
	}

	.meters {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		max-width: 760px;
		flex-wrap: wrap;
	}

	.combo {
		font-family: var(--font-display);
		font-size: 22px;
		color: var(--gold-bright);
		text-shadow: 0 2px 0 #140d06;
	}

	.meter {
		flex: 0 1 190px;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(232, 216, 176, 0.85);
		text-shadow: 0 1px 2px #000;
	}

	.meter .track {
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(201, 162, 39, 0.55);
	}

	.meter.slow {
		margin-left: auto;
		text-align: right;
		opacity: 0.6;
	}

	.meter.slow.ready,
	.meter.slow.active {
		opacity: 1;
		color: #cfe7ff;
	}

	.banner {
		margin-top: 6vh;
		padding: 12px 34px;
		background: rgba(59, 42, 28, 0.92);
		border-top: 2px solid var(--gold);
		border-bottom: 2px solid var(--gold);
		text-align: center;
		animation: rise 0.28s ease-out;
	}

	.banner .kicker {
		display: block;
		font-size: 11px;
		letter-spacing: 0.28em;
		color: var(--parchment);
	}

	.banner strong {
		font-family: var(--font-display);
		font-size: clamp(22px, 4vw, 34px);
		text-shadow: 0 2px 0 #140d06;
	}

	.toasts {
		position: absolute;
		top: 40%;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.toast {
		font-family: var(--font-display);
		font-size: clamp(14px, 2vw, 20px);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		text-shadow: 0 2px 4px #000;
		animation: float 1.3s ease-out forwards;
		white-space: nowrap;
	}

	.toast.gold {
		color: var(--gold-bright);
	}
	.toast.good {
		color: #9ce0a8;
	}
	.toast.bad {
		color: #ff9a9a;
	}
	.toast.cool {
		color: #a9d4f5;
	}

	@keyframes float {
		0% {
			opacity: 0;
			transform: translateY(10px);
		}
		20% {
			opacity: 1;
			transform: translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateY(-26px);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Phones: the bar sheds its detail rather than shrinking into illegibility. */
	@media (max-width: 640px) {
		.bar {
			gap: 8px;
			padding: 6px 8px;
		}

		.cell.right,
		.meter.control span,
		.meter.slow span {
			display: none;
		}

		.label {
			font-size: 9px;
		}

		.leave,
		.logs {
			padding: 6px 8px;
			font-size: 12px;
		}

		.meters {
			gap: 8px;
		}

		.meter {
			flex: 1 1 80px;
		}
	}
</style>
