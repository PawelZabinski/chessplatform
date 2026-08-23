import type { LogLevel } from './config.ts';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, unknown>;

export interface Logger {
	debug(event: string, fields?: LogFields): void;
	info(event: string, fields?: LogFields): void;
	warn(event: string, fields?: LogFields): void;
	error(event: string, fields?: LogFields): void;
}

/** Structured JSON logger shared by every backend module. */
export function createLogger(threshold: LogLevel): Logger {
	const write = (level: LogLevel, event: string, fields: LogFields = {}) => {
		if (LEVELS[level] < LEVELS[threshold]) return;
		const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
		if (level === 'error') console.error(line);
		else if (level === 'warn') console.warn(line);
		else console.log(line);
	};

	return {
		debug: (event, fields) => write('debug', event, fields),
		info: (event, fields) => write('info', event, fields),
		warn: (event, fields) => write('warn', event, fields),
		error: (event, fields) => write('error', event, fields)
	};
}
