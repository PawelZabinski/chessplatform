<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		COOLDOWN_OPTIONS,
		GAME_SPEED_OPTIONS,
		LAVA_OPTIONS,
		TARGET_HEIGHT_OPTIONS,
		loadDraftConfig,
		nextOption,
		optionFor,
		saveDraftConfig,
		summarise,
		type ConfigOption
	} from '$game/multiplayer/matchConfig';
	import {
		ROOM_CODE_LENGTH,
		formatRoomCode,
		isCompleteRoomCode,
		normaliseRoomCode
	} from '$game/multiplayer/roomCode';
	import { goto } from '$lib/stores/app';
	import { isMultiplayerAvailable, matchState } from '$lib/stores/match';
	import { lastPlayerName } from '$lib/stores/chess';
	import Shell from './Shell.svelte';

	type Phase = 'choose' | 'config' | 'room' | 'join';

	let phase: Phase = 'choose';
	let config = loadDraftConfig();
	let joinCode = '';
	let notice = '';
	// Prefilled only with a name actually used before. An empty field shows a
	// placeholder instead: a real value would have to be deleted before typing.
	let name = lastPlayerName.read();
	let ready = false;

	const available = isMultiplayerAvailable;

	$: match = $matchState;
	$: isHost = match.seat !== undefined && match.seat === match.hostSeat;
	$: opponent = match.players.find((p) => p.seat !== match.seat);
	$: connecting = match.status === 'connecting' || match.status === 'reconnecting';

	// The server is the one that knows both players are in and ready; when it
	// says the match has begun, the climb takes over.
	$: if (match.started) goto({ name: 'play', mode: 'match' });
	$: if (match.error) flash(match.error);

	function flash(message: string) {
		notice = message;
		setTimeout(() => (notice = ''), 2600);
	}

	function cycle<T>(options: ConfigOption<T>[], current: T, apply: (v: T) => void) {
		apply(nextOption(options, current));
		config = config;
		// Settings are the host's, and the server is authoritative about them, so
		// push each change rather than batching at the end — the guest's lobby
		// should show what they are about to play under.
		if (match.seat && isHost) matchState.setConfig(config);
	}

	async function host() {
		if (!available) return flash('Multiplayer is not configured for this build');
		saveDraftConfig(config);
		lastPlayerName.write(name.trim());
		phase = 'room';
		try {
			await matchState.host(name.trim());
			matchState.setConfig(config);
		} catch {
			flash('Could not reach the match server');
			phase = 'config';
		}
	}

	async function join() {
		if (!isCompleteRoomCode(joinCode)) return;
		if (!available) return flash('Multiplayer is not configured for this build');
		lastPlayerName.write(name.trim());
		try {
			await matchState.join(name.trim(), joinCode);
			phase = 'room';
		} catch {
			flash('Could not reach the match server');
		}
	}

	function toggleReady() {
		ready = !ready;
		matchState.setReady(ready);
	}

	function leave() {
		matchState.leave();
		goto({ name: 'menu' });
	}

	function onCodeInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		joinCode = normaliseRoomCode(input.value);
		input.value = joinCode;
	}

	// Backing out of the lobby must free the seat, or the room stays half full.
	onDestroy(() => {
		if (!matchState.current.started) matchState.leave();
	});
</script>

<Shell
	title="The Race"
	subtitle={phase === 'choose'
		? 'Race up the same tower against up to four rivals. Nobody waits their turn.'
		: null}
