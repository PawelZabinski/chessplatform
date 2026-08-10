/**
 * Sanity-checks every tower floor's starting position.
 *
 * Catches the mistakes that are easy to make when hand-authoring FENs and
 * invisible until you actually play the floor: an illegal position, Black to
 * move when the player is always White, a position that is already checkmate
 * or stalemate, or one with so few legal moves it plays itself.
 *
 * Run with: npm run validate:levels
 */
import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const MIN_INTERESTING_MOVES = 3;

const source = readFileSync(new URL('../src/game/levels.ts', import.meta.url), 'utf8');
const floors = [
	...source.matchAll(
		/floor:\s*(\d+),\s*\n\s*name:\s*'([^']+)',\s*\n\s*wing:\s*'([^']+)',\s*\n\s*fen:\s*'([^']+)'/g
	)
].map((m) => ({ floor: Number(m[1]), name: m[2], wing: m[3], fen: m[4] }));

if (floors.length === 0) {
	console.error('No floors parsed from levels.ts — has its shape changed?');
	process.exit(1);
}

let failures = 0;

for (const entry of floors) {
	let chess;
	try {
		chess = new Chess(entry.fen);
	} catch (error) {
		console.error(`Floor ${entry.floor} (${entry.name}): invalid FEN — ${error.message}`);
		failures++;
		continue;
	}

	const problems = [];
	if (chess.turn() !== 'w') problems.push('Black to move (the player is always White)');
	if (chess.isGameOver()) problems.push('position is already over');
	if (chess.isInsufficientMaterial()) problems.push('insufficient material — instant draw');

	const legalMoves = chess.moves().length;
	if (legalMoves < MIN_INTERESTING_MOVES) {
		problems.push(`only ${legalMoves} legal move(s) — effectively forced`);
	}

	let material = 0;
	for (const row of chess.board()) {
		for (const square of row) {
			if (!square) continue;
			material += (square.color === 'w' ? 1 : -1) * PIECE_VALUE[square.type];
		}
	}

	const balance = `${material > 0 ? '+' : ''}${material}`;
	if (problems.length > 0) {
		failures++;
		console.error(
			`Floor ${String(entry.floor).padStart(2)} ${entry.name.padEnd(20)} FAIL — ${problems.join('; ')}`
		);
	} else {
		console.log(
			`Floor ${String(entry.floor).padStart(2)} ${entry.name.padEnd(20)} ok   material=${balance.padStart(3)} moves=${String(legalMoves).padStart(2)}`
		);
	}
}

console.log(`\n${floors.length} floors checked, ${failures} problem(s).`);
process.exit(failures > 0 ? 1 : 0);
