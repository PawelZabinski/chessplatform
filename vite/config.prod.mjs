import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';

// chessground's package exports map rewrites "./*" to "./*.js", so its
// stylesheets cannot be imported by package path. Aliasing the assets folder
// keeps the package as the source of truth rather than vendoring its CSS.
const chessgroundAssets = fileURLToPath(new URL('../node_modules/chessground/assets', import.meta.url));


const MESSAGE_INTERVAL_MS = 1000000;
const lastMessageTime = process.env.LAST_MESSAGE_TIME || 0;

const now = Date.now();

if (now - lastMessageTime > MESSAGE_INTERVAL_MS) {
    process.stdout.write(`Building for production...\n`);
    const line = "---------------------------------------------------------";
    const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
    process.stdout.write(`${line}\n${msg}\n${line}\n`);
    process.env.LAST_MESSAGE_TIME = now;
}

export default defineConfig({
	// MatchClient reads PUBLIC_MATCH_SERVER at build time. Vite only exposes
	// VITE_* by default, while SvelteKit's public convention is PUBLIC_*.
	envPrefix: ['VITE_', 'PUBLIC_'],
	resolve: {
		alias: { 'chessground-assets': chessgroundAssets }
	},
    base: './',
    plugins: [
        sveltekit(),
    ],
    logLevel: 'error',
    build: {
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    }
});
