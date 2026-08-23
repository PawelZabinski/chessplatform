import { spawn } from 'node:child_process';

const commands = [
	{
		name: 'backend',
		child: spawn(process.execPath, ['--watch', 'server/index.ts'], { stdio: 'inherit' })
	},
	{
		name: 'web',
		child: spawn(
			process.execPath,
			['node_modules/vite/bin/vite.js', '--config', 'vite/config.dev.mjs'],
			{ stdio: 'inherit' }
		)
	}
];

let stopping = false;

function stop(exitCode = 0) {
	if (stopping) return;
	stopping = true;
	for (const { child } of commands) child.kill('SIGTERM');
	setTimeout(() => process.exit(exitCode), 250).unref();
}

for (const { name, child } of commands) {
	child.on('error', (error) => {
		console.error(`${name} failed to start:`, error);
		stop(1);
	});
	child.on('exit', (code, signal) => {
		if (stopping) return;
		console.error(`${name} stopped (${signal ?? `exit ${code ?? 1}`}).`);
		stop(code ?? 1);
	});
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
