/**
 * Room codes.
 *
 * Short enough to read aloud or type from a message, and drawn from an alphabet
 * with no visually ambiguous characters — no 0/O, no 1/I/L — because these get
 * passed between people verbally more often than they get copy-pasted.
 *
 * Generation is client-side only for now. When the match server lands it becomes
 * authoritative (it has to reject collisions), and this stays as the local
 * fallback for offline/dev use plus the shared validation rules.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
	const bytes = new Uint32Array(ROOM_CODE_LENGTH);

	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
	}

	let code = '';
	for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
		code += ALPHABET[bytes[i] % ALPHABET.length];
	}
	return code;
}

/** Uppercases and strips anything not in the alphabet, for forgiving input. */
export function normaliseRoomCode(input: string): string {
	return input
		.toUpperCase()
		.split('')
		.filter((c) => ALPHABET.includes(c))
		.join('')
		.slice(0, ROOM_CODE_LENGTH);
}

export function isCompleteRoomCode(code: string): boolean {
	return normaliseRoomCode(code).length === ROOM_CODE_LENGTH;
}

/** Formatted for display: "ABC DEF" reads back more reliably than "ABCDEF". */
export function formatRoomCode(code: string): string {
	const clean = normaliseRoomCode(code);
	if (clean.length <= 3) return clean;
	return `${clean.slice(0, 3)} ${clean.slice(3)}`;
}
