<script context="module" lang="ts">

    import type { Game, Scene } from "phaser";

    export type TPhaserRef = {
        game: Game | null,
        scene: Scene | null
    };

    // TODOs:
    // - Implement Multiplayer (using websockets)
    // - Remove the phaser game scenes and implement the UI with sveltejs directly?
    // - Figure out hosting and deployment - sort out build issues
</script>

<script lang="ts">

    import { onMount } from "svelte";
    import StartGame from "./game/main";
    import { EventBus } from './game/EventBus';

    export let phaserRef: TPhaserRef = {
        game: null,
        scene: null
    };

    export let currentActiveScene: ((scene: Scene) => void) | undefined;

    onMount(() => {

        phaserRef.game = StartGame("game-container");

        EventBus.on('current-scene-ready', (scene_instance: Scene) => {

            phaserRef.scene = scene_instance;

            if(currentActiveScene)
            {
                
                currentActiveScene(scene_instance);
                
            }

        });

    });

</script>

<div id="game-container"></div>

<style>
    /* Phaser's RESIZE scale mode sizes the canvas to this element, so it must
       fill its flex slot exactly — 100vh would overflow the stacked mobile
       layout, where the climb only gets part of the screen. */
    #game-container {
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }

    #game-container :global(canvas) {
        display: block;
    }
</style>
