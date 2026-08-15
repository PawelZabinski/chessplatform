<script lang="ts">
	import Leaderboard from '$lib/ui/Leaderboard.svelte';
	import Lobby from '$lib/ui/Lobby.svelte';
	import MainMenu from '$lib/ui/MainMenu.svelte';
	import PlayScreen from '$lib/ui/PlayScreen.svelte';
	import Results from '$lib/ui/Results.svelte';
	import TowerSelect from '$lib/ui/TowerSelect.svelte';
	import { goto, screen } from '$lib/stores/app';
	import '$lib/ui/theme.css';
</script>

<!--
	One site.

	Each screen is its own component; the play screen composes the two halves of
	the game (the climb and the board) side by side. Keying the play screen on its
	mode and floor means starting a different floor tears the old run down and
	builds a fresh one, rather than trying to mutate a live game into a new state.
-->
{#if $screen.name === 'menu'}
	<MainMenu />
{:else if $screen.name === 'tower'}
	<TowerSelect />
{:else if $screen.name === 'leaderboard'}
	<Leaderboard />
{:else if $screen.name === 'lobby'}
	<Lobby />
{:else if $screen.name === 'play'}
	{#key `${$screen.mode}-${$screen.floor ?? 'endless'}`}
		<PlayScreen
			mode={$screen.mode}
			floor={$screen.floor}
			onEnd={(outcome) => goto({ name: 'results', outcome })}
		/>
	{/key}
{:else if $screen.name === 'results'}
	<Results outcome={$screen.outcome} />
{/if}
