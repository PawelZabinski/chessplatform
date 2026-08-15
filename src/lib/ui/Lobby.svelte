<script lang="ts">
	import { matchClient } from '$game/multiplayer/MatchClient';
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
		generateRoomCode,
		isCompleteRoomCode,
		normaliseRoomCode
	} from '$game/multiplayer/roomCode';
	import { goto } from '$lib/stores/app';
	import Shell from './Shell.svelte';

	type Phase = 'choose' | 'config' | 'room' | 'join';

	let phase: Phase = 'choose';
	let config = loadDraftConfig();
	let roomCode = '';
	let joinCode = '';
	let notice = '';

	// Everything up to the connection is real; only the socket is missing.
	const available = matchClient.isAvailable;

	function cycle<T>(options: ConfigOption<T>[], current: T, apply: (v: T) => void) {
		apply(nextOption(options, current));
		config = config;
	}

	function createRoom() {
		saveDraftConfig(config);
		// Locally generated for now; the server becomes authoritative once the
		// transport exists, since only it can reject a collision.
		roomCode = generateRoomCode();
		phase = 'room';
	}

	function start() {
		if (!available) {
			notice = 'Coming soon — no match server yet';
			setTimeout(() => (notice = ''), 2200);
			return;
		}
		matchClient
			.connect({ displayName: 'Host', lobbyCode: roomCode })
			.then(() => matchClient.sendConfig(config))
			.catch(() => (notice = 'Could not reach the match server'));
	}

	function join() {
		if (!isCompleteRoomCode(joinCode)) return;
		if (!available) {
			notice = 'Coming soon — no match server yet';
			setTimeout(() => (notice = ''), 2200);
			return;
		}
		matchClient
			.connect({ displayName: 'Guest', lobbyCode: joinCode })
			.catch(() => (notice = 'Could not reach the match server'));
	}

	function onCodeInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		joinCode = normaliseRoomCode(input.value);
		input.value = joinCode;
	}
</script>

<Shell
	title="Two Climbers"
	subtitle={phase === 'choose'
		? 'Race a rival up the same tower. Nobody waits their turn — play a move, wait out your cooldown, play again.'
		: null}
>
	{#if phase === 'choose'}
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

		<button class="mv-button" on:click={createRoom}>Create Room</button>
		<button class="mv-button crimson" on:click={() => (phase = 'choose')}>Back</button>
	{:else if phase === 'room'}
		<div class="mv-panel room">
			<p class="hint">Give this code to your rival</p>
			<div class="code">{formatRoomCode(roomCode)}</div>
			<p class="hint">They pick “Join with a Code” and enter it.</p>
		</div>

		<p class="mv-caption centre mv-gold">{summarise(config)}</p>

		<button class="mv-button" class:waiting={!available} on:click={start}>
			{available ? 'Start Match' : 'Waiting for an opponent…'}
		</button>
		{#if !available}
			<p class="mv-caption centre soon">Coming soon — no match server yet</p>
		{/if}

		<button class="mv-button royal" on:click={() => (phase = 'config')}>Change Settings</button>
		<button class="mv-button crimson" on:click={() => goto({ name: 'menu' })}>
			Return to Gate
		</button>
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
