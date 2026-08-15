<script lang="ts">
	import { TOTAL_FLOORS } from '$game/levels';
	import { towerProgress } from '$lib/stores/progress';
	import { goto } from '$lib/stores/app';
	import Modal from './Modal.svelte';
	import Shell from './Shell.svelte';

	$: cleared = Object.keys($towerProgress).length;
	$: next = towerProgress.highestUnlocked();

	let showHelp = false;
</script>

<Shell
	title="ChessPlatform"
	subtitle="Your moves on the board are the climb. Captures launch you; stalling burns you."
>
	<button class="mv-button" on:click={() => goto({ name: 'tower' })}>
		{cleared === 0 ? 'Enter the Tower' : `Climb the Tower · Floor ${next}`}
	</button>
	<p class="mv-caption centre mv-gold">{cleared} of {TOTAL_FLOORS} floors cleared</p>

	<button class="mv-button royal" on:click={() => goto({ name: 'play', mode: 'endless' })}>
		Endless Ascent
	</button>
	<p class="mv-caption centre">
		Beat a game and you are flung skyward into the next. The engine sharpens as you climb; the run
		ends only when you lose.
	</p>

	<button class="mv-button quiet" on:click={() => goto({ name: 'lobby' })}>Two Climbers</button>
	<button class="mv-button crimson" on:click={() => goto({ name: 'leaderboard' })}>
		Hall of Champions
	</button>

	<button class="link" on:click={() => (showHelp = true)}>How to play</button>
</Shell>

{#if showHelp}
	<Modal title="How to play" onClose={() => (showHelp = false)}>
		<p class="lede">Your moves on the board are the climb. You never steer directly.</p>
		<ul class="help">
			<li><b>Captures lift you</b> — the bigger the piece, the higher the leap.</li>
			<li><b>Files steer</b> you left and right; ranks do nothing.</li>
			<li><b>Space</b> brakes you to a stop.</li>
			<li><b>↓ or S</b> drops you through a wooden plank, never through stone.</li>
			<li><b>Gold runes</b> grant 5s of direct control and jumps, stacking to 10s.</li>
			<li><b>Wooden planks</b> can be jumped up through; grey stone cannot.</li>
			<li><b>Climbing charges slow-motion</b> — press <b>Q</b> to slow the whole tower.</li>
			<li><b>Stalling burns you.</b> The lava never stops rising.</li>
		</ul>
	</Modal>
{/if}

<style>
	.centre {
		text-align: center;
		margin-top: -8px;
	}

	.link {
		background: none;
		border: 0;
		color: var(--gold);
		font-family: var(--font-body);
		font-size: 14px;
		cursor: pointer;
		text-decoration: underline;
		padding: 4px;
	}

	.lede {
		margin: 0 0 12px;
		color: var(--ink-soft);
	}

	.help {
		margin: 0;
		padding-left: 20px;
	}

	.help li {
		margin-bottom: 6px;
	}

	.help b {
		color: var(--crimson);
		font-weight: 600;
	}
</style>
