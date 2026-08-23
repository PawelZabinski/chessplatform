<script lang="ts">
	import { STAR_MARKS } from '$game/summit';
	import type { Banner, HudState, Toast } from '$lib/platformer/PlatformerGame';

	export let hud: HudState | null = null;
	export let toasts: Toast[] = [];
	export let banner: Banner | null = null;
	export let onLeave: () => void;
	export let endRunVote: {
		requestedByMe: boolean;
		requesterName: string;
		acceptedByMe: boolean;
		acceptedCount: number;
		total: number;
	} | null = null;
	export let onAcceptEndRun: () => void = () => {};
	export let onDeclineEndRun: () => void = () => {};
	/** On touch the slow-motion orb carries its own charge meter and prompt. */
	export let touch = false;

	$: control = hud?.controlRemaining ?? 0;
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

		<button class="leave" type="button" on:click={onLeave} disabled={endRunVote !== null}>
			{hud?.floorLabel ? 'Leave Floor' : 'End Run'}
		</button>
	</div>

	{#if endRunVote}
		<div class="end-vote" role="region" aria-label="End run confirmation">
			<span>
				{#if endRunVote.requestedByMe}
					End run requested — waiting for {endRunVote.total - endRunVote.acceptedCount} more
				{:else}
					<strong>{endRunVote.requesterName}</strong> would like to end the run
				{/if}
			</span>
			{#if endRunVote.requestedByMe || endRunVote.acceptedByMe}
				<button class="vote-button quiet" type="button" on:click={onDeclineEndRun}>Cancel</button>
			{:else}
				<button class="vote-button quiet" type="button" on:click={onDeclineEndRun}>Keep playing</button>
				<button class="vote-button agree" type="button" on:click={onAcceptEndRun}>End run</button>
			{/if}
		</div>
	{/if}

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

	<!--
		The summit gauge.

		Vertical and against the edge because it maps onto the thing it measures:
		the tower goes up, so the meter does too, and a glance tells you how far is
		left without reading anything. Kept faint until a star is close, since for
		most of a floor it is context rather than information.
	-->
	{#if hud?.summit}
		<div class="summit" aria-label="Progress to the summit">
			<div class="shaft">
				<div class="climbed" style:height="{Math.round(hud.summitProgress * 100)}%"></div>
				{#each STAR_MARKS as mark, i}
					<span
						class="mark"
						class:earned={hud.stars > i}
						style:bottom="{mark * 100}%"
						aria-hidden="true">★</span
					>
				{/each}
			</div>
			<span class="cap">{Math.round(hud.summitProgress * 100)}%</span>
		</div>
	{/if}

	{#if banner}
		<div class="banner">
			<span class="kicker">{banner.kicker}</span>
			<strong style:color={banner.accent}>{banner.title}</strong>
		</div>
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
		z-index: 2;
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

	.leave:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.end-vote {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: min(720px, calc(100% - 20px));
		padding: 7px 10px;
		background: rgba(35, 27, 20, 0.92);
		border: 1px solid rgba(201, 162, 39, 0.75);
		box-shadow: 0 8px 20px -14px #000;
		color: var(--parchment);
		font-size: 12px;
	}

	.end-vote span {
		flex: 1 1 auto;
	}

	.vote-button {
		padding: 5px 9px;
		border: 1px solid var(--gold);
		font: inherit;
		color: var(--parchment);
		cursor: pointer;
		white-space: nowrap;
	}

	.vote-button.quiet {
		background: transparent;
	}

	.vote-button.agree {
		background: var(--crimson);
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

	.summit {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		pointer-events: none;
	}

	.shaft {
		position: relative;
		width: 8px;
		height: min(38dvh, 260px);
		background: rgba(11, 7, 4, 0.55);
		border: 1px solid rgba(201, 162, 39, 0.5);
	}

	.climbed {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 100%;
		background: linear-gradient(0deg, var(--gold), var(--gold-bright));
		transition: height 0.25s ease-out;
	}

	.mark {
		position: absolute;
		left: 50%;
		transform: translate(-50%, 50%);
		font-size: 12px;
		line-height: 1;
		color: rgba(232, 216, 176, 0.45);
		text-shadow: 0 1px 2px #000;
		transition: color 0.2s ease;
	}

	.mark.earned {
		color: var(--gold-bright);
		text-shadow: 0 0 6px rgba(240, 210, 100, 0.8);
	}

	.cap {
		font-size: 10px;
		letter-spacing: 0.1em;
		color: rgba(232, 216, 176, 0.7);
		text-shadow: 0 1px 2px #000;
	}

	/* Phones: the gauge stays, the readout goes — the bar is the message. */
	@media (max-width: 640px) {
		.shaft {
			height: min(30dvh, 180px);
		}

		.cap {
			display: none;
		}
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

		.leave {
			padding: 6px 10px;
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
