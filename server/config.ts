export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface BackendConfig {
	host: string;
	port: number;
	logLevel: LogLevel;
	matchWebSocketPath: string;
}

const LOG_LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);

/** Reads and validates the backend's process-level configuration in one place. */
export function readBackendConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
	const port = Number(env.PORT ?? 8787);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`PORT must be an integer between 1 and 65535; received ${env.PORT}.`);
	}

	const requestedLevel = env.LOG_LEVEL as LogLevel | undefined;
	if (requestedLevel && !LOG_LEVELS.has(requestedLevel)) {
		throw new Error(`LOG_LEVEL must be one of ${[...LOG_LEVELS].join(', ')}.`);
	}

	return {
		host: env.HOST ?? '0.0.0.0',
		port,
		logLevel: requestedLevel ?? 'info',
		matchWebSocketPath: normalisePath(env.MATCH_WEBSOCKET_PATH ?? '/ws/matches')
	};
}

function normalisePath(value: string): string {
	const path = value.trim();
	if (!path.startsWith('/') || path.includes('?') || path.includes('#')) {
		throw new Error('MATCH_WEBSOCKET_PATH must be an absolute URL path.');
	}
	return path.length > 1 ? path.replace(/\/+$/, '') : path;
}
