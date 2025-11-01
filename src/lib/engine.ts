import { Chess, type Move } from 'chess.js';

type EngineState = 'uninitialised' | 'initialising' | 'waiting' | 'searching';

export interface EngineOptions {
	moveTime?: number;
	depth?: number;
	color?: 'w' | 'b';
	stockfishPath?: string;
	randomMoveProbability?: number;
}

type UciCallback = (uci: string) => void;

export class Engine {
	private stockfish?: Worker;
	private state: EngineState = 'uninitialised';
	private readonly moveTime: number;
	private readonly depth: number;
	private readonly stockfishPath: string;
	private onUciOk?: () => void;
	private onBestMove?: UciCallback;
	private externalUciCallback?: UciCallback;
	private readonly randomMoveProbability: number;
	private readonly handleUciMessage = (event: MessageEvent<string>) => {
		this.onUci(event.data);
	};

	public readonly color: 'w' | 'b';

	constructor(options: EngineOptions = {}) {
		this.moveTime = options.moveTime ?? 2000;
		this.depth = options.depth ?? 40;
		this.color = options.color ?? 'b';
		this.stockfishPath = options.stockfishPath ?? 'stockfish.js';
		this.randomMoveProbability = options.randomMoveProbability ?? 0.1;
	}

	/** Initialise Stockfish. Resolve promise after receiving uciok. */
	init(): Promise<void> {
		return new Promise((resolve) => {
			this.state = 'initialising';
			this.stockfish = new Worker(this.stockfishPath);
			this.stockfish.addEventListener('message', this.handleUciMessage);
			this.onUciOk = () => {
				if (this.state === 'initialising') {
					this.state = 'waiting';
					this.onUciOk = undefined;
					resolve();
				}
			};
			this.stockfish.postMessage('uci');
			this.stockfish.postMessage('setoption name Skill Level value 1');
			this.stockfish.postMessage('setoption name UCI_LimitStrength value true');
			this.stockfish.postMessage('setoption name UCI_Elo value 400');
		});
	}

	/** Callback when receiving UCI messages from Stockfish. */
	private onUci(uci: string): void {
		if (this.onUciOk && uci === 'uciok') {
			this.onUciOk();
		}
		if (this.onBestMove && uci.startsWith('bestmove')) {
			this.onBestMove(uci);
		}
		if (this.externalUciCallback) {
			this.externalUciCallback(uci);
		}
	}

	setUciCallback(callback: UciCallback): void {
		this.externalUciCallback = callback;
	}

	getMove(fen: string): Promise<string> {
		return new Promise((resolve) => {
			if (!this.stockfish) throw new Error('Engine not initialised');
			if (this.state !== 'waiting') throw new Error(`Engine not ready (state: ${this.state})`);

			this.state = 'searching';
			this.stockfish.postMessage(`position fen ${fen}`);
			this.stockfish.postMessage(`go depth ${this.depth} movetime ${this.moveTime}`);

			this.onBestMove = (uci) => {
				const uciArray = uci.split(' ');
				const bestMoveLan = uciArray[1] ?? '';
				this.state = 'waiting';
				this.onBestMove = undefined;

				if (Math.random() < this.randomMoveProbability) {
					const game = new Chess(fen);
					const allLegalMoves = game.moves({ verbose: true }) as Move[];
					const blunderMoves = allLegalMoves
						.map((move) => move.from + move.to)
						.filter((candidate) => candidate !== bestMoveLan);

					if (blunderMoves.length > 0) {
						const randomIndex = Math.floor(Math.random() * blunderMoves.length);
						resolve(blunderMoves[randomIndex]);
						return;
					}
				}

				resolve(bestMoveLan);
			};
		});
	}

	getColor(): 'w' | 'b' {
		return this.color;
	}

	isSearching(): boolean {
		return this.state === 'searching';
	}

	async stopSearch(): Promise<void> {
		return new Promise((resolve) => {
			if (!this.stockfish) throw new Error('Engine not initialised');
			if (this.state !== 'searching') {
				resolve();
				return;
			}

			this.onBestMove = () => {
				this.state = 'waiting';
				this.onBestMove = undefined;
				resolve();
			};
			this.stockfish.postMessage('stop');
		});
	}
}
