<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { SLOWMO_MIN_CHARGE } from '$game/config';
	import { Gestures } from '$lib/platformer/engine/Gestures';
	import type { Input } from '$lib/platformer/engine/Input';
	import type { HudState } from '$lib/platformer/PlatformerGame';

	export let input: Input | null = null;
	export let hud: HudState | null = null;

	let surface: HTMLDivElement;
	let gestures: Gestures | null = null;
	let showHints = false;

	const HINT_KEY = 'chessplatform:touch-hints-seen';

	$: gestures?.setInput(input);
	$: charge = hud?.slowCharge ?? 0;
	$: slowReady = hud?.slowActive || charge >= SLOWMO_MIN_CHARGE;
	$: controlLit = (hud?.controlRemaining ?? 0) > 0;
	$: onGround = hud?.onGround ?? true;

	onMount(() => {
		gestures = new Gestures(surface, input);

		try {
			showHints = localStorage.getItem(HINT_KEY) === null;
		} catch {
			showHints = true; // private browsing: show them, they are cheap to dismiss
		}
	});

	onDestroy(() => gestures?.destroy());

	function dismissHints() {
		showHints = false;
		try {
			localStorage.setItem(HINT_KEY, '1');
		} catch {
			/* nothing to remember, nothing lost */
		}
	}

	function tapSlow() {
		input?.pressTouch('slow');
	}
</script>

<!--
	The touch layer sits under the HUD in the DOM on purpose: the HUD's own
	buttons are later siblings, so they win the hit test where they overlap and
	"End Run" stays pressable through the gesture surface.
-->
<div
	class="surface"
	bind:this={surface}
	role="application"
	aria-label="Climb controls: drag to steer, tap to jump, swipe down to drop"
></div>

<!--
	The rail holds only what can be used right now.

	A permanently visible slow-motion button that does nothing for the first
	minute of a run is furniture, and the charge meter it carried was answering a
	question nobody had yet asked. It appears when it becomes usable, which is
	also the clearest possible signal that it has.
-->
<div class="rail">
	{#if slowReady}
		<button
			class="orb slow"
			class:active={hud?.slowActive}
			type="button"
			on:pointerdown|preventDefault={tapSlow}
			aria-label="Slow motion"
		>
			<span class="glyph">◑</span>
			<span class="caption">Slow</span>
		</button>
	{/if}

	{#if onGround}
		<!-- Only while you are still standing at the bottom. Once the climb is
		     under way the screen belongs to the game, and a help button hanging
		     over it is one more thing between you and the tower. -->
		<button class="orb help" type="button" on:click={() => (showHints = true)} aria-label="Controls">
			?
		</button>
	{/if}
</div>

{#if controlLit && onGround}
	<div class="lit" aria-hidden="true">Control — drag to run, tap to jump</div>
{/if}

{#if showHints}
	<div class="hints" role="dialog" aria-label="Touch controls">
		<div class="card">
			<h2>Touch controls</h2>
			<dl>
				<dt>Drag</dt>
				<dd>Steer left and right. Anywhere on the climb — the stick follows your thumb.</dd>
				<dt>Tap</dt>
				<dd>Brake to a stop. While a gold rune is lit, it jumps and double-jumps instead.</dd>
				<dt>Swipe down</dt>
				<dd>Drop through the wooden plank you are standing on. Stone never gives.</dd>
				<dt>◑</dt>
				<dd>Spend charged slow motion. It fills as you climb.</dd>
			</dl>
			<p class="note">Steering and jumping need a control rune. Your chess moves do the rest.</p>
			<button class="got-it" type="button" on:click={dismissHints}>Climb</button>
		</div>
	</div>
{/if}

<style>
	.surface {
		position: absolute;
		inset: 0;
		z-index: 1;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
		/* No background: it is a hit target, not a thing you should be able to see. */
	}

	.rail {
		position: absolute;
		z-index: 3;
		right: 10px;
		bottom: calc(10px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: center;
	}

	.orb {
		width: clamp(52px, 14vw, 66px);
		height: clamp(52px, 14vw, 66px);
		border-radius: 50%;
		border: 2px solid var(--gold);
		background: rgba(59, 42, 28, 0.7);
		color: var(--parchment);
		font-family: var(--font-body);
		display: grid;
		place-items: center;
		line-height: 1;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		cursor: pointer;
	}

	.orb.help {
		width: clamp(36px, 9vw, 44px);
		height: clamp(36px, 9vw, 44px);
		font-size: 16px;
		opacity: 0.75;
	}

	.orb.slow {
		background: rgba(62, 96, 158, 0.85);
		border-color: #9ecbf0;
		color: #dcefff;
		gap: 1px;
	}

	.orb.slow.active {
		border-color: #dcefff;
		box-shadow: 0 0 0 3px rgba(158, 203, 240, 0.35);
	}

	.glyph {
		font-size: clamp(18px, 5vw, 22px);
	}

	.caption {
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	/* A quiet reminder that the controls are live, only while a rune burns. */
	.lit {
		position: absolute;
		left: 50%;
		bottom: calc(12px + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		padding: 5px 12px;
		font-family: var(--font-body);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold-bright);
		background: rgba(20, 13, 6, 0.68);
		border: 1px solid var(--gold);
		white-space: nowrap;
		pointer-events: none;
	}

	.hints {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 14px;
		background: rgba(20, 13, 6, 0.82);
		z-index: 5;
	}

	.card {
		width: min(420px, 100%);
		max-height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		padding: 16px 18px;
		background: var(--parchment);
		color: var(--ink);
		border: var(--rule);
		box-shadow: 0 18px 40px -16px #000;
		font-family: var(--font-body);
	}

	h2 {
		margin: 0 0 10px;
		font-family: var(--font-display);
		font-size: 20px;
		color: var(--crimson);
	}

	dl {
		display: grid;
		grid-template-columns: 84px 1fr;
		gap: 6px 12px;
		margin: 0 0 12px;
		font-size: 13px;
	}

	dt {
		font-weight: 600;
		color: var(--crimson);
	}

	dd {
		margin: 0;
	}

	.note {
		margin: 0 0 14px;
		font-size: 12px;
		color: var(--ink-soft);
	}

	.got-it {
		width: 100%;
		padding: 10px;
		border: 2px solid var(--gold);
		background: var(--forest);
		color: var(--parchment);
		font-family: var(--font-body);
		font-size: 15px;
		cursor: pointer;
	}
</style>
