import WebSocket from 'ws';
import { seededRandom, towerWorldSeed } from '../src/game/worldSeed.ts';

// Never let a missed message hang CI.
const guard = setTimeout(() => {
	console.error('TIMED OUT. Message log:\n' + log.join('\n'));
	process.exit(2);
}, 30000);
guard.unref?.();

const URL = process.env.MATCH_SERVER_URL ?? 'ws://localhost:8787/ws/matches';
const log = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name) {
	const ws = new WebSocket(URL);
	const inbox = [];
	const waiters = [];
	ws.on('message', (raw) => {
		const m = JSON.parse(String(raw));
		log.push(`${name} <- ${m.t}${m.code ? ':' + m.code : ''}`);
		inbox.push(m);
		for (let i = waiters.length - 1; i >= 0; i--) {
			if (waiters[i].pred(m)) {
				waiters[i].resolve(m);
				waiters.splice(i, 1);
			}
		}
	});
	return {
		name,
		ws,
		inbox,
		// Resolve immediately if the socket is already open: these are constructed
		// up front and may connect before anyone awaits them.
		open: () =>
			ws.readyState === WebSocket.OPEN
				? Promise.resolve()
				: new Promise((resolve, reject) => {
						ws.once('open', resolve);
						ws.once('error', reject);
					}),
		send: (m) => ws.send(JSON.stringify(m)),
		next(pred, timeout = 3000) {
			const found = inbox.find(pred);
			if (found) return Promise.resolve(found);
			return new Promise((resolve, reject) => {
				waiters.push({ pred, resolve });
				setTimeout(() => {
					console.error(`\n${name}: timed out waiting.`);
					console.error('results so far:', results);
					console.error('message log:\n' + log.join('\n'));
					reject(new Error(`${name}: timeout waiting`));
				}, timeout);
			});
		}
	};
}

const results = {};
function check(label, actual, expected) {
	const ok = JSON.stringify(actual) === JSON.stringify(expected);
	results[label] = ok ? `PASS (${JSON.stringify(actual)})` : `FAIL got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`;
}

const seedA = seededRandom(12345, 7);
const seedB = seededRandom(12345, 7);
check(
	'seeded streams reproduce layouts',
	[seedA(), seedA(), seedA()],
	[seedB(), seedB(), seedB()]
);
check('tower floor seed survives restart', towerWorldSeed(12), towerWorldSeed(12));
check('different tower floors use different seeds', towerWorldSeed(12) === towerWorldSeed(13), false);

const a = client('A');
const b = client('B');
await a.open();

// 1. Host joins, gets a room code and seat a.
a.send({ t: 'join', displayName: 'Alice' });
const lobbyA = await a.next((m) => m.t === 'lobby');
check('host seat', lobbyA.seat, 'a');
check('host is host', lobbyA.hostSeat, 'a');
check('multiplayer lava defaults off', lobbyA.config.lavaSpeed, 0);
const code = lobbyA.lobbyCode;

// 2. Non-host config is rejected.
await b.open();
b.send({ t: 'join', displayName: 'Bob', lobbyCode: code });
const lobbyB = await b.next((m) => m.t === 'lobby');
check('guest seat', lobbyB.seat, 'b');
check('both seated', lobbyB.players.length, 2);
check('guest sees code', lobbyB.lobbyCode, code);

b.send({ t: 'config', config: { targetHeight: 999 } });
const notHost = await b.next((m) => m.t === 'error' && m.code === 'notHost');
check('guest cannot configure', notHost.code, 'notHost');

// 3. A third player is refused.
const c = client('C');
await c.open();
c.send({ t: 'join', displayName: 'Carol', lobbyCode: code });
const full = await c.next((m) => m.t === 'error');
check('third player refused', full.code, 'lobbyFull');
c.ws.close();

// 4. Unknown code is refused.
const d = client('D');
await d.open();
d.send({ t: 'join', displayName: 'Dan', lobbyCode: 'ZZZZZZ' });
const unknown = await d.next((m) => m.t === 'error');
check('unknown lobby refused', unknown.code, 'unknownLobby');
d.ws.close();

// 5. Host config is clamped, not trusted.
a.send({
	t: 'config',
	config: { targetHeight: 40, moveCooldownMs: -500, gameSpeed: 99, lavaSpeed: 18 }
});
const cfg = await a.next((m) => m.t === 'lobby' && m.config.targetHeight === 40);
check('cooldown clamped >= 0', cfg.config.moveCooldownMs, 0);
check('gameSpeed clamped <= 1', cfg.config.gameSpeed, 1);
check('host can enable lava', cfg.config.lavaSpeed, 18);

