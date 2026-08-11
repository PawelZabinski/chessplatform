import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';

// chessground's package exports map rewrites "./*" to "./*.js", so its
// stylesheets cannot be imported by package path. Aliasing the assets folder
// keeps the package as the source of truth rather than vendoring its CSS.
const chessgroundAssets = fileURLToPath(new URL('../node_modules/chessground/assets', import.meta.url));


// https://vitejs.dev/config/
export default defineConfig({
	resolve: {
		alias: { 'chessground-assets': chessgroundAssets }
	},
	plugins: [
		sveltekit(),
	],
	server: {
		port: 8080
	}
})
