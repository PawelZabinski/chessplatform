<script lang="ts">
	export let title: string;
	export let subtitle: string | null = null;
	/** Menus scroll on short screens rather than clipping. */
	export let wide = false;
</script>

<!--
	Shared frame for every menu screen.

	Menus are markup now rather than hand-placed canvas text, so they scroll,
	wrap and reflow on their own. This is the single place the gold border,
	vignette and heading treatment live, which is what keeps the screens looking
	like one game.
-->
<div class="screen">
	<div class="frame">
		<div class="inner" class:wide>
			<header>
				<h1 class="mv-title">{title}</h1>
				<div class="mv-rule"><span></span></div>
				{#if subtitle}
					<p class="mv-caption sub">{subtitle}</p>
				{/if}
			</header>

			<slot />
		</div>
	</div>
</div>

<style>
	.screen {
		min-height: 100dvh;
		width: 100vw;
		box-sizing: border-box;
		padding: clamp(10px, 2vh, 26px);
		background:
			radial-gradient(circle at 50% 28%, #241a12 0%, #140e09 46%, var(--shadow) 100%),
			var(--shadow);
		display: grid;
		place-items: center;
		overflow-y: auto;
	}

	.frame {
		width: 100%;
		min-height: calc(100dvh - clamp(20px, 4vh, 52px));
		box-sizing: border-box;
		border: 1px solid rgba(201, 162, 39, 0.5);
		box-shadow: inset 0 0 0 6px rgba(11, 7, 4, 0.6);
		display: grid;
		place-items: center;
		padding: clamp(14px, 3vh, 36px) clamp(12px, 3vw, 32px);
	}

	.inner {
		width: min(520px, 100%);
		display: flex;
		flex-direction: column;
		gap: clamp(14px, 2.4vh, 24px);
	}

	.inner.wide {
		width: min(960px, 100%);
	}

	header {
		text-align: center;
	}

	h1 {
		font-size: clamp(28px, 6vw, 52px);
	}

	.sub {
		margin-top: 12px;
	}
</style>
