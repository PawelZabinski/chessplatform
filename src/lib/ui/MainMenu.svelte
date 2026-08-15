<script lang="ts">
	import { TOTAL_FLOORS } from '$game/levels';
	import { towerProgress } from '$lib/stores/progress';
	import { goto } from '$lib/stores/app';
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

	<button class="link" on:click={() => (showHelp = !showHelp)}>
		{showHelp ? 'Hide' : 'How to play'}
	</button>

	{#if showHelp}
		<ul class="help mv-caption">
			<li><b>Captures lift you</b> — the bigger the piece, the higher the leap.</li>
			<li><b>Files steer</b> you left and right.</li>
			<li><b>Space</b> brakes you to a stop; <b>↓ / S</b> drops through a wooden plank.</li>
			<li><b>Gold runes</b> grant 5s of direct control, stacking to 10s.</li>
			<li><b>Wooden planks</b> can be jumped through; grey stone cannot.</li>
			<li><b>Climbing charges slow-motion</b> — press <b>Q</b> to spend it.</li>
		</ul>
	{/if}
</Shell>

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

	.help {
		margin: 0;
		padding-left: 20px;
		text-align: left;
		line-height: 1.8;
	}

	.help b {
		color: var(--gold-bright);
		font-weight: 600;
	}
</style>