// Set a real cooldown for the timing test.
a.send({ t: 'config', config: { moveCooldownMs: 400, chessMode: 'shared', lavaSpeed: 0 } });
const noLava = await a.next(
	(m) => m.t === 'lobby' && m.config.moveCooldownMs === 400 && m.config.lavaSpeed === 0
);
check('host can disable lava', noLava.config.lavaSpeed, 0);

// 6. Both ready -> match starts.
a.send({ t: 'ready', ready: true });
b.send({ t: 'ready', ready: true });
const startA = await a.next((m) => m.t === 'start');
const startB = await b.next((m) => m.t === 'start');
check('A plays white first game', startA.firstGame.youPlay, 'w');
check('B plays black first game', startB.firstGame.youPlay, 'b');
check('game index 0', startA.firstGame.gameIndex, 0);
check('world seed is an integer', Number.isInteger(startA.worldSeed), true);
check('both players share world seed', startB.worldSeed, startA.worldSeed);

// 7. Cooldown is enforced server-side: two moves in a row without waiting.
a.send({ t: 'move', lan: 'e2e4', gameIndex: 0, expectedFen: startA.firstGame.fen });
const applied = await a.next((m) => m.t === 'moveApplied');
check('move applied', applied.lan, 'e2e4');
check('mover identified', applied.by, 'a');
check('lift awarded (quiet move)', applied.lift, 450);
check('lift reasons included', applied.reasons, []);
check('en passant metadata included', applied.enPassant, false);
check('opponent saw the move', (await b.next((m) => m.t === 'moveApplied')).lan, 'e2e4');

a.send({ t: 'move', lan: 'g1f3', gameIndex: 0, expectedFen: applied.fen });
const cooling = await a.next((m) => m.t === 'error' && m.code === 'cooldown');
check('early move rejected', cooling.code, 'cooldown');
check('retry hint given', typeof cooling.retryInMs === 'number' && cooling.retryInMs > 0, true);

// 8. REAL-TIME: black may move immediately, without waiting for white's turn.
b.send({ t: 'move', lan: 'e7e5', gameIndex: 0, expectedFen: applied.fen });
const blackMove = await b.next((m) => m.t === 'moveApplied' && m.by === 'b');
check('black moved out of turn order', blackMove.lan, 'e7e5');

// ...and again straight after its own cooldown, while white is still cooling.
await wait(450);
b.send({ t: 'move', lan: 'g8f6', gameIndex: 0, expectedFen: blackMove.fen });
const blackTwice = await b.next((m) => m.t === 'moveApplied' && m.lan === 'g8f6');
check('same player moves twice in a row', blackTwice.by, 'b');

// 9. An illegal move is rejected with the authoritative position.
//    Wait out the cooldown first: the server checks the clock before legality,
//    so an early illegal move is (correctly) reported as a cooldown, not a bad move.
await wait(450);
b.send({ t: 'move', lan: 'a1a8', gameIndex: 0, expectedFen: blackTwice.fen });
const bad = await b.next((m) => m.t === 'error' && m.code === 'badMove');
check('illegal move rejected', bad.code, 'badMove');
check('resync fen supplied', typeof bad.fen === 'string' && bad.fen.includes('/'), true);

// 10. A move for a finished game index is rejected.
await wait(450);
a.send({ t: 'move', lan: 'd2d4', gameIndex: 99, expectedFen: blackTwice.fen });
const staleGame = await a.next((m) => m.t === 'error' && m.message.includes('already finished'));
check('stale game index rejected', staleGame.code, 'badMove');

// 11. Visual pose is relayed, while victory height remains clamped and trusted.
a.send({
	t: 'position',
	bands: 100000,
	x: 0.2,
	y: 333,
	vx: 0.15,
	vy: -440,
	facing: -1,
	anim: 'jump'
});
const positions = await a.next((m) => m.t === 'positions');
check('forged height clamped', positions.heights.a <= 40, true);
check('horizontal pose relayed', positions.positions.a.x, 0.2);
check('vertical pose relayed', positions.positions.a.y, 333);
check('velocity relayed for prediction', positions.positions.a.vy, -440);
check('animation pose relayed', `${positions.positions.a.facing}:${positions.positions.a.anim}`, '-1:jump');

