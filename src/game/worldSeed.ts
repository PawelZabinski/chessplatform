/**
 * Deterministic random streams for platform generation.
 *
 * A separate stream is derived for every band. That makes a band's layout depend
 * only on the world seed and its altitude, not on frame rate, pruning, or which
 * client happened to generate it first.
 */

function mix32(value: number): number {
	let mixed = value >>> 0;
	mixed ^= mixed >>> 16;
	mixed = Math.imul(mixed, 0x7feb352d);
	mixed ^= mixed >>> 15;
	mixed = Math.imul(mixed, 0x846ca68b);
	mixed ^= mixed >>> 16;
	return mixed >>> 0;
}

export function seededRandom(seed: number, stream = 0): () => number {
	let state = mix32((seed >>> 0) ^ Math.imul(stream + 1, 0x9e3779b1));
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
	};
}

/** A tower floor always receives the same layout, including after a restart. */
export function towerWorldSeed(floor: number): number {
	return mix32(0x43485353 ^ Math.max(1, Math.trunc(floor)));
}

/** A new endless run or multiplayer lobby receives a new unsigned 32-bit seed. */
export function randomWorldSeed(): number {
	const cryptoApi = globalThis.crypto;
	if (cryptoApi?.getRandomValues) {
		const value = new Uint32Array(1);
		cryptoApi.getRandomValues(value);
		return value[0];
	}
	return Math.floor(Math.random() * 0x100000000) >>> 0;
}
