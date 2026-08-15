import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			precompress: false,
			fallback: 'index.html'
		}),
		// Pure game rules (lift, stages, floors, themes) are shared between the
		// platformer and, later, the match server — so they get their own alias
		// rather than being reached through a chain of ../../.
		alias: {
			$game: 'src/game'
		}
	}
};

export default config;