// 12. Checkmate ends the game, flings the winner and deals a handicapped one.
//     Fool's mate, played by whoever can: reset to a fresh room for clarity.
const e = client('E');
const f = client('F');
await e.open();
await f.open();
e.send({ t: 'join', displayName: 'Eve' });
const lobbyE = await e.next((m) => m.t === 'lobby');
f.send({ t: 'join', displayName: 'Frank', lobbyCode: lobbyE.lobbyCode });
await f.next((m) => m.t === 'lobby');
e.send({ t: 'config', config: { moveCooldownMs: 0, chessMode: 'shared' } });
await e.next((m) => m.t === 'lobby' && m.config.moveCooldownMs === 0);
e.send({ t: 'ready', ready: true });
f.send({ t: 'ready', ready: true });
const startE = await e.next((m) => m.t === 'start');
let fen = startE.firstGame.fen;

// Fool's mate: white f2f3, black e7e5, white g2g4, black d8h4#
const seq = [
	[e, 'f2f3'],
	[f, 'e7e5'],
	[e, 'g2g4'],
	[f, 'd8h4']
];
for (const [who, lan] of seq) {
	who.send({ t: 'move', lan, gameIndex: 0, expectedFen: fen });
	const m = await who.next((x) => x.t === 'moveApplied' && x.lan === lan);
	fen = m.fen;
	await wait(30);
}

const ended = await e.next((m) => m.t === 'gameEnded');
check('checkmate detected', ended.reason, 'checkmate');
check('black (seat b) won', ended.winner, 'b');
check('winner flung upward', ended.fling > 0, true);
check('winner streak 1', ended.streaks.b, 1);

const nextE = await e.next((m) => m.t === 'gameStart' && m.gameIndex === 1);
const nextF = await f.next((m) => m.t === 'gameStart' && m.gameIndex === 1);
check('next game dealt', nextE.gameIndex, 1);
check('handicap explained', typeof nextE.handicapNote === 'string', true);
check('loser (e) takes the favoured black side', nextE.youPlay, 'b');
check('winner (f) takes weakened white', nextF.youPlay, 'w');
check('handicap fen differs from level', nextE.fen !== startE.firstGame.fen, true);

// 13. Real-time play may reach the unusual but legal-for-this-mode king capture.
//     It must pay and redeal exactly like checkmate instead of leaving a kingless,
//     disabled board behind.
const kingA = client('KingCaptureA');
const kingB = client('KingCaptureB');
await kingA.open();
await kingB.open();
kingA.send({ t: 'join', displayName: 'King taker' });
const kingLobby = await kingA.next((m) => m.t === 'lobby');
kingB.send({ t: 'join', displayName: 'King keeper', lobbyCode: kingLobby.lobbyCode });
await kingB.next((m) => m.t === 'lobby');
kingA.send({
	t: 'config',
	config: {
		moveCooldownMs: 0,
		chessMode: 'shared',
		opening: 'custom',
		customFen: '8/8/2k2Q2/8/8/8/8/4K3 w - - 0 1'
	}
});
await kingA.next((m) => m.t === 'lobby' && m.config.opening === 'custom');
kingA.send({ t: 'ready', ready: true });
kingB.send({ t: 'ready', ready: true });
const kingStart = await kingA.next((m) => m.t === 'start');
kingA.send({
	t: 'move',
	lan: 'f6c6',
	gameIndex: 0,
	expectedFen: kingStart.firstGame.fen
});
await kingA.next((m) => m.t === 'moveApplied' && m.lan === 'f6c6');
const kingEnded = await kingA.next((m) => m.t === 'gameEnded');
check('king capture detected', kingEnded.reason, 'king captured');
check('king capturer wins', kingEnded.winner, 'a');
check('king capture earns victory fling', kingEnded.fling > 0, true);
check(
	'king capture deals a fresh board',
	(await kingA.next((m) => m.t === 'gameStart' && m.gameIndex === 1)).gameIndex,
	1
);
kingA.ws.close();
kingB.ws.close();

// 14. End Run is unanimous: rejection keeps the match alive; acceptance ends
//     it as an agreed draw with no winner.
const voteA = client('VoteA');
const voteB = client('VoteB');
await voteA.open();
await voteB.open();
voteA.send({ t: 'join', displayName: 'Asker' });
const voteLobby = await voteA.next((m) => m.t === 'lobby');
voteB.send({ t: 'join', displayName: 'Decider', lobbyCode: voteLobby.lobbyCode });
await voteB.next((m) => m.t === 'lobby');
voteA.send({ t: 'ready', ready: true });
voteB.send({ t: 'ready', ready: true });
await voteA.next((m) => m.t === 'start');

