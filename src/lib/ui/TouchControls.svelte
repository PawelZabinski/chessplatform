<script lang="ts">
	import type { Action, Input } from '$lib/platformer/engine/Input';

	export let input: Input | null = null;

	/**
	 * Pointer events rather than click, so a held button reads as held. Capture
	 * releases on the window too: a finger that slides off the button must not
	 * leave the climber running forever.
	 */
	function press(action: Action, event: PointerEvent) {
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		input?.setTouch(action, true);
	}

	function release(action: Action) {
		input?.setTouch(action, false);
	}
</script>

<div class="pad" aria-hidden="true">
	<div class="cluster left">
		<button
			type="button"
			on:pointerdown={(e) => press('left', e)}
			on:pointerup={() => release('left')}
			on:pointercancel={() => release('left')}
			on:pointerleave={() => release('left')}>◀</button
		>
		<button
			type="button"
			on:pointerdown={(e) => press('right', e)}
			on:pointerup={() => release('right')}
			on:pointercancel={() => release('right')}
			on:pointerleave={() => release('right')}>▶</button
		>
	</div>

	<div class="cluster right">
		<button
			class="slow"
			type="button"
			on:pointerdown={(e) => press('slow', e)}
			on:pointerup={() => release('slow')}
			on:pointercancel={() => release('slow')}>◑</button
		>
		<button
			type="button"
			on:pointerdown={(e) => press('drop', e)}
			on:pointerup={() => release('drop')}
			on:pointercancel={() => release('drop')}>▼</button
		>
		<button
			class="jump"
			type="button"
			on:pointerdown={(e) => press('jump', e)}
			on:pointerup={() => release('jump')}
			on:pointercancel={() => release('jump')}>▲</button
		>
	</div>
</div>

<style>
	.pad {
		position: absolute;
		inset: auto 0 0 0;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
		pointer-events: none;
	}

	.cluster {
		display: flex;
		gap: 10px;
		align-items: flex-end;
		pointer-events: auto;
	}

	.cluster.right {
		align-items: flex-end;
	}

	button {
		width: clamp(50px, 13vw, 68px);
		height: clamp(50px, 13vw, 68px);
		border-radius: 50%;
		border: 2px solid var(--gold);
		background: rgba(59, 42, 28, 0.66);
		color: var(--parchment);
		font-size: clamp(18px, 4.5vw, 24px);
		line-height: 1;
		display: grid;
		place-items: center;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
		cursor: pointer;
	}

	button:active {
		background: rgba(61, 76, 133, 0.9);
		color: var(--gold-bright);
	}

	button.jump {
		background: rgba(47, 74, 50, 0.7);
		width: clamp(60px, 16vw, 82px);
		height: clamp(60px, 16vw, 82px);
	}

	button.slow {
		background: rgba(42, 53, 96, 0.7);
		width: clamp(44px, 11vw, 56px);
		height: clamp(44px, 11vw, 56px);
		align-self: flex-start;
	}
</style>
