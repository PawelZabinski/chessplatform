<script lang="ts">
	import { TOTAL_FLOORS, floorByNumber } from '$game/levels';
	import { tierLabel } from '$game/difficulty';
	import type { RunOutcome } from '$lib/platformer/PlatformerGame';
	import { lastPlayerName, leaderboard } from '$lib/stores/chess';
	import { towerProgress } from '$lib/stores/progress';
	import { goto } from '$lib/stores/app';
	import Modal from './Modal.svelte';
	import Shell from './Shell.svelte';

	export let outcome: RunOutcome;

	// Walking away is not a result: it must never bank a floor, however far the
	// climb got. A floor is cleared on a win OR a draw, since the Spire floors
	// are lost positions where holding the draw is the objective.
	const cleared = outcome.mode === 'tower' && outcome.result >= 0.5 && !outcome.abandoned;
	const won = outcome.result === 1 && !outcome.abandoned;

	if (cleared && outcome.floor) {
		towerProgress.record(
			outcome.floor,
			outcome.result === 1 ? 'won' : 'drawn',
			outcome.movesPlayed,
			outcome.score
		);
	}

	const nextFloor = (outcome.floor ?? 0) + 1;
	const hasNext = cleared && nextFloor <= TOTAL_FLOORS;

	let saved = false;
	let asking = false;
	let savedAs = '';
	// Pre-filled with whoever saved last, so the usual answer is just "Save".
	let name = lastPlayerName.read();

	const title = outcome.abandoned
		? outcome.mode === 'tower'
			? 'Floor Abandoned'
			: 'Climb Ended'
		: outcome.mode === 'tower'
			? cleared
				? 'Floor Cleared'
				: 'Floor Failed'
			: won
				? 'Victory'
				: 'The Climb Ends';

	const headline = outcome.abandoned
		? 'You walked away'
		: outcome.result === 1
			? 'The board is yours'
			: outcome.result === 0.5
				? 'A drawn game'
				: 'The board is lost';

	function save() {
		if (saved) return;
		const finalName = name.trim() || 'Anonymous';
		leaderboard.add({
			name: finalName,
			score: outcome.score,
			stage: outcome.stageName,
			gamesWon: outcome.gamesWon
		});
		if (name.trim()) lastPlayerName.write(name.trim());
		savedAs = finalName;
		saved = true;
		asking = false;
	}
</script>

<Shell {title}>
	<div class="mv-panel scroll">
		<h2>{headline}</h2>
		<p class="reason">{outcome.reason}</p>
		<hr />
		<div class="score">{outcome.score.toLocaleString()}</div>
		<div class="score-label">Climb score</div>

		<p class="detail" class:good={cleared || won}>
			{#if outcome.mode === 'tower'}
				{outcome.movesPlayed} move{outcome.movesPlayed === 1 ? '' : 's'} played{won
					? ' · score doubled'
					: ''}
			{:else}
				{outcome.gamesWon} game{outcome.gamesWon === 1 ? '' : 's'} won · reached
				{outcome.stageName} · engine {tierLabel(outcome.tier).toLowerCase()}
			{/if}
		</p>
	</div>

	{#if outcome.mode === 'tower'}
		{#if hasNext}
			<button
				class="mv-button"
				on:click={() => goto({ name: 'play', mode: 'tower', floor: nextFloor })}
			>
				Next Floor · {floorByNumber(nextFloor)?.name ?? nextFloor}
			</button>
		{:else if cleared}
			<p class="mv-caption centre mv-gold">You have reached the crown of the tower.</p>
		{/if}

		<button
			class="mv-button royal"
			on:click={() => goto({ name: 'play', mode: 'tower', floor: outcome.floor })}
		>
			Retry Floor
		</button>
		<button class="mv-button crimson" on:click={() => goto({ name: 'tower' })}>The Tower</button>
	{:else}
		<button class="mv-button" on:click={() => goto({ name: 'play', mode: 'endless' })}>
			Climb Again
		</button>

		{#if !saved}
			<button class="mv-button royal" on:click={() => (asking = true)}>
				Save to the Hall of Champions
			</button>
		{:else}
			<p class="mv-caption centre mv-gold">Recorded as {savedAs} ✓</p>
		{/if}

		<button class="mv-button crimson" on:click={() => goto({ name: 'menu' })}>
			Return to Gate
		</button>
	{/if}
</Shell>

{#if asking}
	<Modal title="Record this climb" onClose={() => (asking = false)}>
		<p class="lede">
			{outcome.score.toLocaleString()} points · {outcome.gamesWon} game{outcome.gamesWon === 1
				? ''
				: 's'} won
		</p>
		<!-- svelte-ignore a11y-autofocus -->
		<input
			class="mv-input"
			bind:value={name}
			placeholder="Your name"
			maxlength="18"
			autofocus
			aria-label="Name for the leaderboard"
			on:keydown={(e) => e.key === 'Enter' && save()}
		/>
		<!-- No cancel button: Modal already supplies Close, plus Escape and
		     click-outside. Two ways to say "no" in one dialog is one too many. -->
		<button class="mv-button royal save" on:click={save}>Save</button>
	</Modal>
{/if}

<style>
	.scroll {
		padding: 22px 24px 20px;
		text-align: center;
	}

	h2 {
		font-family: var(--font-display);
		font-size: clamp(20px, 3.4vw, 30px);
		margin: 0;
		color: var(--ink);
	}

	.reason {
		margin: 8px 0 0;
		font-family: var(--font-body);
		font-size: 15px;
		color: var(--ink-soft);
	}

	hr {
		border: 0;
		border-top: 1px solid var(--parchment-edge);
		margin: 16px 0;
	}

	.score {
		font-family: var(--font-display);
		font-size: clamp(34px, 7vw, 52px);
		color: var(--crimson);
		line-height: 1;
	}

	.score-label {
		font-family: var(--font-body);
		font-size: 12px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-soft);
		margin-top: 6px;
	}

	.detail {
		margin: 14px 0 0;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--ink-soft);
	}

	.detail.good {
		color: #2f4a32;
	}

	.centre {
		text-align: center;
	}

	.lede {
		margin: 0 0 12px;
		color: var(--ink-soft);
	}

	.save {
		margin-top: 14px;
	}
</style>