voteA.send({ t: 'requestEndRun' });
const requested = await voteB.next((m) => m.t === 'endRunVote' && m.requestedBy === 'a');
check('end-run requester recorded', requested.acceptedBy, ['a']);
check('request alone does not end match', voteA.inbox.some((m) => m.t === 'matchEnded'), false);

voteB.send({ t: 'respondEndRun', accept: false });
const rejected = await voteA.next((m) => m.t === 'endRunVote' && m.requestedBy === null);
check('rejection dismisses end-run request', rejected.acceptedBy, []);
check('rejection keeps match alive', voteA.inbox.some((m) => m.t === 'matchEnded'), false);

voteB.send({ t: 'requestEndRun' });
await voteA.next((m) => m.t === 'endRunVote' && m.requestedBy === 'b');
voteA.send({ t: 'respondEndRun', accept: true });
const agreedA = await voteA.next((m) => m.t === 'matchEnded' && m.reason === 'agreed');
const agreedB = await voteB.next((m) => m.t === 'matchEnded' && m.reason === 'agreed');
check('unanimous end-run agreement ends match', agreedA.reason, 'agreed');
check('agreed end run has no winner', agreedB.winner, null);
voteA.ws.close();
voteB.ws.close();

// 15. Disconnect ends the match for the survivor.
f.ws.close();
const matchEnd = await e.next((m) => m.t === 'matchEnded', 4000);
check('disconnect ends match', matchEnd.reason, 'disconnected');
check('survivor wins', matchEnd.winner, 'a');

a.ws.close();
b.ws.close();
e.ws.close();

// 16. A room of five seats everyone, and a duel is refused at that size.
const room5 = [];
const host5 = client('H0');
await host5.open();
host5.send({ t: 'join', displayName: 'Host5' });
const l5 = await host5.next((m) => m.t === 'lobby');
host5.send({ t: 'config', config: { maxPlayers: 5, chessMode: 'shared', opening: 'random' } });
const cfg5 = await host5.next((m) => m.t === 'lobby' && m.config.maxPlayers === 5);
check('room admits five', cfg5.config.maxPlayers, 5);
check('duel refused above two', cfg5.config.chessMode, 'solo');
check('shuffled opening kept', cfg5.config.opening, 'random');
check(
	'host has a valid random colour',
	Number.isInteger(cfg5.players[0].colour) && cfg5.players[0].colour >= 0 && cfg5.players[0].colour < 5,
	true
);

for (let i = 1; i < 5; i++) {
	const p = client('P' + i);
	await p.open();
	p.send({ t: 'join', displayName: 'P' + i, lobbyCode: l5.lobbyCode });
	await p.next((m) => m.t === 'lobby' && m.players.length === i + 1);
	room5.push(p);
}
const fullLobby = await host5.next((m) => m.t === 'lobby' && m.players.length === 5);
check('five seated', fullLobby.players.length, 5);
check('every seat a distinct colour', new Set(fullLobby.players.map((p) => p.colour)).size, 5);

const sixth = client('X6');
await sixth.open();
sixth.send({ t: 'join', displayName: 'Six', lobbyCode: l5.lobbyCode });
check('sixth refused', (await sixth.next((m) => m.t === 'error')).code, 'lobbyFull');
sixth.ws.close();

// 15. A race starts with everyone on their own board.
host5.send({ t: 'ready', ready: true });
for (const p of room5) p.send({ t: 'ready', ready: true });
const start5 = await host5.next((m) => m.t === 'start');
const startP1 = await room5[0].next((m) => m.t === 'start');
check('race starts with five', start5.firstGame.shared, false);
check('race deals white to everyone', start5.firstGame.youPlay, 'w');
check('shuffled position is not the standard array', start5.firstGame.fen.startsWith('rnbqkbnr'), false);
check('race shares one world seed', startP1.worldSeed, start5.worldSeed);

// 16. Predicted poses from every seat reach everyone, and the race is winnable by height.
room5[0].send({
	t: 'position',
	bands: 5,
	x: 0.75,
	y: 950,
	vx: -0.2,
	vy: 120,
	facing: -1,
	anim: 'run'
});
const h = await host5.next((m) => m.t === 'positions' && m.heights.b > 0);
check('rival height broadcast', h.heights.b, 5);
check('rival live position broadcast', h.positions.b.x, 0.75);
check('rival prediction velocity broadcast', h.positions.b.vx, -0.2);

