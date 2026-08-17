/**
 * Diagnostics.
 *
 * This game has two halves that mutate each other's state — a spike in the
 * platformer edits the chess position, a chess move launches the climber — and
 * when something goes wrong the evidence is a board that has quietly stopped
 * accepting input. There is no stack trace to read, and on a phone there is no
 * console to read it in.
 *
 * So every state change that crosses between the halves, plus every decision
 * that can end a game, records a line here. The buffer is bounded and in memory
 * only; it costs nothing until something breaks, and then it is the difference
 * between "it froze" and knowing which piece was removed on which square and
 * what the resulting position was.
 *
 * `invariant` is the important one: it records a condition that should be
 * impossible. The bug this was written for — a spike stripping White to a bare
 * king, leaving a position that was drawn but never reported, so the board
 * offered no legal moves and simply sat there — is exactly the shape of thing
 * that produces no error and no symptom except silence.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogArea = 'run' | 'board' | 'engine' | 'climb' | 'input' | 'app';

export interface LogEntry {
	seq: number;
	/** Milliseconds since the page loaded. */
	at: number;
	level: LogLevel;
	area: LogArea;
	message: string;
	data?: Record<string, unknown>;
}

/** Enough to cover a whole game without growing without bound. */
const CAPACITY = 400;

const entries: LogEntry[] = [];
let seq = 0;
const listeners = new Set<(entries: LogEntry[]) => void>();

/** Mirroring to the console is opt-in: it is noisy, and the panel is the point. */
let mirror = false;

function push(level: LogLevel, area: LogArea, message: string, data?: Record<string, unknown>) {
	const entry: LogEntry = {
		seq: (seq += 1),
		at: typeof performance !== 'undefined' ? Math.round(performance.now()) : 0,
		level,
		area,
		message,
		data
	};

	entries.push(entry);
	if (entries.length > CAPACITY) entries.splice(0, entries.length - CAPACITY);

	// Warnings and errors always reach the console — those are the ones worth
	// interrupting for, and they are rare enough not to spam.
	if (mirror || level === 'warn' || level === 'error') {
		const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
		console[method](`[${area}] ${message}`, data ?? '');
	}

	for (const listener of listeners) listener(entries);
}

export const log = {
	debug: (area: LogArea, message: string, data?: Record<string, unknown>) =>
		push('debug', area, message, data),
	info: (area: LogArea, message: string, data?: Record<string, unknown>) =>
		push('info', area, message, data),
	warn: (area: LogArea, message: string, data?: Record<string, unknown>) =>
		push('warn', area, message, data),
	error: (area: LogArea, message: string, data?: Record<string, unknown>) =>
		push('error', area, message, data),

	/**
	 * Records a condition that is supposed to be impossible.
	 *
	 * Never throws: a broken invariant during play should leave a trail, not take
	 * the game down on top of whatever the player was doing.
	 */
	invariant(condition: boolean, area: LogArea, message: string, data?: Record<string, unknown>) {
		if (condition) return true;
		push('error', area, `INVARIANT: ${message}`, data);
		return false;
	},

	all: () => [...entries],
	clear: () => {
		entries.length = 0;
		for (const listener of listeners) listener(entries);
	},
	setMirror: (on: boolean) => {
		mirror = on;
	},

	subscribe(listener: (entries: LogEntry[]) => void) {
		listeners.add(listener);
		listener(entries);
		return () => listeners.delete(listener);
	},

	/** The whole buffer as text, for pasting into a bug report. */
	asText() {
		return entries
			.map((e) => {
				const t = (e.at / 1000).toFixed(2).padStart(7);
				const body = e.data ? ` ${safeJson(e.data)}` : '';
				return `${t}s ${e.level.toUpperCase().padEnd(5)} ${e.area.padEnd(6)} ${e.message}${body}`;
			})
			.join('\n');
	}
};

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return '[unserialisable]';
	}
}

/**
 * Routes uncaught errors into the same buffer.
 *
 * A rejected promise inside the engine worker or an animation callback would
 * otherwise vanish into a console nobody is looking at.
 */
export function installGlobalErrorLogging() {
	if (typeof window === 'undefined') return;

	window.addEventListener('error', (event) => {
		log.error('app', 'Uncaught error', {
			message: event.message,
			source: `${event.filename}:${event.lineno}`
		});
	});

	window.addEventListener('unhandledrejection', (event) => {
		log.error('app', 'Unhandled promise rejection', { reason: String(event.reason) });
	});

	// One handle for debugging from a desktop console or a remote inspector.
	(window as unknown as Record<string, unknown>).chessplatformLog = log;
}
