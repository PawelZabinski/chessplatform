import { dev } from '$app/environment';

/**
 * Logging.
 *
 * Ordinary structured application logging: levelled, namespaced, written to the
 * console, and quiet in production unless something is actually wrong. Nothing
 * about it is part of the game's UI.
 *
 * Levels follow the usual convention — debug is development noise, info is
 * lifecycle worth seeing, warn is a recoverable surprise, error is a bug. The
 * threshold defaults to `debug` in dev and `warn` in a production build, and can
 * be overridden at runtime without a rebuild:
 *
 *   localStorage.setItem('chessplatform:log', 'debug')   // then reload
 *
 * A short in-memory ring buffer is kept as well, purely so that `log.dump()` in
 * the console can print what led up to a problem — the same reason a server
 * keeps recent request logs. It is not rendered anywhere.
 *
 * `invariant` records conditions that are supposed to be impossible. It exists
 * because this game's characteristic failure is silence: a board that has
 * quietly stopped accepting input produces no exception and no visible symptom.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogArea = 'run' | 'board' | 'engine' | 'climb' | 'input' | 'net' | 'app';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogEntry {
	at: number;
	level: LogLevel;
	area: LogArea;
	message: string;
	data?: Record<string, unknown>;
}

/** Enough recent history to explain a failure, small enough to ignore. */
const CAPACITY = 200;
const recent: LogEntry[] = [];

function initialThreshold(): LogLevel {
	if (typeof localStorage !== 'undefined') {
		const override = localStorage.getItem('chessplatform:log');
		if (override && override in ORDER) return override as LogLevel;
	}
	return dev ? 'debug' : 'warn';
}

let threshold: LogLevel = 'warn';
let resolved = false;

function enabled(level: LogLevel) {
	// Resolved lazily: the module is imported during SSR/prerender, where there
	// is no localStorage to read the override from.
	if (!resolved && typeof window !== 'undefined') {
		threshold = initialThreshold();
		resolved = true;
	}
	return ORDER[level] >= ORDER[threshold];
}

const STYLE: Record<LogLevel, string> = {
	debug: 'color:#8a6f47',
	info: 'color:#3b7dc9',
	warn: 'color:#c9a227;font-weight:600',
	error: 'color:#c0392b;font-weight:600'
};

function emit(level: LogLevel, area: LogArea, message: string, data?: Record<string, unknown>) {
	const entry: LogEntry = { at: Date.now(), level, area, message, data };
	recent.push(entry);
	if (recent.length > CAPACITY) recent.shift();

	if (!enabled(level)) return;

	const method = level === 'debug' ? 'debug' : level === 'info' ? 'info' : level;
	const args: unknown[] = [`%c${area}%c ${message}`, STYLE[level], 'color:inherit'];
	if (data) args.push(data);
	(console[method] as (...a: unknown[]) => void)(...args);
}

export const log = {
	debug: (area: LogArea, message: string, data?: Record<string, unknown>) =>
		emit('debug', area, message, data),
	info: (area: LogArea, message: string, data?: Record<string, unknown>) =>
		emit('info', area, message, data),
	warn: (area: LogArea, message: string, data?: Record<string, unknown>) =>
		emit('warn', area, message, data),
	error: (area: LogArea, message: string, data?: Record<string, unknown>) =>
		emit('error', area, message, data),

	/** Records an impossible condition. Never throws — a broken invariant during
	 * play should leave a trail, not take the game down on top of the player. */
	invariant(condition: boolean, area: LogArea, message: string, data?: Record<string, unknown>) {
		if (condition) return true;
		emit('error', area, `INVARIANT: ${message}`, data);
		return false;
	},

	setLevel(level: LogLevel) {
		threshold = level;
		resolved = true;
		try {
			localStorage.setItem('chessplatform:log', level);
		} catch {
			/* Not persisted; still applies for this session. */
		}
	},

	/** Prints recent history as a table, for working out what led to a failure. */
	dump() {
		console.table(
			recent.map((e) => ({
				time: new Date(e.at).toISOString().slice(11, 23),
				level: e.level,
				area: e.area,
				message: e.message,
				data: e.data ? JSON.stringify(e.data) : ''
			}))
		);
	},

	recent: () => [...recent]
};

/**
 * Routes uncaught errors and rejections into the same stream, so a failure
 * inside a worker callback or an animation frame is reported like everything
 * else rather than vanishing.
 */
export function installGlobalErrorLogging() {
	if (typeof window === 'undefined') return;

	window.addEventListener('error', (event) => {
		log.error('app', 'Uncaught error', {
			message: event.message,
			source: `${event.filename}:${event.lineno}:${event.colno}`
		});
	});

	window.addEventListener('unhandledrejection', (event) => {
		log.error('app', 'Unhandled promise rejection', { reason: String(event.reason) });
	});

	(window as unknown as Record<string, unknown>).chessplatformLog = log;
}