// 17. Moves are ignored in a race: the chess is local.
room5[0].send({ t: 'move', lan: 'e2e4', gameIndex: 0, expectedFen: start5.firstGame.fen });
let sawMove = false;
await wait(250);
sawMove = host5.inbox.some((m) => m.t === 'moveApplied');
check('race ignores move intents', sawMove, false);

host5.ws.close();
for (const p of room5) p.ws.close();

// 18. Threefold repetition is deliberately playable in a duel.
const repA = client('RA');
const repB = client('RB');
await repA.open();
await repB.open();
repA.send({ t: 'join', displayName: 'Repeat A' });
const repLobby = await repA.next((m) => m.t === 'lobby');
repB.send({ t: 'join', displayName: 'Repeat B', lobbyCode: repLobby.lobbyCode });
await repB.next((m) => m.t === 'lobby');
repA.send({ t: 'config', config: { moveCooldownMs: 0, chessMode: 'shared' } });
await repA.next((m) => m.t === 'lobby' && m.config.moveCooldownMs === 0);
repA.send({ t: 'ready', ready: true });
repB.send({ t: 'ready', ready: true });
const repStart = await repA.next((m) => m.t === 'start');
let repFen = repStart.firstGame.fen;
const repetition = [
	[repA, 'g1f3'],
	[repB, 'g8f6'],
	[repA, 'f3g1'],
	[repB, 'f6g8'],
	[repA, 'g1f3'],
	[repB, 'g8f6'],
	[repA, 'f3g1'],
	[repB, 'f6g8']
];
for (const [who, lan] of repetition) {
	who.send({ t: 'move', lan, gameIndex: 0, expectedFen: repFen });
	repFen = (await who.next((m) => m.t === 'moveApplied' && m.lan === lan)).fen;
}
await wait(50);
check('repetition does not end duel', repA.inbox.some((m) => m.t === 'gameEnded'), false);
repA.send({ t: 'move', lan: 'e2e4', gameIndex: 0, expectedFen: repFen });
check(
	'play continues after repetition',
	(await repA.next((m) => m.t === 'moveApplied' && m.lan === 'e2e4')).lan,
	'e2e4'
);
repA.ws.close();
repB.ws.close();

// 19. A king-only duel is replaced with a full, standard chess position.
const bareA = client('KA');
const bareB = client('KB');
await bareA.open();
await bareB.open();
bareA.send({ t: 'join', displayName: 'King A' });
const bareLobby = await bareA.next((m) => m.t === 'lobby');
bareB.send({ t: 'join', displayName: 'King B', lobbyCode: bareLobby.lobbyCode });
await bareB.next((m) => m.t === 'lobby');
bareA.send({
	t: 'config',
	config: {
		moveCooldownMs: 0,
		chessMode: 'shared',
		opening: 'custom',
		customFen: '8/8/8/8/8/8/4K3/7k w - - 0 1'
	}
});
await bareA.next((m) => m.t === 'lobby' && m.config.opening === 'custom');
bareA.send({ t: 'ready', ready: true });
bareB.send({ t: 'ready', ready: true });
const bareStart = await bareA.next((m) => m.t === 'start');
bareA.send({ t: 'move', lan: 'e2e3', gameIndex: 0, expectedFen: bareStart.firstGame.fen });
await bareA.next((m) => m.t === 'moveApplied' && m.lan === 'e2e3');
const bareEnded = await bareA.next((m) => m.t === 'gameEnded' && m.gameIndex === 0);
check(
	'insufficient material ends current duel game',
	`${bareEnded.reason}:${bareEnded.winner}`,
	'insufficient material:null'
);
const bareNext = await bareA.next((m) => m.t === 'gameStart' && m.gameIndex === 1);
check(
	'insufficient material deals fresh pieces',
	bareNext.fen,
	'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
);
bareA.ws.close();
bareB.ws.close();

clearTimeout(guard);
const failures = Object.entries(results).filter(([, v]) => v.startsWith('FAIL'));
console.log('\n=== RESULTS ===');
for (const [k, v] of Object.entries(results)) console.log(`${v.startsWith('PASS') ? '✓' : '✗'} ${k}: ${v}`);
console.log(`\n${Object.keys(results).length - failures.length}/${Object.keys(results).length} passed`);
if (failures.length) {
	console.log('\n--- message log ---');
	console.log(log.join('\n'));
}
process.exit(failures.length ? 1 : 0);