>
	{#if phase === 'choose'}
		<input class="mv-input" bind:value={name} maxlength="18" placeholder="Your name" aria-label="Your name" />
		<button class="mv-button" on:click={() => (phase = 'config')}>Host a Match</button>
		<button class="mv-button royal" on:click={() => (phase = 'join')}>Join with a Code</button>
		<button class="mv-button crimson" on:click={() => goto({ name: 'menu' })}>
			Return to Gate
		</button>
	{:else if phase === 'config'}
		<p class="mv-caption centre">Both players climb under these. The host decides.</p>

		<div class="rows">
			<div class="row">
				<span>Move cooldown</span>
				<button
					class="opt"
					on:click={() =>
						cycle(COOLDOWN_OPTIONS, config.moveCooldownMs, (v) => (config.moveCooldownMs = v))}
				>
					{optionFor(COOLDOWN_OPTIONS, config.moveCooldownMs).label}
				</button>
			</div>
			<div class="row">
				<span>Climb to win</span>
				<button
					class="opt"
					on:click={() =>
						cycle(TARGET_HEIGHT_OPTIONS, config.targetHeight, (v) => (config.targetHeight = v))}
				>
					{optionFor(TARGET_HEIGHT_OPTIONS, config.targetHeight).label}
				</button>
			</div>
			<div class="row">
				<span>Game speed</span>
				<button
					class="opt"
					on:click={() =>
						cycle(GAME_SPEED_OPTIONS, config.gameSpeed, (v) => (config.gameSpeed = v))}
				>
					{optionFor(GAME_SPEED_OPTIONS, config.gameSpeed).label}
				</button>
			</div>
			<div class="row">
				<span>Lava</span>
				<button
					class="opt"
					on:click={() => cycle(LAVA_OPTIONS, config.lavaSpeed, (v) => (config.lavaSpeed = v))}
				>
					{optionFor(LAVA_OPTIONS, config.lavaSpeed).label}
				</button>
			</div>
		</div>

		<p class="mv-caption centre mv-gold">
			{optionFor(COOLDOWN_OPTIONS, config.moveCooldownMs).blurb}
		</p>

		<button class="mv-button" on:click={host}>
			{match.seat ? 'Apply and Return' : 'Create Room'}
		</button>
		<button class="mv-button crimson" on:click={() => (phase = 'choose')}>Back</button>
	{:else if phase === 'room'}
		<div class="mv-panel room">
			{#if match.code}
				<p class="hint">Give this code to your rival</p>
				<div class="code">{formatRoomCode(match.code)}</div>
				<p class="hint">They pick “Join with a Code” and enter it.</p>
			{:else}
				<p class="hint">{connecting ? 'Reaching the match server…' : 'Opening a room…'}</p>
			{/if}
		</div>

		<div class="mv-panel seats">
			{#each match.players as player (player.seat)}
				<div class="seat" class:you={player.seat === match.seat}>
					<span class="who">
						{player.displayName}{player.seat === match.seat ? ' (you)' : ''}
						{#if player.seat === match.hostSeat}<em>host</em>{/if}
					</span>
					<span class="state" class:on={player.ready}>{player.ready ? 'Ready' : 'Waiting'}</span>
				</div>
			{/each}
			{#if !opponent}
				<div class="seat empty"><span class="who">Waiting for a rival…</span></div>
			{/if}
		</div>

		<p class="mv-caption centre mv-gold">{summarise(match.config ?? config)}</p>

		<button class="mv-button" disabled={!opponent} on:click={toggleReady}>
			{ready ? 'Not Ready' : opponent ? 'Ready' : 'Waiting for an opponent…'}
		</button>

		{#if isHost}
			<button class="mv-button royal" on:click={() => (phase = 'config')}>Change Settings</button>
		{/if}
		<button class="mv-button crimson" on:click={leave}>Leave Room</button>
	{:else}
		<p class="mv-caption centre">Type the code your host gave you.</p>
		<input
			class="code-input"
			value={joinCode}
			on:input={onCodeInput}
			on:keydown={(e) => e.key === 'Enter' && join()}
			maxlength={ROOM_CODE_LENGTH}
			placeholder="ABC234"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			aria-label="Room code"
		/>

		<button class="mv-button" disabled={!isCompleteRoomCode(joinCode)} on:click={join}>
			Join Match
		</button>
		<button class="mv-button crimson" on:click={() => (phase = 'choose')}>Back</button>
	{/if}

	{#if notice}
		<p class="mv-caption centre soon">{notice}</p>
	{/if}
</Shell>

<style>
	.seats {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 14px;
	}

	.seat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--ink);
	}

	.seat.empty .who {
		color: var(--ink-soft);
		font-style: italic;
	}

	.seat em {
		font-style: normal;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--crimson);
		margin-left: 6px;
	}

	.state {
		font-size: 11px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.state.on {
		color: var(--forest);
		font-weight: 600;
	}

	.centre {
		text-align: center;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-family: var(--font-body);
		color: var(--parchment);
		font-size: clamp(13px, 1.5vw, 16px);
	}

	.opt {
		flex: 0 0 auto;
		min-width: 130px;
		padding: 10px 14px;
		border: 2px solid var(--gold);
		background: var(--royal);
		color: var(--parchment);
		font-family: var(--font-body);
		font-size: 15px;
		cursor: pointer;
	}

	.opt:hover {
		background: var(--royal-light);
		color: var(--gold-bright);
	}

	.room {
		padding: 20px;
		text-align: center;
	}

	.code {
		font-family: var(--font-display);
		font-size: clamp(30px, 9vw, 54px);
		color: var(--crimson);
		letter-spacing: 0.08em;
		margin: 10px 0;
		animation: pulse 1.6s ease-in-out infinite;
	}

	.hint {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--ink-soft);
		margin: 0;
	}

	.code-input {
		width: 100%;
		box-sizing: border-box;
		padding: 14px;
		text-align: center;
		font-family: var(--font-display);
		font-size: clamp(24px, 7vw, 38px);
		letter-spacing: 0.3em;
		text-transform: uppercase;
		background: rgba(232, 216, 176, 0.92);
		border: 2px solid var(--gold);
		color: var(--ink);
	}

	.mv-button.waiting {
		background: rgba(47, 74, 50, 0.35);
		cursor: default;
	}

	.soon {
		color: var(--gold-bright);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.72;
		}
	}
</style>
